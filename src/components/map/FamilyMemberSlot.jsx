import React from 'react';

export default function FamilyMemberSlot({ request, node, forest, onClick }) {
  const parent = request.kind === 'parent', spouse = request.kind === 'spouse';
  const x = spouse ? forest.width + 24 : node.x;
  const y = parent ? 0 : spouse ? node.y : forest.height + 20;
  const startX = node.x + (spouse ? 116 : 58), startY = node.y + (parent ? 100 : 0) + (parent ? 0 : spouse ? 32 : 64);
  const endX = x + (spouse ? 0 : 58), endY = y + (parent ? 64 : spouse ? 32 : 0);
  return <>
    <svg aria-hidden="true" className="absolute inset-0 w-full h-full pointer-events-none text-primary"><path d={`M${startX} ${startY} L${endX} ${endY}`} stroke="currentColor" strokeDasharray="4 4" fill="none" /></svg>
    <button type="button" onClick={onClick} style={{ left: x, top: y, width: 116, height: 64 }} className="absolute rounded border-2 border-dashed border-primary bg-card p-1 text-xs text-foreground text-center">
      <strong className="block">New {request.label || 'child'}</strong>
      <span className="block text-[9px] text-muted-foreground">Click to select or create</span>
    </button>
  </>;
}