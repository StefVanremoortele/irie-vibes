import type { AboutBlock, Edition, ShopItem } from './types';
import data from '../../content/about.json';
import { assetUrl } from '../lib/assets';

/** Accordion 1 — VZW Greenforward. */
export const greenforward: AboutBlock[] = data.greenforward as AboutBlock[];

/** Accordion 2 — Socio-environmental initiatives & partnerships. */
export const initiatives: AboutBlock[] = data.initiatives as AboutBlock[];

// Accordion 3 — Previous editions (year navigator).
export const EDITION_MIN_YEAR: number = data.editionMinYear;
export const EDITION_MAX_YEAR: number = data.editionMaxYear;
export const defaultEditionText: string = data.defaultEditionText;
export const editions = data.editions.map((edition) => ({
  year: edition.year,
  paragraphs: edition.paragraphs,
  poster: edition.poster ? assetUrl(edition.poster) : undefined,
  video: (edition as { video?: string }).video,
}));

/** Returns the throwback content for a given edition year. */
export function getEdition(year: number): Edition {
  const match = data.editions.find((e) => e.year === year);
  if (match) {
    return { year, paragraphs: match.paragraphs, poster: match.poster ? assetUrl(match.poster) : undefined, video: (match as { video?: string }).video };
  }
  return { year, paragraphs: [defaultEditionText] };
}

/** Accordion 4 — Irie shop (physical, on-site only). */
export const shop = {
  intro: data.shopIntro,
  items: (data.shop as ShopItem[]).map((item) => ({ ...item, image: item.image ? assetUrl(item.image) : undefined })),
};

export const aboutSections = (data.sections ?? [
  { key: 'greenforward', label: 'VZW Greenforward', visible: true },
  { key: 'initiatives', label: 'Socio-environmental initiatives & partnerships', visible: true },
  { key: 'editions', label: 'Previous editions', visible: true },
  { key: 'shop', label: 'Irie shop', visible: true },
  { key: 'band', label: 'The Irie Vibes band', visible: true },
]).map((section, order) => ({ ...section, order }));

/** Accordion 5 — The Irie Vibes band. */
export const band = {
  text: data.band,
};
