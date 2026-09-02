import React from 'react';

export function MemberPortrait({ image, name, role }) {
  return (
    <div className="noc-member-portrait-frame">
      <img
        src={image || '/images/noctivus-students.webp'}
        alt={`${name} - ${role}`}
        className="noc-member-portrait-img"
        loading="lazy"
        decoding="async"
      />
      {/* 2. Background Darkening multiply layer for bright/white background */}
      <div className="noc-portrait-darken-layer" aria-hidden="true" />

      {/* 1. Radial vignette darkening the edges/corners to near-black */}
      <div className="noc-portrait-vignette-layer" aria-hidden="true" />

      {/* 5. Subtle blue-gray tint overlay */}
      <div className="noc-portrait-colorgrade-layer" aria-hidden="true" />

      {/* 3. Grain/noise texture overlay (15-18% opacity) */}
      <div className="noc-portrait-noise-layer" aria-hidden="true" />
    </div>
  );
}
