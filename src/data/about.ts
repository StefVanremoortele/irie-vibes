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

/** Returns the throwback content for a given edition year. */
export function getEdition(year: number): Edition {
  const match = data.editions.find((e) => e.year === year);
  if (match) {
    return { year, paragraphs: match.paragraphs, poster: assetUrl(match.poster) };
  }
  return { year, paragraphs: [defaultEditionText] };
}

/** Accordion 4 — Irie shop (physical, on-site only). */
export const shop = {
  intro: data.shopIntro,
  items: data.shop as ShopItem[],
};

/** Accordion 5 — The Irie Vibes band. */
export const band = {
  text: data.band,
};
