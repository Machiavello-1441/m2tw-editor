import { useEffect, useState } from 'react';

// Both character previews and family trees read the images loaded by Home.
export function usePortraits() {
  const read = () => ({ ...(window._m2tw_portraits || {}) });
  const [portraits, setPortraits] = useState(read);
  useEffect(() => {
    const refresh = () => setPortraits(read());
    window.addEventListener('load-portraits', refresh);
    refresh(); // Include images loaded between the first render and subscription.
    return () => window.removeEventListener('load-portraits', refresh);
  }, []);
  return portraits;
}

export function portraitVariants(name, portraits = {}) {
  if (!name) return [];
  const value = String(name).trim().replace(/^["']|["']$/g, '');
  if (/^(https?:\/\/|data:image\/|blob:)/i.test(value)) {
    return [{ label: 'portrait', src: value }];
  }
  const folder = value.toLowerCase().replace(/\\/g, '/')
    .replace(/^.*?custom_portraits\//, '')
    .replace(/^\/+|\/+$/g, '')
    .replace(/\/portrait_(young|old|dead)(\.tga)?$/, '')
    .replace(/\.tga$/, '');
  return ['young', 'old', 'dead']
    .map(label => ({ label, src: portraits[`${folder}/portrait_${label}`] }))
    .filter(variant => variant.src);
}

export function portraitFor(character, portraits) {
  return portraitVariants(character?.portrait, portraits)[0]?.src || null;
}