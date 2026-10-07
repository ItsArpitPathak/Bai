import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, TextInput, View } from 'react-native';
import { api, msg } from '../api';
import { useAuth } from '../auth';
import { makeStyles } from '../styles';
import { useTheme } from '../theme';

type Item = { id: number; name: string };
type Result = { recipe: { name: string; veg: boolean; steps: string[] }; matchPct: number; missing: string[] };
type Filter = 'all' | 'veg' | 'ready';

const QUICK = ['potato', 'onion', 'tomato', 'rice', 'wheat flour', 'toor dal', 'moong dal', 'paneer', 'egg', 'milk', 'curd', 'spinach', 'peas', 'cauliflower'];

export function Kitchen() {
  const c = useTheme();
  const s = useMemo(() => makeStyles(c), [c]);
  const { token, logout } = useAuth();

  const [items, setItems] = useState<Item[]>([]);
  const [text, setText] = useState('');
  const [results, setResults] = useState<Result[]>([]);
  const [matching, setMatching] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const [open, setOpen] = useState<string | null>(null);
  const [err, setErr] = useState('');


  const refresh = async (t: string, list?: Item[]) => {
    const l: Item[] = list ?? await api('/pantry', t);
    setItems(l);
    setMatching(true);
    try { setResults(l.length ? await api('/match', t) : []); } finally { setMatching(false); }
  };


  useEffect(() => { if (token) refresh(token).catch(e => { setErr(msg(e)); if (!(e instanceof TypeError)) logout(); }); }, [token]);

  const guard = async (fn: () => Promise<void>) => { try { setErr(''); await fn(); } catch (e: any) { setErr(msg(e)); } };
  const addName = (name: string) => guard(async () => {
    if (!name.trim() || !token) return;
    const l = await api('/pantry', token, 'POST', { name });
    setText('');
    await refresh(token, l);
  });
  const del = (id: number) => guard(async () => { if (token) await refresh(token, await api(`/pantry/${id}`, token, 'DELETE')); });

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
  );
}
