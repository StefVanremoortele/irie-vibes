import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// The original export references assets as relative paths ("assets/hero-home.png").
// In this site those files live under /public/assets, i.e. served from "/assets/...".
// Remote URLs (http/https) are passed through untouched so a CMS can point at a CDN.
//
// Local files get a content fingerprint (?v=<hash>): a file replaced in the CMS gets a
// new URL, so browsers can cache /assets/ forever and still see changes immediately.
const fingerprints = new Map<string, string>();

function fingerprint(url: string): string {
  if (!fingerprints.has(url)) {
    let hash = '';
    try {
      // Builds run from the project root; bundling makes import.meta.url unreliable here.
      const file = join(process.cwd(), 'public', decodeURI(url));
      hash = createHash('sha1').update(readFileSync(file)).digest('hex').slice(0, 10);
    } catch {
      // Missing file: leave the URL as is (served with no-cache).
    }
    fingerprints.set(url, hash);
  }
  return fingerprints.get(url)!;
}

/**
 * Like assetUrl, but undefined when a local file doesn't exist (e.g. a CMS field
 * pointing at an image that was never uploaded), so the page can leave it out
 * instead of showing a broken image. Logs a build warning naming the field.
 */
export function existingAssetUrl(path: string | null | undefined, field: string): string | undefined {
  if (!path) return undefined;
  if (/^https?:\/\//i.test(path)) return path;
  const url = '/' + path.replace(/^\/+/, '').split('?')[0];
  if (fingerprint(url)) return assetUrl(path);
  console.warn(`[assets] ${field}: ${url} not found in public/ (never uploaded?); left out of the page.`);
  return undefined;
}

export function assetUrl(path: string | null | undefined): string {
  if (!path) return '';
  if (/^https?:\/\//i.test(path)) return path;
  const url = '/' + path.replace(/^\/+/, '').split('?')[0];
  const hash = fingerprint(url);
  return hash ? `${url}?v=${hash}` : url;
}
