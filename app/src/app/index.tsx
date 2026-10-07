import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../auth';
import { Kitchen } from '../components/Kitchen';
import { Login } from '../components/Login';
import { makeStyles } from '../styles';
import { useTheme } from '../theme';

export default function Index() {
  const { token, ready } = useAuth();
  const s = makeStyles(useTheme());
  if (!ready) return <View style={s.screen} />;
  return <SafeAreaView style={s.screen}>{token ? <Kitchen /> : <Login />}</SafeAreaView>;
}
