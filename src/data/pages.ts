import type { ContentPage } from './types';
import home from '../../content/home.json';
import lineup from '../../content/lineup.json';
import about from '../../content/about.json';
import regulations from '../../content/regulations.json';
import { existingAssetUrl } from '../lib/assets';

/**
 * A page's hero banner, set on that page's own entry under Content pages in the CMS.
 * Undefined (no banner) when no image is chosen, "Show hero image" is off, or the
 * file doesn't exist.
 */
export function heroUrl(page: { hero?: string; showHero?: boolean }, field: string): string | undefined {
  return page.showHero === false ? undefined : existingAssetUrl(page.hero, `${field} → Hero image`);
}

// Simple content pages (tickets, when, where, camping, drinks, kids, volunteer) — one JSON file each.
const pageModules = import.meta.glob<ContentPage & { showHero?: boolean; circulatieplan?: string }>('/content/pages/*.json', {
  eager: true,
  import: 'default',
});

export const contentPages: Record<string, ContentPage> = Object.fromEntries(
  Object.values(pageModules).map((p) => [
    p.slug,
    {
      slug: p.slug,
      title: p.title,
      hero: heroUrl(p, p.title),
      blocks: p.blocks,
    },
  ]),
);

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
