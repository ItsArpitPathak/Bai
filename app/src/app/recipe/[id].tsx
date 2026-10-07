import { SafeAreaView } from 'react-native-safe-area-context';
import { RecipeDetail } from '../../components/RecipeDetail';
import { makeStyles } from '../../styles';
import { useTheme } from '../../theme';

export default function RecipeScreen() {
  const s = makeStyles(useTheme());
  return <SafeAreaView style={s.screen}><RecipeDetail /></SafeAreaView>;
}
