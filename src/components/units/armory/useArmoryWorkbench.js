import { useEffect, useMemo, useState } from 'react';
import { editorStorage } from '@/lib/editorStorage';
import { getFolderIndex, indexFolder, loadFolderModeldb } from '@/lib/modFolderStore';
import { modeldbStore } from '@/lib/modeldbStore';
import { loadArmorySource, initialArmoryParts } from '@/components/units/armory/armoryModelIO';
import armoryGeometry from '@/components/units/armory/armoryGeometry';
import armoryExport from '@/components/units/armory/armoryExport';

export default function useArmoryWorkbench(unit, modeldb) {
  const [db, setDb] = useState(modeldb || modeldbStore.get()), [folder, setFolder] = useState(getFolderIndex);
  const [sources, setSources] = useState({}), [parts, setParts] = useState([]), [selected, setSelected] = useState('');
  const [name, setName] = useState(`${unit.type || 'unit'} variation`), [busy, setBusy] = useState(false), [error, setError] = useState(''), [status, setStatus] = useState('');
  const key = `m2tw_armory_${unit.dictionary || unit.type}`;
  useEffect(() => { if (modeldb) setDb(modeldb); }, [modeldb]);
  useEffect(() => {
    const changed = event => setDb(event.detail), indexed = event => setFolder(event.detail);
    window.addEventListener('modeldb-loaded', changed); window.addEventListener('mod-folder-indexed', indexed);
    return () => { window.removeEventListener('modeldb-loaded', changed); window.removeEventListener('mod-folder-indexed', indexed); };
  }, []);
  const run = async action => {
    setBusy(true); setError(''); setStatus('');
    try { await action(); } catch (err) { setError(err.message); } finally { setBusy(false); }
  };
  const add = descriptor => run(async () => {
    const source = await loadArmorySource(db, descriptor);
    if (sources[source.id]) { setStatus('This model and skin are already in the assembly.'); return; }
    const added = initialArmoryParts(source);
    setSources(previous => ({ ...previous, [source.id]: source })); setParts(previous => [...previous, ...added]); setSelected(added[0]?.id || '');
  });
  const recipe = () => ({ version: 1, name, unit: unit.type, sources: Object.values(sources).map(source => source.descriptor), parts });
  const restore = () => run(async () => {
    const raw = editorStorage.getItem(key);
    if (!raw) throw new Error('No saved assembly for this unit yet.');
    const saved = JSON.parse(raw), loaded = await Promise.all(saved.sources.map(descriptor => loadArmorySource(db, descriptor)));
    const next = Object.fromEntries(loaded.map(source => [source.id, source]));
    if (saved.parts.some(part => !next[part.source]?.parsed.meshes[part.group])) throw new Error('A source model has changed; its saved parts no longer match.');
    setName(saved.name); setSources(next); setParts(saved.parts); setSelected(saved.parts[0]?.id || ''); setStatus('Saved assembly restored.');
  });
  const geometry = useMemo(() => armoryGeometry(parts, sources), [parts, sources]);
  return { db, folder, sources, parts, selected, name, busy, error, status, geometry, setName, setParts, setSelected, add, restore,
    pick: files => run(async () => { const indexed = indexFolder(files); setFolder(indexed); const loaded = await loadFolderModeldb(indexed); if (loaded) setDb(loaded); }),
    save: () => run(async () => { editorStorage.setItem(key, JSON.stringify(recipe())); setStatus('Assembly recipe saved in this browser. Re-pick the mod folder after reopening, then Restore saved.'); }),
    exportDraft: () => run(async () => { await armoryExport(name, geometry, recipe(), sources); setStatus('Geometry draft exported. Rigging and game-format conversion are still required.'); }),
    remove: id => { setParts(previous => previous.filter(part => part.source !== id)); setSources(previous => { const next = { ...previous }; delete next[id]; return next; }); },
  };
}