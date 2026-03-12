import React from 'react';
import { AlertTriangle, AlertCircle, Info, CheckCircle2, X } from 'lucide-react';
import { useCampaignMap } from './CampaignMapContext';
import { LAYER_DEFS } from './MapLayerDefs';
import { ScrollArea } from '@/components/ui/scroll-area';

const icons = {
  error:   <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />,
  warning: <AlertTriangle className="w-3.5 h-3.5 text-yellow-400 shrink-0 mt-0.5" />,
  info:    <Info className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />,
  success: <CheckCircle2 className="w-3.5 h-3.5 text-green-400 shrink-0 mt-0.5" />,
};

const bg = {
  error:   'bg-red-500/10 border-red-500/20',
  warning: 'bg-yellow-500/10 border-yellow-500/20',
  info:    'bg-blue-500/10 border-blue-500/20',
  success: 'bg-green-500/10 border-green-500/20',
};

export default function CampaignValidationPanel({ onClose }) {
  const { validationResults } = useCampaignMap();

  if (!validationResults) return null;

  const errors = validationResults.filter(r => r.severity === 'error').length;
  const warnings = validationResults.filter(r => r.severity === 'warning').length;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold">Validation Results</span>
          {errors > 0 && <span className="px-1.5 py-0.5 rounded text-[10px] bg-red-500/20 text-red-400">{errors} error{errors > 1 ? 's' : ''}</span>}
          {warnings > 0 && <span className="px-1.5 py-0.5 rounded text-[10px] bg-yellow-500/20 text-yellow-400">{warnings} warning{warnings > 1 ? 's' : ''}</span>}
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1.5">
          {validationResults.map((r, i) => (
            <div key={i} className={`flex gap-2 p-2 rounded border text-xs ${bg[r.severity]}`}>
              {icons[r.severity]}
              <div>
                {r.layer !== 'all' && (
                  <span className="font-mono text-[10px] text-muted-foreground mr-1">
                    [{LAYER_DEFS[r.layer]?.filename || r.layer}]
                  </span>
                )}
                {r.message}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}