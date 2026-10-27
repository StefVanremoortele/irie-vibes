import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AstroIntegration } from 'astro';
import sharp from 'sharp';

// Sponsor logos are shown at most 80px tall, but the CMS stores whatever was
// uploaded (often several hundred pixels and up to ~90 KB each). After each build
// this shrinks the copies in dist/assets/sponsors to 2x the display height
// (sharp for retina). The source files in public/ are left untouched, and file
// names (and so their URLs and fingerprints) stay the same.
const MAX_HEIGHT = 160;
const FORMATS = /\.(png|jpe?g|webp)$/i;

export default function sponsorLogosIntegration(): AstroIntegration {
  return {
    name: 'irie:sponsor-logos',
    hooks: {
      'astro:build:done': async ({ dir, logger }) => {
        const folder = join(fileURLToPath(dir), 'assets', 'sponsors');
        const files = (await readdir(folder).catch(() => [])).filter((name) => FORMATS.test(name));
        let before = 0;
        let after = 0;
        for (const name of files) {
          const file = join(folder, name);
          const input = await readFile(file);
          before += input.length;
          try {
            const image = sharp(input);
            const { height = 0, format } = await image.metadata();
            if (height <= MAX_HEIGHT) { after += input.length; continue; }
            const resized = image.resize({ height: MAX_HEIGHT, withoutEnlargement: true });
            const output = await (format === 'png'
              ? resized.png({ compressionLevel: 9, palette: true, quality: 90 })
              : format === 'webp'
                ? resized.webp({ quality: 85 })
                : resized.jpeg({ quality: 85, mozjpeg: true })
            ).toBuffer();
            // Keep the original when re-encoding doesn't help.
            const best = output.length < input.length ? output : input;
            if (best === output) await writeFile(file, output);
            after += best.length;
          } catch (error) {
            after += input.length;
            logger.warn(`Could not shrink ${name}: ${error instanceof Error ? error.message : error}`);
          }
        }
        if (files.length) logger.info(`Sponsor logos: ${files.length} files, ${Math.round(before / 1024)} KB → ${Math.round(after / 1024)} KB`);
      },
    },
  };
}
