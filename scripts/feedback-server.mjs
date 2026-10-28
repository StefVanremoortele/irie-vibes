// Feedback storage and HTTP API, shared by the Astro dev server
// (src/integrations/feedback.ts) and the production server (production.mjs).
//
// Entries are stored outside this (public) repository, in FEEDBACK_DIR: one
// JSON file per entry in entries/, screenshots in images/<id>/, and a
// regenerated index.md for quick reading. Developer notes for testers are in
// notes/*.json. That folder is a clone of the private GitHub repo
// irie-vibes-feedback, which the Sveltia admin at /admin/feedback/ edits
// (feedback status, developer notes, changelog posts in changelog/*.json). With FEEDBACK_GIT_SYNC=1 (production) new
// and deleted entries are committed and pushed, and CMS edits are pulled
// before the list is served.
//
// Which feedback items an AI developer is working on right now ("runners") is
// kept outside git in FEEDBACK_RUNNERS_FILE, shared by the production and dev
// servers: { "runners": [{ "id", "items": ["<short id>"], "label", "startedAt",
// "expiresAt" }] }. The AI writes it when it starts and empties it when done;
// a runner past its expiresAt (or 2 hours after startedAt) no longer counts.
//
// Env: FEEDBACK_DIR (default ~/sources/repos/stef/irie-vibes-feedback),
//      FEEDBACK_GIT_SYNC (1 to commit/push/pull FEEDBACK_DIR),
//      FEEDBACK_RUNNERS_FILE (default ~/.local/state/irie-vibes/runners.json).
import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { extname, join, resolve, sep } from 'node:path';
import { promisify } from 'node:util';
import { micromark } from 'micromark';
import { gfm, gfmHtml } from 'micromark-extension-gfm';

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_IMAGES = 10;
const MAX_BODY_BYTES = 25 * 1024 * 1024;
const MAX_REPLY_LENGTH = 5000;
const ENTRY_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
// All feedback is anonymous: every entry is stored and shown under this name.
export const PSEUDONYM = 'Jah a the Creator';
const PULL_INTERVAL_MS = 15 * 1000;
const IMAGE_TYPES = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.avif': 'image/avif' };

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function feedbackDir() {
  return resolve(process.env.FEEDBACK_DIR || join(process.env.HOME || process.cwd(), 'sources/repos/stef/irie-vibes-feedback'));
}

const RUNNER_TTL_MS = 2 * 60 * 60 * 1000;

function runnersFile() {
  return resolve(process.env.FEEDBACK_RUNNERS_FILE || join(process.env.HOME || process.cwd(), '.local/state/irie-vibes/runners.json'));
}

// AI runners still working on feedback; a missing or unreadable file means none.
async function activeRunners() {
  let data;
  try {
    data = JSON.parse(await readFile(runnersFile(), 'utf8'));
  } catch {
    return [];
  }
  const nowMs = Date.now();
  return (Array.isArray(data?.runners) ? data.runners : [])
    .filter((runner) => {
      const until = Date.parse(runner?.expiresAt) || (Date.parse(runner?.startedAt) || 0) + RUNNER_TTL_MS;
      return until > nowMs;
    })
    .map((runner) => ({
      items: (Array.isArray(runner.items) ? runner.items : []).filter((item) => typeof item === 'string').map((item) => item.slice(0, 36)),
      label: typeof runner.label === 'string' ? runner.label.slice(0, 200) : '',
      startedAt: typeof runner.startedAt === 'string' ? runner.startedAt : '',
    }));
}

function safeFilename(input, fallback) {
  const extension = extname(input).toLowerCase().replace(/[^a-z0-9.]/g, '').slice(0, 10);
  const stem = (input.slice(0, input.length - extname(input).length) || fallback)
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 70) || fallback;
  return `${stem}${extension || '.bin'}`;
}

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

function requestPath(req) {
  return new URL(req.url || '/', 'http://feedback.local').pathname;
}

async function readRequest(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > MAX_BODY_BYTES) throw new HttpError(413, 'Request is too large.');
    chunks.push(buffer);
  }
  return Buffer.concat(chunks);
}

function parseMultipart(body, contentType) {
  const match = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  if (!match) throw new HttpError(400, 'Invalid multipart form.');
  const boundary = Buffer.from(`--${match[1] || match[2]}`);
  const parts = [];
  let cursor = body.indexOf(boundary);
  while (cursor !== -1) {
    const start = cursor + boundary.length;
    if (body.subarray(start, start + 2).toString() === '--') break;
    const contentStart = start + (body.subarray(start, start + 2).toString() === '\r\n' ? 2 : 0);
    const next = body.indexOf(boundary, contentStart);
    if (next === -1) break;
    const part = body.subarray(contentStart, next - (body.subarray(next - 2, next).toString() === '\r\n' ? 2 : 0));
    const headerEnd = part.indexOf('\r\n\r\n');
    if (headerEnd !== -1) {
      const headers = {};
      for (const line of part.subarray(0, headerEnd).toString().split('\r\n')) {
        const separator = line.indexOf(':');
        if (separator > 0) headers[line.slice(0, separator).trim().toLowerCase()] = line.slice(separator + 1).trim();
      }
      parts.push({ headers, data: part.subarray(headerEnd + 4) });
    }
    cursor = next;
  }
  return parts;
}

function disposition(headers) {
  const value = headers['content-disposition'] || '';
  return {
    name: value.match(/name="([^"]+)"/)?.[1] || '',
    filename: value.match(/filename="([^"]*)"/)?.[1] || '',
  };
}

const entriesDir = (dir) => join(dir, 'entries');

// Entries used to live in the folder root; move them into entries/ once.
let layoutReady;
function ensureLayout(dir) {
  layoutReady ??= (async () => {
    await mkdir(entriesDir(dir), { recursive: true });
    for (const file of await readdir(dir, { withFileTypes: true })) {
      if (file.isFile() && ENTRY_ID.test(file.name.replace(/\.json$/, '')) && file.name.endsWith('.json')) {
        const entry = JSON.parse(await readFile(join(dir, file.name), 'utf8'));
        await writeEntry(dir, withScreenshot(entry));
        await rm(join(dir, file.name));
      }
    }
  })();
  return layoutReady;
}

// `screenshot` is the first image as a repo path, for the CMS preview.
function withScreenshot(entry) {
  const first = entry.images?.[0];
  return first ? { ...entry, screenshot: `/images/${entry.id}/${first.name}` } : entry;
}

function writeEntry(dir, entry) {
  return writeFile(join(entriesDir(dir), `${entry.id}.json`), `${JSON.stringify(entry, null, 2)}\n`, 'utf8');
}

async function listEntries(dir) {
  await ensureLayout(dir);
  const entries = [];
  for (const file of await readdir(entriesDir(dir), { withFileTypes: true })) {
    if (!file.isFile() || !file.name.endsWith('.json')) continue;
    try {
      entries.push(JSON.parse(await readFile(join(entriesDir(dir), file.name), 'utf8')));
    } catch {
      // Ignore an incomplete or manually removed entry file.
    }
  }
  return entries.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

// Developer notes (written in the CMS), newest first.
async function listNotes(dir) {
  const notesDir = join(dir, 'notes');
  if (!existsSync(notesDir)) return [];
  const notes = [];
  for (const file of await readdir(notesDir, { withFileTypes: true })) {
    if (!file.isFile() || !file.name.endsWith('.json')) continue;
    try {
      const note = JSON.parse(await readFile(join(notesDir, file.name), 'utf8'));
      if (note && typeof note.message === 'string') notes.push(note);
    } catch {
      // Ignore an incomplete note file.
    }
  }
  return notes.sort((a, b) => (Date.parse(b.date) || 0) - (Date.parse(a.date) || 0));
}

const renderMarkdown = (markdown) => micromark(markdown, { extensions: [gfm()], htmlExtensions: [gfmHtml()] });

// Developer comments are markdown (written in the CMS). The API adds the
// rendered HTML; images pasted in the CMS point at /images/…, which is served
// under /__feedback/images/….
function withCommentHtml(entry) {
  if (!Array.isArray(entry.comments)) return entry;
  return {
    ...entry,
    comments: entry.comments.map((comment) => (typeof comment?.message === 'string'
      ? { ...comment, html: renderMarkdown(comment.message).replace(/(<img src=")\/images\//g, '$1/__feedback/images/') }
      : comment)),
  };
}

// Markdown for one line (a changelog item): no wrapping paragraph.
const renderInline = (markdown) => renderMarkdown(markdown).trim().replace(/^<p>([\s\S]*)<\/p>$/, '$1');

// The changelog: one post per file in changelog/ (written in the CMS: date,
// title, optional status, markdown body, tagged items), newest first; markdown
// is rendered to HTML with raw HTML escaped. The older changelog.json (a list
// of `entries`, or a single markdown `body`, returned as `html`) is still read
// so nothing breaks before it is converted.
async function readChangelog(dir) {
  const posts = [];
  const postsDir = join(dir, 'changelog');
  if (existsSync(postsDir)) {
    for (const file of (await readdir(postsDir, { withFileTypes: true })).sort((a, b) => b.name.localeCompare(a.name))) {
      if (!file.isFile() || !file.name.endsWith('.json')) continue;
      try {
        posts.push(JSON.parse(await readFile(join(postsDir, file.name), 'utf8')));
      } catch {
        // Ignore an incomplete post file.
      }
    }
  }
  let data = {};
  try {
    data = JSON.parse(await readFile(join(dir, 'changelog.json'), 'utf8')) || {};
  } catch {
    // No legacy changelog.
  }
  const entries = [...posts, ...(Array.isArray(data.entries) ? data.entries : [])]
    .filter((entry) => entry && typeof entry.title === 'string')
    .map((entry) => ({
      date: typeof entry.date === 'string' ? entry.date : '',
      title: entry.title,
      ...(typeof entry.status === 'string' && entry.status ? { status: entry.status } : {}),
      html: typeof entry.body === 'string' && entry.body.trim() ? renderMarkdown(entry.body) : '',
      items: (Array.isArray(entry.items) ? entry.items : [])
        .filter((item) => item && (item.title || item.body))
        .map((item) => ({
          tag: typeof item.tag === 'string' ? item.tag : '',
          title: typeof item.title === 'string' ? item.title : '',
          html: typeof item.body === 'string' && item.body.trim() ? renderInline(item.body) : '',
        })),
    }))
    .sort((a, b) => (Date.parse(b.date) || 0) - (Date.parse(a.date) || 0));
  const body = typeof data.body === 'string' ? data.body : '';
  return { entries, html: body.trim() ? renderMarkdown(body) : '' };
}

// ---- Git sync with the private feedback repo (production only) -------------

const run = promisify(execFile);
const gitEnv = { ...process.env, GIT_TERMINAL_PROMPT: '0', GIT_SSH_COMMAND: process.env.GIT_SSH_COMMAND || 'ssh -o BatchMode=yes' };
let gitQueue = Promise.resolve();
let lastPull = 0;

function gitSyncEnabled(dir) {
  return process.env.FEEDBACK_GIT_SYNC === '1' && existsSync(join(dir, '.git'));
}

const git = (dir, ...args) => run('git', args, { cwd: dir, env: gitEnv });

// Git operations run one at a time; a failure is logged and the local files
// keep being served (the next sync retries).
function queueGit(dir, task) {
  const next = gitQueue.then(() => task(dir)).catch((error) => {
    console.error(`[feedback] git sync failed: ${error.stderr?.trim() || error.message}`);
  });
  gitQueue = next;
  return next;
}

async function pull(dir) {
  try {
    await git(dir, 'pull', '--quiet', '--rebase', '--autostash');
  } catch (error) {
    await git(dir, 'rebase', '--abort').catch(() => {});
    throw error;
  }
  lastPull = Date.now();
  await regenerateIndex(dir);
}

async function commitAndPush(dir, message) {
  await git(dir, 'add', '-A');
  const { stdout } = await git(dir, 'status', '--porcelain');
  if (stdout.trim()) await git(dir, 'commit', '--quiet', '-m', message);
  await pull(dir);
  await git(dir, 'push', '--quiet');
}

function publish(dir, message) {
  if (gitSyncEnabled(dir)) void queueGit(dir, (cwd) => commitAndPush(cwd, message));
}

async function pullIfStale(dir) {
  if (!gitSyncEnabled(dir) || Date.now() - lastPull < PULL_INTERVAL_MS) return;
  lastPull = Date.now();
  await queueGit(dir, pull);
}

async function regenerateIndex(dir) {
  const entries = await listEntries(dir);
  const lines = ['# Website feedback', '', `Updated: ${new Date().toISOString()}`, ''];
  if (!entries.length) lines.push('No feedback yet.');
  for (const entry of entries) {
    lines.push(`## ${entry.status} — ${PSEUDONYM} — ${entry.createdAt}`);
    if (entry.page) lines.push(`Page: ${entry.page}${entry.scope === 'site' ? ' (applies to every page)' : ''}`);
    lines.push('', entry.message, '');
    if (Array.isArray(entry.proposals?.options) && entry.proposals.options.length) {
      lines.push('Proposed interpretations:');
      for (const option of entry.proposals.options) {
        const marks = [option.key === entry.proposals.recommended ? 'recommended' : '', option.key === entry.proposals.chosen ? '**chosen**' : ''].filter(Boolean).join(', ');
        lines.push(`- **${option.key}. ${option.title}**${marks ? ` (${marks})` : ''}: ${option.interpretation}`);
      }
      lines.push('');
    }
    if (entry.interpretation?.text) {
      lines.push(`> **AI interpretation** (${entry.interpretation.by || 'AI'}${entry.interpretation.commit ? `, fixed in ${entry.interpretation.commit}` : ''}):`, ...entry.interpretation.text.split('\n').map((line) => `> ${line}`), '');
    }
    for (const comment of entry.comments || []) {
      lines.push(`> **${comment.author || 'Developer'}** (${comment.date}):`, ...comment.message.split('\n').map((line) => `> ${line.replace(/\]\(\/images\//g, '](./images/')}`), '');
    }
    if (entry.images.length) {
      lines.push('Images:');
      for (const image of entry.images) lines.push(`- [${image.name}](./images/${entry.id}/${image.name})`);
      lines.push('');
    }
  }
  await writeFile(join(dir, 'index.md'), `${lines.join('\n')}\n`, 'utf8');
}

function entryFile(dir, id) {
  if (!ENTRY_ID.test(id)) throw new HttpError(400, 'Invalid feedback id.');
  return join(entriesDir(dir), `${id}.json`);
}

async function readEntry(file) {
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch {
    throw new HttpError(404, 'Feedback entry not found.');
  }
}

// Embeds (YouTube videos, maps) that were on screen; the screenshot can't show them.
function parseEmbed(embed) {
  if (!embed || !['youtube', 'map', 'iframe'].includes(embed.kind) || typeof embed.url !== 'string' || !/^https?:\/\//.test(embed.url)) return [];
  return [{
    kind: embed.kind,
    url: embed.url.slice(0, 500),
    ...(typeof embed.title === 'string' && embed.title ? { title: embed.title.slice(0, 200) } : {}),
    ...(embed.rect ? { rect: embed.rect } : {}),
  }];
}

function parseMetadata(raw) {
  if (!raw) return undefined;
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new HttpError(400, 'Invalid feedback metadata.');
  }
  if (!parsed || !parsed.viewport || !parsed.scroll || typeof parsed.userAgent !== 'string') return undefined;
  return {
    viewport: parsed.viewport,
    ...(parsed.region ? { region: parsed.region } : {}),
    scroll: parsed.scroll,
    userAgent: parsed.userAgent.slice(0, 500),
    ...(Array.isArray(parsed.embeds) && parsed.embeds.length ? { embeds: parsed.embeds.slice(0, 10).flatMap(parseEmbed) } : {}),
    ...(parsed.screenshotFailed ? { screenshotFailed: true } : {}),
  };
}

async function createEntry(req, dir) {
  const parts = parseMultipart(await readRequest(req), req.headers['content-type'] || '');
  const fields = {};
  const images = [];
  for (const part of parts) {
    const info = disposition(part.headers);
    if (info.name === 'images' && info.filename) images.push({ filename: info.filename, type: part.headers['content-type'] || '', data: part.data });
    else if (info.name) fields[info.name] = part.data.toString('utf8');
  }
  const message = fields.message?.trim().slice(0, 10000) || '';
  if (!message) throw new HttpError(400, 'Message is required.');
  if (images.length > MAX_IMAGES) throw new HttpError(400, `You can attach up to ${MAX_IMAGES} images.`);
  if (images.some((image) => !image.type.startsWith('image/'))) throw new HttpError(400, 'Only image files are allowed.');
  if (images.some((image) => image.data.length > MAX_IMAGE_BYTES)) throw new HttpError(400, 'Each image must be 10 MB or smaller.');
  const metadata = parseMetadata(fields.metadata);

  const id = randomUUID();
  const storedImages = [];
  if (images.length) await mkdir(join(dir, 'images', id), { recursive: true });
  for (const [index, image] of images.entries()) {
    const filename = safeFilename(image.filename, `image-${index + 1}`);
    await writeFile(join(dir, 'images', id, filename), image.data);
    storedImages.push({ name: filename, type: image.type, url: `/__feedback/images/${id}/${encodeURIComponent(filename)}` });
  }
  const entry = withScreenshot({
    id,
    name: PSEUDONYM,
    page: fields.page?.trim().slice(0, 500) || '',
    ...(fields.scope === 'site' || fields.scope === 'page' ? { scope: fields.scope } : {}),
    message,
    status: 'New',
    createdAt: new Date().toISOString(),
    images: storedImages,
    ...(metadata ? { metadata } : {}),
  });
  await ensureLayout(dir);
  await writeEntry(dir, entry);
  await regenerateIndex(dir);
  publish(dir, `New feedback: ${message.split('\n')[0].slice(0, 60)}`);
  return entry;
}

async function readJson(req) {
  try {
    return JSON.parse((await readRequest(req)).toString('utf8') || '{}');
  } catch {
    throw new HttpError(400, 'Invalid JSON body.');
  }
}

// Seconds precision, like the CMS datetime fields.
const now = () => new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');

// Tester actions on an existing entry (reply, accept). CMS edits are pulled
// first and the entry is re-read, so a status or comment edit made in the
// admin isn't overwritten.
async function updateEntry(dir, id, change, message) {
  const file = entryFile(dir, id);
  if (gitSyncEnabled(dir)) await queueGit(dir, pull);
  const updated = change(await readEntry(file));
  await writeEntry(dir, updated);
  await regenerateIndex(dir);
  publish(dir, message);
  return withCommentHtml(updated);
}

// A tester's reply joins the developer comments, under the pseudonym.
async function addReply(req, dir, id) {
  const { message } = await readJson(req);
  const text = typeof message === 'string' ? message.trim().slice(0, MAX_REPLY_LENGTH) : '';
  if (!text) throw new HttpError(400, 'Reply is required.');
  return updateEntry(dir, id, (entry) => ({
    ...entry,
    comments: [...(Array.isArray(entry.comments) ? entry.comments : []), { date: now(), author: PSEUDONYM, message: text }],
  }), `Reply on feedback: ${text.split('\n')[0].slice(0, 60)}`);
}

// A tester picks up a new item: it moves to In progress.
async function markInProgress(dir, id) {
  return updateEntry(dir, id, (entry) => {
    if (entry.status !== 'New') throw new HttpError(409, 'Only new feedback can be marked in progress.');
    return { ...entry, status: 'In progress' };
  }, `Mark feedback in progress: ${id}`);
}

// The tester confirms a change that is In progress: it moves to Done.
async function acceptChange(dir, id) {
  return updateEntry(dir, id, (entry) => {
    if (entry.status !== 'In progress') throw new HttpError(409, 'Only changes that are in progress can be accepted.');
    return { ...entry, status: 'Done', acceptedAt: now() };
  }, `Accept feedback: ${id}`);
}

// The tester picks which of the AI's proposed interpretations (entry.proposals,
// written by the feedback-triage skill) matches what they meant. Can be changed
// or cleared (`option: null`) until work starts (status New).
async function chooseProposal(req, dir, id) {
  const { option } = await readJson(req);
  return updateEntry(dir, id, (entry) => {
    const options = Array.isArray(entry.proposals?.options) ? entry.proposals.options : [];
    if (!options.length) throw new HttpError(400, 'This feedback has no proposals.');
    if (option !== null && !options.some((item) => item.key === option)) throw new HttpError(400, 'Unknown option.');
    if (entry.status !== 'New') throw new HttpError(409, 'Work on this item has started; the choice can no longer change.');
    if (option === null) {
      const { chosen, chosenAt, ...proposals } = entry.proposals || {};
      return { ...entry, proposals };
    }
    return { ...entry, proposals: { ...entry.proposals, chosen: option, chosenAt: now() } };
  }, option === null ? `Clear interpretation choice for feedback: ${id}` : `Choose interpretation ${option} for feedback: ${id}`);
}

async function handleApi(req, res, path) {
  const dir = feedbackDir();
  if (path === '/__feedback/api/changelog') {
    if (req.method !== 'GET') throw new HttpError(405, 'Method not allowed.');
    await pullIfStale(dir);
    return send(res, 200, await readChangelog(dir));
  }
  if (path === '/__feedback/api/runners') {
    if (req.method !== 'GET') throw new HttpError(405, 'Method not allowed.');
    return send(res, 200, { runners: await activeRunners() });
  }
  if (path === '/__feedback/api/notes') {
    if (req.method !== 'GET') throw new HttpError(405, 'Method not allowed.');
    await pullIfStale(dir);
    return send(res, 200, { notes: await listNotes(dir) });
  }
  if (path === '/__feedback/api/entries') {
    if (req.method === 'GET') {
      await pullIfStale(dir);
      return send(res, 200, { entries: (await listEntries(dir)).map(withCommentHtml) });
    }
    if (req.method === 'POST') return send(res, 201, { entry: await createEntry(req, dir) });
    throw new HttpError(405, 'Method not allowed.');
  }

  const actionMatch = path.match(/^\/__feedback\/api\/entries\/([^/]+)\/(replies|accept|progress|choose)$/);
  if (actionMatch) {
    if (req.method !== 'POST') throw new HttpError(405, 'Method not allowed.');
    const [, id, action] = actionMatch;
    const entry = action === 'replies' ? await addReply(req, dir, id)
      : action === 'accept' ? await acceptChange(dir, id)
        : action === 'choose' ? await chooseProposal(req, dir, id)
          : await markInProgress(dir, id);
    return send(res, 200, { entry });
  }

  const deleteMatch = path.match(/^\/__feedback\/api\/entries\/([^/]+)$/);
  if (deleteMatch && req.method === 'DELETE') {
    const file = entryFile(dir, deleteMatch[1]);
    const entry = await readEntry(file);
    await rm(file);
    await rm(join(dir, 'images', entry.id), { recursive: true, force: true });
    await regenerateIndex(dir);
    publish(dir, `Delete feedback: ${entry.message.split('\n')[0].slice(0, 60)}`);
    return send(res, 200, { deleted: entry.id });
  }

  throw new HttpError(404, 'Not found.');
}

// Entry images live in images/<entry id>/. Images pasted into developer
// comments in the CMS land directly in images/ (the CMS media folder; older
// ones in images/comments/). Only image files are served.
async function serveImage(res, path) {
  const match = path.match(/^\/__feedback\/images\/(?:([a-z0-9-]+)\/)?([^/]+)$/i);
  if (!match || (match[1] && !ENTRY_ID.test(match[1]) && match[1] !== 'comments')) throw new HttpError(404, 'Image not found.');
  const root = resolve(feedbackDir(), 'images', ...(match[1] ? [match[1]] : []));
  const file = resolve(root, decodeURIComponent(match[2]));
  if (!IMAGE_TYPES[extname(file).toLowerCase()]) throw new HttpError(404, 'Image not found.');
  if (!file.startsWith(`${root}${sep}`)) throw new HttpError(400, 'Invalid image path.');
  let data;
  try {
    data = await readFile(file);
  } catch {
    throw new HttpError(404, 'Image not found.');
  }
  res.statusCode = 200;
  res.setHeader('Content-Type', IMAGE_TYPES[extname(file).toLowerCase()] || 'application/octet-stream');
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.end(data);
}

// Handles /__feedback/api/* and /__feedback/images/*. Resolves to false for
// any other path so the caller can pass the request on.
export async function handleFeedbackRequest(req, res) {
  const path = requestPath(req);
  if (!path.startsWith('/__feedback/api/') && !path.startsWith('/__feedback/images/')) return false;
  try {
    if (path.startsWith('/__feedback/images/')) await serveImage(res, path);
    else await handleApi(req, res, path);
  } catch (error) {
    if (!(error instanceof HttpError)) console.error('[feedback]', error);
    if (!res.headersSent) send(res, error instanceof HttpError ? error.status : 500, { error: error instanceof HttpError ? error.message : 'Feedback service error.' });
  }
  return true;
}
