import type { ContentPage } from './types';
import home from '../../content/home.json';
import lineup from '../../content/lineup.json';
import about from '../../content/about.json';
import regulations from '../../content/regulations.json';
import { existingAssetUrl } from '../lib/assets';
import { menuPages } from './site';

/**
 * A page's hero banner, set on that page's own entry under Content pages in the CMS.
 * Undefined (no banner) when no image is chosen, "Show hero image" is off, or the
 * file doesn't exist.
 */
export function heroUrl(page: { hero?: string; showHero?: boolean }, field: string): string | undefined {
  return page.showHero === false ? undefined : existingAssetUrl(page.hero, `${field} → Hero image`);
}

// Simple content pages (tickets, when, where, camping, drinks, kids, volunteer, and pages made from
// menu links) — one JSON file each, keyed by file name (the URL).
type PageSource = Partial<Omit<ContentPage, 'hero'>> & { hero?: string; showHero?: boolean; circulatieplan?: string; useCustomHtml?: boolean };
const pageModules = import.meta.glob<PageSource>('/content/pages/*.json', {
  eager: true,
  import: 'default',
});

function toContentPage(slug: string, p: PageSource, fallbackTitle = slug): ContentPage {
  const title = p.title?.trim() || fallbackTitle;
  const customHtml = p.useCustomHtml === true && p.customHtml?.trim() ? p.customHtml : undefined;
  return { slug, title, hero: heroUrl(p, title), blocks: p.blocks ?? [], showSocials: p.showSocials === true, customHtml };
}

const pageSources: Record<string, PageSource> = Object.fromEntries(
  Object.entries(pageModules).map(([path, p]) => [path.split('/').pop()!.replace(/\.json$/, ''), p]),
);

export const contentPages: Record<string, ContentPage> = Object.fromEntries(
  Object.entries(pageSources).map(([slug, p]) => [slug, toContentPage(slug, p)]),
);

/** Pages made from menu links (see menuPages): empty, titled after the menu label, until edited in the CMS. */
export const menuContentPages: ContentPage[] = menuPages.map(({ slug, label }) => toContentPage(slug, pageSources[slug] ?? {}, label));

/** Hero images for the bespoke pages (home, line-up, act, about, regulations). */
export const heroImages = {
  home: heroUrl(home, 'Home'),
  lineup: heroUrl(lineup, 'Line-up'),
  act: heroUrl({ hero: lineup.actHero, showHero: lineup.showActHero }, 'Line-up → Act pages'),
  about: heroUrl(about, 'All about Irie Vibes'),
  regulations: heroUrl(regulations, 'Regulations'),
};

/** Images that belong to a page but aren't its hero. */
export const pageImages = {
  circulatieplan: existingAssetUrl(
    Object.values(pageModules).find((p) => p.slug === 'where')?.circulatieplan,
    'Where → Circulation plan',
  ),
};
