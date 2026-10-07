import AsyncStorage from '@react-native-async-storage/async-storage';
import { setOnUnauthorized } from './api';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

type Auth = { token: string | null; ready: boolean; login: (t: string) => Promise<void>; logout: () => void };
const Ctx = createContext<Auth>(null!);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem('token').then(t => { setToken(t); setReady(true); }).catch(() => setReady(true));
  }, []);

  const login = async (t: string) => { await AsyncStorage.setItem('token', t).catch(() => {}); setToken(t); };
  const logout = () => { AsyncStorage.removeItem('token').catch(() => {}); setToken(null); };

  useEffect(() => { setOnUnauthorized(logout); });

  return <Ctx.Provider value={{ token, ready, login, logout }}>{children}</Ctx.Provider>;
}
