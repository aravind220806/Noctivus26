import { BionisIcons } from './icons';

type TopbarProps = {
  activeTab: string;
  onRefresh: () => void;
  onMenuToggle: () => void;
};

export function Topbar({ activeTab, onRefresh, onMenuToggle }: TopbarProps) {
  return (
    <header className="admin-topbar bionis-topbar">
      <button className="admin-menu-toggle" type="button" onClick={onMenuToggle} aria-label="Toggle admin menu"><BionisIcons.menu size={20} /></button>
      <div><span className="kicker">ADMIN PANEL</span><h1>{activeTab}</h1></div>
      <div className="admin-topbar-actions"><button className="button button-secondary" onClick={onRefresh}><BionisIcons.refresh size={16} /> REFRESH DATA</button></div>
    </header>
  );
}
