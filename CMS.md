# Content management (Sveltia CMS)

The site is managed with **[Sveltia CMS](https://github.com/sveltia/sveltia-cms)**
— a modern, git-based headless CMS with a friendly form-based admin, aimed at
non-technical editors. It's already wired up:

- Admin UI: `public/admin/` (vendored Sveltia bundle, pinned to v0.218.1).
- Configuration: `public/admin/config.yml`.
- Content: `content/*.json` — the single source of truth the site builds from.

Editors change content in the admin → it's saved to `content/*.json` → the
static site is rebuilt from those files. No content lives in the templates.

## How content maps to the admin

| Admin section | File(s) | What it controls |
| ------------- | ------- | ---------------- |
| Settings → Site settings | `content/site.json` | dates, countdown, ticket/volunteer links, home intro, toggles, nav, socials, chrome images |
| Settings → Hero images | `content/media.json` | hero image per page + shared images |
| Settings → Line-up settings | `content/lineup.json` | stages and days |
| Settings → Sponsors | `content/sponsors.json` | main + regular sponsor logos / text |
| Settings → About page | `content/about.json` | Greenforward, initiatives, shop, editions, band |
| Line-up — acts | `content/acts/*.json` | one entry per performance (add/edit/remove) |
| Content pages | `content/pages/*.json`, `content/tickets.json`, `content/regulations.json` | When, Drinks, Kids, Volunteer, Tickets & fees, Regulations |

## Editing locally (no account needed)

Sveltia's local mode uses the browser's **File System Access API** (Chromium
browsers — Chrome/Edge), so you can edit with zero cloud setup:

```bash
npm run dev
```

Then open **http://localhost:4321/admin/index.html** (use `/admin/index.html`
locally — Astro's dev server doesn't do directory-index; production hosts serve
`/admin/` fine). Click **"Work with Local Repository"** and select this `site/`
folder when prompted. Edits are written straight to `content/*.json` and the dev
server hot-reloads.

> Fallback for non-Chromium browsers: run `npm run cms:proxy` in a second
> terminal (starts the Decap-compatible local backend that `local_backend: true`
> in `config.yml` enables), then use the admin as above.

## Going live (GitHub-backed editing)

1. Put this `site/` folder in a **GitHub repository** and push it.
2. In `public/admin/config.yml`, set `backend.repo` to your `owner/repo` (and
   the correct `branch`).
3. Deploy the static build (`npm run build` → `dist/`) to Netlify, Vercel or
   Cloudflare Pages. Enable automatic deploys on push so CMS edits go live.
4. Wire up **GitHub OAuth** so editors can sign in at `https://yoursite/admin/`:
   - Create a GitHub OAuth App.
   - Deploy the small [`sveltia-cms-auth`](https://github.com/sveltia/sveltia-cms-auth)
     Cloudflare Worker (or use another OAuth relay) and point it at that App.
   - Editors then click **"Sign In with GitHub"**; saving commits to the repo,
     which triggers a rebuild + redeploy.

Editors who have write access to the repo can also use **"Sign In Using Access
Token"** with a GitHub personal access token — handy for a quick start before
the OAuth relay is set up.

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
