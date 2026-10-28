// Puts the previous editions in content/about.json in year order, newest first,
// so editors see them chronologically in the CMS whatever order they were added in.
// Writes the file only when the order changes, in the CMS's own JSON format.
// Run by .github/workflows/sort-editions.yml after a CMS save; also safe to run by hand.
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const file = join(dirname(fileURLToPath(import.meta.url)), '../content/about.json');
const raw = await readFile(file, 'utf8');
const data = JSON.parse(raw);
const items = data.editions?.items ?? [];
const sorted = [...items].sort((a, b) => (Number(b.year) || 0) - (Number(a.year) || 0));

if (sorted.every((item, i) => item === items[i])) {
  console.log('Previous editions already in order.');
} else {
  data.editions.items = sorted;
  await writeFile(file, `${JSON.stringify(data, null, 2)}\n`);
  console.log(`Sorted previous editions: ${sorted.map((item) => item.year).join(', ')}`);
}
