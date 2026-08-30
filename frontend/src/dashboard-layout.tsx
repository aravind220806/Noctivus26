import { ThemeProvider } from './components/bionis/theme-provider';
import { Sidebar } from './components/bionis/sidebar';
import { Topbar } from './components/bionis/topbar';

type DashboardLayoutProps = {
  activeTab: string;
  visibleTabs: string[];
  sidebarOpen: boolean;
  user: { name?: string; email?: string; picture?: string };
  onTabChange: (tab: string) => void;
  onRefresh: () => void;
  onLogout: () => void;
  onMenuToggle: () => void;
  children: React.ReactNode;
};

export default function DashboardLayout({ activeTab, visibleTabs, sidebarOpen, user, onTabChange, onRefresh, onLogout, onMenuToggle, children }: DashboardLayoutProps) {
  return (
    <ThemeProvider>
      <main className={`admin-shell ${sidebarOpen ? 'admin-shell--nav-open' : ''}`}>
        <Sidebar activeTab={activeTab} visibleTabs={visibleTabs} onTabChange={onTabChange} user={user} onLogout={onLogout} />
        <section className="admin-main">
          <Topbar activeTab={activeTab} onRefresh={onRefresh} onMenuToggle={onMenuToggle} />
          {children}
        </section>
      </main>
    </ThemeProvider>
  );
}
