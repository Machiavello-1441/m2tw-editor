import { findFactionBlocks } from '@/components/map/factionBlockOps';

export default function settlementOwnershipTransfers(lines, originalItems, overlayItems, editedSettlements) {
  const blocks = findFactionBlocks(lines);
  const overlays = new Map(overlayItems.map(item => [item.id, item]));
  const transfers = new Map();
  for (const original of originalItems) {
    if (original.category !== 'settlement' || original.id < 0 || original._lineStart === undefined) continue;
    const settlement = { ...original, ...overlays.get(original.id), ...editedSettlements[original.id] };
    // Ownership is determined by the enclosing raw faction block, not the
    // in-memory original: that item already contains the user's ownership edit.
    const owner = blocks.find(block => original._lineStart > block.start && original._lineStart < block.end);
    if (!owner || !settlement.faction || settlement.faction === owner.name) continue;
    if (!blocks.some(block => block.name === settlement.faction)) {
      throw new Error(`Cannot transfer ${settlement.region}: faction ${settlement.faction} has no campaign block.`);
    }
    transfers.set(String(original.id), settlement);
  }
  return transfers;
}