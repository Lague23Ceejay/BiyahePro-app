import { createContext, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import { api } from '@/src/lib/api';
import { clearSession, loadSession, saveSession } from '@/src/lib/session';
import { stopDriverRideHub } from '@/src/lib/rideHub';
import type { DriverSession, RegisterPayload } from '@/src/types/api';

type AuthValue = { session: DriverSession | null; isLoading: boolean; signIn: (email: string, password: string, rememberDevice: boolean) => Promise<void>; register: (payload: RegisterPayload, rememberDevice: boolean) => Promise<void>; signOut: () => Promise<void> };
const AuthContext = createContext<AuthValue | null>(null);
export function AuthProvider({ children }: PropsWithChildren) { const [session, setSession] = useState<DriverSession | null>(null); const [isLoading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    let refreshTimer: ReturnType<typeof setInterval> | null = null;
    async function refresh(value: DriverSession) {
      if (!value.refreshToken || value.role !== 'driver') return value;
      try {
        const next = await api.refresh(value.refreshToken);
        const refreshed = { ...next, rememberDevice: value.rememberDevice };
        if (value.rememberDevice) await saveSession(refreshed);
        return refreshed;
      } catch {
        return null;
      }
    }
    loadSession().then(async value => {
      let current = value?.role === 'driver' ? await refresh(value) : null;
      if (!active) return;
      setSession(current);
      setLoading(false);
      if (current?.refreshToken) {
        refreshTimer = setInterval(async () => {
          if (!current) return;
          const refreshed = await refresh(current);
          if (refreshed && active) { current = refreshed; setSession(refreshed); }
        }, 10 * 60 * 1000);
      }
    });
    return () => { active = false; if (refreshTimer) clearInterval(refreshTimer); };
  }, []);
  const value = useMemo<AuthValue>(() => ({ session, isLoading, async signIn(email, password, rememberDevice) { const next = await api.login(email.trim(), password); if (next.role !== 'driver') throw new Error('Please use a driver account in this app.'); const saved = { ...next, rememberDevice }; if (rememberDevice) await saveSession(saved); else await clearSession(); setSession(saved); }, async register(payload, rememberDevice) { const next = await api.register(payload); if (next.role !== 'driver') throw new Error('Driver registration failed.'); const saved = { ...next, rememberDevice }; if (rememberDevice) await saveSession(saved); else await clearSession(); setSession(saved); }, async signOut() { stopDriverRideHub(); await clearSession(); setSession(null); } }), [session, isLoading]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export function useAuth() { const value = useContext(AuthContext); if (!value) throw new Error('useAuth must be used within AuthProvider.'); return value; }
