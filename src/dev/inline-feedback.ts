// This module is injected by the feedback integration only while running astro dev.
const feedbackNameKey = 'feedback-name';
if (!location.pathname.startsWith('/admin') && !location.pathname.startsWith('/feedback')) {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = 'Feedback';
  button.setAttribute('aria-label', 'Select an area to send feedback');
  button.className = 'inline-feedback-button';

  const style = document.createElement('style');
  style.textContent = `
    .inline-feedback-button { position: fixed; z-index: 2147483640; right: 18px; bottom: 18px; border: 1px solid #fabc4d; border-radius: 999px; padding: 10px 16px; background: #101510; color: #fabc4d; box-shadow: 0 5px 20px #0008; font: 600 14px/1.2 system-ui,sans-serif; cursor: pointer; }
    .inline-feedback-button:hover { background: #fabc4d; color: #101510; }
    .inline-feedback-overlay { position: fixed; inset: 0; z-index: 2147483638; cursor: crosshair; background: #0005; }
    .inline-feedback-selection { position: fixed; border: 2px solid #fabc4d; background: #fabc4d22; box-shadow: 0 0 0 9999px #0005; pointer-events: none; }
    .inline-feedback-popover { position: fixed; z-index: 2147483639; display: grid; gap: 10px; width: min(340px, calc(100vw - 24px)); padding: 14px; border: 1px solid #fabc4d; border-radius: 12px; background: #182018; color: #fff; box-shadow: 0 10px 35px #000b; font: 14px/1.35 system-ui,sans-serif; }
    .inline-feedback-popover img { display: block; width: 100%; max-height: 180px; object-fit: contain; background: #101510; border-radius: 6px; }
    .inline-feedback-popover label { display: grid; gap: 4px; font-weight: 600; }
    .inline-feedback-popover input, .inline-feedback-popover textarea { box-sizing: border-box; width: 100%; border: 1px solid #718071; border-radius: 6px; padding: 8px; background: #101510; color: #fff; font: inherit; }
    .inline-feedback-popover textarea { min-height: 76px; resize: vertical; }
    .inline-feedback-actions { display: flex; justify-content: flex-end; gap: 8px; }
    .inline-feedback-actions button { border: 0; border-radius: 6px; padding: 8px 12px; cursor: pointer; font-weight: 700; }
    .inline-feedback-cancel { background: #334033; color: #fff; }
    .inline-feedback-submit { background: #fabc4d; color: #101510; }
    .inline-feedback-status { margin: 0; color: #fabc4d; font-size: 12px; }
    .inline-feedback-toast { position: fixed; z-index: 2147483641; left: 50%; bottom: 20px; transform: translateX(-50%); padding: 11px 15px; border-radius: 8px; background: #182018; color: #fff; box-shadow: 0 5px 20px #0009; font: 14px system-ui,sans-serif; }
  `;
  document.head.append(style);
  document.body.append(button);

  const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
  const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(value, max));
  let overlay: HTMLDivElement | undefined;
  let selection: HTMLDivElement | undefined;

  function removeSelection() {
    overlay?.remove();
    overlay = undefined;
    selection = undefined;
    button.hidden = false;
  }

  async function captureRegion(region: { x: number; y: number; width: number; height: number }) {
    const { domToPng } = await import('modern-screenshot');
    const scale = window.devicePixelRatio || 1;
    const pageWidth = Math.max(document.documentElement.scrollWidth, window.innerWidth);
    const pageHeight = Math.max(document.documentElement.scrollHeight, window.innerHeight);
    const fullPage = await domToPng(document.body, { width: pageWidth, height: pageHeight, scale });
    const source = new Image();
    source.src = fullPage;
    await source.decode();
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(region.width * scale));
    canvas.height = Math.max(1, Math.round(region.height * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas is unavailable.');
    context.drawImage(source, Math.round((region.x + scrollX) * scale), Math.round((region.y + scrollY) * scale), canvas.width, canvas.height, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Could not encode screenshot.')), 'image/png'));
  }

  function showToast() {
    const toast = document.createElement('div');
    toast.className = 'inline-feedback-toast';
    toast.innerHTML = 'Feedback sent — <a href="/feedback" style="color:#fabc4d">view inbox</a>';
    document.body.append(toast);
    setTimeout(() => toast.remove(), 6000);
  }

  function openPopover(region: { x: number; y: number; width: number; height: number }, image: Blob | undefined, captureFailed: boolean) {
    const popover = document.createElement('form');
    popover.className = 'inline-feedback-popover';
    const thumbnail = image ? document.createElement('img') : undefined;
    if (thumbnail && image) { thumbnail.src = URL.createObjectURL(image); thumbnail.alt = 'Selected page region'; }
    const name = document.createElement('input'); name.maxLength = 120; name.placeholder = 'Your name'; name.value = localStorage.getItem(feedbackNameKey) || '';
    const nameLabel = document.createElement('label'); nameLabel.textContent = 'Name'; nameLabel.append(name);
    const comment = document.createElement('textarea'); comment.required = true; comment.maxLength = 10000; comment.placeholder = 'What should change?';
    const commentLabel = document.createElement('label'); commentLabel.textContent = 'Comment *'; commentLabel.append(comment);
    const status = document.createElement('p'); status.className = 'inline-feedback-status'; status.textContent = captureFailed ? 'Screenshot failed; coordinates will still be recorded.' : '';
    const actions = document.createElement('div'); actions.className = 'inline-feedback-actions';
    const cancel = document.createElement('button'); cancel.type = 'button'; cancel.className = 'inline-feedback-cancel'; cancel.textContent = 'Cancel';
    const submit = document.createElement('button'); submit.type = 'submit'; submit.className = 'inline-feedback-submit'; submit.textContent = 'Submit';
    actions.append(cancel, submit);
    if (thumbnail) popover.append(thumbnail);
    popover.append(nameLabel, commentLabel, status, actions);
    document.body.append(popover);
    const popoverRect = popover.getBoundingClientRect();
    popover.style.left = `${clamp(region.x, 12, innerWidth - popoverRect.width - 12)}px`;
    popover.style.top = `${clamp(region.y + region.height + 12, 12, innerHeight - popoverRect.height - 12)}px`;
    cancel.addEventListener('click', () => { if (thumbnail) URL.revokeObjectURL(thumbnail.src); popover.remove(); });
    comment.focus();
    popover.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!comment.value.trim()) return;
      submit.disabled = true; status.textContent = 'Sending…';
      const data = new FormData();
      data.set('name', name.value.trim()); data.set('page', location.pathname + location.search); data.set('message', comment.value.trim());
      data.set('metadata', JSON.stringify({ viewport: { width: innerWidth, height: innerHeight }, region, scroll: { x: scrollX, y: scrollY }, userAgent: navigator.userAgent, ...(captureFailed ? { screenshotFailed: true } : {}) }));
      if (image) data.append('images', image, `selection-${Date.now()}.png`);
      try {
        const response = await fetch('/__feedback/api/entries', { method: 'POST', body: data });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Could not send feedback.');
        localStorage.setItem(feedbackNameKey, name.value.trim()); popover.remove(); if (thumbnail) URL.revokeObjectURL(thumbnail.src); showToast();
      } catch (error) { submit.disabled = false; status.textContent = error instanceof Error ? error.message : 'Could not send feedback.'; }
    });
  }

  function startSelection() {
    if (overlay) return;
    button.hidden = true;
    overlay = document.createElement('div'); overlay.className = 'inline-feedback-overlay';
    selection = document.createElement('div'); selection.className = 'inline-feedback-selection'; overlay.append(selection); document.body.append(overlay);
    let startX = 0; let startY = 0; let active = false;
    const update = (event: PointerEvent) => {
      if (!active || !selection) return;
      const x = clamp(Math.min(startX, event.clientX), 0, innerWidth); const y = clamp(Math.min(startY, event.clientY), 0, innerHeight);
      const width = clamp(Math.abs(event.clientX - startX), 0, innerWidth - x); const height = clamp(Math.abs(event.clientY - startY), 0, innerHeight - y);
      Object.assign(selection.style, { left: `${x}px`, top: `${y}px`, width: `${width}px`, height: `${height}px` });
    };
    overlay.addEventListener('pointerdown', (event) => { active = true; startX = event.clientX; startY = event.clientY; overlay?.setPointerCapture(event.pointerId); update(event); });
    overlay.addEventListener('pointermove', update);
    overlay.addEventListener('pointerup', async (event) => {
      if (!active) return; active = false; update(event);
      const rect = selection?.getBoundingClientRect();
      if (!rect || rect.width < 8 || rect.height < 8) { removeSelection(); return; }
      const region = { x: rect.left, y: rect.top, width: rect.width, height: rect.height };
      button.hidden = true; if (overlay) overlay.style.visibility = 'hidden';
      let image: Blob | undefined; let captureFailed = false;
      try { await wait(80); image = await captureRegion(region); } catch (error) { captureFailed = true; console.warn('[feedback] screenshot capture failed', error); }
      removeSelection(); openPopover(region, image, captureFailed);
    });
    document.addEventListener('keydown', function cancelOnEscape(event) { if (event.key === 'Escape') { document.removeEventListener('keydown', cancelOnEscape); removeSelection(); } });
  }
  button.addEventListener('click', startSelection);
}
