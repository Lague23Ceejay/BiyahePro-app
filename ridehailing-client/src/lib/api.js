// ============================================================
// lib/api.js
// Shared API helpers for the BiyahePro admin client.
//
// Centralizes the API base URL and the bearer-token attached to every
// authenticated request, so components don't each re-implement auth
// headers (and can't forget to include them, the way the old
// PIN-gated dashboard did against a real JWT-protected API).
// ============================================================

const configuredApiUrl = import.meta.env.VITE_API_URL;
export const API_BASE = (configuredApiUrl || (import.meta.env.DEV ? 'http://localhost:5000' : '')).replace(/\/$/, '');

const TOKEN_KEY = 'biyahepro_admin_token';
const USER_KEY  = 'biyahepro_admin_user';

// ── Session persistence ─────────────────────────────────────
// Stored in localStorage so an admin isn't logged out on every page
// refresh. This is a standalone SPA project (not a Claude artifact
// sandbox), so browser storage is safe to use here.
export function saveSession({ accessToken, refreshToken, role, userId, fullName }) {
  localStorage.setItem(TOKEN_KEY, JSON.stringify({ accessToken, refreshToken }));
  localStorage.setItem(USER_KEY, JSON.stringify({ role, userId, fullName }));
}

export function getStoredTokens() {
  try {
    const raw = localStorage.getItem(TOKEN_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function getStoredUser() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

// ── Authenticated fetch ─────────────────────────────────────
// Wraps fetch() and attaches "Authorization: Bearer <token>" whenever
// a token is stored. Throws a tagged error on 401/403 so callers can
// react (e.g. force a re-login) instead of silently rendering nothing.
export async function apiFetch(path, options = {}) {
  if (!API_BASE) throw new Error('VITE_API_URL is not configured for this deployment.');
  const tokens = getStoredTokens();
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };
  if (tokens?.accessToken) {
    headers.Authorization = `Bearer ${tokens.accessToken}`;
  }

  const response = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (response.status === 401 || response.status === 403) {
    const err = new Error('Not authorized — please log in again.');
    err.isAuthError = true;
    err.status = response.status;
    throw err;
  }

  return response;
}

// ── Login ─────────────────────────────────────────────────────
export async function login(email, password) {
  if (!API_BASE) throw new Error('VITE_API_URL is not configured for this deployment.');
  const response = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    let message = 'Invalid email or password.';
    try {
      const body = await response.json();
      if (body?.message) message = body.message;
    } catch {
      // response had no JSON body (e.g. an unhandled 500) — keep the default message
    }
    throw new Error(message);
  }

  return response.json(); // { accessToken, refreshToken, role, userId, fullName }
}