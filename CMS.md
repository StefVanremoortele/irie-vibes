# Content management (Sveltia CMS)

The site is managed with **[Sveltia CMS](https://github.com/sveltia/sveltia-cms)**
— a modern, git-based headless CMS with a friendly form-based admin, aimed at
non-technical editors. It's already wired up:

- Admin UI: `public/admin/` (vendored Sveltia bundle, pinned to v0.218.1).
- Configuration: `public/admin/config.yml`.
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
| Settings → Site settings | `content/site.json` | dates, countdown, ticket/volunteer links, home intro, toggles, nav, socials, chrome images |
| Settings → Hero images | `content/media.json` | hero image per page + shared images |
| Settings → Line-up settings | `content/lineup.json` | stages and days |
| Settings → Sponsors | `content/sponsors.json` | main + regular sponsor logos / text |
| Settings → About page | `content/about.json` | Greenforward, initiatives, shop, editions, band |
| Line-up — acts | `content/acts/*.json` | one entry per performance (add/edit/remove) |
| Content pages | `content/pages/*.json`, `content/tickets.json`, `content/regulations.json` | When, Where, Drinks, Kids, Volunteer, Tickets & fees, Regulations |

Feedback items (their status: New / In progress / Done), the developer notes
shown on `/feedback`, and the changelog (dated entries with tagged changes, the *Changelog* tab of `/feedback`) are managed in a separate admin, `/admin/feedback/`,
which edits the private repo
`StefVanremoortele/irie-vibes-feedback`; see the README's *Feedback tool*.

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
`public/admin/config.yml`). Open `/admin/` on the public site and sign in:

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

- Tickets and Line-up each have an opt-in custom HTML field. It is off by
  default; when enabled, the trusted administrator's HTML replaces the normal
  CMS-managed content inside the existing page shell.
- Act names are placeholders; real artists can be added/edited in *Line-up —
  acts* as they're announced.
