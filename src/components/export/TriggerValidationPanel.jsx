import React, { useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, ChevronDown, ChevronRight, Zap, Info } from 'lucide-react';
import { parseTraitsFile } from '../traits/TraitsParser';
import { parseAncillariesFile } from '../ancillaries/AncillariesParser';

const VALID_WHEN_TO_TEST = [
  'PostBattle', 'PreBattle', 'GovernorTurnStart', 'GovernorTurnEnd',
  'CharacterTurnStart', 'CharacterTurnEnd', 'CharacterComesOfAge',
  'OnCharacterMarries', 'OnCharacterBecomesGeneral', 'OnCharacterBecomesAdmiral',
  'OnCharacterBecomesGovernor', 'OnCharacterBecomesAssassin', 'OnCharacterBecomesSpy',
  'OnCharacterBecomesDiplomat', 'OnCharacterBecomesHeretic', 'OnCharacterBecomesWitch',
  'OnCharacterBecomesInquisitor', 'OnCharacterBecomesPriest', 'OnCharacterBecomesMerchant',
  'OnCharacterComesOfAge', 'OnCharacterDies', 'ScriptedEvent', 'DoesSomething',
  'OfferedForAdoption', 'OfferedForMarriage', 'BattleGeneralRouted', 'GeneralAssaultsGeneral',
  'PreBattleWithdrawal', 'LeaderDestroyedFaction', 'CharacterDamagedByDisaster', 'BrotherAdopted',
  'CharacterMarries', 'CharacterMarriesPrincess', 'CharacterBecomesAFather', 'SpyMission',
  'LeaderOrderedSpyingMisssion', 'AssassinationMission', 'LeaderOrderedAssassination',
  'SufferAssassinationAttempt', 'SabotageMission', 'LeaderOrderedSabotage',
];

const VALID_CONDITION_PREFIXES = [
  'Condition', 'and', 'or',
];

function validateTrigger(trigger, traitNames, ancNames, mode) {
  const issues = [];

  // 1. Name must not be empty
  if (!trigger.name || trigger.name.trim() === '') {
    issues.push({ severity: 'error', msg: 'Trigger has no name.', fix: 'Give the trigger a unique name.' });
  }

  // 2. WhenToTest must be valid
  if (!trigger.whenToTest || trigger.whenToTest.trim() === '') {
    issues.push({ severity: 'error', msg: 'Missing WhenToTest value.', fix: 'Set a valid WhenToTest event (e.g. PostBattle, CharacterTurnStart).' });
  } else if (!VALID_WHEN_TO_TEST.includes(trigger.whenToTest.trim())) {
    issues.push({
      severity: 'warning',
      msg: `Unknown WhenToTest: "${trigger.whenToTest}".`,
      fix: `Valid values include: ${VALID_WHEN_TO_TEST.slice(0, 5).join(', ')}…`,
    });
  }

  // 3. Conditions must start with valid prefix
  for (const cond of trigger.conditions || []) {
    const trimmed = cond.trim();
    if (!trimmed) {
      issues.push({ severity: 'warning', msg: 'Empty condition line.', fix: 'Remove the empty condition or fill it in.' });
      continue;
    }
    const firstWord = trimmed.split(/\s+/)[0];
    if (!VALID_CONDITION_PREFIXES.includes(firstWord)) {
      issues.push({
        severity: 'error',
        msg: `Condition line starts with invalid keyword "${firstWord}".`,
        fix: `Condition lines must start with "Condition", "and", or "or". Got: "${trimmed}"`,
      });
    }
  }

  // 4. Trait mode: affects must reference known trait names
  if (mode === 'trait' && traitNames.size > 0) {
    for (const aff of trigger.affects || []) {
      if (!aff.trait || aff.trait.trim() === '') {
        issues.push({ severity: 'error', msg: 'Affects entry has no trait name.', fix: 'Set a trait name for this Affects entry.' });
      } else if (!traitNames.has(aff.trait.trim())) {
        issues.push({
          severity: 'error',
          msg: `Affects references unknown trait "${aff.trait}".`,
          fix: `No trait named "${aff.trait}" was found. Check the name or create the trait.`,
        });
      }
      if (aff.chance < 0 || aff.chance > 100) {
        issues.push({ severity: 'warning', msg: `Affects chance ${aff.chance} is outside 0–100.`, fix: 'Set chance between 0 and 100.' });
      }
    }
    if ((trigger.affects || []).length === 0) {
      issues.push({ severity: 'warning', msg: 'Trigger has no Affects entries.', fix: 'Add at least one Affects entry with a trait name and value.' });
    }
  }

  // 5. Ancillary mode: acquireAncillary must reference known ancillary
  if (mode === 'ancillary') {
    if (!trigger.acquireAncillary || !trigger.acquireAncillary.name) {
      issues.push({ severity: 'error', msg: 'Trigger has no AcquireAncillary target.', fix: 'Set an ancillary name in the AcquireAncillary field.' });
    } else if (ancNames.size > 0 && !ancNames.has(trigger.acquireAncillary.name.trim())) {
      issues.push({
        severity: 'error',
        msg: `AcquireAncillary references unknown ancillary "${trigger.acquireAncillary.name}".`,
        fix: `No ancillary named "${trigger.acquireAncillary.name}" was found. Check the name or create the ancillary.`,
      });
    }
    const chance = trigger.acquireAncillary?.chance;
    if (chance != null && (chance < 0 || chance > 100)) {
      issues.push({ severity: 'warning', msg: `AcquireAncillary chance ${chance} is outside 0–100.`, fix: 'Set chance between 0 and 100.' });
    }
  }

  return issues;
}

function useValidationData() {
  return useMemo(() => {
    let traitsData = null;
    let ancData = null;
    try {
      const tc = localStorage.getItem('m2tw_traits_file');
      if (tc) traitsData = parseTraitsFile(tc);
    } catch {}
    try {
      const ac = localStorage.getItem('m2tw_anc_file');
      if (ac) ancData = parseAncillariesFile(ac);
    } catch {}
    return { traitsData, ancData };
  }, []);
}

function IssueRow({ issue }) {
  const isError = issue.severity === 'error';
  return (
    <div className={`flex gap-2 rounded px-2.5 py-1.5 text-xs ${isError ? 'bg-destructive/10' : 'bg-yellow-500/10'}`}>
      <AlertCircle className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${isError ? 'text-destructive' : 'text-yellow-400'}`} />
      <div className="min-w-0">
        <p className={`font-medium ${isError ? 'text-destructive' : 'text-yellow-300'}`}>{issue.msg}</p>
        <p className="text-muted-foreground text-[10px] mt-0.5 flex items-start gap-1">
          <Info className="w-2.5 h-2.5 shrink-0 mt-0.5" /> {issue.fix}
        </p>
      </div>
    </div>
  );
}

function TriggerRow({ trigger, issues, mode }) {
  const [open, setOpen] = useState(false);
  const errorCount = issues.filter(i => i.severity === 'error').length;
  const warnCount = issues.filter(i => i.severity === 'warning').length;

  return (
    <div className={`rounded border ${issues.length > 0 ? 'border-destructive/40' : 'border-border'} bg-card/40`}>
      <div className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-accent/30"
        onClick={() => setOpen(o => !o)}>
        {open ? <ChevronDown className="w-3 h-3 shrink-0 text-muted-foreground" /> : <ChevronRight className="w-3 h-3 shrink-0 text-muted-foreground" />}
        <Zap className="w-3 h-3 shrink-0 text-muted-foreground" />
        <span className="text-[11px] font-mono flex-1 truncate text-foreground">{trigger.name || '(unnamed)'}</span>
        {trigger.whenToTest && <span className="text-[10px] text-muted-foreground hidden sm:block">{trigger.whenToTest}</span>}
        <div className="flex items-center gap-1.5">
          {errorCount > 0 && (
            <span className="text-[10px] bg-destructive/20 text-destructive px-1.5 py-0.5 rounded font-medium">
              {errorCount} error{errorCount > 1 ? 's' : ''}
            </span>
          )}
          {warnCount > 0 && (
            <span className="text-[10px] bg-yellow-500/20 text-yellow-400 px-1.5 py-0.5 rounded font-medium">
              {warnCount} warn{warnCount > 1 ? 's' : ''}
            </span>
          )}
          {issues.length === 0 && (
            <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
          )}
        </div>
      </div>

      {open && issues.length > 0 && (
        <div className="px-3 pb-3 pt-1 border-t border-border/40 space-y-1.5">
          {issues.map((issue, i) => <IssueRow key={i} issue={issue} />)}
        </div>
      )}
    </div>
  );
}

export default function TriggerValidationPanel() {
  const { traitsData, ancData } = useValidationData();
  const [expanded, setExpanded] = useState(true);

  const { traitTriggers, ancTriggers, traitNames, ancNames } = useMemo(() => {
    const traitNames = new Set((traitsData?.traits || []).map(t => t.name));
    const ancNames = new Set((ancData?.ancillaries || []).map(a => a.name));
    const traitTriggers = traitsData?.triggers || [];
    const ancTriggers = ancData?.triggers || [];
    return { traitTriggers, ancTriggers, traitNames, ancNames };
  }, [traitsData, ancData]);

  const traitResults = useMemo(() =>
    traitTriggers.map(t => ({ trigger: t, issues: validateTrigger(t, traitNames, ancNames, 'trait') })),
    [traitTriggers, traitNames, ancNames]
  );
  const ancResults = useMemo(() =>
    ancTriggers.map(t => ({ trigger: t, issues: validateTrigger(t, traitNames, ancNames, 'ancillary') })),
    [ancTriggers, traitNames, ancNames]
  );

  const totalErrors = [...traitResults, ...ancResults].reduce((s, r) => s + r.issues.filter(i => i.severity === 'error').length, 0);
  const totalWarnings = [...traitResults, ...ancResults].reduce((s, r) => s + r.issues.filter(i => i.severity === 'warning').length, 0);
  const totalTriggers = traitResults.length + ancResults.length;

  const hasAnyData = !!(traitsData || ancData);

  return (
    <div className="rounded-lg border border-border bg-card/60 overflow-hidden">
      {/* Header */}
      <button
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-accent/30 text-left"
        onClick={() => setExpanded(o => !o)}
      >
        {expanded ? <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />}
        <Zap className="w-4 h-4 text-primary shrink-0" />
        <span className="text-sm font-semibold text-foreground flex-1">Trigger Validation</span>
        {hasAnyData && (
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground">{totalTriggers} triggers</span>
            {totalErrors > 0 && (
              <span className="text-[10px] bg-destructive/20 text-destructive px-2 py-0.5 rounded-full font-medium">
                {totalErrors} error{totalErrors > 1 ? 's' : ''}
              </span>
            )}
            {totalWarnings > 0 && (
              <span className="text-[10px] bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded-full font-medium">
                {totalWarnings} warning{totalWarnings > 1 ? 's' : ''}
              </span>
            )}
            {totalErrors === 0 && totalWarnings === 0 && totalTriggers > 0 && (
              <span className="text-[10px] text-green-400 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> All clean
              </span>
            )}
          </div>
        )}
      </button>

      {expanded && (
        <div className="border-t border-border px-4 py-3 space-y-4">
          {!hasAnyData && (
            <p className="text-xs text-muted-foreground italic text-center py-4">
              Load trait or ancillary files on the Home page to validate triggers.
            </p>
          )}

          {/* Trait triggers */}
          {traitResults.length > 0 && (
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mb-2">
                Trait Triggers ({traitResults.length})
              </p>
              <div className="space-y-1.5">
                {traitResults.map((r, i) => (
                  <TriggerRow key={i} trigger={r.trigger} issues={r.issues} mode="trait" />
                ))}
              </div>
            </div>
          )}

          {/* Ancillary triggers */}
          {ancResults.length > 0 && (
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mb-2">
                Ancillary Triggers ({ancResults.length})
              </p>
              <div className="space-y-1.5">
                {ancResults.map((r, i) => (
                  <TriggerRow key={i} trigger={r.trigger} issues={r.issues} mode="ancillary" />
                ))}
              </div>
            </div>
          )}

          {hasAnyData && traitResults.length === 0 && ancResults.length === 0 && (
            <p className="text-xs text-muted-foreground italic text-center py-2">No triggers found in loaded files.</p>
          )}
        </div>
      )}
    </div>
  );
}