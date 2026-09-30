// In-browser stand-in for Ender's in-combat look (spec sections 15, 75–85).
// One unit = 1 m (spec values are in cm and divided by 100).
// Pipeline: colour pass → view normals pass → class-ID pass → post shader that
// draws ink outlines per class width and applies the watercolour treatment.
import * as THREE from '../vendor/three.module.min.js';

const q = new URLSearchParams(location.search);
const SHOT = q.get('shot') || 'room';
const COLORBLIND = q.get('cb') === '1';
// 'mj' (default): cinematic, painterly grade in the classic Midjourney vein. 'spec': the restrained section 75-85 look.
const STYLE = q.get('style') || 'mj';
const MJ = STYLE === 'mj';
const W = 1920, H = 1080;

// ---------- palette (section 76) ----------
const P = {
  ink: 0x24212a, playerEdge: 0x30365a, elite: 0x543131, interactable: 0x315b57,
  paper: 0xe7ddc6, warmStone: 0xa89a83, coldStone: 0x777b80, moss: 0x65715d, umber: 0x776054, deepWash: 0x393641,
  weave: 0x6676b8, health: 0xb84f49, danger: 0xe16a54, hazard: 0x9a8d42, interact: 0x5b9486,
  rare: 0x597da2, exceptional: 0x8667a3, highValue: 0xc09a50, parchment: 0xb9a988,
};
// mj: the same roles in jewel tones (Mark, 2026-09-30: Midjourney-flavoured colours, spec rendering).
if (MJ) Object.assign(P, {
  warmStone: 0x9a8570, coldStone: 0x5f6680, umber: 0x5e3b3a, moss: 0x2f6f63, deepWash: 0x2e2448, elite: 0x7a1f2e,
  weave: 0x4f6fe0, danger: 0xe8583c, hazard: 0xb89a2e, interact: 0x2fa89a, rare: 0x3f7fd0, exceptional: 0x9b59d0, highValue: 0xd4a64a, parchment: 0xc8b48c,
});
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
scene.background = new THREE.Color(MJ ? 0x0c0a16 : 0x1c1a21);
const camera = new THREE.PerspectiveCamera(38, W / H, 1, 60);
const YAW = THREE.MathUtils.degToRad(45), PITCH = THREE.MathUtils.degToRad(SHOT === 'lineup' ? 20 : 52);
const ARM = SHOT === 'lineup' ? 9.5 : 15.5; // lineup is a low, closer reference view (a model sheet), not the game camera
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
// mj: smooth shading and a little sheen so light rolls over forms like paint; spec: matte and faceted.
const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: MJ ? 0.6 : 0.82, metalness: 0, flatShading: !MJ, ...o });
const metal = (color) => mat(color, MJ ? { metalness: 0.45, roughness: 0.4 } : { metalness: 0.65, roughness: 0.68 });
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
  const base = MJ ? (kind === 'boss' ? '#4a4660' : '#6e6470') : kind === 'boss' ? '#5a5664' : '#7a6e62';
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
    g.fillStyle = kind === 'boss' ? `rgba(${t > 0.5 ? '119,123,128' : '57,54,65'},${0.12 + rnd() * 0.2})` : MJ ? `rgba(${t > 0.6 ? '154,133,112' : t > 0.3 ? '94,59,58' : '80,96,140'},${0.14 + rnd() * 0.24})` : `rgba(${t > 0.6 ? '168,154,131' : t > 0.3 ? '119,96,84' : '119,123,128'},${0.12 + rnd() * 0.22})`;
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

// ---------- figure toolkit: sculpted lathes, organic limbs, draped cloth ----------
// Figures face +Z. Heights follow heroic proportions (about 7.5 heads).
const soft = (color, o = {}) => mat(color, { flatShading: false, ...o });
const glow = (color, k = 1.6) => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: k, roughness: 0.5 });
const V = (a) => (a.isVector3 ? a : new THREE.Vector3(...a));
const Y_AXIS = new THREE.Vector3(0, 1, 0);
const smoothProfile = (pts, n = 5) => new THREE.SplineCurve(pts.map(([r, y]) => new THREE.Vector2(r, y))).getPoints((pts.length - 1) * n);

// A lathed form from a [[radius, y], ...] profile (bottom to top), smoothed into curves.
// folds: cloth ripples that deepen toward the hem. sx/sz: elliptical section. tear: ragged hem.
function lathe(g, profile, material, cls, { seg = 36, folds = 0, foldDepth = 0.05, sx = 1, sz = 1, tear = 0, seed = 1, phiStart = 0, phiLength = Math.PI * 2, pos, rot, scl, smooth = true } = {}) {
  const pts = smooth ? smoothProfile(profile) : profile.map(([r, y]) => new THREE.Vector2(r, y));
  const geo = new THREE.LatheGeometry(pts, seg, phiStart, phiLength);
  const p = geo.attributes.position, rows = pts.length, y0 = pts[0].y, y1 = pts[rows - 1].y;
  for (let i = 0; i < p.count; i++) {
    const row = i % rows, col = Math.floor(i / rows);
    const phi = phiStart + (col / seg) * phiLength;
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const hem = 1 - (y - y0) / Math.max(1e-6, y1 - y0);
    let k = 1;
    if (folds) k += foldDepth * hem * hem * (Math.sin(phi * folds + hash3(seed, 1, 1) * 6) * 0.7 + Math.sin(phi * folds * 2.3 + seed) * 0.3);
    if (tear && row === 0) { const h = hash3(col % seg, seed, 7); y += (h - 0.35) * tear; k *= 1 + (h - 0.5) * tear; }
    p.setXYZ(i, x * k * sx, y, z * k * sz);
  }
  geo.computeVertexNormals();
  if (phiLength < Math.PI * 2 || folds || tear) material.side = THREE.DoubleSide;
  const m = mesh(geo, material, cls, pos, rot, scl);
  g.add(m); return m;
}
// An organic limb from a to b: rounded ends, a muscle swell at `bulge` along its length.
function limb(g, a, b, r0, r1, material, cls, bulge = 0.12, at = 0.35) {
  const A = V(a), B = V(b), d = B.clone().sub(A), len = d.length();
  const rm = (r0 + (r1 - r0) * at) * (1 + bulge);
  const m = lathe(new THREE.Group(), [[0.001, -r0 * 0.7], [r0 * 0.75, -r0 * 0.4], [r0, 0], [rm, len * at], [r1, len], [r1 * 0.75, len + r1 * 0.4], [0.001, len + r1 * 0.7]], material, cls, { seg: 20 });
  m.position.copy(A); m.quaternion.setFromUnitVectors(Y_AXIS, d.normalize());
  g.add(m); return m;
}
const ball = (g, pos, r, material, cls, scl = [1, 1, 1], rot = [0, 0, 0]) => { const m = mesh(new THREE.SphereGeometry(r, 24, 16), material, cls, pos, rot, scl); g.add(m); return m; };
// A trim band (torus) lying flat at height y, elliptical.
function band(g, y, r, tube, material, cls, sx = 1, sz = 1, pos = [0, 0, 0], tilt = 0) {
  const m = mesh(new THREE.TorusGeometry(r, tube, 8, 40), material, cls, [pos[0], y, pos[2]], [Math.PI / 2 + tilt, 0, 0], [sx, sz, 1]);
  g.add(m); return m;
}
// A hand: palm with a thumb and a curl of fingers, pointing along dir.
function hand(g, at, dir, r, material, cls, { claws = 0, clawMat } = {}) {
  const A = V(at), D = V(dir).normalize();
  const h = new THREE.Group(); h.position.copy(A); h.quaternion.setFromUnitVectors(Y_AXIS, D);
  ball(h, [0, r * 0.6, 0], r, material, cls, [1, 1.35, 0.6]);
  limb(h, [r * 0.8, r * 0.3, r * 0.3], [r * 1.2, r * 1.2, r * 0.5], r * 0.3, r * 0.25, material, cls, 0);
  for (let i = 0; i < 4; i++) {
    const x = (i - 1.5) * r * 0.42, base = [x, r * 1.6, 0], tip = [x * 1.1, r * 2.6, r * 0.35];
    limb(h, base, tip, r * 0.2, r * 0.16, material, cls, 0);
    if (claws) limb(h, tip, [x * 1.15, r * 2.6 + claws, r * 0.9], r * 0.12, r * 0.02, clawMat ?? material, cls, 0);
  }
  g.add(h); return h;
}
// A face-mask of cracked porcelain for the Hushed: brow ridge, cheekbones, glowing eye slits.
function mask(g, pos, r, cls, eye, { tilt = 0, color = P.paper } = {}) {
  const m = new THREE.Group(); m.position.copy(V(pos)); m.rotation.x = tilt; g.add(m);
  ball(m, [0, 0, 0], r, soft(color), cls, [0.86, 1.12, 0.9]);
  ball(m, [0, r * 0.28, r * 0.52], r * 0.52, soft(color), cls, [1.6, 0.4, 0.7]); // brow
  for (const s of [-1, 1]) {
    ball(m, [s * r * 0.36, r * 0.08, r * 0.78], r * 0.2, glow(eye, 2.2), cls, [1.3, 0.45, 0.4], [0, 0, s * -0.3]);
    ball(m, [s * r * 0.5, -r * 0.3, r * 0.55], r * 0.26, soft(color), cls, [1, 0.6, 0.8]); // cheek
  }
  m.add(mesh(new THREE.BoxGeometry(r * 0.05, r * 0.9, r * 0.06), soft(P.ink), cls, [r * 0.14, -r * 0.1, r * 0.84], [0.1, 0, 0.3]));
  return m;
}
// A deep cowl hood: open at the front, a shadow inside, optional glowing eyes.
function hood(g, pos, r, material, cls, eye, { peak = 0.9, drape = 1 } = {}) {
  const h = new THREE.Group(); h.position.copy(V(pos)); g.add(h);
  lathe(h, [[r * 1.5 * drape, -r * 1.3], [r * 1.25, -r * 0.8], [r * 1.12, 0], [r * 0.95, r * 0.7], [r * 0.45, r * 1.2], [0.02, r * (1.2 + peak * 0.6)]], material, cls,
    { phiStart: Math.PI * 0.22, phiLength: Math.PI * 1.56, pos: [0, 0, -r * 0.12], seg: 32 });
  ball(h, [0, -r * 0.05, r * 0.05], r * 0.9, soft(0x0e0c14), cls, [1, 1.05, 0.9]);
  if (eye) for (const s of [-1, 1]) ball(h, [s * r * 0.3, -r * 0.02, r * 0.82], r * 0.1, glow(eye, 2.4), cls, [1.3, 0.6, 0.5]);
  return h;
}
// A shield from a 2D outline, bevelled, with a rim and boss.
function shieldFrom(shape, depth, face, rimMat, cls) {
  const g = new THREE.Group();
  g.add(mesh(new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.04, bevelSegments: 2, curveSegments: 24 }), face, cls));
  const pts = shape.getPoints(48);
  const rim = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(p.x, p.y, depth + 0.03)), true);
  g.add(mesh(new THREE.TubeGeometry(rim, 120, 0.035, 6, true), rimMat, cls));
  return g;
}

// Ender colours. mj: jewel tones in the Midjourney vein; spec: the section 76 palette.
const J = MJ
  ? { sapphire: 0x2c4ea8, deepBlue: 0x1a2458, navy: 0x161c3e, gold: 0xc9993c, oxblood: 0x6e1e2c, verdigris: 0x2c6a5e, violet: 0x4a2a7a, ember: 0xff7a3c,
      ghost: 0x9cc8d0, ghostCloth: 0x3f6670, iron: 0x6a7084, steel: 0x8d93a6, leather: 0x4a3028, bone: 0xd9ccb0, skin: 0xc9a488, parchment: 0xc4b089, husk: 0x8f8470, ash: 0x3c3844, teal: 0x5fe0d0 }
  : { sapphire: P.weave, deepBlue: 0x3e3b4c, navy: P.playerEdge, gold: P.highValue, oxblood: P.elite, verdigris: P.moss, violet: P.deepWash, ember: P.danger,
      ghost: 0xcfc3a8, ghostCloth: 0x8a8272, iron: P.coldStone, steel: 0x9a9ea4, leather: P.umber, bone: 0xd8cdb4, skin: 0xc8b8a0, parchment: P.parchment, husk: 0xa89a83, ash: 0x5a5560, teal: P.interact };
const goldM = () => metal(J.gold);

// ---------- the Binder: a hooded thread-mage in a long robe, staff in the left hand, casting with the right ----------
function binder() {
  const g = new THREE.Group(), cls = CLS.player;
  const robe = soft(J.sapphire), mantle = soft(J.navy), under = soft(J.deepBlue), leather = soft(J.leather), skin = soft(J.skin), gold = goldM();
  // robe: fitted at the chest, falling in folds to a flared hem, split at the front over an underrobe
  lathe(g, [[0.4, 0.02], [0.34, 0.3], [0.26, 0.75], [0.2, 0.98], [0.22, 1.2], [0.25, 1.38], [0.16, 1.52]], robe, cls, { folds: 9, foldDepth: 0.09, tear: 0.04, seed: 3, sx: 1.05, sz: 0.9, phiStart: 0.35, phiLength: Math.PI * 2 - 0.7 });
  lathe(g, [[0.36, 0.03], [0.3, 0.4], [0.22, 0.9], [0.2, 1.0]], under, cls, { folds: 5, foldDepth: 0.05, phiStart: -0.5, phiLength: 1.0, sz: 0.92 });
  band(g, 0.06, 0.39, 0.018, gold, cls, 1.05, 0.9);
  // belt, buckle, pouches
  band(g, 0.99, 0.2, 0.03, leather, cls, 1.08, 0.9);
  ball(g, [0, 0.99, 0.19], 0.04, gold, cls, [1.1, 1, 0.5]);
  for (const s of [-1, 1]) ball(g, [s * 0.2, 0.9, 0.07], 0.06, leather, cls, [0.9, 1.2, 0.8]);
  // mantle: shoulder cape draped behind to the calves, open at the front, gold-edged
  lathe(g, [[0.46, 0.35], [0.4, 0.8], [0.32, 1.2], [0.3, 1.42], [0.2, 1.55]], mantle, cls, { folds: 7, foldDepth: 0.12, tear: 0.06, seed: 9, phiStart: Math.PI * 0.58, phiLength: Math.PI * 0.84, sx: 1.12 });
  band(g, 1.46, 0.26, 0.022, gold, cls, 1.1, 0.95);
  for (const s of [-1, 1]) ball(g, [s * 0.24, 1.44, 0], 0.11, mantle, cls, [1.1, 0.8, 1.1]); // shoulders
  // arms: left holds the staff, right casts forward
  limb(g, [-0.24, 1.42, 0], [-0.3, 1.16, 0.08], 0.065, 0.055, robe, cls);
  lathe(g, [[0.055, 0], [0.07, 0.12], [0.1, 0.22]], robe, cls, { pos: [-0.3, 1.16, 0.08], rot: [1.9, 0, -0.1], folds: 4, foldDepth: 0.05 }); // sleeve
  hand(g, [-0.33, 1.02, 0.22], [0, -0.3, 1], 0.035, skin, cls);
  limb(g, [0.24, 1.42, 0], [0.34, 1.36, 0.26], 0.065, 0.055, robe, cls);
  lathe(g, [[0.055, 0], [0.07, 0.12], [0.11, 0.24]], robe, cls, { pos: [0.34, 1.36, 0.26], rot: [1.45, 0, -0.2], folds: 4, foldDepth: 0.05 });
  hand(g, [0.37, 1.37, 0.52], [0.1, 0.3, 1], 0.036, skin, cls);
  // weave rune circle at the casting hand
  const rune = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.012, 6, 48), glow(P.weave, 2.2)); rune.position.set(0.39, 1.4, 0.62); rune.userData.cls = cls; g.add(rune);
  const rune2 = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.008, 6, 6), glow(P.weave, 2.2)); rune2.position.copy(rune.position); rune2.rotation.z = 0.3; rune2.userData.cls = cls; g.add(rune2);
  // neck and hood with the face in shadow
  limb(g, [0, 1.5, 0.01], [0, 1.6, 0.03], 0.05, 0.05, skin, cls, 0);
  hood(g, [0, 1.72, 0.03], 0.13, mantle, cls, 0x9fb4ff, { drape: 1.4 });
  band(g, 1.56, 0.14, 0.014, gold, cls, 1.2, 1.1, [0, 0, 0.04], -0.25);
  // staff: tapered shaft, gold collars, a crescent head cradling a floating crystal
  const sx = -0.34, sz = 0.23;
  limb(g, [sx, 0.02, sz], [sx + 0.02, 2.0, sz], 0.018, 0.024, leather, cls, 0.05, 0.6);
  for (const y of [0.98, 1.9]) band(g, y, 0.028, 0.01, gold, cls, 1, 1, [sx + 0.01, 0, sz]);
  const head = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.018, 8, 24, Math.PI * 1.5), gold); head.position.set(sx + 0.02, 2.1, sz); head.rotation.set(0, 0.4, Math.PI * 1.25); head.castShadow = true; head.userData.cls = cls; g.add(head);
  ball(g, [sx + 0.02, 2.1, sz], 0.045, glow(P.weave, 2.4), cls, [0.8, 1.4, 0.8]);
  // ground ring (P1 player position readability)
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.58, 0.64, 48), new THREE.MeshBasicMaterial({ color: P.weave, transparent: true, opacity: 0.5, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.03; g.add(fx(ring));
  return g;
}

// ---------- the Hushed (section 34): parchment flesh, bone, stained cloth, porcelain masks ----------
// Husk: a gaunt, hunched ghoul. Variants lean and reach differently so a pack doesn't read as clones.
let huskN = 0;
function husk() {
  const v = huskN++ % 4, g = new THREE.Group(), cls = CLS.enemy;
  const flesh = soft(J.husk), bone = soft(J.bone), rag = soft(J.oxblood), wrap = soft(J.leather);
  const lean = [0.55, 0.4, 0.65, 0.3][v], reach = [0.55, 0.25, 0.4, 0.15][v];
  // legs: bent, digitigrade-ish, wrapped shins
  for (const s of [-1, 1]) {
    const hip = [s * 0.11, 0.84, -0.04], knee = [s * 0.15, 0.48, 0.14], ankle = [s * 0.13, 0.1, -0.04];
    limb(g, hip, knee, 0.07, 0.05, flesh, cls, 0.18);
    limb(g, knee, ankle, 0.05, 0.035, wrap, cls, 0.1);
    ball(g, knee, 0.055, bone, cls);
    ball(g, [s * 0.13, 0.04, 0.05], 0.06, flesh, cls, [0.9, 0.5, 1.8]);
  }
  // loincloth and a torn shawl
  lathe(g, [[0.22, 0.52], [0.2, 0.7], [0.16, 0.9]], rag, cls, { folds: 6, foldDepth: 0.2, tear: 0.12, seed: 11 + v });
  // hunched torso: pelvis → spine curving forward, ribs showing through parchment skin
  const torso = new THREE.Group(); torso.position.set(0, 0.86, -0.04); torso.rotation.x = lean; g.add(torso);
  lathe(torso, [[0.1, 0], [0.12, 0.12], [0.17, 0.3], [0.2, 0.44], [0.17, 0.56], [0.07, 0.64]], flesh, cls, { sx: 1.15, sz: 0.8 });
  for (let i = 0; i < 4; i++) band(torso, 0.24 + i * 0.075, 0.172 + (i === 2 ? 0.01 : 0) - Math.abs(i - 2) * 0.008, 0.016, bone, cls, 1.18, 0.84, [0, 0, 0.012]);
  for (let i = 0; i < 5; i++) ball(torso, [0, 0.12 + i * 0.1, -0.19], 0.028, bone, cls); // spine knuckles
  lathe(torso, [[0.3, 0.3], [0.26, 0.48], [0.18, 0.62]], rag, cls, { phiStart: Math.PI * 0.55, phiLength: Math.PI * 0.9, folds: 5, foldDepth: 0.25, tear: 0.1, seed: 12 + v });
  // head thrust forward on a long neck
  const neckBase = new THREE.Vector3(0, 0.62, 0).applyEuler(torso.rotation).add(torso.position);
  const headPos = neckBase.clone().add(new THREE.Vector3(0, 0.08, 0.14));
  limb(g, neckBase, headPos, 0.045, 0.04, flesh, cls, 0);
  mask(g, headPos.clone().add(new THREE.Vector3(0, 0.07, 0.04)), 0.105, cls, J.ember, { tilt: -0.15 });
  // long arms ending in clawed hands
  const shoulder = new THREE.Vector3(0, 0.52, 0).applyEuler(torso.rotation).add(torso.position);
  for (const s of [-1, 1]) {
    const sh = shoulder.clone().add(new THREE.Vector3(s * 0.22, 0, 0));
    const r = s > 0 ? reach : 0.2;
    const el = sh.clone().add(new THREE.Vector3(s * 0.1, -0.26, 0.12 + r * 0.25));
    const wr = el.clone().add(new THREE.Vector3(s * 0.02, -0.18 + r * 0.25, 0.14 + r * 0.3));
    ball(g, sh, 0.06, bone, cls);
    limb(g, sh, el, 0.045, 0.036, flesh, cls, 0.1);
    ball(g, el, 0.04, bone, cls);
    limb(g, el, wr, 0.036, 0.028, flesh, cls, 0.08);
    hand(g, wr, wr.clone().sub(el), 0.04, flesh, cls, { claws: 0.07, clawMat: bone });
  }
  return g;
}
// Hound: a lean, deep-chested wolf of ash and bone, porcelain plate over the face.
function hound() {
  const g = new THREE.Group(), cls = CLS.enemy, coat = soft(J.ash), bone = soft(J.bone), belly = soft(0x2a2630);
  // body: a barrel lying along Z, deep at the chest, tucked at the waist
  lathe(g, [[0.01, -0.5], [0.13, -0.42], [0.17, -0.2], [0.15, 0.05], [0.22, 0.28], [0.24, 0.42], [0.14, 0.6], [0.01, 0.66]], coat, cls, { pos: [0, 0.68, 0], rot: [Math.PI / 2, 0, 0], sx: 0.8, sz: 1.1 });
  lathe(g, [[0.12, -0.2], [0.15, 0.25], [0.12, 0.45]], belly, cls, { pos: [0, 0.6, 0], rot: [Math.PI / 2, 0, 0], sx: 0.6, sz: 0.6, phiStart: Math.PI * 0.6, phiLength: Math.PI * 0.8 });
  // bone ridge along the spine
  for (let i = 0; i < 6; i++) { const z = -0.35 + i * 0.14; g.add(mesh(new THREE.ConeGeometry(0.03, 0.12 - Math.abs(i - 3) * 0.012, 5), bone, cls, [0, 0.9 - Math.abs(z - 0.2) * 0.1, z], [-0.5, 0, 0])); }
  // neck and head: a wedge skull with a long muzzle and swept ears
  limb(g, [0, 0.82, 0.5], [0, 0.86, 0.7], 0.1, 0.08, coat, cls, 0.1);
  const head = new THREE.Group(); head.position.set(0, 0.86, 0.76); head.rotation.x = 0.15; g.add(head);
  ball(head, [0, 0, 0], 0.1, coat, cls, [1, 0.9, 1.1]);
  limb(head, [0, -0.02, 0.06], [0, -0.05, 0.28], 0.07, 0.035, coat, cls, 0);
  ball(head, [0, -0.04, 0.3], 0.03, soft(0x141218), cls);
  lathe(head, [[0.1, -0.05], [0.09, 0.05], [0.05, 0.12]], bone, cls, { pos: [0, 0.02, 0.1], rot: [1.3, 0, 0], sx: 1.1, phiStart: Math.PI * 0.6, phiLength: Math.PI * 0.8 }); // face plate
  for (const s of [-1, 1]) {
    head.add(mesh(new THREE.ConeGeometry(0.04, 0.16, 6), coat, cls, [s * 0.06, 0.1, -0.03], [-0.55, 0, s * 0.3]));
    ball(head, [s * 0.05, 0.03, 0.1], 0.016, glow(J.ember, 2.4), cls, [1.4, 0.7, 0.6]);
  }
  limb(head, [0, -0.08, 0.05], [0, -0.1, 0.22], 0.035, 0.02, coat, cls, 0); // jaw, open
  // legs: long, with a proper hock
  for (const [x, z, front] of [[0.1, 0.36, 1], [-0.1, 0.36, 1], [0.1, -0.36, 0], [-0.1, -0.36, 0]]) {
    const top = [x, 0.66, z];
    const mid = front ? [x * 1.05, 0.34, z + 0.05] : [x * 1.05, 0.42, z - 0.12];
    const low = front ? [x, 0.08, z + 0.02] : [x, 0.1, z - 0.02];
    limb(g, top, mid, 0.06, 0.035, coat, cls, 0.2);
    limb(g, mid, low, 0.032, 0.026, coat, cls, 0);
    ball(g, [x, 0.04, low[2] + 0.04], 0.04, belly, cls, [1, 0.6, 1.5]);
  }
  // tail: a tapered brush
  limb(g, [0, 0.8, -0.48], [0, 0.62, -0.95], 0.06, 0.02, coat, cls, 0.5, 0.4);
  return g;
}
// Wisp: a hovering wraith: a shroud that thins to vapour, a void hood, long skeletal arms reaching.
function wisp() {
  const g = new THREE.Group(), cls = CLS.enemy, lift = 0.35;
  const shroud = soft(J.ghostCloth, { transparent: true, opacity: 0.85 }), bone = soft(J.bone), dark = soft(0x1a262c);
  lathe(g, [[0.05, lift - 0.1], [0.2, lift + 0.2], [0.3, lift + 0.6], [0.3, lift + 1.0], [0.26, lift + 1.3], [0.14, lift + 1.44]], shroud, cls, { folds: 9, foldDepth: 0.4, tear: 0.35, seed: 31, sz: 0.8 });
  lathe(g, [[0.3, lift + 0.55], [0.28, lift + 0.95], [0.22, lift + 1.3]], dark, cls, { folds: 6, foldDepth: 0.25, tear: 0.12, seed: 32, phiStart: Math.PI * 0.6, phiLength: Math.PI * 0.8 });
  // trailing wisps
  for (let i = 0; i < 4; i++) limb(g, [(i - 1.5) * 0.08, lift + 0.2, -0.05], [(i - 1.5) * 0.2, 0.05, -0.35 - i * 0.05], 0.035, 0.004, shroud, cls, 0);
  hood(g, [0, lift + 1.55, 0.04], 0.13, dark, cls, J.teal, { peak: 1.2, drape: 1.6 });
  for (const s of [-1, 1]) {
    const sh = [s * 0.22, lift + 1.36, 0], el = [s * 0.36, lift + 1.15, 0.3], wr = [s * 0.34, lift + 1.2, 0.6];
    lathe(g, [[0.05, 0], [0.09, 0.25], [0.16, 0.42]], dark, cls, { pos: sh, rot: [1.2, 0, -s * 0.5], folds: 4, foldDepth: 0.3, tear: 0.06, seed: 33 + s });
    limb(g, el, wr, 0.02, 0.016, bone, cls, 0);
    hand(g, wr, [0, 0.1, 1], 0.03, bone, cls, { claws: 0.05 });
  }
  const orb = ball(g, [0, lift + 1.25, 0.7], 0.07, glow(J.teal, 2.6), cls);
  orb.userData.cls = CLS.enemy;
  return g;
}
// Seer: a tall robed oracle, porcelain face under a peaked hood, a lantern hung from a crooked staff.
function seer() {
  const g = new THREE.Group(), cls = CLS.enemy;
  const robe = soft(J.verdigris), dark = soft(0x1c3a34), gold = goldM(), wood = soft(J.leather), bone = soft(J.bone);
  lathe(g, [[0.42, 0.02], [0.36, 0.35], [0.27, 0.85], [0.22, 1.2], [0.25, 1.42], [0.15, 1.56]], robe, cls, { folds: 8, foldDepth: 0.1, tear: 0.06, seed: 41, sz: 0.9 });
  for (const y of [0.06, 0.2]) band(g, y, 0.41 - y * 0.2, 0.014, gold, cls, 1, 0.9);
  // stole hanging down the front, gold-embroidered
  g.add(mesh(new THREE.PlaneGeometry(0.16, 1.0, 1, 4), dark, cls, [0, 0.95, 0.27], [0.12, 0, 0]));
  for (let i = 0; i < 4; i++) ball(g, [0, 0.62 + i * 0.2, 0.3 - i * 0.022], 0.022, gold, cls, [1, 1, 0.4]);
  // capelet and tall hood
  lathe(g, [[0.36, 1.12], [0.32, 1.3], [0.24, 1.46], [0.15, 1.56]], dark, cls, { folds: 8, foldDepth: 0.15, tear: 0.05, seed: 42 });
  hood(g, [0, 1.74, 0.03], 0.13, robe, cls, null, { peak: 2.2, drape: 1.3 });
  mask(g, [0, 1.72, 0.08], 0.1, cls, J.gold);
  // arms: right lifts the lantern staff, left reaches out palm-up
  for (const s of [-1, 1]) ball(g, [s * 0.22, 1.44, 0], 0.1, dark, cls, [1.1, 0.8, 1.1]);
  limb(g, [0.23, 1.42, 0], [0.33, 1.3, 0.16], 0.06, 0.05, robe, cls);
  lathe(g, [[0.05, 0], [0.07, 0.1], [0.12, 0.2]], robe, cls, { pos: [0.33, 1.3, 0.16], rot: [0.6, 0, -0.6], folds: 4, foldDepth: 0.1 });
  hand(g, [0.38, 1.47, 0.2], [0, 1, 0.1], 0.034, bone, cls);
  limb(g, [-0.23, 1.42, 0], [-0.36, 1.18, 0.12], 0.06, 0.05, robe, cls);
  hand(g, [-0.42, 1.08, 0.26], [-0.2, 0.2, 1], 0.034, bone, cls);
  // crooked staff with a hanging lantern
  const top = [0.42, 2.35, 0.24];
  limb(g, [0.37, 0.02, 0.2], [0.39, 2.1, 0.21], 0.02, 0.024, wood, cls, 0.05);
  limb(g, [0.39, 2.1, 0.21], top, 0.024, 0.02, wood, cls, 0);
  limb(g, top, [0.58, 2.3, 0.3], 0.02, 0.015, wood, cls, 0);
  const lan = new THREE.Group(); lan.position.set(0.58, 2.08, 0.3); g.add(lan);
  lan.add(mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.2, 4), gold, cls, [0, 0.12, 0]));
  ball(lan, [0, 0, 0], 0.07, glow(J.hazardGlow ?? P.hazard, 2.4), cls, [0.9, 1.2, 0.9]);
  for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2 + 0.4; lan.add(mesh(new THREE.BoxGeometry(0.012, 0.19, 0.012), gold, cls, [Math.sin(a) * 0.075, 0, Math.cos(a) * 0.075])); }
  lan.add(mesh(new THREE.ConeGeometry(0.1, 0.07, 8), gold, cls, [0, 0.12, 0]));
  const ll = new THREE.PointLight(0xffd070, MJ ? 6 : 3, 4, 1.6); lan.add(ll);
  return g;
}
// Keeper (elite): a plate-armoured warden, tower shield braced, maul raised for the heavy.
function keeper() {
  const g = new THREE.Group(), cls = CLS.elite;
  const plate = metal(J.steel), dark = metal(J.iron), tabard = soft(J.oxblood), gold = goldM(), mail = soft(0x4a4e5c), leather = soft(J.leather);
  // legs: greaves over mail, sabatons
  for (const s of [-1, 1]) {
    const hip = [s * 0.14, 1.0, 0], knee = [s * 0.17, 0.55, 0.08], ankle = [s * 0.16, 0.12, 0];
    limb(g, hip, knee, 0.11, 0.085, mail, cls, 0.1);
    limb(g, knee, ankle, 0.085, 0.07, plate, cls, 0.15);
    ball(g, knee, 0.085, plate, cls, [1, 0.9, 1.1]);
    lathe(g, [[0.001, 0], [0.08, 0.02], [0.09, 0.08], [0.06, 0.13]], dark, cls, { pos: [s * 0.16, 0, 0.05], sz: 1.9 });
  }
  // faulds and tabard
  lathe(g, [[0.3, 0.72], [0.27, 0.86], [0.23, 1.02]], dark, cls, { seg: 12, sz: 0.85 });
  for (const y of [0.76, 0.85, 0.94]) band(g, y, 0.28 - (y - 0.76) * 0.4, 0.018, plate, cls, 1, 0.85);
  g.add(mesh(new THREE.PlaneGeometry(0.32, 0.8, 1, 4), tabard, cls, [0, 0.72, 0.3], [0.06, 0, 0]));
  g.add(mesh(new THREE.PlaneGeometry(0.32, 0.8, 1, 4), tabard, cls, [0, 0.72, -0.27], [-0.06, Math.PI, 0]));
  for (const z of [0.305, -0.275]) g.add(mesh(new THREE.BoxGeometry(0.34, 0.03, 0.01), gold, cls, [0, 0.33, z]));
  // cuirass: broad chest, waisted, with a centre ridge
  lathe(g, [[0.22, 1.0], [0.25, 1.12], [0.33, 1.34], [0.32, 1.5], [0.2, 1.62]], plate, cls, { sx: 1.25, sz: 0.85 });
  g.add(mesh(new THREE.BoxGeometry(0.03, 0.46, 0.04), plate, cls, [0, 1.3, 0.28], [-0.12, 0, 0]));
  band(g, 1.02, 0.23, 0.025, leather, cls, 1.25, 0.88);
  ball(g, [0, 1.02, 0.2], 0.035, gold, cls, [1.3, 1, 0.5]);
  // gorget and great helm, visor slit glowing
  lathe(g, [[0.16, 1.58], [0.14, 1.66], [0.12, 1.72]], dark, cls);
  const helm = new THREE.Group(); helm.position.set(0, 1.86, 0.02); g.add(helm);
  lathe(helm, [[0.14, -0.14], [0.15, 0.0], [0.145, 0.1], [0.1, 0.2], [0.001, 0.24]], plate, cls, { sz: 1.1 });
  helm.add(mesh(new THREE.BoxGeometry(0.2, 0.018, 0.05), glow(J.ember, 2.2), cls, [0, 0.02, 0.14]));
  helm.add(mesh(new THREE.BoxGeometry(0.02, 0.24, 0.03), gold, cls, [0, 0.06, 0.155]));
  helm.add(mesh(new THREE.BoxGeometry(0.02, 0.1, 0.34), gold, cls, [0, 0.24, 0]));
  // pauldrons: three stacked lames each side
  for (const s of [-1, 1]) for (let i = 0; i < 3; i++) {
    const m = mesh(new THREE.SphereGeometry(0.2 - i * 0.02, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.5), i === 0 ? plate : dark, cls, [s * (0.4 + i * 0.03), 1.58 - i * 0.07, 0], [0, 0, s * -(0.35 + i * 0.15)], [1, 0.75, 1]);
    g.add(m);
    if (i === 0) g.add(mesh(new THREE.TorusGeometry(0.2, 0.012, 6, 32), gold, cls, [s * 0.4, 1.58, 0], [Math.PI / 2, s * (0.35), 0], [1, 1, 0.75]));
  }
  // left arm braces the tower shield
  limb(g, [-0.42, 1.5, 0], [-0.52, 1.18, 0.14], 0.09, 0.08, dark, cls);
  limb(g, [-0.52, 1.18, 0.14], [-0.5, 1.05, 0.42], 0.08, 0.075, plate, cls);
  const tower = new THREE.Shape();
  tower.moveTo(-0.34, 0.55); tower.quadraticCurveTo(0, 0.68, 0.34, 0.55); tower.lineTo(0.34, -0.45);
  tower.quadraticCurveTo(0.3, -0.72, 0, -0.85); tower.quadraticCurveTo(-0.3, -0.72, -0.34, -0.45); tower.closePath();
  const sh = shieldFrom(tower, 0.05, soft(J.oxblood), gold, cls);
  sh.add(mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.06, 20), metal(J.gold), cls, [0, 0.02, 0.1], [Math.PI / 2, 0, 0]));
  sh.add(mesh(new THREE.BoxGeometry(0.06, 1.1, 0.02), dark, cls, [0, -0.1, 0.085]));
  sh.add(mesh(new THREE.BoxGeometry(0.56, 0.06, 0.02), dark, cls, [0, 0.12, 0.085]));
  sh.position.set(-0.62, 1.0, 0.5); sh.rotation.y = -0.45; g.add(sh);
  // right arm raises the maul overhead
  limb(g, [0.42, 1.5, 0], [0.56, 1.82, 0.02], 0.09, 0.08, dark, cls);
  limb(g, [0.56, 1.82, 0.02], [0.44, 2.18, 0.08], 0.08, 0.075, plate, cls);
  ball(g, [0.56, 1.82, 0.02], 0.08, plate, cls);
  ball(g, [0.43, 2.22, 0.08], 0.07, dark, cls, [1, 1.2, 1]);
  limb(g, [0.5, 2.0, 0.12], [0.1, 2.8, -0.22], 0.028, 0.028, leather, cls, 0);
  const mh = new THREE.Group(); mh.position.set(0.06, 2.9, -0.26); mh.rotation.set(0.35, 0, 0.55); g.add(mh);
  mh.add(mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.5, 8), dark, cls, [0, 0, 0], [0, 0, Math.PI / 2]));
  for (const x of [-0.25, 0.25]) mh.add(mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.04, 8), gold, cls, [x, 0, 0], [0, 0, Math.PI / 2]));
  // torn cloak behind
  lathe(g, [[0.5, 0.25], [0.44, 0.8], [0.36, 1.3], [0.3, 1.6]], soft(0x3a1620), cls, { folds: 6, foldDepth: 0.2, tear: 0.12, seed: 55, phiStart: Math.PI * 0.62, phiLength: Math.PI * 0.76 });
  return g;
}
// The Bound King: a towering lich in a vast robe, skull crowned, ribs bared, chains hanging from raised arms,
// pages of the manuscript orbiting him.
function boundKing() {
  const g = new THREE.Group(), cls = CLS.boss;
  const robe = soft(J.violet), inner = soft(0x201436), bone = soft(J.bone), gold = goldM(), iron = metal(J.iron);
  lathe(g, [[1.35, 0.02], [1.12, 0.45], [0.82, 1.2], [0.56, 1.9], [0.5, 2.25], [0.6, 2.6], [0.48, 2.92]], robe, cls, { folds: 11, foldDepth: 0.14, tear: 0.12, seed: 61, seg: 48 });
  for (const [y, r] of [[0.08, 1.33], [0.26, 1.2]]) band(g, y, r, 0.03, gold, cls);
  // open front showing ribs
  lathe(g, [[0.44, 2.0], [0.5, 2.35], [0.46, 2.75], [0.3, 2.9]], inner, cls, { phiStart: -0.7, phiLength: 1.4, sz: 1.0 });
  for (let i = 0; i < 5; i++) band(g, 2.2 + i * 0.12, 0.3 - i * 0.012, 0.022, bone, cls, 1.25, 0.85, [0, 0, 0.12]);
  g.add(mesh(new THREE.BoxGeometry(0.06, 0.62, 0.05), bone, cls, [0, 2.45, 0.4]));
  // high flared collar and a cloak sweeping behind
  lathe(g, [[0.42, 2.82], [0.52, 3.05], [0.6, 3.38]], robe, cls, { phiStart: Math.PI * 0.62, phiLength: Math.PI * 0.76, seg: 24, pos: [0, 0, -0.08] });
  lathe(g, [[1.6, 0.05], [1.25, 0.9], [0.85, 2.0], [0.66, 2.85]], soft(0x2a1a44), cls, { folds: 9, foldDepth: 0.2, tear: 0.2, seed: 64, phiStart: Math.PI * 0.6, phiLength: Math.PI * 0.8, seg: 32 });
  // skull, crown
  const sk = new THREE.Group(); sk.position.set(0, 3.2, 0.12); g.add(sk);
  ball(sk, [0, 0, 0], 0.26, bone, cls, [0.9, 1.05, 1]);
  ball(sk, [0, -0.2, 0.08], 0.16, bone, cls, [1, 0.6, 1]);
  for (const s of [-1, 1]) {
    ball(sk, [s * 0.095, 0.0, 0.2], 0.07, soft(0x0e0a14), cls, [1.2, 0.7, 0.5], [0, 0, s * -0.35]);
    ball(sk, [s * 0.095, 0.0, 0.235], 0.022, glow(0xc9a0ff, 2.8), cls);
    ball(sk, [s * 0.16, -0.08, 0.14], 0.07, bone, cls, [1, 0.6, 0.8]); // cheekbones
  }
  sk.add(mesh(new THREE.ConeGeometry(0.03, 0.07, 3), soft(0x0e0a14), cls, [0, -0.08, 0.235], [Math.PI, 0, 0]));
  for (let i = 0; i < 7; i++) sk.add(mesh(new THREE.BoxGeometry(0.022, 0.04, 0.02), bone, cls, [(i - 3) * 0.027, -0.2, 0.22 - Math.abs(i - 3) * 0.012]));
  lathe(sk, [[0.24, 0.16], [0.25, 0.26]], gold, cls, { smooth: false, seg: 40 });
  for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2; sk.add(mesh(new THREE.ConeGeometry(0.035, i % 2 ? 0.2 : 0.3, 5), gold, cls, [Math.sin(a) * 0.245, 0.34 + (i % 2 ? 0 : 0.05), Math.cos(a) * 0.245])); }
  ball(sk, [0, 0.24, 0.25], 0.035, glow(0xc9a0ff, 2.4), cls);
  // arms: sleeves flaring from the shoulder, skeletal forearms, clawed hands, shackles and chains
  const arms = [[[-0.55, 2.85, 0], [-0.95, 3.25, 0.3], [-1.02, 3.85, 0.42], [0, 1, 0.2]], [[0.55, 2.85, 0], [0.92, 2.5, 0.5], [1.12, 2.46, 1.05], [0, -0.3, 1]]];
  for (const [sh, el, wr, dir] of arms) {
    ball(g, sh, 0.22, robe, cls);
    limb(g, sh, el, 0.15, 0.13, robe, cls, 0.1);
    const d = V(wr).sub(V(el)).normalize();
    lathe(g, [[0.1, 0], [0.16, 0.18], [0.24, 0.32]], robe, cls, { pos: el, folds: 5, foldDepth: 0.2, tear: 0.08, seed: 66 }).quaternion.setFromUnitVectors(Y_AXIS, d);
    limb(g, el, wr, 0.045, 0.035, bone, cls, 0);
    hand(g, wr, dir, 0.07, bone, cls, { claws: 0.09 });
    const cuff = V(el).lerp(V(wr), 0.7);
    const c = mesh(new THREE.TorusGeometry(0.08, 0.03, 8, 16), iron, cls, cuff.toArray()); c.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), d); g.add(c);
    for (let k = 1; k < 10; k++) g.add(mesh(new THREE.TorusGeometry(0.055, 0.016, 6, 10), iron, cls, [cuff.x + k * 0.025, cuff.y - k * 0.12, cuff.z - k * 0.015], [k % 2 ? Math.PI / 2 : 0, 0.4, 0]));
  }
  // floating manuscript pages, slightly curled
  for (let i = 0; i < 11; i++) {
    const a = (i / 11) * Math.PI * 2, geo = new THREE.PlaneGeometry(0.34, 0.46, 3, 1);
    const pp = geo.attributes.position; for (let j = 0; j < pp.count; j++) pp.setZ(j, Math.sin(pp.getX(j) * 6) * 0.03);
    geo.computeVertexNormals();
    g.add(mesh(geo, soft(P.paper, { side: THREE.DoubleSide }), cls, [Math.sin(a) * 1.9, 1.9 + (i % 3) * 0.6, Math.cos(a) * 1.9], [0.3 * i, a, 0.2 * i]));
  }
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
  const fire = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), new THREE.MeshBasicMaterial(MJ ? { color: new THREE.Color(3.2, 1.6, 0.5) } : { color: 0xe0a060, transparent: true, opacity: 0.8 }));
  fire.position.y = 1.28; fire.scale.y = 1.4; g.add(fx(fire));
  const l = new THREE.PointLight(MJ ? 0xff9440 : 0xe8a868, MJ ? 45 : 6, MJ ? 12 : 7, 1.8); l.position.y = 1.6; g.add(l);
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
  const l = new THREE.PointLight(MJ ? 0x60e0c8 : 0x7fc0b0, MJ ? 24 : 10, MJ ? 12 : 7, 1.6); l.position.y = 2; g.add(l);
  return place(g, pos);
}

// ---------- telegraphs (sections 44, 83): 2 px ink perimeter, 25% danger wash ----------
// mj: the perimeter burns instead of being inked, so danger reads as glowing magic in the dark.
const TELE_RIM = MJ ? new THREE.Color(P.danger).multiplyScalar(2.6) : P.ink;
function teleMat(opacity = 0.25) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { col: { value: new THREE.Color(P.danger).multiplyScalar(MJ ? 1.25 : 1) }, op: { value: MJ ? opacity * 0.6 : opacity }, cb: { value: COLORBLIND ? 1 : 0 } },
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
  const rim = new THREE.Mesh(new THREE.RingGeometry(r - 0.04, r + (COLORBLIND ? 0.06 : 0.025), 96), new THREE.MeshBasicMaterial({ color: TELE_RIM, transparent: true, opacity: 0.9, depthWrite: false }));
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
  const rim = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(rimPts, true, 'catmullrom', 0.01), 200, 0.03, 4, true), new THREE.MeshBasicMaterial({ color: TELE_RIM }));
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
    const e = new THREE.Mesh(new THREE.PlaneGeometry(0.06, length), new THREE.MeshBasicMaterial({ color: TELE_RIM, transparent: true, opacity: 0.9, depthWrite: false }));
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

// ---------- lighting ----------
// spec: continuous and restrained. mj: the same structure in jewel colours: warm gold key, sapphire fill, violet rim.
scene.add(MJ ? new THREE.HemisphereLight(0x7080d8, 0x2a1c30, SHOT === 'boss' ? 0.7 : 0.8)
             : new THREE.HemisphereLight(0xd8cdb8, 0x393641, SHOT === 'boss' ? 0.9 : 1.05));
const key = MJ ? new THREE.DirectionalLight(0xffd29a, SHOT === 'boss' ? 1.4 : 1.8) : new THREE.DirectionalLight(0xf0e2c8, SHOT === 'boss' ? 1.4 : 1.9);
key.position.set(MJ ? -8 : -6, MJ ? 12 : 14, MJ ? 5 : 4); key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
Object.assign(key.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: 1, far: 40 });
key.shadow.bias = -0.0008; key.shadow.radius = 5;
scene.add(key);
const rim = new THREE.DirectionalLight(MJ ? 0xa27cff : 0x8a94c8, MJ ? 1.2 : 0.5); rim.position.set(6, 5, -8); scene.add(rim);
// round, soft-edged motes instead of square points
function moteTex() {
  const c = document.createElement('canvas'); c.width = c.height = 32;
  const g = c.getContext('2d'), gr = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.4, 'rgba(255,255,255,.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(c);
}
if (MJ) {
  // a soft warm pool over the fight
  const pool = new THREE.SpotLight(0xffc070, SHOT === 'boss' ? 30 : 24, 30, 0.3, 0.9, 1.2);
  pool.position.set(-3, 16, 3); pool.target.position.set(0, 0, 0); pool.castShadow = true;
  pool.shadow.mapSize.set(1024, 1024); scene.add(pool, pool.target);
  // a few embers and weave motes
  const n = 320, pos = new Float32Array(n * 3), cols = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const near = i < 90; // motes gather around the Binder
    const r = near ? 0.5 + hash3(i, 9, 1) * 3.2 : 0, a = hash3(i, 2, 9) * 6.283;
    pos.set(near ? [Math.cos(a) * r, 0.3 + hash3(i, 3, 4) * 2.6, Math.sin(a) * r]
                 : [(hash3(i, 1, 2) - 0.5) * 26, 0.2 + hash3(i, 3, 4) * 6, (hash3(i, 5, 6) - 0.5) * 26], i * 3);
    const k = 0.8 + hash3(i, 7, 7) * 1.2;
    cols.set(near ? [0.55 * k, 0.6 * k, 1.6 * k] : hash3(i, 7, 8) > 0.3 ? [1.6 * k, 0.8 * k, 0.28 * k] : [0.4 * k, 1.0 * k, 1.3 * k], i * 3);
  }
  const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); pg.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  scene.add(fx(new THREE.Points(pg, new THREE.PointsMaterial({ size: 0.06, map: moteTex(), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }))));
  // the Binder's weave glows
  const wl = new THREE.PointLight(0x7a8cff, 14, 6, 1.6); wl.position.set(0.3, 1.8, 0.3); scene.add(wl);
  if (SHOT === 'boss') { const kl = new THREE.PointLight(0xa070ff, 40, 12, 1.4); kl.position.copy(at(0.5, 5.0)).setY(3.2); scene.add(kl); }
}

// ---------- floor ----------
const floor = new THREE.Mesh(new THREE.PlaneGeometry(34, 34), new THREE.MeshStandardMaterial({ map: floorTexture(SHOT), roughness: 0.9 }));
floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; floor.userData.cls = CLS.env; scene.add(floor);

// ---------- shots ----------
const player = new THREE.Vector3(0, 0, 0);
if (SHOT === 'room') buildRoom();
else if (SHOT === 'boss') buildBoss();
else if (SHOT === 'lineup') buildLineup();
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

function buildLineup() {
  const row = [[binder, 0, 1], [husk, 0, 1], [hound, 0, 1], [wisp, 0, 1], [seer, 0, 1], [keeper, 0, 1.12]];
  row.forEach(([f, , s], i) => { const p = at(-3.4 + i * 1.25, 1.3 - (i % 2) * 0.3); place(f(), p, facing(p, at(-3.4 + i * 1.35, -8)) , s); });
  const kp = at(0.3, 3.9); place(boundKing(), kp, facing(kp, at(0.3, -8)), 0.6);
  frame(at(0, 1.9));
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
    res: { value: new THREE.Vector2(W, H) }, near: { value: camera.near }, far: { value: camera.far }, mj: { value: MJ ? 1 : 0 },
  },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }',
  fragmentShader: /* glsl */ `
    uniform sampler2D tColor, tNormal, tDepth, tId; uniform vec2 res; uniform float near, far, mj;
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
      vec2 q = vUv - .5;
      if(mj > .5){
        // colour only: a soft glow on light sources and richer, jewel-toned pigment; same wash and ink
        vec3 glow = vec3(0.);
        for(int k=0; k<16; k++){
          float a = float(k)*2.39996, r = 3. + float(k)*1.4;
          vec3 c = toSRGB(texture2D(tColor, vUv + vec2(cos(a), sin(a))*r*px).rgb);
          glow += c * smoothstep(.8, 1.2, dot(c, vec3(.3,.59,.11)));
        }
        col += glow/16. * .5;
        col = clamp(sat(col, 1.22), 0., 1.);
        col *= 1. - .45*dot(q*vec2(1.2,1.), q*vec2(1.2,1.));
      } else {
        // restrained vignette
        col *= 1. - .35*dot(q*vec2(1.2,1.), q*vec2(1.2,1.));
      }
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
