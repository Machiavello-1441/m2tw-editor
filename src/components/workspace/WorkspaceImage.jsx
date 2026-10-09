import React, { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import useLocalImage from '@/components/workspace/useLocalImage';

export default function WorkspaceImage({ paths, fallback, alt = '', className = '', style, placeholder = null }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  const image = useLocalImage(paths, fallback, visible);
  useEffect(() => {
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { setVisible(true); observer.disconnect(); }
    });
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  return <span ref={ref} className={`inline-flex items-center justify-center ${className}`} style={style} title={image.error || undefined}>
    {image.src ? <img src={image.src} alt={alt} className="w-full h-full object-contain" /> : image.loading ? <Loader2 className="w-3 h-3 animate-spin" aria-label="Reading image from local folder" /> : placeholder}
  </span>;
}