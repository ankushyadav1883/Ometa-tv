// Multi Timezone Clock
// - Keeps a list of IANA time zones (common list)
// - Renders a clock card per zone, updates every second
// - Allows search + add selected zone, remove, persist in localStorage

const COMMON_ZONES = [
  "UTC",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Moscow",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Sao_Paulo",
  "America/Toronto",
  "America/Caracas",
  "Asia/Kolkata",
  "Asia/Shanghai",
  "Asia/Tokyo",
  "Asia/Singapore",
  "Asia/Dubai",
  "Australia/Sydney",
  "Pacific/Auckland"
];

const LS_KEY = "multi-tz-clocks:v1";

const tzSearch = document.getElementById("tz-search");
const tzSelect = document.getElementById("tz-select");
const addBtn = document.getElementById("add-btn");
const addCurrentBtn = document.getElementById("add-current");
const clearBtn = document.getElementById("clear-btn");
const clocksEl = document.getElementById("clocks");

let zones = loadZones();

function loadZones(){
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return ["UTC"];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length) return parsed;
  } catch(e){}
  return ["UTC"];
}

function saveZones(){
  localStorage.setItem(LS_KEY, JSON.stringify(zones));
}

function populateSelect(filter=""){
  const list = COMMON_ZONES.filter(z => z.toLowerCase().includes(filter.toLowerCase()));
  tzSelect.innerHTML = "";
  for(const z of list){
    const opt = document.createElement("option");
    opt.value = z;
    opt.textContent = z;
    tzSelect.appendChild(opt);
  }
  if (list.length) tzSelect.selectedIndex = 0;
}

function renderClocks(){
  clocksEl.innerHTML = "";
  for(const tz of zones){
    const card = document.createElement("div");
    card.className = "card";
    card.dataset.tz = tz;

    const header = document.createElement("div");
    header.className = "zone-name";

    const title = document.createElement("div");
    title.innerHTML = `<div class="zone-title">${tz}</div><div class="zone-sub" id="sub-${tz}"></div>`;
    header.appendChild(title);

    const removeBtn = document.createElement("button");
    removeBtn.className = "remove";
    removeBtn.title = `Remove ${tz}`;
    removeBtn.textContent = "Remove";
    removeBtn.addEventListener("click", () => {
      zones = zones.filter(x => x !== tz);
      saveZones();
      renderClocks();
    });

    header.appendChild(removeBtn);
    card.appendChild(header);

    const tEl = document.createElement("div");
    tEl.className = "time";
    tEl.id = `time-${tz}`;
    tEl.textContent = "--:--:--";
    card.appendChild(tEl);

    const meta = document.createElement("div");
    meta.className = "meta";
    meta.innerHTML = `<span id="date-${tz}">—</span> <span id="tzname-${tz}"></span>`;
    card.appendChild(meta);

    clocksEl.appendChild(card);
  }
  // render immediately so it shows something without waiting for the tick
  tick();
}

function formatForZone(date, tz){
  // returns object {time, date, tzName}
  try {
    const timeFmt = new Intl.DateTimeFormat(undefined, {
      hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false, timeZone: tz
    });
    const dateFmt = new Intl.DateTimeFormat(undefined, {
      year: "numeric", month: "short", day: "2-digit", timeZone: tz
    });
    const tzNameFmt = new Intl.DateTimeFormat(undefined, {
      timeZone: tz, timeZoneName: "short"
    });

    const time = timeFmt.format(date);
    const dat = dateFmt.format(date);
    const tzName = tzNameFmt.formatToParts ? tzNameFmt.format(date) : tzNameFmt.format(date);
    // formatToParts may include timeZoneName part; fallback to full string
    let tzShort = "";
    if (Array.isArray(tzName)) {
      const part = tzName.find(p => p.type === "timeZoneName");
      tzShort = part ? part.value : tz;
    } else {
      // try to extract substring like "GMT+1" from "1/1/2020, GMT+1"
      tzShort = String(tzName).match(/GMT[+\-]\d+/) ? String(tzName).match(/GMT[+\-]\d+/)[0] : tz;
    }

    return { time, date: dat, tzName: tzShort };
  } catch (err) {
    // invalid timezone or unsupported — fallback to UTC
    const fallback = new Intl.DateTimeFormat(undefined, {
      hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false, timeZone: "UTC"
    }).format(date);
    return { time: fallback, date: new Date().toLocaleDateString(), tzName: "UTC" };
  }
}

function tick(){
  const now = new Date();
  for(const tz of zones){
    const tEl = document.getElementById(`time-${tz}`);
    const dEl = document.getElementById(`date-${tz}`);
    const sEl = document.getElementById(`tzname-${tz}`);
    if (!tEl) continue;
    const f = formatForZone(now, tz);
    tEl.textContent = f.time;
    dEl.textContent = f.date;
    sEl.textContent = f.tzName;
  }
}

// wire up UI
populateSelect();
renderClocks();

tzSearch.addEventListener("input", e => populateSelect(e.target.value));

addBtn.addEventListener("click", () => {
  const tz = tzSelect.value;
  if (!tz) return;
  if (!zones.includes(tz)) {
    zones.push(tz);
    saveZones();
    renderClocks();
    // select the added option in the list
  }
});

addCurrentBtn.addEventListener("click", () => {
  // Try to detect user's IANA zone
  let tz;
  try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone; } catch(e){}
  if (!tz) tz = "UTC";
  if (!zones.includes(tz)){
    zones.push(tz);
    saveZones();
    renderClocks();
  } else {
    // bring attention to it
    const el = document.querySelector(`[data-tz="${tz}"]`);
    if (el) el.animate([{transform:"scale(1.02)"},{transform:"scale(1)"}],{duration:200});
  }
});

clearBtn.addEventListener("click", () => {
  if (!confirm("Clear all clocks?")) return;
  zones = [];
  saveZones();
  renderClocks();
});

// update every second, aligned to real seconds
function startTicker(){
  tick();
  const now = Date.now();
  const next = 1000 - (now % 1000);
  setTimeout(function(){
    tick();
    setInterval(tick, 1000);
  }, next);
}

startTicker();

// accessibility: allow adding on double-click of select
tzSelect.addEventListener("dblclick", () => addBtn.click());