// In-browser stand-in for Ender's in-combat look (spec sections 15, 75–85).
// One unit = 1 m (spec values are in cm and divided by 100).
// Pipeline: colour pass → view normals pass → class-ID pass → post shader that
// draws ink outlines per class width and applies the watercolour treatment.
import * as THREE from '../vendor/three.module.min.js';

const q = new URLSearchParams(location.search);
const SHOT = q.get('shot') || 'room';
const COLORBLIND = q.get('cb') === '1';
const W = 1920, H = 1080;

// ---------- palette (section 76) ----------
const P = {
  ink: 0x24212a, playerEdge: 0x30365a, elite: 0x543131, interactable: 0x315b57,
  paper: 0xe7ddc6, warmStone: 0xa89a83, coldStone: 0x777b80, moss: 0x65715d, umber: 0x776054, deepWash: 0x393641,
  weave: 0x6676b8, health: 0xb84f49, danger: 0xe16a54, hazard: 0x9a8d42, interact: 0x5b9486,
  rare: 0x597da2, exceptional: 0x8667a3, highValue: 0xc09a50, parchment: 0xb9a988,
};
// Outline classes = custom stencil values (section 80).
const CLS = { env: 0, player: 1, enemy: 2, elite: 3, boss: 4, interact: 5, loot: 6 };

// ---------- renderer / camera (section 15) ----------
const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(W, H);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.NoToneMapping;
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1c1a21);
const camera = new THREE.PerspectiveCamera(38, W / H, 1, 60);
const YAW = THREE.MathUtils.degToRad(45), PITCH = THREE.MathUtils.degToRad(52), ARM = 15.5;
function frame(target) {
  const t = new THREE.Vector3(target.x, 0.9, target.z);
  camera.position.set(
    t.x + Math.sin(YAW) * Math.cos(PITCH) * ARM,
    t.y + Math.sin(PITCH) * ARM,
    t.z + Math.cos(YAW) * Math.cos(PITCH) * ARM,
  );
  camera.lookAt(t);
}
// Screen-aligned ground basis: sx → right on screen, sy → up on screen.
const RIGHT = new THREE.Vector3(Math.cos(YAW), 0, -Math.sin(YAW));
const UP = new THREE.Vector3(-Math.sin(YAW), 0, -Math.cos(YAW));
const at = (sx, sy) => RIGHT.clone().multiplyScalar(sx).add(UP.clone().multiplyScalar(sy));
const facing = (from, to) => Math.atan2(to.x - from.x, to.z - from.z);

// ---------- helpers ----------
const hash3 = (x, y, z) => {
  const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return s - Math.floor(s);
};
function jitter(geo, amt) {
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const k = [Math.round(x * 1000), Math.round(y * 1000), Math.round(z * 1000)];
    p.setXYZ(i, x + (hash3(...k) - 0.5) * amt, y + (hash3(k[1], k[2], k[0]) - 0.5) * amt, z + (hash3(k[2], k[0], k[1]) - 0.5) * amt);
  }
  geo.computeVertexNormals();
  return geo;
}
const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.82, metalness: 0, flatShading: true, ...o });
const metal = (color) => mat(color, { metalness: 0.65, roughness: 0.68 });
function mesh(geo, material, cls, pos = [0, 0, 0], rot = [0, 0, 0], scl = [1, 1, 1]) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(...pos); m.rotation.set(...rot); m.scale.set(...scl);
  m.castShadow = true; m.receiveShadow = true;
  m.userData.cls = cls;
  return m;
}
const excluded = []; // telegraphs + VFX: coloured, but no ink edges
function fx(obj) { excluded.push(obj); obj.traverse((o) => { o.castShadow = false; o.receiveShadow = false; }); return obj; }
function place(group, pos, yaw = 0, s = 1) { group.position.copy(pos); group.rotation.y = yaw; group.scale.setScalar(s); scene.add(group); return group; }

// ---------- floor texture: painted flagstones, ash drifts ----------
function floorTexture(kind) {
  const c = document.createElement('canvas'); c.width = c.height = 2048;
  const g = c.getContext('2d');
  const base = kind === 'boss' ? '#5a5664' : '#7a6e62';
  g.fillStyle = base; g.fillRect(0, 0, 2048, 2048);
  const rnd = (() => { let s = kind === 'boss' ? 99 : 7; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
  // large washes
  for (let i = 0; i < 60; i++) {
    const x = rnd() * 2048, y = rnd() * 2048, r = 120 + rnd() * 380;
    const cols = kind === 'boss' ? ['#393641', '#777b80', '#4a4655', '#6b6674'] : ['#a89a83', '#776054', '#777b80', '#8e8272', '#65715d'];
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, cols[i % cols.length] + '66'); gr.addColorStop(1, cols[i % cols.length] + '00');
    g.fillStyle = gr; g.fillRect(x - r, y - r, 2 * r, 2 * r);
  }
  // flagstones: irregular quads with individual washes and ink seams
  const cell = 128;
  for (let y = 0; y < 2048; y += cell) for (let x = 0; x < 2048; x += cell) {
    const o = (Math.floor(y / cell) % 2) * cell * 0.5;
    const j = () => (rnd() - 0.5) * 14;
    const pts = [[x + o + j(), y + j()], [x + o + cell + j(), y + j()], [x + o + cell + j(), y + cell + j()], [x + o + j(), y + cell + j()]];
    g.beginPath(); pts.forEach(([a, b], i) => (i ? g.lineTo(a, b) : g.moveTo(a, b))); g.closePath();
    const t = rnd();
    g.fillStyle = kind === 'boss' ? `rgba(${t > 0.5 ? '119,123,128' : '57,54,65'},${0.12 + rnd() * 0.2})` : `rgba(${t > 0.6 ? '168,154,131' : t > 0.3 ? '119,96,84' : '119,123,128'},${0.12 + rnd() * 0.22})`;
    g.fill();
    g.strokeStyle = `rgba(36,33,42,${0.16 + rnd() * 0.16})`; g.lineWidth = 1.5 + rnd() * 1.5; g.stroke();
    if (rnd() > 0.82) { // crack
      g.beginPath(); let cx = x + o + rnd() * cell, cy = y + rnd() * cell; g.moveTo(cx, cy);
      for (let k = 0; k < 4; k++) { cx += (rnd() - 0.5) * 60; cy += (rnd() - 0.5) * 60; g.lineTo(cx, cy); }
      g.strokeStyle = 'rgba(36,33,42,.3)'; g.lineWidth = 1.2; g.stroke();
    }
  }
  // ash drifts / ink stains
  for (let i = 0; i < 26; i++) {
    const x = rnd() * 2048, y = rnd() * 2048, r = 30 + rnd() * 120;
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    const col = kind === 'boss' ? '36,33,42' : i % 3 ? '142,135,124' : '36,33,42';
    gr.addColorStop(0, `rgba(${col},.35)`); gr.addColorStop(1, `rgba(${col},0)`);
    g.fillStyle = gr; g.fillRect(x - r, y - r, 2 * r, 2 * r);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(2, 2);
  return tex;
}

// ---------- the Hushed (section 34): folded parchment, stained cloth, ink joints, cracked masks ----------
function mask(r, color = P.paper, crackCls = CLS.enemy) {
  const g = new THREE.Group();
  g.add(mesh(jitter(new THREE.SphereGeometry(r, 7, 5), r * 0.12), mat(color), crackCls, [0, 0, 0], [0, 0, 0], [1, 1.18, 0.72]));
  g.add(mesh(new THREE.BoxGeometry(r * 0.1, r * 1.3, r * 0.1), mat(P.ink), crackCls, [r * 0.12, 0, r * 0.66], [0, 0, 0.35]));
  g.add(mesh(new THREE.BoxGeometry(r * 0.5, r * 0.09, r * 0.1), mat(P.ink), crackCls, [-r * 0.32, r * 0.12, r * 0.64]));
  g.add(mesh(new THREE.BoxGeometry(r * 0.4, r * 0.09, r * 0.1), mat(P.ink), crackCls, [r * 0.38, r * 0.12, r * 0.64]));
  return g;
}
const joint = (pos, r = 0.07, cls = CLS.enemy) => mesh(new THREE.SphereGeometry(r, 6, 4), mat(P.ink), cls, pos);

function husk(cls = CLS.enemy, tint = P.parchment) {
  const g = new THREE.Group();
  const body = mesh(jitter(new THREE.CylinderGeometry(0.24, 0.38, 1.1, 5, 2), 0.08), mat(tint), cls, [0, 0.58, 0], [0.18, 0, 0]);
  g.add(body);
  g.add(mesh(jitter(new THREE.CylinderGeometry(0.33, 0.4, 0.38, 6, 1, true), 0.05), mat(P.umber, { side: THREE.DoubleSide }), cls, [0, 0.72, 0.02], [0.18, 0, 0]));
  g.add(mesh(jitter(new THREE.ConeGeometry(0.2, 0.35, 4), 0.04), mat(tint), cls, [0, 1.23, 0.1], [0.3, 0.6, 0]));
  const m = mask(0.2, P.paper, cls); m.position.set(0, 1.42, 0.2); m.rotation.x = 0.25; g.add(m);
  for (const s of [-1, 1]) {
    g.add(joint([s * 0.3, 1.1, 0.12], 0.07, cls));
    g.add(mesh(jitter(new THREE.BoxGeometry(0.1, 0.5, 0.12), 0.03), mat(tint), cls, [s * 0.36, 0.84, 0.28], [0.9, 0, s * 0.2]));
    g.add(joint([s * 0.38, 0.66, 0.46], 0.06, cls));
    g.add(mesh(new THREE.ConeGeometry(0.06, 0.34, 3), mat(P.paper), cls, [s * 0.38, 0.6, 0.66], [1.7, 0, 0]));
  }
  return g;
}
function hound() {
  const g = new THREE.Group(), cls = CLS.enemy, c = P.warmStone;
  g.add(mesh(jitter(new THREE.BoxGeometry(0.34, 0.32, 1.0, 1, 1, 3), 0.07), mat(c), cls, [0, 0.62, 0], [-0.12, 0, 0]));
  g.add(mesh(jitter(new THREE.ConeGeometry(0.17, 0.5, 4), 0.03), mat(P.paper), cls, [0, 0.82, 0.68], [1.75, 0, 0]));
  g.add(mesh(new THREE.ConeGeometry(0.06, 0.22, 3), mat(c), cls, [0.09, 1.0, 0.5], [-0.3, 0, 0.2]));
  g.add(mesh(new THREE.ConeGeometry(0.06, 0.22, 3), mat(c), cls, [-0.09, 1.0, 0.5], [-0.3, 0, -0.2]));
  for (const [x, z, r] of [[0.14, 0.36, 0.3], [-0.14, 0.36, -0.2], [0.14, -0.36, -0.35], [-0.14, -0.36, 0.25]]) {
    g.add(joint([x, 0.48, z], 0.06));
    g.add(mesh(new THREE.BoxGeometry(0.07, 0.48, 0.07), mat(P.umber), cls, [x, 0.24, z + r * 0.2], [r, 0, 0]));
  }
  g.add(mesh(new THREE.ConeGeometry(0.05, 0.6, 3), mat(c), cls, [0, 0.8, -0.72], [-1.1, 0, 0]));
  return g;
}
function wisp() {
  const g = new THREE.Group(), cls = CLS.enemy;
  const pts = []; for (let i = 0; i <= 12; i++) { const t = i / 12; pts.push(new THREE.Vector2(Math.sin(t * Math.PI) * 0.26 * (1 - t * 0.6), t * 1.0)); }
  g.add(mesh(jitter(new THREE.LatheGeometry(pts, 7), 0.03), mat(0xcfc3a8), cls, [0, 1.0, 0], [Math.PI, 0, 0]));
  const m = mask(0.16, P.paper, cls); m.position.set(0, 1.12, 0.12); g.add(m);
  g.add(mesh(new THREE.SphereGeometry(0.045, 6, 4), new THREE.MeshBasicMaterial({ color: P.danger }), cls, [0.04, 1.14, 0.25]));
  for (const s of [-1, 1]) g.add(mesh(new THREE.BoxGeometry(0.02, 0.6, 0.12), mat(P.parchment, { side: THREE.DoubleSide }), cls, [s * 0.14, 0.4, -0.05], [0.2, 0, s * 0.3]));
  return g;
}
function seer() {
  const g = new THREE.Group(), cls = CLS.enemy;
  g.add(mesh(jitter(new THREE.ConeGeometry(0.42, 1.6, 6, 2), 0.07), mat(P.moss), cls, [0, 0.8, 0]));
  g.add(mesh(jitter(new THREE.CylinderGeometry(0.36, 0.44, 0.3, 6, 1, true), 0.04), mat(P.umber, { side: THREE.DoubleSide }), cls, [0, 0.35, 0]));
  const m = mask(0.2, P.paper, cls); m.position.set(0, 1.72, 0.08); g.add(m);
  g.add(mesh(new THREE.SphereGeometry(0.06, 6, 4), mat(P.ink), cls, [0, 1.72, 0.25]));
  g.add(mesh(new THREE.CylinderGeometry(0.03, 0.03, 2.0, 5), mat(P.umber), cls, [0.45, 1.0, 0.15], [0, 0, -0.08]));
  g.add(mesh(jitter(new THREE.IcosahedronGeometry(0.1, 0), 0.02), mat(P.hazard, { emissive: P.hazard, emissiveIntensity: 0.5 }), cls, [0.53, 2.04, 0.15]));
  return g;
}
function keeper() {
  const g = new THREE.Group(), cls = CLS.elite;
  g.add(mesh(jitter(new THREE.BoxGeometry(0.9, 1.1, 0.6, 2, 2, 2), 0.1), mat(0x8c7e6a), cls, [0, 0.95, 0]));
  g.add(mesh(jitter(new THREE.BoxGeometry(1.2, 0.4, 0.7, 2, 1, 1), 0.08), mat(0x8c7e6a), cls, [0, 1.62, 0]));
  g.add(mesh(jitter(new THREE.CylinderGeometry(0.42, 0.5, 0.5, 6, 1, true), 0.05), mat(P.elite, { side: THREE.DoubleSide }), cls, [0, 0.42, 0]));
  for (const s of [-1, 1]) g.add(mesh(new THREE.BoxGeometry(0.28, 0.45, 0.3), mat(P.umber), cls, [s * 0.24, 0.2, 0]));
  const m = mask(0.26, P.paper, cls); m.position.set(0, 2.05, 0.1); g.add(m);
  // shield
  const sh = mesh(jitter(new THREE.BoxGeometry(0.12, 1.4, 0.9, 1, 3, 2), 0.05), metal(P.coldStone), cls, [-0.72, 1.0, 0.35], [0, 0.35, 0]);
  g.add(sh);
  g.add(mesh(new THREE.BoxGeometry(0.14, 0.12, 0.92), mat(P.ink), cls, [-0.73, 1.3, 0.35], [0, 0.35, 0]));
  // maul raised for the heavy
  g.add(mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.6, 5), mat(P.umber), cls, [0.72, 2.0, 0.1], [0.3, 0, -0.5]));
  g.add(mesh(jitter(new THREE.BoxGeometry(0.5, 0.35, 0.35), 0.05), metal(P.coldStone), cls, [1.06, 2.66, 0.32], [0.3, 0, -0.5]));
  g.add(joint([0.6, 1.62, 0], 0.1, cls)); g.add(joint([-0.6, 1.62, 0], 0.1, cls));
  return g;
}
function boundKing() {
  const g = new THREE.Group(), cls = CLS.boss;
  g.add(mesh(jitter(new THREE.ConeGeometry(1.2, 2.6, 8, 3), 0.14), mat(P.deepWash), cls, [0, 1.3, 0]));
  g.add(mesh(jitter(new THREE.CylinderGeometry(0.7, 1.0, 1.0, 8, 1, true), 0.08), mat(P.parchment, { side: THREE.DoubleSide }), cls, [0, 2.0, 0]));
  g.add(mesh(jitter(new THREE.BoxGeometry(1.8, 0.5, 0.9, 2, 1, 1), 0.1), mat(P.umber), cls, [0, 2.7, 0]));
  const m = mask(0.42, P.paper, cls); m.position.set(0, 3.25, 0.15); g.add(m);
  // crown
  g.add(mesh(new THREE.CylinderGeometry(0.36, 0.4, 0.22, 8, 1, true), metal(P.highValue), cls, [0, 3.72, 0.05]));
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    g.add(mesh(new THREE.ConeGeometry(0.06, 0.34, 4), metal(P.highValue), cls, [Math.sin(a) * 0.38, 3.95, 0.05 + Math.cos(a) * 0.38]));
  }
  // binding chains
  for (const [y, r, tilt] of [[2.3, 0.9, -0.25]]) {
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const l = mesh(new THREE.TorusGeometry(0.1, 0.03, 4, 8), metal(P.coldStone), cls, [Math.sin(a) * r, y + Math.sin(a) * tilt, Math.cos(a) * r], [i % 2 ? Math.PI / 2 : 0, a, 0]);
      g.add(l);
    }
  }
  // arms: one raised, casting
  for (const s of [-1, 1]) {
    g.add(joint([s * 0.95, 2.7, 0], 0.14, cls));
    g.add(mesh(jitter(new THREE.BoxGeometry(0.22, 1.2, 0.22), 0.04), mat(P.parchment), cls, [s * 1.25, s > 0 ? 3.2 : 2.2, 0.2], [s > 0 ? 0.3 : 0.6, 0, s * (s > 0 ? -0.6 : 0.3)]));
  }
  // floating manuscript pages
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    g.add(mesh(new THREE.PlaneGeometry(0.34, 0.46), mat(P.paper, { side: THREE.DoubleSide }), cls, [Math.sin(a) * 1.7, 2.4 + (i % 3) * 0.5, Math.cos(a) * 1.7], [0.3 * i, a, 0.2 * i]));
  }
  return g;
}
function binder() {
  const g = new THREE.Group(), cls = CLS.player;
  g.add(mesh(jitter(new THREE.ConeGeometry(0.42, 1.35, 7, 2), 0.05), mat(0x3e3b4c), cls, [0, 0.68, 0]));
  g.add(mesh(new THREE.ConeGeometry(0.3, 0.95, 7, 1, true, -0.9, 1.8), mat(P.weave, { side: THREE.DoubleSide }), cls, [0, 0.62, 0.05]));
  // mantle: weave-blue cape over the shoulders, trailing
  g.add(mesh(jitter(new THREE.BoxGeometry(0.7, 1.05, 0.08, 2, 3, 1), 0.06), mat(0x55609a), cls, [0, 0.82, -0.26], [-0.18, 0, 0]));
  g.add(mesh(jitter(new THREE.BoxGeometry(0.64, 0.36, 0.38), 0.04), mat(0x4a4660), cls, [0, 1.3, 0]));
  g.add(mesh(new THREE.TorusGeometry(0.3, 0.05, 4, 10), mat(P.paper), cls, [0, 1.0, 0], [Math.PI / 2, 0, 0], [1.1, 0.85, 1]));
  g.add(mesh(jitter(new THREE.ConeGeometry(0.25, 0.5, 7), 0.03), mat(0x4a4660), cls, [0, 1.72, -0.04], [-0.2, 0, 0]));
  g.add(mesh(new THREE.SphereGeometry(0.15, 7, 5), mat(0x1d1b24), cls, [0, 1.55, 0.08]));
  g.add(mesh(new THREE.SphereGeometry(0.035, 5, 4), new THREE.MeshBasicMaterial({ color: 0xaeb8e6 }), cls, [0.06, 1.57, 0.21]));
  g.add(mesh(new THREE.SphereGeometry(0.035, 5, 4), new THREE.MeshBasicMaterial({ color: 0xaeb8e6 }), cls, [-0.06, 1.57, 0.21]));
  // casting arm extended forward, thread spool
  g.add(mesh(new THREE.BoxGeometry(0.12, 0.12, 0.62), mat(0x4a4660), cls, [0.32, 1.25, 0.34], [-0.2, 0.2, 0]));
  g.add(mesh(new THREE.TorusGeometry(0.1, 0.035, 5, 10), mat(P.weave, { emissive: P.weave, emissiveIntensity: 0.7 }), cls, [0.4, 1.3, 0.68]));
  // ground ring (P1 player position readability)
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.62, 48), new THREE.MeshBasicMaterial({ color: P.weave, transparent: true, opacity: 0.55, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.03; g.add(fx(ring));
  return g;
}

// ---------- environment ----------
function pillar(pos, h = 4.2, broken = false) {
  const g = new THREE.Group(), cls = CLS.env;
  const hh = broken ? h * 0.45 : h;
  g.add(mesh(jitter(new THREE.CylinderGeometry(0.42, 0.48, hh, 8, 4), 0.06), mat(P.warmStone), cls, [0, hh / 2, 0]));
  g.add(mesh(jitter(new THREE.BoxGeometry(1.2, 0.3, 1.2), 0.05), mat(P.coldStone), cls, [0, 0.15, 0]));
  if (!broken) g.add(mesh(jitter(new THREE.BoxGeometry(1.2, 0.35, 1.2), 0.05), mat(P.coldStone), cls, [0, h + 0.15, 0]));
  else for (let i = 0; i < 4; i++) g.add(mesh(jitter(new THREE.DodecahedronGeometry(0.22 + i * 0.05, 0), 0.05), mat(P.warmStone), cls, [Math.sin(i * 2) * 0.9, 0.18, Math.cos(i * 2) * 0.9]));
  return place(g, pos);
}
function wall(from, to, h = 3.2) {
  const d = to.clone().sub(from), len = d.length();
  const g = new THREE.Group();
  const n = Math.max(1, Math.round(len / 2.2));
  for (let i = 0; i < n; i++) {
    const hh = h * (0.75 + hash3(i, from.x, to.z) * 0.35);
    g.add(mesh(jitter(new THREE.BoxGeometry(len / n + 0.05, hh, 0.9, 2, 2, 1), 0.12), mat(i % 3 ? P.coldStone : P.warmStone), CLS.env, [-len / 2 + (i + 0.5) * (len / n), hh / 2, 0]));
  }
  g.position.copy(from.clone().add(to).multiplyScalar(0.5));
  g.rotation.y = -Math.atan2(d.z, d.x);
  scene.add(g);
}
function reliquary(pos, yaw) {
  const g = new THREE.Group(), cls = CLS.env;
  g.add(mesh(jitter(new THREE.BoxGeometry(2.0, 0.8, 0.9, 2, 1, 1), 0.06), mat(P.umber), cls, [0, 0.4, 0]));
  g.add(mesh(jitter(new THREE.BoxGeometry(2.1, 0.18, 1.0), 0.04), mat(P.warmStone), cls, [0, 0.88, 0], [0, 0, 0.06]));
  return place(g, pos, yaw);
}
function brazier(pos) {
  const g = new THREE.Group();
  g.add(mesh(jitter(new THREE.CylinderGeometry(0.35, 0.2, 0.4, 7), 0.03), metal(P.coldStone), CLS.env, [0, 1.0, 0]));
  g.add(mesh(new THREE.CylinderGeometry(0.05, 0.08, 0.9, 5), metal(P.coldStone), CLS.env, [0, 0.45, 0]));
  const fire = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), new THREE.MeshBasicMaterial({ color: 0xe0a060, transparent: true, opacity: 0.8 }));
  fire.position.y = 1.28; fire.scale.y = 1.4; g.add(fx(fire));
  const l = new THREE.PointLight(0xe8a868, 6, 7, 1.8); l.position.y = 1.6; g.add(l);
  return place(g, pos);
}
function banner(pos, yaw) {
  const g = new THREE.Group();
  g.add(mesh(jitter(new THREE.PlaneGeometry(0.9, 2.2, 2, 5), 0.12), mat(P.elite, { side: THREE.DoubleSide }), CLS.env, [0, 3.0, 0]));
  return place(g, pos, yaw);
}
function shrine(pos) {
  const g = new THREE.Group(), cls = CLS.interact;
  g.add(mesh(jitter(new THREE.CylinderGeometry(1.1, 1.3, 0.3, 8), 0.04), mat(P.coldStone), cls, [0, 0.15, 0]));
  g.add(mesh(jitter(new THREE.BoxGeometry(0.7, 1.1, 0.5), 0.05), mat(P.warmStone), cls, [0, 0.85, 0]));
  g.add(mesh(new THREE.OctahedronGeometry(0.28, 0), mat(P.interact, { emissive: P.interact, emissiveIntensity: 0.55 }), cls, [0, 1.8, 0]));
  const ring = new THREE.Mesh(new THREE.RingGeometry(1.4, 1.52, 48), new THREE.MeshBasicMaterial({ color: P.interact, transparent: true, opacity: 0.55, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.02; g.add(fx(ring));
  const l = new THREE.PointLight(0x7fc0b0, 10, 7, 1.6); l.position.y = 2; g.add(l);
  return place(g, pos);
}

// ---------- telegraphs (sections 44, 83): 2 px ink perimeter, 25% danger wash ----------
function teleMat(opacity = 0.25) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { col: { value: new THREE.Color(P.danger) }, op: { value: opacity }, cb: { value: COLORBLIND ? 1 : 0 } },
    vertexShader: 'varying vec3 wp; void main(){ vec4 w = modelMatrix*vec4(position,1.); wp=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }',
    fragmentShader: `uniform vec3 col; uniform float op; uniform float cb; varying vec3 wp;
      float h(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
      float n(vec2 p){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),u.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),u.x),u.y);}
      void main(){ float wash = op*(0.65+0.7*n(wp.xz*1.7)*n(wp.xz*4.1+3.));
        if(cb>.5){ float s = step(.5, fract(wp.x*2.4)); wash = mix(wash*.5, op*1.9, s); }
        gl_FragColor = vec4(col, wash); }`,
  });
}
function telegraphCircle(center, r, active = false) {
  const g = new THREE.Group();
  const fill = new THREE.Mesh(new THREE.CircleGeometry(r, 64), teleMat(active ? 0.55 : 0.25));
  const rim = new THREE.Mesh(new THREE.RingGeometry(r - 0.04, r + (COLORBLIND ? 0.06 : 0.025), 96), new THREE.MeshBasicMaterial({ color: P.ink, transparent: true, opacity: 0.9, depthWrite: false }));
  const inner = new THREE.Mesh(new THREE.RingGeometry(r - 0.12, r - 0.06, 96), new THREE.MeshBasicMaterial({ color: active ? P.paper : P.danger, transparent: true, opacity: 0.6, depthWrite: false }));
  for (const m of [fill, rim, inner]) { m.rotation.x = -Math.PI / 2; g.add(m); }
  fill.position.y = 0.02; inner.position.y = 0.025; rim.position.y = 0.03;
  g.position.copy(center);
  scene.add(fx(g)); return g;
}
function telegraphCone(apex, dirYaw, range, arcDeg) {
  const g = new THREE.Group(), a = THREE.MathUtils.degToRad(arcDeg);
  const fill = new THREE.Mesh(new THREE.CircleGeometry(range, 48, -a / 2, a), teleMat(0.28));
  const rimShape = new THREE.Shape(); rimShape.moveTo(0, 0); rimShape.absarc(0, 0, range, -a / 2, a / 2, false); rimShape.lineTo(0, 0);
  const rimPts = rimShape.getPoints(64).map((p) => new THREE.Vector3(p.x, p.y, 0));
  const rim = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(rimPts, true, 'catmullrom', 0.01), 200, 0.03, 4, true), new THREE.MeshBasicMaterial({ color: P.ink }));
  for (const m of [fill, rim]) { m.rotation.x = -Math.PI / 2; g.add(m); }
  fill.position.y = 0.02; rim.position.y = 0.03;
  g.position.copy(apex); g.rotation.y = dirYaw - Math.PI / 2;
  scene.add(fx(g)); return g;
}
function telegraphLane(center, yaw, length, width, active = false) {
  const g = new THREE.Group();
  const fill = new THREE.Mesh(new THREE.PlaneGeometry(width, length), teleMat(active ? 0.55 : 0.25));
  fill.rotation.x = -Math.PI / 2; fill.position.y = 0.02; g.add(fill);
  for (const s of [-1, 1]) {
    const e = new THREE.Mesh(new THREE.PlaneGeometry(0.06, length), new THREE.MeshBasicMaterial({ color: P.ink, transparent: true, opacity: 0.9, depthWrite: false }));
    e.rotation.x = -Math.PI / 2; e.position.set(s * width / 2, 0.03, 0); g.add(e);
  }
  g.position.copy(center); g.rotation.y = yaw;
  scene.add(fx(g)); return g;
}

// ---------- VFX (section 81): wet pigment, brush strokes, ink droplets ----------
function brushStroke(points, color, radius, opacity = 0.6) {
  const curve = new THREE.CatmullRomCurve3(points);
  const geo = new THREE.TubeGeometry(curve, 64, radius, 6, false);
  // taper
  const p = geo.attributes.position, segs = 65, rs = 7;
  for (let i = 0; i < segs; i++) {
    const t = i / (segs - 1), k = Math.sin(t * Math.PI) ** 0.6;
    const c = curve.getPoint(t);
    for (let j = 0; j < rs; j++) {
      const idx = i * rs + j;
      p.setXYZ(idx, c.x + (p.getX(idx) - c.x) * k, c.y + (p.getY(idx) - c.y) * k, c.z + (p.getZ(idx) - c.z) * k);
    }
  }
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false }));
  scene.add(fx(m)); return m;
}
function droplets(center, n, spread, color = P.ink, size = 0.06, seed = 1) {
  const g = new THREE.Group();
  for (let i = 0; i < n; i++) {
    const a = hash3(i, seed, 1) * Math.PI * 2, r = hash3(i, seed, 2) * spread;
    const d = new THREE.Mesh(new THREE.SphereGeometry(size * (0.5 + hash3(i, seed, 3)), 10, 6), new THREE.MeshBasicMaterial({ color }));
    d.position.set(Math.cos(a) * r, 0.3 + hash3(i, seed, 4) * 1.4, Math.sin(a) * r);
    d.scale.set(1, 0.7, 1.6);
    g.add(d);
  }
  g.position.copy(center); scene.add(fx(g)); return g;
}
function splat(center, r, color, opacity = 0.7, seed = 3) {
  const shape = new THREE.Shape();
  for (let i = 0; i <= 24; i++) {
    const a = (i / 24) * Math.PI * 2, rr = r * (0.6 + hash3(i % 24, seed, 5) * 0.6);
    i ? shape.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : shape.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  const m = new THREE.Mesh(new THREE.ShapeGeometry(shape), new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; m.position.set(center.x, 0.035, center.z);
  scene.add(fx(m)); return m;
}
function lootBeam(pos, color = P.exceptional) {
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.22, 2.4, 12, 1, true), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    uniforms: { col: { value: new THREE.Color(color) } },
    vertexShader: 'varying vec2 vU; void main(){ vU = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: 'uniform vec3 col; varying vec2 vU; void main(){ gl_FragColor = vec4(col, .38*(1.-vU.y)*(1.-vU.y)); }',
  }));
  beam.position.set(pos.x, 1.2, pos.z); scene.add(fx(beam));
  splat(pos, 0.45, color, 0.35, Math.round(pos.x * 10));
  const g = new THREE.Group();
  g.add(mesh(new THREE.OctahedronGeometry(0.18, 0), mat(color, { emissive: color, emissiveIntensity: 0.4 }), CLS.loot, [0, 0.3, 0], [0, 0.5, 0], [1, 1.4, 1]));
  return place(g, pos);
}

function projectile(from, to, t) {
  const p = from.clone().lerp(to, t); p.y = 1.15;
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), new THREE.MeshBasicMaterial({ color: P.ink })));
  g.position.copy(p); scene.add(fx(g));
  const back = from.clone().lerp(to, Math.max(0, t - 0.18)); back.y = 1.15;
  brushStroke([back, back.clone().lerp(p, 0.5).add(new THREE.Vector3(0, 0.05, 0)), p], P.danger, 0.07, 0.5);
}

// ---------- lighting: continuous, restrained ----------
scene.add(new THREE.HemisphereLight(0xd8cdb8, 0x393641, SHOT === 'boss' ? 0.9 : 1.05));
const key = new THREE.DirectionalLight(0xf0e2c8, SHOT === 'boss' ? 1.4 : 1.9);
key.position.set(-6, 14, 4); key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
Object.assign(key.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: 1, far: 40 });
key.shadow.bias = -0.0008; key.shadow.radius = 5;
scene.add(key);
const rim = new THREE.DirectionalLight(0x8a94c8, 0.5); rim.position.set(6, 5, -8); scene.add(rim);

// ---------- floor ----------
const floor = new THREE.Mesh(new THREE.PlaneGeometry(34, 34), new THREE.MeshStandardMaterial({ map: floorTexture(SHOT), roughness: 0.9 }));
floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; floor.userData.cls = CLS.env; scene.add(floor);

// ---------- shots ----------
const player = new THREE.Vector3(0, 0, 0);
if (SHOT === 'room') buildRoom();
else if (SHOT === 'boss') buildBoss();
else buildShrine();

function arenaDressing(kind) {
  const R = kind === 'boss' ? 12.5 : 11.5;
  wall(at(-14, 9.5), at(14, 9.5)); wall(at(-14, 9.5), at(-14, -2));
  wall(at(14, 9.5), at(14, -2));
  for (const [x, y, b] of [[-9, 6.5, 0], [9, 6.5, 0], [-9.5, -4, 1], [10, -4.5, 0], [-4, 8.2, 0], [5, 8.2, 1]]) pillar(at(x, y), 4.2, !!b);
  brazier(at(-7, 8)); brazier(at(7.5, 8));
  banner(at(-2, 9.05), -Math.PI / 4); banner(at(2.6, 9.05), -Math.PI / 4);
  return R;
}

function buildRoom() {
  arenaDressing('room');
  reliquary(at(-7.5, 1.5), 0.4); reliquary(at(8, 2.5), -0.3);
  place(binder(), player, facing(player, at(1.5, 2.5)));
  const pack = [
    [husk(), at(1.6, 2.4)], [husk(), at(2.8, 1.2)], [husk(), at(-2.5, 3.0)], [husk(), at(0.2, 4.6)],
    [hound(), at(-3.8, -0.8)], [wisp(), at(6.4, 2.6)], [seer(), at(-6.2, 4.8)],
  ];
  for (const [g, p] of pack) place(g, p, facing(p, player));
  const kp = at(4.6, 4.2); place(keeper(), kp, facing(kp, player), 1.12);
  // Keeper heavy: cone telegraph toward the Binder
  telegraphCone(kp, facing(kp, player), 3.2, 80);
  // Seer hazard pool (radius 220 cm) and a second, activating pool
  telegraphCircle(at(-4.8, 2.4), 2.2);
  telegraphCircle(at(-3.6, -2.6), 2.2, true);
  // Wisp shot in flight
  projectile(at(6.4, 2.6), player, 0.5);
  // Thread Lash: 100° arc brush stroke, 320 cm
  const lashPts = [];
  const aim = facing(player, at(1.5, 2.5));
  for (let i = 0; i <= 8; i++) {
    const a = aim - THREE.MathUtils.degToRad(50) + (i / 8) * THREE.MathUtils.degToRad(100);
    lashPts.push(new THREE.Vector3(Math.sin(a) * 2.6, 1.1 + Math.sin((i / 8) * Math.PI) * 0.35, Math.cos(a) * 2.6));
  }
  brushStroke(lashPts, P.weave, 0.16, 0.55);
  brushStroke(lashPts.map((p) => p.clone().multiplyScalar(0.93).setY(p.y + 0.05)), P.playerEdge, 0.04, 0.9);
  droplets(at(1.6, 2.4), 12, 0.7, P.ink, 0.05, 2);
  splat(at(1.9, 2.8), 0.5, P.ink, 0.55, 4);
  // husk dying: pigment breakup
  const dp = at(3.2, -1.4);
  splat(dp, 1.0, P.parchment, 0.55, 8); splat(dp, 0.55, P.umber, 0.6, 9);
  droplets(dp, 26, 0.9, 0xb9a988, 0.07, 5); droplets(dp, 10, 0.6, P.ink, 0.05, 6);
  // loot
  lootBeam(at(-0.6, -2.4));
  lootBeam(at(4.4, -2.6), P.rare);
  const bundle = new THREE.Group();
  for (let i = 0; i < 4; i++) bundle.add(mesh(new THREE.IcosahedronGeometry(0.11, 0), mat(0x6f9a97), CLS.loot, [Math.sin(i) * 0.2, 0.12, Math.cos(i * 2) * 0.2]));
  place(bundle, at(-5.2, -2.8));
  frame(at(0.6, 1.1));
}

function buildBoss() {
  arenaDressing('boss');
  const bp = at(0.5, 5.0);
  place(binder(), player, facing(player, bp));
  place(boundKing(), bp, facing(bp, player), 1.0);
  // Phase 3: Manuscript Collapse, three lanes 200 cm wide
  const laneYaw = facing(bp, player);
  for (const [dx, act] of [[-3.4, true], [0, false], [3.4, false]]) {
    const c = bp.clone().add(at(dx, -4.5));
    telegraphLane(c, laneYaw + 0, 13, 2.0, act);
  }
  // Grand Fracture: strikes at 250 / 450 / 650 cm, radius 180 cm
  const dir = bp.clone().sub(player).normalize();
  const strikes = [2.5, 4.5, 6.5].map((d) => player.clone().add(dir.clone().multiplyScalar(d)).add(at(-1.2, 0)));
  strikes.forEach((s, i) => {
    splat(s, 1.8, P.weave, 0.3, 20 + i);
    splat(s, 0.7, P.playerEdge, 0.45, 30 + i);
    droplets(s, 7, 1.2, P.ink, 0.045, 40 + i);
    // fracture line brush
    brushStroke([s.clone().add(new THREE.Vector3(-1, 0.1, 0.4)), s.clone().add(new THREE.Vector3(0, 0.4, 0)), s.clone().add(new THREE.Vector3(1.1, 0.1, -0.3))], P.playerEdge, 0.05, 0.9);
  });
  // adds from the 80% call, pigment dissolving
  for (const p of [at(-6, 2.5), at(5.8, 1.6)]) { place(husk(), p, facing(p, player)); }
  const d = at(-4.2, -1.8); splat(d, 1.1, P.parchment, 0.5, 50); droplets(d, 22, 0.9, 0xb9a988, 0.07, 51);
  lootBeam(at(6.5, -3.2), P.highValue);
  frame(at(0.2, 2.2));
}

function buildShrine() {
  arenaDressing('room');
  reliquary(at(-6.5, -2), 0.8);
  const sp = at(1.2, 3.2);
  shrine(sp);
  place(binder(), at(-0.6, 0.6), facing(at(-0.6, 0.6), sp));
  lootBeam(at(3.8, -0.8));
  lootBeam(at(-4.2, 3.8), P.rare);
  for (const [p, s] of [[at(-6.5, 4.8), 11], [at(6.8, 1.2), 12]]) { splat(p, 1.0, P.parchment, 0.45, s); splat(p, 0.5, P.ink, 0.35, s + 1); }
  frame(at(0.2, 1.4));
}

// ---------- passes ----------
const rtOpts = { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter };
const rtColor = new THREE.WebGLRenderTarget(W, H, { ...rtOpts, type: THREE.HalfFloatType, samples: 4 });
const rtDepthNoMSAA = new THREE.WebGLRenderTarget(W, H, rtOpts);
rtDepthNoMSAA.depthTexture = new THREE.DepthTexture(W, H); rtDepthNoMSAA.depthTexture.type = THREE.UnsignedIntType;
const rtNormal = rtDepthNoMSAA; // normals + depth for edges, no MSAA so edges stay crisp
const rtId = new THREE.WebGLRenderTarget(W, H, rtOpts);

function withHidden(fn) {
  excluded.forEach((o) => (o.visible = false));
  fn();
  excluded.forEach((o) => (o.visible = true));
}
const normalMat = new THREE.MeshNormalMaterial({ flatShading: true });
const idMats = Object.fromEntries(Object.values(CLS).map((v) => [v, new THREE.MeshBasicMaterial({ color: new THREE.Color(v / 10, 0, 0) })]));
function renderId() {
  const saved = new Map();
  scene.traverse((o) => {
    if (o.isMesh) {
      let cls = o.userData.cls, p = o.parent;
      while (cls === undefined && p) { cls = p.userData.cls; p = p.parent; }
      saved.set(o, o.material); o.material = idMats[cls ?? 0];
    }
  });
  const bg = scene.background; scene.background = new THREE.Color(0, 0, 0);
  renderer.setRenderTarget(rtId); renderer.render(scene, camera);
  scene.background = bg;
  saved.forEach((m, o) => (o.material = m));
}

const post = new THREE.ShaderMaterial({
  uniforms: {
    tColor: { value: rtColor.texture }, tNormal: { value: rtNormal.texture }, tDepth: { value: rtNormal.depthTexture }, tId: { value: rtId.texture },
    res: { value: new THREE.Vector2(W, H) }, near: { value: camera.near }, far: { value: camera.far },
  },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }',
  fragmentShader: /* glsl */ `
    uniform sampler2D tColor, tNormal, tDepth, tId; uniform vec2 res; uniform float near, far;
    varying vec2 vUv;
    float lin(float d){ float z = d*2.-1.; return (2.*near*far)/(far+near - z*(far-near)); }
    float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
    float noise(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.-2.*f);
      return mix(mix(hash(i),hash(i+vec2(1,0)),u.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x), u.y); }
    float fbm(vec2 p){ float v=0., a=.5; for(int i=0;i<5;i++){ v+=a*noise(p); p=p*2.03+17.1; a*=.5; } return v; }
    int idAt(vec2 uv){ return int(floor(texture2D(tId, uv).r*10.+.5)); }
    float widthFor(int id){ // reference line widths at 1080p (section 80)
      if(id==1) return 2.0; if(id==2) return 1.5; if(id==3) return 2.0; if(id==4) return 2.5; if(id==5) return 1.75; if(id==6) return 1.5; return 0.8; }
    vec3 inkFor(int id){
      if(id==1) return vec3(0.188,0.212,0.353);  // #30365A
      if(id==3) return vec3(0.329,0.192,0.192);  // #543131
      if(id==5) return vec3(0.192,0.357,0.341);  // #315B57
      return vec3(0.141,0.129,0.165);            // #24212A, never pure black
    }
    vec3 toSRGB(vec3 c){ return pow(max(c, 0.), vec3(1./2.2)); }
    vec3 sat(vec3 c, float s){ float l = dot(c, vec3(.299,.587,.114)); return mix(vec3(l), c, s); }
    void main(){
      vec2 px = 1./res;
      vec2 sp = vUv*res;
      // wet pigment breakup: pigment drifts ~2 px off the ink line
      vec2 wob = (vec2(fbm(sp/70.), fbm(sp/70.+31.7)) - .5) * 4. * px;
      vec3 col = toSRGB(texture2D(tColor, vUv + wob).rgb);
      // wet bleed: pigment spreads into a soft, noisy neighbourhood
      vec3 blur = vec3(0.);
      for(int k=0; k<12; k++){
        float a = float(k)*2.39996 + fbm(sp/40.)*6.28;
        float r = (1.5 + float(k)*.45) * (0.6 + fbm(sp/55.+3.));
        blur += toSRGB(texture2D(tColor, vUv + wob + vec2(cos(a), sin(a))*r*px).rgb);
      }
      blur /= 12.;
      float wet = smoothstep(.35, .75, fbm(sp/160. + 11.));
      col = mix(col, blur, .35 + .4*wet);
      // pigment pools where a wash meets a lighter or darker wash
      float lc = abs(dot(col - blur, vec3(.3,.59,.11)));
      col *= 1. - clamp(lc*1.6, 0., .06);

      float d0 = lin(texture2D(tDepth, vUv).r);
      vec3 n0 = texture2D(tNormal, vUv).rgb*2.-1.;
      int i0 = idAt(vUv);
      float cover = 0.; int eid = 0;
      for(int y=-2; y<=2; y++) for(int x=-2; x<=2; x++){
        vec2 o = vec2(float(x), float(y)); float dist = length(o);
        if(dist < .5 || dist > 2.3) continue;
        vec2 uv = vUv + o*px;
        float d1 = lin(texture2D(tDepth, uv).r);
        vec3 n1 = texture2D(tNormal, uv).rgb*2.-1.;
        int i1 = idAt(uv);
        bool disc = (i1 != i0) || abs(d1-d0) > 0.025*min(d0,d1) || dot(n0,n1) < 0.55;
        if(!disc) continue;
        int fid = d1 < d0 ? i1 : i0;
        if(i1 != i0) fid = i0 > i1 ? i0 : i1;
        float r = widthFor(fid)*.5 + .35;
        float c = clamp(r - dist + .5, 0., 1.);
        if(c > cover){ cover = c; eid = fid; }
      }
      // edge pooling: pigment darkens up to 8% near a boundary (section 79)
      float pool = 0.;
      for(int k=0; k<8; k++){
        float a = float(k)*.785398;
        for(int s=1; s<=3; s++){
          vec2 uv = vUv + vec2(cos(a), sin(a))*float(s)*2.5*px;
          if(idAt(uv) != i0 || abs(lin(texture2D(tDepth, uv).r)-d0) > 0.04*d0){ pool = max(pool, 1. - float(s-1)/3.); }
        }
      }
      col *= 1. - .08*pool;
      // two-octave pigment variation: brightness ±5%, saturation ±7%
      float v1 = fbm(sp/220.), v2 = fbm(sp/90.+7.);
      col *= 1. + (v1 - .5)*.10;
      col = sat(col, 1. + (v2 - .5)*.14);
      // granulation in darker washes
      float lum = dot(col, vec3(.299,.587,.114));
      col *= 1. - .07*noise(sp/1.7)*(1.-lum);
      // paper: large fibres 0.035, small fibres 0.020 (section 78)
      float paper = (fbm(vec2(sp.x/9., sp.y/38.)) - .5)*2.*.035 + (noise(sp/2.2) - .5)*2.*.020;
      col *= 1. + paper;
      col = mix(col, col*vec3(1.03,1.0,.93), .5); // warm paper under the wash
      // ink, with slight brush opacity variation
      vec3 ink = inkFor(eid);
      float inkA = cover * (.9 + .1*noise(sp/3.));
      col = mix(col, ink, inkA);
      // restrained vignette
      vec2 q = vUv - .5; col *= 1. - .35*dot(q*vec2(1.2,1.), q*vec2(1.2,1.));
      gl_FragColor = vec4(col, 1.);
    }`,
});
const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), post);
const postScene = new THREE.Scene(); postScene.add(quad);
const postCam = new THREE.Camera();

// colour
renderer.setRenderTarget(rtColor); renderer.render(scene, camera);
// normals + depth (no telegraphs / VFX)
withHidden(() => {
  scene.overrideMaterial = normalMat;
  const bg = scene.background; scene.background = new THREE.Color(0.5, 0.5, 1);
  renderer.setRenderTarget(rtNormal); renderer.render(scene, camera);
  scene.background = bg; scene.overrideMaterial = null;
  renderId();
});
renderer.setRenderTarget(null);
renderer.render(postScene, postCam);
window.__ready = true;
