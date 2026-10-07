import { useKeepAwake } from 'expo-keep-awake';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, Share, Text, View, useWindowDimensions } from 'react-native';
import { api, msg } from '../api';
import { useAuth } from '../auth';
import { loadGuest } from '../store';
import { makeStyles } from '../styles';
import { useTheme } from '../theme';
import { DIET, TILE, type Recipe } from './RecipeCard';

const cap = (x: string) => x[0].toUpperCase() + x.slice(1);

function KeepAwake() { useKeepAwake(); return null; }

export function RecipeDetail() {
  const c = useTheme();
  const s = useMemo(() => makeStyles(c), [c]);
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token } = useAuth();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [have, setHave] = useState<Set<string>>(new Set());
  const [err, setErr] = useState('');
  const [cook, setCook] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    api(`/recipes/${id}`, null).then(setRecipe).catch(e => setErr(e.message === 'Error 404' ? 'Recipe not found.' : msg(e)));
    (token ? api('/pantry', token).then((l: { name: string }[]) => l.map(i => i.name)) : loadGuest())
      .then(names => setHave(new Set(names))).catch(() => {});
  }, [id, token]);

  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const share = async () => {
    if (Platform.OS === 'web') { await navigator.clipboard?.writeText(window.location.href).catch(() => {}); setCopied(true); }
    else await Share.share({ message: `${recipe?.name} on Bai` }).catch(() => {});
  };

  const bar = (
    <View style={[s.topBar, s.gutter]}>
      <Pressable onPress={back} accessibilityRole="button"><Text style={s.link}>← Back</Text></Pressable>
      <Pressable onPress={share} accessibilityRole="button"><Text style={s.link}>{copied ? 'Link copied ✓' : 'Share'}</Text></Pressable>
    </View>
  );
  if (!recipe) return <View style={s.screen}>{bar}<Text style={[s.emptyTxt, { marginTop: 32 }]}>{err || 'Loading…'}</Text></View>;

  const [emoji, bg] = TILE[recipe.tags[0]] ?? ['🍽️', '#EEE'];
  const wide = width >= 768;

  if (cook !== null) return (
    <View style={s.screen}>
      <KeepAwake />
      <View style={[s.topBar, s.gutter]}>
        <Text style={s.h2}>{recipe.name}</Text>
        <Pressable onPress={() => setCook(null)} accessibilityRole="button"><Text style={s.link}>✕ Close</Text></Pressable>
      </View>
      <View style={s.cookBody}>
        <Text style={s.muted}>Step {cook + 1} of {recipe.steps.length}</Text>
        <Text style={s.cookStep} accessibilityLiveRegion="polite" aria-live="polite">{recipe.steps[cook]}</Text>
      </View>
      <View style={[s.row, s.gutter, { paddingBottom: 16 }]}>
        <Pressable style={[s.cookBtn, { backgroundColor: c.surface, borderWidth: 1, borderColor: c.border }, cook === 0 && s.disabled]} disabled={cook === 0} onPress={() => setCook(cook - 1)} accessibilityRole="button">
          <Text style={[s.primaryTxt, { color: c.text }]}>← Prev</Text>
        </Pressable>
        <Pressable style={s.cookBtn} onPress={() => (cook + 1 < recipe.steps.length ? setCook(cook + 1) : setCook(null))} accessibilityRole="button">
          <Text style={s.primaryTxt}>{cook + 1 < recipe.steps.length ? 'Next →' : 'Done ✓'}</Text>
        </Pressable>
      </View>
    </View>
  );

  const ingredients = (
    <View style={wide ? { flex: 1 } : undefined}>
      <Text style={s.h2}>Ingredients</Text>
      {recipe.ingredients.map(i => (
        <Text key={i} style={s.step}>{have.has(i) ? '✅' : '❌'}  {i}</Text>
      ))}
    </View>
  );
  const steps = (
    <View style={wide ? { flex: 1 } : { marginTop: 16 }}>
      <Text style={s.h2}>Steps</Text>
      {recipe.steps.map((st, i) => <Text key={i} style={[s.step, { marginBottom: 6 }]}>{i + 1}. {st}</Text>)}
    </View>
  );

  return (
    <View style={s.screen}>
      {bar}
      <ScrollView contentContainerStyle={s.paneContent}>
        <View style={s.recipeRow}>
          <View style={[s.tile, { backgroundColor: bg }]}><Text style={s.tileEmoji}>{emoji}</Text></View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={s.headline}>{recipe.name}</Text>
            <Text style={s.muted}>⏱ {recipe.timeMinutes} min · {cap(recipe.difficulty)} · {DIET[recipe.diet]} · {recipe.mealType.map(cap).join(', ')}</Text>
          </View>
        </View>
        <Pressable style={[s.primaryBtn, { marginVertical: 16 }]} onPress={() => setCook(0)} accessibilityRole="button">
          <Text style={s.primaryTxt}>👩‍🍳 Start cooking</Text>
        </Pressable>
        <View style={wide ? { flexDirection: 'row', gap: 24 } : undefined}>{ingredients}{steps}</View>
        <View style={s.chips}>{recipe.tags.map(t => <View key={t} style={s.chip}><Text style={s.chipTxt}>{t}</Text></View>)}</View>
      </ScrollView>
    </View>
  );
}
