import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { makeStyles } from '../styles';
import { useTheme } from '../theme';

export type Result = {
  recipe: { id: string; name: string; diet: string; timeMinutes: number; difficulty: string; tags: string[]; ingredients: string[]; steps: string[] };
  matchPct: number; missingCount: number; missing: string[];
};

const STAPLES = ['salt', 'oil', 'ghee', 'water', 'sugar'];
const TILE: Record<string, [string, string]> = {
  dal: ['🫘', '#F2D7A6'], sabzi: ['🥔', '#CFE8C3'], roti: ['🫓', '#F3DFC1'], rice: ['🍚', '#E3E8F2'],
  snack: ['🥟', '#F6D2C4'], sweet: ['🍮', '#F6D5E3'], side: ['🥣', '#D3EAE6'], drink: ['🍵', '#E5E0F5'],
};
const DIET: Record<string, string> = { veg: '🟢 Veg', egg: '🟡 Egg', nonveg: '🔴 Non-veg' };

export function RecipeCard({ r }: { r: Result }) {
  const c = useTheme();
  const s = useMemo(() => makeStyles(c), [c]);
  const [open, setOpen] = useState(false);
  const { recipe, matchPct, missing, missingCount } = r;
  const [emoji, bg] = TILE[recipe.tags[0]] ?? ['🍽️', '#EEE'];
  const total = recipe.ingredients.filter(i => !STAPLES.includes(i)).length;
  const bar = matchPct === 100 ? c.good : matchPct >= 50 ? c.warn : c.muted;

  return (
    <Pressable onPress={() => setOpen(!open)} style={s.recipe} accessibilityRole="button">
      <View style={s.recipeRow}>
        <View style={[s.tile, { backgroundColor: bg }]}><Text style={s.tileEmoji}>{emoji}</Text></View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.recipeName}>{recipe.name}</Text>
          <Text style={s.muted}>⏱ {recipe.timeMinutes} min · {recipe.difficulty[0].toUpperCase() + recipe.difficulty.slice(1)} · {DIET[recipe.diet]}</Text>
          <Text style={[s.matchLine, { color: missingCount ? c.warn : c.good }]}>
            {missingCount ? `⚠ Missing ${missingCount}: ${missing.join(', ')}` : `✅ You have all ${total}`}
          </Text>
        </View>
        <Text style={[s.pct, { color: bar }]}>{matchPct}%</Text>
      </View>
      <View style={s.bar}><View style={[s.barFill, { width: `${matchPct}%`, backgroundColor: bar }]} /></View>
      {open ? (
        <View style={s.steps}>
          {recipe.steps.map((st, i) => <Text key={i} style={s.step}>{i + 1}. {st}</Text>)}
        </View>
      ) : <Text style={s.hint}>Tap for steps</Text>}
    </Pressable>
  );
}
