type TransitionOptions = {
  root: HTMLElement;
  modal: HTMLElement;
  scrim: HTMLElement;
  title: HTMLElement;
  speed?: number;
  onDone: () => void;
};

/** Start the exit sting. Call the returned disposer when leaving the page. */
export function svrTransition({ root, modal, scrim, title, speed = 1, onDone }: TransitionOptions) {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const rate = Number.isFinite(speed) && speed > 0 ? speed : 1;
  const animations: Animation[] = [];
  let cancelled = false;
  const animate = (element: HTMLElement, frames: Keyframe[], duration: number, delay = 0, easing = 'linear') => {
    const animation = element.animate(frames, { duration: duration / rate, delay: delay / rate, easing, fill: 'forwards' });
    animations.push(animation);
    return animation;
  };
  // Let typography grow slightly ahead of the intact dialog zoom. Snapshot
  // sizes first so nested labels never compound their inherited font sizes.
  if (!reduce) {
    const text = [...modal.querySelectorAll<HTMLElement>('button, a, p, span, strong, label, h2, h3, time, kbd')]
      .filter(element => element.checkVisibility({ checkVisibilityCSS: true }) &&
        [...element.childNodes].some(node => node.nodeType === Node.TEXT_NODE && node.textContent?.trim()))
      .map(element => ({ element, size: parseFloat(getComputedStyle(element).fontSize) }));
    for (const { element, size } of text) {
      const lead = element.closest('.fbx-chips') ? 160 : element.closest('.fbx-tabs, .fbx-detail__title') ? 0 : 60;
      animate(element, [{ fontSize: `${size}px` }, { fontSize: `${size * 1.35}px` }], 220, lead, 'cubic-bezier(0.22,1,0.36,1)');
    }
  }
  if (!reduce) {
    for (const button of modal.querySelectorAll<HTMLElement>('.fbx-chip')) {
      animate(button, [{ padding: '5px 11px' }, { padding: '9px 15px' }], 320, 160, 'cubic-bezier(0.4,0,0.2,1)');
    }
    const filters = modal.querySelector<HTMLElement>('.fbx-chips');
    if (filters) animate(filters, [{ padding: '16px 16px 12px' }, { padding: '8px' }], 320, 160, 'cubic-bezier(0.4,0,0.2,1)');
  }
  modal.inert = true;
  modal.style.transformOrigin = '50% 50%';
  const zoom = animate(modal, reduce ? [{ opacity: 1 }, { opacity: 0 }] : [
    { transform: 'scale(1)', opacity: 1, filter: 'blur(0px)', easing: 'cubic-bezier(0.55,0,0.8,0.2)' },
    { offset: 0.6, transform: 'scale(1.9)', opacity: 0.7, filter: 'blur(2px)', easing: 'cubic-bezier(0.2,0,0.4,1)' },
    { transform: 'scale(3.2)', opacity: 0, filter: 'blur(10px)' },
  ], 560);
  animate(scrim, [{ opacity: 1 }, { opacity: 0 }], 450, 110, 'ease-out');
  zoom.onfinish = () => {
    if (cancelled) return;
    const letters = [...'SVR'];
    title.replaceChildren(...letters.map((letter, index) => {
      const span = document.createElement('span');
      span.textContent = letter === ' ' ? '\u00a0' : letter;
      span.style.cssText = 'display:inline-block;opacity:0';
      animate(span, reduce ? [{ opacity: 0 }, { opacity: 1 }] : [
        { opacity: 0, transform: 'translateY(10px)', filter: 'blur(6px)' },
        { opacity: 1, transform: 'translateY(0)', filter: 'blur(0px)' },
      ], 240, index * 14, 'cubic-bezier(0.32,0.72,0,1)');
      return span;
    }));
    const fade = animate(root, reduce ? [{ opacity: 1 }, { opacity: 0 }] : [
      { opacity: 1, filter: 'blur(0px)', transform: 'scale(1)' },
      { opacity: 0, filter: 'blur(8px)', transform: 'scale(1.03)' },
    ], 280, (letters.length - 1) * 14 + 240 + 80, 'cubic-bezier(0.4,0,0.2,1)');
    fade.onfinish = () => { if (!cancelled) onDone(); };
  };
  return () => {
    cancelled = true;
    for (const animation of animations) {
      animation.onfinish = null;
      animation.cancel();
    }
    modal.inert = false;
    title.replaceChildren();
  };
}
