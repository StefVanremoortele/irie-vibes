// The animated "gassy" teal edge light of the feedback tool: a conic gradient
// that laps around the /feedback panel and the Shift+F selection rectangle.
// Only the --edge-a angle, opacity and transform animate, so it stays cheap.
//
// States: open (one lap) -> idle (slow loop), new (quick lap, a new item
// arrived) -> idle, accept (quick white flash) -> idle, close (fade out).
// Reduced motion, or no @property support: a static ring.

export type EdgeState = 'open' | 'idle' | 'new' | 'accept' | 'close';

const IDLE_SECONDS = 14;
const IDLE_OPACITY = 0.5;
const GLOW = 0.6;
// The idle loop pauses after this long without interaction (and while the tab is hidden).
const IDLE_PAUSE_MS = 30_000;

const GAS = 'transparent 0deg, rgba(167,243,208,0) 230deg, rgba(167,243,208,.55) 262deg, #22d3ee 292deg, #5eead4 318deg, #2dd4bf 338deg, #14b8a6 352deg, transparent 360deg';
const GAS2 = 'transparent 0deg, rgba(34,211,238,0) 200deg, rgba(34,211,238,.6) 250deg, rgba(167,243,208,.5) 300deg, rgba(94,234,212,.7) 340deg, transparent 360deg';
const FLASH = 'transparent 0deg, rgba(236,253,245,0) 250deg, #cffafe 300deg, #f0fdfa 340deg, #fff 356deg, transparent 360deg';
const SMOOTH = 'cubic-bezier(0.32, 0.72, 0, 1)';

const ANIMATION: Record<Exclude<EdgeState, 'close'>, string> = {
  open: `fbe-lap 1.8s ${SMOOTH} 1 both`,
  idle: `fbe-loop ${IDLE_SECONDS}s linear infinite`,
  new: `fbe-loop 1s ${SMOOTH} 1 both`,
  accept: `fbe-loop .7s ${SMOOTH} 1 both`,
};

const RING_MASK = '-webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0); -webkit-mask-composite: xor; mask: linear-gradient(#000 0 0) content-box exclude, linear-gradient(#000 0 0);';

// Styles for the light. Works in the document and inside a shadow root
// (keyframes are scoped to the tree they are defined in, so include it in each).
export const EDGE_CSS = `
  @keyframes fbe-lap { from { --edge-a: -50deg; } to { --edge-a: 310deg; } }
  @keyframes fbe-loop { from { --edge-a: 310deg; } to { --edge-a: 670deg; } }
  .fbe { --edge-a: -50deg; --fbe-r: 20px; --fbe-gas: ${GAS}; position: absolute; inset: 0; z-index: 0; border-radius: var(--fbe-r); pointer-events: none; opacity: 0; transition: opacity .6s ${SMOOTH}; }
  .fbe.is-flash { --fbe-gas: ${FLASH}; }
  .fbe.is-closing { transition-duration: .26s; }
  .fbe.is-paused { animation-play-state: paused !important; }
  .fbe > span { position: absolute; box-sizing: border-box; }
  .fbe__swirl { inset: -10px; border-radius: calc(var(--fbe-r) + 10px); background: conic-gradient(from calc(var(--edge-a) * -0.6 + 140deg), ${GAS2}); filter: blur(26px); opacity: ${GLOW * 0.8}; mix-blend-mode: screen; }
  .fbe__core { inset: -3px; border-radius: calc(var(--fbe-r) + 3px); background: conic-gradient(from var(--edge-a), var(--fbe-gas)); filter: blur(14px); opacity: ${GLOW}; mix-blend-mode: screen; }
  .fbe__ring { inset: -2px; padding: 2px; border-radius: calc(var(--fbe-r) + 2px); background: conic-gradient(from var(--edge-a), var(--fbe-gas)); ${RING_MASK} }
  /* Ring only (the selection): the glow layers are masked to a ring too, so the selected area stays clear. */
  .fbe--ring .fbe__swirl { inset: -24px; padding: 24px; ${RING_MASK} }
  .fbe--ring .fbe__core { inset: -16px; padding: 16px; ${RING_MASK} }
  .fbe.is-static { --edge-a: -60deg; animation: none !important; }
`;

let registered: boolean | undefined;
// @property can't be declared inside a shadow root; registering from script
// works for the document and every shadow tree.
function registerAngle() {
  if (registered !== undefined) return registered;
  try {
    CSS.registerProperty({ name: '--edge-a', syntax: '<angle>', inherits: true, initialValue: '-50deg' });
    registered = true;
  } catch (error) {
    // Already registered (e.g. by another copy of this module) still animates.
    registered = error instanceof DOMException && error.name === 'InvalidModificationError';
  }
  return registered;
}

export function createEdgeLight({ radius, ringOnly = false }: { radius: number; ringOnly?: boolean }) {
  const element = document.createElement('div');
  element.className = `fbe${ringOnly ? ' fbe--ring' : ''}`;
  element.setAttribute('aria-hidden', 'true');
  element.style.setProperty('--fbe-r', `${radius}px`);
  element.innerHTML = '<span class="fbe__swirl"></span><span class="fbe__core"></span><span class="fbe__ring"></span>';

  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const isStatic = () => reducedMotion.matches || !registerAngle();
  let state: EdgeState | undefined;
  let pauseTimer = 0;

  function schedulePause() {
    clearTimeout(pauseTimer);
    element.classList.remove('is-paused');
    if (state !== 'idle') return;
    if (document.hidden) element.classList.add('is-paused');
    else pauseTimer = window.setTimeout(() => element.classList.add('is-paused'), IDLE_PAUSE_MS);
  }

  function play(next: EdgeState) {
    state = next;
    element.classList.toggle('is-closing', next === 'close');
    element.classList.toggle('is-flash', next === 'accept');
    element.classList.toggle('is-static', isStatic());
    if (next === 'close') { element.style.opacity = '0'; clearTimeout(pauseTimer); return; }
    if (isStatic()) { element.style.animation = 'none'; element.style.opacity = '0.6'; return; }
    // Restart the animation for every event.
    element.style.animation = 'none';
    void element.offsetWidth;
    element.style.animation = ANIMATION[next];
    element.style.opacity = String(next === 'idle' ? IDLE_OPACITY : 1);
    schedulePause();
  }

  element.addEventListener('animationend', (event) => {
    if (event.target === element && (state === 'open' || state === 'new' || state === 'accept')) play('idle');
  });
  // Activity restarts the countdown (at most once a second; pointermove fires a lot).
  let lastWake = 0;
  const wake = (event: Event) => {
    if (state !== 'idle' || (event.type !== 'visibilitychange' && Date.now() - lastWake < 1000)) return;
    lastWake = Date.now();
    schedulePause();
  };
  document.addEventListener('visibilitychange', wake);
  for (const name of ['pointermove', 'keydown', 'wheel'] as const) addEventListener(name, wake, { passive: true });
  reducedMotion.addEventListener('change', () => { if (state && state !== 'close') play('idle'); });

  return {
    element,
    play,
    destroy() {
      clearTimeout(pauseTimer);
      document.removeEventListener('visibilitychange', wake);
      for (const name of ['pointermove', 'keydown', 'wheel'] as const) removeEventListener(name, wake);
      element.remove();
    },
  };
}
