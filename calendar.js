let currentMonth = new Date().getMonth();
let currentYear = new Date().getFullYear();
let events = [];

const calendarEvents = "events.json"

// Map event names to images
const defaultImages = {
  "Curse of Strahd": "img/strahd.jpg",
  "Beyond the Boundary": "img/beyond.png",
  "Chains of Asmodeus": "img/chains.webp",
  "Fractured Fates": "img/fates.png"
};


function renderCalendar() {
  const calendar = document.getElementById("calendar");
  const monthYear = document.getElementById("monthYear");
  const filter = document.getElementById("eventTypeFilter").value;
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const firstDay = new Date(currentYear, currentMonth, 1).getDay();
  const startDay = (firstDay + 6) % 7; // week starts on Monday
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

  // Previous month
  const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
  const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;
  const daysInPrevMonth = new Date(prevYear, prevMonth + 1, 0).getDate();

  calendar.innerHTML = "";
  monthYear.textContent = new Date(currentYear, currentMonth).toLocaleString("default", { month: "long", year: "numeric" });

  // helper to create a standardized day cell
  function createDayCell(displayNum, dateStr, isOtherMonth = false) {
    const dayBox = document.createElement('div');
    dayBox.className = 'day';
    if (isOtherMonth) dayBox.classList.add('other-month');
    if (dateStr === todayStr) dayBox.classList.add('today');

    // card structure
    const card = document.createElement('div');
    card.className = 'card day-card';

    const dateNum = document.createElement('div');
    dateNum.className = 'date-number';
    dateNum.innerHTML = `<strong>${displayNum}</strong>`;

    const eventsList = document.createElement('div');
    eventsList.className = 'events-list';

    card.appendChild(dateNum);
    card.appendChild(eventsList);
    dayBox.appendChild(card);

    return { dayBox, eventsList };
  }

  // Fill in days from previous month
  for (let i = 0; i < startDay; i++) {
    const dayNum = daysInPrevMonth - startDay + i + 1;
    const dateStr = `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
    const { dayBox, eventsList } = createDayCell(dayNum, dateStr, true);

    const dayEvents = events.filter(e => e.date.startsWith(dateStr));
    appendEventsToDay(eventsList, dayEvents, filter);
    calendar.appendChild(dayBox);
  }

  // Current month days
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dayEvents = events.filter(e => e.date.startsWith(dateStr));
    const { dayBox, eventsList } = createDayCell(day, dateStr, false);

    appendEventsToDay(eventsList, dayEvents, filter);
    calendar.appendChild(dayBox);
  }

  // Fill in days from next month to complete the last week
  const totalCells = startDay + daysInMonth;
  const nextDays = (7 - (totalCells % 7)) % 7;
  for (let i = 1; i <= nextDays; i++) {
    const nextMonth = currentMonth === 11 ? 0 : currentMonth + 1;
    const nextYear = currentMonth === 11 ? currentYear + 1 : currentYear;
    const dateStr = `${nextYear}-${String(nextMonth + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
    const { dayBox, eventsList } = createDayCell(i, dateStr, true);

    const dayEvents = events.filter(e => e.date.startsWith(dateStr));
    appendEventsToDay(eventsList, dayEvents, filter);
    calendar.appendChild(dayBox);
  }
}

function appendEventsToDay(eventsContainer, dayEvents, filter) {
  // eventsContainer is the .events-list element (not the dayBox)
  dayEvents.forEach(event => {
    const eventEl = document.createElement('div');
    eventEl.className = 'event';
    eventEl.dataset.type = event.type;
    eventEl.classList.add(`event-type-${event.type.replace(/\s+/g, '-').toLowerCase()}`);

    if (filter !== 'all' && event.title.trim() !== filter) {
      eventEl.classList.add('filtered-out');
    }

    const imgSrc = event.image || (defaultImages[event.title] || undefined);
    if (imgSrc) {
      const img = document.createElement('img');
      img.src = imgSrc;
      img.alt = event.title;
      eventEl.appendChild(img);
    }

    const content = document.createElement('div');
    content.className = 'event-content';
    const titleDiv = document.createElement('div');
    titleDiv.innerHTML = `${event.title}${event.time ? ` <small>(${event.time})</small>` : ''}`;
    content.appendChild(titleDiv);
    if (event.description) {
      const desc = document.createElement('div');
      desc.className = 'text-muted small';
      desc.textContent = event.description;
      content.appendChild(desc);
    }

    eventEl.appendChild(content);
    eventsContainer.appendChild(eventEl);
  });
}

function populateEventTitles() {
  const select = document.getElementById("eventTypeFilter");
    select.innerHTML = '<option value="all">All Campaigns</option>';
  
    //Get unique titles
  const uniqueTitles = [...new Set(events.map(e => e.title.trim()))];
  uniqueTitles.forEach(title => {
    const opt = document.createElement("option");
    opt.value = title;
    opt.textContent = title;
    select.appendChild(opt);
  });

  select.addEventListener("change", renderCalendar);
}

document.getElementById("prevMonth").addEventListener("click", () => {
  if (currentMonth === 0) {
    currentMonth = 11;
    currentYear--;
  } else {
    currentMonth--;
  }
  renderCalendar();
});

document.getElementById("nextMonth").addEventListener("click", () => {
  if (currentMonth === 11) {
    currentMonth = 0;
    currentYear++;
  } else {
    currentMonth++;
  }
  renderCalendar();
});

//  Load events from Google Calendar API
async function loadEvents() {
  try {
    const response = await fetch(calendarEvents);
    const data = await response.json();
    events = data.items.map(ev => {
      const start = ev.start.dateTime ? new Date(ev.start.dateTime) : new Date(ev.start.date);
      const localDate = new Date(start.getFullYear(), start.getMonth(), start.getDate());
      const title = ev.summary || "";
      return {
        date: `${localDate.getFullYear()}-${String(localDate.getMonth() + 1).padStart(2, '0')}-${String(localDate.getDate()).padStart(2, '0')}`,
        title: title,
  // Use 24-hour time format
  time: ev.start.dateTime ? start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) : null,
        type: title.replace(/\s+/g, '-').toLowerCase(),
        image: null,
        description: ev.description || ""
        };
      });
    populateEventTitles();
    renderCalendar();
  } catch (err) {
    console.error("Error loading events:", err);
  }
}

// Initialize
window.addEventListener("load", loadEvents);

// Theme toggle logic: persists in localStorage and toggles .dark-theme on body
function applyTheme(theme) {
  document.body.classList.toggle('dark-theme', theme === 'dark');
  // Also apply to the root element (html) so variable overrides are effective globally
  document.documentElement.classList.toggle('dark-theme', theme === 'dark');
  try { localStorage.setItem('calendar-theme', theme); } catch (e) { /* ignore */ }
}

function initThemeToggle() {
  const saved = (function(){ try { return localStorage.getItem('calendar-theme'); } catch(e){ return null; } })();
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const theme = saved || (prefersDark ? 'dark' : 'light');
  applyTheme(theme);

  // insert the toggle into the header placeholder if available, otherwise append to controls
  const placeholder = document.getElementById('themePlaceholder');
  const controls = document.getElementById('controls');
  const container = placeholder || controls;
  if (!container) return;
  let btn = document.getElementById('themeToggle');
  if (!btn) {
    btn = document.createElement('button');
    btn.id = 'themeToggle';
    btn.type = 'button';
    btn.className = 'btn btn-sm btn-outline-secondary ms-2';
    btn.title = 'Toggle light/dark';
    container.appendChild(btn);
  }
  function updateBtn() {
    btn.textContent = document.body.classList.contains('dark-theme') ? '☀️ Light' : '🌙 Dark';
  }
  btn.addEventListener('click', () => {
    const next = document.body.classList.contains('dark-theme') ? 'light' : 'dark';
    applyTheme(next);
    updateBtn();
  });
  updateBtn();
}

initThemeToggle();