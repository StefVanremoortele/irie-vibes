import { randomUUID } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { extname, join, resolve, sep } from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { AstroIntegration } from 'astro';
import type { ViteDevServer } from 'vite';

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_IMAGES = 10;
const MAX_BODY_BYTES = 110 * 1024 * 1024;
const STATUSES = ['New', 'In progress', 'Done'] as const;
type FeedbackStatus = (typeof STATUSES)[number];

interface FeedbackImage {
  name: string;
  url: string;
  type: string;
}

interface FeedbackEntry {
  id: string;
  name: string;
  page: string;
  message: string;
  status: FeedbackStatus;
  createdAt: string;
  images: FeedbackImage[];
}

interface MultipartPart {
  headers: Record<string, string>;
  data: Buffer;
}

function feedbackDir() {
  return resolve(process.env.FEEDBACK_DIR || join(process.env.HOME || process.cwd(), 'sources/repos/stef/irie-vibes-feedback'));
}

function safeFilename(input: string, fallback: string) {
  const extension = extname(input).toLowerCase().replace(/[^a-z0-9.]/g, '').slice(0, 10);
  const stem = (input.slice(0, input.length - extname(input).length) || fallback)
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 70) || fallback;
  return `${stem}${extension || '.bin'}`;
}

function send(res: ServerResponse, status: number, body: unknown, type = 'application/json') {
  const payload = typeof body === 'string' ? body : JSON.stringify(body);
  res.statusCode = status;
  res.setHeader('Content-Type', `${type}; charset=utf-8`);
  res.setHeader('Cache-Control', 'no-store');
  res.end(payload);
}

function requestPath(req: IncomingMessage) {
  return new URL(req.url || '/', 'http://feedback.local').pathname;
}

async function readRequest(req: IncomingMessage) {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > MAX_BODY_BYTES) throw new Error('Request is too large.');
    chunks.push(buffer);
  }
  return Buffer.concat(chunks);
}

function parseMultipart(body: Buffer, contentType: string): MultipartPart[] {
  const match = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  if (!match) throw new Error('Invalid multipart form.');
  const boundary = Buffer.from(`--${match[1] || match[2]}`);
  const parts: MultipartPart[] = [];
  let cursor = body.indexOf(boundary);
  while (cursor !== -1) {
    const start = cursor + boundary.length;
    if (body.slice(start, start + 2).toString() === '--') break;
    const contentStart = start + (body.slice(start, start + 2).toString() === '\r\n' ? 2 : 0);
    const next = body.indexOf(boundary, contentStart);
    if (next === -1) break;
    const part = body.slice(contentStart, next - (body.slice(next - 2, next).toString() === '\r\n' ? 2 : 0));
    const headerEnd = part.indexOf('\r\n\r\n');
    if (headerEnd !== -1) {
      const headers: Record<string, string> = {};
      for (const line of part.slice(0, headerEnd).toString().split('\r\n')) {
        const separator = line.indexOf(':');
        if (separator > 0) headers[line.slice(0, separator).trim().toLowerCase()] = line.slice(separator + 1).trim();
      }
      parts.push({ headers, data: part.slice(headerEnd + 4) });
    }
    cursor = next;
  }
  return parts;
}

function disposition(headers: Record<string, string>) {
  const value = headers['content-disposition'] || '';
  return {
    name: value.match(/name="([^"]+)"/)?.[1] || '',
    filename: value.match(/filename="([^"]*)"/)?.[1] || '',
  };
}

async function listEntries(dir: string) {
  await mkdir(dir, { recursive: true });
  const names = await readdir(dir, { withFileTypes: true });
  const entries: FeedbackEntry[] = [];
  for (const file of names) {
    if (!file.isFile() || !file.name.endsWith('.json') || file.name === 'index.json') continue;
    try {
      entries.push(JSON.parse(await readFile(join(dir, file.name), 'utf8')));
    } catch {
      // Ignore an incomplete or manually removed entry file.
    }
  }
  return entries.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

async function regenerateIndex(dir: string) {
  const entries = await listEntries(dir);
  const lines = ['# Website feedback', '', `Updated: ${new Date().toISOString()}`, ''];
  if (!entries.length) lines.push('No feedback yet.');
  for (const entry of entries) {
    lines.push(`## ${entry.status} — ${entry.name} — ${entry.createdAt}`);
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

async function handleApi(req: IncomingMessage, res: ServerResponse) {
  const path = requestPath(req);
  const dir = feedbackDir();
  try {
    if (req.method === 'GET' && path === '/__feedback/api/entries') {
      return send(res, 200, { entries: await listEntries(dir) });
    }

    const statusMatch = path.match(/^\/__feedback\/api\/entries\/([a-f0-9-]+)\/status$/);
    if (req.method === 'PATCH' && statusMatch) {
      const payload = JSON.parse((await readRequest(req)).toString('utf8')) as { status?: string };
      if (!STATUSES.includes(payload.status as FeedbackStatus)) return send(res, 400, { error: 'Invalid status.' });
      const file = join(dir, `${statusMatch[1]}.json`);
      const entry = JSON.parse(await readFile(file, 'utf8')) as FeedbackEntry;
      entry.status = payload.status as FeedbackStatus;
      await writeFile(file, `${JSON.stringify(entry, null, 2)}\n`, 'utf8');
      await regenerateIndex(dir);
      return send(res, 200, { entry });
    }

    if (req.method === 'POST' && path === '/__feedback/api/entries') {
      const parts = parseMultipart(await readRequest(req), req.headers['content-type'] || '');
      const fields: Record<string, string> = {};
      const images: Array<{ filename: string; type: string; data: Buffer }> = [];
      for (const part of parts) {
        const info = disposition(part.headers);
        if (info.name === 'images' && info.filename) images.push({ filename: info.filename, type: part.headers['content-type'] || '', data: part.data });
        else if (info.name) fields[info.name] = part.data.toString('utf8');
      }
      const name = fields.name?.trim().slice(0, 120) || 'Anonymous';
      const page = fields.page?.trim().slice(0, 500) || '';
      const message = fields.message?.trim().slice(0, 10000) || '';
      if (!message) return send(res, 400, { error: 'Message is required.' });
      if (images.length > MAX_IMAGES) return send(res, 400, { error: `You can attach up to ${MAX_IMAGES} images.` });
      if (images.some((image) => !image.type.startsWith('image/'))) return send(res, 400, { error: 'Only image files are allowed.' });
      if (images.some((image) => image.data.length > MAX_IMAGE_BYTES)) return send(res, 400, { error: 'Each image must be 10 MB or smaller.' });

      const id = randomUUID();
      const imageDir = join(dir, 'images', id);
      await mkdir(imageDir, { recursive: true });
      const storedImages: FeedbackImage[] = [];
      for (const [index, image] of images.entries()) {
        const filename = safeFilename(image.filename, `image-${index + 1}`);
        await writeFile(join(imageDir, filename), image.data);
        storedImages.push({ name: filename, type: image.type, url: `/__feedback/images/${id}/${encodeURIComponent(filename)}` });
      }
      const entry: FeedbackEntry = { id, name, page, message, status: 'New', createdAt: new Date().toISOString(), images: storedImages };
      await mkdir(dir, { recursive: true });
      await writeFile(join(dir, `${id}.json`), `${JSON.stringify(entry, null, 2)}\n`, 'utf8');
      await regenerateIndex(dir);
      return send(res, 201, { entry });
    }

    return false;
  } catch (error) {
    console.error('[feedback]', error);
    return send(res, 500, { error: error instanceof Error ? error.message : 'Feedback service error.' });
  }
}

async function serveImage(req: IncomingMessage, res: ServerResponse): Promise<boolean | void> {
  const path = requestPath(req);
  const match = path.match(/^\/__feedback\/images\/([a-f0-9-]+)\/(.+)$/);
  if (!match) return false;
  const root = resolve(feedbackDir(), 'images', match[1]);
  const file = resolve(root, decodeURIComponent(match[2]));
  if (file !== root && !file.startsWith(`${root}${sep}`)) return send(res, 400, { error: 'Invalid image path.' });
  try {
    const data = await readFile(file);
    res.statusCode = 200;
    res.setHeader('Content-Type', 'image/*');
    res.setHeader('Cache-Control', 'no-store');
    res.end(data);
  } catch {
    send(res, 404, { error: 'Image not found.' });
  }
}

function middleware(server: ViteDevServer) {
  server.middlewares.use((req, res, next) => {
    const path = requestPath(req);
    if (path.startsWith('/__feedback/api/')) {
      void handleApi(req, res).then((handled) => { if (handled === false) next(); });
      return;
    }
    if (path.startsWith('/__feedback/images/')) {
      void serveImage(req, res).then((handled) => { if (handled === false) next(); });
      return;
    }
    next();
  });
}

export default function feedbackIntegration(): AstroIntegration {
  return {
    name: 'irie-vibes-dev-feedback',
    hooks: {
      'astro:config:setup': ({ command, injectRoute }) => {
        if (command !== 'dev') return;
        injectRoute({ pattern: '/feedback', entrypoint: new URL('../dev/feedback.astro', import.meta.url).pathname });
      },
      'astro:server:setup': ({ server }) => middleware(server),
    },
  };
}
