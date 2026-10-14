import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { AstroIntegration, AstroIntegrationLogger } from 'astro';

const run = promisify(execFile);
const DEFAULT_INTERVAL_SECONDS = 30;

// Non-interactive git: never block the dev server on a credential prompt.
const GIT_ENV = {
  ...process.env,
  GIT_TERMINAL_PROMPT: '0',
  GIT_SSH_COMMAND: process.env.GIT_SSH_COMMAND || 'ssh -o BatchMode=yes',
};

async function git(cwd: string, ...args: string[]) {
  const { stdout } = await run('git', args, { cwd, env: GIT_ENV });
  return stdout.trim();
}

function intervalSeconds() {
  const raw = process.env.CONTENT_SYNC_INTERVAL;
  if (raw === undefined || raw === '') return DEFAULT_INTERVAL_SECONDS;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : DEFAULT_INTERVAL_SECONDS;
}

// Fast-forwards the checked-out branch when its upstream (e.g. Sveltia CMS
// commits on origin/main) moves ahead. Never merges, rebases, or touches a
// diverged branch; Vite's file watcher then hot-reloads the changed content.
function startSync(cwd: string, logger: AstroIntegrationLogger, seconds: number) {
  let running = false;
  let lastWarning = '';

  const warnOnce = (message: string) => {
    if (message !== lastWarning) logger.warn(message);
    lastWarning = message;
  };

  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const upstream = await git(cwd, 'rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}').catch(() => '');
      if (!upstream) return warnOnce('Current branch has no upstream; content sync paused.');
      const [remote, ...rest] = upstream.split('/');
      await git(cwd, 'fetch', '--quiet', remote, rest.join('/'));

      const [ahead, behind] = (await git(cwd, 'rev-list', '--left-right', '--count', `HEAD...${upstream}`))
        .split(/\s+/)
        .map(Number);
      if (!behind) {
        lastWarning = '';
        return;
      }
      if (ahead) return warnOnce(`Local branch has diverged from ${upstream} (${ahead} ahead, ${behind} behind); pull manually.`);

      await git(cwd, 'merge', '--ff-only', '--quiet', upstream);
      lastWarning = '';
      const subjects = await git(cwd, 'log', '--format=%s', `-${behind}`);
      logger.info(`Pulled ${behind} commit(s) from ${upstream}:\n  ${subjects.split('\n').join('\n  ')}`);
    } catch (error) {
      const detail = (error as { stderr?: string }).stderr?.trim() || (error as Error).message;
      warnOnce(`Content sync failed: ${detail}`);
    } finally {
      running = false;
    }
  };

  logger.info(`Syncing with upstream every ${seconds}s (CONTENT_SYNC_INTERVAL=0 to disable).`);
  void tick();
  return setInterval(tick, seconds * 1000);
}

export default function contentSyncIntegration(): AstroIntegration {
  let timer: ReturnType<typeof setInterval> | undefined;
  return {
    name: 'irie-vibes-dev-content-sync',
    hooks: {
      'astro:server:setup': ({ logger }) => {
        const seconds = intervalSeconds();
        if (!seconds) return;
        timer = startSync(process.cwd(), logger, seconds);
      },
      'astro:server:done': () => {
        if (timer) clearInterval(timer);
        timer = undefined;
      },
    },
  };
}
