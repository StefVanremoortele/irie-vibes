import { defineConfig } from 'astro/config';

// Static site. Content lives in src/data (the future CMS schema) and is
// rendered at build time — swap the data source for a headless CMS later
// without touching the templates.
export default defineConfig({
  site: 'https://www.irievibes.be',
  trailingSlash: 'ignore',
  vite: {
    server: {
      allowedHosts: [
        'irie-vibes.concept.vanremoortele.be',
        'steftop-1.xantu-fir.ts.net',
      ],
    },
  },
  build: {
    format: 'directory',
  },
});
