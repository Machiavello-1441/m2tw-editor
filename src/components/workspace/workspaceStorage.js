const DB = 'm2tw-local-workspace';
export async function workspaceSetting(key, value) {
  const db = await new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('settings');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('settings', value === undefined ? 'readonly' : 'readwrite');
    const store = transaction.objectStore('settings');
    const request = value === undefined ? store.get(key) : store.put(value, key);
    let result;
    request.onsuccess = () => { result = request.result; };
    transaction.oncomplete = () => { db.close(); resolve(result); };
    transaction.onerror = () => { db.close(); reject(transaction.error); };
  });
}
export function clearEditorCaches() {
  for (const storage of [localStorage, sessionStorage]) {
    Object.keys(storage).filter(key => key.startsWith('m2tw_') && key !== 'm2tw_mod_name').forEach(key => storage.removeItem(key));
  }
}