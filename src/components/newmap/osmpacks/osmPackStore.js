let database;
function openDatabase() {
  if (!database) database = new Promise((resolve, reject) => {
    const request = indexedDB.open('m2tw-osm-regional-packs', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('maps');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => { database = null; reject(request.error); };
  });
  return database;
}
export default async function osmPackStore(action, key, value) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('maps', action === 'get' ? 'readonly' : 'readwrite');
    const store = transaction.objectStore('maps');
    const request = action === 'get' ? store.get(key) : action === 'delete' ? store.delete(key) : store.put(value, key);
    transaction.oncomplete = () => resolve(request.result);
    transaction.onerror = () => reject(transaction.error || request.error);
    transaction.onabort = () => reject(transaction.error || new Error('Local storage was interrupted.'));
  });
}