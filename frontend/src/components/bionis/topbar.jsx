import { BionisIcons } from './icons';

export function Topbar({ activeTab, onRefresh, onMenuToggle }) {
  return (
    <header className="admin-topbar bionis-topbar">
      <div className="admin-topbar-left">
        <button className="admin-menu-toggle" type="button" onClick={onMenuToggle} aria-label="Toggle admin menu">
          <BionisIcons.menu size={20} />
        </button>
        <div className="admin-topbar-title-wrap">
          <span className="kicker">ADMIN PANEL</span>
          <h1>{activeTab}</h1>
        </div>
      </div>
      <div className="admin-topbar-actions">
        <button className="button button-refresh" type="button" onClick={onRefresh}>
          <BionisIcons.refresh size={15} />
          <span>REFRESH DATA</span>
        </button>
      </div>
    </header>
  );
}
