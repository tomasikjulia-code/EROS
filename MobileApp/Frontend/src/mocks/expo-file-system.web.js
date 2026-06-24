// Web stub dla expo-file-system/legacy.
// Rejestrowany przez metro.config.js przy platform === 'web'.
// Dane trzymane w pamięci (webFileStore) – współdzielone z react-native-fs.web.js.

import { store } from './webFileStore';

export const documentDirectory = 'web://documents/';
export const cacheDirectory    = 'web://cache/';

export const EncodingType = {
  UTF8:   'utf8',
  Base64: 'base64',
};

export async function getInfoAsync(uri) {
  const content = store.get(uri);
  return {
    exists: content !== undefined,
    size:   content ? content.length : 0,
    uri,
    isDirectory: false,
  };
}

export async function readAsStringAsync(uri) {
  return store.get(uri) ?? '';
}

export async function writeAsStringAsync(uri, content) {
  store.set(uri, content);
}

export async function deleteAsync(uri) {
  store.delete(uri);
}

export async function copyAsync({ from, to }) {
  store.set(to, store.get(from) ?? '');
}

export async function makeDirectoryAsync() {}

// Expo FS eksportuje też obiekt domyślny — niektóre miejsca go używają
export default {
  documentDirectory,
  cacheDirectory,
  EncodingType,
  getInfoAsync,
  readAsStringAsync,
  writeAsStringAsync,
  deleteAsync,
  copyAsync,
  makeDirectoryAsync,
};
