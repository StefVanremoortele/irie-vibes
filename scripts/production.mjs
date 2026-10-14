// Self-updating production server for a dedicated checkout of this repo.
//
// Serves the static build with `astro preview`, polls the upstream branch
// (where Sveltia CMS commits land), fast-forwards, rebuilds into a staging
// folder, and swaps it in only when the build succeeds. A failed build keeps
// the previous release online.
//
// Env: PORT (4321), HOST (0.0.0.0), PRODUCTION_SYNC_INTERVAL seconds (30).
import { execFile, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { rename, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const run = promisify(execFile);
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const astro = join(root, 'node_modules/.bin/astro');
const port = process.env.PORT || '4321';
const host = process.env.HOST || '0.0.0.0';
const interval = Math.max(5, Number(process.env.PRODUCTION_SYNC_INTERVAL) || 30) * 1000;
const LIVE = 'dist';
const NEXT = '.release-next';
const PREV = '.release-prev';

// Non-interactive git: never hang on a credential prompt.
const gitEnv = {
  ...process.env,
  GIT_TERMINAL_PROMPT: '0',
  GIT_SSH_COMMAND: process.env.GIT_SSH_COMMAND || 'ssh -o BatchMode=yes',
};

function log(message) {
  console.log(`${new Date().toTimeString().slice(0, 8)} [production] ${message}`);
}

async function git(...args) {
  const { stdout } = await run('git', args, { cwd: root, env: gitEnv });
  return stdout.trim();
}

function exec(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: root, stdio: 'inherit' });
    child.on('error', reject);
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${command} ${args.join(' ')} exited with ${code}`))));
  });
}

// ---- Static server -------------------------------------------------------

let server;
let stopping = false;

function startServer() {
  server = spawn(astro, ['preview', '--host', host, '--port', port], { cwd: root, stdio: 'inherit' });
  server.on('exit', (code, signal) => {
    if (stopping) return;
    log(`Server exited (${signal || code}); restarting in 2s.`);
    server = undefined;
    setTimeout(() => !stopping && !server && startServer(), 2000);
  });
}

function stopServer() {
  return new Promise((resolve) => {
    if (!server || server.exitCode !== null) return resolve();
    const current = server;
    stopping = true;
    current.once('exit', () => {
      stopping = false;
      server = undefined;
      resolve();
    });
    current.kill('SIGTERM');
  });
}

// ---- Build & release -----------------------------------------------------

async function build() {
  await rm(join(root, NEXT), { recursive: true, force: true });
  await exec(astro, ['build', '--outDir', NEXT]);
}

async function release() {
  await stopServer();
  await rm(join(root, PREV), { recursive: true, force: true });
  if (existsSync(join(root, LIVE))) await rename(join(root, LIVE), join(root, PREV));
  await rename(join(root, NEXT), join(root, LIVE));
  startServer();
  await rm(join(root, PREV), { recursive: true, force: true });
}

// ---- Upstream sync -------------------------------------------------------

let busy = false;
let lastWarning = '';

function warnOnce(message) {
  if (message !== lastWarning) log(`WARNING: ${message}`);
  lastWarning = message;
}

async function sync() {
  if (busy) return;
  busy = true;
  try {
    const upstream = await git('rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}');
    const [remote, ...branch] = upstream.split('/');
    await git('fetch', '--quiet', remote, branch.join('/'));
    const [ahead, behind] = (await git('rev-list', '--left-right', '--count', `HEAD...${upstream}`)).split(/\s+/).map(Number);
    if (!behind) return;
    if (ahead) return warnOnce(`Checkout has diverged from ${upstream} (${ahead} ahead, ${behind} behind); fix it by hand.`);

    const before = await git('rev-parse', 'HEAD');
    await git('merge', '--ff-only', '--quiet', upstream);
    lastWarning = '';
    const changed = (await git('diff', '--name-only', before, 'HEAD')).split('\n');
    log(`Pulled ${behind} commit(s):\n  ${(await git('log', '--format=%h %s', `${before}..HEAD`)).split('\n').join('\n  ')}`);

    if (changed.includes('package-lock.json')) await exec('npm', ['ci']);
    if (changed.includes('scripts/production.mjs')) warnOnce('scripts/production.mjs changed; restart this process to use the new version.');

    log('Building…');
    await build();
    await release();
    log(`Released ${(await git('rev-parse', '--short', 'HEAD'))}.`);
  } catch (error) {
    warnOnce(`Sync/build failed, still serving the previous release: ${error.stderr?.trim() || error.message}`);
  } finally {
    busy = false;
  }
}

// ---- Main ----------------------------------------------------------------

async function shutdown() {
  log('Shutting down.');
  await stopServer();
  stopping = true;
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

if (!existsSync(astro)) await exec('npm', ['ci']);
log('Initial build…');
try {
  await build();
  await release();
} catch (error) {
  if (!existsSync(join(root, LIVE))) throw error;
  log(`WARNING: initial build failed, serving the existing ${LIVE}/: ${error.message}`);
  startServer();
}
log(`Serving on http://${host}:${port}, checking upstream every ${interval / 1000}s.`);
setInterval(sync, interval);
