const LIMIT = 50, MEMORY_LIMIT = 32 * 1024 * 1024;
export function historyEntryBytes(entry) {
  return JSON.stringify(entry.before).length * 2 + Object.values(entry.layers).reduce((sum, patch) =>
    sum + (patch.data?.byteLength || 0) + (patch.indices?.byteLength || 0) + (patch.values?.byteLength || 0), 0);
}
export default function campaignHistoryBudget(entries, future) {
  let bytes = [...entries, ...future].reduce((sum, entry) => sum + (entry.bytes = historyEntryBytes(entry)), 0);
  while (entries.length + future.length > LIMIT || bytes > MEMORY_LIMIT) {
    const removed = entries.length ? entries.shift() : future.shift();
    if (!removed) break;
    bytes -= removed.bytes;
  }
}