let LISTINGS = [];
let JOBS = [];
let HOUSING = [];
let EVENTS = [];
let activeState = "ALL";
let activeCategory = "";
let query = "";
let activeView = "directory";
let jobQuery = "";
let housingQuery = "";
let eventQuery = "";

const grid = document.getElementById("grid");
const countEl = document.getElementById("count");
const emptyEl = document.getElementById("empty");
const searchEl = document.getElementById("search");
const categoryEl = document.getElementById("category");
const chipsEl = document.getElementById("chips");
const modal = document.getElementById("modal");
const modalBody = document.getElementById("modal-body");
const mapWrap = document.getElementById("map-wrap");
const mapNote = document.getElementById("map-note");
const viewListBtn = document.getElementById("view-list");
const viewMapBtn = document.getElementById("view-map");
let mapView = false, map = null, markerLayer = null;

const CATEGORY_ORDER = [
  "Restaurant", "Grocery", "Remittance & Finance", "Tax & Accounting",
  "Real Estate", "Legal & Immigration", "Driving School", "Beauty & Wellness",
  "Retail", "Health", "Services", "Other"
];

Promise.all([
  fetch("data/listings.json").then(r => r.json()),
  fetch("data/jobs.json").then(r => r.json()).catch(() => []),
  fetch("data/housing.json").then(r => r.json()).catch(() => []),
  fetch("data/events.json").then(r => r.json()).catch(() => [])
])
  .then(([listings, jobs, housing, events]) => {
    LISTINGS = Array.isArray(listings) ? listings : [];
    JOBS = Array.isArray(jobs) ? jobs : [];
    HOUSING = Array.isArray(housing) ? housing : [];
    EVENTS = Array.isArray(events) ? events : [];
    buildCategoryOptions();
    buildChips();
    render();
    renderJobs();
    renderHousing();
    renderEvents();
  })
  .catch(() => {
    countEl.textContent = "Could not load listings.";
  });

function buildCategoryOptions() {
  const present = [...new Set(LISTINGS.map(l => l.category).filter(Boolean))];
  const ordered = CATEGORY_ORDER.filter(c => present.includes(c))
    .concat(present.filter(c => !CATEGORY_ORDER.includes(c)).sort());
  ordered.forEach(c => {
    const o = document.createElement("option");
    o.value = c; o.textContent = c;
    categoryEl.appendChild(o);
  });
}

function buildChips() {
  const present = [...new Set(LISTINGS.map(l => l.category).filter(Boolean))];
  const ordered = CATEGORY_ORDER.filter(c => present.includes(c));
  ordered.forEach(c => {
    const b = document.createElement("button");
    b.className = "chip"; b.textContent = c;
    b.onclick = () => {
      activeCategory = activeCategory === c ? "" : c;
      categoryEl.value = activeCategory;
      document.querySelectorAll(".chip").forEach(x =>
        x.classList.toggle("active", x.textContent === activeCategory));
      render();
    };
    chipsEl.appendChild(b);
  });
}

function matches(l) {
  if (activeState !== "ALL" && l.state !== activeState) return false;
  if (activeCategory && l.category !== activeCategory) return false;
  if (query) {
    const hay = [l.name, l.category, l.city, l.description, (l.tags || []).join(" ")]
      .join(" ").toLowerCase();
    if (!hay.includes(query)) return false;
  }
  return true;
}

function mapsUrl(l) {
  const q = encodeURIComponent([l.name, l.address, l.city, l.state].filter(Boolean).join(", "));
  return "https://www.google.com/maps/search/?api=1&query=" + q;
}

function reviewsUrl(l) {
  const q = encodeURIComponent([l.name, l.address, l.city, l.state].filter(Boolean).join(", "));
  return "https://www.google.com/maps/search/?api=1&query=" + q;
}

function render() {
  const results = LISTINGS.filter(matches);
  countEl.textContent = results.length === LISTINGS.length
    ? `Showing all ${LISTINGS.length} businesses`
    : `Showing ${results.length} of ${LISTINGS.length} businesses`;

  if (mapView) {
    grid.classList.add("hidden");
    if (results.length === 0) {
      mapWrap.classList.add("hidden");
      emptyEl.classList.remove("hidden");
    } else {
      emptyEl.classList.add("hidden");
      mapWrap.classList.remove("hidden");
      ensureMap();
      updateMarkers(results);
    }
    return;
  }

  mapWrap.classList.add("hidden");
  emptyEl.classList.toggle("hidden", results.length > 0);
  grid.classList.remove("hidden");
  grid.innerHTML = "";
  results.forEach(l => {
    const card = document.createElement("article");
    card.className = "card" + (l.featured ? " featured-card" : "");
    card.innerHTML =
      `<div class="card-top"><h2></h2><span class="badge"></span></div>` +
      (l.featured ? `<div class="featured-tag">&#9733; Featured</div>` : "") +
      `<p class="loc"></p><p class="desc"></p><div class="meta"></div>`;
    const h2 = card.querySelector("h2");
    h2.textContent = l.name;
    if (l.verified) {
      const v = document.createElement("span");
      v.className = "verified";
      v.title = "Verified Nepali-owned business";
      v.textContent = " \u2713 Verified";
      h2.appendChild(v);
    }
    card.querySelector(".badge").textContent = l.category || "";
    card.querySelector(".loc").textContent = [l.city, l.state].filter(Boolean).join(", ");
    card.querySelector(".desc").textContent = l.description || "";
    const meta = card.querySelector(".meta");
    if (l.phone) {
      const a = document.createElement("a");
      a.href = "tel:" + l.phone.replace(/[^+\d]/g, "");
      a.textContent = l.phone;
      a.onclick = e => e.stopPropagation();
      meta.appendChild(a);
    }
    if (l.website) {
      const a = document.createElement("a");
      a.href = l.website; a.target = "_blank"; a.rel = "noopener";
      a.textContent = "Website";
      a.onclick = e => e.stopPropagation();
      meta.appendChild(a);
    }
    {
      const a = document.createElement("a");
      a.href = reviewsUrl(l); a.target = "_blank"; a.rel = "noopener";
      a.textContent = "\u2605 Reviews";
      a.onclick = e => e.stopPropagation();
      meta.appendChild(a);
    }
    card.onclick = () => openModal(l);
    grid.appendChild(card);
  });
  renderFeatured();
}

/* ---- Featured strip ---- */

function renderFeatured() {
  const section = document.getElementById("featured");
  const rowEl = document.getElementById("featured-row");
  const featured = LISTINGS.filter(l => l.featured);
  const showStrip = !mapView && activeState === "ALL" && !activeCategory && !query && featured.length > 0;
  section.classList.toggle("hidden", !showStrip);
  if (!showStrip) return;
  rowEl.innerHTML = "";
  featured.forEach(l => {
    const card = document.createElement("article");
    card.className = "card featured-card mini";
    card.innerHTML =
      `<div class="featured-tag">&#9733; Featured</div>` +
      `<h2></h2><p class="loc"></p><p class="desc"></p>`;
    const h2 = card.querySelector("h2");
    h2.textContent = l.name;
    if (l.verified) {
      const v = document.createElement("span");
      v.className = "verified";
      v.textContent = " \u2713";
      h2.appendChild(v);
    }
    card.querySelector(".loc").textContent = [l.city, l.state].filter(Boolean).join(", ");
    card.querySelector(".desc").textContent = l.description || "";
    card.onclick = () => openModal(l);
    rowEl.appendChild(card);
  });
}

function row(k, vHtml) {
  return vHtml ? `<div class="detail-row"><span class="k">${k}</span><span>${vHtml}</span></div>` : "";
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}

function openModal(l) {
  const addr = [l.address, l.city, l.state, l.zip].filter(Boolean).join(", ");
  modalBody.innerHTML =
    `<span class="badge">${esc(l.category || "")}</span>` +
    (l.featured ? ` <span class="featured-tag inline">&#9733; Featured</span>` : "") +
    `<h2>${esc(l.name)}${l.verified ? ' <span class="verified" title="Verified Nepali-owned business">&#10003; Verified</span>' : ""}</h2>` +
    `<p class="loc">${esc([l.city, l.state].filter(Boolean).join(", "))}</p>` +
    (l.premium ? premiumHtml(l) : "") +
    (l.description ? `<p class="desc">${esc(l.description)}</p>` : "") +
    row("Address", addr ? `<a href="${mapsUrl(l)}" target="_blank" rel="noopener">${esc(addr)}</a>` : "") +
    row("Phone", l.phone ? `<a href="tel:${esc(l.phone.replace(/[^+\d]/g, ""))}">${esc(l.phone)}</a>` : "") +
    row("Website", l.website ? `<a href="${esc(l.website)}" target="_blank" rel="noopener">Visit site</a>` : "") +
    row("Reviews", `<a href="${reviewsUrl(l)}" target="_blank" rel="noopener">Read Google reviews</a>`) +
    ((l.tags && l.tags.length) ? `<div class="tag-list">${l.tags.map(t => `<span class="tag">${esc(t)}</span>`).join("")}</div>` : "");
  modal.classList.remove("hidden");
  document.body.style.overflow = "hidden";
}

function closeModal() {
  modal.classList.add("hidden");
  document.body.style.overflow = "";
}

document.getElementById("modal-close").onclick = closeModal;
modal.onclick = e => { if (e.target === modal) closeModal(); };
document.addEventListener("keydown", e => { if (e.key === "Escape") closeModal(); });

/* ---- Premium profile block (demo) ---- */

function premiumHtml(l) {
  return `<div class="premium-box">` +
    `<div class="premium-head">&#9733; Premium partner profile</div>` +
    `<div class="photo-strip"><div class="photo-ph"></div><div class="photo-ph"></div><div class="photo-ph"></div></div>` +
    `<p class="premium-note">Photo gallery and special offers from this business appear here.</p>` +
    `</div>`;
}

/* ---- Jobs board ---- */

function jobMetaSpan(t) {
  const s = document.createElement("span");
  s.className = "job-pill";
  s.textContent = t;
  return s;
}

function renderJobs() {
  const grid = document.getElementById("job-grid");
  if (!grid) return;
  const results = JOBS.filter(j =>
    !jobQuery || [j.title, j.company, j.location, j.description].join(" ").toLowerCase().includes(jobQuery));
  document.getElementById("job-count").textContent =
    `Showing ${results.length} of ${JOBS.length} jobs`;
  document.getElementById("job-empty").classList.toggle("hidden", results.length > 0);
  grid.innerHTML = "";
  results.forEach(j => {
    const card = document.createElement("article");
    card.className = "card";
    card.innerHTML =
      `<div class="card-top"><h2></h2><span class="demo-tag">Demo</span></div>` +
      `<p class="loc"></p><p class="desc"></p><div class="job-pills"></div>` +
      `<a class="apply-btn">Apply / inquire</a>`;
    card.querySelector("h2").textContent = j.title;
    card.querySelector(".loc").textContent = [j.company, j.location].filter(Boolean).join(" \u00B7 ");
    card.querySelector(".desc").textContent = j.description || "";
    const pills = card.querySelector(".job-pills");
    if (j.type) pills.appendChild(jobMetaSpan(j.type));
    if (j.pay) pills.appendChild(jobMetaSpan(j.pay));
    if (j.posted) pills.appendChild(jobMetaSpan("Posted " + j.posted));
    const a = card.querySelector(".apply-btn");
    a.href = "mailto:hellomuku@gmail.com?subject=" +
      encodeURIComponent("Job inquiry: " + j.title + " (" + j.id + ")");
    a.onclick = e => e.stopPropagation();
    grid.appendChild(card);
  });
}

/* ---- Housing board ---- */

function renderHousing() {
  const grid = document.getElementById("housing-grid");
  if (!grid) return;
  const results = HOUSING.filter(h =>
    !housingQuery || [h.title, h.location, h.price, h.beds, h.description].join(" ").toLowerCase().includes(housingQuery));
  document.getElementById("housing-count").textContent =
    `Showing ${results.length} of ${HOUSING.length} rentals`;
  document.getElementById("housing-empty").classList.toggle("hidden", results.length > 0);
  grid.innerHTML = "";
  results.forEach(h => {
    const card = document.createElement("article");
    card.className = "card";
    card.innerHTML =
      `<div class="card-top"><h2></h2><span class="demo-tag">Demo</span></div>` +
      `<p class="loc"></p><p class="desc"></p><div class="job-pills"></div>` +
      `<a class="apply-btn">Inquire</a>`;
    card.querySelector("h2").textContent = h.title;
    card.querySelector(".loc").textContent = h.location || "";
    card.querySelector(".desc").textContent = h.description || "";
    const pills = card.querySelector(".job-pills");
    if (h.price) pills.appendChild(jobMetaSpan(h.price));
    if (h.beds) pills.appendChild(jobMetaSpan(h.beds));
    if (h.posted) pills.appendChild(jobMetaSpan("Posted " + h.posted));
    const a = card.querySelector(".apply-btn");
    a.href = "mailto:hellomuku@gmail.com?subject=" +
      encodeURIComponent("Housing inquiry: " + h.title + " (" + h.id + ")");
    a.onclick = e => e.stopPropagation();
    grid.appendChild(card);
  });
}

document.getElementById("job-search").oninput = e => {
  jobQuery = e.target.value.trim().toLowerCase();
  renderJobs();
};
document.getElementById("housing-search").oninput = e => {
  housingQuery = e.target.value.trim().toLowerCase();
  renderHousing();
};

/* ---- Events board ---- */

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function fmtDate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return { y, mon: MONTHS[m - 1], day: d };
}

function fmtRange(start, end) {
  const s = fmtDate(start);
  if (!end || end === start) return `${s.mon} ${s.day}, ${s.y}`;
  const e = fmtDate(end);
  if (s.mon === e.mon) return `${s.mon} ${s.day} \u2013 ${e.day}, ${s.y}`;
  return `${s.mon} ${s.day} \u2013 ${e.mon} ${e.day}, ${s.y}`;
}

function renderEvents() {
  const grid = document.getElementById("event-grid");
  if (!grid) return;
  const results = EVENTS
    .filter(e => !eventQuery ||
      [e.title, e.organizer, e.location, e.description].join(" ").toLowerCase().includes(eventQuery))
    .slice()
    .sort((a, b) => (a.date_start || "").localeCompare(b.date_start || ""));
  document.getElementById("event-count").textContent =
    `Showing ${results.length} of ${EVENTS.length} events`;
  document.getElementById("event-empty").classList.toggle("hidden", results.length > 0);
  grid.innerHTML = "";
  results.forEach(e => {
    const s = fmtDate(e.date_start);
    const card = document.createElement("article");
    card.className = "card event-card";
    card.innerHTML =
      `<div class="event-top"><div class="event-date"><span class="ed-mon"></span><span class="ed-day"></span></div>` +
      `<div><h2></h2><p class="event-when"></p></div><span class="demo-tag">Demo</span></div>` +
      `<p class="loc"></p><p class="desc"></p>`;
    card.querySelector(".ed-mon").textContent = s.mon;
    card.querySelector(".ed-day").textContent = s.day;
    card.querySelector("h2").textContent = e.title;
    card.querySelector(".event-when").textContent = fmtRange(e.date_start, e.date_end);
    card.querySelector(".loc").textContent =
      [e.organizer, e.location].filter(Boolean).join(" \u00B7 ");
    card.querySelector(".desc").textContent = e.description || "";
    grid.appendChild(card);
  });
}

document.getElementById("event-search").oninput = e => {
  eventQuery = e.target.value.trim().toLowerCase();
  renderEvents();
};

document.querySelectorAll(".state-tab").forEach(b => {
  b.onclick = () => {
    document.querySelectorAll(".state-tab").forEach(x => x.classList.remove("active"));
    b.classList.add("active");
    activeState = b.dataset.state;
    render();
  };
});

categoryEl.onchange = () => {
  activeCategory = categoryEl.value;
  document.querySelectorAll(".chip").forEach(x =>
    x.classList.toggle("active", x.textContent === activeCategory));
  render();
};

let debounce;
searchEl.oninput = () => {
  clearTimeout(debounce);
  debounce = setTimeout(() => {
    query = searchEl.value.trim().toLowerCase();
    render();
  }, 180);
};

/* ---- Main nav: Directory / Jobs / Housing ---- */

const searchBand = document.querySelector(".search-band");
document.querySelectorAll(".nav-btn").forEach(b => {
  b.onclick = () => {
    document.querySelectorAll(".nav-btn").forEach(x => x.classList.remove("active"));
    b.classList.add("active");
    activeView = b.dataset.view;
    document.getElementById("view-directory").classList.toggle("hidden", activeView !== "directory");
    document.getElementById("view-jobs").classList.toggle("hidden", activeView !== "jobs");
    document.getElementById("view-housing").classList.toggle("hidden", activeView !== "housing");
    document.getElementById("view-events").classList.toggle("hidden", activeView !== "events");
    searchBand.classList.toggle("hidden", activeView !== "directory");
    if (activeView === "directory" && mapView) setTimeout(() => map && map.invalidateSize(), 50);
  };
});

/* ---- Map view ---- */

function setView(v) {
  mapView = (v === "map");
  viewListBtn.classList.toggle("active", !mapView);
  viewMapBtn.classList.toggle("active", mapView);
  render();
}

viewListBtn.onclick = () => setView("list");
viewMapBtn.onclick = () => setView("map");

function ensureMap() {
  if (typeof L === "undefined") {
    mapNote.textContent = "Map could not load (network needed for map tiles). List view still works.";
    return;
  }
  if (!map) {
    map = L.map("map", { scrollWheelZoom: false }).setView([38.98, -76.9], 8);
    map.on("focus", () => map.scrollWheelZoom.enable());
    map.on("blur", () => map.scrollWheelZoom.disable());
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);
    markerLayer = L.layerGroup().addTo(map);
  }
  // container was hidden; recalc size
  setTimeout(() => map.invalidateSize(), 50);
}

function popupHtml(l) {
  const addr = [l.address, l.city, l.state, l.zip].filter(Boolean).join(", ");
  let h = `<span class="badge">${esc(l.category || "")}</span><h3>${esc(l.name)}</h3>`;
  if (addr) h += `<p>${esc(addr)}</p>`;
  if (l.phone) h += `<p><a href="tel:${esc(l.phone.replace(/[^+\d]/g, ""))}">${esc(l.phone)}</a></p>`;
  let links = [];
  if (addr) links.push(`<a href="${mapsUrl(l)}" target="_blank" rel="noopener">Directions</a>`);
  if (l.website) links.push(`<a href="${esc(l.website)}" target="_blank" rel="noopener">Website</a>`);
  links.push(`<a href="${reviewsUrl(l)}" target="_blank" rel="noopener">\u2605 Google reviews</a>`);
  if (links.length) h += `<p>${links.join(" &middot; ")}</p>`;
  return h;
}

function updateMarkers(results) {
  if (!map) return;
  markerLayer.clearLayers();
  const bounds = [];
  let unmapped = 0;
  results.forEach(l => {
    if (l.lat && l.lng) {
      const m = L.circleMarker([l.lat, l.lng], {
        radius: 8, color: "#c8102e", weight: 2,
        fillColor: "#c8102e", fillOpacity: 0.7
      });
      m.bindPopup(popupHtml(l));
      markerLayer.addLayer(m);
      bounds.push([l.lat, l.lng]);
    } else {
      unmapped++;
    }
  });
  if (bounds.length) map.fitBounds(bounds, { padding: [45, 45], maxZoom: 13 });
  const shown = bounds.length;
  mapNote.textContent = unmapped > 0
    ? `${shown} of ${results.length} shown on map (${unmapped} have no street address).`
    : `${shown} shown on map.`;
}
