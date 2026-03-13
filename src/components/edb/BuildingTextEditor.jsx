import React from 'react';
import { useEDB } from './EDBContext';
import { useRefData } from './RefDataContext';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText } from 'lucide-react';

// Single editable text field that reads/writes into textData by key
function TextEntry({ label, textKey, placeholder, multiline = false }) {
  const { textData, setTextData } = useEDB();
  const value = textData[textKey] ?? '';

  const handleChange = (e) => {
    const v = e.target.value;
    setTextData(prev => ({ ...prev, [textKey]: v }));
  };

  const baseClass =
    'w-full bg-background border border-border rounded-md text-xs text-foreground font-mono px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary resize-none';

  return (
    <div>
      <Label className="text-[10px] text-muted-foreground mb-1 block">{label}</Label>
      {multiline ? (
        <textarea
          className={`${baseClass} min-h-[56px]`}
          value={value}
          placeholder={placeholder}
          onChange={handleChange}
          rows={2}
        />
      ) : (
        <input
          className={`${baseClass} h-7`}
          value={value}
          placeholder={placeholder}
          onChange={handleChange}
        />
      )}
    </div>
  );
}

// Used in BuildingOverview — just the tree name entry
export function BuildingTreeTextEditor({ buildingName }) {
  const nameKey = `${buildingName}_name`;
  return (
    <Card>
      <CardHeader className="p-3 pb-2">
        <CardTitle className="text-xs font-semibold flex items-center gap-1.5">
          <FileText className="w-3.5 h-3.5 text-primary" />
          Building Text (export_buildings.txt)
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3 pt-0 space-y-2">
        <TextEntry
          label={`{${buildingName}_name}  —  Building tree display name`}
          textKey={nameKey}
          placeholder="e.g. Town Militia Barracks"
        />
      </CardContent>
    </Card>
  );
}

// Used in LevelEditor — title + desc + desc_short + per-culture descriptions
export function LevelTextEditor({ levelName }) {
  const { cultures } = useRefData();

  return (
    <Card>
      <CardHeader className="p-3 pb-2">
        <CardTitle className="text-xs font-semibold flex items-center gap-1.5">
          <FileText className="w-3.5 h-3.5 text-primary" />
          Level Text (export_buildings.txt)
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3 pt-0 space-y-3">
        <TextEntry
          label={`{${levelName}}  —  Level title`}
          textKey={levelName}
          placeholder="e.g. Militia Barracks"
        />
        <TextEntry
          label={`{${levelName}_desc}  —  Long description`}
          textKey={`${levelName}_desc`}
          placeholder="Shown in city/building info panel…"
          multiline
        />
        <TextEntry
          label={`{${levelName}_desc_short}  —  Short description`}
          textKey={`${levelName}_desc_short`}
          placeholder="One-line summary…"
          multiline
        />

        {cultures.length > 0 && (
          <div className="space-y-2 pt-1 border-t border-border">
            <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-widest">Per-Culture Descriptions</p>
            {cultures.map(culture => (
              <div key={culture} className="space-y-1.5 p-2 rounded-lg bg-accent/20 border border-border">
                <p className="text-[10px] font-mono text-primary/80">{culture}</p>
                <TextEntry
                  label={`{${levelName}_${culture}_desc}`}
                  textKey={`${levelName}_${culture}_desc`}
                  placeholder={`Description for ${culture} culture…`}
                  multiline
                />
                <TextEntry
                  label={`{${levelName}_${culture}_desc_short}`}
                  textKey={`${levelName}_${culture}_desc_short`}
                  placeholder={`Short description for ${culture}…`}
                  multiline
                />
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}