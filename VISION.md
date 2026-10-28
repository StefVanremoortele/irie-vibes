# Website vision — Irie Vibes Roots Festival

> **Draft (2026-10-27, updated the same day with the decisions below), to be confirmed by the maintainer.** Written from the
> site's own content (Greenforward mission, home intro, pages) and how the site
> is run. Items marked *(assumption)* need a yes/no. This document is the
> yardstick for feedback and new features: does a change serve these people and
> these principles?

## Purpose

The festival's own website for **Irie Vibes Roots Festival** (Kortemark, Belgium,
three days in July) and its free opening night **Kortemark Congé**, run by
**VZW Greenforward**. It should:

1. Get people to the festival: dates, line-up, tickets, how to get there, camping.
2. Answer practical questions before and during the festival (opening hours,
   prices, food and drinks, kids, rules), so the organisers get fewer of them.
3. Carry the festival's character: roots reggae and dub soundsystem culture,
   small-scale, family-friendly, ecological, affordable, locally rooted,
   for over 20 years.
4. Show who makes it possible: volunteers, sponsors, partners and the
   North-South initiatives.

## Who uses it

| Audience | What they need |
| --- | --- |
| **Festival-goers** (reggae and dub fans, Belgium and abroad) | Line-up, dates, tickets, travel, camping: quickly, often on a phone. |
| **Families** | Kids corner, free entrance up to 14, safety, rules, facilities. |
| **Local community** (Kortemark) | Kortemark Congé (free opening night), what happens when, the neighbourhood. |
| **Volunteers** | What volunteering involves and how to sign up. |
| **Sponsors and partners** | Visible, correct logos; the organisation's story. |
| **Editors** (Greenforward volunteers, non-technical) | Change all content in the CMS without a developer; saving publishes. |
| **Testers** | Give feedback in context (the Shift+F tool); not shown to visitors. |

## Principles for decisions

- **Practical info first.** Visitors come for answers. Decoration must not push
  key information (dates, tickets, location) down or out of view.
- **Mobile first** *(assumption: most visitors use a phone, certainly on site)*.
  Every layout must work on a small screen; desktop gets the extra space.
- **Editors own the content.** Anything that changes from year to year (texts,
  images, line-up, editions, sponsors, toggles) belongs in the CMS, with clear
  labels. No content hard-coded in templates.
- **One clear way per setting.** CMS options must do something visible; no dead
  or confusing switches.
- **Fast and light.** Static site, small images (uploads are shrunk and
  converted before they're stored, sponsor logos at build), caching that still
  shows CMS changes at once. No heavy scripts for effect alone.
- **Robust content.** A missing or broken image is left out, never shown broken;
  a sponsor without a logo shows as a text tile.
- **Privacy-friendly.** No tracking or ad scripts; privacy-friendly embeds
  (`youtube-nocookie`).
- **Accessible.** Readable contrast, alt texts, keyboard use, respect for
  reduced motion: decorative animation never plays when the visitor's device
  asks for less motion, and editors can switch it off entirely.
- **Festival character, consistent look.** The "Roots Vanguard" design (dark,
  earthy, red/gold/green accents, Anton + Work Sans) across all pages.
- **English** as the site language *(assumption: international audience; the
  organisers and testers write in Dutch)*.

## Decisions so far (2026-10)

Settled through tester feedback; they apply to new work too.

- **Banners:** every page except home shows its banner in one shape (the Where
  banner, 512:67), 4/5 of the page width, centred. The home hero is full width.
- **Header:** the menu and ticket buttons are the same size on every screen,
  growing with the screen between 3.25rem (phones) and 7rem. The record animation,
  the menu button image and the ticket button image are Site settings.
- **CMS layout:** every page has its own entry under Content pages, in the order of
  the site menu, with its own optional hero image (empty or switched off: no banner).
  Settings holds only what applies to the whole site.
- **Shop:** on wide screens text left, images in one column against the right
  edge; on small screens title, image, text.
- **Previous editions:** open on the most recent past edition, newest first; per
  year an optional video and crew photo with show/hide switches. No 5-year jumps.
- **CMS:** every option must do something visible (dead options are hidden);
  uploads max 5 MB after automatic shrinking.

## How feedback shapes the site

Testers send feedback in context (Shift+F, screenshot, *Applies to* this page or
every page). An AI developer turns each new item into three interpretations,
checked against this vision; the tester picks the one they meant by clicking its
card in `/feedback`. Only a chosen interpretation is built; the item then shows
*In progress* with the AI's reading and the commit, and the tester accepts it
(*Done*). When feedback contradicts a principle here, the options say so, and
either the feedback or this document changes, deliberately.

## Not the goal

- Selling tickets or merchandise on the site: tickets go through the external
  ticket shop; the Irie shop is a preview of the physical stand.
- User accounts, comments or a community platform.
- A general Greenforward site: the focus is the festival *(assumption)*.

## Open questions for the maintainer

- Is Dutch (or a bilingual site) wanted for local visitors?
- Is the phone the main device, or do most visitors plan on desktop?
- Should Kortemark Congé get more of its own space, or stay part of the festival site?
