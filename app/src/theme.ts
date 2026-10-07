import { useColorScheme } from 'react-native';

export const light = { bg: '#FBF7F1', surface: '#FFFFFF', text: '#1F2933', muted: '#6B7280', border: '#E9E1D6', primary: '#D9480F', onPrimary: '#FFFFFF', soft: '#FFF0E6', good: '#2F9E44', warn: '#E8890C', err: '#C92A2A' };
export const dark = { bg: '#141210', surface: '#1F1C19', text: '#F4EFE8', muted: '#A39B90', border: '#322E29', primary: '#FF7A3D', onPrimary: '#1A0F08', soft: '#2B211A', good: '#51CF66', warn: '#FFA94D', err: '#FF8787' };

export const useTheme = () => (useColorScheme() === 'dark' ? dark : light);
