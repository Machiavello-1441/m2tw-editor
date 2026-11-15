/** Filter either side of a grouped row without changing its targets or edit index. */
export default function filterDiplomacyRows(rows, search = '') {
  const query = search.trim().toLowerCase();
  return rows.map((row, index) => ({ row, index })).filter(({ row }) =>
    !query || [row.faction, ...(row.targets || [])].some(name => (name || '').toLowerCase().includes(query))
  );
}