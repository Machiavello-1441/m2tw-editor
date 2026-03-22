import React from 'react';
import ModelViewer from './ModelViewer';

export default function Mesh3DPreview({ parsedMesh, joints, skeletonData, className = '' }) {
  // Accept either joints array or skeletonData object
  const skelData = skeletonData || (joints ? { joints } : null);
  return <ModelViewer parsedMesh={parsedMesh} skeletonData={skelData} className={className} />;
}