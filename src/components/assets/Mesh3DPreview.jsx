import React from 'react';
import ModelViewer from './ModelViewer';

/**
 * Thin wrapper — delegates to the full-featured ModelViewer.
 * Kept for backward compatibility with other pages that import Mesh3DPreview.
 */
export default function Mesh3DPreview({ parsedMesh, skeletonData, className = '' }) {
  return <ModelViewer parsedMesh={parsedMesh} skeletonData={skeletonData} className={className} />;
}