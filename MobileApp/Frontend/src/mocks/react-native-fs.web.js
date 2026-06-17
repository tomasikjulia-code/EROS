// Web stub for react-native-fs — native filesystem not available in browser.
// Only appendFile is used in this app (for BLE data buffering).
const RNFS = {
  appendFile: async () => {
    console.warn('[RNFS web stub] appendFile called – no-op on web');
  },
  writeFile: async () => {},
  readFile: async () => '',
  exists: async () => false,
  unlink: async () => {},
  mkdir: async () => {},
  DocumentDirectoryPath: '',
  ExternalDirectoryPath: '',
  TemporaryDirectoryPath: '',
};

export default RNFS;
