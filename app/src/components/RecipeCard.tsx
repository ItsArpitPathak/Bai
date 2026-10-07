import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useLists } from '../lists';
import { makeStyles } from '../styles';
import { useTheme } from '../theme';

export type Recipe = { id: string; name: string; diet: string; mealType: string[]; timeMinutes: number; difficulty: string; tags: string[]; ingredients: string[]; steps: string[] };
export type Result = {
  recipe: Recipe;
  matchPct: number; missingCount: number; missing: string[];
};

export const STAPLES = ['salt', 'oil', 'ghee', 'water', 'sugar'];
export const TILE: Record<string, [string, string]> = {
  dal: ['🫘', '#F2D7A6'], sabzi: ['🥔', '#CFE8C3'], roti: ['🫓', '#F3DFC1'], rice: ['🍚', '#E3E8F2'],
  snack: ['🥟', '#F6D2C4'], sweet: ['🍮', '#F6D5E3'], side: ['🥣', '#D3EAE6'], drink: ['🍵', '#E5E0F5'],
};
export const DIET: Record<string, string> = { veg: '🟢 Veg', egg: '🟡 Egg', nonveg: '🔴 Non-veg' };

export function RecipeCard({ r }: { r: Result }) {
  const c = useTheme();
  const s = useMemo(() => makeStyles(c), [c]);
  const router = useRouter();
  const { saved, toggleSave, addToList } = useLists();
  const [added, setAdded] = useState(false);
  const isSaved = saved.has(r.recipe.id);
  const { recipe, matchPct, missing, missingCount } = r;
  const [emoji, bg] = TILE[recipe.tags[0]] ?? ['🍽️', '#EEE'];
  const total = recipe.ingredients.filter(i => !STAPLES.includes(i)).length;
  const bar = matchPct === 100 ? c.good : matchPct >= 50 ? c.warn : c.muted;

  return (
    <Pressable onPress={() => router.push(`/recipe/${recipe.id}`)} style={s.recipe} accessibilityRole="button">
      <View style={s.recipeRow}>
        <View style={[s.tile, { backgroundColor: bg }]}><Text style={s.tileEmoji}>{emoji}</Text></View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.recipeName}>{recipe.name}</Text>
          <Text style={s.muted}>⏱ {recipe.timeMinutes} min · {recipe.difficulty[0].toUpperCase() + recipe.difficulty.slice(1)} · {DIET[recipe.diet]}</Text>
          <Text style={[s.matchLine, { color: missingCount ? c.warn : c.good }]}>
            {missingCount ? `⚠ Missing ${missingCount}: ${missing.join(', ')}` : `✅ You have all ${total}`}
            {missingCount > 0 && <Text onPress={() => addToList(missing).then(() => setAdded(true))} style={{ color: c.primary }}>{added ? '  ✓ added' : '  + list'}</Text>}
          </Text>
        </View>
        <View style={{ alignItems: 'center' }}>
          <Pressable onPress={() => toggleSave(recipe.id)} accessibilityRole="button" accessibilityLabel={isSaved ? 'Unsave' : 'Save'} accessibilityState={{ selected: isSaved }} hitSlop={8}>
            <Text style={s.tileEmoji}>{isSaved ? '♥' : '♡'}</Text>
          </Pressable>
          <Text style={[s.pct, { color: bar, marginLeft: 0 }]}>{matchPct}%</Text>
        </View>
      </View>
      <View style={s.bar}><View style={[s.barFill, { width: `${matchPct}%`, backgroundColor: bar }]} /></View>
    </Pressable>
  );
}
