// One-time migration: turn the built-in content (the original export + the
// structural constants that used to live in the .ts data modules) into the
// CMS-editable JSON files under content/. After this runs, content/ is the
// single source of truth that both Astro and Sveltia CMS read/write.
//
// Run from site/:  node scripts/migrate-to-cms.mjs
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const SITE = resolve(here, '..');
const CONTENT = resolve(SITE, 'content');
const source = JSON.parse(readFileSync(resolve(SITE, 'src/data/generated/irie.json'), 'utf8'));

// --- helpers ---------------------------------------------------------------
const toPublic = (p) => (!p ? '' : /^https?:\/\//i.test(p) ? p : '/' + p.replace(/^\/+/, ''));
const slugify = (v) =>
  v.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
function write(rel, obj) {
  const file = resolve(CONTENT, rel);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(obj, null, 2) + '\n', 'utf8');
}

// --- structural constants (previously in the .ts modules) ------------------
const STAGES = [
  { key: 'inner', name: 'Inner Lion', sub: 'Open air stage', color: '#ef4444' },
  { key: 'den', name: 'Lions Den', sub: 'Mainstage', color: '#fabc4d' },
  { key: 'chill', name: 'Chilling Lion', sub: 'Camping bar stage', color: '#22c55e' },
];

const DEFAULT_ACT_DESCRIPTION = [
  'Kickstarting the festival weekend at the legendary Lions Den stage, this act sets the tone with heavy roots vibrations and spiritual dub energy.',
  'Known for their deep organic basslines, authentic Jamaican vintage rhythm sections, and uplifting conscious messages, this performance marks an unmissable moment at Irie Vibes Roots Festival.',
  'Prepare your mind and body for an hour of pure spiritual elevation and sonic meditation under the open skies of Kortemark.',
];

const RAW_DAYS = [
  {
    name: 'Thursday',
    sub: 'Kortemark Congé',
    inner: [],
    den: [
      ['Lions Den Thursday 1', '18:00 - 19:00'],
      ['Lions Den Thursday 2', '19:00 - 20:00'],
      ['Lions Den Thursday 3', '21:00 - 22:00'],
      ['Lions Den Thursday 4', '23:00 - 00:00'],
      ['Lions Den Thursday 5', '00:00 - 01:00'],
    ],
    chill: [['Chilling Lion Thursday 1', '13:00 - 18:00']],
  },
  {
    name: 'Friday',
    sub: '',
    inner: [['Inner Lion Friday 1', '17:00 - 04:00']],
    den: [
      ['Lions Den Friday 1', '18:00 - 20:00'],
      ['Lions Den Friday 2', '20:00 - 23:00'],
      ['Lions Den Friday 3', '23:00 - 02:00'],
      ['Lions Den Friday 4', '02:00 - 04:00'],
    ],
    chill: [['Chilling Lion Friday 1', '11:00 - 18:00']],
  },
  {
    name: 'Saturday',
    sub: '',
    inner: [
      ['Inner Lion Saturday 1', '12:00 - 14:00'],
      ['Inner Lion Saturday 2', '15:00 - 16:30'],
      ['Inner Lion Saturday 3', '17:30 - 19:00'],
      ['Inner Lion Saturday 4', '20:00 - 22:30'],
    ],
    den: [
      ['Lions Den Saturday 1', '14:00 - 15:00'],
      ['Lions Den Saturday 2', '16:30 - 17:30'],
      ['Lions Den Saturday 3', '19:00 - 20:30'],
      ['Lions Den Saturday 4', '22:30 - 00:00'],
      ['Lions Den Saturday 5', '00:00 - 04:00'],
    ],
    chill: [],
  },
];

const PAGE_COPY = {
  when: {
    title: 'When',
    heroKey: 'when',
    blocks: [
      { type: 'p', html: 'Camping opens on <strong>Thursday</strong>, 22 July at ??h??' },
      { type: 'p', html: 'The festival area opens on <strong>Thursday</strong> at 18h with Kortemark Cong, a free entrance festival day. The festival area closes at 1h.' },
      { type: 'p', html: 'On <strong>Friday</strong> the festival area opens at 17h and closes at 4h.' },
      { type: 'p', html: 'On <strong>Saturday</strong> the festival area opens at 12h and closes at 4h.' },
      { type: 'p', html: 'The camping bar at the Chilling Lion stage opens every festival day from ??h?? till ??h??. Breakfast is also served here, from ??h?? till we are out.' },
      { type: 'p', html: 'The camping closes on <strong>Sunday</strong>, 25 July at 14h.' },
    ],
  },
  drinks: {
    title: 'Drinks, foods & market',
    heroKey: 'drinks',
    blocks: [
      { type: 'p', html: '<strong>Drinks</strong> are available at the main- and campingbar and are paid using tokens, available at ?.' },
      { type: 'p', html: 'We offer a wide variety of softdrinks, juices, beers, cocktails, hot drinks, snacks? and more.' },
      { type: 'p', html: 'A broad diversity of <strong>food</strong> is offered at the market by a fine selection foodstands . Payment is cash or electronicly.' },
      { type: 'p', html: 'At the <strong>nonfood</strong> market you can wonder around the clothes, records and jewelry shops, get your dreads done or enjoy the craftmanship.' },
      { type: 'p', html: "At the <strong>Global market</strong>, Kortemark's North-South Initiative highlights organizations that support development in third world countries, promote fair trade, and address the need for sustainable development goals." },
    ],
  },
  kids: {
    title: 'Kids corner',
    heroKey: 'kids',
    blocks: [
      { type: 'p', html: 'Irie Vibes is a family festival. Children up to 14 years old get free entrance.' },
      { type: 'p', html: 'At the kids corner children can discover a magical world filled with toys, arts, games, suprises and entertainment.' },
      { type: 'p', html: 'Kids can enjoy the live bands or take their first steps on the dancefloor safely as childrens noise reducing headphones are available at the infostand for free (security deposit required).' },
      { type: 'p', html: 'Wristbands for lost kids are available at the entrance, the infostand and the kids corner.' },
      { type: 'p', html: 'Woven wristband for your kids are available on Saturday at the infostand' },
    ],
  },
  volunteer: {
    title: 'Volunteer',
    heroKey: 'volunteer',
    blocks: [
      { type: 'p', html: 'Irie Vibes is run by volunteers. They turn an empty meadow into a full festival, do every job during the festival, then cleanup and restore the fields for the cows and horses to return.' },
      { type: 'p', html: '<a href="mailto:info@irievibes.be">Click here to volunteer</a>.' },
    ],
  },
};

// --- 1. site settings ------------------------------------------------------
write('site.json', {
  name: 'Irie Vibes Roots Festival',
  organisation: 'VZW Greenforward',
  datesLabel: '22, 23 & 24 JULY 2027',
  festivalDate: '2027-07-22T18:00:00',
  location: {
    label: 'Koekelarestraat 16, 8610 Kortemark, Belgium',
    query: 'Koekelarestraat 16, 8610 Kortemark, Belgium',
  },
  email: 'info@irievibes.be',
  ticketUrl: 'https://irie-vibes.eventsquare.store/nl/6tkhqowc5ovk/ldpytyyieckh',
  volunteerUrl: 'mailto:info@irievibes.be',
  intro:
    'Irie Vibes Roots Festival brings you the best of live Roots Reggae and Dub soundsystem culture. This multiday, familyfriendly, ecological aware festivety has been creating a cozy, free and joyful place and atmosphere for over 20 years. As free entrance opening night, Kortemark Conge aims to bring the local community together for some quality time with nice music and irie vibes.',
  showCountdown: true,
  showAftermovie: true,
  aftermovie: {
    title: 'Irie Vibes Roots Festival 2026 aftermovie',
    embedUrl: 'https://www.youtube.com/embed/knswTYKdwh0',
  },
  assets: {
    headerBanner: toPublic(source.assets.headerBanner),
    footerBg: toPublic(source.assets.footerBg),
    greenforward: toPublic(source.assets.greenforward),
  },
  nav: [
    { label: 'Home', href: '/' },
    { label: 'Tickets', href: '/tickets' },
    { label: 'Line up', href: '/lineup' },
    { label: 'When', href: '/when' },
    { label: 'Where', href: '/where' },
    { label: 'Parking & Camping', href: '/camping' },
    { label: 'Drinks, Foods & Market', href: '/drinks' },
    { label: 'Kids Corner', href: '/kids' },
    { label: 'Volunteer', href: '/volunteer' },
    { label: 'All About Irie Vibes', href: '/about' },
  ],
  socials: source.assets.socials.map((s) => ({
    label: s.alt,
    href: s.href,
    icon: toPublic(s.src),
  })),
});

// --- 2. media (bespoke-page heroes + shared images) ------------------------
write('media.json', {
  heroes: {
    home: toPublic(source.heroes.home),
    tickets: toPublic(source.heroes.tickets),
    lineup: toPublic(source.heroes.lineup),
    act: toPublic(source.heroes.act),
    where: toPublic(source.heroes.where),
    camping: toPublic(source.heroes.camping),
    about: toPublic(source.heroes.about),
  },
  images: {
    circulatieplan: toPublic(source.images.circulatieplan),
    actPoster: toPublic(source.images.actPoster),
  },
});

// --- 3. line-up config + acts ---------------------------------------------
write('lineup.json', {
  stages: STAGES,
  days: RAW_DAYS.map((d, i) => ({ name: d.name, sub: d.sub, order: i })),
  defaultActDescription: DEFAULT_ACT_DESCRIPTION,
});

// clear any previous act files so removed acts don't linger
rmSync(resolve(CONTENT, 'acts'), { recursive: true, force: true });
for (const day of RAW_DAYS) {
  for (const stage of ['inner', 'den', 'chill']) {
    day[stage].forEach(([name, time], i) => {
      write(`acts/${slugify(name)}.json`, {
        name,
        day: day.name,
        stage,
        time,
        order: i + 1,
      });
    });
  }
}

// --- 4. tickets ------------------------------------------------------------
write('tickets.json', {
  passes: [
    { label: 'Thursday', value: 'Free entrance' },
    { label: 'Friday', value: '50€' },
    { label: 'Saturday', value: '50€' },
    { label: 'Weekend', value: '75€' },
  ],
  passesNote: 'To be paid upon entry',
  campingParking: [
    { label: 'Camping', value: '15€' },
    { label: 'Vehicle fee parking', value: '5€' },
    { label: 'Vehicle fee camping', value: '15€' },
  ],
  ticketNotes: [
    'Free entrance for children up to 14 years old.',
    'Pets are not allowed on the festival area, campings and parkings.',
  ],
});

// --- 5. simple content pages ----------------------------------------------
for (const [slug, page] of Object.entries(PAGE_COPY)) {
  write(`pages/${slug}.json`, {
    slug,
    title: page.title,
    hero: toPublic(source.heroes[page.heroKey]),
    heroSize: 'md',
    blocks: page.blocks,
  });
}

// --- 6. about --------------------------------------------------------------
const mapBlocks = (list) => list.map((b) => ({ type: b.t, text: b.x }));
write('about.json', {
  greenforward: mapBlocks(source.about.greenforward),
  initiatives: mapBlocks(source.about.initiatives),
  shopIntro:
    'Welcome to our physical festival shop. Here is a preview of the official merchandise and exclusive festival souvenirs available on-site at the merchandise stand during festival days. These items are available exclusively in our physical shop on the festival grounds.',
  shop: [
    { name: 'Festival t-shirt', description: '100% organic cotton, screen-printed edition artwork on front and back lineup.' },
    { name: 'Hoodie', description: 'Premium heavy fleece hoodie with kangaroo pocket and embroidered chest badge.' },
    { name: 'Snapback cap', description: 'Adjustable snapback cap with detailed Rasta tri-color Irie Vibes badge.' },
    { name: 'Lanyard & pin', description: 'Woven festival lanyard complete with official metal enamel souvenir pin.' },
  ],
  band: 'Soon to come here.',
  editionMinYear: 2002,
  editionMaxYear: 2025,
  defaultEditionText: 'Throwback text for this edition is on its way.',
  editions: [
    {
      year: 2002,
      poster: toPublic(source.images.poster2002),
      paragraphs: source.about.editions2002,
    },
  ],
});

// --- 7. sponsors (flattened per tier) -------------------------------------
const flat = (rows) =>
  rows.flat().map((s) => (s.src ? { image: toPublic(s.src), alt: s.alt || '' } : { label: s.label, sub: s.sub || '' }));
write('sponsors.json', {
  main: flat(source.sponsorsMain),
  regular: flat(source.sponsorsReg),
});

// --- 8. regulations --------------------------------------------------------
write('regulations.json', { sections: source.regulations });

console.log('Migration complete. Wrote content/ from the original export + structural constants.');
