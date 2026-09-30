let LISTINGS = [];
let activeState = "ALL";
let activeCategory = "";
let query = "";

const grid = document.getElementById("grid");
const countEl = document.getElementById("count");
const emptyEl = document.getElementById("empty");
const searchEl = document.getElementById("search");
const categoryEl = document.getElementById("category");
const chipsEl = document.getElementById("chips");
const modal = document.getElementById("modal");
const modalBody = document.getElementById("modal-body");

const CATEGORY_ORDER = [
  "Restaurant", "Grocery", "Remittance & Finance", "Tax & Accounting",
  "Real Estate", "Legal & Immigration", "Driving School", "Beauty & Wellness",
  "Retail", "Health", "Services", "Other"
];

fetch("data/listings.json")
  .then(r => r.json())
  .then(data => {
    LISTINGS = Array.isArray(data) ? data : [];
    buildCategoryOptions();
    buildChips();
    render();
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

function render() {
  const results = LISTINGS.filter(matches);
  countEl.textContent = results.length === LISTINGS.length
    ? `Showing all ${LISTINGS.length} businesses`
    : `Showing ${results.length} of ${LISTINGS.length} businesses`;
  emptyEl.classList.toggle("hidden", results.length > 0);
  grid.innerHTML = "";
  results.forEach(l => {
    const card = document.createElement("article");
    card.className = "card";
    card.innerHTML =
      `<div class="card-top"><h2></h2><span class="badge"></span></div>` +
      `<p class="loc"></p><p class="desc"></p><div class="meta"></div>`;
    card.querySelector("h2").textContent = l.name;
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
    card.onclick = () => openModal(l);
    grid.appendChild(card);
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
    `<h2>${esc(l.name)}</h2>` +
    `<p class="loc">${esc([l.city, l.state].filter(Boolean).join(", "))}</p>` +
    (l.description ? `<p class="desc">${esc(l.description)}</p>` : "") +
    row("Address", addr ? `<a href="${mapsUrl(l)}" target="_blank" rel="noopener">${esc(addr)}</a>` : "") +
    row("Phone", l.phone ? `<a href="tel:${esc(l.phone.replace(/[^+\d]/g, ""))}">${esc(l.phone)}</a>` : "") +
    row("Website", l.website ? `<a href="${esc(l.website)}" target="_blank" rel="noopener">Visit site</a>` : "") +
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
