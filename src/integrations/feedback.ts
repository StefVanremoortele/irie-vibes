import type { AstroIntegration } from 'astro';
import { handleFeedbackRequest } from '../../scripts/feedback-server.mjs';

// Feedback tool: the Shift+F / "Feedback" capture script on every page, the
// /feedback inbox (feedback, changelog and developer notes tabs; /changelog
// redirects there). The API is served by the dev server
// here and by scripts/production.mjs in production (both via
// scripts/feedback-server.mjs).
export default function feedbackIntegration(): AstroIntegration {
  return {
    name: 'irie-vibes-feedback',
    hooks: {
      'astro:config:setup': ({ injectRoute, injectScript }) => {
        injectRoute({ pattern: '/feedback', entrypoint: new URL('../feedback/feedback.astro', import.meta.url).pathname });
        injectRoute({ pattern: '/changelog', entrypoint: new URL('../feedback/changelog.astro', import.meta.url).pathname });
        injectScript('page', `import '/src/feedback/inline-feedback.ts';`);
      },
      'astro:server:setup': ({ server }) => {
        server.middlewares.use((req, res, next) => {
          handleFeedbackRequest(req, res).then((handled) => {
            if (!handled) next();
          }, next);
        });
      },
    },
  };
}
