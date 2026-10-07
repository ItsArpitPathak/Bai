import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { api, msg } from '../api';
import { useAuth } from '../auth';
import { makeStyles } from '../styles';
import { useTheme } from '../theme';
import { cap } from './Plan';
import { DIET, STAPLES, type Recipe } from './RecipeCard';

const FRIENDLY: Record<string, string> = {
  'Error 429': 'Daily AI limit reached. Try tomorrow.',
  'Error 503': 'AI is not set up on this server yet.',
  'Error 502': 'AI could not make recipes right now. Try again later.',
};
const AI = '#7048E8'; // reserved for the AI button/badge only

// Optional extra: asks Gemini (via POST /generate, login required, 5 a day) for 3 recipes from the pantry.
export function AiRecipes({ have }: { have: Set<string> }) {
  const c = useTheme();
  const s = useMemo(() => makeStyles(c), [c]);
  const { token } = useAuth();
  const router = useRouter();
  const [prompt, setPrompt] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [recipes, setRecipes] = useState<Recipe[]>([]);

  const go = async () => {
    if (!token) return router.push('/login');
    try {
      setErr(''); setBusy(true);
      setRecipes(await api('/generate', token, 'POST', { prompt: prompt.trim() || undefined }));
    } catch (e: any) { setErr(msg(e)); } finally { setBusy(false); }
  };

  return (
    <View style={[s.card, { marginTop: 16 }]}>
      <Text style={s.h2}>✨ Nothing you like?</Text>
      <TextInput value={prompt} onChangeText={setPrompt} maxLength={200} placeholder="Optional: something light, spicy, for kids…" placeholderTextColor={c.muted} accessibilityLabel="Request for AI recipes" style={s.input} />
      <Pressable style={[s.primaryBtn, { backgroundColor: AI }, busy && s.disabled]} disabled={busy} onPress={go} accessibilityRole="button">
        {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={[s.primaryTxt, { color: '#FFFFFF' }]}>✨ Generate with AI</Text>}
      </Pressable>
      <Text style={[s.muted, { marginTop: 6 }]}>Uses your pantry, diet and avoid list. 5 a day. {token ? '' : 'Log in to use it.'}</Text>
      {err ? <Text style={[s.error, { marginTop: 8 }]}>{FRIENDLY[err] ?? err}</Text> : null}

      {recipes.map(r => (
        <View key={r.id} style={[s.recipe, { marginTop: 12 }]}>
          <Text style={s.recipeName}>{r.name} <Text style={{ color: AI, fontSize: 12 }}>✨ AI</Text></Text>
          <Text style={s.muted}>⏱ {r.timeMinutes} min · {cap(r.difficulty)} · {DIET[r.diet]}</Text>
          <Text style={[s.h2, { marginTop: 8, fontSize: 15 }]}>Ingredients</Text>
          {r.ingredients.map(i => <Text key={i} style={s.step}>{have.has(i) || STAPLES.includes(i) ? '✅' : '❌'}  {i}</Text>)}
          <Text style={[s.h2, { marginTop: 8, fontSize: 15 }]}>Steps</Text>
          {r.steps.map((st, i) => <Text key={i} style={s.step}>{i + 1}. {st}</Text>)}
        </View>
      ))}
    </View>
  );
}
