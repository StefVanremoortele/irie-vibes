import type { APIRoute } from 'astro';
import { execFileSync } from 'node:child_process';
import source from '../../cms/config.yml?raw';

// The Sveltia CMS config (src/cms/config.yml), with backend.branch set to the
// branch this site is built from: the production build (main) commits CMS saves
// to main, the concept build (dev) to dev, so test edits don't go live.
// CMS_BRANCH overrides it; outside a git checkout it stays main.
function buildBranch(): string {
  if (process.env.CMS_BRANCH) return process.env.CMS_BRANCH;
  try {
    const branch = execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { encoding: 'utf8' }).trim();
    return branch && branch !== 'HEAD' ? branch : 'main';
  } catch {
    return 'main';
  }
}

export const GET: APIRoute = () => {
  const config = source.replace(/^(\s+branch:)\s*main\b.*$/m, `$1 ${buildBranch()}`);
  return new Response(config, { headers: { 'Content-Type': 'text/yaml; charset=utf-8' } });
};
