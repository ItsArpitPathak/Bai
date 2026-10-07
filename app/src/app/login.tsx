import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../auth';
import { Login } from '../components/Login';
import { makeStyles } from '../styles';
import { useTheme } from '../theme';

export default function LoginScreen() {
  const { ready } = useAuth();
  const s = makeStyles(useTheme());
  return <SafeAreaView style={s.screen}>{ready ? <Login /> : <View />}</SafeAreaView>;
}
