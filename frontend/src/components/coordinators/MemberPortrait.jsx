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
      <div className="noc-portrait-scanline-layer" aria-hidden="true" />
    </div>
  );
}
