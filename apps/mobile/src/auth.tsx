import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { User } from '@subtube/shared';
import { api, getToken, setToken, setUnauthorizedHandler } from './api';
import { googleSignOut } from './google';

interface AuthState {
  user: User | null;
  loading: boolean;
  signIn: (idToken: string) => Promise<void>;
  signOut: () => Promise<void>;
  setUser: (user: User) => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setUnauthorizedHandler(() => setUser(null));
    (async () => {
      try {
        if (await getToken()) setUser(await api.me());
      } catch {
        await setToken(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const signIn = useCallback(async (idToken: string) => {
    const { token, user } = await api.loginWithGoogle(idToken);
    await setToken(token);
    setUser(user);
  }, []);

  const signOut = useCallback(async () => {
    await setToken(null);
    await googleSignOut();
    setUser(null);
  }, []);

  const value = useMemo(() => ({ user, loading, signIn, signOut, setUser }), [user, loading, signIn, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
