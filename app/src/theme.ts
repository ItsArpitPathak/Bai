import { useColorScheme } from 'react-native';

export const light = { bg: '#FFF4E0', surface: '#FFFFFF', text: '#2B1B14', muted: '#7A5C4D', border: '#FFD9A8', primary: '#E8480F', onPrimary: '#FFFFFF', soft: '#FFE1CC', good: '#0B8F47', onGood: '#FFFFFF', warn: '#D9730D', err: '#D6264B' };
export const dark = { bg: '#1E1033', surface: '#2D1B4E', text: '#FFF4E8', muted: '#C9B8E8', border: '#4A3377', primary: '#FF8A3D', onPrimary: '#2A1000', soft: '#43285F', good: '#4ADE80', onGood: '#06220F', warn: '#FFC14D', err: '#FF7A93' };

export const useTheme = () => (useColorScheme() === 'dark' ? dark : light);
