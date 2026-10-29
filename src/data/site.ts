import type { NavItem, Social } from './types';
import siteData from '../../content/site.json';
import homeData from '../../content/home.json';
import { assetUrl } from '../lib/assets';

const DEFAULT_THEME_COLOR = '#fabc4d';
const SURFACE = '#101510';

/** WCAG relative luminance of a #rrggbb colour. */
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** The CMS theme colour when it's a valid colour other than the default; warns at build when it reads poorly. */
function themeColor(value: string | undefined): string | undefined {
  const color = value?.trim().toLowerCase();
  if (!color || color === DEFAULT_THEME_COLOR) return undefined;
  if (!/^#[0-9a-f]{6}$/.test(color)) {
    console.warn(`[site] Site settings → Theme text colour: "${value}" is not a #rrggbb colour; using the default.`);
    return undefined;
  }
  const contrast = (luminance(color) + 0.05) / (luminance(SURFACE) + 0.05);
  if (contrast < 4.5) console.warn(`[site] Site settings → Theme text colour ${color} has low contrast on the dark background (${contrast.toFixed(1)}:1, needs 4.5:1).`);
  return color;
}

/**
 * Global site configuration — sourced from content/site.json (edited in the
 * CMS as the "Site settings" document).
 */
export const site = {
  name: siteData.name,
  organisation: siteData.organisation,
  location: siteData.location,
  email: siteData.email,
  ticketUrl: siteData.ticketUrl,
  volunteerUrl: siteData.volunteerUrl,
  // Menu button record animation; on unless switched off in the CMS (still respects reduced motion).
  menuAnimation: (siteData as { menuAnimation?: boolean }).menuAnimation !== false,
  // Theme text colour (the gold accent); undefined keeps the design default from tokens.css.
  themeColor: themeColor((siteData as { themeColor?: string }).themeColor),
  assets: {
    headerBanner: assetUrl(siteData.assets.headerBanner),
    footerBg: assetUrl(siteData.assets.footerBg),
    greenforward: assetUrl(siteData.assets.greenforward),
    // Optional: when empty the ticket button shows the "GET YOUR TICKET" text.
    ticketButton: assetUrl((siteData.assets as { ticketButton?: string }).ticketButton),
    // Optional: when set, replaces the record/hamburger icon of the menu button.
    menuButton: assetUrl((siteData.assets as { menuButton?: string }).menuButton),
  },
};

/** Header navigation (drawer), in CMS order; pages switched off for the burger menu are left out. */
export const nav: NavItem[] = (siteData.nav as NavItem[]).filter((item) => item.showInMenu !== false);

/** Paths with a page of their own (src/pages, the feedback tool, built files). */
const BUILT_IN = new Set(['tickets', 'lineup', 'when', 'where', 'camping', 'drinks', 'kids', 'volunteer', 'about', 'regulations', 'admin', 'feedback', 'changelog', 'assets', '404']);

/**
 * Menu links (in menu order, also those hidden from the burger menu) to a page the site doesn't
 * have yet, e.g. "/socials": each becomes a content page (content/pages/<slug>.json, may not exist
 * yet), built by src/pages/[page].astro and listed under Content pages by src/pages/admin/config.yml.ts.
 */
export const menuPages: { slug: string; label: string }[] = [
  ...new Map(
    (siteData.nav as NavItem[]).flatMap((item) => {
      const slug = /^\/([a-z0-9]+(?:-[a-z0-9]+)*)\/?$/.exec(item.href?.trim() ?? '')?.[1];
      return slug && !BUILT_IN.has(slug) ? [[slug, { slug, label: item.label }] as const] : [];
    }),
  ).values(),
];

/** Social channels (footer). */
export const socials: Social[] = siteData.socials.map((s) => ({
  label: s.label,
  href: s.href,
  icon: assetUrl(s.icon),
}));

/** Home page content — content/home.json ("Home" under Content pages in the CMS). */
export const home = {
  datesLabel: homeData.datesLabel,
  festivalDate: homeData.festivalDate,
  intro: homeData.intro,
  showCountdown: homeData.showCountdown,
  showAftermovie: homeData.showAftermovie,
  aftermovie: homeData.aftermovie,
};
