// Feedback storage and HTTP API, shared by the Astro dev server
// (src/integrations/feedback.ts) and the production server (production.mjs).
//
// Entries are stored outside the repository as one JSON file per entry plus
// an images/<id>/ folder, with a regenerated index.md for quick reading.
//
// Env: FEEDBACK_DIR (default ~/sources/repos/stef/irie-vibes-feedback).
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { extname, join, resolve, sep } from 'node:path';

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_IMAGES = 10;
const MAX_BODY_BYTES = 25 * 1024 * 1024;
const STATUSES = ['New', 'In progress', 'Done'];
const ENTRY_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
// All feedback is anonymous: every entry is stored and shown under this name.
export const PSEUDONYM = 'Jah a the Creator';
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

async function listEntries(dir) {
  await mkdir(dir, { recursive: true });
  const names = await readdir(dir, { withFileTypes: true });
  const entries = [];
  for (const file of names) {
    if (!file.isFile() || !file.name.endsWith('.json')) continue;
    try {
      entries.push(JSON.parse(await readFile(join(dir, file.name), 'utf8')));
    } catch {
      // Ignore an incomplete or manually removed entry file.
    }
  }
  return entries.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

async function regenerateIndex(dir) {
  const entries = await listEntries(dir);
  const lines = ['# Website feedback', '', `Updated: ${new Date().toISOString()}`, ''];
  if (!entries.length) lines.push('No feedback yet.');
  for (const entry of entries) {
    lines.push(`## ${entry.status} — ${PSEUDONYM} — ${entry.createdAt}`);
    if (entry.page) lines.push(`Page: ${entry.page}`);
    lines.push('', entry.message, '');
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
  return join(dir, `${id}.json`);
}

async function readEntry(file) {
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch {
    throw new HttpError(404, 'Feedback entry not found.');
  }
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
  const entry = {
    id,
    name: PSEUDONYM,
    page: fields.page?.trim().slice(0, 500) || '',
    message,
    status: 'New',
    createdAt: new Date().toISOString(),
    images: storedImages,
    ...(metadata ? { metadata } : {}),
  };
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, `${id}.json`), `${JSON.stringify(entry, null, 2)}\n`, 'utf8');
  await regenerateIndex(dir);
  return entry;
}

async function handleApi(req, res, path) {
  const dir = feedbackDir();
  if (path === '/__feedback/api/entries') {
    if (req.method === 'GET') return send(res, 200, { entries: await listEntries(dir) });
    if (req.method === 'POST') return send(res, 201, { entry: await createEntry(req, dir) });
    throw new HttpError(405, 'Method not allowed.');
  }

  const statusMatch = path.match(/^\/__feedback\/api\/entries\/([^/]+)\/status$/);
  if (statusMatch && req.method === 'PATCH') {
    const file = entryFile(dir, statusMatch[1]);
    let payload;
    try {
      payload = JSON.parse((await readRequest(req)).toString('utf8'));
    } catch {
      throw new HttpError(400, 'Invalid JSON.');
    }
    if (!STATUSES.includes(payload?.status)) throw new HttpError(400, 'Invalid status.');
    const entry = await readEntry(file);
    entry.status = payload.status;
    await writeFile(file, `${JSON.stringify(entry, null, 2)}\n`, 'utf8');
    await regenerateIndex(dir);
    return send(res, 200, { entry });
  }

  const deleteMatch = path.match(/^\/__feedback\/api\/entries\/([^/]+)$/);
  if (deleteMatch && req.method === 'DELETE') {
    const file = entryFile(dir, deleteMatch[1]);
    const entry = await readEntry(file);
    await rm(file);
    await rm(join(dir, 'images', entry.id), { recursive: true, force: true });
    await regenerateIndex(dir);
    return send(res, 200, { deleted: entry.id });
  }

  throw new HttpError(404, 'Not found.');
}

async function serveImage(res, path) {
  const match = path.match(/^\/__feedback\/images\/([a-f0-9-]+)\/([^/]+)$/);
  if (!match || !ENTRY_ID.test(match[1])) throw new HttpError(404, 'Image not found.');
  const root = resolve(feedbackDir(), 'images', match[1]);
  const file = resolve(root, decodeURIComponent(match[2]));
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
