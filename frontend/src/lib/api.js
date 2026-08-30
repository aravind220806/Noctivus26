export function getApiBase() {
  const configured = (import.meta.env.VITE_API_URL || '').trim().replace(/\/$/, '');
  if (configured) return configured;

  if (import.meta.env.DEV) {
    const browserHost = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
    const host = browserHost && browserHost !== 'localhost' && browserHost !== '127.0.0.1' ? browserHost : 'localhost';
    return `http://${host}:4000`;
  }

  return '';
}

export function apiUrl(path) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const base = getApiBase();

  if (!base && !import.meta.env.DEV) {
    throw new Error('VITE_API_URL is not configured. Set it to the deployed backend URL, for example https://api.noctivus.site');
  }

  return `${base}${normalizedPath}`;
}
