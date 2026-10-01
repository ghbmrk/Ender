// Hero painter: SDXS-512 (one-step diffusion) + TAESD decoder, run with plain WebGPU compute shaders.
// No WASM, no ML runtime. UNet weights stay as 5-bit codes on the GPU (one byte each) and are
// dequantised inside the shaders, so GPU memory is about 330 MB of weights plus activations.

const WG = 64;

// ---------- WGSL ----------
// Weight accessor: "q" reads a byte code and its group's (min, scale); "f" reads float32.
const W_DECL = {
  q: `@group(0) @binding(1) var<storage, read> wc: array<u32>;
@group(0) @binding(2) var<storage, read> wm: array<vec2<f32>>;
fn W(i: u32) -> f32 { let c = f32((wc[i >> 2u] >> ((i & 3u) * 8u)) & 255u); let m = wm[i / 128u]; return m.x + c * m.y; }`,
  f: `@group(0) @binding(1) var<storage, read> wf: array<f32>;
fn W(i: u32) -> f32 { return wf[i]; }`,
};

// conv2d, NCHW, batch 1. Each workgroup: an 8x8 output tile x 8 output channels. Input tile and
// weights for 8 input channels at a time are staged in workgroup memory.
const convWGSL = (w, k, s, act, res, d = 1) => {
  const T = (8 - 1) * s + (k - 1) * d + 1, IC = T > 12 ? 4 : 8;
  return `
${W_DECL[w]}
struct P { cin: u32, h: u32, w: u32, cout: u32, ho: u32, wo: u32, pad: u32, _p: u32 }
@group(0) @binding(0) var<uniform> p: P;
@group(0) @binding(3) var<storage, read> x: array<f32>;
@group(0) @binding(4) var<storage, read> b: array<f32>;
@group(0) @binding(5) var<storage, read_write> y: array<f32>;
${res ? "@group(0) @binding(6) var<storage, read> r: array<f32>;" : ""}
const K: u32 = ${k}u; const S: u32 = ${s}u; const D: u32 = ${d}u; const T: u32 = ${T}u; const IC: u32 = ${IC}u;
var<workgroup> tile: array<f32, ${IC * T * T}>;
var<workgroup> ws: array<f32, ${8 * IC * k * k}>;
@compute @workgroup_size(8, 8, 1)
fn main(@builtin(workgroup_id) wg: vec3<u32>, @builtin(local_invocation_id) l: vec3<u32>, @builtin(local_invocation_index) li: u32) {
  let ox = wg.x * 8u + l.x; let oy = wg.y * 8u + l.y; let oc0 = wg.z * 8u;
  let ix0 = i32(wg.x * 8u * S) - i32(p.pad); let iy0 = i32(wg.y * 8u * S) - i32(p.pad);
  var acc: array<f32, 8>;
  for (var c0 = 0u; c0 < p.cin; c0 += IC) {
    for (var t = li; t < IC * T * T; t += 64u) {
      let c = t / (T * T); let rem = t % (T * T); let ty = rem / T; let tx = rem % T;
      let iy = iy0 + i32(ty); let ix = ix0 + i32(tx);
      var v = 0.0;
      if (c0 + c < p.cin && iy >= 0 && ix >= 0 && iy < i32(p.h) && ix < i32(p.w)) { v = x[((c0 + c) * p.h + u32(iy)) * p.w + u32(ix)]; }
      tile[t] = v;
    }
    for (var t = li; t < 8u * IC * K * K; t += 64u) {
      let o = t / (IC * K * K); let rem = t % (IC * K * K); let c = rem / (K * K); let kk = rem % (K * K);
      var v = 0.0;
      if (oc0 + o < p.cout && c0 + c < p.cin) { v = W(((oc0 + o) * p.cin + c0 + c) * K * K + kk); }
      ws[t] = v;
    }
    workgroupBarrier();
    for (var c = 0u; c < IC; c++) {
      for (var ky = 0u; ky < K; ky++) {
        for (var kx = 0u; kx < K; kx++) {
          let v = tile[(c * T + l.y * S + ky * D) * T + l.x * S + kx * D];
          let wi = (c * K + ky) * K + kx;
          for (var o = 0u; o < 8u; o++) { acc[o] += v * ws[o * IC * K * K + wi]; }
        }
      }
    }
    workgroupBarrier();
  }
  if (ox >= p.wo || oy >= p.ho) { return; }
  for (var o = 0u; o < 8u; o++) {
    let oc = oc0 + o;
    if (oc >= p.cout) { break; }
    let i = (oc * p.ho + oy) * p.wo + ox;
    var v = acc[o] + b[oc];
    ${res ? "v += r[i];" : ""}
    ${act === "relu" ? "v = max(v, 0.0);" : ""}
    y[i] = v;
  }
}`;
};

// Y[N][M] = X[N][K] . W[M][K]^T + b (+ R). 32x32 output tile per workgroup, 4x4 per thread.
const linWGSL = (w, res, hasBias) => `
${W_DECL[w]}
struct P { n: u32, k: u32, m: u32, _p: u32 }
@group(0) @binding(0) var<uniform> p: P;
@group(0) @binding(3) var<storage, read> x: array<f32>;
${hasBias ? "@group(0) @binding(4) var<storage, read> b: array<f32>;" : ""}
@group(0) @binding(5) var<storage, read_write> y: array<f32>;
${res ? "@group(0) @binding(6) var<storage, read> r: array<f32>;" : ""}
var<workgroup> As: array<f32, 512>;
var<workgroup> Bs: array<f32, 512>;
@compute @workgroup_size(8, 8, 1)
fn main(@builtin(workgroup_id) wg: vec3<u32>, @builtin(local_invocation_id) l: vec3<u32>, @builtin(local_invocation_index) li: u32) {
  let n0 = wg.y * 32u; let m0 = wg.x * 32u;
  var acc: array<f32, 16>;
  for (var k0 = 0u; k0 < p.k; k0 += 16u) {
    for (var t = li; t < 512u; t += 64u) {
      let r = t / 16u; let c = t % 16u;
      var a = 0.0; var bb = 0.0;
      if (n0 + r < p.n && k0 + c < p.k) { a = x[(n0 + r) * p.k + k0 + c]; }
      if (m0 + r < p.m && k0 + c < p.k) { bb = W((m0 + r) * p.k + k0 + c); }
      As[t] = a; Bs[t] = bb;
    }
    workgroupBarrier();
    for (var c = 0u; c < 16u; c++) {
      var av: array<f32, 4>; var bv: array<f32, 4>;
      for (var i = 0u; i < 4u; i++) { av[i] = As[(l.y * 4u + i) * 16u + c]; bv[i] = Bs[(l.x * 4u + i) * 16u + c]; }
      for (var i = 0u; i < 4u; i++) { for (var j = 0u; j < 4u; j++) { acc[i * 4u + j] += av[i] * bv[j]; } }
    }
    workgroupBarrier();
  }
  for (var i = 0u; i < 4u; i++) {
    let n = n0 + l.y * 4u + i;
    if (n >= p.n) { break; }
    for (var j = 0u; j < 4u; j++) {
      let m = m0 + l.x * 4u + j;
      if (m >= p.m) { break; }
      var v = acc[i * 4u + j];
      ${hasBias ? "v += b[m];" : ""}
      ${res ? "v += r[n * p.m + m];" : ""}
      y[n * p.m + m] = v;
    }
  }
}`;

// GroupNorm over NCHW with 32 groups, one workgroup per group, optional SiLU.
const gnWGSL = (silu) => `
struct P { c: u32, hw: u32, groups: u32, eps: f32 }
@group(0) @binding(0) var<uniform> p: P;
@group(0) @binding(1) var<storage, read> x: array<f32>;
@group(0) @binding(2) var<storage, read> g: array<f32>;
@group(0) @binding(3) var<storage, read> b: array<f32>;
@group(0) @binding(4) var<storage, read_write> y: array<f32>;
var<workgroup> red: array<f32, 256>;
fn reduce(li: u32, v: f32) -> f32 {
  red[li] = v; workgroupBarrier();
  for (var s = 128u; s > 0u; s >>= 1u) { if (li < s) { red[li] += red[li + s]; } workgroupBarrier(); }
  let r = red[0]; workgroupBarrier(); return r;
}
@compute @workgroup_size(256)
fn main(@builtin(workgroup_id) wg: vec3<u32>, @builtin(local_invocation_index) li: u32) {
  let cpg = p.c / p.groups; let n = cpg * p.hw; let base = wg.x * n;
  var s = 0.0;
  for (var i = li; i < n; i += 256u) { s += x[base + i]; }
  let mean = reduce(li, s) / f32(n);
  var q = 0.0;
  for (var i = li; i < n; i += 256u) { let d = x[base + i] - mean; q += d * d; }
  let rstd = inverseSqrt(reduce(li, q) / f32(n) + p.eps);
  for (var i = li; i < n; i += 256u) {
    let c = wg.x * cpg + i / p.hw;
    var v = (x[base + i] - mean) * rstd * g[c] + b[c];
    ${silu ? "v = v / (1.0 + exp(-v));" : ""}
    y[base + i] = v;
  }
}`;

// LayerNorm over rows of [N][C].
const lnWGSL = `
struct P { n: u32, c: u32, _a: u32, eps: f32 }
@group(0) @binding(0) var<uniform> p: P;
@group(0) @binding(1) var<storage, read> x: array<f32>;
@group(0) @binding(2) var<storage, read> g: array<f32>;
@group(0) @binding(3) var<storage, read> b: array<f32>;
@group(0) @binding(4) var<storage, read_write> y: array<f32>;
var<workgroup> red: array<f32, 64>;
fn reduce(li: u32, v: f32) -> f32 {
  red[li] = v; workgroupBarrier();
  for (var s = 32u; s > 0u; s >>= 1u) { if (li < s) { red[li] += red[li + s]; } workgroupBarrier(); }
  let r = red[0]; workgroupBarrier(); return r;
}
@compute @workgroup_size(64)
fn main(@builtin(workgroup_id) wg: vec3<u32>, @builtin(local_invocation_index) li: u32) {
  let row = wg.x + wg.y * 65535u; if (row >= p.n) { return; }
  let base = row * p.c;
  var s = 0.0; for (var i = li; i < p.c; i += 64u) { s += x[base + i]; }
  let mean = reduce(li, s) / f32(p.c);
  var q = 0.0; for (var i = li; i < p.c; i += 64u) { let d = x[base + i] - mean; q += d * d; }
  let rstd = inverseSqrt(reduce(li, q) / f32(p.c) + p.eps);
  for (var i = li; i < p.c; i += 64u) { y[base + i] = (x[base + i] - mean) * rstd * g[i] + b[i]; }
}`;

// Multi-head attention, one workgroup per (query, head). Scores for all keys live in workgroup memory.
const attnWGSL = (maxM) => `
struct P { n: u32, m: u32, c: u32, heads: u32 }
@group(0) @binding(0) var<uniform> p: P;
@group(0) @binding(1) var<storage, read> q: array<f32>;
@group(0) @binding(2) var<storage, read> k: array<f32>;
@group(0) @binding(3) var<storage, read> v: array<f32>;
@group(0) @binding(4) var<storage, read_write> o: array<f32>;
var<workgroup> sc: array<f32, ${maxM}>;
var<workgroup> red: array<f32, 64>;
var<workgroup> qs: array<f32, 160>;
@compute @workgroup_size(64)
fn main(@builtin(workgroup_id) wg: vec3<u32>, @builtin(local_invocation_index) li: u32) {
  let qi = wg.x; let h = wg.y; let d = p.c / p.heads; let off = h * d;
  let scale = inverseSqrt(f32(d));
  for (var j = li; j < d; j += 64u) { qs[j] = q[qi * p.c + off + j] * scale; }
  workgroupBarrier();
  var mx = -1e30;
  for (var j = li; j < p.m; j += 64u) {
    var s = 0.0;
    for (var t = 0u; t < d; t++) { s += qs[t] * k[j * p.c + off + t]; }
    sc[j] = s; mx = max(mx, s);
  }
  red[li] = mx; workgroupBarrier();
  for (var s = 32u; s > 0u; s >>= 1u) { if (li < s) { red[li] = max(red[li], red[li + s]); } workgroupBarrier(); }
  mx = red[0]; workgroupBarrier();
  var sum = 0.0;
  for (var j = li; j < p.m; j += 64u) { let e = exp(sc[j] - mx); sc[j] = e; sum += e; }
  red[li] = sum; workgroupBarrier();
  for (var s = 32u; s > 0u; s >>= 1u) { if (li < s) { red[li] += red[li + s]; } workgroupBarrier(); }
  let inv = 1.0 / red[0];
  workgroupBarrier();
  for (var t = li; t < d; t += 64u) {
    var a = 0.0;
    for (var j = 0u; j < p.m; j++) { a += sc[j] * v[j * p.c + off + t]; }
    o[qi * p.c + off + t] = a * inv;
  }
}`;

// Small elementwise kernels.
const ELEM = {
  // [C][N] -> [N][C]
  toTok: `struct P { c: u32, n: u32, _a: u32, _b: u32 }
@group(0) @binding(0) var<uniform> p: P;
@group(0) @binding(1) var<storage, read> x: array<f32>;
@group(0) @binding(2) var<storage, read_write> y: array<f32>;
@compute @workgroup_size(64) fn main(@builtin(global_invocation_id) g: vec3<u32>) {
  let i = g.x + g.y * 4194240u; if (i >= p.c * p.n) { return; }
  let c = i / p.n; let n = i % p.n; y[n * p.c + c] = x[i]; }`,
  // [N][C] -> [C][N] + residual
  fromTok: `struct P { c: u32, n: u32, _a: u32, _b: u32 }
@group(0) @binding(0) var<uniform> p: P;
@group(0) @binding(1) var<storage, read> x: array<f32>;
@group(0) @binding(2) var<storage, read> r: array<f32>;
@group(0) @binding(3) var<storage, read_write> y: array<f32>;
@compute @workgroup_size(64) fn main(@builtin(global_invocation_id) g: vec3<u32>) {
  let i = g.x + g.y * 4194240u; if (i >= p.c * p.n) { return; }
  let c = i / p.n; let n = i % p.n; y[i] = x[n * p.c + c] + r[i]; }`,
  geglu: `struct P { n: u32, f: u32, _a: u32, _b: u32 }
@group(0) @binding(0) var<uniform> p: P;
@group(0) @binding(1) var<storage, read> x: array<f32>;
@group(0) @binding(2) var<storage, read_write> y: array<f32>;
fn erf(z: f32) -> f32 { let t = 1.0 / (1.0 + 0.3275911 * abs(z));
  let e = 1.0 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * exp(-z * z);
  return select(-e, e, z >= 0.0); }
@compute @workgroup_size(64) fn main(@builtin(global_invocation_id) g: vec3<u32>) {
  let i = g.x + g.y * 4194240u; if (i >= p.n * p.f) { return; }
  let n = i / p.f; let f = i % p.f; let a = x[n * 2u * p.f + f]; let gt = x[n * 2u * p.f + p.f + f];
  y[i] = a * 0.5 * gt * (1.0 + erf(gt * 0.70710678)); }`,
  up2: `struct P { c: u32, h: u32, w: u32, _a: u32 }
@group(0) @binding(0) var<uniform> p: P;
@group(0) @binding(1) var<storage, read> x: array<f32>;
@group(0) @binding(2) var<storage, read_write> y: array<f32>;
@compute @workgroup_size(64) fn main(@builtin(global_invocation_id) g: vec3<u32>) {
  let i = g.x + g.y * 4194240u; let W2 = p.w * 2u; let H2 = p.h * 2u; if (i >= p.c * H2 * W2) { return; }
  let c = i / (H2 * W2); let r = i % (H2 * W2); let yy = r / W2; let xx = r % W2;
  y[i] = x[(c * p.h + yy / 2u) * p.w + xx / 2u]; }`,
  // eps -> x0 (one DDPM step to t = -1), then TAESD's tanh clamp. Mixes in an optional "start" latent for img2img.
  step: `struct P { n: u32, sa: f32, s1a: f32, _a: u32 }
@group(0) @binding(0) var<uniform> p: P;
@group(0) @binding(1) var<storage, read> x: array<f32>;
@group(0) @binding(2) var<storage, read> e: array<f32>;
@group(0) @binding(3) var<storage, read_write> y: array<f32>;
@compute @workgroup_size(64) fn main(@builtin(global_invocation_id) g: vec3<u32>) {
  let i = g.x; if (i >= p.n) { return; }
  let x0 = (x[i] - p.s1a * e[i]) / p.sa; y[i] = tanh(x0 / 3.0) * 3.0; }`,
  rgba: `struct P { hw: u32, _a: u32, _b: u32, _c: u32 }
@group(0) @binding(0) var<uniform> p: P;
@group(0) @binding(1) var<storage, read> x: array<f32>;
@group(0) @binding(2) var<storage, read_write> y: array<u32>;
@compute @workgroup_size(64) fn main(@builtin(global_invocation_id) g: vec3<u32>) {
  let i = g.x + g.y * 4194240u; if (i >= p.hw) { return; }
  let r = u32(round(clamp(x[i], 0.0, 1.0) * 255.0)); let gg = u32(round(clamp(x[p.hw + i], 0.0, 1.0) * 255.0));
  let b = u32(round(clamp(x[2u * p.hw + i], 0.0, 1.0) * 255.0));
  y[i] = r | (gg << 8u) | (b << 16u) | (255u << 24u); }`,
};

ELEM.pool = `struct P { c: u32, h: u32, w: u32, _a: u32 }
@group(0) @binding(0) var<uniform> p: P;
@group(0) @binding(1) var<storage, read> x: array<f32>;
@group(0) @binding(2) var<storage, read_write> y: array<f32>;
@compute @workgroup_size(64) fn main(@builtin(global_invocation_id) g: vec3<u32>) {
  let ho = (p.h + 1u) / 2u; let wo = (p.w + 1u) / 2u; let i = g.x + g.y * 4194240u; if (i >= p.c * ho * wo) { return; }
  let c = i / (ho * wo); let r = i % (ho * wo); let yy = r / wo * 2u; let xx = r % wo * 2u;
  var m = -1e30;
  for (var dy = 0u; dy < 2u; dy++) { for (var dx = 0u; dx < 2u; dx++) { if (yy + dy < p.h && xx + dx < p.w) { m = max(m, x[(c * p.h + yy + dy) * p.w + xx + dx]); } } }
  y[i] = m; }`;
// bilinear, align_corners = false (pytorch_half_pixel)
ELEM.resize = `struct P { c: u32, h: u32, w: u32, ho: u32, wo: u32, _a: u32, _b: u32, _c: u32 }
@group(0) @binding(0) var<uniform> p: P;
@group(0) @binding(1) var<storage, read> x: array<f32>;
@group(0) @binding(2) var<storage, read_write> y: array<f32>;
@compute @workgroup_size(64) fn main(@builtin(global_invocation_id) g: vec3<u32>) {
  let i = g.x + g.y * 4194240u; if (i >= p.c * p.ho * p.wo) { return; }
  let c = i / (p.ho * p.wo); let r = i % (p.ho * p.wo); let oy = r / p.wo; let ox = r % p.wo;
  let sy = max(0.0, (f32(oy) + 0.5) * f32(p.h) / f32(p.ho) - 0.5); let sx = max(0.0, (f32(ox) + 0.5) * f32(p.w) / f32(p.wo) - 0.5);
  let y0 = min(u32(sy), p.h - 1u); let x0 = min(u32(sx), p.w - 1u); let y1 = min(y0 + 1u, p.h - 1u); let x1 = min(x0 + 1u, p.w - 1u);
  let fy = sy - f32(y0); let fx = sx - f32(x0); let b = c * p.h * p.w;
  y[i] = mix(mix(x[b + y0 * p.w + x0], x[b + y0 * p.w + x1], fx), mix(x[b + y1 * p.w + x0], x[b + y1 * p.w + x1], fx), fy); }`;
ELEM.add = `struct P { n: u32, _a: u32, _b: u32, _c: u32 }
@group(0) @binding(0) var<uniform> p: P;
@group(0) @binding(1) var<storage, read> a: array<f32>;
@group(0) @binding(2) var<storage, read> b: array<f32>;
@group(0) @binding(3) var<storage, read_write> y: array<f32>;
@compute @workgroup_size(64) fn main(@builtin(global_invocation_id) g: vec3<u32>) {
  let i = g.x + g.y * 4194240u; if (i >= p.n) { return; } y[i] = a[i] + b[i]; }`;
ELEM.sigmoid = `struct P { n: u32, _a: u32, _b: u32, _c: u32 }
@group(0) @binding(0) var<uniform> p: P;
@group(0) @binding(1) var<storage, read> x: array<f32>;
@group(0) @binding(2) var<storage, read_write> y: array<f32>;
@compute @workgroup_size(64) fn main(@builtin(global_invocation_id) g: vec3<u32>) {
  let i = g.x + g.y * 4194240u; if (i >= p.n) { return; } y[i] = 1.0 / (1.0 + exp(-x[i])); }`;

const f16 = (h) => {
  const s = h & 0x8000 ? -1 : 1, e = (h >> 10) & 31, m = h & 1023;
  if (e === 0) return s * m * 2 ** -24;
  if (e === 31) return m ? NaN : s * Infinity;
  return s * (1 + m / 1024) * 2 ** (e - 15);
};
const F16 = new Float32Array(65536).map((_, i) => f16(i));

export async function createPainter({ manifest, fetchChunk, onProgress = () => {}, adapter, gate: loadGate = null }) {
  adapter = adapter || (await navigator.gpu?.requestAdapter({ powerPreference: "high-performance" }));
  if (!adapter) throw new Error("WebGPU is not available in this browser.");
  const L = adapter.limits;
  const device = await adapter.requestDevice({
    requiredLimits: { maxStorageBufferBindingSize: L.maxStorageBufferBindingSize, maxBufferSize: L.maxBufferSize },
  });
  const need = 512 * 512 * 64 * 4;
  if (L.maxStorageBufferBindingSize < need) throw new Error(`This GPU allows ${(L.maxStorageBufferBindingSize / 2 ** 20) | 0} MB per buffer; the painter needs 64 MB.`);

  const SU = GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC;
  const mkbuf = (bytes, usage = SU) => device.createBuffer({ size: Math.max(16, Math.ceil(bytes / 4) * 4), usage });
  const upload = (arr) => {
    const b = mkbuf(arr.byteLength);
    device.queue.writeBuffer(b, 0, arr);
    return b;
  };

  // ---------- load weights, streaming chunk by chunk ----------
  const T = manifest.tensors;
  const order = Object.entries(T).sort((a, b) => a[1].offset - b[1].offset);
  const gpu = {}, cpu = {};
  let pending = new Uint8Array(0), pendingAt = 0, ti = 0, loaded = 0;
  const unpackPipe = device.createComputePipeline({ layout: "auto", compute: { entryPoint: "main", module: device.createShaderModule({ code: `
struct P { n8: u32, _a: u32, _b: u32, _c: u32 }
@group(0) @binding(0) var<uniform> p: P;
@group(0) @binding(1) var<storage, read> pk: array<u32>;
@group(0) @binding(2) var<storage, read_write> out: array<u32>;
fn byteAt(k: u32) -> u32 { return (pk[k >> 2u] >> ((k & 3u) * 8u)) & 255u; }
@compute @workgroup_size(64) fn main(@builtin(global_invocation_id) g: vec3<u32>) {
  let i = g.x + g.y * 4194240u; if (i >= p.n8) { return; }
  let j = i * 5u;
  let lo = byteAt(j) | (byteAt(j + 1u) << 8u) | (byteAt(j + 2u) << 16u) | (byteAt(j + 3u) << 24u); let hi = byteAt(j + 4u);
  out[2u * i] = (lo & 31u) | (((lo >> 5u) & 31u) << 8u) | (((lo >> 10u) & 31u) << 16u) | (((lo >> 15u) & 31u) << 24u);
  out[2u * i + 1u] = ((lo >> 20u) & 31u) | (((lo >> 25u) & 31u) << 8u) | ((((lo >> 30u) | (hi << 2u)) & 31u) << 16u) | (((hi >> 3u) & 31u) << 24u);
}` }) } });
  let unpackTrash = [];
  const take = (name, t) => {
    const raw = pending.subarray(t.offset - pendingAt, t.offset - pendingAt + t.bytes);
    const n = t.shape.reduce((a, b) => a * b, 1);
    if (t.kind === "q5") {
      const g = t.groups;
      const mm = new Float32Array(raw.slice(0, g * 8).buffer);
      const ms = new Float32Array(g * 2);
      for (let i = 0; i < g; i++) { ms[2 * i] = mm[i]; ms[2 * i + 1] = mm[g + i]; }
      // 8 codes per 5 bytes; the GPU unpacks them to one byte each, so the main thread stays free.
      const n8 = Math.ceil(n / 8), pk = new Uint8Array(Math.ceil((n8 * 5) / 4) * 4);
      pk.set(raw.subarray(g * 8, g * 8 + n8 * 5));
      const packed = upload(pk), codes = mkbuf(n8 * 8);
      const e = device.createCommandEncoder(), pass = e.beginComputePass();
      const u = device.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
      device.queue.writeBuffer(u, 0, new Uint32Array([n8, 0, 0, 0]));
      pass.setPipeline(unpackPipe);
      pass.setBindGroup(0, device.createBindGroup({ layout: unpackPipe.getBindGroupLayout(0), entries: [u, packed, codes].map((b, i) => ({ binding: i, resource: { buffer: b } })) }));
      pass.dispatchWorkgroups(Math.min(65535, Math.ceil(n8 / 64)), Math.ceil(n8 / 64 / 65535)); pass.end();
      device.queue.submit([e.finish()]);
      unpackTrash.push(packed, u);
      gpu[name] = { q: true, c: codes, m: upload(ms) };
    } else {
      let f;
      if (t.kind === "f32") f = new Float32Array(raw.slice().buffer);
      else { const h = new Uint16Array(raw.slice().buffer); f = new Float32Array(h.length); for (let i = 0; i < h.length; i++) f[i] = F16[h[i]]; }
      if (name.startsWith("emb.") || name.startsWith("temb.")) cpu[name] = { data: f, shape: t.shape };
      else gpu[name] = { q: false, f: upload(f) };
    }
  };
  // Fetch up to three chunks at once; process them in order, yielding between tensors so taps stay quick.
  const inflight = [], files = manifest.files;
  let nextFetch = 0;
  let used = 0;
  const kick = () => { while (nextFetch < files.length && nextFetch < used + 3) { inflight[nextFetch] = fetchChunk(files[nextFetch]); nextFetch++; } };
  kick();
  // `loadGate` (optional) can hold loading back, e.g. while a fight is on screen.
  const yieldNow = loadGate || (() => new Promise((r) => setTimeout(r, 0)));
  for (let fi = 0; fi < files.length; fi++) {
    const chunk = new Uint8Array(await inflight[fi]); inflight[fi] = null; used = fi + 1; kick();
    const merged = new Uint8Array(pending.length + chunk.length);
    merged.set(pending); merged.set(chunk, pending.length);
    pending = merged;
    while (ti < order.length) {
      const [name, t] = order[ti];
      if (t.offset + t.bytes > pendingAt + pending.length) break;
      take(name, t); ti++;
      await yieldNow();
    }
    const keepFrom = ti < order.length ? order[ti][1].offset : pendingAt + pending.length;
    pending = pending.slice(keepFrom - pendingAt); pendingAt = keepFrom;
    loaded += chunk.length;
    onProgress(loaded / manifest.total);
    await device.queue.onSubmittedWorkDone();
    for (const b of unpackTrash) b.destroy();
    unpackTrash = [];
  }

  // ---------- pipelines ----------
  const cache = new Map();
  const pipe = (key, code) => {
    if (!cache.has(key)) cache.set(key, device.createComputePipeline({ layout: "auto", compute: { module: device.createShaderModule({ code }), entryPoint: "main" } }));
    return cache.get(key);
  };

  // ---------- activation pool ----------
  const pool = new Map(); // bytes -> [buffers]
  const live = new Set();
  const alloc = (n) => {
    const bytes = n * 4, list = pool.get(bytes);
    const b = list?.length ? list.pop() : mkbuf(bytes);
    const t = { b, n, bytes }; live.add(t); return t;
  };
  const free = (...ts) => { for (const t of ts) if (t && live.delete(t)) { if (!pool.has(t.bytes)) pool.set(t.bytes, []); pool.get(t.bytes).push(t.b); } };

  let enc;
  const uni = (vals) => {
    const a = new ArrayBuffer(Math.max(16, vals.length * 4)), u = new Uint32Array(a), f = new Float32Array(a);
    vals.forEach((v, i) => (Number.isInteger(v) && !(v instanceof Float) ? (u[i] = v) : (f[i] = v.v ?? v)));
    const b = device.createBuffer({ size: a.byteLength, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    device.queue.writeBuffer(b, 0, a); temp.push(b); return b;
  };
  class Float { constructor(v) { this.v = v; } }
  const fl = (v) => new Float(v);
  let temp = [];
  const run = (pl, entries, x, y = 1, z = 1) => {
    const bg = device.createBindGroup({ layout: pl.getBindGroupLayout(0), entries: Object.entries(entries).map(([k, v]) => ({ binding: +k, resource: { buffer: v } })) });
    const pass = enc.beginComputePass(); pass.setPipeline(pl); pass.setBindGroup(0, bg); pass.dispatchWorkgroups(x, y, z); pass.end();
  };
  const grid = (n) => (n <= 65535 * 64 ? [Math.ceil(n / 64), 1] : [65535, Math.ceil(n / 4194240)]);
  const wbind = (w) => (w.q ? { 1: w.c, 2: w.m } : { 1: w.f });

  // ---------- ops ----------
  const conv = (x, C, H, Wd, name, { s = 1, act = "", res = null, bias = null, d = 1, w = null, sh = null } = {}) => {
    w = w || gpu[name + ".weight"]; sh = sh || T[name + ".weight"].shape;
    const cout = sh[0], k = sh[2];
    const pad = k === 3 ? d : 0, Ho = Math.floor((H + 2 * pad - d * (k - 1) - 1) / s) + 1, Wo = Math.floor((Wd + 2 * pad - d * (k - 1) - 1) / s) + 1;
    const y = alloc(cout * Ho * Wo);
    const pl = pipe(`conv${w.q ? "q" : "f"}${k}${s}${d}${act}${res ? "r" : ""}`, convWGSL(w.q ? "q" : "f", k, s, act, !!res, d));
    const b = bias || gpu[name + ".bias"]?.f || zeros(cout);
    run(pl, { 0: uni([sh[1], H, Wd, cout, Ho, Wo, pad, 0]), ...wbind(w), 3: x.b, 4: b, 5: y.b, ...(res ? { 6: res.b } : {}) }, Math.ceil(Wo / 8), Math.ceil(Ho / 8), Math.ceil(cout / 8));
    return [y, cout, Ho, Wo];
  };
  const zc = new Map();
  const zeros = (n) => { if (!zc.has(n)) zc.set(n, mkbuf(n * 4)); return zc.get(n); };
  const gn = (x, C, HW, name, silu, eps) => {
    const y = alloc(C * HW);
    run(pipe("gn" + silu, gnWGSL(silu)), { 0: uni([C, HW, 32, fl(eps)]), 1: x.b, 2: gpu[name + ".weight"].f, 3: gpu[name + ".bias"].f, 4: y.b }, 32);
    return y;
  };
  const ln = (x, N, C, name) => {
    const y = alloc(N * C);
    run(pipe("ln", lnWGSL), { 0: uni([N, C, 0, fl(1e-5)]), 1: x.b, 2: gpu[name + ".weight"].f, 3: gpu[name + ".bias"].f, 4: y.b }, Math.min(N, 65535), Math.ceil(N / 65535));
    return y;
  };
  const lin = (x, N, name, res = null) => {
    const w = gpu[name + ".weight"], sh = T[name + ".weight"].shape, M = sh[0], K = sh[1];
    const y = alloc(N * M), hb = !!gpu[name + ".bias"];
    const pl = pipe(`lin${w.q ? "q" : "f"}${res ? "r" : ""}${hb}`, linWGSL(w.q ? "q" : "f", !!res, hb));
    run(pl, { 0: uni([N, K, M, 0]), ...wbind(w), 3: x.b, ...(hb ? { 4: gpu[name + ".bias"].f } : {}), 5: y.b, ...(res ? { 6: res.b } : {}) }, Math.ceil(M / 32), Math.ceil(N / 32));
    return [y, M];
  };
  const elem = (key, u, bufs, n) => { const [gx, gy] = grid(n); run(pipe(key, ELEM[key]), { 0: uni(u), ...bufs }, gx, gy); };
  const attn = (q, k, v, N, M, C) => {
    const o = alloc(N * C), maxM = M <= 256 ? 256 : 1024;
    if (M > 1024) throw new Error("too many keys");
    run(pipe("attn" + maxM, attnWGSL(maxM)), { 0: uni([N, M, C, 8]), 1: q.b, 2: k.b, 3: v.b, 4: o.b }, N, 8);
    return o;
  };

  const resnet = (x, C, H, Wd, name, t) => {
    const h1 = gn(x, C, H * Wd, name + ".norm1", true, 1e-5);
    const cout = T[name + ".conv1.weight"].shape[0];
    const tb = cpu[`temb.${t}.${name.replace(/^unet\./, "")}.time_emb_proj`].data;
    const bias = mkbuf(cout * 4); temp.push(bias);
    const b1 = biasCPU(name + ".conv1.bias", cout); const bb = new Float32Array(cout); for (let i = 0; i < cout; i++) bb[i] = b1[i] + tb[i];
    device.queue.writeBuffer(bias, 0, bb);
    const [h2] = conv(h1, C, H, Wd, name + ".conv1", { bias }); free(h1);
    const h3 = gn(h2, cout, H * Wd, name + ".norm2", true, 1e-5); free(h2);
    let sc = x;
    if (gpu[name + ".conv_shortcut.weight"]) [sc] = conv(x, C, H, Wd, name + ".conv_shortcut");
    const [y] = conv(h3, cout, H, Wd, name + ".conv2", { res: sc }); free(h3);
    if (sc !== x) free(sc);
    return [y, cout];
  };
  const biasHost = {};
  const biasCPU = (name, n) => biasHost[name];

  const transformer = (x, C, H, Wd, name, ctx, M) => {
    const N = H * Wd, tb = name + ".transformer_blocks.0";
    const g = gn(x, C, N, name + ".norm", false, 1e-6);
    const tk = alloc(N * C); elem("toTok", [C, N, 0, 0], { 1: g.b, 2: tk.b }, N * C); free(g);
    let [h] = lin(tk, N, name + ".proj_in"); free(tk);
    // self attention
    let n = ln(h, N, C, tb + ".norm1");
    let [q] = lin(n, N, tb + ".attn1.to_q"), [k] = lin(n, N, tb + ".attn1.to_k"), [v] = lin(n, N, tb + ".attn1.to_v"); free(n);
    let o = attn(q, k, v, N, N, C); free(q, k, v);
    let [h2] = lin(o, N, tb + ".attn1.to_out.0", h); free(o, h); h = h2;
    // cross attention
    n = ln(h, N, C, tb + ".norm2");
    [q] = lin(n, N, tb + ".attn2.to_q"); free(n);
    [k] = lin(ctx, M, tb + ".attn2.to_k"); [v] = lin(ctx, M, tb + ".attn2.to_v");
    o = attn(q, k, v, N, M, C); free(q, k, v);
    [h2] = lin(o, N, tb + ".attn2.to_out.0", h); free(o, h); h = h2;
    // feed-forward (GEGLU)
    n = ln(h, N, C, tb + ".norm3");
    const [p, F2] = lin(n, N, tb + ".ff.net.0.proj"); free(n);
    const gg = alloc(N * F2 / 2); elem("geglu", [N, F2 / 2, 0, 0], { 1: p.b, 2: gg.b }, N * F2 / 2); free(p);
    [h2] = lin(gg, N, tb + ".ff.net.2", h); free(gg, h); h = h2;
    const [po] = lin(h, N, name + ".proj_out"); free(h);
    const y = alloc(C * N); elem("fromTok", [C, N, 0, 0], { 1: po.b, 2: x.b, 3: y.b }, C * N); free(po);
    return y;
  };

  // Biases of conv1 are needed on the CPU to fold in the time embedding: read them back once.
  {
    const names = Object.keys(T).filter((k) => /resnets\.\d+\.conv1\.bias$/.test(k) && gpu[k]);
    enc = device.createCommandEncoder();
    const rb = names.map((nm) => { const n = T[nm].shape[0]; const r = device.createBuffer({ size: n * 4, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST }); enc.copyBufferToBuffer(gpu[nm].f, 0, r, 0, n * 4); return [nm, r]; });
    device.queue.submit([enc.finish()]);
    for (const [nm, r] of rb) { await r.mapAsync(GPUMapMode.READ); biasHost[nm.replace(/\.bias$/, ".bias")] = new Float32Array(r.getMappedRange().slice(0)); r.destroy(); }
  }

  /**
   * Between blocks, an optional gate can pause painting: the work so far is submitted and finished first, so the
   * GPU never holds a long queue and the page's own frames (taps, animation) slip in between blocks.
   */
  let gate = null;
  const step = async () => {
    if (!gate) return;
    device.queue.submit([enc.finish()]);
    await device.queue.onSubmittedWorkDone();
    await gate();
    enc = device.createCommandEncoder();
  };

  const unet = async (x, ctx, M, t) => {
    let C = 4, H = 64, Wd = 64;
    let [h] = conv(x, 4, 64, 64, "unet.conv_in"); C = 320;
    const skips = [[h, C, H, Wd]];
    // down 0
    let r; [r, C] = resnet(h, C, H, Wd, "unet.down_blocks.0.resnets.0", t); skips.push([r, C, H, Wd]); await step();
    let d; [d, C, H, Wd] = conv(r, C, H, Wd, "unet.down_blocks.0.downsamplers.0.conv", { s: 2 }); skips.push([d, C, H, Wd]);
    // down 1, 2
    h = d;
    for (const bi of [1, 2]) {
      [r, C] = resnet(h, C, H, Wd, `unet.down_blocks.${bi}.resnets.0`, t); await step();
      const a = transformer(r, C, H, Wd, `unet.down_blocks.${bi}.attentions.0`, ctx, M); free(r);
      skips.push([a, C, H, Wd]); h = a; await step();
      if (bi === 1) { [d, C, H, Wd] = conv(h, C, H, Wd, "unet.down_blocks.1.downsamplers.0.conv", { s: 2 }); skips.push([d, C, H, Wd]); h = d; }
    }
    // up blocks
    let first = true;
    for (const bi of [0, 1, 2]) {
      for (const ri of [0, 1]) {
        const [s, Cs] = skips.pop();
        const cat = alloc((C + Cs) * H * Wd);
        enc.copyBufferToBuffer(h.b, 0, cat.b, 0, C * H * Wd * 4);
        enc.copyBufferToBuffer(s.b, 0, cat.b, C * H * Wd * 4, Cs * H * Wd * 4);
        if (!first) free(h); first = false;
        free(s);
        let rr; [rr, C] = resnet(cat, C + Cs, H, Wd, `unet.up_blocks.${bi}.resnets.${ri}`, t); free(cat); await step();
        if (bi < 2) { h = transformer(rr, C, H, Wd, `unet.up_blocks.${bi}.attentions.${ri}`, ctx, M); free(rr); await step(); } else h = rr;
      }
      if (bi < 2) {
        const u = alloc(C * H * Wd * 4); elem("up2", [C, H, Wd, 0], { 1: h.b, 2: u.b }, C * H * Wd * 4); free(h);
        H *= 2; Wd *= 2;
        [h] = conv(u, C, H, Wd, `unet.up_blocks.${bi}.upsamplers.0.conv`); free(u);
      }
    }
    const g = gn(h, C, H * Wd, "unet.conv_norm_out", true, 1e-5); free(h);
    const [eps] = conv(g, C, H, Wd, "unet.conv_out"); free(g);
    return eps;
  };

  const decode = async (z) => {
    let C = 4, H = 64, Wd = 64, h;
    [h, C] = conv(z, C, H, Wd, "dec.layers.0", { act: "relu" });
    const block = async (x, i) => {
      const [a] = conv(x, C, H, Wd, `dec.layers.${i}.conv.0`, { act: "relu" });
      const [b] = conv(a, C, H, Wd, `dec.layers.${i}.conv.2`, { act: "relu" }); free(a);
      const [c] = conv(b, C, H, Wd, `dec.layers.${i}.conv.4`, { act: "relu", res: x }); free(b, x);
      await step();
      return c;
    };
    for (const i of [2, 3, 4]) h = await block(h, i);
    for (const [u, c1, blocks] of [[5, 6, [7, 8, 9]], [10, 11, [12, 13, 14]], [15, 16, [17]]]) {
      const up = alloc(C * H * Wd * 4); elem("up2", [C, H, Wd, 0], { 1: h.b, 2: up.b }, C * H * Wd * 4); free(h);
      H *= 2; Wd *= 2;
      [h] = conv(up, C, H, Wd, `dec.layers.${c1}`); free(up);
      for (const i of blocks) h = await block(h, i);
    }
    const [img] = conv(h, C, H, Wd, "dec.layers.18"); free(h);
    return img;
  };

  /** Concatenate trait-phrase embeddings into one cross-attention context. */
  const context = (keys) => {
    const parts = keys.map((k) => { const e = cpu["emb." + k]; if (!e) throw new Error("unknown phrase " + k); return e; });
    const M = parts.reduce((a, e) => a + e.shape[0], 0);
    if (M > 1024) throw new Error("too many trait tokens");
    const all = new Float32Array(M * 768); let o = 0;
    for (const e of parts) { all.set(e.data, o); o += e.data.length; }
    const t = alloc(M * 768); device.queue.writeBuffer(t.b, 0, all); return [t, M];
  };

  /** Seeded standard-normal latent (mulberry32 + Box-Muller). */
  const noise = (seed) => {
    let a = seed >>> 0;
    const r = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const z = new Float32Array(4 * 64 * 64);
    for (let i = 0; i < z.length; i += 2) { const u = Math.max(r(), 1e-12), v = r(), m = Math.sqrt(-2 * Math.log(u)); z[i] = m * Math.cos(2 * Math.PI * v); z[i + 1] = m * Math.sin(2 * Math.PI * v); }
    return z;
  };

  const readback = async (t, n, Ctor = Float32Array) => {
    const r = device.createBuffer({ size: n * 4, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST });
    const e = device.createCommandEncoder(); e.copyBufferToBuffer(t.b, 0, r, 0, n * 4); device.queue.submit([e.finish()]);
    await r.mapAsync(GPUMapMode.READ); const out = new Ctor(r.getMappedRange().slice(0)); r.destroy(); return out;
  };

  /**
   * Paint one 512x512 image. `traits` are phrase keys from the manifest; `seed` picks the noise (or pass `latent`).
   * Returns ImageData-ready RGBA bytes plus timings.
   */
  async function paint({ traits, seed = 1, latent = null, debug = false, gate: g = null }) {
    gate = g;
    const t0 = performance.now();
    const t = 999, a = manifest.alphas_cumprod[t];
    temp = [];
    enc = device.createCommandEncoder();
    const [ctx, M] = context(traits);
    const x = alloc(4 * 64 * 64); device.queue.writeBuffer(x.b, 0, latent || noise(seed));
    const eps = await unet(x, ctx, M, t); free(ctx);
    const z = alloc(4 * 64 * 64);
    elem("step", [4 * 64 * 64, fl(Math.sqrt(a)), fl(Math.sqrt(1 - a)), 0], { 1: x.b, 2: eps.b, 3: z.b }, 4 * 64 * 64);
    device.queue.submit([enc.finish()]);
    let epsOut = null;
    if (debug) epsOut = await readback(eps, 4 * 64 * 64);
    await device.queue.onSubmittedWorkDone();
    const t1 = performance.now();
    free(x, eps);
    enc = device.createCommandEncoder();
    const img = await decode(z); free(z);
    const px = alloc(512 * 512);
    elem("rgba", [512 * 512, 0, 0, 0], { 1: img.b, 2: px.b }, 512 * 512);
    device.queue.submit([enc.finish()]);
    let imgOut = null;
    if (debug) imgOut = await readback(img, 3 * 512 * 512);
    free(img);
    const rgba = new Uint8ClampedArray((await readback(px, 512 * 512, Uint32Array)).buffer);
    free(px);
    for (const b of temp) b.destroy();
    const t2 = performance.now();
    return { rgba, ms: { unet: t1 - t0, decode: t2 - t1, total: t2 - t0 }, eps: epsOut, img: imgOut };
  }

  // ---------- U2-Net-p matte (cuts the hero out of its backdrop) ----------
  let u2 = null;
  if (manifest.matte) {
    const spec = JSON.parse(new TextDecoder().decode(await fetchChunk(manifest.matte.json)));
    const bin = new Uint8Array(await fetchChunk(manifest.matte.bin));
    const ws = {};
    for (const [nm, t] of Object.entries(spec.weights)) {
      const n = t.shape.reduce((a, b) => a * b, 1), h = new Uint16Array(bin.slice(t.offset, t.offset + n * 2).buffer), f = new Float32Array(n);
      for (let i = 0; i < n; i++) f[i] = F16[h[i]];
      ws[nm] = { w: { q: false, f: upload(f) }, shape: t.shape, f };
    }
    u2 = { spec, ws };
  }
  /** Alpha matte (320x320, 0..1) for an RGBA 512x512 image. */
  async function matte(rgba) {
    if (!u2) return null;
    const S = 320, cv = new OffscreenCanvas(S, S), g = cv.getContext("2d");
    const src = new OffscreenCanvas(512, 512); src.getContext("2d").putImageData(new ImageData(new Uint8ClampedArray(rgba), 512, 512), 0, 0);
    g.drawImage(src, 0, 0, S, S);
    const d = g.getImageData(0, 0, S, S).data;
    let mx = 1; for (let i = 0; i < d.length; i += 4) mx = Math.max(mx, d[i], d[i + 1], d[i + 2]);
    const mean = [0.485, 0.456, 0.406], std = [0.229, 0.224, 0.225], inp = new Float32Array(3 * S * S);
    for (let c = 0; c < 3; c++) for (let i = 0; i < S * S; i++) inp[c * S * S + i] = (d[i * 4 + c] / mx - mean[c]) / std[c];
    temp = [];
    enc = device.createCommandEncoder();
    const env = new Map(), shp = new Map();
    const x0 = alloc(3 * S * S); device.queue.writeBuffer(x0.b, 0, inp);
    env.set(u2.spec.input, x0); shp.set(u2.spec.input, [3, S, S]);
    const uses = new Map();
    for (const L of u2.spec.layers) for (const k of L.op === "concat" ? L.xs : L.op === "add" ? [L.a, L.b] : [L.x]) uses.set(k, (uses.get(k) || 0) + 1);
    const use = (k) => { const n = uses.get(k) - 1; uses.set(k, n); if (n === 0 && k !== u2.spec.output) free(env.get(k)); };
    const layers = u2.spec.layers;
    for (let li = 0; li < layers.length; li++) {
      const L = layers[li];
      let y;
      if (L.op === "conv") {
        const [C, H, W] = shp.get(L.x), wt = u2.ws[L.w];
        const fuse = layers[li + 1]?.op === "relu" && layers[li + 1].x === L.y && uses.get(L.y) === 1;
        [y] = conv(env.get(L.x), C, H, W, "", { w: wt.w, sh: wt.shape, bias: L.b ? u2.ws[L.b].w.f : null, d: L.d, act: fuse ? "relu" : "" });
        use(L.x);
        if (fuse) { li++; env.set(layers[li].y, y); shp.set(layers[li].y, L.shape.slice(1)); continue; }
      } else if (L.op === "relu" || L.op === "sigmoid") {
        const n = shp.get(L.x).reduce((a, b) => a * b, 1); y = alloc(n);
        if (L.op === "sigmoid") elem("sigmoid", [n, 0, 0, 0], { 1: env.get(L.x).b, 2: y.b }, n);
        else throw new Error("unfused relu");
        use(L.x);
      } else if (L.op === "pool") {
        const [C, H, W] = shp.get(L.x), n = C * Math.ceil(H / 2) * Math.ceil(W / 2); y = alloc(n);
        elem("pool", [C, H, W, 0], { 1: env.get(L.x).b, 2: y.b }, n); use(L.x);
      } else if (L.op === "resize") {
        const [C, H, W] = shp.get(L.x), [Ho, Wo] = L.to, n = C * Ho * Wo; y = alloc(n);
        elem("resize", [C, H, W, Ho, Wo, 0, 0, 0], { 1: env.get(L.x).b, 2: y.b }, n); use(L.x);
      } else if (L.op === "add") {
        const n = shp.get(L.a).reduce((a, b) => a * b, 1); y = alloc(n);
        elem("add", [n, 0, 0, 0], { 1: env.get(L.a).b, 2: env.get(L.b).b, 3: y.b }, n); use(L.a); use(L.b);
      } else if (L.op === "concat") {
        const n = L.shape.slice(1).reduce((a, b) => a * b, 1); y = alloc(n); let off = 0;
        for (const k of L.xs) { const m = shp.get(k).reduce((a, b) => a * b, 1); enc.copyBufferToBuffer(env.get(k).b, 0, y.b, off, m * 4); off += m * 4; }
        for (const k of L.xs) use(k);
      }
      env.set(L.y, y); shp.set(L.y, L.shape.slice(1));
    }
    device.queue.submit([enc.finish()]);
    const out = env.get(u2.spec.output);
    const m = await readback(out, S * S);
    for (const [k, t] of env) if (live.has(t)) free(t);
    for (const b of temp) b.destroy();
    let lo = Infinity, hi = -Infinity; for (const v of m) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
    for (let i = 0; i < m.length; i++) m[i] = (m[i] - lo) / Math.max(1e-6, hi - lo);
    return m;
  }

  const info = adapter.info || {};
  return { paint, matte, device, lost: device.lost, phrases: manifest.phrases, gpuName: [info.vendor, info.architecture, info.description].filter(Boolean).join(" ") };
}
