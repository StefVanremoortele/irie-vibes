// Feedback capture, injected into every page by the feedback integration.
// Open it with the "Feedback" button or Shift+F, drag over (or click) the
// page, and send a comment with a screenshot of the selected area.
//
// The screenshot of the visible viewport starts rendering the moment feedback
// mode opens, so it is usually ready by the time the user finishes drawing.

type Region = { x: number; y: number; width: number; height: number };
type Embed = { kind: 'youtube' | 'map' | 'iframe'; url: string; title?: string; rect: Region };

const PSEUDONYM = 'Jah a the Creator';
const UI_ATTR = 'data-feedback-ui';

// Own minimal light theme, independent of the site design system (see README
// "Feedback tool"): fixed colours and the system font, no site tokens.
const css = `
  [${UI_ATTR}] { box-sizing: border-box; font: 15px/1.45 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; color: #1c211b; }
  [${UI_ATTR}] *, [${UI_ATTR}] *::before, [${UI_ATTR}] *::after { box-sizing: border-box; }
  .fb-pill { position: fixed; left: 12px; bottom: 12px; z-index: 2147483000; display: inline-flex; align-items: center; gap: 5px; padding: 6px 12px; border: 1px solid #cdd2ca; border-radius: 999px; background: #fffffff2; color: #485046; font-weight: 600; font-size: 13px; cursor: pointer; box-shadow: 0 2px 8px #0002; opacity: .85; transition: opacity .15s, color .15s; }
  .fb-pill:hover, .fb-pill:focus-visible { opacity: 1; color: #2d6a3a; border-color: #2d6a3a; outline: none; }
  .fb-pill[hidden] { display: none; }
  .fb-pill svg { width: 15px; height: 15px; }
  .fb-overlay { position: fixed; inset: 0; z-index: 2147483600; cursor: crosshair; background: #0005; touch-action: none; }
  .fb-overlay.is-selected { background: transparent; cursor: default; pointer-events: none; }
  .fb-selection { position: fixed; display: none; border: 2px solid #2d6a3a; border-radius: 3px; box-shadow: 0 0 0 9999px #0005; pointer-events: none; }
  .fb-hint { position: fixed; top: 12px; left: 50%; transform: translateX(-50%); z-index: 2147483601; display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 2px 12px; width: max-content; max-width: calc(100vw - 24px); padding: 7px 12px; border-radius: 6px; background: #fff; box-shadow: 0 4px 18px #0004; cursor: default; font-size: 14px; text-align: center; }
  .fb-hint strong { color: #1c211b; }
  .fb-hint button { padding: 0; border: 0; background: none; color: #2d6a3a; font: inherit; text-decoration: underline; cursor: pointer; }
  .fb-hint kbd { padding: 0 4px; border: 1px solid #cdd2ca; border-radius: 3px; font: 11px ui-monospace, monospace; }
  .fb-panel { position: fixed; top: 12px; right: 12px; z-index: 2147483602; display: flex; flex-direction: column; gap: 8px; width: min(380px, calc(100vw - 24px)); max-height: calc(100dvh - 24px); overflow-y: auto; overscroll-behavior: contain; padding: 12px; border: 1px solid #e2e5e0; border-radius: 8px; background: #fff; box-shadow: 0 10px 34px #0004; }
  .fb-panel.is-left { right: auto; left: 12px; }
  .fb-panel__head { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
  .fb-panel__title { margin: 0; font-size: 15px; font-weight: 700; }
  .fb-close { width: 24px; height: 24px; flex: none; padding: 0; border: 0; border-radius: 4px; background: none; color: #7b8478; font-size: 18px; line-height: 1; cursor: pointer; }
  .fb-close:hover { background: #f5f6f4; color: #1c211b; }
  .fb-shot { display: grid; place-items: center; height: 140px; flex: none; overflow: hidden; border: 1px solid #e2e5e0; border-radius: 4px; background: #f5f6f4; color: #7b8478; font-size: 13px; }
  .fb-shot img { width: 100%; height: 100%; object-fit: contain; }
  .fb-spinner { width: 18px; height: 18px; border: 2px solid #e2e5e0; border-top-color: #2d6a3a; border-radius: 50%; animation: fb-spin .8s linear infinite; }
  @keyframes fb-spin { to { transform: rotate(360deg); } }
  .fb-field { display: grid; gap: 4px; font-size: 14px; font-weight: 600; }
  .fb-field input, .fb-field textarea { width: 100%; padding: 8px 10px; border: 1px solid #cdd2ca; border-radius: 4px; background: #fff; color: #1c211b; font: inherit; font-weight: 400; }
  .fb-field input:focus, .fb-field textarea:focus { outline: 2px solid #e6f0e7; border-color: #2d6a3a; }
  .fb-field textarea { min-height: 96px; resize: vertical; }
  .fb-as { margin: 0; color: #7b8478; font-size: 13px; }
  .fb-as strong { color: #485046; }
  .fb-actions { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .fb-actions small { color: #7b8478; font-size: 12px; }
  .fb-submit { padding: 7px 14px; border: 0; border-radius: 4px; background: #2d6a3a; color: #fff; font: inherit; font-size: 14px; font-weight: 600; cursor: pointer; }
  .fb-submit:hover { filter: brightness(1.1); }
  .fb-submit:disabled { opacity: .6; cursor: progress; }
  .fb-status { margin: 0; color: #b3261e; font-size: 13px; }
  .fb-status:empty { display: none; }
  .fb-toast { position: fixed; left: 50%; bottom: 16px; z-index: 2147483603; transform: translateX(-50%); padding: 8px 12px; border-radius: 6px; background: #fff; box-shadow: 0 4px 18px #0004; font-size: 14px; }
  .fb-toast a { color: #2d6a3a; }
  @media (max-width: 640px) {
    .fb-pill { left: 8px; bottom: 8px; }
    .fb-panel, .fb-panel.is-left { top: auto; right: 0; bottom: 0; left: 0; width: 100%; max-height: 85dvh; border-width: 1px 0 0; border-radius: 10px 10px 0 0; padding-bottom: max(12px, env(safe-area-inset-bottom)); }
    .fb-shot { height: 96px; }
  }
`;

const ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';

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

function init() {
  document.head.append(el('style', { textContent: css }));

  const pill = el('button', { type: 'button', className: 'fb-pill', title: 'Send feedback (Shift+F)' });
  pill.setAttribute(UI_ATTR, '');
  pill.innerHTML = `${ICON}<span>Feedback</span>`;
  pill.addEventListener('click', () => open());
  document.body.append(pill);

  // Warm the screenshot library so the first capture doesn't wait on it.
  const warm = () => void loadScreenshotLib().catch(() => {});
  if ('requestIdleCallback' in window) requestIdleCallback(warm, { timeout: 5000 });
  else setTimeout(warm, 3000);

  let close: (() => void) | undefined;

  function toast() {
    const node = el('div', { className: 'fb-toast', role: 'status' }, 'Thanks — feedback sent. ', el('a', { href: '/feedback', textContent: 'View all feedback' }));
    node.setAttribute(UI_ATTR, '');
    document.body.append(node);
    setTimeout(() => node.remove(), 6000);
  }

  function open() {
    if (close) return;
    const embeds = visibleEmbeds();
    const capture = captureViewport();
    capture.catch((error) => console.warn('[feedback] screenshot capture failed', error));
    const root = el('div');
    root.setAttribute(UI_ATTR, '');
    const overlay = el('div', { className: 'fb-overlay' });
    const selection = el('div', { className: 'fb-selection' });
    const skip = el('button', { type: 'button', textContent: 'send without screenshot' });
    const hint = el('div', { className: 'fb-hint', role: 'status' },
      el('strong', { textContent: 'Drag to highlight an area' }),
      el('span', {}, 'Click for the whole screen · ', skip),
      el('span', {}, el('kbd', { textContent: 'Esc' }), ' cancel'));
    overlay.append(selection);
    root.append(overlay, hint);
    document.body.append(root);
    const previousOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    pill.hidden = true;

    let panelCleanup: (() => void) | undefined;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.preventDefault(); close?.(); } };
    document.addEventListener('keydown', onKey, true);
    close = () => {
      panelCleanup?.();
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
    };
    overlay.addEventListener('pointerdown', (event) => {
      start = { x: event.clientX, y: event.clientY };
      overlay.setPointerCapture(event.pointerId);
      update(event);
    });
    overlay.addEventListener('pointermove', update);
    overlay.addEventListener('pointerup', (event) => {
      if (!start) return;
      update(event);
      start = undefined;
      // A click (or a tiny drag) means "the whole screen".
      if (region.width < 8 || region.height < 8) {
        region = { x: 0, y: 0, width: document.documentElement.clientWidth, height: innerHeight };
        selection.style.display = 'none';
      }
      openPanel(region);
    });
    skip.addEventListener('click', () => openPanel(undefined));

    function openPanel(selected: Region | undefined) {
      hint.remove();
      overlay.classList.add('is-selected');
      if (!selected) selection.style.display = 'none';

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
      const sendingAs = el('p', { className: 'fb-as' }, 'Sent anonymously as ', el('strong', { textContent: PSEUDONYM }));
      const comment = el('textarea', { required: true, maxLength: 10000, placeholder: 'What should change, or what is wrong here?' });
      const status = el('p', { className: 'fb-status', role: 'alert' });
      const submit = el('button', { type: 'submit', className: 'fb-submit', textContent: 'Send feedback' });
      const panel = el('form', { className: 'fb-panel' },
        el('div', { className: 'fb-panel__head' }, el('h2', { className: 'fb-panel__title', textContent: 'Feedback' }), closeButton),
        ...(selected ? [shot] : []),
        el('label', { className: 'fb-field' }, 'Comment', comment),
        sendingAs, status,
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
    const target = event.target as HTMLElement | null;
    if (target?.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])')) return;
    if (event.key.toLowerCase() === 'f' && event.shiftKey && !event.ctrlKey && !event.altKey && !event.metaKey) {
      event.preventDefault();
      if (close) close(); else open();
    }
  });
}

if (!location.pathname.startsWith('/admin') && !location.pathname.startsWith('/feedback')) init();
