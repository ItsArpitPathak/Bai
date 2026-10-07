import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Linking, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { api, msg } from '../api';
import { loadGuest, saveGuest } from '../store';
import { makeStyles } from '../styles';
import { useTheme } from '../theme';
import { RecipeCard, type Result } from './RecipeCard';

const EXAMPLES = ['besan, dahi, jeera', 'aloo, pyaaz, tamatar', 'chawal, dal, haldi', 'atta, paneer, palak'];
const POPULAR = ['aloo', 'pyaaz', 'tamatar', 'chawal', 'atta', 'toor dal', 'paneer', 'dahi', 'ande', 'palak', 'matar', 'besan'];
const HOW = ['① Add what you have', '② See what you can cook', '③ Know exactly what is missing'];
const FEATURES = [
  ['🧺', 'Your pantry, by category', 'Tap to toggle what is in your kitchen, or paste a whole list at once.'],
  ['🗣️', 'Hindi names just work', 'Type aloo, pyaaz or besan. Bai knows them as potato, onion and gram flour.'],
  ['⏱', 'Cook with confidence', 'Time, difficulty and step-by-step cooking mode that keeps your screen awake.'],
];
const SAMPLE = 'potato,onion,tomato,rice,wheat flour,cumin,turmeric';

export function Landing() {
  const c = useTheme();
  const s = useMemo(() => makeStyles(c), [c]);
  const router = useRouter();
  const [text, setText] = useState('');
  const [ex, setEx] = useState(0);
  const [err, setErr] = useState('');
  const [sample, setSample] = useState<Result[]>([]);

  useEffect(() => { const t = setInterval(() => setEx(e => (e + 1) % EXAMPLES.length), 3000); return () => clearInterval(t); }, []);
  useEffect(() => { api(`/match?items=${SAMPLE}&maxMissing=1`, null).then(m => setSample(m.results.slice(0, 6))).catch(() => {}); }, []);

  // pre-fills the guest pantry (canonical names, same as the kitchen), then opens the kitchen
  const go = async (raw: string) => {
    try {
      setErr('');
      const names = raw.split(/[,\n]/).map(x => x.trim()).filter(Boolean);
      if (names.length) {
        const canon: string[] = await api('/canonical?names=' + encodeURIComponent(names.join(',')), null);
        await saveGuest([...new Set([...(await loadGuest()), ...canon])].sort());
      }
      router.push('/kitchen');
    } catch (e: any) { setErr(msg(e)); }
  };

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.landing}>
      <Text style={s.logo}>🍲 Bai</Text>

      <View style={s.hero}>
        <Text style={s.heroTitle}>What's in your kitchen today?</Text>
        <View style={s.row}>
          <TextInput value={text} onChangeText={setText} onSubmitEditing={() => go(text)} placeholder="aloo, pyaaz, tamatar…" placeholderTextColor={c.muted} accessibilityLabel="Your ingredients" style={[s.input, { flex: 1, minWidth: 0, marginBottom: 0 }]} />
          <Pressable style={s.addBtn} onPress={() => go(text)} accessibilityRole="button"><Text style={s.primaryTxt}>Find recipes →</Text></Pressable>
        </View>
        {err ? <Text style={[s.error, { marginTop: 8 }]}>{err}</Text> : null}
        <Text style={[s.muted, { marginTop: 10 }]}>Try: "{EXAMPLES[ex]}"  ·  Free · no login needed</Text>
        <View style={s.chips}>
          {POPULAR.map(n => <Pressable key={n} onPress={() => go(n)} style={s.quick} accessibilityRole="button"><Text style={s.quickTxt}>+ {n}</Text></Pressable>)}
        </View>
      </View>

      <Text style={s.h2}>How it works</Text>
      <View style={s.landRow}>{HOW.map(h => <View key={h} style={[s.card, s.landCell]}><Text style={s.h2}>{h}</Text></View>)}</View>

      <View style={s.landRow}>
        {FEATURES.map(([e, t, d]) => (
          <View key={t} style={[s.card, s.landCell]}>
            <Text style={s.tileEmoji}>{e}</Text>
            <Text style={s.h2}>{t}</Text>
            <Text style={s.muted}>{d}</Text>
          </View>
        ))}
      </View>

      {sample.length > 0 && (
        <View>
          <Text style={s.h2}>Cooking tonight?</Text>
          <View style={s.landRow}>{sample.map(r => <View key={r.recipe.id} style={s.landCell}><RecipeCard r={r} /></View>)}</View>
        </View>
      )}

      <Pressable style={[s.primaryBtn, { alignSelf: 'center', paddingHorizontal: 32, marginVertical: 24 }]} onPress={() => go('')} accessibilityRole="button">
        <Text style={s.primaryTxt}>Start cooking</Text>
      </Pressable>
      <Pressable onPress={() => Linking.openURL('https://github.com/ItsArpitPathak/Bai')} accessibilityRole="link"><Text style={s.link}>GitHub</Text></Pressable>
    </ScrollView>
  );
}
