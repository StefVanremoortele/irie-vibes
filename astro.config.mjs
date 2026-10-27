import { defineConfig } from 'astro/config';
import contentSyncIntegration from './src/integrations/content-sync';
import feedbackIntegration from './src/integrations/feedback';
import sponsorLogosIntegration from './src/integrations/sponsor-logos';

// Static site. Content lives in src/data (the future CMS schema) and is
// rendered at build time — swap the data source for a headless CMS later
// without touching the templates.
export default defineConfig({
  integrations: [feedbackIntegration(), contentSyncIntegration(), sponsorLogosIntegration()],
  site: 'https://www.irievibes.be',
  trailingSlash: 'ignore',
  // Public preview hostnames, for both `astro dev` and `astro preview`.
  server: {
    allowedHosts: [
      'irie-vibes.concept.vanremoortele.be',
      'steftop-1.xantu-fir.ts.net',
    ],
  },
  build: {
    format: 'directory',
  },
  // Pre-bundle the feedback screenshot library so its first use in dev doesn't
  // trigger a dependency re-optimisation and full page reload.
  vite: {
    optimizeDeps: { include: ['modern-screenshot'] },
  },
});
