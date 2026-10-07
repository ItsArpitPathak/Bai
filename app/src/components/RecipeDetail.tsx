import { useKeepAwake } from 'expo-keep-awake';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, Share, Text, View, useWindowDimensions } from 'react-native';
import { api, msg } from '../api';
import { useAuth } from '../auth';
import { useLists } from '../lists';
import { loadGuest } from '../store';
import { makeStyles } from '../styles';
import { useTheme } from '../theme';
import { cap, SLOTS, weekDays, type Slot } from './Plan';
import { DIET, STAPLES, TILE, type Recipe } from './RecipeCard';

function KeepAwake() { useKeepAwake(); return null; }

export function RecipeDetail() {
  const c = useTheme();
  const s = useMemo(() => makeStyles(c), [c]);
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token } = useAuth();
  const router = useRouter();
  const { saved, toggleSave, addToList } = useLists();
  const [added, setAdded] = useState(false);
  const { width } = useWindowDimensions();
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [have, setHave] = useState<Set<string>>(new Set());
  const [err, setErr] = useState('');
  const [cook, setCook] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [planning, setPlanning] = useState(false);
  const [pd, setPd] = useState(weekDays()[0].date);
  const [ps, setPs] = useState<Slot>('dinner');
  const [planned, setPlanned] = useState(false);

  useEffect(() => {
    api(`/recipes/${id}`, null).then(setRecipe).catch(e => setErr(e.message === 'Error 404' ? 'Recipe not found.' : msg(e)));
    (token ? api('/pantry', token).then((l: { name: string }[]) => l.map(i => i.name)) : loadGuest())
      .then(names => setHave(new Set(names))).catch(() => {});
  }, [id, token]);

  const addToPlan = async () => {
    if (!token) return router.push('/login');
    try { await api('/plan', token, 'POST', { date: pd, slot: ps, recipeId: id }); setPlanned(true); setPlanning(false); } catch (e: any) { setErr(msg(e)); }
  };
  const back = () => (router.canGoBack() ? router.back() : router.replace('/kitchen'));
  const share = async () => {
    if (Platform.OS === 'web') { await navigator.clipboard?.writeText(window.location.href).catch(() => {}); setCopied(true); }
    else await Share.share({ message: `${recipe?.name} on Bai` }).catch(() => {});
  };

  const bar = (
    <View style={[s.topBar, s.gutter]}>
      <Pressable onPress={back} accessibilityRole="button"><Text style={s.link}>← Back</Text></Pressable>
      <View style={s.row}>
        <Pressable onPress={() => recipe && toggleSave(recipe.id)} accessibilityRole="button"><Text style={s.link}>{recipe && saved.has(recipe.id) ? '♥ Saved' : '♡ Save'}</Text></Pressable>
        <Pressable onPress={share} accessibilityRole="button"><Text style={s.link}>{copied ? 'Link copied ✓' : 'Share'}</Text></Pressable>
      </View>
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

  const missing = recipe.ingredients.filter(i => !have.has(i) && !STAPLES.includes(i));
  const ingredients = (
    <View style={wide ? { flex: 1 } : undefined}>
      <Text style={s.h2}>Ingredients</Text>
      {recipe.ingredients.map(i => (
        <Text key={i} style={s.step}>{have.has(i) || STAPLES.includes(i) ? '✅' : '❌'}  {i}</Text>
      ))}
      {missing.length > 0 && (
        <Pressable onPress={() => addToList(missing).then(() => setAdded(true))} accessibilityRole="button"><Text style={s.link}>{added ? '✓ Added to list' : '+ Add missing to list'}</Text></Pressable>
      )}
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
        <Pressable onPress={() => (token ? setPlanning(!planning) : router.push('/login'))} accessibilityRole="button"><Text style={s.link}>{planned ? '✓ Added to plan' : '📅 Add to plan'}</Text></Pressable>
        {planning && (
          <View style={[s.card, { marginTop: 8 }]}>
            <View style={s.filters}>{weekDays().map(d => (
              <Pressable key={d.date} onPress={() => setPd(d.date)} style={[s.filter, pd === d.date && s.filterOn]} accessibilityRole="button" accessibilityState={{ selected: pd === d.date }}><Text style={[s.filterTxt, pd === d.date && s.filterTxtOn]}>{d.label}</Text></Pressable>
            ))}</View>
            <View style={s.filters}>{SLOTS.map(sl => (
              <Pressable key={sl} onPress={() => setPs(sl)} style={[s.filter, ps === sl && s.filterOn]} accessibilityRole="button" accessibilityState={{ selected: ps === sl }}><Text style={[s.filterTxt, ps === sl && s.filterTxtOn]}>{cap(sl)}</Text></Pressable>
            ))}</View>
            <Pressable style={s.primaryBtn} onPress={addToPlan} accessibilityRole="button"><Text style={s.primaryTxt}>Add</Text></Pressable>
          </View>
        )}
        <View style={[wide ? { flexDirection: 'row', gap: 24 } : undefined, { marginTop: 8 }]}>{ingredients}{steps}</View>
        <View style={s.chips}>{recipe.tags.map(t => <View key={t} style={s.chip}><Text style={s.chipTxt}>{t}</Text></View>)}</View>
      </ScrollView>
    </View>
  );
}
