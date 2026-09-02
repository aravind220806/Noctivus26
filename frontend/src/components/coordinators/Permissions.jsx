import React from 'react';

export function Permissions({ permissions = [] }) {
  if (!permissions || permissions.length === 0) return null;

  return (
    <div className="noc-permissions-wrap">
      <span className="noc-permissions-title">PERMISSIONS</span>
      <ul className="noc-permissions-list">
        {permissions.map((perm, idx) => (
          <li key={idx} className="noc-permission-item">
            <span className="noc-perm-bullet" aria-hidden="true">◆</span>
            <span className="noc-perm-text">{perm}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
