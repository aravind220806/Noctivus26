import React, { useState } from 'react';
import { AccessLevel } from './AccessLevel';
import { Permissions } from './Permissions';
import { CONTACTS_REVEAL_ON_CLICK } from '../../data/coordinators';

export function MemberDetails({ member }) {
  const [contactsVisible, setContactsVisible] = useState(!CONTACTS_REVEAL_ON_CLICK);
  const isFaculty = member.type === 'faculty';
  const isRegistration = member.type === 'registration';

  const authText = isFaculty
    ? 'AUTHORIZED FACULTY COORDINATOR FOR NOCTIVUS 26 SYMPOSIUM OPERATIONS.'
    : isRegistration
    ? 'AUTHORIZED REGISTRATION AND PARTICIPANT SUPPORT UNIT.'
    : 'AUTHORIZED TO COORDINATE ALL STUDENT ACTIVITIES AND MANAGE ALL DEPARTMENTS.';

  return (
    <div className="noc-member-details-panel">
      <section className="noc-info-section noc-role-section">
        <span className="noc-field-label">ROLE</span>
        <h3 className="noc-field-role-val">{member.role}</h3>
      </section>

      <section className="noc-info-section noc-meta-fields-grid">
        <div className="noc-field-group">
          <span className="noc-field-label">ID NO.</span>
          <span className="noc-field-val noc-id-val">{member.id}</span>
        </div>

        <div className="noc-field-group">
          <span className="noc-field-label">NAME</span>
          <span className="noc-field-val noc-name-val">{member.name}</span>
        </div>

        {member.department && (
          <div className="noc-field-group noc-field-full">
            <span className="noc-field-label">DEPARTMENT</span>
            <span className="noc-field-val">{member.department}</span>
          </div>
        )}

        {member.year && (
          <div className="noc-field-group">
            <span className="noc-field-label">YEAR</span>
            <span className="noc-field-val">{member.year}</span>
          </div>
        )}

        {member.designation && (
          <div className="noc-field-group">
            <span className="noc-field-label">DESIGNATION</span>
            <span className="noc-field-val">{member.designation}</span>
          </div>
        )}

        {(member.phone || member.email) && CONTACTS_REVEAL_ON_CLICK && (
          <div className="noc-field-group noc-field-full">
            <button
              type="button"
              className="noc-field-val noc-link-val"
              aria-expanded={contactsVisible}
              onClick={() => setContactsVisible((visible) => !visible)}
            >
              {contactsVisible ? 'Hide contact' : 'Show contact'}
            </button>
          </div>
        )}

        {member.phone && contactsVisible && (
          <div className="noc-field-group">
            <span className="noc-field-label">CONTACT</span>
            <a href={`tel:${member.phone.replace(/\s+/g, '')}`} className="noc-field-val noc-link-val">
              {member.phone}
            </a>
          </div>
        )}

        {member.email && contactsVisible && (
          <div className="noc-field-group noc-field-full">
            <span className="noc-field-label">EMAIL</span>
            <a href={`mailto:${member.email}`} className="noc-field-val noc-link-val">
              {member.email}
            </a>
          </div>
        )}
      </section>

      <section className="noc-info-section noc-access-section">
        <AccessLevel level={member.accessLevel || 5} max={8} />
      </section>

      <section className="noc-info-section noc-permissions-section">
        <Permissions permissions={member.permissions} />
      </section>

      <section className="noc-info-section noc-auth-area">
        <div className="noc-emblem-watermark" aria-hidden="true">
          <svg viewBox="0 0 100 60" width="90" height="54" fill="none" stroke="#7a95a8" strokeWidth="1.2">
            <path d="M50 15 L58 30 L80 18 L68 40 L95 38 L65 52 L50 42 L35 52 L5 38 L32 40 L20 18 L42 30 Z" />
            <path d="M50 20 L50 42" strokeWidth="0.8" />
            <circle cx="50" cy="22" r="3" strokeWidth="0.8" />
          </svg>
        </div>
        <p className="noc-auth-text">{authText}</p>
        <div className="noc-validity-row">
          <span className="noc-valid-label">VALID FOR:</span>
          <span className="noc-valid-val">ACADEMIC YEAR 2025–2026</span>
        </div>
      </section>
    </div>
  );
}
