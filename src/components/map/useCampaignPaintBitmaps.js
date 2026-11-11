import { useEffect, useRef } from 'react';
import campaignPaintQueue from '@/components/map/campaignPaintQueue';

/** The queue owns unpublished work; published previews may outlive this hook. */
export default function useCampaignPaintBitmaps(_layers, layersRef, setLayers) {
  const current = useRef(null);
  if (!current.current) current.current = campaignPaintQueue(layersRef, setLayers);
  const queue = current.current;
  useEffect(() => {
    queue.resume();
    return () => queue.dispose();
  }, [queue]);
  return queue;
}