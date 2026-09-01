import { Component, StrictMode, lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';

class RootErrorBoundary extends Component {
  state = { hasError: false, error: null };
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    console.error('Uncaught application error:', error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <main className="app-error" role="alert" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem', textAlign: 'center', background: '#0a0a0c', color: '#f1f5f9' }}>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '0.75rem' }}>Something went wrong.</h1>
          {this.state.error && (
            <p style={{ color: '#f87171', maxWidth: '600px', fontSize: '0.9rem', marginBottom: '1.5rem', background: 'rgba(239, 68, 68, 0.1)', padding: '10px 16px', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
              {this.state.error.message || String(this.state.error)}
            </p>
          )}
          <div style={{ display: 'flex', gap: '12px' }}>
            <button className="button button-primary" type="button" onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload(); }}>
              Reload page
            </button>
            <a className="button button-secondary" href="/" style={{ textDecoration: 'none' }}>
              Return Home
            </a>
          </div>
        </main>
      );
    }
    return this.props.children;
  }
}

const AdminApp = lazy(() => import('./admin/AdminApp.jsx'));
const PassVerification = lazy(() => import('./pages/PassVerification.jsx'));
const DeviceDemo = lazy(() => import('./components/registration-device/DeviceDemo.jsx'));
const currentPath = window.location.pathname.toLowerCase();
const isAdminRoute = currentPath.startsWith('/admin') || currentPath.startsWith('/adimn');
const isLoginRoute = currentPath.startsWith('/login');
const isPassRoute = currentPath.startsWith('/p/');
const isDeviceRoute = currentPath.startsWith('/device');

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <RootErrorBoundary>
      {isAdminRoute || isLoginRoute ? (
        <Suspense fallback={<div className="admin-loading">Loading admin panel...</div>}>
          <AdminApp />
        </Suspense>
      ) : isPassRoute ? (
        <Suspense fallback={<div className="admin-loading">Verifying pass...</div>}>
          <PassVerification />
        </Suspense>
      ) : isDeviceRoute ? (
        <Suspense fallback={<div className="admin-loading">Loading device demo...</div>}>
          <DeviceDemo />
        </Suspense>
      ) : (
        <App />
      )}
    </RootErrorBoundary>
  </StrictMode>,
);

