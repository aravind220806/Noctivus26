import { ThemeProvider } from './components/bionis/theme-provider';
import { Sidebar } from './components/bionis/sidebar';
import { Topbar } from './components/bionis/topbar';

export default function DashboardLayout({
  activeTab,
  visibleTabs,
  sidebarOpen,
  user,
  onTabChange,
  onRefresh,
  onLogout,
  onMenuToggle,
  autoRefresh,
  onToggleAutoRefresh,
  isRefreshing,
  lastRefreshedAt,
  children,
}) {
  return (
    <ThemeProvider>
      <main className={`admin-shell ${sidebarOpen ? 'admin-shell--nav-open' : ''}`}>
        <Sidebar
          activeTab={activeTab}
          visibleTabs={visibleTabs}
          onTabChange={onTabChange}
          user={user}
          onLogout={onLogout}
          onClose={onMenuToggle}
        />
        <section className="admin-main">
          <Topbar
            activeTab={activeTab}
            onRefresh={onRefresh}
            onMenuToggle={onMenuToggle}
            autoRefresh={autoRefresh}
            onToggleAutoRefresh={onToggleAutoRefresh}
            isRefreshing={isRefreshing}
            lastRefreshedAt={lastRefreshedAt}
          />
          {children}
        </section>
      </main>
    </ThemeProvider>
  );
}
