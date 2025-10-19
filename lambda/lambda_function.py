import json
import os
import boto3
import urllib.parse
import urllib.request
import fnmatch
import ssl


def lambda_handler(event, context):
    # --- ENVIRONMENT VARIABLES ---
    bucket = os.environ["BUCKET_NAME"]
    distribution_id = os.environ["CLOUDFRONT_DISTRIBUTION_ID"]
    calendar_id = os.environ["CALENDAR_ID"]
    api_key = os.environ["GOOGLE_API_KEY"]

    # GitHub settings (optional)
    github_owner = os.environ.get("GITHUB_OWNER")
    github_repo = os.environ.get("GITHUB_REPO")
    github_branch = os.environ.get("GITHUB_BRANCH", "main")
    github_token = os.environ.get("GITHUB_TOKEN")  # optional (for private repo)
    exclude_patterns = [
        p.strip() for p in os.environ.get("EXCLUDE_PATTERNS", "lambda/*,.github/*").split(",")
    ]

    # --- 1. Fetch events from Google Calendar API ---
    base_url = f"https://www.googleapis.com/calendar/v3/calendars/{calendar_id}/events"
    params = {
        "key": api_key,
        "singleEvents": "true",
        "orderBy": "startTime",
        "timeMin": "2025-01-01T00:00:00Z",
        "maxResults": "2500"
    }
    url = f"{base_url}?{urllib.parse.urlencode(params)}"
    with urllib.request.urlopen(url) as response:
        data = json.loads(response.read().decode("utf-8"))

    # --- 2. Save events.json to S3 ---
    s3 = boto3.client("s3")
    s3.put_object(
        Bucket=bucket,
        Key="events.json",
        Body=json.dumps(data),
        ContentType="application/json",
    )

    # --- 3. Sync GitHub repo to S3 (if configured) ---
    if github_owner and github_repo:
        print(f"Syncing GitHub repo {github_owner}/{github_repo}@{github_branch}")

        # Prepare GitHub API request
        tree_url = f"https://api.github.com/repos/{github_owner}/{github_repo}/git/trees/{urllib.parse.quote_plus(github_branch)}?recursive=1"
        headers = {"User-Agent": "lambda-github-sync"}
        if github_token:
            headers["Authorization"] = f"token {github_token}"

        req = urllib.request.Request(tree_url, headers=headers)
        ctx = ssl.create_default_context()
        with urllib.request.urlopen(req, context=ctx) as response:
            tree_data = json.loads(response.read().decode("utf-8")).get("tree", [])

        def is_excluded(path):
            for pattern in exclude_patterns:
                if pattern and fnmatch.fnmatch(path, pattern):
                    return True
            return False

        uploaded_files = []
        for item in tree_data:
            if item.get("type") != "blob":
                continue
            path = item["path"]
            if is_excluded(path):
                print(f"Excluded: {path}")
                continue

            raw_url = f"https://raw.githubusercontent.com/{github_owner}/{github_repo}/{github_branch}/{path}"
            raw_req = urllib.request.Request(raw_url, headers=headers)
            try:
                with urllib.request.urlopen(raw_req, context=ctx) as r:
                    content = r.read()
            except Exception as e:
                print(f"Failed to fetch {path}: {e}")
                continue

            # Guess content type
            content_type = None
            if path.endswith(".html"):
                content_type = "text/html"
            elif path.endswith(".js"):
                content_type = "application/javascript"
            elif path.endswith(".json"):
                content_type = "application/json"
            elif path.endswith(".css"):
                content_type = "text/css"

            s3.put_object(
                Bucket=bucket,
                Key=path,
                Body=content,
                ContentType=content_type or "binary/octet-stream",
            )
            uploaded_files.append(path)

        print(f"Uploaded {len(uploaded_files)} files to s3://{bucket}/")

    # --- 4. Invalidate CloudFront cache ---
    cloudfront = boto3.client("cloudfront")
    cloudfront.create_invalidation(
        DistributionId=distribution_id,
        InvalidationBatch={
            "Paths": {"Quantity": 1, "Items": ["/*"]},
            "CallerReference": f"invalidate-{context.aws_request_id}"
        }
    )

    return {
        "statusCode": 200,
        "body": json.dumps({
            "message": "Calendar synced, GitHub files uploaded, cache invalidated!",
            "github_files": len(uploaded_files) if github_owner else 0
        })
    }
