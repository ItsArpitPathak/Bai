import { useEffect, useState } from 'react';
import { FlatList, Text, View, useWindowDimensions } from 'react-native';
import { api } from '../api';
import { useAuth } from '../auth';
import { useLists } from '../lists';
import { makeStyles } from '../styles';
import { useTheme } from '../theme';
import { RecipeCard, type Result } from './RecipeCard';
import { Screen } from './Screen';

export function Saved() {
  const s = makeStyles(useTheme());
  const { token } = useAuth();
  const { saved } = useLists();
  const { width } = useWindowDimensions();
  const cols = width >= 1440 ? 3 : width >= 768 ? 2 : 1;
  const [rows, setRows] = useState<Result[]>([]);

  // refetch when a heart is toggled so un-saving drops the card
  useEffect(() => { if (token) api('/saved', token).then(setRows).catch(() => {}); }, [token, saved]);

  return (
    <Screen title="Saved">
      <FlatList
        key={cols}
        numColumns={cols}
        columnWrapperStyle={cols > 1 ? { gap: 12 } : undefined}
        contentContainerStyle={s.listContent}
        data={rows}
        keyExtractor={r => r.recipe.id}
        ListEmptyComponent={<View style={s.empty}><Text style={s.emptyTxt}>No saved recipes yet. Tap ♡ on a recipe to keep it here.</Text></View>}
        renderItem={({ item: r }) => <View style={{ flex: 1 }}><RecipeCard r={r} /></View>}
      />
    </Screen>
  );
}
