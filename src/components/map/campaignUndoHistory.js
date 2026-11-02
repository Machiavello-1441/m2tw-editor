import isEqual from 'lodash/isEqual';
import { captureUndoLayers, diffUndoLayers } from '@/components/map/campaignUndoLayers';
import campaignHistoryMove from '@/components/map/campaignHistoryMove';
import campaignHistoryBudget from '@/components/map/campaignHistoryBudget';
import { captureUndoStorage, comparableUndoStorage } from '@/components/map/campaignUndoStorage';
import campaignUndoLabel from '@/components/map/campaignUndoLabel';

const modelOf = ({ layers, ...model }) => model;
const flags = new Set(['dirtyLayers', 'overlayDirty']);
/** Bounded in-memory undo/redo, with inverse patches exchanged on demand. */
export default class CampaignUndoHistory {
  constructor(notify) {
    this.notify = notify;
    this.entries = [];
    this.future = [];
    this.sequence = 0;
    this.depth = 0;
    this.busy = false;
    this.baseline = null;
    this.input = null;
  }
  publish() {
    const summary = items => items.map(({ id, label, time }) => ({ id, label, time }));
    this.notify({ entries: summary(this.entries), redoEntries: summary(this.future) });
  }
  reset() {
    this.entries = []; this.future = []; this.baseline = null; this.input = null; this.depth = 0;
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
      this.future = [];
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
      campaignHistoryBudget(this.entries, this.future);
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
      const { restored, inverses } = await campaignHistoryMove(state, this.entries.slice(index).reverse());
      apply(restored);
      this.entries.splice(index);
      this.future.push(...inverses);
      campaignHistoryBudget(this.entries, this.future);
      this.baseline = null; this.input = null;
      this.publish();
    } finally { this.busy = false; }
  }
  async redo(state, apply) {
    if (this.busy || this.depth) return;
    this.record(state);
    const entry = this.future[this.future.length - 1];
    if (!entry) return;
    this.busy = true;
    try {
      const { restored, inverses } = await campaignHistoryMove(state, [entry]);
      apply(restored);
      this.future.pop(); this.entries.push(...inverses);
      campaignHistoryBudget(this.entries, this.future);
      this.baseline = null; this.input = null;
      this.publish();
    } finally { this.busy = false; }
  }
}