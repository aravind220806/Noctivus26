import { Component, StrictMode, lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';

class RootErrorBoundary extends Component {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error, info) {
    if (import.meta.env.DEV) {
      // In dev mode only
    }
  }
  render() {
    if (this.state.hasError) {
      return (
        <main className="app-error" role="alert">
          <h1>Something went wrong.</h1>
          <button className="button button-primary" type="button" onClick={() => window.location.reload()}>
            Reload page
          </button>
        </main>
      );
    }
    return this.props.children;
  }
}

const AdminApp = lazy(() => import('./admin/AdminApp.jsx'));
const PassVerification = lazy(() => import('./pages/PassVerification.jsx'));
const DeviceDemo = lazy(() => import('./components/registration-device/DeviceDemo.jsx'));
const isAdminRoute = window.location.pathname.startsWith('/admin');
const isLoginRoute = window.location.pathname.startsWith('/login');
const isPassRoute = window.location.pathname.startsWith('/p/');
const isDeviceRoute = window.location.pathname.startsWith('/device');

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

