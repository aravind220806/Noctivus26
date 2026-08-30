import React from 'react';
import LineSidebar from '../LineSidebar';
import './Sidebar.css';

const NAV_ITEMS = ['HOME', 'ABOUT', 'EVENTS', 'SCHEDULE', 'COORDINATORS'];
const SECTION_IDS = ['home', 'about', 'events', 'schedule', 'coordinators'];

export default function Sidebar({ activeSection, onNavigate }) {
  const activeIndex = SECTION_IDS.indexOf(activeSection);

  const handleClick = (index) => {
    onNavigate(SECTION_IDS[index]);
  };

  return (
    <nav className="desktop-sidebar" aria-label="Desktop main navigation">
      <div className="sidebar-linesidebar">
        <LineSidebar
          items={NAV_ITEMS}
          active={activeIndex >= 0 ? activeIndex : 0}
          accentColor="#00DDF2"
          textColor="#7E9096"
          markerColor="#506058"
          showIndex
          showMarker
          proximityRadius={100}
          maxShift={30}
          falloff="smooth"
          markerLength={60}
          markerGap={0}
          tickScale={0.5}
          scaleTick
          itemGap={20}
          fontSize={1.1}
          smoothing={100}
          defaultActive={0}
          onItemClick={handleClick}
        />
      </div>
    </nav>
  );
}
