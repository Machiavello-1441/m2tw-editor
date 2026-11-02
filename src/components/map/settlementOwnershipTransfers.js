import { findFactionBlocks } from '@/components/map/factionBlockOps';

export default function settlementOwnershipTransfers(lines, originalItems, overlayItems, editedSettlements, factionNames = []) {
  // Comment braces must not affect the faction boundary scan.
  const blocks = findFactionBlocks(lines.map(line => line.replace(/;.*$/, '')));
  const allowed = new Set([...blocks.map(block => block.name), ...factionNames]);
  const overlays = new Map(overlayItems.map(item => [String(item.id), item]));
  const transfers = new Map();
  for (const original of originalItems) {
    if (original.category !== 'settlement' || original.id < 0 || original._lineStart === undefined) continue;
    const settlement = { ...original, ...overlays.get(String(original.id)), ...editedSettlements[original.id] };
    // Ownership is determined by the enclosing raw faction block, not the
    // in-memory original: that item already contains the user's ownership edit.
    const owner = blocks.find(block => original._lineStart > block.start && original._lineStart < block.end);
    if (!owner) throw new Error(`Cannot save ${settlement.region}: its original faction block could not be located.`);
    if (!settlement.faction || settlement.faction === owner.name) continue;
    if (!allowed.has(settlement.faction)) {
      throw new Error(`Cannot transfer ${settlement.region}: faction ${settlement.faction} is not registered in this campaign.`);
    }
    transfers.set(String(original.id), settlement);
  }
  return transfers;
}