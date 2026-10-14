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
npm run dev         # dev server at http://localhost:4320 (add `-- --host 0.0.0.0` to expose it)
npm run build       # static build into dist/
npm run preview     # serve the built site locally
npm run production  # self-updating production server (see below)
```

## Branches and deployment

**`main` is production.** Every commit on `main`, including every save in the
CMS, goes live automatically within seconds: GitHub sends a push webhook to
the production server, which pulls and rebuilds immediately.

- Do development on feature branches (`git switch -c feat/…`) and merge to
  `main` only when the change is ready to go live.
- The production site is served from the maintainer's host on port **4321**
  (exposed publicly through a Tailscale gateway). The dev server uses port
  **4320**, so both can run side by side.

### How the production server works

`npm run production` (`scripts/production.mjs`) runs in a dedicated clone that
nobody edits, a sibling `production/` folder next to the development checkout:

1. Builds the site and serves `dist/` with `astro preview` on an internal port.
   A small front server on the public port proxies to it.
2. The front server also serves the feedback API (`/__feedback/`, see
   [Feedback tool](#feedback-tool)).
3. **Deploy webhook:** the front server answers `POST /__deploy`. A GitHub
   webhook on the repo (push events, JSON, signed with a shared secret) calls
   it on every push. Requests with an invalid `X-Hub-Signature-256` are
   rejected; pushes to other branches are ignored.
4. On a push to the tracked branch it fetches and fast-forwards (it never
   merges or rebases; a diverged clone only logs a warning), runs `npm ci` when
   `package-lock.json` changed, builds into `.release-next/`, and swaps it into
   `dist/` only if the build succeeds. A failed build keeps the previous
   release online. Pushes that arrive mid-build queue one follow-up deploy, and
   visitors are held briefly (not errored) while the release swaps.
5. A periodic check (every 5 minutes) catches pushes whose webhook was missed,
   e.g. while the host was offline.

Environment: `PORT` (default `4321`), `HOST` (`0.0.0.0`), `PREVIEW_PORT`
(internal, `4331`), `PRODUCTION_SYNC_INTERVAL` (seconds, `300`),
`DEPLOY_WEBHOOK_SECRET` (the GitHub webhook secret; without it the webhook is
disabled and only the periodic check runs), and `FEEDBACK_DIR` (see
[Feedback tool](#feedback-tool)). Changes to `scripts/production.mjs` and
`scripts/feedback-server.mjs` need a restart of the service.

On the host it runs as the systemd user service `irie-vibes-production`
(defined in `~/.config/systemd/user/irie-vibes-production.service`, not in this
repo). The webhook secret lives outside the repo in
`~/.config/irie-vibes/production.env` (loaded via `EnvironmentFile=`):

```bash
journalctl --user -u irie-vibes-production -f   # follow pulls, builds, releases
systemctl --user restart irie-vibes-production  # restart (e.g. after script changes)
systemctl --user stop irie-vibes-production     # take production offline
```

To set it up on a new host: clone the repo into the production folder, run
`npm ci`, and create a user service whose `WorkingDirectory` is that clone and
whose `ExecStart` is `node scripts/production.mjs` (with `Restart=always` and
`PATH` including Node and git). Git must be able to fetch without prompts
(SSH key without passphrase or a credential helper). Then add a repo webhook
in GitHub (*Settings → Webhooks*): payload URL `https://<public host>/__deploy`,
content type `application/json`, the same secret as `DEPLOY_WEBHOOK_SECRET`,
and only the *push* event.

## Editing content

Content is managed with Sveltia CMS at `/admin/`. Editors signed in with
GitHub save straight to `main`, so their changes are live within about 30
seconds. Full instructions and the collection map are in [`CMS.md`](./CMS.md).

While `npm run dev` is running, the dev server fetches the current branch's
upstream every 30 seconds and fast-forwards new commits, so CMS edits hot-reload
without a manual pull when you are on `main` (set `CONTENT_SYNC_INTERVAL` to
change the seconds, or `0` to disable; diverged branches are left alone with a
warning). On a feature branch, merge `main` to pick up CMS edits.

The build outputs a fully static site in `dist/`, so it can also be hosted on
any static host (Netlify, Vercel, Cloudflare Pages, GitHub Pages).

## Feedback tool

Testers can send feedback from any page (except `/admin`), on both the dev
server and production: click the **Feedback** button (bottom left) or press
**Shift+F**, drag over the area in question (or click for the whole screen,
or skip the screenshot), and type a comment. The screenshot of the visible
screen renders in the background while they draw, and is stored with the page
URL, viewport size, scroll position, selected region and browser.

`/feedback` is the inbox: status tabs (*New*, *In progress*, *Done*, *All*)
with counts, one-click status changes, delete, a screenshot lightbox, and a
form for notes without a screenshot. It refreshes every 30 seconds. The inbox
is not linked from the site and has no login, so anyone with the URL can read
and manage it.

The *Developer notes* tab shows messages from the developer to testers. They
are written in the CMS (*Feedback → Developer notes*, `content/dev-notes.json`)
and published with the site; each browser marks notes it hasn't seen as *New*.

The API lives in `scripts/feedback-server.mjs` and is served by the dev server
and by the production server under `/__feedback/`. Entries are stored outside
this repository in `~/sources/repos/stef/irie-vibes-feedback/` (one JSON file
per entry, `images/`, and a generated `index.md`); set `FEEDBACK_DIR` to use
another private folder. Do not commit feedback data.

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
irie-vibes/
├── content/                  # CONTENT (edited via the CMS) — source of truth
│   ├── site.json             #   settings, nav, socials, chrome images
│   ├── media.json            #   per-page hero images + shared images
│   ├── lineup.json           #   stages, days, default act description
│   ├── tickets.json          #   ticket + camping price tables
│   ├── sponsors.json         #   main + regular sponsor lists
│   ├── about.json            #   about-page accordions
│   ├── dev-notes.json        #   developer notes for testers (/feedback)
│   ├── regulations.json      #   regulations sections
│   ├── acts/*.json           #   one file per line-up act
│   └── pages/*.json          #   When / Drinks / Kids / Volunteer copy
├── public/
│   ├── admin/                # Sveltia CMS (index.html, config.yml, bundle)
│   └── assets/               # all images (heroes, sponsors, socials, posters)
├── scripts/
│   ├── production.mjs        # self-updating production server (npm run production)
│   ├── feedback-server.mjs   # feedback API + storage (dev and production)
│   ├── extract-content.mjs   # one-time: export → generated/irie.json
│   └── migrate-to-cms.mjs    # one-time: seeded content/ from the export
└── src/
    ├── data/                 # typed accessors: read content/*.json, apply types
    │   ├── types.ts          #   interfaces = CMS content types
    │   ├── site.ts  lineup.ts  tickets.ts  pages.ts
    │   ├── about.ts  sponsors.ts  regulations.ts
    │   └── generated/irie.json  # archival extract (migration input only)
    ├── integrations/         # Astro integrations: feedback tool, dev content sync
    ├── feedback/             # /feedback inbox page + capture script (Shift+F)
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
  awaits translation (editable in *Content pages → Regulations*).
- A few **sponsor logos** (4AD, Oxfam, OKay Kortemark, Vernafix) reference the
  original remote placeholder URLs and should be replaced with uploaded files.

## How the content was seeded

`content/` was generated once from the original export via
`scripts/migrate-to-cms.mjs` (`npm run content:migrate`). That was a one-time
seed — `content/` is now the source of truth and is edited through the CMS. See
[`CMS.md`](./CMS.md) for the editing workflow.
