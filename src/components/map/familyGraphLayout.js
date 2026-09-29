// Lays a faction's family trees out as couples (units) with children below.
export const CW = 116;
export const CH = 64;
const IN = 10;
const GAP = 16;
export const ROW = 132;

// Root couples that are somebody's child are grafted under that child, so
// grandparents -> parents -> children read as one connected tree.
function buildUnits(trees) {
  const rootOf = new Map();
  const childIds = new Set();
  trees.forEach((t) => {
    [t.father, t.mother].forEach((c) => { if (c && !rootOf.has(c.id)) rootOf.set(c.id, t); });
    (t.children || []).forEach((c) => childIds.add(c.id));
    Object.values(t.nestedChildren || {}).forEach((l) => l.forEach((c) => childIds.add(c.id)));
  });
  const used = new Set();
  const rootUnit = (t) => {
    used.add(t.id);
    return {
      treeId: t.id, parentId: null, isRoot: true, couple: [t.father || null, t.mother || null],
      slots: ['father', 'mother'], parents: [t.father, t.mother].filter(Boolean),
      kids: (t.children || []).map((c) => childUnit(t, c)),
    };
  };
  const childUnit = (t, c) => {
    const b = rootOf.get(c.id);
    if (b && b.id !== t.id && !used.has(b.id)) return { ...rootUnit(b), asChild: c };
    const sp = t.spouses?.[c.id] || null;
    const couple = c.sex === 'female' && sp ? [sp, c] : [c, sp];
    return {
      treeId: t.id, parentId: c.id, isRoot: false, person: c, couple, parents: [c, sp].filter(Boolean),
      kids: (t.nestedChildren?.[c.id] || []).map((k) => childUnit(t, k)),
    };
  };
  const isTop = (t) => !(t.father && childIds.has(t.father.id)) && !(t.mother && childIds.has(t.mother.id));
  const tops = [];
  trees.filter(isTop).forEach((t) => { if (!used.has(t.id)) tops.push(rootUnit(t)); });
  trees.forEach((t) => { if (!used.has(t.id)) tops.push(rootUnit(t)); });
  return tops;
}

function measure(u) {
  u.coupleW = u.isRoot || u.couple[1] ? 2 * CW + IN : CW;
  u.kids.forEach(measure);
  u.kw = u.kids.reduce((s, k) => s + k.w, 0) + GAP * Math.max(0, u.kids.length - 1);
  u.w = Math.max(u.coupleW, u.kw, 90);
  u.depth = 1 + Math.max(0, ...u.kids.map((k) => k.depth));
}

function place(u, x, y, out) {
  const cx = x + u.w / 2;
  const left = cx - u.coupleW / 2;
  const meta = { treeId: u.treeId, parentId: u.parentId, isRoot: u.isRoot, parents: u.parents };
  const cards = u.isRoot ? [left, left + CW + IN] : [left, left + CW + IN];
  u.couple.forEach((ch, i) => {
    if (!ch && !u.isRoot) return;
    const isSpouseOfChild = !u.isRoot && ch && ch.id !== u.person.id;
    out.nodes.push({
      key: `${u.treeId}-${u.parentId}-${i}`, char: ch, x: cards[i], y, unit: meta,
      slot: u.isRoot ? u.slots[i] : null,
      kind: u.isRoot ? 'slot' : isSpouseOfChild ? 'spouse' : 'child',
      personId: u.person?.id,
    });
  });
  if (u.couple[0] && u.couple[1]) {
    out.edges.push(`M${cards[0] + CW} ${y + CH / 2} H${cards[1]}`);
  }
  out.pills.push({ key: `p-${u.treeId}-${u.parentId}`, x: cx - 36, y: y + CH + 3, unit: meta });
  if (u.kids.length) {
    const midY = y + ROW - 24;
    out.edges.push(`M${cx} ${y + CH + 21} V${midY}`);
    let kx = cx - u.kw / 2;
    const centers = [];
    u.kids.forEach((k) => {
      place(k, kx, y + ROW, out);
      centers.push(kx + k.w / 2);
      kx += k.w + GAP;
    });
    out.edges.push(`M${Math.min(...centers, cx)} ${midY} H${Math.max(...centers, cx)}`);
    centers.forEach((c) => out.edges.push(`M${c} ${midY} V${y + ROW}`));
  }
}

export function layoutForest(trees) {
  return buildUnits(trees).map((u) => {
    measure(u);
    const out = { nodes: [], edges: [], pills: [], width: u.w, height: (u.depth - 1) * ROW + CH + 26 };
    place(u, 0, 0, out);
    // A grafted-in child keeps its own card as the couple member.
    out.title = [u.couple[0]?.name, u.couple[1]?.name].filter(Boolean).join(' × ') || 'Unnamed tree';
    return out;
  });
}