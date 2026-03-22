import React from 'react';
import ModelViewer from './ModelViewer';

export default function Mesh3DPreview({ parsedMesh, joints, className = '' }) {
  return <ModelViewer parsedMesh={parsedMesh} joints={joints} className={className} />;
}