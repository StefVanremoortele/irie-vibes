import type { AboutBlock, BandMedia, Edition, ShopItem } from './types';
import data from '../../content/about.json';
import { assetUrl, existingAssetUrl } from '../lib/assets';
import { youtubeEmbed } from '../lib/youtube';
import { paragraphsHtml } from '../lib/richtext';

// content/about.json holds one block per category (accordion), each with its own
// title, visible switch and content; `order` lists the category keys top to bottom.

/** Accordion — VZW Greenforward. */
export const greenforward: AboutBlock[] = data.greenforward.blocks as AboutBlock[];

/** Accordion — Socio-environmental initiatives & partnerships. */
export const initiatives: AboutBlock[] = data.initiatives.blocks as AboutBlock[];

// Accordion — Previous editions (year navigator).

/** Optional text above the year picker (HTML paragraphs). */
export const editionsIntro: string[] = paragraphsHtml((data.editions as { intro?: string }).intro);

/** Optional per-edition fields the CMS may or may not have written yet. */
type EditionSource = Omit<(typeof data.editions.items)[number], 'year' | 'paragraphs'> & {
  /** A 4-digit year; older saves stored it as a number. */
  year: string | number;
  paragraphs?: string[];
  video?: string;
  showVideo?: boolean;
  photo?: string;
  showPhoto?: boolean;
};

function toEdition(edition: EditionSource): Edition {
  return {
    year: Number(edition.year),
    // Optional in the CMS: an edition without text shows none. Each entry may hold several paragraphs (HTML).
    paragraphs: (edition.paragraphs ?? []).flatMap(paragraphsHtml),
    poster: existingAssetUrl(edition.poster, `About → Editions → ${edition.year} → Poster`),
    video: edition.showVideo === false ? undefined : youtubeEmbed(edition.video),
    photo: edition.showPhoto === false ? undefined : existingAssetUrl(edition.photo, `About → Editions → ${edition.year} → Group photo`),
  };
}

/** Oldest first, so ‹ / › step to the previous / next year. */
export const editions: Edition[] = (data.editions.items as EditionSource[])
  .map(toEdition)
  .filter((edition) => Number.isInteger(edition.year))
  .sort((a, b) => a.year - b.year);

/** Accordion — Irie shop (physical, on-site only). */
export const shop = {
  intro: paragraphsHtml(data.shop.intro),
  items: (data.shop.items as ShopItem[]).map((item) => ({
    ...item,
    description: paragraphsHtml(item.description),
    image: item.image ? assetUrl(item.image) : undefined,
  })),
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
// Each media item is a photo or a video (the CMS asks which when it's added).
type BandMediaSource = { type?: 'photo' | 'video'; photo?: string; video?: string; caption?: string };

export const band = {
  text: paragraphsHtml(data.band.text),
  media: ((data.band as { media?: BandMediaSource[] }).media ?? [])
    .map((item): BandMedia => {
      const isVideo = item.type ? item.type === 'video' : !item.photo;
      return {
        image: isVideo ? undefined : item.photo ? assetUrl(item.photo) : undefined,
        video: isVideo ? youtubeEmbed(item.video) : undefined,
        caption: item.caption?.trim() || undefined,
      };
    })
    .filter((item) => item.image || item.video),
};
