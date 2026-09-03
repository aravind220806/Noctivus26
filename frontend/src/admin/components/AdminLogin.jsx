import { useEffect, useState } from 'react';
import { adminFetch, apiPath, googleClientId } from '../adminUtils';

export function AdminLogin({ onSession }) {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [buttonReady, setButtonReady] = useState(false);

  useEffect(() => {
    if (!googleClientId) {
      setLoading(false);
      setError('Google sign-in is not configured in this frontend. Restart Vite after setting VITE_GOOGLE_CLIENT_ID.');
      return undefined;
    }
    const existing = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
    const script = existing || document.createElement('script');
    let timedOut = false;
    const timeout = window.setTimeout(() => {
      timedOut = true;
      setLoading(false);
      setError('Google sign-in timed out. Check your network connection and allow accounts.google.com.');
    }, 8000);
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    const initializeGoogle = () => {
      if (timedOut) return;
      try {
        if (!window.google?.accounts?.id) throw new Error('Google sign-in is unavailable.');
        window.google.accounts.id.disableAutoSelect?.();
        window.google.accounts.id.initialize({
          client_id: googleClientId,
          callback: async ({ credential }) => {
            setLoading(true);
            try {
              const response = await adminFetch(apiPath('/api/admin/auth/google'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ credential }),
              });
              const data = await response.json().catch(() => ({}));
              if (!response.ok) throw new Error(data.detail || data.message || `Google sign-in failed (${response.status}).`);
              onSession(data);
              window.location.replace('/admin');
            } catch (loginError) {
              const message =
                loginError instanceof TypeError
                  ? 'Admin API unavailable. Check the production backend deployment and try again.'
                  : loginError.message;
              setError(message);
            } finally {
              setLoading(false);
            }
          },
        });
        const target = document.getElementById('google-admin-login');
        if (!target) throw new Error('Google sign-in button could not be mounted.');
        window.google.accounts.id.renderButton(target, { theme: 'filled_black', size: 'large', width: 320 });
        setButtonReady(true);
        window.clearTimeout(timeout);
        setLoading(false);
      } catch (initError) {
        window.clearTimeout(timeout);
        setLoading(false);
        setError(initError.message || 'Google sign-in could not initialize.');
      }
    };
    script.onerror = () => {
      window.clearTimeout(timeout);
      setLoading(false);
      setError('Google sign-in could not load. Check your internet connection or allow accounts.google.com.');
    };
    if (window.google?.accounts?.id) initializeGoogle();
    else {
      script.addEventListener('load', initializeGoogle, { once: true });
      if (!existing) document.head.appendChild(script);
    }
    return () => {
      window.clearTimeout(timeout);
      script.removeEventListener('load', initializeGoogle);
    };
  }, [onSession]);

  const handleDevLogin = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await adminFetch(apiPath('/api/admin/auth/dev'), { method: 'POST' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.detail || data.message || 'Dev login failed.');
      onSession(data);
      window.location.replace('/admin');
    } catch (err) {
      setError(err.message || 'Dev login failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="admin-login">
      <section>
        <img src="/brand/noctivus-emblem.webp" alt="" />
        <span className="kicker">SECURE ADMIN ACCESS</span>
        <h1>Noctivus operations</h1>
        <a className="admin-login__home" href="/">
          Back to home
        </a>
        {googleClientId ? (
          <div id="google-admin-login" aria-busy={loading} />
        ) : (
          <p className="form-error" role="alert">
            Set VITE_GOOGLE_CLIENT_ID and GOOGLE_CLIENT_ID to enable Google login.
          </p>
        )}
        {loading && !buttonReady && <p className="admin-login__status">Connecting to Google sign-in…</p>}
        {import.meta.env.DEV && (
          <div className="dev-quick-login-card">
            <small style={{ color: '#94a3b8' }}>Local Development Mode</small>
            <button type="button" className="button dev-login-btn" onClick={handleDevLogin} disabled={loading}>
              ⚡ Quick Admin Login (Dev)
            </button>
          </div>
        )}
        {error && <p className="form-error">{error}</p>}
      </section>
    </main>
  );
}
