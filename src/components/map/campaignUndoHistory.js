import isEqual from 'lodash/isEqual';
import { captureUndoLayers, diffUndoLayers, restoreUndoLayers } from '@/components/map/campaignUndoLayers';
import { captureUndoStorage, comparableUndoStorage } from '@/components/map/campaignUndoStorage';
import campaignUndoLabel from '@/components/map/campaignUndoLabel';

const modelOf = ({ layers, ...model }) => model;
const flags = new Set(['dirtyLayers', 'overlayDirty']);
const LIMIT = 50, MEMORY_LIMIT = 128 * 1024 * 1024;

/** In-memory, inverse-only history. Recording never serializes or commits a draft. */
export default class CampaignUndoHistory {
  constructor(notify) {
    this.notify = notify;
    this.entries = [];
    this.sequence = 0;
    this.depth = 0;
    this.busy = false;
    this.baseline = null;
    this.input = null;
  }
  publish() { this.notify(this.entries.map(({ id, label, time }) => ({ id, label, time }))); }
  reset() {
    this.entries = []; this.baseline = null; this.input = null; this.depth = 0;
    this.publish();
  }
  record(state, group = null) {
    if (this.busy || this.depth) return;
    const storage = captureUndoStorage(), model = modelOf(state);
    if (!this.baseline) {
      this.baseline = { model: structuredClone(model), layers: captureUndoLayers(state.layers), storage };
      this.input = state;
      return;
    }
    const before = {}, nextModel = { ...this.baseline.model };
    for (const [key, value] of Object.entries(model)) {
      if (value === this.input[key] || isEqual(value, nextModel[key])) continue;
      before[key] = nextModel[key];
      nextModel[key] = structuredClone(value);
    }
    const pixels = diffUndoLayers(this.baseline.layers, state.layers, this.input.layers, this.input.dirtyLayers !== state.dirtyLayers);
    const storageChanged = !isEqual(comparableUndoStorage(this.baseline.storage), comparableUndoStorage(storage));
    const meaningful = Object.keys(before).some(key => !flags.has(key)) || Object.keys(pixels.changes).length || storageChanged;
    if (meaningful) {
      // Always retain pre-action flags, even when only a side-file changed.
      before.dirtyLayers = this.baseline.model.dirtyLayers;
      before.overlayDirty = this.baseline.model.overlayDirty;
      const time = Date.now(), last = this.entries[this.entries.length - 1];
      const label = campaignUndoLabel(before, state, pixels.changes, { previous: this.baseline.storage, next: storage });
      if (group && last?.group === group && time - last.time < 800 && !Object.keys(pixels.changes).length && !Object.keys(last.layers).length) {
        last.before = { ...before, ...last.before }; last.time = time;
        last.bytes = JSON.stringify(last.before).length * 2;
      } else {
        const bytes = JSON.stringify(before).length * 2 + Object.values(pixels.changes).reduce((sum, patch) => sum + (patch.data?.byteLength || 0) + (patch.indices?.byteLength || 0) + (patch.values?.byteLength || 0), 0);
        this.entries.push({ id: ++this.sequence, label, time, group, before, layers: pixels.changes, storage: this.baseline.storage, bytes });
      }
      let bytes = this.entries.reduce((sum, entry) => sum + entry.bytes, 0);
      while (this.entries.length > 1 && (this.entries.length > LIMIT || bytes > MEMORY_LIMIT)) bytes -= this.entries.shift().bytes;
      this.publish();
    }
    this.baseline = { model: nextModel, layers: pixels.next, storage };
    this.input = state;
  }
  begin(state) { this.record(state); this.depth++; }
  end(state) { this.depth = Math.max(0, this.depth - 1); this.record(state); }
  async undo(index, state, apply) {
    if (this.busy || this.depth) return;
    this.record(state);
    if (index < 0 || index >= this.entries.length) return;
    this.busy = true;
    try {
      const entries = this.entries.slice(index).reverse();
      const model = { ...modelOf(state) };
      for (const entry of entries) Object.assign(model, structuredClone(entry.before));
      const layers = await restoreUndoLayers(state.layers, entries, state.dirtyLayers);
      apply({ ...model, layers, storage: entries[entries.length - 1].storage });
      this.entries.splice(index);
      this.baseline = null; this.input = null;
      this.publish();
    } finally { this.busy = false; }
  }
}