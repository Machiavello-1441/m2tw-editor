import React from 'react';
import { useRefData } from './RefDataContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { FileText, AlertCircle } from 'lucide-react';

// Keys for a given level name and cultures
function getTextKeys(levelName) {
  return {
    title: levelName,
    desc: `${levelName}_desc`,
    desc_short: `${levelName}_desc_short`,
  };
}

function CultureEntry({ levelName, culture, textData, onChange }) {
  const descKey = `${levelName}_${culture}_desc`;
  const shortKey = `${levelName}_${culture}_desc_short`;

  return (
    <div className="space-y-1.5 p-2.5 bg-accent/20 rounded-lg border border-border">
      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">{culture}</p>
      <div>
        <Label className="text-[9px] text-muted-foreground">Description</Label>
        <Textarea
          className="text-[10px] mt-0.5 min-h-[48px] resize-y font-mono"
          value={textData[descKey] || ''}
          onChange={e => onChange(descKey, e.target.value)}
          placeholder={`${descKey}`}
        />
      </div>
      <div>
        <Label className="text-[9px] text-muted-foreground">Short Description</Label>
        <Textarea
          className="text-[10px] mt-0.5 min-h-[36px] resize-y font-mono"
          value={textData[shortKey] || ''}
          onChange={e => onChange(shortKey, e.target.value)}
          placeholder={`${shortKey}`}
        />
      </div>
    </div>
  );
}

export default function TextDescriptionEditor({ levelName }) {
  const { textData, setTextData, textDataLoaded, cultures } = useRefData();

  const keys = getTextKeys(levelName);

  const handleChange = (key, value) => {
    setTextData(prev => ({ ...prev, [key]: value }));
  };

  if (!textDataLoaded) {
    return (
      <Card>
        <CardHeader className="p-3 pb-2">
          <CardTitle className="text-xs font-semibold flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-primary" />
            Text Descriptions
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3 pt-0">
          <div className="flex items-center gap-2 p-2 rounded-lg bg-accent/30 border border-dashed border-border">
            <AlertCircle className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <p className="text-[10px] text-muted-foreground">
              Load <span className="font-mono text-foreground">export_buildings.txt</span> from the <span className="font-mono text-foreground">data\text\</span> folder on the Home page to edit descriptions.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="p-3 pb-2">
        <CardTitle className="text-xs font-semibold flex items-center gap-1.5">
          <FileText className="w-3.5 h-3.5 text-primary" />
          Text Descriptions
          <Badge variant="outline" className="text-[9px] ml-auto">export_buildings.txt</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3 pt-0 space-y-3">
        {/* Generic title/desc/short */}
        <div className="space-y-2">
          <div>
            <Label className="text-[10px] text-muted-foreground">Building Title <span className="text-[9px] font-mono opacity-60">&#123;{keys.title}&#125;</span></Label>
            <Input
              className="h-7 text-xs mt-0.5 font-mono"
              value={textData[keys.title] || ''}
              onChange={e => handleChange(keys.title, e.target.value)}
              placeholder={keys.title}
            />
          </div>
          <div>
            <Label className="text-[10px] text-muted-foreground">Generic Desc <span className="text-[9px] font-mono opacity-60">&#123;{keys.desc}&#125;</span></Label>
            <Textarea
              className="text-[10px] mt-0.5 min-h-[48px] resize-y font-mono"
              value={textData[keys.desc] || ''}
              onChange={e => handleChange(keys.desc, e.target.value)}
              placeholder="Generic description (often 'DO NOT TRANSLATE')"
            />
          </div>
          <div>
            <Label className="text-[10px] text-muted-foreground">Generic Short Desc <span className="text-[9px] font-mono opacity-60">&#123;{keys.desc_short}&#125;</span></Label>
            <Textarea
              className="text-[10px] mt-0.5 min-h-[36px] resize-y font-mono"
              value={textData[keys.desc_short] || ''}
              onChange={e => handleChange(keys.desc_short, e.target.value)}
              placeholder="Generic short description"
            />
          </div>
        </div>

        {/* Per-culture entries */}
        {cultures.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground mb-2">Culture-specific Descriptions</p>
            <div className="space-y-2">
              {cultures.map(culture => (
                <CultureEntry
                  key={culture}
                  levelName={levelName}
                  culture={culture}
                  textData={textData}
                  onChange={handleChange}
                />
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}