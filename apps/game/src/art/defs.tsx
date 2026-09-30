/**
 * Shared SVG filters for the ink-and-watercolor look. Mounted once per page (ArtDefs);
 * figures reference them as filter="url(#wc)" and so on.
 *
 * - wc:      the figure treatment. Wobbles edges like wet pigment, mottles the wash and adds paper granulation.
 * - wc-wash: heavier bleed for backdrops, shadows and big washes.
 * - glow:    soft light for runes, eyes, lanterns and magic.
 * - grain:   paper fibres for full-screen overlays.
 */
export function ArtDefs() {
  return (
    <svg width="0" height="0" style={{ position: "absolute", width: 0, height: 0 }} aria-hidden="true" focusable="false">
      <defs>
        <filter id="wc" x="-10%" y="-10%" width="120%" height="120%" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="7" result="n1" />
          <feDisplacementMap in="SourceGraphic" in2="n1" scale="3.2" xChannelSelector="R" yChannelSelector="G" result="w" />
          <feTurbulence type="fractalNoise" baseFrequency="0.055" numOctaves="3" seed="11" result="n2" />
          <feColorMatrix in="n2" type="matrix" values="0 0 0 0 0.12  0 0 0 0 0.08  0 0 0 0 0.16  0.9 0 0 0 -0.38" result="blot" />
          <feComposite in="blot" in2="w" operator="in" result="blotIn" />
          <feBlend in="blotIn" in2="w" mode="multiply" result="mott" />
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="1" seed="2" result="n3" />
          <feColorMatrix in="n3" type="matrix" values="0 0 0 0 0.25  0 0 0 0 0.2  0 0 0 0 0.15  0 0 0 -0.9 0.62" result="gran" />
          <feComposite in="gran" in2="w" operator="in" result="granIn" />
          <feBlend in="granIn" in2="mott" mode="multiply" />
        </filter>
        <filter id="wc-wash" x="-15%" y="-15%" width="130%" height="130%" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="0.018" numOctaves="3" seed="4" result="n1" />
          <feDisplacementMap in="SourceGraphic" in2="n1" scale="14" xChannelSelector="R" yChannelSelector="G" result="w" />
          <feGaussianBlur in="w" stdDeviation="1.2" result="b" />
          <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="3" seed="19" result="n2" />
          <feColorMatrix in="n2" type="matrix" values="0 0 0 0 0.1  0 0 0 0 0.08  0 0 0 0 0.14  1.1 0 0 0 -0.45" result="blot" />
          <feComposite in="blot" in2="b" operator="in" result="blotIn" />
          <feBlend in="blotIn" in2="b" mode="multiply" />
        </filter>
        <filter id="glow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="4" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="glow-soft" x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="9" />
        </filter>
        <filter id="grain" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.75" numOctaves="2" seed="5" />
          <feColorMatrix type="matrix" values="0 0 0 0 0.35  0 0 0 0 0.28  0 0 0 0 0.2  0 0 0 -1.2 0.9" />
        </filter>
      </defs>
    </svg>
  );
}
