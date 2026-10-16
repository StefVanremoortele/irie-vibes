import type { NavItem, Social } from './types';
import siteData from '../../content/site.json';
import { assetUrl } from '../lib/assets';

/**
 * Global site configuration — sourced from content/site.json (edited in the
 * CMS as the "Site settings" document).
 */
export const site = {
  name: siteData.name,
  organisation: siteData.organisation,
  datesLabel: siteData.datesLabel,
  festivalDate: siteData.festivalDate,
  location: siteData.location,
  email: siteData.email,
  ticketUrl: siteData.ticketUrl,
  volunteerUrl: siteData.volunteerUrl,
  intro: siteData.intro,
  showCountdown: siteData.showCountdown,
  showAftermovie: siteData.showAftermovie,
  aftermovie: siteData.aftermovie,
  assets: {
    headerBanner: assetUrl(siteData.assets.headerBanner),
    footerBg: assetUrl(siteData.assets.footerBg),
    greenforward: assetUrl(siteData.assets.greenforward),
    // Optional: when empty the ticket button shows the "GET YOUR TICKET" text.
    ticketButton: assetUrl((siteData.assets as { ticketButton?: string }).ticketButton),
  },
};

/** Header navigation (drawer). Order matters. */
export const nav: NavItem[] = siteData.nav;

/** Social channels (footer). */
export const socials: Social[] = siteData.socials.map((s) => ({
  label: s.label,
  href: s.href,
  icon: assetUrl(s.icon),
}));
