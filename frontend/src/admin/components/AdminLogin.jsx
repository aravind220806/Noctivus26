import { useEffect, useState } from 'react';
import { adminFetch, apiPath, googleClientId } from '../adminUtils';

export function AdminLogin({ onSession, existingSession, onContinue, onSwitchAccount }) {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [buttonReady, setButtonReady] = useState(false);

  useEffect(() => {
    // Strictly disable Google Auto-Select on mount
    try {
      window.google?.accounts?.id?.disableAutoSelect?.();
    } catch {
      // ignore
    }

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
          auto_select: false,
          cancel_on_tap_outside: true,
          itp_support: true,
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
        target.innerHTML = '';
        window.google.accounts.id.renderButton(target, {
          type: 'standard',
          theme: 'filled_black',
          size: 'large',
          width: 320,
          text: 'signin_with',
          shape: 'rectangular',
          logo_alignment: 'left',
        });
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

  return (
    <main className="admin-login">
      <section>
        <img src="/brand/noctivus-emblem.webp" alt="" />
        <span className="kicker">SECURE ADMIN ACCESS</span>
        <h1>Noctivus operations</h1>
        <a className="admin-login__home" href="/">
          Back to home
        </a>

        {existingSession ? (
          <div style={{ margin: '1.5rem 0', padding: '1rem', background: 'rgba(0, 200, 224, 0.08)', border: '1px solid rgba(0, 200, 224, 0.25)', borderRadius: '8px', textAlign: 'center' }}>
            <p style={{ margin: 0, fontSize: '0.85rem', color: '#94a3b8' }}>Currently logged in as:</p>
            <p style={{ margin: '0.3rem 0 1rem 0', fontWeight: 'bold', color: '#fff' }}>{existingSession.email}</p>
            <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn--primary"
                onClick={onContinue}
                style={{ padding: '0.6rem 1.2rem', fontSize: '0.85rem' }}
              >
                Go to Admin Portal →
              </button>
              <button
                type="button"
                className="btn btn--ghost"
                onClick={onSwitchAccount}
                style={{ padding: '0.6rem 1.2rem', fontSize: '0.85rem' }}
              >
                Switch Account / Sign Out
              </button>
            </div>
          </div>
        ) : null}

        {googleClientId ? (
          <div id="google-admin-login" aria-busy={loading} style={{ marginTop: existingSession ? '1rem' : 0 }} />
        ) : (
          <p className="form-error" role="alert">
            Set VITE_GOOGLE_CLIENT_ID and GOOGLE_CLIENT_ID to enable Google login.
          </p>
        )}
        {loading && !buttonReady && <p className="admin-login__status">Connecting to Google sign-in…</p>}
        {error && <p className="form-error">{error}</p>}
      </section>
    </main>
  );
}
