import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { api, msg } from '../api';
import { useAuth } from '../auth';
import { makeStyles } from '../styles';
import { useTheme } from '../theme';

export function Login() {
  const c = useTheme();
  const s = useMemo(() => makeStyles(c), [c]);
  const { login } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const auth = async () => {
    try {
      setErr(''); setBusy(true);
      const { token: t } = await api(`/auth/${mode}`, null, 'POST', { email, password });
      setPassword('');
      await login(t);
    } catch (e: any) { setErr(msg(e)); } finally { setBusy(false); }
  };

  return (
      <View style={s.authWrap}>
        <Text style={s.logo}>🍲 Bai</Text>
        <Text style={s.tagline}>Tell Bai what's in your kitchen.{'\n'}Get recipes you can cook today.</Text>
        <View style={s.card}>
          <Text style={s.h2}>{mode === 'login' ? 'Welcome back' : 'Create your account'}</Text>
          <TextInput value={email} onChangeText={setEmail} placeholder="Email" placeholderTextColor={c.muted} autoCapitalize="none" keyboardType="email-address" accessibilityLabel="Email" style={s.input} />
          <TextInput value={password} onChangeText={setPassword} onSubmitEditing={auth} placeholder="Password (6+ characters)" placeholderTextColor={c.muted} secureTextEntry accessibilityLabel="Password" style={s.input} />
          {err ? <Text style={s.error}>{err}</Text> : null}
          <Pressable style={[s.primaryBtn, busy && s.disabled]} disabled={busy} onPress={auth} accessibilityRole="button">
            {busy ? <ActivityIndicator color={c.onPrimary} /> : <Text style={s.primaryTxt}>{mode === 'login' ? 'Log in' : 'Create account'}</Text>}
          </Pressable>
          <Pressable onPress={() => { setMode(mode === 'login' ? 'register' : 'login'); setErr(''); }} accessibilityRole="button">
            <Text style={s.link}>{mode === 'login' ? 'New here? Create an account' : 'Have an account? Log in'}</Text>
          </Pressable>
        </View>
      </View>
  );
}
