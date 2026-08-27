import { StrictMode, lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';

const AdminApp = lazy(() => import('./admin/AdminApp'));
const isAdminRoute = window.location.pathname.startsWith('/admin');
const isLoginRoute = window.location.pathname.startsWith('/login');

const rootElement = document.getElementById('root');
if (rootElement) {
  createRoot(rootElement).render(
    <StrictMode>
      {isAdminRoute || isLoginRoute ? (
        <Suspense fallback={<div className="admin-loading">Loading admin panel...</div>}>
          <AdminApp />
        </Suspense>
      ) : (
        <App />
      )}
    </StrictMode>
  );
}
