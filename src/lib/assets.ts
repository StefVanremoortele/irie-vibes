// The original export references assets as relative paths ("assets/hero-home.png").
// In this site those files live under /public/assets, i.e. served from "/assets/...".
// Remote URLs (http/https) are passed through untouched so a CMS can point at a CDN.
export function assetUrl(path: string | null | undefined): string {
  if (!path) return '';
  if (/^https?:\/\//i.test(path)) return path;
  return '/' + path.replace(/^\/+/, '');
}
