// Extracts the `window.IRIE` content object from the original export
// (docs/site-data.js) into a plain JSON file. This keeps the verbatim
// festival/camping regulations, "All about Irie Vibes" copy and the full
// sponsor lists faithful to the source instead of hand-retyping them.
//
// Run from the `site/` directory:  node scripts/extract-content.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(here, '../../docs/site-data.js');
const OUT = resolve(here, '../src/data/generated/irie.json');

const raw = readFileSync(SRC, 'utf8');

// The file is exactly: window.IRIE = { ...pure JSON... };
const start = raw.indexOf('{');
const end = raw.lastIndexOf('}');
if (start === -1 || end === -1) {
  throw new Error('Could not locate the IRIE object literal in site-data.js');
}
const json = raw.slice(start, end + 1);
const data = JSON.parse(json); // throws if the source is not clean JSON

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(data, null, 2) + '\n', 'utf8');

console.log(`Wrote ${OUT}`);
console.log(
  `Sections: ${Object.keys(data).join(', ')}\n` +
    `sponsorsMain rows: ${data.sponsorsMain?.length}, ` +
    `sponsorsReg rows: ${data.sponsorsReg?.length}, ` +
    `regulations sections: ${data.regulations?.length}`,
);
