export const SETTLEMENT_SEARCH_PAGE_SIZE = 100;

/** Bound expensive draggable rows, while bulk actions keep the complete match list. */
export default function settlementSearchWindow(matches, active, limit, selected) {
  if (!active) return matches;
  const visible = matches.slice(0, limit);
  // A map selection must remain accessible even when it falls beyond the first page.
  if (selected && !visible.includes(selected) && matches.includes(selected)) visible.push(selected);
  return visible;
}