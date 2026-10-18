// Feedback capture, injected into every page by the feedback integration.
// Open it with the "Feedback" button or Shift+F, drag over (or click) the
// page, and send a comment with a screenshot of the selected area. The UI
// lives in a shadow root (see `css` below).
//
// The screenshot of the visible viewport starts rendering the moment feedback
// mode opens, so it is usually ready by the time the user finishes drawing.

import { MANIFEST_TEXT, MANIFEST_TITLE, PSEUDONYM } from './manifest';
import { createEdgeLight, EDGE_CSS } from './edge-light';

type Region = { x: number; y: number; width: number; height: number };
type Embed = { kind: 'youtube' | 'map' | 'iframe'; url: string; title?: string; rect: Region };

const UI_ATTR = 'data-feedback-ui';
const FONTS_URL = 'https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500&family=Inter+Tight:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap';

// The tool's own look (teal brand, Pane tokens; see README "Feedback tool"),
// independent of the site design system. Everything lives in a shadow root,
// so the site's styles can't reach it and its styles can't leak out.
const css = `
  :host {
    all: initial;
    --ink-900: #1a1b26; --ink-700: #2e2f3e; --ink-500: #5b5c6e; --ink-400: #8b8c9e; --ink-300: #b8b9c8;
    --divider: rgba(26, 27, 38, .10);
    --brand-700: #0f766e; --brand-800: #115e59; --brand-50: #f0fdfa; --brand-300: #5eead4;
    --scrim: rgba(10, 18, 14, .6);
    --shadow-sm: 0 1px 2px rgba(26, 27, 38, .04), 0 2px 8px rgba(26, 27, 38, .06);
    --shadow-xl: 0 8px 16px rgba(26, 27, 38, .06), 0 40px 80px rgba(26, 27, 38, .16);
    --shadow-focus: 0 0 0 3px rgba(15, 118, 110, .35);
    --ease-smooth: cubic-bezier(.32, .72, 0, 1); --ease-spring: cubic-bezier(.34, 1.56, .64, 1);
    --font-display: 'Fraunces', Georgia, serif;
    --font-body: 'Inter Tight', 'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
    --font-mono: 'JetBrains Mono', ui-monospace, Menlo, Consolas, monospace;
    color: var(--ink-700); font: 400 15px/1.45 var(--font-body); -webkit-font-smoothing: antialiased;
  }
  *, *::before, *::after { box-sizing: border-box; }
  button, input, textarea { font: inherit; color: inherit; }
  :focus-visible { outline: none; box-shadow: var(--shadow-focus); }
  svg { flex: none; fill: none; stroke: currentColor; stroke-width: 1.75; stroke-linecap: round; stroke-linejoin: round; }
  [hidden] { display: none !important; }
  .fb-mono { display: inline-grid; place-items: center; flex: none; width: 18px; height: 18px; padding-bottom: 1px; border-radius: 5px; background: #fff; color: var(--brand-700); font: 400 13px/1 var(--font-display); }
  .fb-mono--dark { width: 26px; height: 26px; border-radius: 50%; background: var(--ink-900); color: #fff; font-size: 15px; }
  .fb-mono--brand { width: 24px; height: 24px; border-radius: 7px; background: var(--brand-700); color: #fff; font-size: 16px; }
  .fb-pill { position: fixed; left: 12px; bottom: 12px; z-index: 2147483000; display: inline-flex; align-items: center; gap: 8px; height: 34px; padding: 0 14px 0 8px; border: 1px solid var(--divider); border-radius: 999px; background: rgba(255, 255, 255, .95); color: var(--ink-700); font-size: 13px; font-weight: 600; cursor: pointer; box-shadow: var(--shadow-sm); opacity: .9; transition: opacity .14s, color .14s, border-color .14s, transform .14s var(--ease-spring); }
  .fb-pill .fb-mono { background: var(--brand-700); color: #fff; }
  .fb-pill:hover { opacity: 1; color: var(--brand-700); border-color: var(--brand-300); }
  .fb-pill:active { transform: scale(.97); }
  .fb-overlay { position: fixed; inset: 0; z-index: 2147483600; cursor: crosshair; touch-action: none; }
  .fb-overlay.is-selected { cursor: default; pointer-events: none; }
  /* Dims and blurs the page while capturing; a clip-path cuts the selection out so it stays sharp.
     Without backdrop-filter support it is just the dim colour. */
  .fb-scrim { position: absolute; inset: 0; background: var(--scrim); -webkit-backdrop-filter: blur(12px) saturate(140%); backdrop-filter: blur(12px) saturate(140%); pointer-events: none; }
  .fb-selection { position: fixed; display: none; border: 1px dashed rgba(167, 243, 208, .55); border-radius: 2px; pointer-events: none; }
  .fb-corner { position: absolute; z-index: 2; width: 26px; height: 26px; border: 0 solid #5eead4; }
  .fb-corner:nth-of-type(1) { top: -3px; left: -3px; border-width: 3px 0 0 3px; }
  .fb-corner:nth-of-type(2) { top: -3px; right: -3px; border-width: 3px 3px 0 0; }
  .fb-corner:nth-of-type(3) { bottom: -3px; left: -3px; border-width: 0 0 3px 3px; }
  .fb-corner:nth-of-type(4) { right: -3px; bottom: -3px; border-width: 0 3px 3px 0; }
  .fb-label { position: absolute; top: -40px; left: 0; z-index: 2; display: flex; align-items: center; gap: 8px; height: 28px; padding: 0 10px 0 6px; border-radius: 8px; background: var(--brand-700); color: #fff; font-size: 13px; font-weight: 600; white-space: nowrap; }
  .fb-label.is-inside { top: 8px; left: 8px; }
  .fb-label__size { color: rgba(255, 255, 255, .7); font: 500 11px var(--font-mono); }
  .fb-hint { position: fixed; left: 12px; bottom: 12px; z-index: 2147483601; display: flex; flex-wrap: wrap; align-items: center; gap: 2px 8px; max-width: calc(100vw - 24px); padding: 6px 16px 6px 6px; border-radius: 22px; background: rgba(255, 255, 255, .96); box-shadow: var(--shadow-xl); color: var(--ink-700); cursor: default; font-size: 13px; }
  .fb-hint strong { color: var(--ink-900); font-weight: 600; }
  .fb-hint button { padding: 0; border: 0; background: none; color: var(--brand-700); font-weight: 600; text-decoration: underline; text-underline-offset: 2px; cursor: pointer; }
  kbd { padding: 1px 6px; border: 1px solid var(--divider); border-radius: 6px; background: #fff; color: var(--ink-700); font: 500 11px/1.5 var(--font-mono); }
  .fb-panel { position: fixed; top: 12px; right: 12px; z-index: 2147483602; display: flex; flex-direction: column; gap: 12px; width: min(380px, calc(100vw - 24px)); max-height: calc(100dvh - 24px); overflow-y: auto; overscroll-behavior: contain; padding: 16px; border-radius: 14px; background: #fff; box-shadow: 0 0 0 1px rgba(26, 27, 38, .06), var(--shadow-xl); animation: fb-enter .42s var(--ease-smooth); }
  .fb-panel.is-left { right: auto; left: 12px; }
  @keyframes fb-enter { from { opacity: 0; transform: translateY(8px); } }
  .fb-panel__head { display: flex; align-items: center; gap: 10px; }
  .fb-panel__title { margin: 0; color: var(--ink-900); font: 600 16px/1.3 var(--font-body); }
  .fb-close { display: grid; place-items: center; width: 28px; height: 28px; flex: none; margin-left: auto; padding: 0; border: 0; border-radius: 8px; background: none; color: var(--ink-500); font-size: 18px; line-height: 1; cursor: pointer; transition: background .14s, color .14s; }
  .fb-close:hover { background: rgba(26, 27, 38, .05); color: var(--ink-900); }
  .fb-shot { display: grid; place-items: center; height: 140px; flex: none; overflow: hidden; border-radius: 10px; background: rgba(26, 27, 38, .05); color: var(--ink-400); font-size: 13px; text-align: center; }
  .fb-shot img { width: 100%; height: 100%; object-fit: contain; }
  .fb-spinner { width: 18px; height: 18px; border: 2px solid rgba(26, 27, 38, .1); border-top-color: var(--brand-700); border-radius: 50%; animation: fb-spin .8s linear infinite; }
  @keyframes fb-spin { to { transform: rotate(360deg); } }
  .fb-field { display: grid; gap: 6px; color: var(--ink-900); font-size: 14px; font-weight: 600; }
  .fb-field textarea { width: 100%; min-height: 96px; padding: 10px 12px; border: 1px solid var(--divider); border-radius: 10px; background: #fff; color: var(--ink-900); font-size: 15px; font-weight: 400; line-height: 1.45; resize: vertical; transition: border-color .14s, box-shadow .14s; }
  .fb-field textarea::placeholder { color: var(--ink-400); }
  .fb-field textarea:focus { outline: none; border-color: var(--brand-300); box-shadow: var(--shadow-focus); }
  .fb-as { margin: 0; color: var(--ink-500); font-size: 13px; }
  .fb-jah { padding: 0; border: 0; background: none; color: var(--ink-900); font: inherit; font-weight: 600; text-decoration: underline dotted; text-underline-offset: 3px; cursor: pointer; }
  .fb-jah:hover, .fb-jah[aria-expanded="true"] { text-decoration-style: solid; }
  .fb-manifest { margin: 0; padding: 10px 12px; border-radius: 10px; background: var(--ink-900); color: rgba(255, 255, 255, .85); font-size: 13px; line-height: 1.5; }
  .fb-manifest strong { display: block; margin-bottom: 2px; color: #fff; font-weight: 600; }
  .fb-actions { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .fb-actions small { color: var(--ink-400); font-size: 12px; }
  .fb-submit { height: 36px; padding: 0 16px; border: 0; border-radius: 10px; background: var(--brand-700); color: #fff; font-size: 14px; font-weight: 600; cursor: pointer; transition: background .14s, transform .14s var(--ease-spring); }
  .fb-submit:hover { background: var(--brand-800); }
  .fb-submit:active { transform: scale(.97); }
  .fb-submit:disabled { opacity: .6; cursor: progress; }
  .fb-status { margin: 0; color: #b91c1c; font-size: 13px; }
  .fb-status:empty { display: none; }
  .fb-toast { position: fixed; left: 50%; bottom: 16px; z-index: 2147483603; display: flex; align-items: center; gap: 8px; transform: translateX(-50%); max-width: calc(100vw - 24px); padding: 8px 14px 8px 8px; border-radius: 999px; background: #fff; box-shadow: var(--shadow-xl); color: var(--ink-700); font-size: 14px; animation: fb-enter .42s var(--ease-smooth); }
  .fb-toast .fb-mono { background: var(--brand-700); color: #fff; }
  .fb-toast a { color: var(--brand-700); font-weight: 600; }
  @media (prefers-reduced-motion: reduce) {
    .fb-panel, .fb-toast { animation-name: fb-fade; }
    @keyframes fb-fade { from { opacity: 0; } }
    * { transition-duration: 0s !important; }
  }
  @media (max-width: 640px) {
    .fb-pill { left: 8px; bottom: 8px; }
    .fb-hint { left: 8px; right: 8px; bottom: 8px; }
    .fb-panel, .fb-panel.is-left { top: auto; right: 0; bottom: 0; left: 0; width: 100%; max-height: 85dvh; border-radius: 14px 14px 0 0; padding-bottom: max(16px, env(safe-area-inset-bottom)); }
    .fb-shot { height: 96px; }
  }
  ${EDGE_CSS}
`;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, props: Record<string, unknown> = {}, ...children: (Node | string)[]): HTMLElementTagNameMap[K] {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children);
  return node;
}

const loadScreenshotLib = () => import('modern-screenshot');

const YOUTUBE_EMBED = /^https?:\/\/(?:www\.)?youtube(?:-nocookie)?\.com\/embed\/([\w-]+)/;

function youtubeId(src: string) {
  return YOUTUBE_EMBED.exec(src)?.[1];
}

// Embeds visible in the viewport, sent with the feedback so the inbox shows
// what was on screen even where the screenshot can't.
function visibleEmbeds(): Embed[] {
  return [...document.querySelectorAll('iframe')].flatMap((frame) => {
    const src = frame.src;
    if (!frame.getAttribute('src') || !/^https?:/.test(src)) return [];
    const { x, y, width, height } = frame.getBoundingClientRect();
    if (!width || !height || x + width <= 0 || y + height <= 0 || x >= innerWidth || y >= innerHeight) return [];
    const id = youtubeId(src);
    const kind = id ? 'youtube' : /google\.[^/]+\/maps/.test(src) ? 'map' : 'iframe';
    return [{
      kind,
      url: id ? `https://www.youtube.com/watch?v=${id}` : src,
      ...(frame.title ? { title: frame.title } : {}),
      rect: { x, y, width, height },
    }];
  });
}

// Cross-origin iframes (YouTube, Google Maps) can't be rendered into the
// screenshot and come out blank. Each cloned iframe is swapped for a box of
// the same size: the video's thumbnail for YouTube, a labelled panel
// otherwise. The library inlines the thumbnail after this runs.
function replaceEmbeds(clone: Node, sources: HTMLIFrameElement[]) {
  if (!(clone instanceof Element)) return;
  clone.querySelectorAll('iframe').forEach((cloned, index) => {
    const source = sources[index];
    if (!source || source.getAttribute('src') !== cloned.getAttribute('src')) return;
    const display = getComputedStyle(source).display;
    if (display === 'none') return;
    const box = document.createElement('div');
    for (const name of ['class', 'style']) {
      const value = cloned.getAttribute(name);
      if (value !== null) box.setAttribute(name, value);
    }
    Object.assign(box.style, {
      display: display === 'inline' ? 'inline-block' : display,
      boxSizing: 'border-box',
      width: `${source.offsetWidth}px`,
      height: `${source.offsetHeight}px`,
      position: ['absolute', 'fixed', 'sticky'].includes(box.style.position) ? box.style.position : 'relative',
      overflow: 'hidden',
      background: '#000',
    });
    const id = youtubeId(source.src);
    if (id) box.style.background = `#000 url("https://i.ytimg.com/vi/${id}/hqdefault.jpg") center / cover no-repeat`;
    const label = document.createElement('span');
    label.textContent = id ? '▶ YouTube video' : `Embedded ${/google\.[^/]+\/maps/.test(source.src) ? 'map' : 'content'}`;
    Object.assign(label.style, {
      position: 'absolute', left: '8px', bottom: '8px', padding: '3px 8px', borderRadius: '6px',
      background: '#000c', color: '#fff', font: '600 12px/1.3 system-ui, sans-serif',
    });
    box.append(label);
    cloned.replaceWith(box);
  });
}

// Renders the visible viewport only: the body is shifted up by the scroll
// offset so fixed elements (header) and the visible content line up as on
// screen. The feedback UI and the Astro dev toolbar are left out.
async function captureViewport() {
  const { domToCanvas } = await loadScreenshotLib();
  const frames = [...document.body.querySelectorAll('iframe')];
  return domToCanvas(document.body, {
    width: document.documentElement.clientWidth,
    height: innerHeight,
    scale: Math.min(devicePixelRatio || 1, 2),
    style: { marginTop: `${-scrollY}px`, marginLeft: `${-scrollX}px` },
    // Lazy images below the fold never load, and the library waits for every
    // <img> in the page up to `timeout` (default 30s): skip unloaded images and
    // keep the wait short. Visible images are already in the browser cache.
    filter: (node) => !(node instanceof Element) || (
      !node.hasAttribute(UI_ATTR)
      && node.localName !== 'astro-dev-toolbar'
      && !(node instanceof HTMLImageElement && (!node.complete || !node.naturalWidth))
    ),
    onCloneNode: (clone) => replaceEmbeds(clone, frames),
    timeout: 1000,
  });
}

// The public gateway rejects request bodies over ~1 MB, so screenshots are
// sent as WebP (JPEG where unsupported), downscaled until they fit.
const MAX_SCREENSHOT_BYTES = 700 * 1024;

function encode(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not encode screenshot.'))), type, quality));
}

async function cropToBlob(source: HTMLCanvasElement, region: Region) {
  const scale = source.width / document.documentElement.clientWidth;
  const sx = Math.round(region.x * scale);
  const sy = Math.round(region.y * scale);
  const sw = Math.max(1, Math.round(region.width * scale));
  const sh = Math.max(1, Math.round(region.height * scale));
  let factor = 1;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(sw * factor));
    canvas.height = Math.max(1, Math.round(sh * factor));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas is unavailable.');
    context.drawImage(source, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
    let blob = await encode(canvas, 'image/webp', 0.85);
    if (blob.type !== 'image/webp') blob = await encode(canvas, 'image/jpeg', 0.85);
    if (blob.size <= MAX_SCREENSHOT_BYTES) return blob;
    factor *= Math.sqrt(MAX_SCREENSHOT_BYTES / blob.size) * 0.9;
  }
  throw new Error('Screenshot is too large to send.');
}

// The "s" monogram of the tool (CSS text, no image).
const monogram = (variant = '') => el('span', { className: `fb-mono${variant ? ` fb-mono--${variant}` : ''}`, textContent: 's' });

// The tool's fonts load with the first open, not with every page.
function loadFonts() {
  if (document.querySelector('link[data-feedback-fonts]')) return;
  const link = el('link', { rel: 'stylesheet', href: FONTS_URL, crossOrigin: 'anonymous' });
  link.dataset.feedbackFonts = '';
  document.head.append(link);
}

function init() {
  const host = el('div');
  host.setAttribute(UI_ATTR, '');
  const shadow = host.attachShadow({ mode: 'open' });
  shadow.append(el('style', { textContent: css }));
  document.body.append(host);

  const pill = el('button', { type: 'button', className: 'fb-pill', title: 'Send feedback (Shift+F)' }, monogram(), el('span', { textContent: 'Feedback' }));
  pill.addEventListener('click', () => open());
  shadow.append(pill);

  // Warm the screenshot library so the first capture doesn't wait on it.
  const warm = () => void loadScreenshotLib().catch(() => {});
  if ('requestIdleCallback' in window) requestIdleCallback(warm, { timeout: 5000 });
  else setTimeout(warm, 3000);

  let close: (() => void) | undefined;

  function toast() {
    const node = el('div', { className: 'fb-toast', role: 'status' }, monogram(), 'Thanks — feedback sent.', el('a', { href: '/feedback', textContent: 'View all feedback' }));
    shadow.append(node);
    setTimeout(() => node.remove(), 6000);
  }

  function open() {
    if (close) return;
    loadFonts();
    const embeds = visibleEmbeds();
    const capture = captureViewport();
    capture.catch((error) => console.warn('[feedback] screenshot capture failed', error));
    const root = el('div');
    const overlay = el('div', { className: 'fb-overlay' });
    const scrim = el('div', { className: 'fb-scrim' });
    // The selection: dashed edge, corner brackets, the teal edge light and a label.
    const light = createEdgeLight({ radius: 2, ringOnly: true });
    const size = el('span', { className: 'fb-label__size' });
    const label = el('div', { className: 'fb-label' }, monogram(), 'Release to add a comment', size);
    const selection = el('div', { className: 'fb-selection' }, light.element, ...[0, 1, 2, 3].map(() => el('span', { className: 'fb-corner' })), label);
    const skip = el('button', { type: 'button', textContent: 'skip the screenshot' });
    const hint = el('div', { className: 'fb-hint', role: 'status' },
      monogram('dark'),
      el('strong', { textContent: 'Draw around what you mean' }),
      el('span', {}, 'or click for the whole screen · ', skip),
      el('span', {}, el('kbd', { textContent: 'Esc' }), ' to cancel'));
    overlay.append(scrim, selection);
    root.append(overlay, hint);
    shadow.append(root);
    const previousOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    pill.hidden = true;

    let panelCleanup: (() => void) | undefined;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.preventDefault(); close?.(); } };
    document.addEventListener('keydown', onKey, true);
    close = () => {
      panelCleanup?.();
      light.destroy();
      root.remove();
      document.removeEventListener('keydown', onKey, true);
      document.documentElement.style.overflow = previousOverflow;
      pill.hidden = false;
      close = undefined;
    };

    const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(value, max));
    let start: { x: number; y: number } | undefined;
    let region: Region = { x: 0, y: 0, width: 0, height: 0 };
    const update = (event: PointerEvent) => {
      if (!start) return;
      const x = clamp(Math.min(start.x, event.clientX), 0, innerWidth);
      const y = clamp(Math.min(start.y, event.clientY), 0, innerHeight);
      region = { x, y, width: clamp(Math.abs(event.clientX - start.x), 0, innerWidth - x), height: clamp(Math.abs(event.clientY - start.y), 0, innerHeight - y) };
      Object.assign(selection.style, { display: 'block', left: `${x}px`, top: `${y}px`, width: `${region.width}px`, height: `${region.height}px` });
      // The scrim with a hole where the selection is (even-odd: viewport minus the rectangle).
      const [right, bottom] = [x + region.width, y + region.height];
      scrim.style.clipPath = `polygon(evenodd, 0 0, 100% 0, 100% 100%, 0 100%, 0 0, ${x}px ${y}px, ${right}px ${y}px, ${right}px ${bottom}px, ${x}px ${bottom}px, ${x}px ${y}px)`;
      size.textContent = `${Math.round(region.width)}×${Math.round(region.height)}`;
      // No room above the selection: the label goes inside it.
      label.classList.toggle('is-inside', y < 44);
    };
    overlay.addEventListener('pointerdown', (event) => {
      start = { x: event.clientX, y: event.clientY };
      overlay.setPointerCapture(event.pointerId);
      hint.hidden = true;
      update(event);
      light.play('open');
    });
    overlay.addEventListener('pointermove', update);
    overlay.addEventListener('pointerup', (event) => {
      if (!start) return;
      update(event);
      start = undefined;
      label.hidden = true;
      // A click (or a tiny drag) means "the whole screen".
      if (region.width < 8 || region.height < 8) {
        region = { x: 0, y: 0, width: document.documentElement.clientWidth, height: innerHeight };
        selection.style.display = 'none';
        scrim.hidden = true;
      } else {
        light.play('accept');
      }
      openPanel(region);
    });
    skip.addEventListener('click', () => openPanel(undefined));

    function openPanel(selected: Region | undefined) {
      hint.remove();
      overlay.classList.add('is-selected');
      if (!selected) { selection.style.display = 'none'; scrim.hidden = true; }

      const image = selected ? capture.then((canvas) => cropToBlob(canvas, selected)) : Promise.resolve(undefined);
      image.catch(() => {});
      let previewUrl = '';
      const shot = el('div', { className: 'fb-shot' }, el('div', { className: 'fb-spinner' }));
      shot.setAttribute('aria-label', 'Screenshot preview');
      image.then((blob) => {
        if (!blob) return;
        previewUrl = URL.createObjectURL(blob);
        shot.replaceChildren(el('img', { src: previewUrl, alt: 'Screenshot of the selected area' }));
      }, () => shot.replaceChildren('Screenshot failed — your comment and position are still sent.'));

      const closeButton = el('button', { type: 'button', className: 'fb-close', textContent: '×', title: 'Close (Esc)' });
      closeButton.setAttribute('aria-label', 'Close');
      // The shared name: clicking it shows (or hides) the manifest below it.
      const manifest = el('p', { className: 'fb-manifest', hidden: true, id: 'fb-jah-manifest' }, el('strong', { textContent: MANIFEST_TITLE }), MANIFEST_TEXT);
      const name = el('button', { type: 'button', className: 'fb-jah', textContent: PSEUDONYM });
      name.setAttribute('aria-controls', 'fb-jah-manifest');
      name.setAttribute('aria-expanded', 'false');
      name.addEventListener('click', () => { manifest.hidden = !manifest.hidden; name.setAttribute('aria-expanded', String(!manifest.hidden)); });
      const sendingAs = el('p', { className: 'fb-as' }, 'Sent anonymously as ', name);
      const comment = el('textarea', { required: true, maxLength: 10000, placeholder: 'What should change, or what is wrong here?' });
      const status = el('p', { className: 'fb-status', role: 'alert' });
      const submit = el('button', { type: 'submit', className: 'fb-submit', textContent: 'Send feedback' });
      const panel = el('form', { className: 'fb-panel' },
        el('div', { className: 'fb-panel__head' }, monogram('brand'), el('h2', { className: 'fb-panel__title', textContent: 'Feedback' }), closeButton),
        ...(selected ? [shot] : []),
        el('label', { className: 'fb-field' }, 'Comment', comment),
        sendingAs, manifest, status,
        el('div', { className: 'fb-actions' }, el('small', { textContent: '⌘/Ctrl + Enter to send' }), submit));
      panel.setAttribute('role', 'dialog');
      panel.setAttribute('aria-label', 'Send feedback');
      // Keep the highlighted area visible: put the panel on the other side.
      if (selected && selected.x + selected.width / 2 > innerWidth / 2) panel.classList.add('is-left');
      root.append(panel);
      comment.focus();
      panelCleanup = () => { if (previewUrl) URL.revokeObjectURL(previewUrl); };

      closeButton.addEventListener('click', () => close?.());
      panel.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) { event.preventDefault(); panel.requestSubmit(); }
      });
      panel.addEventListener('submit', async (event) => {
        event.preventDefault();
        const message = comment.value.trim();
        if (!message) { comment.focus(); return; }
        submit.disabled = true;
        submit.textContent = 'Sending…';
        status.textContent = '';
        const data = new FormData();
        data.set('page', location.pathname + location.search);
        data.set('message', message);
        let blob: Blob | undefined;
        let screenshotFailed = false;
        try { blob = await image; } catch { screenshotFailed = Boolean(selected); }
        data.set('metadata', JSON.stringify({
          viewport: { width: innerWidth, height: innerHeight },
          ...(selected ? { region: selected } : {}),
          scroll: { x: scrollX, y: scrollY },
          userAgent: navigator.userAgent,
          ...(embeds.length ? { embeds } : {}),
          ...(screenshotFailed ? { screenshotFailed: true } : {}),
        }));
        if (blob) data.append('images', blob, `screenshot-${Date.now()}.${blob.type === 'image/webp' ? 'webp' : 'jpg'}`);
        try {
          const response = await fetch('/__feedback/api/entries', { method: 'POST', body: data });
          const result = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(result.error || (response.status === 413 ? 'The screenshot is too large to send. Try a smaller area or send without a screenshot.' : `Could not send feedback (${response.status}).`));
          close?.();
          toast();
        } catch (error) {
          submit.disabled = false;
          submit.textContent = 'Send feedback';
          status.textContent = error instanceof Error ? error.message : 'Could not send feedback.';
        }
      });
    }
  }

  document.addEventListener('keydown', (event) => {
    // The real target: typing in the feedback form (inside the shadow root) is not a shortcut.
    const target = event.composedPath()[0];
    if (target instanceof Element && target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])')) return;
    if (event.key.toLowerCase() === 'f' && event.shiftKey && !event.ctrlKey && !event.altKey && !event.metaKey) {
      event.preventDefault();
      if (close) close(); else open();
    }
  });
}

if (!location.pathname.startsWith('/admin') && !location.pathname.startsWith('/feedback')) init();
