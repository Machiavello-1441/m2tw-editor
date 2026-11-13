/**
 * In-memory store for the parsed battle_models.modeldb.
 * Uses a custom event to notify components when the data changes.
 */
import { getFile, setFile } from '@/lib/bigFileStore';
import { parseModeldb, serializeModeldb } from '@/lib/modeldbCodec';

let _data = null, _raw;

export const modeldbStore = {
  get: () => {
    const raw = getFile('m2tw_modeldb_file');
    if (raw !== _raw) { _data = raw ? parseModeldb(raw) : null; _raw = raw; }
    return _data;
  },
  set: (data, raw = getFile('m2tw_modeldb_file')) => {
    _data = data; _raw = raw;
    if (raw !== null) setFile('m2tw_modeldb_file', raw);
    window.dispatchEvent(new CustomEvent('modeldb-loaded', { detail: data }));
  },
  update: (updatedParsed) => {
    _data = updatedParsed; _raw = serializeModeldb(updatedParsed);
    setFile('m2tw_modeldb_file', _raw);
    window.dispatchEvent(new CustomEvent('modeldb-loaded', { detail: updatedParsed }));
  },
  clear: () => {
    _data = null; _raw = getFile('m2tw_modeldb_file');
    window.dispatchEvent(new CustomEvent('modeldb-loaded', { detail: null }));
  },
};