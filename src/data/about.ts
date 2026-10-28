import type { AboutBlock, BandMedia, Edition, ShopItem } from './types';
import data from '../../content/about.json';
import { assetUrl, existingAssetUrl } from '../lib/assets';
import { youtubeEmbed } from '../lib/youtube';

// content/about.json holds one block per category (accordion), each with its own
// title, visible switch and content; `order` lists the category keys top to bottom.

/** Accordion — VZW Greenforward. */
export const greenforward: AboutBlock[] = data.greenforward.blocks as AboutBlock[];

/** Accordion — Socio-environmental initiatives & partnerships. */
export const initiatives: AboutBlock[] = data.initiatives.blocks as AboutBlock[];

// Accordion — Previous editions (year navigator).
export const EDITION_MIN_YEAR: number = data.editions.minYear;
export const EDITION_MAX_YEAR: number = data.editions.maxYear;
export const defaultEditionText: string = data.editions.defaultText;

/** Optional per-edition fields the CMS may or may not have written yet. */
type EditionSource = Omit<(typeof data.editions.items)[number], 'paragraphs'> & {
  paragraphs?: string[];
  video?: string;
  showVideo?: boolean;
  photo?: string;
  showPhoto?: boolean;
};

function toEdition(edition: EditionSource): Edition {
  return {
    year: edition.year,
    // Optional in the CMS: an edition without text shows none.
    paragraphs: edition.paragraphs ?? [],
    poster: existingAssetUrl(edition.poster, `About → Editions → ${edition.year} → Poster`),
    video: edition.showVideo === false ? undefined : youtubeEmbed(edition.video),
    photo: edition.showPhoto === false ? undefined : existingAssetUrl(edition.photo, `About → Editions → ${edition.year} → Group photo`),
  };
}

/** Oldest first, so ‹ / › step to the previous / next year. */
export const editions: Edition[] = data.editions.items.map(toEdition).sort((a, b) => a.year - b.year);

/** Returns the throwback content for a given edition year. */
export function getEdition(year: number): Edition {
  const match = data.editions.items.find((e) => e.year === year);
  return match ? toEdition(match) : { year, paragraphs: [defaultEditionText] };
}

/** Accordion — Irie shop (physical, on-site only). */
export const shop = {
  intro: data.shop.intro,
  items: (data.shop.items as ShopItem[]).map((item) => ({ ...item, image: item.image ? assetUrl(item.image) : undefined })),
};

export type AboutSectionKey = 'greenforward' | 'initiatives' | 'editions' | 'shop' | 'band';
const SECTION_KEYS: AboutSectionKey[] = ['greenforward', 'initiatives', 'editions', 'shop', 'band'];

// Categories in the order the CMS lists them; unknown or repeated keys are ignored and
// any category missing from the list goes last, so none can disappear by accident.
const sectionOrder = [...new Set([...((data.order ?? []) as string[]), ...SECTION_KEYS])].filter(
  (key): key is AboutSectionKey => SECTION_KEYS.includes(key as AboutSectionKey),
);

/** Title, visibility and position (0-based) of each accordion. */
export const aboutSections = Object.fromEntries(
  sectionOrder.map((key, order) => [key, { title: data[key].title, visible: data[key].visible !== false, order }]),
) as Record<AboutSectionKey, { title: string; visible: boolean; order: number }>;

/** Accordion — The Irie Vibes band. */
export const band = {
  text: data.band.text,
  media: ((data.band as { media?: { photo?: string; video?: string; caption?: string }[] }).media ?? [])
    .map((item): BandMedia => ({
      image: item.photo ? assetUrl(item.photo) : undefined,
      video: youtubeEmbed(item.video),
      alt: item.caption || 'The Irie Vibes band',
    }))
    .filter((item) => item.image || item.video),
};
