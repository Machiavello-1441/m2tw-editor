import { useEffect, useState } from 'react';
import { findWorkspaceFile } from '@/components/workspace/localWorkspace';
import { decodeTgaToDataUrl } from '@/components/shared/tgaDecoder';

const pending = new Map();
async function readImage(entry) {
  if (!pending.has(entry.path)) pending.set(entry.path, (async () => {
    const file = await entry.handle.getFile();
    if (/\.tga$/i.test(file.name)) return decodeTgaToDataUrl(await file.arrayBuffer());
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  })().finally(() => pending.delete(entry.path)));
  return pending.get(entry.path);
}
export default function useLocalImage(paths, fallback, enabled = true) {
  const key = JSON.stringify(Array.isArray(paths) ? paths : [paths]);
  const [image, setImage] = useState({ key: '', src: null, loading: false, error: '' });
  useEffect(() => {
    let active = true;
    if (!enabled || fallback) return;
    const entry = JSON.parse(key).map(findWorkspaceFile).find(Boolean);
    if (!entry) return;
    setImage({ key, src: null, loading: true, error: '' });
    readImage(entry).then(src => { if (active) setImage({ key, src, loading: false, error: src ? '' : 'Unsupported image format' }); })
      .catch(error => { if (active) setImage({ key, src: null, loading: false, error: error.message }); });
    return () => { active = false; };
  }, [key, fallback, enabled]);
  return fallback ? { src: fallback, loading: false, error: '' } : image.key === key ? image : { src: null, loading: false, error: '' };
}