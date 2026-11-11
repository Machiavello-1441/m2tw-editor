import { useMemo, useState } from 'react';
import settlementSearchIndex, { searchSettlements, groupSettlementMatches } from '@/components/map/settlementSearchIndex';
import settlementSearchWindow, { SETTLEMENT_SEARCH_PAGE_SIZE } from '@/components/map/settlementSearchWindow';

export default function useSettlementSearch({ settlements, regionsByName, settlementNames, search, faction, resource, selectedItem, expandedFactions }) {
  // Pixel buffers and bitmap redraws deliberately are not index dependencies.
  const index = useMemo(() => settlementSearchIndex(settlements, regionsByName, settlementNames), [settlements, regionsByName, settlementNames]);
  const filteredSettlements = useMemo(() => searchSettlements(index, { search, faction, resource }), [index, search, faction, resource]);
  const settlementFiltersActive = Boolean(search || faction || resource);
  const [page, setPage] = useState({ matches: null, limit: SETTLEMENT_SEARCH_PAGE_SIZE });
  // A new query, edit, or campaign starts at the first page without an effect-driven extra render.
  const limit = page.matches === filteredSettlements ? page.limit : SETTLEMENT_SEARCH_PAGE_SIZE;
  const byFaction = useMemo(() => groupSettlementMatches(filteredSettlements), [filteredSettlements]);
  const ordered = useMemo(() => byFaction.flatMap(([name, items]) => settlementFiltersActive || expandedFactions.has(name) ? items : []), [byFaction, settlementFiltersActive, expandedFactions]);
  const selected = selectedItem?.category === 'settlement' ? index.byId.get(selectedItem.id) : null;
  const visible = useMemo(() => settlementSearchWindow(ordered, true, limit, selected), [ordered, limit, selected]);
  const visibleByFaction = useMemo(() => {
    const groups = groupSettlementMatches(visible);
    if (settlementFiltersActive) return groups;
    const shown = new Map(groups);
    return byFaction.map(([name]) => [name, shown.get(name) || []]);
  }, [byFaction, visible, settlementFiltersActive]);
  const matchCounts = useMemo(() => new Map(byFaction.map(([name, items]) => [name, items.length])), [byFaction]);
  return {
    filteredSettlements, settlementFiltersActive, byFaction, visibleByFaction, matchCounts,
    capitalIds: index.capitals, visibleCount: visible.length, renderableCount: ordered.length,
    hasMore: visible.length < ordered.length,
    showMore: () => setPage({ matches: filteredSettlements, limit: limit + SETTLEMENT_SEARCH_PAGE_SIZE }),
  };
}