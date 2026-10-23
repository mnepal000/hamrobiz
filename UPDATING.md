# Updating Nepal in DMV

Everything on this site comes from four data files in the `data/` folder.
You never need to touch code to update listings.

## Add, edit, or remove a business

1. Open `data/listings.json` (on GitHub: open the repo, click `data`,
   then `listings.json`, then the pencil icon).
2. Each business is a block between `{` and `}`. Copy any block to add a
   new one, edit values in place to fix one, delete the whole block to
   remove one.
3. Fields: `id` (state prefix + next number, e.g. `md-109`, `va-078`,
   `dc-018`), `name`, `category`, `address`, `city`, `state`, `zip`,
   `phone`, `website`, `description`, `tags`, `lat`, `lng`.
   Optional flags: `"verified": true`, `"featured": true`,
   `"premium": true`.
4. Commit the change. Within a couple of minutes GitHub rebuilds the
   site AND regenerates every business page, category page, city page
   and the sitemap automatically (see `.github/workflows/build-pages.yml`).
   You do not need to run anything.

## Rules that keep the site working

- **Category names must match exactly** one of the existing categories
  (Restaurant, Grocery, Health, Services, Real Estate, Travel, Legal &
  Immigration, Tax & Accounting, Remittance & Finance, Beauty &
  Wellness, Photography & Videography, Retail, Religious, Hotel,
  Driving School, Other). A new spelling creates a new filter group.
- **JSON punctuation matters:** quotes around every name and value,
  commas between items, no comma after the last item in a list. If the
  file breaks, the directory renders empty. When unsure, paste the file
  into jsonlint.com before committing.
- **Coordinates:** right-click any spot in Google Maps to see its
  latitude and longitude. Close enough is fine.
- **Ids must be unique.** Check the highest existing number first.

## Jobs, housing, events

Same pattern: edit `data/jobs.json`, `data/housing.json`, or
`data/events.json` and commit. The board pages rebuild automatically.
Entries carry `"demo": true` while they are placeholders.

## How the pages are built

`tools/generate_pages.js` (Node, no dependencies) reads the data files
and writes `business/<slug>/`, `category/<slug>/`, `city/<slug>/`,
`jobs/`, `housing/`, `events/`, `advertise/`, `about/`, `sitemap.xml`,
and `data/slugs.json`. Slugs come from business name + city and never
need to be typed by hand.

To build locally: `node tools/generate_pages.js`.

## Code changes (rare)

The homepage app is `app.js`, but the live page loads `app.min.js`.
After editing `app.js`, regenerate and bump the version in `index.html`:

    npx -y terser app.js -c -m -o app.min.js

Then change `app.min.js?v=...` in `index.html` to a new date, commit,
push, and check the live site actually renders the directory.
