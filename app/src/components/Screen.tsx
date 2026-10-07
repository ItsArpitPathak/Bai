import { useRouter } from 'expo-router';
import { type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../auth';
import { makeStyles } from '../styles';
import { useTheme } from '../theme';

// Shell for logged-in-only pages (Saved, List): back bar, title, and a login prompt for guests.
export function Screen({ title, children }: { title: string; children: ReactNode }) {
  const s = makeStyles(useTheme());
  const router = useRouter();
  const { token } = useAuth();
  return (
    <SafeAreaView style={s.screen}>
      <View style={[s.topBar, s.gutter]}>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/kitchen'))} accessibilityRole="button"><Text style={s.link}>← Back</Text></Pressable>
        <Text style={s.h2}>{title}</Text>
        <View style={{ width: 60 }} />
      </View>
      {token ? children : (
        <View style={s.empty}>
          <Text style={s.emptyTxt}>Log in to use {title.toLowerCase()}. Your pantry stays on this device until you do.</Text>
          <Pressable onPress={() => router.push('/login')} style={[s.primaryBtn, { paddingHorizontal: 32 }]} accessibilityRole="button"><Text style={s.primaryTxt}>Log in</Text></Pressable>
        </View>
      )}
    </SafeAreaView>
  );
}
