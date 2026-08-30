import { Logo } from './logo';
import { navigationGroups } from './navigation';
import { cn } from './shared';

export function Sidebar({ activeTab, visibleTabs, onTabChange, user, onLogout }) {
  const allowed = new Set(visibleTabs);

  return (
    <aside className="admin-sidebar bionis-sidebar">
      <Logo />
      <nav className="bionis-nav">
        {navigationGroups.map((group) => {
          const items = group.items.filter((item) => allowed.has(item.label));
          if (!items.length) return null;
          return (
            <div className="bionis-nav__group" key={group.label}>
              <span className="admin-nav-label">{group.label}</span>
              {items.map((item) => {
                const Icon = item.icon;
                return (
                  <button key={item.label} className={cn(activeTab === item.label && 'active')} onClick={() => onTabChange(item.label)}>
                    <span className="admin-nav-dot" />
                    <Icon size={17} strokeWidth={2} />
                    {item.label}
                  </button>
                );
              })}
            </div>
          );
        })}
      </nav>
      <div className="admin-user bionis-user">
        {user?.picture ? <img src={user.picture} alt="" /> : <span className="admin-avatar">{(user?.name || 'A').slice(0, 1).toUpperCase()}</span>}
        <div><strong>{user?.name || 'Administrator'}</strong><small>{user?.email}</small></div>
        <button onClick={onLogout}>Sign out</button>
      </div>
    </aside>
  );
}
