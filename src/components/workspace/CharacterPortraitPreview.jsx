import React from 'react';
import WorkspaceImage from '@/components/workspace/WorkspaceImage';
import { findWorkspaceFile } from '@/components/workspace/localWorkspace';
import { usePortraits } from '@/components/map/FamilyGraphCard';

export default function CharacterPortraitPreview({ name }) {
  const portraits = usePortraits();
  const folder = name.toLowerCase().replace(/\.tga$/i, '');
  const variants = ['portrait_young', 'portrait_old', 'portrait_dead'].map(variant => ({
    label: variant.replace('portrait_', ''), src: portraits[`${folder}/${variant}`],
    path: `ui/custom_portraits/${folder}/${variant}.tga`,
  })).filter(variant => variant.src || findWorkspaceFile(variant.path));
  if (!variants.length) return <p className="text-[8px] text-muted-foreground mt-0.5 italic">No preview — connect your local mod folder or load custom portraits.</p>;
  return <div className="mt-1 flex gap-1">{variants.map(variant => <div key={variant.label} className="flex flex-col items-center gap-0.5">
    <WorkspaceImage paths={variant.path} fallback={variant.src} alt={variant.label} className="rounded border border-border h-20 w-16 bg-card" />
    <span className="text-[8px] text-muted-foreground">{variant.label}</span>
  </div>)}</div>;
}