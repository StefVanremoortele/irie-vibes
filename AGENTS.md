## Maintaining this file

Keep this file concise and limited to durable project knowledge useful to nearly every session. Prefer pointers to the authoritative docs and commands over duplicated detail.

## Project notes

- This repository is the canonical Irie Vibes Roots Festival website; see [README.md](README.md) and [CMS.md](CMS.md).
- `content/*.json` is the Sveltia CMS-owned source of truth. Editors commit CMS changes directly to `main`; do not reformat or regenerate content files.
- `main` is production: a self-updating server (`npm run production`, systemd user service `irie-vibes-production`) on the maintainer's host serves port `4321` and deploys every push to `main` within seconds via a GitHub webhook (`POST /__deploy`). Do development on feature branches and merge to `main` only when ready to go live. The dev server runs on port `4320`.
- The repository is public: never commit private planning documents, design exports, credentials, or private notes.
