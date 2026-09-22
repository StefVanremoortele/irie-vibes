# Irie Vibes Roots Festival — website

A faithful rebuild of the Irie Vibes Roots Festival site (Kortemark, Belgium ·
22–24 July 2027), built with [Astro](https://astro.build/) as a static site.

All content lives in editable JSON files under `content/`, managed through
**Sveltia CMS** (git-based, friendly admin at `/admin/`) — see [`CMS.md`](./CMS.md).
The `src/data/` modules read those files and the templates read `src/data/`, so
content and presentation are fully separated.

## Requirements

- Node.js 18+ (built and verified on Node 24)

## Getting started

```bash
npm install
npm run dev      # local dev server at http://localhost:4321
npm run build    # static build into dist/
npm run preview  # serve the built site locally
```

## Editing content

Content is managed with Sveltia CMS. Locally, run `npm run dev` and open
`http://localhost:4321/admin/index.html` (Chrome/Edge) → "Work with Local
Repository". Full instructions, the collection map, and production/GitHub setup
are in [`CMS.md`](./CMS.md).

The build outputs a fully static site in `dist/` that can be hosted anywhere
(Netlify, Vercel, Cloudflare Pages, GitHub Pages, or any static host).

## What's on the site

Real, SEO-friendly routes (not a single-page app):

| Route              | Page                                                        |
| ------------------ | ----------------------------------------------------------- |
| `/`                | Home — hero, live countdown, intro, 2026 aftermovie         |
| `/tickets`         | Ticket tiers + camping/parking fees                         |
| `/lineup`          | Three-stage line-up grid (Thursday/Friday/Saturday)         |
| `/lineup/[slug]`   | Per-act detail page (one route per performance)             |
| `/when`            | Opening/closing times                                       |
| `/where`           | Address, travel info, Google map + circulation plan         |
| `/camping`         | Camping & parking info + fees                               |
| `/drinks`          | Drinks, food & market                                       |
| `/kids`            | Kids corner                                                 |
| `/volunteer`       | Volunteer call-to-action                                    |
| `/about`           | Accordions: Greenforward, initiatives, past editions, shop  |
| `/regulations`     | Festival & camping regulations                              |

Shared chrome (header banner + tri-colour hamburger drawer, sponsors + socials
footer) is applied by the `Base` layout on every page.

## Project structure

```
site/
├── content/                  # CONTENT (edited via the CMS) — source of truth
│   ├── site.json             #   settings, nav, socials, chrome images
│   ├── media.json            #   per-page hero images + shared images
│   ├── lineup.json           #   stages, days, default act description
│   ├── tickets.json          #   ticket + camping price tables
│   ├── sponsors.json         #   main + regular sponsor lists
│   ├── about.json            #   about-page accordions
│   ├── regulations.json      #   regulations sections
│   ├── acts/*.json           #   one file per line-up act
│   └── pages/*.json          #   When / Drinks / Kids / Volunteer copy
├── public/
│   ├── admin/                # Sveltia CMS (index.html, config.yml, bundle)
│   └── assets/               # all images (heroes, sponsors, socials, posters)
├── scripts/
│   ├── extract-content.mjs   # one-time: export → generated/irie.json
│   └── migrate-to-cms.mjs    # one-time: seeded content/ from the export
└── src/
    ├── data/                 # typed accessors: read content/*.json, apply types
    │   ├── types.ts          #   interfaces = CMS content types
    │   ├── site.ts  lineup.ts  tickets.ts  pages.ts
    │   ├── about.ts  sponsors.ts  regulations.ts
    │   └── generated/irie.json  # archival extract (migration input only)
    ├── lib/assets.ts         # asset URL helper
    ├── styles/               # tokens.css (Roots Vanguard) + global.css
    ├── components/           # Header, Footer, Hero, Countdown, PriceTable, CopyPage
    ├── layouts/Base.astro    # HTML shell + header/footer
    └── pages/                # one file per route
```

Data flow: **`content/*.json` → `src/data/*.ts` (typed) → `.astro` templates**.

## Design system

Colour, type and spacing come from the "Roots Vanguard" system in the original
`DESIGN.md`, encoded as CSS custom properties in `src/styles/tokens.css`
(night-forest `#101510` surface, amber-gold `#fabc4d` accent, the reggae
tri-colour, `Anton` display + `Work Sans` body). Exact rendered values were
matched against the original export for fidelity.

## Content still to be filled in

These are placeholders inherited from the source material — a content editor
(or the CMS) supplies the real values:

- **Line-up act names** are placeholders (`Lions Den Thursday 1`, …) with real
  time slots — edit in *Line-up — acts* as artists are announced.
- **Several times** on the When / Camping pages are `??h` in the source.
- The **English regulations** section currently repeats the Dutch text; it
  awaits translation (editable in *Settings → Regulations*).
- A few **sponsor logos** (4AD, Oxfam, OKay Kortemark, Vernafix) reference the
  original remote placeholder URLs and should be replaced with uploaded files.

## How the content was seeded

`content/` was generated once from the original export via
`scripts/migrate-to-cms.mjs` (`npm run content:migrate`). That was a one-time
seed — `content/` is now the source of truth and is edited through the CMS. See
[`CMS.md`](./CMS.md) for the editing workflow.
# irie-vibes-remake
