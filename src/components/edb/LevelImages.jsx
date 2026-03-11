import React from 'react';
import { useEDB } from './EDBContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ImageIcon } from 'lucide-react';

const IMAGE_TYPES = [
  { key: 'icon', label: 'Icon', w: 'w-12 h-12' },
  { key: 'constructed', label: 'Constructed', w: 'w-24 h-12' },
  { key: 'construction', label: 'Under Const.', w: 'w-24 h-12' },
];

export default function LevelImages({ levelName }) {
  const { imageData } = useEDB();

  const entries = Object.entries(imageData).filter(([key]) =>
    key === levelName || key.startsWith(levelName + '_')
  );

  if (entries.length === 0) return null;

  return (
    <Card>
      <CardHeader className="p-3 pb-2">
        <CardTitle className="text-xs font-semibold flex items-center gap-1.5">
          <ImageIcon className="w-3.5 h-3.5 text-primary" />
          Building Images
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3 pt-0 space-y-3">
        {entries.map(([key, imgs]) => {
          const culture = key.startsWith(levelName + '_') ? key.slice(levelName.length + 1) : 'default';
          const hasAny = IMAGE_TYPES.some(t => imgs[t.key]);
          if (!hasAny) return null;
          return (
            <div key={key}>
              <p className="text-[10px] text-muted-foreground mb-1.5 uppercase tracking-wider font-semibold">{culture}</p>
              <div className="flex gap-3 flex-wrap">
                {IMAGE_TYPES.map(({ key: imgKey, label, w }) =>
                  imgs[imgKey] ? (
                    <div key={imgKey} className="text-center">
                      <img
                        src={imgs[imgKey]}
                        className={`${w} object-contain rounded border border-border bg-accent/30`}
                        alt={label}
                      />
                      <p className="text-[9px] text-muted-foreground mt-0.5">{label}</p>
                    </div>
                  ) : null
                )}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}