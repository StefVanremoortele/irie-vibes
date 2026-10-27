## Maintaining this file

Keep this file concise and limited to durable project knowledge useful to nearly every session. Prefer pointers to the authoritative docs and commands over duplicated detail.

`AGENTS.md` is the single instruction file for all agents (Codex, Claude, …); `CLAUDE.md` is a symlink to it. Edit `AGENTS.md` and keep the symlink — never replace it with a separate copy.

## Project notes

- This repository is the canonical Irie Vibes Roots Festival website; see [README.md](README.md) and [CMS.md](CMS.md).
- [VISION.md](VISION.md) describes the site's purpose, audiences and design principles: check features and feedback against it.
- `content/*.json` is the Sveltia CMS-owned source of truth. Editors commit CMS changes directly to `main`; do not reformat or regenerate content files.
- `main` is production: a self-updating server (`npm run production`, systemd user service `irie-vibes-production`) on the maintainer's host serves port `4321` and automatically rebuilds and redeploys production within seconds of every commit that reaches `main` on GitHub (including CMS edits), via a GitHub webhook (`POST /__deploy`). There is no manual deploy step: pushing to `main` is going live. Do development on feature branches and merge to `main` only when ready to go live. Never merge into or push to `main` unless the maintainer explicitly says so for that change; pushing the feature branch is fine. The dev server runs on port `4320`.
- Parallel work: use a git worktree per feature branch in a sibling folder (`../irie-vibes-wt/<branch>`), never by switching branches in the main checkout (its dev server on `4320` would silently change). Run `npm install` and a separate dev server on a free port (e.g. `npx astro dev --port 4330`) in each worktree. All worktrees share the private feedback clone; set `FEEDBACK_DIR` to a scratch folder for tests that write feedback.
- The feedback tool (`src/feedback/`: the `/feedback` page and the Shift+F capture UI) is a tester tool, not part of the festival site: it does not follow the site design system. The `/feedback` dialog uses the Pane design tokens scoped to its `.fbx` root (don't let them leak into the site); see README "Feedback tool".
- The repository is public: never commit private planning documents, design exports, credentials, or private notes.
