import { test } from 'node:test';
import { build } from 'esbuild';
import { webcrypto } from 'node:crypto';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = path.dirname(fileURLToPath(import.meta.url));
const built = await build({ absWorkingDir: root, stdin: { resolveDir: root, contents: `
  export * from './src/components/export/exportFingerprint';
  export * from './src/components/strings/stringsBinCodec';
` }, bundle: true, write: false, format: 'iife', platform: 'browser', globalName: 'App', alias: { '@': path.join(root, 'src') }, resolveExtensions: ['.js', '.jsx', '.mjs', '.json'], logLevel: 'silent' });
const context = vm.createContext({ window: {}, console, TextEncoder, TextDecoder, Uint8Array, Uint8ClampedArray, ArrayBuffer, DataView, Blob, crypto: webcrypto, queueMicrotask });
vm.runInContext(built.outputFiles[0].text, context);
const a = context.App;
test('fingerprint of a bogus strings bin', async () => {
  try {
    const hash = await a.exportFingerprint('data/text/some_mod_file.txt.strings.bin', new Uint8Array([1,2,3,4,5,6,7,8,9]));
    console.log('no throw, hash', hash.slice(0, 8));
  } catch (error) {
    console.log('THREW:', error.message);
  }
  try {
    const parsed = a.parseStringsBin(new Uint8Array([1,2,3,4,5,6,7,8,9]));
    console.log('parseStringsBin returned', parsed && parsed.trailerKind);
  } catch (error) {
    console.log('parseStringsBin THREW:', error.message);
  }
});
