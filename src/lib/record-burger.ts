// "Record button" animation for the header hamburger: the three reggae bars
// get pressed, morph into a spinning vinyl record (with tonearm), and fold
// back into the hamburger, on a seamless loop.
//
// Ported from a motion design export: the shapes live in a 600×600 viewBox
// centred on 0,0 (the disc is r=180, so it fills 60% of the box), and every
// attribute is a pure function of the authored time T.

export const VIEWBOX = '-300 -300 600 600';
/** Disc radius at rest, in viewBox units: the SVG is sized so this matches the button. */
export const DISC_R = 180;
export const LABEL_R = 72;
export const COLORS = ['#e2363b', '#f2c230', '#2f9e4f'];
export const GROOVES: number[] = [];
for (let r = LABEL_R + 10; r < 208; r += 5) GROOVES.push(r);

const SPIN_DEG_PER_S = 180;

// Scenes: `dur` is the playback length, `nat` the authored length it covers
// (the Spin scene plays 5s of authored motion in 1.4s).
const SCENES = [
  { name: 'Button', dur: 0.9, nat: 1.4 },
  { name: 'Morph', dur: 1.3, nat: 1.6 },
  { name: 'Spin', dur: 1.4, nat: 5 },
  { name: 'Return', dur: 2.2, nat: 2.2 },
] as const;

const sections = SCENES.reduce<{ playStart: number; authStart: number; dur: number; nat: number }[]>((list, scene) => {
  const prev = list[list.length - 1];
  list.push({
    playStart: prev ? prev.playStart + prev.dur : 0,
    authStart: prev ? prev.authStart + prev.nat : 0,
    dur: scene.dur,
    nat: scene.nat,
  });
  return list;
}, []);
const CUES = { Morph: sections[1].authStart, Spin: sections[2].authStart, Return: sections[3].authStart };
const AUTHORED_TOTAL = sections.reduce((sum, s) => sum + s.nat, 0);
/** Length of one loop in seconds. */
export const LOOP_SECONDS = SCENES.reduce((sum, s) => sum + s.dur, 0);

const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);
const lerp = (a: number, b: number, p: number) => a + (b - a) * p;
const easeOutCubic = (t: number) => (t - 1) ** 3 + 1;
const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1);
const animate = (from: number, to: number, start: number, end: number, ease: (t: number) => number) => (t: number) =>
  t <= start ? from : t >= end ? to : from + (to - from) * ease((t - start) / (end - start));

/** Playback seconds within the loop → authored time T. */
function authoredTime(seconds: number) {
  const t = ((seconds % LOOP_SECONDS) + LOOP_SECONDS) % LOOP_SECONDS;
  const s = sections.find((section) => t < section.playStart + section.dur) ?? sections[sections.length - 1];
  const local = clamp(t - s.playStart, 0, s.dur);
  return Math.min(s.authStart + local * (s.nat / s.dur), AUTHORED_TOTAL);
}

// The spin speed is chosen so the spin-down lands exactly on a full turn.
function spinAngle(T: number) {
  const ramp = 0.9, decel = 1.1;
  const s = CUES.Spin, r = CUES.Return, dur = r - s;
  if (T <= s) return 0;
  const span = dur - ramp / 2 + decel / 3;
  const k = Math.max(1, Math.round((SPIN_DEG_PER_S * span) / 360));
  const w = (360 * k) / span;
  const t = T - s;
  if (t < ramp) return (w * t * t) / (2 * ramp);
  if (T < r) return w * (t - ramp / 2);
  return w * (dur - ramp / 2) + ((w * decel) / 3) * easeOutCubic(clamp((T - r) / decel, 0, 1));
}

export interface RecordFrame {
  /** 0 = hamburger, 1 = record */
  m: number;
  angle: number;
  R: number;
  clipR: number;
  bars: { x: number; y: number; width: number; height: number; rx: number }[];
  arm: number;
  armOpacity: number;
  labelOpacity: number;
  reflection: [string, string];
}

/** The frame at `seconds` into the loop (0 = resting hamburger). */
export function recordFrame(seconds: number): RecordFrame {
  const T = authoredTime(seconds);
  const m = T < CUES.Return
    ? animate(0, 1, CUES.Morph, CUES.Morph + 1.3, easeInOutCubic)(T)
    : animate(1, 0, CUES.Return + 0.7, CUES.Return + 1.9, easeInOutCubic)(T);
  const press = T < CUES.Morph + 0.3 ? 1 - 0.05 * Math.sin(Math.PI * clamp((T - (CUES.Morph - 0.25)) / 0.45, 0, 1)) : 1;
  const R = lerp(DISC_R, 215, m) * press;
  const width = lerp(166, 160, m);
  const height = lerp(32, 48.5, m);
  const wedge = (a: number, b: number) =>
    `M0 0 L${R * Math.cos(a)} ${R * Math.sin(a)} A${R} ${R} 0 0 1 ${R * Math.cos(b)} ${R * Math.sin(b)} Z`;
  return {
    m,
    angle: spinAngle(T),
    R,
    clipR: lerp(260, LABEL_R, m),
    bars: [0, 1, 2].map((i) => {
      const y = lerp((i - 1) * 51, (i - 1) * 48, m);
      return { x: -width / 2, y: y - height / 2, width, height, rx: lerp(16, 0, m) };
    }),
    arm: T < CUES.Return
      ? animate(-34, 0, CUES.Spin + 0.1, CUES.Spin + 1.1, easeOutCubic)(T)
      : animate(0, -34, CUES.Return, CUES.Return + 0.8, easeInOutCubic)(T),
    armOpacity: clamp(m * 1.4 - 0.2, 0, 1),
    labelOpacity: clamp(m * 2 - 1, 0, 1),
    reflection: [wedge(-1.05, -0.55), wedge(2.09, 2.59)],
  };
}
