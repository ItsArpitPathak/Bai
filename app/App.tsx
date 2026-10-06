import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Platform, Pressable, StyleSheet, Text, TextInput, View, useColorScheme } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

type Item = { id: number; name: string };
type Result = { recipe: { name: string; veg: boolean; steps: string[] }; matchPct: number; missing: string[] };
type Filter = 'all' | 'veg' | 'ready';

// ponytail: dev-only URL; Android emulator reaches host via 10.0.2.2. Set EXPO_PUBLIC_API_URL for deploy.
const API = (process.env.EXPO_PUBLIC_API_URL ?? (Platform.OS === 'android' ? 'http://10.0.2.2:8080' : 'http://localhost:8080')).trim().replace(/\/+$/, '');

const QUICK = ['potato', 'onion', 'tomato', 'rice', 'wheat flour', 'toor dal', 'moong dal', 'paneer', 'egg', 'milk', 'curd', 'spinach', 'peas', 'cauliflower'];

const light = { bg: '#FBF7F1', surface: '#FFFFFF', text: '#1F2933', muted: '#6B7280', border: '#E9E1D6', primary: '#D9480F', onPrimary: '#FFFFFF', soft: '#FFF0E6', good: '#2F9E44', warn: '#E8890C', err: '#C92A2A' };
const dark = { bg: '#141210', surface: '#1F1C19', text: '#F4EFE8', muted: '#A39B90', border: '#322E29', primary: '#FF7A3D', onPrimary: '#1A0F08', soft: '#2B211A', good: '#51CF66', warn: '#FFA94D', err: '#FF8787' };

async function api(path: string, token: string | null, method = 'GET', body?: unknown) {
  const res = await fetch(API + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw new Error(res.status === 401 ? 'Wrong email/password or session expired' : res.status === 409 ? 'That email is already registered' : res.status === 400 ? 'Enter a valid email and a password of 6+ characters' : `Error ${res.status}`);
  return res.json();
}

// fetch() network failures are TypeErrors on web and React Native; free hosting sleeps when idle
const msg = (e: any) => e instanceof TypeError ? 'Server is waking up (free hosting). Wait a minute and try again.' : e.message;

export default function App() {
  return <SafeAreaProvider><Main /></SafeAreaProvider>;
}

function Main() {
  const c = useColorScheme() === 'dark' ? dark : light;
  const s = useMemo(() => makeStyles(c), [c]);

  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [text, setText] = useState('');
  const [results, setResults] = useState<Result[]>([]);
  const [matching, setMatching] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const [open, setOpen] = useState<string | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    AsyncStorage.getItem('token').then(t => { setToken(t); setReady(true); }).catch(() => setReady(true));
  }, []);

  const refresh = async (t: string, list?: Item[]) => {
    const l: Item[] = list ?? await api('/pantry', t);
    setItems(l);
    setMatching(true);
    try { setResults(l.length ? await api('/match', t) : []); } finally { setMatching(false); }
  };

  useEffect(() => { if (token) refresh(token).catch(e => { setErr(msg(e)); if (!(e instanceof TypeError)) logout(); }); }, [token]);

  const logout = () => { AsyncStorage.removeItem('token').catch(() => {}); setToken(null); setItems([]); setResults([]); setOpen(null); };

  const auth = async () => {
    try {
      setErr(''); setBusy(true);
      const { token: t } = await api(`/auth/${mode}`, null, 'POST', { email, password });
      await AsyncStorage.setItem('token', t).catch(() => {});
      setPassword('');
      setToken(t);
    } catch (e: any) { setErr(msg(e)); } finally { setBusy(false); }
  };

  const guard = async (fn: () => Promise<void>) => { try { setErr(''); await fn(); } catch (e: any) { setErr(msg(e)); } };
  const addName = (name: string) => guard(async () => {
    if (!name.trim() || !token) return;
    const l = await api('/pantry', token, 'POST', { name });
    setText('');
    await refresh(token, l);
  });
  const del = (id: number) => guard(async () => { if (token) await refresh(token, await api(`/pantry/${id}`, token, 'DELETE')); });

  if (!ready) return <View style={s.screen} />;

  if (!token) return (
    <SafeAreaView style={s.screen}>
      <View style={s.authWrap}>
        <Text style={s.logo}>🍲 Bai</Text>
        <Text style={s.tagline}>Tell Bai what's in your kitchen.{'\n'}Get recipes you can cook today.</Text>
        <View style={s.card}>
          <Text style={s.h2}>{mode === 'login' ? 'Welcome back' : 'Create your account'}</Text>
          <TextInput value={email} onChangeText={setEmail} placeholder="Email" placeholderTextColor={c.muted} autoCapitalize="none" keyboardType="email-address" accessibilityLabel="Email" style={s.input} />
          <TextInput value={password} onChangeText={setPassword} onSubmitEditing={auth} placeholder="Password (6+ characters)" placeholderTextColor={c.muted} secureTextEntry accessibilityLabel="Password" style={s.input} />
          {err ? <Text style={s.error}>{err}</Text> : null}
          <Pressable style={[s.primaryBtn, busy && s.disabled]} disabled={busy} onPress={auth} accessibilityRole="button">
            {busy ? <ActivityIndicator color={c.onPrimary} /> : <Text style={s.primaryTxt}>{mode === 'login' ? 'Log in' : 'Create account'}</Text>}
          </Pressable>
          <Pressable onPress={() => { setMode(mode === 'login' ? 'register' : 'login'); setErr(''); }} accessibilityRole="button">
            <Text style={s.link}>{mode === 'login' ? 'New here? Create an account' : 'Have an account? Log in'}</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );

  const have = new Set(items.map(i => i.name));
  const shown = results.filter(r => filter === 'all' || (filter === 'veg' ? r.recipe.veg : r.matchPct === 100));
  const readyCount = results.filter(r => r.matchPct === 100).length;
  const barColor = (p: number) => (p === 100 ? c.good : p >= 50 ? c.warn : c.muted);

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

        <Text style={[s.muted, { marginTop: 12 }]}>Quick add</Text>
        <View style={s.chips}>
          {QUICK.filter(q => !have.has(q)).map(q => (
            <Pressable key={q} onPress={() => addName(q)} style={s.quick}><Text style={s.quickTxt}>+ {q}</Text></Pressable>
          ))}
        </View>
      </View>

      <View style={s.resultsHead}>
        <Text style={s.h2}>What to cook</Text>
        {items.length > 0 && <Text style={s.muted}>{readyCount} ready now · {results.length} total</Text>}
      </View>
      {items.length > 0 && (
        <View style={s.filters}>
          {(['all', 'veg', 'ready'] as Filter[]).map(f => (
            <Pressable key={f} onPress={() => setFilter(f)} style={[s.filter, filter === f && s.filterOn]} accessibilityRole="button">
              <Text style={[s.filterTxt, filter === f && s.filterTxtOn]}>{f === 'all' ? 'All' : f === 'veg' ? '🟢 Veg' : '✅ Ready now'}</Text>
            </Pressable>
          ))}
        </View>
      )}
      {matching && <ActivityIndicator color={c.primary} style={{ marginVertical: 12 }} />}
    </View>
  );

  return (
    <SafeAreaView style={s.screen}>
      <FlatList
        style={s.list}
        contentContainerStyle={s.listContent}
        data={shown}
        keyExtractor={r => r.recipe.name}
        ListHeaderComponent={header}
        ListEmptyComponent={matching ? null : (
          <View style={s.empty}>
            <Text style={s.emptyEmoji}>{items.length ? '🔍' : '🧺'}</Text>
            <Text style={s.emptyTxt}>{items.length ? 'No recipes match this filter yet. Try adding more items.' : 'Your pantry is empty. Add a few items above and Bai will suggest what to cook.'}</Text>
          </View>
        )}
        renderItem={({ item: r }) => {
          const isOpen = open === r.recipe.name;
          return (
            <Pressable onPress={() => setOpen(isOpen ? null : r.recipe.name)} style={s.recipe} accessibilityRole="button">
              <View style={s.recipeTop}>
                <Text style={s.recipeName}>{r.recipe.veg ? '🟢' : '🔴'}  {r.recipe.name}</Text>
                <Text style={[s.pct, { color: barColor(r.matchPct) }]}>{r.matchPct}%</Text>
              </View>
              <View style={s.bar}><View style={[s.barFill, { width: `${r.matchPct}%`, backgroundColor: barColor(r.matchPct) }]} /></View>
              <Text style={s.muted}>{r.missing.length ? `Need: ${r.missing.join(', ')}` : 'You have everything ✨'}</Text>
              {isOpen ? (
                <View style={s.steps}>
                  {r.recipe.steps.map((st, i) => <Text key={i} style={s.step}>{i + 1}. {st}</Text>)}
                </View>
              ) : <Text style={s.hint}>Tap for steps</Text>}
            </Pressable>
          );
        }}
      />
    </SafeAreaView>
  );
}

const makeStyles = (c: typeof light) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.bg },
  authWrap: { flex: 1, width: '100%', maxWidth: 440, alignSelf: 'center', justifyContent: 'center', padding: 20 },
  list: { flex: 1 },
  listContent: { width: '100%', maxWidth: 720, alignSelf: 'center', padding: 16, paddingBottom: 48 },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  logo: { fontSize: 28, fontWeight: '800', color: c.primary },
  tagline: { fontSize: 16, color: c.muted, marginTop: 6, marginBottom: 20, lineHeight: 22 },
  card: { backgroundColor: c.surface, borderRadius: 16, borderWidth: 1, borderColor: c.border, padding: 16, marginBottom: 16 },
  h2: { fontSize: 18, fontWeight: '700', color: c.text, marginBottom: 10 },
  row: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  input: { backgroundColor: c.bg, borderWidth: 1, borderColor: c.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, color: c.text, marginBottom: 10 },
  primaryBtn: { backgroundColor: c.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  addBtn: { backgroundColor: c.primary, borderRadius: 12, paddingHorizontal: 20, paddingVertical: 13 },
  primaryTxt: { color: c.onPrimary, fontSize: 16, fontWeight: '700' },
  disabled: { opacity: 0.5 },
  link: { color: c.primary, fontWeight: '600', textAlign: 'center', paddingVertical: 10 },
  error: { color: c.err, marginBottom: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 10 },
  chip: { backgroundColor: c.soft, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  chipTxt: { color: c.primary, fontWeight: '600' },
  quick: { borderWidth: 1, borderColor: c.border, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  quickTxt: { color: c.muted },
  muted: { color: c.muted, fontSize: 14 },
  resultsHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  filters: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  filter: { borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  filterOn: { backgroundColor: c.primary, borderColor: c.primary },
  filterTxt: { color: c.text, fontWeight: '600' },
  filterTxtOn: { color: c.onPrimary },
  recipe: { backgroundColor: c.surface, borderRadius: 16, borderWidth: 1, borderColor: c.border, padding: 14, marginBottom: 10 },
  recipeTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  recipeName: { fontSize: 17, fontWeight: '700', color: c.text, flex: 1 },
  pct: { fontSize: 17, fontWeight: '800', marginLeft: 8 },
  bar: { height: 6, backgroundColor: c.border, borderRadius: 3, marginVertical: 10, overflow: 'hidden' },
  barFill: { height: 6, borderRadius: 3 },
  hint: { color: c.muted, fontSize: 12, marginTop: 6 },
  steps: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: c.border, gap: 6 },
  step: { color: c.text, fontSize: 15, lineHeight: 21 },
  empty: { alignItems: 'center', padding: 32 },
  emptyEmoji: { fontSize: 44 },
  emptyTxt: { color: c.muted, textAlign: 'center', marginTop: 8, fontSize: 15, lineHeight: 22 },
});
