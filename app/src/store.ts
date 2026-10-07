import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'guestPantry';

// Guest pantry lives only on the device until login merges it (POST /pantry/bulk).
export async function loadGuest(): Promise<string[]> {
  try { return JSON.parse((await AsyncStorage.getItem(KEY)) ?? '[]'); } catch { return []; }
}
export const saveGuest = (names: string[]) => AsyncStorage.setItem(KEY, JSON.stringify(names)).catch(() => {});
export const clearGuest = () => AsyncStorage.removeItem(KEY).catch(() => {});
