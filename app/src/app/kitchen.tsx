import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../auth';
import { Kitchen } from '../components/Kitchen';
import { makeStyles } from '../styles';
import { useTheme } from '../theme';

// No login wall: everyone lands in the kitchen; login is optional (saves the pantry across devices).
export default function KitchenScreen() {
  const { ready } = useAuth();
  const s = makeStyles(useTheme());
  return <SafeAreaView style={s.screen}>{ready ? <Kitchen /> : <View />}</SafeAreaView>;
}
