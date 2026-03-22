import React from 'react';
import ModelViewer from './ModelViewer';

export default function Mesh3DPreview({ parsedMesh, skeletonData, className = '' }) {
  return <ModelViewer parsedMesh={parsedMesh} skeletonData={skeletonData} className={className} />;
}