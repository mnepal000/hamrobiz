# HamroBiz — Nepali Business Directory (DMV)

Working title; rename anytime. Phase 1 of the Nepali community classifieds idea:
a **directory-first MVP** seeded with real Nepali-owned businesses in
Washington DC, Maryland, and Virginia.

## Structure

- `index.html` — page shell (search, state tabs, category filter, cards, detail modal)
- `styles.css` — styling (Nepal crimson/blue accents)
- `app.js` — client-side search/filter over `data/listings.json`
- `data/listings.json` — the directory data (array of listing objects)

## Listing schema

```json
{
  "id": "md-001",
  "name": "Business Name",
  "category": "Restaurant",
  "address": "123 Main St",
  "city": "Silver Spring",
  "state": "MD",
  "zip": "20910",
  "phone": "(301) 555-0100",
  "website": "https://...",
  "description": "One-line description.",
  "tags": ["momo", "catering"]
}
```

Categories: Restaurant, Grocery, Remittance & Finance, Tax & Accounting,
Real Estate, Legal & Immigration, Driving School, Beauty & Wellness,
Retail, Health, Services, Other.

## Roadmap

- Phase 1 (now): seeded static directory, "suggest a business" via email. Every listing links out to its Google reviews; a native HamroBiz rating system is planned later.
- Phase 2: self-serve posting with moderation queue (Supabase free tier).
- Phase 3: jobs board (post a job / looking-for-job) + paid featured listings via Stripe.

## Deploy

Static site. Publish via GitHub Pages from the repo root.
