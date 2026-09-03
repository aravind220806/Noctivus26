import React from 'react';
import { MemberCard } from './MemberCard';

export function CoordinatorSection({
  id,
  sectionIndex = '01 / 03',
  title = 'COORDINATORS',
  members = [],
}) {
  return (
    <section className="noc-coord-section" id={id}>
      <div className="noc-coord-section-header">
        <span className="noc-coord-section-idx">{sectionIndex}</span>
        <div className="noc-coord-heading-row">
          <h2 className="noc-coord-section-title">
            {title}
            <span className="noc-coord-cursor">_</span>
          </h2>
          <div className="noc-coord-header-line" aria-hidden="true">
            <span className="noc-line-head" />
            <span className="noc-line-body" />
          </div>
        </div>
      </div>

      <div className="noc-coord-cards-grid">
        {members.map((member) => (
          <MemberCard key={member.id} member={member} />
        ))}
      </div>
    </section>
  );
}
