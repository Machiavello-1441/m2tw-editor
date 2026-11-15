import React from 'react';

export default function ClientStateRulesNotice({ issues, rejectedMessage }) {
  return (
    <div className="mb-2 space-y-1.5 rounded border border-border bg-card p-2 text-[9px] leading-relaxed">
      <p className="text-muted-foreground">
        M2EX client_of: the left faction is the client; the right faction is its suzerain.
        {' '}Clients join all suzerain wars and alliances; the suzerain can ignore client wars.
        {' '}In-game, clients can leave only through war.
      </p>
      <p className="text-muted-foreground">One suzerain per client. Clients cannot have clients or also be protectorates.</p>
      {rejectedMessage && <p role="alert" className="font-medium text-destructive">Change not applied: {rejectedMessage}</p>}
      {issues.length > 0 && <div role="alert" className="text-destructive">
        <p className="font-medium">Correct these client relationships before saving or exporting:</p>
        <ul className="list-disc pl-3">{issues.map(issue => <li key={issue.id}>{issue.message}</li>)}</ul>
      </div>}
    </div>
  );
}