import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'esbuild';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import vm from 'node:vm';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const compiled = await build({
  absWorkingDir: root,
  stdin: { resolveDir: root, sourcefile: 'recovery-controller-regression.js', contents: `
    export { default as CampaignRecoveryController } from './src/components/map/CampaignRecoveryController';
    export * from './src/components/map/campaignRecoveryInputs';
  ` },
  bundle: true, write: false, format: 'iife', platform: 'browser', globalName: 'RecoveryTest',
  alias: { '@': path.join(root, 'src') }, logLevel: 'silent',
  plugins: [{ name: 'isolate-recovery-storage', setup(builder) {
    builder.onResolve({ filter: /campaignRecoveryStore$/ }, () => ({ path: 'recovery-storage', namespace: 'mock' }));
    builder.onLoad({ filter: /.*/, namespace: 'mock' }, () => ({ contents: 'export const persistCampaignRecovery = (...args) => globalThis.persistRecovery(...args);', loader: 'js' }));
  } }],
});
function runtime() {
  const timers = new Map(), writes = [];
  let timerId = 0, timestamp = 10, persist = async () => ({ recoveryAt: ++timestamp });
  const context = vm.createContext({
    console, Date,
    setTimeout: fn => { const id = ++timerId; timers.set(id, fn); return id; },
    clearTimeout: id => timers.delete(id),
    persistRecovery: (...args) => { writes.push(args); return persist(...args); },
  });
  vm.runInContext(compiled.outputFiles[0].text, context);
  const draft = { enabled: true, ready: true, library: {}, id: 'campaign', snapshot: { value: 0 } };
  return { a: context.RecoveryTest, timers, writes, draft, setPersist: fn => { persist = fn; } };
}

test('Repeated paint changes notify pending once, rather than dispatching a no-op state update per render', async () => {
  const r = runtime(), notifications = [];
  const writer = new r.a.CampaignRecoveryController(() => r.draft, status => notifications.push(status));
  for (let i = 0; i < 100; i++) {
    r.draft.snapshot = { value: i };
    writer.changed();
  }
  assert.equal(writer.revision, 100);
  assert.equal(notifications.length, 1);
  assert.equal(notifications[0].pending, true);
  assert.equal(r.timers.size, 1);
  await writer.flush();
  assert.equal(r.writes.length, 1);
  assert.equal(r.writes[0][2].value, 99);
  assert.equal(writer.durable, 100);
  assert.equal(notifications.length, 2);
  assert.equal(notifications[1].pending, false);
});

test('A status-triggered observation cannot recurse into maximum update depth', () => {
  const r = runtime();
  let writer, notifications = 0;
  writer = new r.a.CampaignRecoveryController(() => r.draft, () => {
    notifications++;
    if (notifications > 50) throw new Error('Maximum update depth exceeded');
    // Stress the exact dispatch -> render/observation -> changed path in the report.
    writer.changed();
  });
  assert.doesNotThrow(() => writer.changed());
  assert.equal(notifications, 1);
  assert.equal(writer.status.pending, true);
  assert.equal(r.timers.size, 1);
});

test('Edits during a save stay pending and are included in the next serialized save', async () => {
  const r = runtime(), notifications = [];
  let finish;
  r.setPersist(() => new Promise(resolve => { finish = resolve; }));
  const writer = new r.a.CampaignRecoveryController(() => r.draft, status => notifications.push(status));
  writer.changed();
  const first = writer.flush();
  r.draft.snapshot = { value: 2 };
  for (let i = 0; i < 50; i++) writer.changed();
  assert.equal(notifications.length, 1);
  finish({ recoveryAt: 20 }); await first;
  assert.equal(writer.status.pending, true);
  assert.equal(writer.durable, 1);
  r.setPersist(async () => ({ recoveryAt: 21 }));
  await writer.flush();
  assert.equal(writer.status.pending, false);
  assert.equal(writer.durable, 51);
  assert.equal(r.writes.length, 2);
  assert.equal(r.writes[1][2].value, 2);
});

test('Repeated save failures do not repeatedly dispatch the same error or lose the draft', async () => {
  const r = runtime(), notifications = [];
  r.setPersist(async () => { throw new Error('Storage temporarily unavailable'); });
  const writer = new r.a.CampaignRecoveryController(() => r.draft, status => notifications.push(status));
  writer.changed();
  assert.equal(await writer.flush(), false);
  assert.equal(await writer.flush(), false);
  assert.equal(notifications.length, 2);
  assert.equal(writer.status.pending, true);
  assert.match(writer.status.error, /Storage temporarily unavailable/);
  assert.equal(writer.durable, 0);
  assert.equal(r.draft.snapshot.value, 0);
  r.setPersist(async () => ({ recoveryAt: 30 }));
  assert.equal(await writer.flush(), true);
  assert.equal(writer.status.pending, false);
  assert.equal(writer.status.error, '');
});

test('Painting revisions are observed, but status renders and GPU-only refreshes are not edits', () => {
  const { a } = runtime();
  const pixels = new Uint8ClampedArray(4);
  const snapshot = { layers: { regions: { data: pixels, width: 1, height: 1, bitmap: {} } }, dirtyLayers: new Set(), overlayDirty: false, paintState: { active: true } };
  const baseline = a.captureRecoveryInputs(snapshot, 'campaign', true);
  assert.equal(a.sameRecoveryInputs(baseline, a.captureRecoveryInputs({ ...snapshot }, 'campaign', true)), true);
  const gpuRefresh = { ...snapshot, layers: { regions: { ...snapshot.layers.regions, bitmap: {} } } };
  assert.equal(a.sameRecoveryInputs(baseline, a.captureRecoveryInputs(gpuRefresh, 'campaign', true)), true);
  pixels[0] = 100;
  const painted = { ...snapshot, dirtyLayers: new Set(['regions']) };
  assert.equal(a.sameRecoveryInputs(baseline, a.captureRecoveryInputs(painted, 'campaign', true)), false);
});

test('Recovery status observations run after commit, never as synchronous layout work', () => {
  const hook = readFileSync(path.join(root, 'src/components/map/useCampaignRecovery.js'), 'utf8');
  assert.doesNotMatch(hook, /useLayoutEffect/);
  assert.match(hook, /observed\.current = next;\s+controller\.current\.changed\(\)/);
});