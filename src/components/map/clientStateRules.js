/** M2EX client rules apply to the first faction; targets are its suzerains. */
export default function clientStateRules(relationships = []) {
  const clients = new Map();
  const protectorates = new Set();
  const issues = [];
  const add = (code, names, message) => issues.push({ id: JSON.stringify([code, ...names]), message });
  for (const relationship of relationships) {
    if (relationship.relation === 'protectorate_of') protectorates.add(relationship.faction);
    if (relationship.relation !== 'client_of') continue;
    if (!clients.has(relationship.faction)) clients.set(relationship.faction, new Set());
    const suzerains = clients.get(relationship.faction);
    for (const target of relationship.targets || []) if (target) suzerains.add(target);
  }
  for (const [client, suzerains] of clients) {
    const names = [...suzerains].sort();
    if (!names.length) add('missing_suzerain', [client], `${client} must have one suzerain.`);
    if (names.length > 1) add('multiple_suzerains', [client, ...names], `${client} has multiple suzerains (${names.join(', ')}). A client can have only one.`);
    if (protectorates.has(client)) add('client_and_protectorate', [client], `${client} cannot be both a client and a protectorate.`);
    for (const suzerain of names) {
      if (suzerain === client) add('self_client', [client], `${client} cannot be its own suzerain.`);
      else if (clients.has(suzerain)) add('nested_client', [client, suzerain], `${suzerain} is already a client and cannot have ${client} as its client.`);
    }
  }
  return issues;
}