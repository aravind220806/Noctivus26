import React, { useState, useMemo, useCallback } from 'react';
import { events as allEvents } from '../../data/site.js';
import './RegistrationDevice.css';

/**
 * NOCTIVUS Registration Device — Functional Handheld Terminal (Phase 5C-1)
 */
export function RegistrationDevice({ onSelectEvent, onConfirmEvent }) {
  // Filter 8 registerable events
  const registerableEvents = useMemo(() => {
    return allEvents.filter((e) => e.registerable !== false);
  }, []);

  const [selectedIndex, setSelectedIndex] = useState(0);
  const [rotation, setRotation] = useState(0);
  const [flashConfirm, setFlashConfirm] = useState(false);

  const totalEvents = registerableEvents.length;
  const currentEvent = registerableEvents[selectedIndex] || registerableEvents[0];

  const handleNext = useCallback(() => {
    setSelectedIndex((prev) => (prev + 1) % totalEvents);
    setRotation((prev) => prev + 45);
    if (onSelectEvent) onSelectEvent(registerableEvents[(selectedIndex + 1) % totalEvents]);
  }, [totalEvents, selectedIndex, registerableEvents, onSelectEvent]);

  const handlePrev = useCallback(() => {
    setSelectedIndex((prev) => (prev - 1 + totalEvents) % totalEvents);
    setRotation((prev) => prev - 45);
    if (onSelectEvent) onSelectEvent(registerableEvents[(selectedIndex - 1 + totalEvents) % totalEvents]);
  }, [totalEvents, selectedIndex, registerableEvents, onSelectEvent]);

  const handleWheelScroll = (e) => {
    if (e.deltaY > 0) {
      handleNext();
    } else if (e.deltaY < 0) {
      handlePrev();
    }
  };

  const handleConfirm = () => {
    setFlashConfirm(true);
    setTimeout(() => setFlashConfirm(false), 600);
    console.log(`[CONFIRM SELECTION] Event: ${currentEvent.id}`);
    if (onConfirmEvent) {
      onConfirmEvent(currentEvent);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
      e.preventDefault();
      handleNext();
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
      e.preventDefault();
      handlePrev();
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleConfirm();
    }
  };

  return (
    <div className="device-wrapper">
      <div 
        className="device-body" 
        tabIndex={0} 
        onKeyDown={handleKeyDown}
        aria-label={`NOCTIVUS Registration Terminal. Current event: ${currentEvent.name}. Use arrow keys to browse, Enter to select.`}
      >
        {/* Physical Mounting Screws */}
        <div className="device-screw screw-tl" />
        <div className="device-screw screw-tr" />
        <div className="device-screw screw-bl" />
        <div className="device-screw screw-br" />

        {/* Top Header Panel */}
        <div className="device-header-strip">
          <span className="device-model-no">NCT-REG // TERM-01</span>
          <div className="device-status-led">
            <span className="led-dot" />
            <span>SYS READY</span>
          </div>
        </div>

        {/* Recessed Display Enclosure */}
        <div className="device-screen-bezel">
          <div className="device-display">
            {flashConfirm && (
              <div className="display-confirm-flash">
                <span>SELECTION CONFIRMED</span>
              </div>
            )}

            {/* Display Header Metadata */}
            <div className="display-header-meta">
              <span>[EVENT {String(selectedIndex + 1).padStart(2, '0')}/{String(totalEvents).padStart(2, '0')}]</span>
              <span className="display-category-badge">{currentEvent.category || 'TECHNICAL'}</span>
            </div>

            {/* Main Event Content */}
            <div className="display-body">
              <h2 className="display-title">{currentEvent.name}</h2>
              {currentEvent.format && (
                <p className="display-format" title={currentEvent.format}>
                  {currentEvent.format}
                </p>
              )}
            </div>

            {/* Display Footer Metadata */}
            <div className="display-footer-meta">
              <span className="display-fee">FEE: ₹{currentEvent.fee}</span>
              <span className="display-nav-hint">SCROLL / ARROWS TO BROWSE</span>
            </div>
          </div>
        </div>

        {/* Tactile Control Interface */}
        <div className="device-controls">
          {/* D-Pad Controls */}
          <div className="control-dpad">
            <button className="dpad-btn dpad-up" onClick={handlePrev} aria-label="Previous Event">▲</button>
            <button className="dpad-btn dpad-left" onClick={handlePrev} aria-label="Previous Event">◀</button>
            <div className="dpad-center" />
            <button className="dpad-btn dpad-right" onClick={handleNext} aria-label="Next Event">▶</button>
            <button className="dpad-btn dpad-down" onClick={handleNext} aria-label="Next Event">▼</button>
          </div>

          {/* Rotary Dial / Wheel */}
          <div className="control-wheel-unit">
            <div 
              className="wheel-housing" 
              onWheel={handleWheelScroll}
              onClick={handleNext}
              title="Scroll wheel or click to rotate events"
            >
              <div 
                className="wheel-dial" 
                style={{ transform: `rotate(${rotation}deg)` }}
              >
                <div className="wheel-ridge ridge-0" />
                <div className="wheel-ridge ridge-1" />
                <div className="wheel-ridge ridge-2" />
                <div className="wheel-ridge ridge-3" />
                <div className="wheel-center-cap" />
              </div>
            </div>
            <span className="wheel-label">DIAL SELECT</span>
          </div>

          {/* Action Buttons */}
          <div className="control-actions">
            <button className="action-btn" onClick={handleNext}>NEXT</button>
            <button className="action-btn primary" onClick={handleConfirm}>CONFIRM</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default RegistrationDevice;
