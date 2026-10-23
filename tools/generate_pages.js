#!/usr/bin/env node
/*
 * generate_pages.js — Nepal in DMV multi-page generator.
 *
 * Reads data/listings.json (+ jobs/housing/events) and generates:
 *   business/<slug>/index.html   one page per business
 *   category/<slug>/index.html   one page per category
 *   city/<slug>/index.html       one page per city (city-state slug)
 *   jobs/, housing/, events/, advertise/, about/  section pages
 *   sitemap.xml
 *   data/slugs.json              id -> slug map (used by app.js modal links)
 *
 * Run: node tools/generate_pages.js
 * A GitHub Action (.github/workflows/build-pages.yml) runs this on every
 * push that changes data/*.json, so pages stay in sync automatically.
 */
"use strict";
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const BASE = "https://mnepal000.github.io/hamrobiz/";
const MAIL = "hellomuku@gmail.com";

const listings = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "listings.json"), "utf8"));
const jobs = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "jobs.json"), "utf8"));
const housing = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "housing.json"), "utf8"));
const events = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "events.json"), "utf8"));

function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function slugify(s) {
  return String(s || "").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "item";
}
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function fmtDate(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  return `${MONTHS[(m || 1) - 1]} ${d}, ${y}`;
}
function mapsUrl(l) {
  const q = encodeURIComponent([l.name, l.address, l.city, l.state].filter(Boolean).join(", "));
  return "https://www.google.com/maps/search/?api=1&query=" + q;
}
function excerpt(s, n) {
  s = String(s || "");
  if (s.length <= n) return s;
  const cut = s.slice(0, n - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > 40 ? cut.slice(0, lastSpace) : cut).trimEnd() + "…";
}

/* ---------- slugs ---------- */
const slugOf = new Map();
{
  const used = new Map();
  for (const l of listings) {
    let base = slugify(l.name) + "-" + slugify(l.city);
    let slug = base;
    if (used.has(slug)) slug = base + "-" + String(l.state || "").toLowerCase();
    if (used.has(slug)) { let i = 2; while (used.has(slug + "-" + i)) i++; slug = slug + "-" + i; }
    used.set(slug, l.id);
    slugOf.set(l.id, slug);
  }
}
const catSlug = c => slugify(c);
const citySlug = l => slugify(l.city) + "-" + String(l.state || "").toLowerCase();
const bizUrl = l => "business/" + slugOf.get(l.id) + "/";

/* ---------- shared chrome ---------- */
function chrome(prefix, title, desc, extraHead, body) {
  const P = prefix;
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="stylesheet" href="${P}styles.css?v=20261023">
<link rel="stylesheet" href="${P}pages.css?v=1">
${extraHead || ""}</head>
<body>
<header class="site-header">
  <div class="wrap header-inner">
    <div class="brand">
      <span class="brand-mark">🇳🇵</span>
      <div>
        <h1><a class="brand-link" href="${P}">Nepal in DMV</a></h1>
        <p class="tagline">Nepali Business Directory &mdash; Washington DC &middot; Maryland &middot; Virginia</p>
      </div>
    </div>
    <a class="cta-btn" href="mailto:${MAIL}?subject=Nepal%20in%20DMV%20listing%20suggestion&body=Business%20name%3A%0ACategory%3A%0ACity%2C%20State%3A%0APhone%2Fwebsite%3A%0A">+ Suggest a business</a>
  </div>
</header>
<nav class="main-nav" aria-label="Site sections">
  <div class="wrap nav-inner">
    <a class="nav-btn" href="${P}">Directory</a>
    <a class="nav-btn" href="${P}jobs/">Jobs</a>
    <a class="nav-btn" href="${P}housing/">Housing</a>
    <a class="nav-btn" href="${P}events/">Events</a>
    <a class="nav-btn" href="${P}advertise/">Advertise</a>
    <a class="nav-btn" href="${P}about/">About</a>
  </div>
</nav>
<main class="wrap page-main">
${body}
</main>
<footer class="site-footer">
  <div class="wrap">
    <p><strong>Nepal in DMV</strong> is a community directory of Nepali-owned businesses in the DMV [Washington, DC, Maryland and Virginia] area.</p>
    <p class="fine">Listings are compiled from public sources. Know a business we're missing, or spot an error?
    <a href="mailto:${MAIL}?subject=Nepal%20in%20DMV%20listing%20update">Let us know</a>.
    Want your business featured ($99.99/month), verified, or advertised? <a href="mailto:${MAIL}?subject=Nepal%20in%20DMV%20featured%20listing">Ask about business plans</a>.
    Know a business that should advertise here? <a href="mailto:${MAIL}?subject=Nepal%20in%20DMV%20referral&body=Business%20name%3A%0AContact%20person%3A%0A">Refer them and earn 20% commission</a> on their first payment.</p>
  </div>
</footer>
</body>
</html>
`;
}
function writePage(rel, html) {
  const dir = path.join(ROOT, rel);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "index.html"), html);
}
function card(l, P) {
  return `<article class="biz-card">
    <div class="biz-card-top"><span class="badge">${esc(l.category)}</span>${l.featured ? ' <span class="featured-tag inline">&#9733; Featured</span>' : ""}</div>
    <h3><a href="${P}${bizUrl(l)}">${esc(l.name)}</a>${l.verified ? ' <span class="verified" title="Verified Nepali-owned business">&#10003;</span>' : ""}</h3>
    <p class="loc">${esc([l.city, l.state].filter(Boolean).join(", "))}</p>
    <p class="biz-card-desc">${esc(excerpt(l.description, 150))}</p>
    ${l.phone ? `<p class="biz-card-phone"><a href="tel:${esc(l.phone.replace(/[^+\d]/g, ""))}">${esc(l.phone)}</a></p>` : ""}
  </article>`;
}

/* ---------- business pages ---------- */
function businessPage(l) {
  const P = "../../";
  const addr = [l.address, l.city, l.state, l.zip].filter(Boolean).join(", ");
  const sameCity = listings.filter(x => x.id !== l.id && x.city === l.city && x.state === l.state).slice(0, 6);
  const sameCat = listings.filter(x => x.id !== l.id && x.category === l.category && !(x.city === l.city && x.state === l.state)).slice(0, Math.max(0, 6 - sameCity.length));
  const related = sameCity.concat(sameCat);
  const ld = {
    "@context": "https://schema.org", "@type": "LocalBusiness",
    name: l.name, description: l.description || undefined,
    address: { "@type": "PostalAddress", streetAddress: l.address || undefined, addressLocality: l.city, addressRegion: l.state, postalCode: l.zip || undefined, addressCountry: "US" },
    telephone: l.phone || undefined, url: l.website || undefined,
    geo: (l.lat && l.lng) ? { "@type": "GeoCoordinates", latitude: l.lat, longitude: l.lng } : undefined
  };
  const row = (k, v) => v ? `<div class="detail-row"><span class="k">${k}</span><span>${v}</span></div>` : "";
  const body = `
<nav class="crumbs"><a href="${P}">Directory</a> &rsaquo; <a href="${P}category/${catSlug(l.category)}/">${esc(l.category)}</a> &rsaquo; <a href="${P}city/${citySlug(l)}/">${esc(l.city)}</a> &rsaquo; ${esc(l.name)}</nav>
<span class="badge">${esc(l.category)}</span>${l.featured ? ' <span class="featured-tag inline">&#9733; Featured</span>' : ""}
<h2 class="page-title">${esc(l.name)}${l.verified ? ' <span class="verified" title="Verified Nepali-owned business">&#10003; Verified</span>' : ""}</h2>
<p class="loc">${esc([l.city, l.state].filter(Boolean).join(", "))}</p>
${l.premium ? `<div class="premium-box"><div class="premium-head">&#9733; Premium partner profile</div><div class="photo-strip"><div class="photo-ph"></div><div class="photo-ph"></div><div class="photo-ph"></div></div><p class="premium-note">Photo gallery and special offers from this business appear here.</p></div>` : ""}
${l.description ? `<p class="desc">${esc(l.description)}</p>` : ""}
<div class="detail-list">
${row("Address", addr ? `<a href="${mapsUrl(l)}" target="_blank" rel="noopener">${esc(addr)}</a>` : "")}
${row("Phone", l.phone ? `<a href="tel:${esc(l.phone.replace(/[^+\d]/g, ""))}">${esc(l.phone)}</a>` : "")}
${row("Website", l.website ? `<a href="${esc(l.website)}" target="_blank" rel="noopener">Visit site</a>` : "")}
${row("Reviews", `<a href="${mapsUrl(l)}" target="_blank" rel="noopener">Read Google reviews</a>`)}
</div>
${(l.tags && l.tags.length) ? `<div class="tag-list">${l.tags.map(t => `<span class="tag">${esc(t)}</span>`).join("")}</div>` : ""}
${(l.lat && l.lng) ? `<div class="map-embed"><iframe title="Map: ${esc(l.name)}" src="https://www.google.com/maps?q=${l.lat},${l.lng}&z=15&output=embed" loading="lazy"></iframe></div>` : ""}
<p class="page-cta">Is this your business? <a href="mailto:${MAIL}?subject=Nepal%20in%20DMV%20listing%20update%3A%20${encodeURIComponent(l.name)}">Claim or update this listing</a> &middot; <a href="${P}advertise/">Advertise with Nepal in DMV</a></p>
${related.length ? `<h3 class="section-title">More businesses to explore</h3><div class="grid">${related.map(x => card(x, P)).join("")}</div>` : ""}
`;
  const head = `<link rel="canonical" href="${BASE}${bizUrl(l)}">\n<script type="application/ld+json">${JSON.stringify(ld)}</script>\n`;
  writePage(bizUrl(l), chrome(P, `${l.name} — ${l.category} in ${l.city}, ${l.state} | Nepal in DMV`, excerpt(l.description, 155), head, body));
}

/* ---------- category pages ---------- */
function categoryPage(cat, items) {
  const P = "../../";
  const sorted = items.slice().sort((a, b) => (a.city + a.name).localeCompare(b.city + b.name));
  const body = `
<nav class="crumbs"><a href="${P}">Directory</a> &rsaquo; ${esc(cat)}</nav>
<h2 class="page-title">${esc(cat)}</h2>
<p class="count">${items.length} Nepali-owned ${items.length === 1 ? "business" : "businesses"} in this category across DC, Maryland and Virginia.</p>
<div class="grid">${sorted.map(x => card(x, P)).join("")}</div>
`;
  writePage("category/" + catSlug(cat), chrome(P, `${cat} — Nepali-owned businesses | Nepal in DMV`, `${items.length} Nepali-owned businesses in the ${cat} category across Washington DC, Maryland and Virginia.`, "", body));
}

/* ---------- city pages ---------- */
function cityPage(city, state, items) {
  const P = "../../";
  const sorted = items.slice().sort((a, b) => a.name.localeCompare(b.name));
  const body = `
<nav class="crumbs"><a href="${P}">Directory</a> &rsaquo; ${esc(city)}, ${esc(state)}</nav>
<h2 class="page-title">Nepali businesses in ${esc(city)}, ${esc(state)}</h2>
<p class="count">${items.length} listed ${items.length === 1 ? "business" : "businesses"}.</p>
<div class="grid">${sorted.map(x => card(x, P)).join("")}</div>
`;
  writePage("city/" + slugify(city) + "-" + String(state).toLowerCase(), chrome(P, `Nepali businesses in ${city}, ${state} | Nepal in DMV`, `Directory of Nepali-owned businesses in ${city}, ${state}: restaurants, groceries, services and more.`, "", body));
}

/* ---------- board pages ---------- */
function boardPage(kind, title, sub, ctaLabel, ctaBody, banner, cardsHtml) {
  const P = "../";
  const body = `
${banner ? `<div class="demo-banner">${banner}</div>` : ""}
<div class="board-head"><div><h2 class="section-title">${esc(title)}</h2><p class="board-sub">${esc(sub)}</p></div>
<a class="cta-btn cta-dark" href="mailto:${MAIL}?subject=${encodeURIComponent("Nepal in DMV " + kind)}&body=${ctaBody}">${esc(ctaLabel)}</a></div>
<div class="grid">${cardsHtml}</div>
<p class="page-cta">Prefer the searchable directory? <a href="${P}">Browse all businesses</a>.</p>
`;
  writePage(kind, chrome(P, `${title} | Nepal in DMV`, sub, "", body));
}

/* ---------- build all ---------- */
for (const l of listings) businessPage(l);

const byCat = new Map(), byCity = new Map();
for (const l of listings) {
  if (!byCat.has(l.category)) byCat.set(l.category, []);
  byCat.get(l.category).push(l);
  const key = l.city + "|" + l.state;
  if (!byCity.has(key)) byCity.set(key, []);
  byCity.get(key).push(l);
}
for (const [cat, items] of byCat) categoryPage(cat, items);
for (const items of byCity.values()) cityPage(items[0].city, items[0].state, items);

boardPage("jobs", "Jobs board", "Open roles at Nepali-owned businesses and community employers across the DMV.",
  "+ Post a job ($29/30 days)", "Job%20title%3A%0ACompany%3A%0ALocation%3A%0APay%3A%0ADescription%3A%0A",
  "Preview with demo listings. Real community job postings will appear here at launch.",
  jobs.map(j => `<article class="biz-card"><h3>${esc(j.title)}</h3><p class="loc">${esc(j.company)} &middot; ${esc(j.location)}</p><p class="biz-card-desc">${esc(j.description)}</p><p class="biz-card-phone">${esc(j.pay || "")}${j.type ? " &middot; " + esc(j.type) : ""}</p><p class="fine">Posted ${esc(fmtDate(j.posted))}</p></article>`).join(""));

boardPage("housing", "Housing board", "Rooms, basements, and rentals shared by the Nepali community in the DMV.",
  "+ List your rental ($19/30 days)", "Title%3A%0ALocation%3A%0ARent%3A%0ADescription%3A%0A",
  "Preview with demo listings. Real community housing postings will appear here at launch.",
  housing.map(h => `<article class="biz-card"><h3>${esc(h.title)}</h3><p class="loc">${esc(h.location)}</p><p class="biz-card-desc">${esc(h.description)}</p><p class="biz-card-phone">${esc(h.price || "")}${h.beds ? " &middot; " + esc(h.beds) : ""}</p><p class="fine">Posted ${esc(fmtDate(h.posted))}</p></article>`).join(""));

boardPage("events", "Community events", "Festivals the Nepali community celebrates and gatherings it organizes across the DMV.",
  "+ Submit an event", "Event%20title%3A%0AOrganizer%3A%0ADate(s)%3A%0ALocation%3A%0ADescription%3A%0A",
  "Preview with demo listings. Real community events will appear here at launch.",
  events.map(e => `<article class="biz-card"><h3>${esc(e.title)}</h3><p class="loc">${esc(fmtDate(e.date_start))}${e.date_end && e.date_end !== e.date_start ? " – " + esc(fmtDate(e.date_end)) : ""} &middot; ${esc(e.location)}</p><p class="biz-card-desc">${esc(e.description)}</p><p class="fine">Organizer: ${esc(e.organizer || "Community")}</p></article>`).join(""));

/* advertise */
{
  const P = "../";
  const price = (t, p, d) => `<article class="biz-card price-card"><h3>${t}</h3><p class="price">${p}</p><p class="biz-card-desc">${d}</p></article>`;
  const body = `
<h2 class="page-title">Advertise with Nepal in DMV</h2>
<p class="desc">Put your business in front of the Nepali community across Washington DC, Maryland and Virginia. Nepal in DMV lists ${listings.length} businesses and is shared daily in community groups.</p>
<div class="grid">
${price("Banner ad", "$49.99 / week", "Top banner in the directory view, seen by every visitor.")}
${price("Sidebar ad", "$49.99 / month", "Placement in the filter sidebar alongside every listing, including a tall premium format.")}
${price("Featured business", "$99.99 / month", "A spot in the Featured strip on the homepage plus a featured badge on your listing and business page.")}
${price("Job post", "$29 / 30 days", "Reach Nepali job-seekers across the DMV on the jobs board.")}
${price("Housing post", "$19 / 30 days", "Fill your room, basement or rental with a community tenant.")}
${price("Referral program", "Earn 20%", "Refer a business that advertises and earn 20% commission on their first payment.")}
</div>
<p class="page-cta"><a class="cta-btn cta-dark" href="mailto:${MAIL}?subject=Nepal%20in%20DMV%20advertising">Start advertising</a></p>
`;
  writePage("advertise", chrome(P, "Advertise | Nepal in DMV", "Advertising rates for Nepal in DMV: banner, sidebar, featured listings, job and housing posts.", "", body));
}

/* about */
{
  const P = "../";
  const cats = [...byCat.entries()].sort((a, b) => b[1].length - a[1].length);
  const body = `
<h2 class="page-title">About Nepal in DMV</h2>
<p class="desc">Nepal in DMV is a community directory of Nepali-owned businesses in the DMV [Washington, DC, Maryland and Virginia] area. It lists ${listings.length} businesses across ${byCat.size} categories and ${byCity.size} cities, from restaurants and groceries to home care, realtors, immigration lawyers and remittance services.</p>
<p class="desc">Listings are compiled from public sources and community suggestions, and each one carries the details a neighbor needs: address, phone, website, a map, and an honest note when ownership could not be confirmed.</p>
<h3 class="section-title">Browse by category</h3>
<p class="link-cloud">${cats.map(([c, items]) => `<a href="${P}category/${catSlug(c)}/">${esc(c)} (${items.length})</a>`).join(" &middot; ")}</p>
<h3 class="section-title">Popular cities</h3>
<p class="link-cloud">${[...byCity.values()].sort((a, b) => b.length - a.length).slice(0, 15).map(items => `<a href="${P}city/${slugify(items[0].city)}-${String(items[0].state).toLowerCase()}/">${esc(items[0].city)}, ${esc(items[0].state)} (${items.length})</a>`).join(" &middot; ")}</p>
<p class="page-cta">Know a business we're missing? <a href="mailto:${MAIL}?subject=Nepal%20in%20DMV%20listing%20suggestion">Suggest it</a>.</p>
`;
  writePage("about", chrome(P, "About | Nepal in DMV", "Nepal in DMV is a community directory of Nepali-owned businesses across Washington DC, Maryland and Virginia.", "", body));
}

/* sitemap + slugs.json */
{
  const urls = [""];
  for (const l of listings) urls.push(bizUrl(l));
  for (const cat of byCat.keys()) urls.push("category/" + catSlug(cat) + "/");
  for (const items of byCity.values()) urls.push("city/" + slugify(items[0].city) + "-" + String(items[0].state).toLowerCase() + "/");
  for (const s of ["jobs/", "housing/", "events/", "advertise/", "about/"]) urls.push(s);
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls.map(u => `  <url><loc>${BASE}${u}</loc></url>`).join("\n") + "\n</urlset>\n";
  fs.writeFileSync(path.join(ROOT, "sitemap.xml"), xml);
  const map = {};
  for (const l of listings) map[l.id] = slugOf.get(l.id);
  fs.writeFileSync(path.join(ROOT, "data", "slugs.json"), JSON.stringify(map, null, 1) + "\n");
  console.log(`Generated ${listings.length} business pages, ${byCat.size} category pages, ${byCity.size} city pages, 5 section pages, sitemap (${urls.length} URLs).`);
}
