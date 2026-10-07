import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { api, msg } from '../api';
import { useAuth } from '../auth';
import { makeStyles } from '../styles';
import { useTheme } from '../theme';
import { Screen } from './Screen';

export const SLOTS = ['breakfast', 'lunch', 'dinner'] as const;
export type Slot = (typeof SLOTS)[number];
export type Entry = { id: number; date: string; slot: Slot; recipeId: string; recipeName: string; timeMinutes: number };

const pad = (n: number) => String(n).padStart(2, '0');
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const weekDays = () => Array.from({ length: 7 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() + i); return { date: iso(d), label: d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' }) }; });
export const cap = (x: string) => x[0].toUpperCase() + x.slice(1);

type Pick = { date: string; slot: Slot; label: string };

export function Plan() {
  const c = useTheme();
  const s = useMemo(() => makeStyles(c), [c]);
  const { token } = useAuth();
  const { width } = useWindowDimensions();
  const wide = width >= 768;
  const days = useMemo(weekDays, []);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [pick, setPick] = useState<Pick | null>(null);
  const [options, setOptions] = useState<{ recipe: { id: string; name: string; timeMinutes: number }; missingCount: number }[]>([]);
  const [err, setErr] = useState('');

  useEffect(() => { if (token) api('/plan', token).then(setEntries).catch(e => setErr(msg(e))); }, [token]);
  // picker lists recipes for the slot, closest to cookable from the pantry first
  useEffect(() => {
    if (!pick || !token) return;
    api(`/match?mealType=${pick.slot}`, token).then(m => setOptions(m.results.slice(0, 40))).catch(e => setErr(msg(e)));
  }, [pick, token]);

  const run = async (path: string, method: string, body?: unknown) => {
    try { setErr(''); setEntries(await api(path, token, method, body)); } catch (e: any) { setErr(msg(e)); }
  };
  const at = (date: string, slot: Slot) => entries.find(e => e.date === date && e.slot === slot);

  const cell = (date: string, slot: Slot, label: string) => {
    const e = at(date, slot);
    return (
      <View key={date + slot} style={[s.planCell, wide && { flex: 1 }]}>
        <Pressable style={{ flex: 1 }} onPress={() => setPick({ date, slot, label })} accessibilityRole="button" accessibilityLabel={e ? `${label} ${slot}: ${e.recipeName}, swap` : `Add ${slot} on ${label}`}>
          <Text style={e ? s.step : s.link}>{e ? e.recipeName : '+ Add'}</Text>
        </Pressable>
        {e && <Pressable onPress={() => run(`/plan/${e.id}`, 'DELETE')} accessibilityRole="button" accessibilityLabel={`Remove ${e.recipeName}`}><Text style={s.muted}>✕</Text></Pressable>}
      </View>
    );
  };

  return (
    <Screen title="Plan">
      <ScrollView contentContainerStyle={s.paneContent}>
        {err ? <Text style={s.error}>{err}</Text> : null}
        {wide ? (
          <View style={{ gap: 8 }}>
            <View style={s.row}><View style={{ width: 90 }} />{days.map(d => <Text key={d.date} style={[s.h2, { flex: 1, marginBottom: 0 }]}>{d.label}</Text>)}</View>
            {SLOTS.map(slot => (
              <View key={slot} style={[s.row, { alignItems: 'stretch' }]}>
                <Text style={[s.muted, { width: 90, paddingTop: 10 }]}>{cap(slot)}</Text>
                {days.map(d => cell(d.date, slot, d.label))}
              </View>
            ))}
          </View>
        ) : days.map(d => (
          <View key={d.date} style={s.card}>
            <Text style={s.h2}>{d.label}</Text>
            {SLOTS.map(slot => (
              <View key={slot} style={[s.row, { alignItems: 'stretch', marginBottom: 6 }]}>
                <Text style={[s.muted, { width: 80, paddingTop: 10 }]}>{cap(slot)}</Text>
                <View style={{ flex: 1 }}>{cell(d.date, slot, d.label)}</View>
              </View>
            ))}
          </View>
        ))}

        {pick && (
          <View style={[s.card, { marginTop: 16 }]}>
            <View style={s.topBar}>
              <Text style={s.h2}>{pick.label} · {cap(pick.slot)}</Text>
              <Pressable onPress={() => setPick(null)} accessibilityRole="button"><Text style={s.link}>✕ Close</Text></Pressable>
            </View>
            {options.map(o => (
              <Pressable key={o.recipe.id} style={{ paddingVertical: 8 }} onPress={() => { run('/plan', 'POST', { date: pick.date, slot: pick.slot, recipeId: o.recipe.id }); setPick(null); }} accessibilityRole="button">
                <Text style={s.step}>{o.recipe.name} <Text style={s.muted}>· {o.recipe.timeMinutes} min · {o.missingCount ? `missing ${o.missingCount}` : 'ready'}</Text></Text>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}
