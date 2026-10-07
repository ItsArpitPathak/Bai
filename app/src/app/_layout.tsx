import { Slot } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '../auth';

export default function Layout() {
  return <SafeAreaProvider><AuthProvider><Slot /></AuthProvider></SafeAreaProvider>;
}
