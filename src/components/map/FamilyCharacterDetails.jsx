import React from 'react';
import { Button } from '@/components/ui/button';

export default function FamilyCharacterDetails({ character, renderDetails, errors, onBack }) {
  return <div className="h-full min-h-0 flex flex-col">
    <div className="p-2 border-b border-border shrink-0"><Button variant="outline" size="sm" onClick={onBack}>Back to characters</Button></div>
    <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-2">
      {errors?.length > 0 && <div role="alert" className="rounded border border-destructive bg-destructive/10 p-2 text-xs text-destructive">{errors.map(error => <p key={error}>{error}</p>)}</div>}
      {renderDetails(character)}
    </div>
  </div>;
}