// ---------------------------------------------------------------------------
// Content model / schema for the Irie Vibes Roots Festival site.
//
// Every interface here maps 1:1 to a content type in the future headless CMS.
// The templates only ever read from these typed structures, so swapping the
// data source (TS modules -> CMS API) later requires no template changes.
// ---------------------------------------------------------------------------

/** A navigation entry in the header drawer. */
export interface NavItem {
  label: string;
  /** Route path, e.g. "/", "/tickets". */
  href: string;
  /** Off: listed in Site settings but left out of the burger menu (e.g. Regulations). */
  showInMenu?: boolean;
}

/** A social channel shown in the footer. */
export interface Social {
  label: string;
  href: string;
  /** Icon image (public asset path or remote URL). */
  icon: string;
}

/** The three festival stages. */
export type StageKey = 'inner' | 'den' | 'chill';

export interface Stage {
  key: StageKey;
  name: string;
  /** Short descriptor, e.g. "Open air stage". */
  sub: string;
  /** Accent colour used for the stage label. */
  color: string;
}

/** A single performance slot. Doubles as a CMS "act" entry with a detail page. */
export interface Act {
  /** URL slug for the /lineup/[slug] detail page. */
  slug: string;
  name: string;
  /** Human time range, e.g. "18:00 - 19:00". */
  time: string;
  stage: StageKey;
  /** Festival day this act plays, e.g. "Thursday". */
  day: string;
  /** Sort order within its day + stage (1-based). */
  order?: number;
  /** Optional detail-page body copy; absent means no description is shown. */
  description?: string;
  /** Optional artist artwork (public asset path or remote URL). */
  image?: string;
}

export interface LineupDay {
  name: string;
  /** Optional sub-label, e.g. "Kortemark Congé". */
  sub?: string;
  acts: Act[];
}

/**
 * A block of page copy. Either a paragraph (may contain limited inline HTML
 * such as <strong>/<a>) or a heading. Rich enough to stay faithful to the
 * original while mapping onto a CMS rich-text/heading field.
 */
export interface CopyBlock {
  type: 'p' | 'h';
  /** Inline HTML permitted for 'p' blocks (bold, links). */
  html: string;
}

/** A simple content page driven by a hero image and a list of copy blocks. */
export interface ContentPage {
  slug: string;
  title: string;
  /** Undefined when the page has no hero (none chosen, or switched off). */
  hero?: string;
  blocks: CopyBlock[];
}

/** A sponsor logo, or a text-only sponsor when no logo asset exists. */
export interface Sponsor {
  src?: string;
  alt?: string;
  label?: string;
  sub?: string;
}

/** A regulations section (title + ordered paragraph/list items). */
export interface RegulationItem {
  p?: string;
  ul?: string[];
}
export interface RegulationSection {
  title: string;
  items: RegulationItem[];
}

/** One accordion's worth of about-page copy. */
export interface AboutBlock {
  type: 'p' | 'h';
  text: string;
}

/** A previous-edition throwback (keyed by year). */
export interface Edition {
  year: number;
  /** Paragraphs as HTML (see lib/richtext). */
  paragraphs: string[];
  poster?: string;
  /** YouTube embed URL (aftermovie); omitted when empty or switched off. */
  video?: string;
  /** Group photo of the crew; omitted when empty or switched off. */
  photo?: string;
}

/** A photo or YouTube video shown next to the band text. */
export interface BandMedia {
  image?: string;
  /** YouTube embed URL. */
  video?: string;
  /** Shown below a photo, above a video. */
  caption?: string;
}

/** A merchandise item in the festival shop preview. */
export interface ShopItem {
  name: string;
  description: string;
  image?: string;
}
