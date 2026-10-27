import type { AboutBlock, BandMedia, Edition, ShopItem } from './types';
import data from '../../content/about.json';
import { assetUrl } from '../lib/assets';
import { youtubeEmbed } from '../lib/youtube';

/** Accordion 1 — VZW Greenforward. */
export const greenforward: AboutBlock[] = data.greenforward as AboutBlock[];

/** Accordion 2 — Socio-environmental initiatives & partnerships. */
export const initiatives: AboutBlock[] = data.initiatives as AboutBlock[];

// Accordion 3 — Previous editions (year navigator).
export const EDITION_MIN_YEAR: number = data.editionMinYear;
export const EDITION_MAX_YEAR: number = data.editionMaxYear;
export const defaultEditionText: string = data.defaultEditionText;

/** Optional per-edition fields the CMS may or may not have written yet. */
type EditionSource = (typeof data.editions)[number] & {
  video?: string;
  showVideo?: boolean;
  photo?: string;
  showPhoto?: boolean;
};

function toEdition(edition: EditionSource): Edition {
  return {
    year: edition.year,
    paragraphs: edition.paragraphs,
    poster: edition.poster ? assetUrl(edition.poster) : undefined,
    video: edition.showVideo === false ? undefined : youtubeEmbed(edition.video),
    photo: edition.showPhoto === false || !edition.photo ? undefined : assetUrl(edition.photo),
  };
}

export const editions: Edition[] = data.editions.map(toEdition);

/** Returns the throwback content for a given edition year. */
export function getEdition(year: number): Edition {
  const match = data.editions.find((e) => e.year === year);
  return match ? toEdition(match) : { year, paragraphs: [defaultEditionText] };
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
  media: ((data as { bandMedia?: { photo?: string; video?: string; caption?: string }[] }).bandMedia ?? [])
    .map((item): BandMedia => ({
      image: item.photo ? assetUrl(item.photo) : undefined,
      video: youtubeEmbed(item.video),
      alt: item.caption || 'The Irie Vibes band',
    }))
    .filter((item) => item.image || item.video),
};
