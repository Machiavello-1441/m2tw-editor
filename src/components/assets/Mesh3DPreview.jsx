import React from 'react';
import ModelViewer from './ModelViewer';

/**
 * Legacy wrapper — delegates to the full ModelViewer.
 * Kept for backward compatibility with any code importing Mesh3DPreview.
 */
export default function Mesh3DPreview({ parsedMesh, skeletonData, className = '' }) {
  return <ModelViewer parsedMesh={parsedMesh} skeletonData={skeletonData} className={className} />;
}