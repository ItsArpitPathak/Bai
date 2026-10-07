import { useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, Share, Text, View } from 'react-native';
import { api, msg } from '../api';
import { useAuth } from '../auth';
import { makeStyles } from '../styles';
import { useTheme } from '../theme';
import { Screen } from './Screen';

type Item = { id: number; name: string; checked: boolean };

export function ShoppingList() {
  const c = useTheme();
  const s = useMemo(() => makeStyles(c), [c]);
  const { token } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [err, setErr] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => { if (token) api('/shopping', token).then(setItems).catch(e => setErr(msg(e))); }, [token]);

  const run = async (path: string, method: string, body?: unknown) => {
    try { setErr(''); setItems(await api(path, token, method, body)); } catch (e: any) { setErr(msg(e)); }
  };
  const copy = async () => {
    const text = items.filter(i => !i.checked).map(i => i.name).join('\n');
    if (Platform.OS === 'web') { await navigator.clipboard?.writeText(text).catch(() => {}); setCopied(true); }
    else await Share.share({ message: text }).catch(() => {});
  };
  const anyChecked = items.some(i => i.checked);

  return (
    <Screen title="List">
      <ScrollView contentContainerStyle={s.paneContent}>
        {err ? <Text style={s.error}>{err}</Text> : null}
        {items.length === 0 && <View style={s.empty}><Text style={s.emptyTxt}>Nothing to buy. Use "+ list" on a recipe's missing items.</Text></View>}
        {items.map(i => (
          <View key={i.id} style={[s.row, { paddingVertical: 8 }]}>
            <Pressable style={[s.row, { flex: 1 }]} onPress={() => run(`/shopping/${i.id}`, 'PATCH', { checked: !i.checked })} accessibilityRole="checkbox" accessibilityState={{ checked: i.checked }} accessibilityLabel={i.name}>
              <Text style={s.tileEmoji}>{i.checked ? '☑' : '☐'}</Text>
              <Text style={[s.step, i.checked && { textDecorationLine: 'line-through', color: c.muted }]}>{i.name}</Text>
            </Pressable>
            <Pressable onPress={() => run(`/shopping/${i.id}`, 'DELETE')} accessibilityRole="button" accessibilityLabel={`Remove ${i.name}`}><Text style={s.link}>✕</Text></Pressable>
          </View>
        ))}
        {items.length > 0 && (
          <View style={{ gap: 8, marginTop: 16 }}>
            <Pressable style={[s.primaryBtn, !anyChecked && s.disabled]} disabled={!anyChecked} onPress={() => run('/shopping/to-pantry', 'POST')} accessibilityRole="button"><Text style={s.primaryTxt}>Move checked to pantry</Text></Pressable>
            <Pressable onPress={copy} accessibilityRole="button"><Text style={s.link}>{copied ? 'Copied ✓' : 'Copy as text'}</Text></Pressable>
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}
