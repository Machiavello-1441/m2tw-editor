/** A game path has one authoritative entry, even if originals use different casing. */
export function removeZipFile(folder, path) {
  const target = `${folder.root || ''}${path}`.replace(/\\/g, '/').toLowerCase();
  for (const name of Object.keys(folder.files)) {
    if (name.replace(/\\/g, '/').toLowerCase() === target) folder.remove(name.slice((folder.root || '').length));
  }
}
export function writeLatestZipFile(folder, path, content) {
  removeZipFile(folder, path);
  folder.file(path, content);
}