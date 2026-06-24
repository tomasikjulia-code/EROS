// Web stub dla react-native-fs.
// appendFile faktycznie dopisuje do współdzielonego webFileStore,
// dzięki czemu dane z flushBuffer() są widoczne przez expo-file-system.web.js.
import { store } from './webFileStore';

const RNFS = {
  appendFile: async (uri, data) => {
    store.set(uri, (store.get(uri) ?? '') + data);
  },
  writeFile: async (uri, data) => {
    store.set(uri, data);
  },
  readFile: async (uri) => store.get(uri) ?? '',
  exists:   async (uri) => store.has(uri),
  unlink:   async (uri) => { store.delete(uri); },
  mkdir:    async () => {},
  DocumentDirectoryPath: 'web://documents',
  ExternalDirectoryPath: 'web://documents',
  TemporaryDirectoryPath: 'web://cache',
};

export default RNFS;
