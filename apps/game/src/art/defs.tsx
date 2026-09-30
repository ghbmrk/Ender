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
        {/* Burnished metal for UI frames drawn in SVG (Loom hexes and the like), referenced from CSS. */}
        <linearGradient id="ui-gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff0c0" />
          <stop offset="0.22" stopColor="#e2b85e" />
          <stop offset="0.48" stopColor="#7a5418" />
          <stop offset="0.7" stopColor="#f0cf7c" />
          <stop offset="1" stopColor="#5a3a0e" />
        </linearGradient>
        <linearGradient id="ui-iron" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#8e93a6" />
          <stop offset="0.5" stopColor="#393d4d" />
          <stop offset="1" stopColor="#5a5f73" />
        </linearGradient>
        <radialGradient id="ui-cell" cx="0.5" cy="0.35" r="0.75">
          <stop offset="0" stopColor="#3a3142" />
          <stop offset="1" stopColor="#15121a" />
        </radialGradient>
        <filter id="wc"x="-10%" y="-10%" width="120%" height="120%" colorInterpolationFilters="sRGB">
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
        {/*
          fig: the painted-figure treatment. The wc wash, plus dramatic studio lighting done once per raster:
          a saturation lift, volumetric pillow shading from the silhouette (key light from the upper right),
          a warm rim light just inside the ink line on the lit edge and a cool bounce light on the shadow edge.
        */}
        <filter id="fig" x="-12%" y="-12%" width="124%" height="124%" colorInterpolationFilters="sRGB">
          <feColorMatrix in="SourceGraphic" type="saturate" values="1.28" result="sat" />
          <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="7" result="n1" />
          <feDisplacementMap in="sat" in2="n1" scale="3" xChannelSelector="R" yChannelSelector="G" result="w" />
          <feTurbulence type="fractalNoise" baseFrequency="0.055" numOctaves="3" seed="11" result="n2" />
          <feColorMatrix in="n2" type="matrix" values="0 0 0 0 0.12  0 0 0 0 0.08  0 0 0 0 0.16  0.8 0 0 0 -0.36" result="blot" />
          <feComposite in="blot" in2="w" operator="in" result="blotIn" />
          <feBlend in="blotIn" in2="w" mode="multiply" result="mott" />
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="1" seed="2" result="n3" />
          <feColorMatrix in="n3" type="matrix" values="0 0 0 0 0.25  0 0 0 0 0.2  0 0 0 0 0.15  0 0 0 -0.9 0.58" result="gran" />
          <feComposite in="gran" in2="w" operator="in" result="granIn" />
          <feBlend in="granIn" in2="mott" mode="multiply" result="paint" />
          {/* volume: a soft height map from the silhouette, lit from the upper right */}
          <feGaussianBlur in="SourceAlpha" stdDeviation="2.6" result="hFine" />
          <feGaussianBlur in="SourceAlpha" stdDeviation="11" result="hBroad" />
          <feComposite in="hFine" in2="hBroad" operator="arithmetic" k2="0.45" k3="0.55" result="height" />
          <feDiffuseLighting in="height" surfaceScale="15" diffuseConstant="1" lightingColor="#fff1dc" result="shade">
            <feDistantLight azimuth="-50" elevation="38" />
          </feDiffuseLighting>
          <feComposite in="paint" in2="shade" operator="arithmetic" k1="1.22" k2="0.25" result="lit" />
          {/* cool shadow side: the unlit half of the form picks up a blue-violet ambient */}
          <feColorMatrix in="shade" type="matrix" values="0 0 0 0 0.3  0 0 0 0 0.36  0 0 0 0 0.78  -1.9 0 0 0 1.08" result="coolA" />
          <feBlend in="coolA" in2="lit" mode="multiply" result="lit2" />
          {/* painterly glints: a tight specular along the lit edges of the form */}
          <feSpecularLighting in="hFine" surfaceScale="7" specularConstant="1" specularExponent="16" lightingColor="#fff0d0" result="spec">
            <feDistantLight azimuth="-50" elevation="44" />
          </feSpecularLighting>
          <feComposite in="spec" in2="SourceAlpha" operator="arithmetic" k1="0.8" result="specIn" />
          <feBlend in="specIn" in2="lit2" mode="screen" result="lit3" />
          <feComposite in="lit3" in2="SourceAlpha" operator="in" result="litIn" />
          {/* rim and bounce light, kept just inside the ink outline */}
          <feMorphology in="SourceAlpha" operator="erode" radius="1.5" result="core" />
          <feOffset in="core" dx="-2.4" dy="2.4" result="offKey" />
          <feComposite in="core" in2="offKey" operator="out" result="rimA" />
          <feGaussianBlur in="rimA" stdDeviation="0.7" result="rimB" />
          <feFlood floodColor="#ffdc9a" floodOpacity="0.72" />
          <feComposite in2="rimB" operator="in" result="rim" />
          <feOffset in="core" dx="2.2" dy="-1.4" result="offBounce" />
          <feComposite in="core" in2="offBounce" operator="out" result="bnA" />
          <feGaussianBlur in="bnA" stdDeviation="1.1" result="bnB" />
          <feFlood floodColor="#7fa6ff" floodOpacity="0.26" />
          <feComposite in2="bnB" operator="in" result="bounce" />
          <feBlend in="rim" in2="litIn" mode="screen" result="r1" />
          <feBlend in="bounce" in2="r1" mode="screen" />
        </filter>
        <filter id="wc-wash"x="-15%" y="-15%" width="130%" height="130%" colorInterpolationFilters="sRGB">
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
