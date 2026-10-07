import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, View } from 'react-native';
import { useAuth } from '../auth';
import { Landing } from '../components/Landing';
import { loadGuest } from '../store';
import { makeStyles } from '../styles';
import { useTheme } from '../theme';

// Web, logged out, no saved pantry: landing page. Everyone else goes straight to the kitchen.
export default function Index() {
  const { token, ready } = useAuth();
  const s = makeStyles(useTheme());
  const [returning, setReturning] = useState<boolean | null>(null);
  useEffect(() => { loadGuest().then(g => setReturning(g.length > 0)); }, []);

  if (!ready || returning === null) return <View style={s.screen} />;
  if (Platform.OS !== 'web' || token || returning) return <Redirect href="/kitchen" />;
  return <Landing />;
}
