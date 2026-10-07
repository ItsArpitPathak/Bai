import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, TextInput, View } from 'react-native';
import { api, msg } from '../api';
import { useAuth } from '../auth';
import { makeStyles } from '../styles';
import { useTheme } from '../theme';
import { CategoryCard, type Category } from './CategoryCard';
import { RecipeCard, type Result } from './RecipeCard';

type Item = { id: number; name: string };
type Filters = { veg: boolean; ready: boolean; missing1: boolean; quick: boolean; meal: string | null };
type Match = { count: number; results: Result[]; suggest: string[] };
const PILLS = [
  { key: 'veg', label: '🟢 Veg' }, { key: 'ready', label: '✅ Ready now' }, { key: 'missing1', label: 'Missing 1' }, { key: 'quick', label: '⏱ ≤30 min' },
] as const;
const MEALS = ['breakfast', 'lunch', 'dinner', 'snack'];

export function Kitchen() {
  const c = useTheme();
  const s = useMemo(() => makeStyles(c), [c]);
  const { token, logout } = useAuth();

  const [items, setItems] = useState<Item[]>([]);
  const [text, setText] = useState('');
  const [match, setMatch] = useState<Match>({ count: 0, results: [], suggest: [] });
  const [matching, setMatching] = useState(false);
  const [filters, setFilters] = useState<Filters>({ veg: false, ready: false, missing1: false, quick: false, meal: null });
  const [err, setErr] = useState('');
  const [cats, setCats] = useState<Category[]>([]);


  const refresh = async (t: string, list?: Item[]) => setItems(list ?? await api('/pantry', t));

  // debounced: every toggle or filter change re-queries the matcher
  useEffect(() => {
    if (!token) return;
    if (!items.length) { setMatch({ count: 0, results: [], suggest: [] }); return; }
    const q = new URLSearchParams();
    if (filters.veg) q.set('diet', 'veg');
    if (filters.ready || filters.missing1) q.set('maxMissing', filters.ready ? '0' : '1');
    if (filters.quick) q.set('maxTime', '30');
    if (filters.meal) q.set('mealType', filters.meal);
    let live = true;
    const h = setTimeout(async () => {
      setMatching(true);
      try { const m = await api('/match?' + q, token); if (live) setMatch(m); }
      catch (e: any) { if (live) setErr(msg(e)); }
      finally { if (live) setMatching(false); }
    }, 250);
    return () => { live = false; clearTimeout(h); };
  }, [token, items, filters]);

  useEffect(() => { if (token) refresh(token).catch(e => { setErr(msg(e)); if (!(e instanceof TypeError)) logout(); }); }, [token]);

  useEffect(() => { api('/ingredients', null).then(setCats).catch(() => {}); }, []);

  const guard = async (fn: () => Promise<void>) => { try { setErr(''); await fn(); } catch (e: any) { setErr(msg(e)); } };
  const addName = (name: string) => guard(async () => {
    if (!name.trim() || !token) return;
    const l = await api('/pantry', token, 'POST', { name });
    setText('');
    await refresh(token, l);
  });
  const del = (id: number) => guard(async () => { if (token) await refresh(token, await api(`/pantry/${id}`, token, 'DELETE')); });

  const have = new Set(items.map(i => i.name));
  const toggle = (n: string) => { const i = items.find(x => x.name === n); return i ? del(i.id) : addName(n); };
  const flip = (k: 'veg' | 'ready' | 'missing1' | 'quick') => setFilters(f => ({
    ...f, [k]: !f[k],
    ...(k === 'ready' && !f.ready ? { missing1: false } : {}),
    ...(k === 'missing1' && !f.missing1 ? { ready: false } : {}),
  }));

  const header = (
    <View>
      <View style={s.topBar}>
        <Text style={s.logo}>🍲 Bai</Text>
        <Pressable onPress={logout} accessibilityRole="button"><Text style={s.link}>Log out</Text></Pressable>
      </View>

      <View style={s.card}>
        <Text style={s.h2}>Your pantry</Text>
        <View style={s.row}>
          <TextInput value={text} onChangeText={setText} onSubmitEditing={() => addName(text)} placeholder="Add an item, e.g. aloo, pyaaz, atta" placeholderTextColor={c.muted} accessibilityLabel="Add pantry item" style={[s.input, { flex: 1, minWidth: 0, marginBottom: 0 }]} />
          <Pressable style={[s.addBtn, !text.trim() && s.disabled]} disabled={!text.trim()} onPress={() => addName(text)} accessibilityRole="button" accessibilityLabel="Add to pantry">
            <Text style={s.primaryTxt}>Add</Text>
          </Pressable>
        </View>
        {err ? <Text style={[s.error, { marginTop: 8 }]}>{err}</Text> : null}

        {items.length > 0 && (
          <View style={s.chips}>
            {items.map(i => (
              <Pressable key={i.id} onPress={() => del(i.id)} style={s.chip} accessibilityLabel={`Remove ${i.name}`}>
                <Text style={s.chipTxt}>{i.name}  ✕</Text>
              </Pressable>
            ))}
          </View>
        )}

        {cats.map(cat => <CategoryCard key={cat.category} cat={cat} have={have} onToggle={toggle} />)}
      </View>

      {items.length > 0 && (
        <View>
          <Text style={s.headline} accessibilityLiveRegion="polite" aria-live="polite">You can make {match.count} recipe{match.count === 1 ? '' : 's'}</Text>
          {match.suggest.length > 0 && (
            <View style={s.chips}>
              <Text style={s.muted}>Do you have?</Text>
              {match.suggest.map(n => (
                <Pressable key={n} onPress={() => addName(n)} style={s.quick} accessibilityRole="button" accessibilityLabel={`Add ${n}`}><Text style={s.quickTxt}>+ {n}</Text></Pressable>
              ))}
            </View>
          )}
          <View style={s.filters}>
            {PILLS.map(({ key, label }) => {
              const on = filters[key];
              return (
                <Pressable key={key} onPress={() => flip(key)} style={[s.filter, on && s.filterOn]} accessibilityRole="button" accessibilityState={{ selected: on }}>
                  <Text style={[s.filterTxt, on && s.filterTxtOn]}>{label}</Text>
                </Pressable>
              );
            })}
            {MEALS.map(m => {
              const on = filters.meal === m;
              return (
                <Pressable key={m} onPress={() => setFilters(f => ({ ...f, meal: on ? null : m }))} style={[s.filter, on && s.filterOn]} accessibilityRole="button" accessibilityState={{ selected: on }}>
                  <Text style={[s.filterTxt, on && s.filterTxtOn]}>{m[0].toUpperCase() + m.slice(1)}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}
      {matching && <ActivityIndicator color={c.primary} style={{ marginVertical: 12 }} />}
    </View>
  );

  return (
      <FlatList
        style={s.list}
        contentContainerStyle={s.listContent}
        data={items.length ? match.results : []}
        keyExtractor={r => r.recipe.id}
        ListHeaderComponent={header}
        ListEmptyComponent={matching ? null : (
          <View style={s.empty}>
            <Text style={s.emptyEmoji}>{items.length ? '🔍' : '🧺'}</Text>
            <Text style={s.emptyTxt}>{items.length ? 'No recipes match these filters yet. Try adding more items.' : 'Add ingredients to get started. Every ingredient unlocks more recipes.\nWe assume salt, oil, ghee, water, sugar.'}</Text>
          </View>
        )}
        renderItem={({ item: r }) => <RecipeCard r={r} />}
      />
  );
}
