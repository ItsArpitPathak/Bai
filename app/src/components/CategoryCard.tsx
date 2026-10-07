import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { makeStyles } from '../styles';
import { useTheme } from '../theme';

export type Category = { category: string; icon: string; items: string[] };
const TOP = 10;

export function CategoryCard({ cat, have, onToggle }: { cat: Category; have: Set<string>; onToggle: (name: string) => void }) {
  const c = useTheme();
  const s = useMemo(() => makeStyles(c), [c]);
  const [all, setAll] = useState(false);
  const shown = all ? cat.items : cat.items.filter((n, i) => i < TOP || have.has(n));
  const more = cat.items.length - shown.length;
  const count = cat.items.filter(n => have.has(n)).length;

  return (
    <View style={s.cat}>
      <Text style={s.catHead}>{cat.icon} {cat.category}  <Text style={s.muted}>{count}/{cat.items.length}</Text></Text>
      <View style={s.chips}>
        {shown.map(n => {
          const on = have.has(n);
          return (
            <Pressable key={n} onPress={() => onToggle(n)} style={[s.tog, on && s.togOn]} accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={`${n}, ${on ? 'selected' : 'not selected'}`}>
              <Text style={[s.togTxt, on && s.togTxtOn]}>{on ? '✓ ' : ''}{n}</Text>
            </Pressable>
          );
        })}
        {(more > 0 || all) && (
          <Pressable onPress={() => setAll(!all)} style={s.quick} accessibilityRole="button">
            <Text style={s.quickTxt}>{all ? 'Show less' : `+${more} more`}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}
