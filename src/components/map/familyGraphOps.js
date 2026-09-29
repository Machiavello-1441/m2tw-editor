// Pure edit operations for the visual family tree. Each returns { trees } or { error }.
import { treeToRelatives, orderRelatives, relativeProblems } from './familyTreeLogic';

export const MAX_CHILDREN = 4;
export const MIN_AGE_DIFF = 14;
const byAgeDesc = (arr) => [...arr].sort((a, b) => (b.age || 0) - (a.age || 0));

export function removeAsChild(trees, charId) {
  return trees.map((t) => ({
    ...t,
    children: (t.children || []).filter((c) => c.id !== charId),
    nestedChildren: Object.fromEntries(
      Object.entries(t.nestedChildren || {}).map(([k, v]) => [k, v.filter((c) => c.id !== charId)])
    ),
  }));
}

function check(next, chars) {
  const errs = relativeProblems(orderRelatives(next.flatMap(treeToRelatives)), chars).errors
    .filter((e) => /own ancestor/.test(e));
  return errs.length ? { error: errs[0] } : { trees: next };
}

// Ids of a child and everything below it inside one tree.
function subtreeIds(tree, id, acc = new Set()) {
  acc.add(id);
  (tree.nestedChildren?.[id] || []).forEach((c) => { if (!acc.has(c.id)) subtreeIds(tree, c.id, acc); });
  return acc;
}

export function addChild(trees, chars, target, child) {
  const { treeId, parentId, parents } = target;
  if (!parents.length) return { error: 'Give this couple a parent first' };
  if (parents.some((p) => p.id === child.id)) return { error: 'Nobody can be their own child' };
  if (child.faction !== parents[0].faction) return { error: 'Child must be of the same faction' };
  const minAge = Math.min(...parents.map((p) => p.age || 0));
  if (minAge - (child.age || 0) < MIN_AGE_DIFF) {
    return { error: `${child.name} is too old — parents must be ${MIN_AGE_DIFF}+ years older` };
  }
  // Carry the child's own spouse/descendants along when moving between trees.
  const src = trees.find((t) => (t.children || []).some((c) => c.id === child.id)
    || Object.values(t.nestedChildren || {}).some((l) => l.some((c) => c.id === child.id)));
  const ids = src ? subtreeIds(src, child.id) : new Set();
  let base = removeAsChild(trees, child.id);
  const target0 = base.find((t) => t.id === treeId);
  if (!target0) return { error: 'Tree not found' };
  const cur = parentId == null ? target0.children || [] : target0.nestedChildren?.[parentId] || [];
  if (cur.length >= MAX_CHILDREN) return { error: `Max ${MAX_CHILDREN} children (a 5th needs EOP/M2EX)` };
  const list = byAgeDesc([...cur, child]);
  if (src && src.id !== treeId) {
    const from = base.find((t) => t.id === src.id);
    const pick = (obj) => Object.fromEntries(Object.entries(obj || {}).filter(([k]) => ids.has(isNaN(k) ? k : Number(k)) || ids.has(k)));
    const rest = (obj) => Object.fromEntries(Object.entries(obj || {}).filter(([k]) => !(ids.has(isNaN(k) ? k : Number(k)) || ids.has(k))));
    const moved = { spouses: pick(from.spouses), nested: pick(from.nestedChildren) };
    base = base.map((t) => t.id === src.id ? { ...t, spouses: rest(t.spouses), nestedChildren: rest(t.nestedChildren) } : t);
    base = base.map((t) => t.id === treeId
      ? { ...t, spouses: { ...t.spouses, ...moved.spouses }, nestedChildren: { ...t.nestedChildren, ...moved.nested } } : t);
  }
  const next = base.map((t) => {
    if (t.id !== treeId) return t;
    return parentId == null
      ? { ...t, children: list }
      : { ...t, nestedChildren: { ...t.nestedChildren, [parentId]: list } };
  });
  return check(next, chars);
}

export function setParent(trees, treeId, slot, char) {
  const want = slot === 'father' ? 'male' : 'female';
  if (char.sex !== want) return { error: `The ${slot} must be ${want}` };
  const t = trees.find((x) => x.id === treeId);
  if (!t) return { error: 'Tree not found' };
  if ((t.children || []).some((c) => c.id === char.id)) return { error: 'A child cannot be their own parent' };
  return { trees: trees.map((x) => x.id === treeId ? { ...x, [slot]: char } : x) };
}

export function setSpouse(trees, treeId, person, spouse) {
  if (person.sex === spouse.sex) return { error: 'A couple must be a man and a woman' };
  if (person.id === spouse.id) return { error: 'Nobody marries themselves' };
  if (person.faction !== spouse.faction) return { error: 'Spouse must be of the same faction' };
  return {
    trees: trees.map((t) => {
      if (t.id !== treeId) return t;
      const spouses = Object.fromEntries(Object.entries(t.spouses || {}).filter(([, s]) => s?.id !== spouse.id));
      return { ...t, spouses: { ...spouses, [person.id]: spouse } };
    }),
  };
}

// node: { kind: 'child'|'slot'|'spouse', charId, treeId, slot, personId }
export function detach(trees, node) {
  if (node.kind === 'child') return removeAsChild(trees, node.charId);
  if (node.kind === 'slot') return trees.map((t) => t.id === node.treeId ? { ...t, [node.slot]: null } : t);
  return trees.map((t) => t.id === node.treeId ? { ...t, spouses: { ...t.spouses, [node.personId]: null } } : t);
}