import React, { useEffect, useState } from 'react';
import WorkspaceImage from '@/components/workspace/WorkspaceImage';
import { findWorkspaceFile, getWorkspace, resolveWorkspaceFile } from '@/components/workspace/localWorkspace';
import { usePortraits } from '@/components/map/FamilyGraphCard';

export default function CharacterPortraitPreview({ name }) {
  const portraits = usePortraits();
  const folder = name.toLowerCase().replace(/\.tga$/i, '');
  const source = getWorkspace();
  const [available, setAvailable] = useState({ folder: '', paths: [], error: '' });
  useEffect(() => {
    if (!source?.root || !source.authorized) return;
    let active = true;
    const paths = ['portrait_young', 'portrait_old', 'portrait_dead'].map(variant => `ui/custom_portraits/${folder}/${variant}.tga`);
    Promise.all(paths.map(async path => await resolveWorkspaceFile(path) ? path : null))
      .then(found => { if (active) setAvailable({ folder, paths: found.filter(Boolean), error: '' }); })
      .catch(error => { if (active) setAvailable({ folder, paths: [], error: error.message }); });
    return () => { active = false; };
  }, [folder, source]);
  const variants = ['portrait_young', 'portrait_old', 'portrait_dead'].map(variant => ({
    label: variant.replace('portrait_', ''), src: portraits[`${folder}/${variant}`],
    path: `ui/custom_portraits/${folder}/${variant}.tga`,
  })).filter(variant => variant.src || findWorkspaceFile(variant.path) || available.folder === folder && available.paths.includes(variant.path));
  if (!variants.length) return <p className="text-[8px] text-muted-foreground mt-0.5 italic">{available.folder === folder && available.error ? available.error : 'No preview — connect your local mod folder or load custom portraits.'}</p>;
  return <div className="mt-1 flex gap-1">{variants.map(variant => <div key={variant.label} className="flex flex-col items-center gap-0.5">
    <WorkspaceImage paths={variant.path} fallback={variant.src} alt={variant.label} className="rounded border border-border h-20 w-16 bg-card" />
    <span className="text-[8px] text-muted-foreground">{variant.label}</span>
  </div>)}</div>;
}