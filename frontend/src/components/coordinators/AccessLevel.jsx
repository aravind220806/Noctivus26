import React from 'react';

export function AccessLevel({ level = 5, max = 8 }) {
  const safeLevel = Math.max(1, Math.min(max, Number(level) || 1));

  return (
    <div className="noc-access-level-wrap" aria-label={`Access Level ${safeLevel} of ${max}`}>
      <span className="noc-access-label">ACCESS LEVEL</span>
      <div className="noc-access-row">
        <span className="noc-access-val">LEVEL {safeLevel}</span>
        <div className="noc-access-blocks" role="img" aria-label={`${safeLevel} of ${max} blocks active`}>
          {Array.from({ length: max }).map((_, i) => (
            <span
              key={i}
              className={`noc-access-block ${i < safeLevel ? 'is-filled' : 'is-empty'}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
