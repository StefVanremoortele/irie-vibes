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
  modal.inert = true;
  const originalOpacity = modal.style.opacity;
  const fragments = document.createElement('div');
  fragments.className = 'fbx-fragments';
  fragments.setAttribute('aria-hidden', 'true');
  fragments.inert = true;
  fragments.style.cssText = 'position:fixed;inset:0;z-index:9601;pointer-events:none;overflow:hidden';
  root.append(fragments);

  // Tile the viewport in pairs of tetrominoes. Each 4×2 patch is covered
  // exactly once by two L pieces, two O pieces, or two I pieces.
  const cols = innerWidth < 600 ? 4 : 8;
  const rows = innerWidth < 600 ? 8 : 6;
  const cellWidth = innerWidth / cols, cellHeight = innerHeight / rows;
  const patterns = [
    [[0, 4, 5, 6], [1, 2, 3, 7]],
    [[0, 1, 2, 4], [3, 5, 6, 7]],
    [[0, 1, 4, 5], [2, 3, 6, 7]],
    [[0, 1, 2, 3], [4, 5, 6, 7]],
  ];
  const pieces: { x: number; y: number }[][] = [];
  for (let y = 0; y < rows; y += 2) {
    for (let x = 0; x < cols; x += 4) {
      const pattern = patterns[Math.floor(Math.random() * patterns.length)];
      for (const piece of pattern) pieces.push(piece.map(cell => ({ x: x + cell % 4, y: y + Math.floor(cell / 4) })));
    }
  }
  for (let i = pieces.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pieces[i], pieces[j]] = [pieces[j], pieces[i]];
  }
  const rect = modal.getBoundingClientRect();
  const scrollPositions = [modal, ...modal.querySelectorAll<HTMLElement>('*')].map(node => [node.scrollLeft, node.scrollTop]);
  let zoom: Animation;
  pieces.forEach((piece, index) => {
    const tile = document.createElement('div');
    tile.className = 'fbx-fragment';
    const path = piece.map(({ x, y }) => {
      const left = x * cellWidth, top = y * cellHeight;
      return `M${left},${top}h${cellWidth}v${cellHeight}h${-cellWidth}Z`;
    }).join(' ');
    const cx = piece.reduce((sum, cell) => sum + (cell.x + 0.5) * cellWidth, 0) / 4;
    const cy = piece.reduce((sum, cell) => sum + (cell.y + 0.5) * cellHeight, 0) / 4;
    tile.style.cssText = `position:absolute;inset:0;clip-path:path('${path}');transform-origin:${cx}px ${cy}px;will-change:transform,opacity`;
    // Preserve the live layout and each scrolled pane inside the cutout.
    // These presentation-only clones never receive events or duplicate IDs.
    const copy = modal.cloneNode(true) as HTMLElement;
    const nodes = [copy, ...copy.querySelectorAll<HTMLElement>('*')];
    nodes.forEach(node => { node.removeAttribute('id'); node.removeAttribute('autofocus'); });
    copy.style.cssText += `;position:absolute;inset:auto;left:${rect.left}px;top:${rect.top}px;width:${rect.width}px;height:${rect.height}px;margin:0;animation:none;opacity:1;transform:none;backdrop-filter:none;-webkit-backdrop-filter:none;background:rgba(255,255,255,0.92)`;
    tile.append(copy);
    fragments.append(tile);
    nodes.forEach((node, i) => { node.scrollLeft = scrollPositions[i][0]; node.scrollTop = scrollPositions[i][1]; });
    const angle = Math.atan2(cy - innerHeight / 2, cx - innerWidth / 2) + (Math.random() - 0.5) * 0.9;
    const distance = Math.max(innerWidth, innerHeight) * (0.45 + Math.random() * 0.35);
    const dx = Math.cos(angle) * distance, dy = Math.sin(angle) * distance;
    const spin = (Math.random() - 0.5) * 100;
    const tilt = (Math.random() - 0.5) * 60;
    const animation = animate(tile, reduce ? [{ opacity: 1 }, { opacity: 0 }] : [
      { transform: 'perspective(900px) translate3d(0,0,0) rotate(0deg)', opacity: 1, easing: 'cubic-bezier(0.55,0,0.8,0.2)' },
      { offset: 0.25, transform: `perspective(900px) translate3d(${dx * 0.06}px,${dy * 0.06}px,35px) rotate(${spin * 0.1}deg)`, opacity: 1 },
      { transform: `perspective(900px) translate3d(${dx}px,${dy}px,650px) rotateX(${tilt}deg) rotate(${spin}deg)`, opacity: 0 },
    ], 620, index * 260 / (pieces.length - 1), 'cubic-bezier(0.4,0,0.8,0.3)');
    if (index === pieces.length - 1) zoom = animation;
  });
  modal.style.opacity = '0';
  animate(scrim, [{ opacity: 1 }, { opacity: 0 }], 450, 430, 'ease-out');
  zoom!.onfinish = () => {
    fragments.remove();
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
    fragments.remove();
    modal.style.opacity = originalOpacity;
    modal.inert = false;
    title.replaceChildren();
  };
}
