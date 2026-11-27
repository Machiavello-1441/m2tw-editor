import { test } from 'node:test';
import { build } from 'esbuild';
import { webcrypto } from 'node:crypto';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = path.dirname(fileURLToPath(import.meta.url));
const built = await build({ absWorkingDir: root, stdin: { resolveDir: root, contents: `
  export * from './src/components/export/exportFingerprint';
` }, bundle: true, write: false, format: 'iife', platform: 'browser', globalName: 'App', alias: { '@': path.join(root, 'src') }, resolveExtensions: ['.js', '.jsx', '.mjs', '.json'], logLevel: 'silent' });
const context = vm.createContext({ window: {}, console, TextEncoder, TextDecoder, Uint8Array, Uint8ClampedArray, ArrayBuffer, DataView, Blob, crypto: webcrypto, queueMicrotask });
vm.runInContext(built.outputFiles[0].text, context);
const a = context.App;
test('fingerprint edge cases', async () => {
  const cases = [
    ['map_regions.tga', new Uint8Array(40)],
    ['descr_regions.txt', new TextEncoder().encode('garbage without colours\n')],
    ['descr_win_conditions.txt', new TextEncoder().encode('nonsense\n')],
    ['imperial_campaign_regions_and_settlement_names.txt', new TextEncoder().encode('{broken')],
    ['descr_strat.txt', new TextEncoder().encode('\u0000\u0001 weird')],
    ['descr_faction_movies.xml', new TextEncoder().encode('<broken')],
    ['descr_disasters.txt', new TextEncoder().encode('??')],
  ];
  for (const [name, bytes] of cases) {
    try { await a.exportFingerprint(`data/x/${name}`, bytes); console.log(name, 'ok'); }
    catch (error) { console.log(name, 'THREW:', error.message); }
  }
});
