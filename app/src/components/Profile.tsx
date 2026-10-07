import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { api, msg } from '../api';
import { useAuth } from '../auth';
import { makeStyles } from '../styles';
import { useTheme } from '../theme';
import { Screen } from './Screen';

const DIETS = [['veg', '🟢 Veg'], ['egg', '🟡 Veg + egg'], ['nonveg', '🔴 Anything']] as const;

export function Profile() {
  const c = useTheme();
  const s = useMemo(() => makeStyles(c), [c]);
  const { token, logout } = useAuth();
  const router = useRouter();
  const [diet, setDiet] = useState<string>('nonveg');
  const [avoid, setAvoid] = useState<string[]>([]);
  const [text, setText] = useState('');
  const [size, setSize] = useState(2);
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!token) return;
    api('/profile', token).then(p => { setDiet(p.diet ?? 'nonveg'); setAvoid(p.avoid); setSize(p.householdSize ?? 2); }).catch(e => setNote(msg(e)));
  }, [token]);

  const addAvoid = () => {
    const n = text.split(/[,\n]/).map(x => x.trim().toLowerCase()).filter(Boolean);
    setAvoid([...new Set([...avoid, ...n])]); setText('');
  };
  const save = async () => {
    try { const p = await api('/profile', token, 'PUT', { diet, avoid, householdSize: size }); setAvoid(p.avoid); setNote('Saved ✓'); }
    catch (e: any) { setNote(msg(e)); }
  };

  return (
    <Screen title="Me">
      <ScrollView contentContainerStyle={s.paneContent}>
        <View style={s.card}>
          <Text style={s.h2}>Diet</Text>
          <View style={s.filters}>
            {DIETS.map(([k, label]) => (
              <Pressable key={k} onPress={() => setDiet(k)} style={[s.filter, diet === k && s.filterOn]} accessibilityRole="button" accessibilityState={{ selected: diet === k }}>
                <Text style={[s.filterTxt, diet === k && s.filterTxtOn]}>{label}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={s.h2}>Foods to avoid</Text>
          <View style={s.row}>
            <TextInput value={text} onChangeText={setText} onSubmitEditing={addAvoid} placeholder="e.g. brinjal, mushroom" placeholderTextColor={c.muted} accessibilityLabel="Food to avoid" style={[s.input, { flex: 1, minWidth: 0, marginBottom: 0 }]} />
            <Pressable style={[s.addBtn, !text.trim() && s.disabled]} disabled={!text.trim()} onPress={addAvoid} accessibilityRole="button"><Text style={s.primaryTxt}>Add</Text></Pressable>
          </View>
          <View style={s.chips}>
            {avoid.map(a => <Pressable key={a} onPress={() => setAvoid(avoid.filter(x => x !== a))} style={s.chip} accessibilityLabel={`Remove ${a}`}><Text style={s.chipTxt}>{a}  ✕</Text></Pressable>)}
          </View>

          <Text style={s.h2}>Household size</Text>
          <View style={[s.row, { marginBottom: 16 }]}>
            <Pressable style={s.filter} onPress={() => setSize(Math.max(1, size - 1))} accessibilityRole="button" accessibilityLabel="Fewer people"><Text style={s.filterTxt}>−</Text></Pressable>
            <Text style={s.h2}>{size}</Text>
            <Pressable style={s.filter} onPress={() => setSize(Math.min(20, size + 1))} accessibilityRole="button" accessibilityLabel="More people"><Text style={s.filterTxt}>+</Text></Pressable>
          </View>

          <Pressable style={s.primaryBtn} onPress={save} accessibilityRole="button"><Text style={s.primaryTxt}>Save</Text></Pressable>
          {note ? <Text style={[s.muted, { marginTop: 8 }]}>{note}</Text> : null}
        </View>
        <Pressable onPress={() => { logout(); router.replace('/kitchen'); }} accessibilityRole="button"><Text style={s.link}>Log out</Text></Pressable>
      </ScrollView>
    </Screen>
  );
}
