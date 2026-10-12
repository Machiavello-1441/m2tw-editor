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

function portraitKey(value) {
  return String(value).trim().replace(/^["']|["']$/g, '').toLowerCase().replace(/\\/g, '/')
    .replace(/^.*?custom_portraits\//, '').replace(/^\/+|\/+$/g, '').replace(/\.tga$/, '');
}

export function portraitVariants(name, portraits = {}) {
  if (!name) return [];
  const value = String(name).trim().replace(/^["']|["']$/g, '');
  if (/^(https?:\/\/|data:image\/|blob:)/i.test(value)) return [{ label: 'portrait', src: value }];
  const key = portraitKey(value);
  const images = Object.fromEntries(Object.entries(portraits).map(([path, src]) => [portraitKey(path), src]));
  const folder = key.replace(/\/portrait_(young|old|dead)$/, '');
  const variants = ['young', 'old', 'dead']
    .map(label => ({ label, src: images[`${folder}/portrait_${label}`] }))
    .filter(variant => variant.src);
  if (variants.length) return variants;
  return images[key] ? [{ label: 'portrait', src: images[key] }] : [];
}

export function portraitFor(character, portraits) {
  const variants = portraitVariants(character?.portrait, portraits);
  const preferred = character?.status === 'dead' ? 'dead' : 'young';
  return (variants.find(variant => variant.label === preferred) || variants[0])?.src || null;
}