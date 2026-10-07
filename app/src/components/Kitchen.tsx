import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { api, msg } from '../api';
import { useAuth } from '../auth';
import { loadGuest, saveGuest } from '../store';
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
  const router = useRouter();

  const [items, setItems] = useState<Item[]>([]);
  const [text, setText] = useState('');
  const [match, setMatch] = useState<Match>({ count: 0, results: [], suggest: [] });
  const [matching, setMatching] = useState(false);
  const [filters, setFilters] = useState<Filters>({ veg: false, ready: false, missing1: false, quick: false, meal: null });
  const [err, setErr] = useState('');
  const [cats, setCats] = useState<Category[]>([]);

  const setGuest = (names: string[]) => { setItems(names.map(name => ({ id: -1, name }))); saveGuest(names); };

  // debounced: every toggle or filter change re-queries the matcher
  useEffect(() => {
    if (!items.length) { setMatch({ count: 0, results: [], suggest: [] }); return; }
    const q = new URLSearchParams();
    if (filters.veg) q.set('diet', 'veg');
    if (filters.ready || filters.missing1) q.set('maxMissing', filters.ready ? '0' : '1');
    if (filters.quick) q.set('maxTime', '30');
    if (filters.meal) q.set('mealType', filters.meal);
    if (!token) q.set('items', items.map(i => i.name).join(','));
    let live = true;
    const h = setTimeout(async () => {
      setMatching(true);
      try { const m = await api('/match?' + q, token); if (live) setMatch(m); }
      catch (e: any) { if (live) setErr(msg(e)); }
      finally { if (live) setMatching(false); }
    }, 250);
    return () => { live = false; clearTimeout(h); };
  }, [token, items, filters]);

  useEffect(() => {
    if (!token) { loadGuest().then(names => setItems(names.map(name => ({ id: -1, name })))); return; }
    api('/pantry', token).then(setItems).catch(e => { setErr(msg(e)); if (!(e instanceof TypeError)) logout(); });
  }, [token]);

  useEffect(() => { api('/ingredients', null).then(setCats).catch(() => {}); }, []);

  const guard = async (fn: () => Promise<void>) => { try { setErr(''); await fn(); } catch (e: any) { setErr(msg(e)); } };
  // text may be a pasted list: comma or newline separated, Hindi or English
  const addNames = (raw: string) => guard(async () => {
    const names = raw.split(/[,\n]/).map(x => x.trim()).filter(Boolean);
    if (!names.length) return;
    if (token) setItems(await api('/pantry/bulk', token, 'POST', { names }));
    else {
      const canon: string[] = await api('/canonical?names=' + encodeURIComponent(names.join(',')), null);
      setGuest([...new Set([...items.map(i => i.name), ...canon])].sort());
    }
    setText('');
  });
  const del = (i: Item) => guard(async () => {
    if (token) setItems(await api(`/pantry/${i.id}`, token, 'DELETE'));
    else setGuest(items.filter(x => x.name !== i.name).map(x => x.name));
  });

  const have = new Set(items.map(i => i.name));
  const toggle = (n: string) => { const i = items.find(x => x.name === n); return i ? del(i) : addNames(n); };
  const flip = (k: 'veg' | 'ready' | 'missing1' | 'quick') => setFilters(f => ({
    ...f, [k]: !f[k],
    ...(k === 'ready' && !f.ready ? { missing1: false } : {}),
    ...(k === 'missing1' && !f.missing1 ? { ready: false } : {}),
  }));

  const { width } = useWindowDimensions();
  const wide = width >= 1024, mid = width >= 768 && !wide;
  const cols = width >= 1440 ? 3 : wide ? 2 : 1;
  const [tab, setTab] = useState<'pantry' | 'recipes'>('pantry');
  const [drawer, setDrawer] = useState(false);

  const topBar = (
    <View style={[s.topBar, s.gutter]}>
      <Text style={s.logo}>🍲 Bai</Text>
      <View style={s.row}>
        {mid && <Pressable onPress={() => setDrawer(!drawer)} accessibilityRole="button"><Text style={s.link}>🧺 Pantry ({items.length})</Text></Pressable>}
        <Pressable onPress={token ? logout : () => router.push('/login')} accessibilityRole="button"><Text style={s.link}>{token ? 'Log out' : 'Log in'}</Text></Pressable>
      </View>
    </View>
  );

  const pantry = (
    <ScrollView style={wide ? s.side : s.list} contentContainerStyle={s.paneContent}>
      <View style={[s.card, wide && s.cardFlat]}>
        <Text style={s.h2}>Your pantry</Text>
        <View style={s.row}>
          <TextInput value={text} onChangeText={setText} onSubmitEditing={() => addNames(text)} placeholder="Add or paste a list, e.g. aloo, pyaaz, atta" placeholderTextColor={c.muted} accessibilityLabel="Add pantry item" style={[s.input, { flex: 1, minWidth: 0, marginBottom: 0 }]} />
          <Pressable style={[s.addBtn, !text.trim() && s.disabled]} disabled={!text.trim()} onPress={() => addNames(text)} accessibilityRole="button" accessibilityLabel="Add to pantry">
            <Text style={s.primaryTxt}>Add</Text>
          </Pressable>
        </View>
        {err ? <Text style={[s.error, { marginTop: 8 }]}>{err}</Text> : null}

        {items.length > 0 && (
          <View style={s.chips}>
            {items.map(i => (
              <Pressable key={i.name} onPress={() => del(i)} style={s.chip} accessibilityLabel={`Remove ${i.name}`}>
                <Text style={s.chipTxt}>{i.name}  ✕</Text>
              </Pressable>
            ))}
          </View>
        )}

        {cats.map(cat => <CategoryCard key={cat.category} cat={cat} have={have} onToggle={toggle} />)}
      </View>
    </ScrollView>
  );

  const header = (
    <View>
      {items.length > 0 && (
        <View>
          <Text style={s.headline} accessibilityLiveRegion="polite" aria-live="polite">You can make {match.count} recipe{match.count === 1 ? '' : 's'}</Text>
          {match.suggest.length > 0 && (
            <View style={s.chips}>
              <Text style={s.muted}>Do you have?</Text>
              {match.suggest.map(n => (
                <Pressable key={n} onPress={() => addNames(n)} style={s.quick} accessibilityRole="button" accessibilityLabel={`Add ${n}`}><Text style={s.quickTxt}>+ {n}</Text></Pressable>
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

  const recipes = (
    <FlatList
      key={cols}
      style={s.list}
      contentContainerStyle={s.listContent}
      numColumns={cols}
      columnWrapperStyle={cols > 1 ? { gap: 12 } : undefined}
      data={items.length ? match.results : []}
      keyExtractor={r => r.recipe.id}
      ListHeaderComponent={header}
      ListEmptyComponent={matching ? null : (
        <View style={s.empty}>
          <Text style={s.emptyEmoji}>{items.length ? '🔍' : '🧺'}</Text>
          <Text style={s.emptyTxt}>{items.length ? 'No recipes match these filters yet. Try adding more items.' : 'Add ingredients to get started. Every ingredient unlocks more recipes.\nWe assume salt, oil, ghee, water, sugar.'}</Text>
        </View>
      )}
      renderItem={({ item: r }) => <View style={{ flex: 1 }}><RecipeCard r={r} /></View>}
    />
  );

  if (wide) return <View style={s.screen}>{topBar}<View style={s.split}>{pantry}{recipes}</View></View>;
  if (mid) return (
    <View style={s.screen}>
      {topBar}
      {recipes}
      {drawer && <Pressable style={s.backdrop} onPress={() => setDrawer(false)} accessibilityLabel="Close pantry" />}
      {drawer && <View style={s.drawer}>{pantry}</View>}
    </View>
  );
  return (
    <View style={s.screen}>
      {topBar}
      {tab === 'pantry' ? pantry : recipes}
      <View style={s.tabs}>
        {([['pantry', `🧺 Pantry (${items.length})`], ['recipes', `🍲 Recipes (${match.count})`]] as const).map(([k, label]) => (
          <Pressable key={k} onPress={() => setTab(k)} style={[s.tab, tab === k && s.tabOn]} accessibilityRole="button" accessibilityState={{ selected: tab === k }}>
            <Text style={[s.tabTxt, tab === k && s.tabTxtOn]}>{label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
