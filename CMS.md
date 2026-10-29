# Content management (Sveltia CMS)

The site is managed with **[Sveltia CMS](https://github.com/sveltia/sveltia-cms)**
— a modern, git-based headless CMS with a friendly form-based admin, aimed at
non-technical editors. It's already wired up:

- Admin UI: `public/admin/` (vendored Sveltia bundle, pinned to v0.253.2).
- Configuration: `src/cms/config.yml`, served as `/admin/config.yml` by `src/pages/admin/config.yml.ts` with
  `backend.branch` set to the branch the site is built from (`CMS_BRANCH` overrides it).
- **Which branch saves go to:** the production admin (https://irie-vibes.prod.vanremoortele.be/admin/) commits to
  `main` and is live within seconds; the concept admin (https://irie-vibes.concept.vanremoortele.be/admin/) commits to
  `dev`, so edits there are a test: they reach production only when `dev` is merged into `main`.
- Content: `content/*.json` — the single source of truth the site builds from.

Editors change content in the admin → it's committed to `content/*.json` on
`main` → the production server pulls and rebuilds the static site from those
files within seconds (triggered by a GitHub webhook). No content lives in the templates.

> **Saving in the admin publishes.** The CMS commits straight to `main`, and
> `main` is production (see [README → Branches and deployment](README.md#branches-and-deployment)).
> There is no separate draft or review step.

## How content maps to the admin

| Admin section | File(s) | What it controls |
| ------------- | ------- | ---------------- |
| Content pages | one file per page (below) | one entry per page, in the order of the site menu; every page has an optional **Hero image** + **Show hero image** switch (empty or off: no banner) |
| Content pages → Home | `content/home.json` | dates label, countdown (switch + date), intro, aftermovie |
| Content pages → Line-up | `content/lineup.json` | stages, days, custom HTML; act pages' hero |
| Content pages → Tickets, When, Where, Parking & camping, Drinks, Kids, Volunteer | `content/pages/*.json` | title + content blocks (heading/paragraph; prices are written as text). Where: also the circulation plan |
| Content pages → All about Irie Vibes | `content/about.json` | category order, then one block per accordion (title, show switch, content): Greenforward, initiatives, previous editions (poster, video, group photo + switches, optional text; new editions are added at the top; the site sorts by year. `scripts/sort-editions.mjs` can sort the list in the content file, run by a GitHub workflow once one is added), shop, band (text + photos & videos: each item is a photo, caption below, or a video, caption above) |
| Content pages → Regulations | `content/regulations.json` | regulation sections |
| Line-up — acts | `content/acts/*.json` | one entry per performance (add/edit/remove) |
| Settings → Site settings | `content/site.json` | site-wide only: name, organisation, address, contact, ticket/volunteer links, **menu button animation**, **theme text colour**, page navigation (burger menu order + **Show in burger menu** per page), socials, sticky images (header banner, footer, **ticket button image**, **menu button image**) |
| Settings → Sponsors | `content/sponsors.json` | main + regular sponsor logos / text |

Feedback items (their status: New / In progress / Done), the developer notes
shown on `/feedback`, and the changelog (one dated post per change, the *Changelog* tab of `/feedback`) are managed in a separate admin, `/admin/feedback/`,
which edits the private repo
`StefVanremoortele/irie-vibes-feedback`; see the README's *Feedback tool*.

## Text fields

Multi-line texts (paragraphs, intros, descriptions, act bios): **Enter** gives a
new line, an **empty line** starts a new paragraph. You can type
`<strong>bold</strong>` and `<a href="…">link</a>` (also `<em>`); any other tag
shows as typed. Links to other sites open in a new tab, and a link without
`https://` (e.g. `irievibes.be/socials`) gets it added. Headings and short
one-line fields allow the same tags, no line breaks. (`src/lib/richtext.ts`)

## Images and uploads

- **Upload limit 5 MB.** Photos (JPEG, PNG, HEIC, WebP) are scaled to at most
  2000px and converted to WebP in the browser *before* uploading, so phone photos
  end up a few hundred KB. GIFs and SVGs are uploaded as they are. (Large files
  used to fail with "Failed to save image": GitHub rejects very large commits.)
- **Changes show at once:** image URLs carry a content fingerprint, so a replaced
  logo or banner appears on the next page view.
- An image field pointing at a file that doesn't exist is left out of the page
  (the build logs which field).
- Page banners are shown at one fixed shape (512:67) on every page except home;
  upload wide images, other proportions are trimmed.
- Signing in online needs a GitHub token with *Contents: Read and write* on this
  repo (or the local mode below). The login is stored per browser.

## Editing locally (no account needed)

Sveltia's local mode uses the browser's **File System Access API** (Chromium
browsers — Chrome/Edge), so you can edit with zero cloud setup:

```bash
npm run dev
```

Then open **http://localhost:4320/admin/index.html** (use `/admin/index.html`
locally — Astro's dev server doesn't do directory-index; production hosts serve
`/admin/` fine). Click **"Work with Local Repository"** and select this repository's
folder when prompted. Edits are written straight to `content/*.json` and the dev
server hot-reloads.

> Fallback for non-Chromium browsers: run `npm run cms:proxy` in a second
> terminal (starts the Decap-compatible local backend that `local_backend: true`
> in `config.yml` enables), then use the admin as above.

## Editing online (GitHub-backed)

The admin is configured for the GitHub repository
`StefVanremoortele/irie-vibes` on branch `main` (`backend` in
`src/cms/config.yml`). Open `/admin/` on the public site and sign in:

- **"Sign In Using Access Token"**: any editor with write access to the repo
  can use a GitHub personal access token.
- **"Sign In with GitHub"** (OAuth) needs a GitHub OAuth App plus an OAuth
  relay such as the [`sveltia-cms-auth`](https://github.com/sveltia/sveltia-cms-auth)
  Cloudflare Worker, referenced from `config.yml`.

Every save is a commit on `main`. GitHub notifies the self-hosted production
server through a webhook, which pulls, rebuilds, and publishes it within
seconds (see
[README → Branches and deployment](README.md#branches-and-deployment)). A
running dev server on `main` also pulls these commits automatically.

If production ever moves to a static host (Netlify, Vercel, Cloudflare Pages),
deploy `npm run build` → `dist/` with automatic deploys on push to `main`; the
CMS workflow stays the same.

## Regenerating content from the original export

`content/` was generated once from the original export via
`scripts/migrate-to-cms.mjs` (`npm run content:migrate`). That was a one-time
seed — `content/` is now the source of truth and should be edited via the CMS
(or directly), not regenerated.

## Notes / next steps

- **Prose fields** (page blocks, regulations, about, and act descriptions) are currently plain
  text/HTML lists. They're fully editable, but switching them to a rich-text
  (markdown) widget would be an easy follow-up for an even nicer editing
  experience.
- The **English regulations** still hold the Dutch text (from the source) and
  await a translation — now editable in *Content pages → Regulations*.

- Line-up has an opt-in custom HTML field. It is off by
  default; when enabled, the trusted administrator's HTML replaces the normal
  CMS-managed content inside the existing page shell.
- Act names are placeholders; real artists can be added/edited in *Line-up —
  acts* as they're announced.
