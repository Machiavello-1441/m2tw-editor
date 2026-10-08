import React from 'react';

export default function FamilyGraphLines({ forest }) {
  return <svg className="absolute inset-0 pointer-events-none" width={forest.width} height={forest.height} style={{ overflow: 'visible' }}>
    {forest.edges.map((edge, index) => {
      const sex = edge.sex;
      const color = sex === 'female' ? 'text-pink-400' : sex === 'male' ? 'text-sky-400' : 'text-muted-foreground';
      return <g key={index} className={color}>
        <path d={edge.d} stroke="currentColor" strokeWidth={sex ? 2.5 : 1.5} strokeDasharray={sex === 'female' ? '5 3' : undefined} fill="none" />
        {sex && <><circle cx={edge.x} cy={edge.y} r="3" fill="currentColor" /><text x={edge.x + 5} y={edge.y - 6} fill="currentColor" fontSize="10">{sex === 'female' ? '♀ Daughter' : '♂ Son'}</text></>}
      </g>;
    })}
  </svg>;
}