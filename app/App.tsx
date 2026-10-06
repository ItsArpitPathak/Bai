import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { FlatList, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

type Item = { id: number; name: string };
type Result = { recipe: { name: string; veg: boolean; steps: string[] }; matchPct: number; missing: string[] };

// ponytail: dev-only URL; Android emulator reaches host via 10.0.2.2. Set EXPO_PUBLIC_API_URL for deploy.
const API = process.env.EXPO_PUBLIC_API_URL ?? (Platform.OS === 'android' ? 'http://10.0.2.2:8080' : 'http://localhost:8080');

async function api(path: string, token: string | null, method = 'GET', body?: unknown) {
  const res = await fetch(API + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw new Error(res.status === 401 ? 'Wrong email/password or session expired' : res.status === 409 ? 'Email already registered' : res.status === 400 ? 'Check email and 6+ char password' : `Error ${res.status}`);
  return res.json();
}

const btn = { padding: 10, backgroundColor: '#2e7d32', marginVertical: 4 } as const;
const input = { borderWidth: 1, padding: 8, marginVertical: 4 } as const;

export default function App() {
  return <SafeAreaProvider><Main /></SafeAreaProvider>;
}

function Main() {
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [items, setItems] = useState<Item[]>([]);
  const [text, setText] = useState('');
  const [results, setResults] = useState<Result[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    AsyncStorage.getItem('token').then(t => { setToken(t); setReady(true); }).catch(() => setReady(true));
  }, []);

  const refresh = async (t: string, list?: Item[]) => {
    const l: Item[] = list ?? await api('/pantry', t);
    setItems(l);
    setResults(l.length ? await api('/match', t) : []);
  };

  useEffect(() => { if (token) refresh(token).catch(e => { setErr(e.message); logout(); }); }, [token]);

  const logout = () => { AsyncStorage.removeItem('token').catch(() => {}); setToken(null); setItems([]); setResults([]); };

  const auth = async (kind: 'login' | 'register') => {
    try {
      setErr('');
      const { token: t } = await api(`/auth/${kind}`, null, 'POST', { email, password });
      await AsyncStorage.setItem('token', t).catch(() => {});
      setPassword('');
      setToken(t);
    } catch (e: any) { setErr(e.message === 'Failed to fetch' ? 'Cannot reach server' : e.message); }
  };

  const guard = async (fn: () => Promise<void>) => { try { setErr(''); await fn(); } catch (e: any) { setErr(e.message); } };
  const add = () => guard(async () => {
    if (!text.trim() || !token) return;
    const l = await api('/pantry', token, 'POST', { name: text });
    setText('');
    await refresh(token, l);
  });
  const del = (id: number) => guard(async () => { if (token) await refresh(token, await api(`/pantry/${id}`, token, 'DELETE')); });

  if (!ready) return null;

  if (!token) return (
    <SafeAreaView style={{ flex: 1, padding: 16, maxWidth: 420 }}>
      <Text style={{ fontSize: 28, fontWeight: 'bold' }}>Bai</Text>
      <Text>What's in your kitchen? Get recipes to cook today.</Text>
      <TextInput value={email} onChangeText={setEmail} placeholder="Email" autoCapitalize="none" keyboardType="email-address" style={input} />
      <TextInput value={password} onChangeText={setPassword} placeholder="Password (6+ chars)" secureTextEntry style={input} />
      {err ? <Text style={{ color: 'red' }}>{err}</Text> : null}
      <Pressable style={btn} onPress={() => auth('login')}><Text style={{ color: 'white' }}>Log in</Text></Pressable>
      <Pressable style={{ ...btn, backgroundColor: '#555' }} onPress={() => auth('register')}><Text style={{ color: 'white' }}>Create account</Text></Pressable>
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={{ flex: 1, padding: 16 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ fontSize: 24, fontWeight: 'bold' }}>Bai</Text>
        <Pressable onPress={logout}><Text>Log out</Text></Pressable>
      </View>
      <TextInput value={text} onChangeText={setText} onSubmitEditing={add} placeholder="Add item (aloo, pyaaz, atta…)" style={input} />
      <Pressable style={btn} onPress={add}><Text style={{ color: 'white' }}>Add to pantry</Text></Pressable>
      {err ? <Text style={{ color: 'red' }}>{err}</Text> : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {items.map(i => (
          <Pressable key={i.id} onPress={() => del(i.id)} style={{ borderWidth: 1, borderRadius: 12, paddingHorizontal: 8, margin: 2 }}>
            <Text>{i.name}  ✕</Text>
          </Pressable>
        ))}
      </View>
      <Text style={{ fontWeight: 'bold', marginTop: 8 }}>{items.length ? 'What to cook' : 'Add items to see recipes'}</Text>
      <FlatList data={results} keyExtractor={r => r.recipe.name} renderItem={({ item: r }) => (
        <Pressable onPress={() => setOpen(open === r.recipe.name ? null : r.recipe.name)} style={{ paddingVertical: 8 }}>
          <Text style={{ fontWeight: 'bold' }}>{r.recipe.veg ? '🟢' : '🔴'} {r.recipe.name} — {r.matchPct}%</Text>
          {r.missing.length > 0 && <Text>Missing: {r.missing.join(', ')}</Text>}
          {open === r.recipe.name && r.recipe.steps.map((s, i) => <Text key={i}>{i + 1}. {s}</Text>)}
        </Pressable>
      )} />
    </SafeAreaView>
  );
}
