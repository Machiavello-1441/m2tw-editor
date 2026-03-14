import { useEffect, useRef, useCallback } from 'react';

const DB_NAME = 'M2TWModEditor';
const STORE_NAME = 'edbSnapshots';
const MAX_SNAPSHOTS = 20;
const AUTOSAVE_INTERVAL_MS = 30_000; // 30 seconds

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveSnapshot(edbData, textData, fileName) {
  if (!edbData) return;
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);

  // Add new snapshot
  store.add({
    timestamp: Date.now(),
    fileName,
    edbData: JSON.parse(JSON.stringify(edbData)),
    textData: JSON.parse(JSON.stringify(textData)),
  });

  // Prune old snapshots beyond MAX_SNAPSHOTS
  const countReq = store.count();
  countReq.onsuccess = () => {
    const count = countReq.result;
    if (count > MAX_SNAPSHOTS) {
      const cursorReq = store.openCursor();
      let toDelete = count - MAX_SNAPSHOTS;
      cursorReq.onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor && toDelete > 0) {
          cursor.delete();
          toDelete--;
          cursor.continue();
        }
      };
    }
  };

  return new Promise((resolve, reject) => {
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}

export async function listSnapshots() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const idx = store.index('timestamp');
    const req = idx.getAll();
    req.onsuccess = () => resolve([...req.result].reverse()); // newest first
    req.onerror = () => reject(req.error);
  });
}

export async function getSnapshot(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(id);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteSnapshot(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}

export function useEDBAutoSave(edbData, textData, fileName) {
  const lastSavedRef = useRef(null);

  const doSave = useCallback(async () => {
    if (!edbData) return;
    const serialized = JSON.stringify(edbData);
    if (serialized === lastSavedRef.current) return; // no changes since last save
    await saveSnapshot(edbData, textData, fileName);
    lastSavedRef.current = serialized;
  }, [edbData, textData, fileName]);

  // Periodic auto-save
  useEffect(() => {
    if (!edbData) return;
    const timer = setInterval(doSave, AUTOSAVE_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [doSave, edbData]);

  // Save on unmount / navigation away
  useEffect(() => {
    return () => {
      if (edbData) doSave();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [edbData]);

  return { saveNow: doSave };
}