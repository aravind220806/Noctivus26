import React, { useState } from 'react';
import RegistrationDevice from './RegistrationDevice';

export default function DeviceDemo() {
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [log, setLog] = useState([]);

  const handleSelect = (event) => {
    setSelectedEvent(event);
  };

  const handleConfirm = (event) => {
    setLog((prev) => [`[CONFIRMED] ${event.name} (Fee: ₹${event.fee})`, ...prev.slice(0, 4)]);
  };

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: 'var(--bg)',
      color: 'var(--text)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '2rem 1rem'
    }}>
      <h2 style={{
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: '0.85rem',
        color: 'var(--muted)',
        letterSpacing: '0.2em',
        marginBottom: '0.5rem',
        textTransform: 'uppercase'
      }}>
        PHASE 5C-1 // NOCTIVUS REGISTRATION DEVICE (FUNCTIONAL)
      </h2>

      <p style={{
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: '0.75rem',
        color: 'var(--cyan)',
        marginBottom: '1.5rem',
        textAlign: 'center'
      }}>
        Use mouse wheel on dial, click d-pad/buttons, or use Arrow keys + Enter to navigate.
      </p>
      
      <RegistrationDevice 
        onSelectEvent={handleSelect}
        onConfirmEvent={handleConfirm}
      />

      {log.length > 0 && (
        <div style={{
          marginTop: '1.5rem',
          padding: '1rem',
          border: '1px dashed var(--line)',
          background: 'var(--surface)',
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: '0.75rem',
          color: 'var(--lime)',
          maxWidth: '580px',
          width: '100%',
          boxSizing: 'border-box'
        }}>
          <div>EVENT LOG:</div>
          {log.map((entry, idx) => (
            <div key={idx} style={{ marginTop: '0.25rem' }}>{entry}</div>
          ))}
        </div>
      )}
    </div>
  );
}
