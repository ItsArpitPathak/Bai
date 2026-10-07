import { Platform } from 'react-native';

// ponytail: dev-only URL; Android emulator reaches host via 10.0.2.2. Set EXPO_PUBLIC_API_URL for deploy.
export const API = (process.env.EXPO_PUBLIC_API_URL ?? (Platform.OS === 'android' ? 'http://10.0.2.2:8080' : 'http://localhost:8080')).trim().replace(/\/+$/, '');

// set by AuthProvider: an expired session (401 on an authed call) logs out everywhere
let onUnauthorized: () => void = () => {};
export const setOnUnauthorized = (f: () => void) => { onUnauthorized = f; };

export async function api(path: string, token: string | null, method = 'GET', body?: unknown) {
  const res = await fetch(API + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (res.status === 401 && token) onUnauthorized();
  if (!res.ok) throw new Error(res.status === 401 ? 'Wrong email/password or session expired' : res.status === 409 ? 'That email is already registered' : res.status === 400 ? 'Enter a valid email and a password of 6+ characters' : `Error ${res.status}`);
  return res.json();
}

// fetch() network failures are TypeErrors on web and React Native; free hosting sleeps when idle
export const msg = (e: any) => e instanceof TypeError ? 'Server is waking up (free hosting). Wait a minute and try again.' : e.message;
