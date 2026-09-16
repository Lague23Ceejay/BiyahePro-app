import { createContext, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import { api } from '@/src/lib/api';
import { clearSession, loadSession, saveSession } from '@/src/lib/session';
import type { DriverSession, RegisterPayload } from '@/src/types/api';

type AuthValue = { session: DriverSession | null; isLoading: boolean; signIn: (email: string, password: string) => Promise<void>; register: (payload: RegisterPayload) => Promise<void>; signOut: () => Promise<void> };
const AuthContext = createContext<AuthValue | null>(null);
export function AuthProvider({ children }: PropsWithChildren) { const [session, setSession] = useState<DriverSession | null>(null); const [isLoading, setLoading] = useState(true);
  useEffect(() => { loadSession().then(value => { setSession(value?.role === 'driver' ? value : null); setLoading(false); }); }, []);
  const value = useMemo<AuthValue>(() => ({ session, isLoading, async signIn(email, password) { const next = await api.login(email.trim(), password); if (next.role !== 'driver') throw new Error('Please use a driver account in this app.'); await saveSession(next); setSession(next); }, async register(payload) { const next = await api.register(payload); if (next.role !== 'driver') throw new Error('Driver registration failed.'); await saveSession(next); setSession(next); }, async signOut() { await clearSession(); setSession(null); } }), [session, isLoading]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export function useAuth() { const value = useContext(AuthContext); if (!value) throw new Error('useAuth must be used within AuthProvider.'); return value; }
