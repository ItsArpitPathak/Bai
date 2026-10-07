import { useRouter } from 'expo-router';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api } from './api';
import { useAuth } from './auth';

type Lists = {
  saved: Set<string>;
  toggleSave: (recipeId: string) => Promise<void>;
  addToList: (names: string[]) => Promise<void>;
};
const Ctx = createContext<Lists>(null!);
export const useLists = () => useContext(Ctx);

// Saving and the shopping list need an account: guests are sent to /login instead.
export function ListsProvider({ children }: { children: ReactNode }) {
  const { token } = useAuth();
  const router = useRouter();
  const [saved, setSaved] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!token) { setSaved(new Set()); return; }
    api('/saved', token).then((l: { recipe: { id: string } }[]) => setSaved(new Set(l.map(r => r.recipe.id)))).catch(() => {});
  }, [token]);

  const toggleSave = useCallback(async (id: string) => {
    if (!token) return router.push('/login');
    const ids: string[] = saved.has(id) ? await api(`/saved/${id}`, token, 'DELETE') : await api('/saved', token, 'POST', { recipeId: id });
    setSaved(new Set(ids));
  }, [token, saved]);

  const addToList = useCallback(async (names: string[]) => {
    if (!token) return router.push('/login');
    await api('/shopping', token, 'POST', { names });
  }, [token]);

  return <Ctx.Provider value={{ saved, toggleSave, addToList }}>{children}</Ctx.Provider>;
}
