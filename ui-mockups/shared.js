// Shared helpers for the Ender UI mockups: SVG filters, skill glyphs, data loading.

const DEFS = `
<svg width="0" height="0" style="position:absolute" aria-hidden="true">
  <defs>
    <filter id="grain" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" result="n"/>
      <feColorMatrix in="n" type="matrix" values="0 0 0 0 0.46  0 0 0 0 0.38  0 0 0 0 0.33  0 0 0 -1.1 0.62"/>
    </filter>
    <filter id="rough" x="-5%" y="-5%" width="110%" height="110%">
      <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="3" result="t"/>
      <feDisplacementMap in="SourceGraphic" in2="t" scale="3.5"/>
    </filter>
    <filter id="wash" x="-20%" y="-20%" width="140%" height="140%">
      <feTurbulence type="fractalNoise" baseFrequency="0.012" numOctaves="3" seed="11" result="t"/>
      <feDisplacementMap in="SourceGraphic" in2="t" scale="26" result="d"/>
      <feGaussianBlur in="d" stdDeviation="2.2"/>
    </filter>
    <filter id="washSoft" x="-30%" y="-30%" width="160%" height="160%">
      <feTurbulence type="fractalNoise" baseFrequency="0.02" numOctaves="2" seed="5" result="t"/>
      <feDisplacementMap in="SourceGraphic" in2="t" scale="18" result="d"/>
      <feGaussianBlur in="d" stdDeviation="5"/>
    </filter>
    <filter id="inkline" x="-5%" y="-5%" width="110%" height="110%">
      <feTurbulence type="fractalNoise" baseFrequency="0.08" numOctaves="1" seed="2" result="t"/>
      <feDisplacementMap in="SourceGraphic" in2="t" scale="2"/>
    </filter>
    <filter id="pool" x="-10%" y="-10%" width="120%" height="120%">
      <!-- edge pooling: darker rim inside a wash (section 79, max ~8% darkening) -->
      <feMorphology in="SourceAlpha" operator="erode" radius="3" result="e"/>
      <feComposite in="SourceAlpha" in2="e" operator="out" result="rim"/>
      <feGaussianBlur in="rim" stdDeviation="1.5" result="rimb"/>
      <feFlood flood-color="#24212a" flood-opacity="0.22"/>
      <feComposite in2="rimb" operator="in" result="rimc"/>
      <feMerge><feMergeNode in="SourceGraphic"/><feMergeNode in="rimc"/></feMerge>
    </filter>
  </defs>
</svg>`;

// Original ink glyphs for the Binder's kit, drawn in a 48×48 box.
export const GLYPHS = {
  lash: `<path d="M9 36 C 14 18, 30 10, 40 12" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round"/>
         <path d="M12 38 C 20 26, 30 22, 39 22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" opacity=".7"/>
         <circle cx="40" cy="12" r="2.6" fill="currentColor"/>`,
  sever: `<path d="M10 40 L 38 8" stroke="currentColor" stroke-width="4.2" stroke-linecap="round"/>
          <path d="M16 42 L 42 14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" opacity=".6"/>
          <path d="M8 30 L 14 26 M 30 44 L 34 38" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>`,
  bind: `<circle cx="24" cy="24" r="5" fill="currentColor"/>
         <path d="M6 12 Q 16 16 20 21 M42 12 Q 32 16 28 21 M6 38 Q 16 33 20 27 M42 38 Q 32 33 28 27" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>
         <circle cx="6" cy="12" r="2" fill="currentColor"/><circle cx="42" cy="12" r="2" fill="currentColor"/>
         <circle cx="6" cy="38" r="2" fill="currentColor"/><circle cx="42" cy="38" r="2" fill="currentColor"/>`,
  unravel: `<circle cx="24" cy="24" r="4" fill="currentColor"/>
            <circle cx="24" cy="24" r="11" fill="none" stroke="currentColor" stroke-width="2.4" stroke-dasharray="14 5"/>
            <circle cx="24" cy="24" r="19" fill="none" stroke="currentColor" stroke-width="1.6" stroke-dasharray="9 7" opacity=".75"/>`,
  sigil: `<path d="M24 5 L 40 14 L 40 33 L 24 43 L 8 33 L 8 14 Z" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linejoin="round"/>
          <path d="M24 13 L 24 35 M 15 19 L 33 29 M 33 19 L 15 29" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>`,
  fracture: `<path d="M6 40 L 12 32 L 10 26 L 16 20" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
             <path d="M18 34 L 24 26 L 22 20 L 28 13" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>
             <path d="M30 28 L 36 19 L 34 13 L 42 5" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>`,
  evade: `<path d="M8 32 C 16 34, 28 30, 38 18" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
          <path d="M31 16 L 39 17 L 38 25" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M6 24 C 12 25, 18 24, 24 20" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" opacity=".6"/>`,
  draught: `<path d="M19 6 h10 v8 c7 3 11 9 11 16 c0 8-7 13-16 13 s-16-5-16-13 c0-7 4-13 11-16 z" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"/>`,
};

export const glyph = (name, size = 48) =>
  `<svg viewBox="0 0 48 48" width="${size}" height="${size}" style="filter:url(#inkline)">${GLYPHS[name]}</svg>`;

export const ESSENCE_GLYPH = { ember: '♨', tide: '≈', storm: 'ϟ', root: '❦', glass: '◇', ash: '▲' };
export const ESSENCE_ORDER = ['ember', 'tide', 'storm', 'root', 'glass', 'ash'];
export const cap = (s) => s[0].toUpperCase() + s.slice(1);
export const essChip = (e, size = 22) =>
  `<span class="ess ${e}" style="width:${size}px;height:${size}px;font-size:${Math.round(size * 0.55)}px">${ESSENCE_GLYPH[e]}</span>`;

export async function load(...names) {
  return Promise.all(names.map((n) => fetch(`data/${n}.json`).then((r) => r.json())));
}

export function boot() {
  document.body.insertAdjacentHTML('afterbegin', DEFS);
  const q = new URLSearchParams(location.search);
  if (q.get('notes') === '1') document.body.classList.add('notes');
  return q;
}
