import { Slot } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '../auth';
import { ListsProvider } from '../lists';

export default function Layout() {
  return <SafeAreaProvider><AuthProvider><ListsProvider><Slot /></ListsProvider></AuthProvider></SafeAreaProvider>;
}
