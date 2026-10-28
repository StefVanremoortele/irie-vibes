# Irie Vibes Roots Festival — website

A faithful rebuild of the Irie Vibes Roots Festival site (Kortemark, Belgium ·
22–24 July 2027), built with [Astro](https://astro.build/) as a static site.

All content lives in editable JSON files under `content/`, managed through
**Sveltia CMS** (git-based, friendly admin at `/admin/`) — see [`CMS.md`](./CMS.md).
The `src/data/` modules read those files and the templates read `src/data/`, so
content and presentation are fully separated.

What the site is for and who it serves: [`VISION.md`](./VISION.md).

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

Two self-updating environments, one per branch. Every commit lands on its site
within seconds: GitHub sends a push webhook, the server pulls and rebuilds.

| Branch | Site | Server |
| --- | --- | --- |
| **`main`** = production | https://irie-vibes.prod.vanremoortele.be | `irie-vibes-production`, port **4321** |
| **`dev`** = development | https://irie-vibes.concept.vanremoortele.be (noindex) | `irie-vibes-development`, port **4322** |

- Develop on `dev` (or feature branches merged into it), check the change on the
  concept site, then merge `dev` into `main` to go live.
- **The CMS always saves to `main`** (on both sites), so CMS edits go live at once
  and reach `dev` only when `main` is merged back into `dev`. Merge `main` into
  `dev` before pushing `dev` to `main`.
- The local dev server (`npm run dev`) uses port **4320**, so it can run next to both.

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
`PRODUCTION_PREVIEW` (`0` skips `astro preview` when a web server such as nginx serves
`dist/` itself and forwards only `/__deploy` and `/__feedback/` here),
`DEPLOY_WEBHOOK_SECRET` (the GitHub webhook secret; without it the webhook is
disabled and only the periodic check runs), and `FEEDBACK_DIR` /
`FEEDBACK_GIT_SYNC` (see [Feedback tool](#feedback-tool)). Files whose content
didn't change keep the live release's modification time, so nginx's
ETag/Last-Modified stay stable across deploys. Changes to `scripts/production.mjs` and
`scripts/feedback-server.mjs` need a restart of the service.

On the host each environment runs as a systemd service (`irie-vibes-production`
from `~/production`, `irie-vibes-development` from `~/development`; unit files in
`/etc/systemd/system/`, not in this repo). nginx serves each site's `dist/` by
host name and forwards `/__deploy` and `/__feedback/` to its Node server
(`PRODUCTION_PREVIEW=0`). The webhook secret lives outside the repo in
`~/.config/irie-vibes/production.env` (loaded via `EnvironmentFile=`):

```bash
journalctl -u irie-vibes-production -f        # follow pulls, builds, releases
sudo systemctl restart irie-vibes-production  # restart (e.g. after script changes)
sudo systemctl stop irie-vibes-production     # take production offline
```

To set it up on a new host: clone the repo into the production folder, run
`npm ci`, and create a service whose `WorkingDirectory` is that clone and
whose `ExecStart` is `node scripts/production.mjs` (with `Restart=always` and
`PATH` including Node and git). Git must be able to fetch without prompts
(SSH key without passphrase or a credential helper). Then add a repo webhook
in GitHub (*Settings → Webhooks*): payload URL `https://<public host>/__deploy`,
content type `application/json`, the same secret as `DEPLOY_WEBHOOK_SECRET`,
and only the *push* event.

### Caching and images

- **Fingerprinted asset URLs:** `assetUrl()` (`src/lib/assets.ts`) appends
  `?v=<content hash>` to every local `/assets/` file. nginx caches fingerprinted
  URLs for a year (immutable) and revalidates plain URLs and pages (`no-cache`), so a
  file replaced in the CMS shows up at once and unchanged files never reload.
- **Missing files:** `existingAssetUrl()` leaves out a CMS image whose file doesn't
  exist (e.g. never uploaded) and logs `[assets] <field>: … not found` in the build.
- **Sponsor logos** are shrunk to 160px tall at build time
  (`src/integrations/sponsor-logos.ts`); the CMS originals stay untouched.
- **Stable dates:** unchanged files keep their modification time across deploys,
  so browsers get `304 Not Modified` instead of re-downloading.

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

> **Design:** the feedback tool is a tester tool, not part of the festival
> site, so it deliberately does **not** follow the site design system
> (`tokens.css` / the Roots Vanguard look). The `/feedback` dialog uses the
> *Pane* design tokens (Inter Tight / Fraunces / JetBrains Mono, violet
> accent), defined as CSS variables scoped to its `.fbx` root so they don't
> leak into the site; the capture UI keeps its own minimal light theme.
> `/feedback` is a dialog over the real homepage
> (`src/components/HomeContent.astro`, shown inert behind a dark blurred
> scrim). Esc, a click on the scrim or the *Esc* chip go back to the page you
> came from.

Testers can send feedback from any page (except `/admin`), on both the dev
server and production: click the **Feedback** button (bottom left) or press
**Shift+F**, drag over the area in question (or click for the whole screen,
or skip the screenshot), and type a comment. An *Applies to* toggle (*This
page* / *Every page*, default *This page*) says whether the change concerns
only that page or every page (header, footer, shared layout); it is stored as
`scope` (`page` / `site`) and *Every page* items are tagged in the inbox. The screenshot of the visible
screen renders in the background while they draw, and is stored with the page
URL, viewport size, scroll position, selected region and browser. Embedded
iframes (YouTube, maps) can't be rendered into the screenshot: YouTube videos
show as their thumbnail, other embeds as a labelled box, and the embeds on
screen are stored with the entry and linked in the inbox. Feedback is
anonymous: there is no name field, and every post is stored and shown under the
pseudonym *Jah a the Creator*. Clicking the name (on `/feedback` and in the
capture form) shows the *Jah a the Creator Manifest*; its text lives in
`src/feedback/manifest.ts`.

Workflow: a tester sends feedback (status *New*); the AI triage
(`feedback-triage` skill, outside this repo) adds three interpretations checked
against [VISION.md](VISION.md); the tester clicks the card that matches; only the
chosen one is built, the item moves to *In progress* with the AI interpretation
and commit; the tester accepts it (*Done*).

`/feedback` is the inbox, with three tabs: *Feedback*, *Changelog* and
*Developer notes*. The top right shows when the website last changed: the
date of the latest commit outside the CMS-owned `content/` and `public/assets/`
(read at build time), so CMS edits don't count. The *Feedback* tab is an inbox
split: a list on the left with status filters (*New*, *In progress*, *Done*,
*All*; the last choice is remembered per browser; ↑/↓ move the selection) and
the selected item on the right, with its screenshot (click to enlarge), the
comment, the AI interpretation (when an AI developer picked it up: an optional
`interpretation` object `{ text, by, date, commit }` in the entry JSON, showing
how the comment was read, in English, and the commit that addressed it), the
proposed interpretations (optional `proposals` `{ by, date, recommended, options:
[{ key, title, interpretation, implementation, effort, vision }], chosen, chosenAt }`,
written by the AI triage: the tester picks the one they meant by clicking its card
(highlighted on hover; Enter/Space with the keyboard), via `POST /__feedback/api/entries/<id>/choose`; changeable while the item is
*New*), the conversation and a reply box (Enter sends, Shift+Enter adds a
line). *Mark in progress* (on *New* items), *Accept change* (on *In progress*
items) and delete sit in its header; *Add a note without a screenshot* is at
the bottom of the list. Under 900px wide the list and the item are shown one
at a time. It refreshes every 30 seconds. The inbox is not linked from the
site and has no login, so anyone with the URL can read it.

**Statuses are managed in Sveltia** at `/admin/feedback/` (in dev:
`/admin/feedback/index.html`), a second admin page for the private repo
[`irie-vibes-feedback`](https://github.com/StefVanremoortele/irie-vibes-feedback).
Sign in there with a GitHub token that can access that private repo.
The developer can also add *Developer comments* to an item there. Comments are
markdown; paste a screenshot into the text to add an image (stored in
`images/` of the private repo). They appear under the post on
`/feedback` within about 30 seconds.
Testers can *Reply* from the inbox (stored in the same comments list, under
the pseudonym), *Mark in progress* a *New* item, and *Accept change* on an
item that is *In progress*, which moves it to *Done* (with `acceptedAt`). The
server pulls CMS edits before writing, then commits and pushes the change.

The *Developer notes* tab shows messages from the developer to testers. They
are written in the feedback admin (*Developer notes*, `notes/` in the private
repo) and appear within about 30 seconds; each browser marks notes it hasn't
seen as *New*.

The *Changelog* tab (old `/changelog` links redirect to it) shows the
changelog as a timeline, newest date first. Each change is its own post in
the feedback admin (*Changelog*, one file per post in `changelog/` of the
private repo): a date (picked in the admin, shown on the timeline), a title,
an optional *Action needed* status, optional markdown text, and tagged changes
(*New*, *Fix*, *Change*, *Infra*, *Dev only*: a bold lead phrase plus the rest
of the sentence). The server renders the markdown (raw HTML is escaped), so
edits appear within about 30 seconds without a site rebuild. An older
`changelog.json` (a list of `entries`, or one markdown `body`) is still shown.

The API lives in `scripts/feedback-server.mjs` and is served by the dev server
and by the production server under `/__feedback/`. Entries are stored outside
this public repository in `~/sources/repos/stef/irie-vibes-feedback/`, a clone
of the private feedback repo (`entries/<id>.json`, `images/<id>/`,
`notes/*.json`, `changelog/*.json`, and an
untracked generated `index.md`); set `FEEDBACK_DIR` to use another folder. With
`FEEDBACK_GIT_SYNC=1` (set in production) the server commits and pushes every
new or deleted item and pulls status edits from the CMS before serving the
list (at most every 15 seconds). Never commit feedback data to this repo.

## What's on the site

Real, SEO-friendly routes (not a single-page app):

| Route              | Page                                                        |
| ------------------ | ----------------------------------------------------------- |
| `/`                | Home — hero, live countdown, intro, 2026 aftermovie         |
| `/tickets`         | Tickets, passes + camping/parking fees (content blocks)     |
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
│   ├── site.json             #   site-wide settings, theme colour, nav, socials, sticky images
│   ├── home.json             #   home page (hero, dates, countdown, intro, aftermovie)
│   ├── lineup.json           #   line-up page: hero, stages, days, act-page hero
│   ├── sponsors.json         #   main + regular sponsor lists
│   ├── about.json            #   about-page accordions
│   ├── regulations.json      #   regulations sections
│   ├── acts/*.json           #   one file per line-up act
│   └── pages/*.json          #   Tickets / When / Where / Camping / Drinks / Kids / Volunteer copy
├── public/
│   ├── admin/                # Sveltia CMS (index.html, config.yml, bundle)
│   └── assets/               # all images (heroes, sponsors, socials, posters)
├── scripts/
│   ├── production.mjs        # self-updating production server (npm run production)
│   ├── feedback-server.mjs   # feedback API + storage (dev and production)
│   ├── extract-content.mjs   # one-time: export → generated/irie.json
│   ├── migrate-to-cms.mjs    # one-time: seeded content/ from the export
│   └── sort-editions.mjs     # previous editions newest first (GitHub workflow after CMS saves)
└── src/
    ├── data/                 # typed accessors: read content/*.json, apply types
    │   ├── types.ts          #   interfaces = CMS content types
    │   ├── site.ts  lineup.ts  pages.ts
    │   ├── about.ts  sponsors.ts  regulations.ts
    │   └── generated/irie.json  # archival extract (migration input only)
    ├── integrations/         # Astro integrations: feedback tool, dev content sync
    ├── feedback/             # /feedback inbox page + capture script (Shift+F)
    ├── lib/assets.ts         # asset URL helper
    ├── styles/               # tokens.css (Roots Vanguard) + global.css
    ├── components/           # Header, Footer, Hero, Countdown, CopyPage
    ├── layouts/Base.astro    # HTML shell + header/footer
    └── pages/                # one file per route
```

Data flow: **`content/*.json` → `src/data/*.ts` (typed) → `.astro` templates**.

## Design system

Colour, type and spacing come from the "Roots Vanguard" system in the original
`DESIGN.md`, encoded as CSS custom properties in `src/styles/tokens.css`
(night-forest `#101510` surface, amber-gold `#fabc4d` accent (overridable as Site settings → Theme text colour), the reggae
tri-colour, `Anton` display + `Work Sans` body). Exact rendered values were
matched against the original export for fidelity.

Layout rules agreed through feedback (2026-10):

- **Page banners** (every page except home) share one shape (512:67, the Where
  banner) and span 4/5 of the page width, centred; the home hero is full width.
  Each page picks its own hero in its Content pages entry; an empty field or
  *Show hero image* off means no banner.
- **Header buttons:** the menu and ticket buttons are always the same size:
  `clamp(3.25rem, 8vw, 7rem)`, capped under the header height, so small on
  phones and never as big as the old 144px ticket button on laptops. The menu button's spinning-record animation can be switched off (or replaced by an
  image) in *Site settings*, and never plays when the visitor's device asks for
  reduced motion.
- Sponsors without a logo show as a text tile (name, optional subtitle).

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
