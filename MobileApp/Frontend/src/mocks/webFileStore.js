// Współdzielony in-memory store dla webowych stubów expo-file-system i react-native-fs.
// Dzięki temu initFile() (expo-fs) i flushBuffer() (RNFS.appendFile) piszą do tego samego "pliku".
export const store = new Map();
