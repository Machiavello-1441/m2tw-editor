/**
 * Shared in-memory store for uploaded banner texture previews.
 * Maps lowercase filename (without path) → object URL / data URL.
 * Using a module-level map so it survives re-renders without prop-drilling.
 */

const store = new Map();

/** Register files from a FileList or array of File objects */
export async function loadTextureFiles(files) {
  const promises = Array.from(files).map(file => {
    return new Promise(resolve => {
      // M2TW .texture files are DDS. Browsers can't decode DDS natively.
      // We create an object URL and try to display it; if the browser
      // can't show it the <img> onError handler hides it gracefully.
      const key = file.name.toLowerCase();
      const url = URL.createObjectURL(file);
      store.set(key, url);
      resolve();
    });
  });
  await Promise.all(promises);
}

/** Look up a texture path from the XML (e.g. "banners\textures\foo.texture") */
export function getTexturePreview(path) {
  if (!path) return null;
  // Extract just the filename
  const filename = path.replace(/\\/g, '/').split('/').pop().toLowerCase();
  return store.get(filename) ?? null;
}

export function getStoreSize() {
  return store.size;
}