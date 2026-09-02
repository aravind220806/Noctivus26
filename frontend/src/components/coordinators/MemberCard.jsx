import React from 'react';
import { CardHeader } from './CardHeader';
import { CardFooter } from './CardFooter';
import { MemberPortrait } from './MemberPortrait';
import { MemberDetails } from './MemberDetails';
import './MemberCard.css';

export function MemberCard({ member }) {
  if (!member) return null;

  return (
    <article className="noc-member-card" id={`card-${member.id}`}>
      {/* Header */}
      <CardHeader type={member.type} />

      {/* Main Body (Left Portrait + Right Details) */}
      <div className="noc-card-body">
        <div className="noc-card-col-portrait">
          <MemberPortrait
            image={member.image}
            name={member.name}
            role={member.role}
          />
        </div>

        <div className="noc-card-col-details">
          <MemberDetails member={member} />
        </div>
      </div>

      {/* Footer Bar */}
      <CardFooter
        line1="PROPERTY OF COLLEGE UNION"
        line2="STUDENT COUNCIL"
      />
    </article>
  );
}
