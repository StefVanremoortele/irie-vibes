import type { ContentPage } from './types';
import media from '../../content/media.json';
import { assetUrl } from '../lib/assets';

// Simple content pages (when, drinks, kids, volunteer) — one JSON file each.
const pageModules = import.meta.glob<ContentPage>('/content/pages/*.json', {
  eager: true,
  import: 'default',
});

export const contentPages: Record<string, ContentPage> = Object.fromEntries(
  Object.values(pageModules).map((p) => [
    p.slug,
    {
      slug: p.slug,
      title: p.title,
      hero: assetUrl(p.hero),
      heroSize: p.heroSize,
      blocks: p.blocks,
    },
  ]),
);

/** Hero images for the bespoke pages (home, tickets, line-up, act, where, camping, about). */
export const heroImages = {
  home: assetUrl(media.heroes.home),
  tickets: assetUrl(media.heroes.tickets),
  lineup: assetUrl(media.heroes.lineup),
  act: assetUrl(media.heroes.act),
  where: assetUrl(media.heroes.where),
  camping: assetUrl(media.heroes.camping),
  about: assetUrl(media.heroes.about),
};

/** Shared images used across bespoke pages. */
export const pageImages = {
  circulatieplan: assetUrl(media.images.circulatieplan),
  actPoster: assetUrl(media.images.actPoster),
};
