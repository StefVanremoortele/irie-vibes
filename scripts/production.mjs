// Self-updating production server for a dedicated checkout of this repo.
//
// A small front server on PORT answers GitHub push webhooks at
// `POST /__deploy`, serves the feedback API under `/__feedback/`, and proxies
// every other request to `astro preview`, which
// serves the static build on an internal port. A push (e.g. a Sveltia CMS
// save) triggers an immediate fast-forward + rebuild into a staging folder;
// the release is swapped in only when the build succeeds, so a failed build
// keeps the previous release online. A slow periodic check catches pushes
// missed while the host was offline.
//
// Env: PORT (4321), HOST (0.0.0.0), PREVIEW_PORT (4331),
//      PRODUCTION_SYNC_INTERVAL seconds (300),
//      PRODUCTION_PREVIEW (1; 0 when a web server such as nginx serves dist/
//      itself and only forwards /__deploy and /__feedback/ here),
//      DEPLOY_WEBHOOK_SECRET (GitHub webhook secret; webhook disabled if unset),
//      FEEDBACK_DIR (feedback storage, see feedback-server.mjs).
import { execFile, spawn } from 'node:child_process';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readdir, readFile, rename, rm, stat, utimes } from 'node:fs/promises';
import { createServer, request } from 'node:http';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { handleFeedbackRequest } from './feedback-server.mjs';

const run = promisify(execFile);
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const astro = join(root, 'node_modules/.bin/astro');
const port = Number(process.env.PORT || 4321);
const host = process.env.HOST || '0.0.0.0';
const previewPort = Number(process.env.PREVIEW_PORT || 4331);
const usePreview = process.env.PRODUCTION_PREVIEW !== '0';
const interval = Math.max(5, Number(process.env.PRODUCTION_SYNC_INTERVAL) || 300) * 1000;
const webhookSecret = process.env.DEPLOY_WEBHOOK_SECRET || '';
const WEBHOOK_PATH = '/__deploy';
const MAX_WEBHOOK_BYTES = 5 * 1024 * 1024;
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

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ---- Static server (internal) ---------------------------------------------

let preview;
let stopping = false;

function startPreview() {
  if (!usePreview) return;
  preview = spawn(astro, ['preview', '--host', '127.0.0.1', '--port', String(previewPort)], { cwd: root, stdio: 'inherit' });
  preview.on('exit', (code, signal) => {
    if (stopping) return;
    log(`Static server exited (${signal || code}); restarting in 2s.`);
    preview = undefined;
    setTimeout(() => !stopping && !preview && startPreview(), 2000);
  });
}

function stopPreview() {
  return new Promise((resolve) => {
    if (!preview || preview.exitCode !== null) return resolve();
    const current = preview;
    stopping = true;
    current.once('exit', () => {
      stopping = false;
      preview = undefined;
      resolve();
    });
    current.kill('SIGTERM');
  });
}

// ---- Build & release -----------------------------------------------------

async function build() {
  await rm(join(root, NEXT), { recursive: true, force: true });
  await exec(astro, ['build', '--outDir', NEXT]);
  await keepUnchangedDates(join(root, NEXT), join(root, LIVE));
}

// Every build writes every file anew, so nginx's ETag/Last-Modified (mtime + size)
// would change on each deploy and browsers re-download everything. Files whose
// content didn't change keep the live release's modification time instead, so
// revalidation answers 304 and only really changed files are fetched again.
async function keepUnchangedDates(nextDir, liveDir) {
  if (!existsSync(liveDir)) return;
  const entries = await readdir(nextDir, { recursive: true, withFileTypes: true });
  await Promise.all(entries.filter((entry) => entry.isFile()).map(async (entry) => {
    const next = join(entry.parentPath, entry.name);
    const live = join(liveDir, next.slice(nextDir.length));
    try {
      const [liveStat, nextStat] = await Promise.all([stat(live), stat(next)]);
      if (liveStat.size !== nextStat.size) return;
      const [a, b] = await Promise.all([readFile(live), readFile(next)]);
      if (a.equals(b)) await utimes(next, liveStat.atime, liveStat.mtime);
    } catch {
      // New file (no live copy): keeps its fresh date.
    }
  }));
}

async function release() {
  await stopPreview();
  await rm(join(root, PREV), { recursive: true, force: true });
  if (existsSync(join(root, LIVE))) await rename(join(root, LIVE), join(root, PREV));
  await rename(join(root, NEXT), join(root, LIVE));
  startPreview();
  await rm(join(root, PREV), { recursive: true, force: true });
}

// ---- Upstream sync -------------------------------------------------------

let busy = false;
let pending = false;
let lastWarning = '';

function warnOnce(message) {
  if (message !== lastWarning) log(`WARNING: ${message}`);
  lastWarning = message;
}

function upstreamRef() {
  return git('rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}');
}

// Runs one sync. A request that arrives mid-sync queues exactly one re-run,
// so a push landing during a build is never dropped.
async function sync(reason) {
  if (busy) {
    pending = true;
    return;
  }
  busy = true;
  try {
    const upstream = await upstreamRef();
    const [remote, ...branch] = upstream.split('/');
    await git('fetch', '--quiet', remote, branch.join('/'));
    const [ahead, behind] = (await git('rev-list', '--left-right', '--count', `HEAD...${upstream}`)).split(/\s+/).map(Number);
    if (!behind) return;
    if (ahead) return warnOnce(`Checkout has diverged from ${upstream} (${ahead} ahead, ${behind} behind); fix it by hand.`);

    const before = await git('rev-parse', 'HEAD');
    await git('merge', '--ff-only', '--quiet', upstream);
    lastWarning = '';
    const changed = (await git('diff', '--name-only', before, 'HEAD')).split('\n');
    log(`Pulled ${behind} commit(s) (${reason}):\n  ${(await git('log', '--format=%h %s', `${before}..HEAD`)).split('\n').join('\n  ')}`);

    if (changed.includes('package-lock.json')) await exec('npm', ['ci']);
    const serverScripts = changed.filter((file) => file === 'scripts/production.mjs' || file === 'scripts/feedback-server.mjs');
    if (serverScripts.length) warnOnce(`${serverScripts.join(' and ')} changed; restart this process to use the new version.`);

    log('Building…');
    await build();
    await release();
    log(`Released ${await git('rev-parse', '--short', 'HEAD')}.`);
  } catch (error) {
    warnOnce(`Sync/build failed, still serving the previous release: ${error.stderr?.trim() || error.message}`);
  } finally {
    busy = false;
    if (pending) {
      pending = false;
      void sync('queued');
    }
  }
}

// ---- GitHub webhook ------------------------------------------------------

function respond(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(body);
}

function validSignature(body, header) {
  if (typeof header !== 'string' || !header.startsWith('sha256=')) return false;
  const expected = Buffer.from(`sha256=${createHmac('sha256', webhookSecret).update(body).digest('hex')}`);
  const actual = Buffer.from(header);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

async function handleWebhook(req, res) {
  if (!webhookSecret) return respond(res, 404, 'Not found');
  if (req.method !== 'POST') return respond(res, 405, 'Method not allowed');

  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_WEBHOOK_BYTES) return respond(res, 413, 'Payload too large');
    chunks.push(chunk);
  }
  const body = Buffer.concat(chunks);
  if (!validSignature(body, req.headers['x-hub-signature-256'])) {
    log('Rejected webhook with an invalid signature.');
    return respond(res, 401, 'Invalid signature');
  }

  const event = req.headers['x-github-event'];
  if (event === 'ping') return respond(res, 200, 'pong');
  if (event !== 'push') return respond(res, 202, `Ignored ${event} event`);

  let ref;
  try {
    ref = JSON.parse(body.toString('utf8')).ref;
  } catch {
    return respond(res, 400, 'Invalid JSON');
  }
  const branch = (await upstreamRef().catch(() => '')).split('/').slice(1).join('/');
  if (ref !== `refs/heads/${branch}`) return respond(res, 202, `Ignored ${ref}`);

  respond(res, 202, 'Deploy queued');
  void sync(`webhook ${req.headers['x-github-delivery'] || ''}`.trim());
}

// ---- Public front server -------------------------------------------------

// Proxies to the internal static server. While it restarts during a release,
// GET/HEAD requests are retried briefly so visitors see a short wait, not an error.
function proxy(req, res, attempt = 0) {
  const upstream = request(
    { host: '127.0.0.1', port: previewPort, method: req.method, path: req.url, headers: req.headers },
    (upstreamRes) => {
      res.writeHead(upstreamRes.statusCode || 502, upstreamRes.headers);
      upstreamRes.pipe(res);
    },
  );
  upstream.on('error', async (error) => {
    const idempotent = req.method === 'GET' || req.method === 'HEAD';
    if (idempotent && error.code === 'ECONNREFUSED' && attempt < 40 && !res.headersSent) {
      await delay(250);
      return proxy(req, res, attempt + 1);
    }
    if (!res.headersSent) respond(res, 502, 'Bad gateway');
    else res.destroy();
  });
  if (attempt === 0) req.pipe(upstream);
  else upstream.end();
}

const front = createServer((req, res) => {
  if (new URL(req.url || '/', 'http://localhost').pathname === WEBHOOK_PATH) {
    handleWebhook(req, res).catch((error) => {
      log(`Webhook error: ${error.message}`);
      if (!res.headersSent) respond(res, 500, 'Webhook error');
    });
    return;
  }
  handleFeedbackRequest(req, res).then(
    (handled) => handled || (usePreview ? proxy(req, res) : respond(res, 404, 'Not found')),
    (error) => {
      log(`Feedback error: ${error.message}`);
      if (!res.headersSent) respond(res, 500, 'Feedback error');
    },
  );
});

// ---- Main ----------------------------------------------------------------

async function shutdown() {
  log('Shutting down.');
  front.close();
  await stopPreview();
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
  startPreview();
}
front.listen(port, host, () => {
  log(`Serving on http://${host}:${port}, checking upstream every ${interval / 1000}s.`);
  log(webhookSecret ? `Deploy webhook enabled at POST ${WEBHOOK_PATH}.` : 'DEPLOY_WEBHOOK_SECRET not set; deploy webhook disabled.');
});
void sync('startup');
setInterval(() => sync('periodic check'), interval);
