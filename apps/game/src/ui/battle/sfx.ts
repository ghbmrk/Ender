/** Tiny synthesized sound kit (WebAudio, no files). Silent until the first user gesture unlocks audio. */
let ac: AudioContext | null = null;
let muted = false;
try {
  muted = localStorage.getItem("ender:mute") === "1";
} catch {
  /* private mode */
}
export const isMuted = () => muted;
export function setMuted(m: boolean) {
  muted = m;
  try {
    localStorage.setItem("ender:mute", m ? "1" : "0");
  } catch {
    /* private mode */
  }
}
function ctx() {
  if (muted) return null;
  if (!ac) {
    const C = window.AudioContext ?? (window as any).webkitAudioContext;
    if (!C) return null;
    ac = new C();
  }
  if (ac.state === "suspended") void ac.resume();
  return ac;
}

function tone(freq: number, dur: number, type: OscillatorType, gain: number, slide?: number, delay = 0) {
  const a = ctx();
  if (!a) return;
  const t = a.currentTime + delay;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noise(dur: number, gain: number, freq: number, q = 1, delay = 0) {
  const a = ctx();
  if (!a) return;
  const t = a.currentTime + delay;
  const buf = a.createBuffer(1, Math.ceil(a.sampleRate * dur), a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const s = a.createBufferSource();
  s.buffer = buf;
  const f = a.createBiquadFilter();
  f.type = "bandpass";
  f.frequency.value = freq;
  f.Q.value = q;
  const g = a.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f).connect(g).connect(a.destination);
  s.start(t);
}

/** A short buzz on phones that support it (Android; iOS Safari ignores it). Follows the mute switch. */
function buzz(pattern: number | number[]) {
  if (muted) return;
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* unsupported */
  }
}

export const sfx = {
  unlock: () => void ctx(),
  tap: () => tone(660, 0.06, "triangle", 0.08),
  perfect: () => {
    buzz(12);
    tone(1320, 0.18, "sine", 0.12);
    tone(1980, 0.22, "sine", 0.06, undefined, 0.03);
  },
  good: () => tone(880, 0.12, "triangle", 0.1),
  miss: () => tone(220, 0.16, "sawtooth", 0.05, 160),
  hit: () => {
    noise(0.14, 0.35, 900, 0.8);
    tone(120, 0.14, "sine", 0.25, 60);
  },
  heavy: () => {
    noise(0.25, 0.5, 400, 0.7);
    tone(90, 0.3, "sine", 0.35, 40);
  },
  hurt: () => {
    buzz(45);
    noise(0.18, 0.4, 600, 0.6);
    tone(180, 0.18, "square", 0.06, 90);
  },
  parry: () => {
    buzz([18, 30, 18]);
    tone(1560, 0.25, "square", 0.05, 1400);
    tone(2340, 0.3, "sine", 0.08);
    noise(0.08, 0.25, 3200, 2);
  },
  dodge: () => {
    buzz(8);
    noise(0.22, 0.25, 1800, 0.5);
  },
  telegraph: () => tone(300, 0.3, "sine", 0.06, 420),
  brk: () => {
    buzz([30, 40, 60]);
    tone(200, 0.5, "sawtooth", 0.08, 50);
    noise(0.4, 0.4, 300, 0.5);
  },
  finale: () => {
    buzz([60, 50, 140]);
    tone(70, 0.9, "sine", 0.4, 35);
    noise(0.7, 0.45, 260, 0.4);
    tone(660, 0.6, "sine", 0.05, 990, 0.35);
  },
  ap: () => tone(990, 0.08, "sine", 0.06, 1180),
  ko: () => tone(330, 0.5, "triangle", 0.1, 80),
  victory: () => [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.35, "triangle", 0.1, undefined, i * 0.12)),
  defeat: () => [392, 330, 262].forEach((f, i) => tone(f, 0.5, "triangle", 0.1, undefined, i * 0.2)),
  turn: () => tone(520, 0.1, "sine", 0.06, 620),
};
