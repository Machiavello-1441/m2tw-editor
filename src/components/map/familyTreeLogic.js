// Family-tree rules, learned from RTW-M2TW-Campaign-Editor (family.py):
// - one `relative` line per COUPLE: [father, wife, child, child...]
// - a grandchild's couple is its own line (child, spouse, grandchildren)
// - a parent's couple line must come before their children's couple lines
// - every name must be a character / record of the same faction
// - checks: father is a man, wife a woman, one set of parents per child,
//   nobody is their own ancestor, parents at least ~14 years older.

export const fullName = (c) => (c ? [c.name, c.surname].filter(Boolean).join(' ') : '');

// A tree (root couple + nested spouses/children) -> list of relative lines.
export function treeToRelatives(tree) {
  const out = [[fullName(tree.father), fullName(tree.mother), ...(tree.children || []).map(fullName)]];
  const walk = (c) => {
    const spouse = tree.spouses?.[c.id] || null;
    const kids = tree.nestedChildren?.[c.id] || [];
    if (spouse || kids.length) {
      const [a, b] = c.sex === 'female' && spouse ? [spouse, c] : [c, spouse];
      out.push([fullName(a), fullName(b), ...kids.map(fullName)]);
    }
    kids.forEach(walk);
  };
  (tree.children || []).forEach(walk);
  return out.filter((r) => r.some(Boolean));
}

// Parents' couples before their children's couples (the order vanilla writes).
export function orderRelatives(rels) {
  const childIn = new Map();
  rels.forEach((r, i) => r.slice(2).forEach((k) => childIn.set(k, i)));
  const done = new Set();
  const out = [];
  const visit = (i, stack) => {
    if (done.has(i) || stack.has(i)) return;
    stack.add(i);
    for (const p of [rels[i][0], rels[i][1]]) {
      const j = childIn.get(p);
      if (j !== undefined && j !== i) visit(j, stack);
    }
    stack.delete(i);
    done.add(i);
    out.push(rels[i]);
  };
  rels.forEach((_, i) => visit(i, new Set()));
  return out;
}

// -> { errors: [], warnings: [] }
export function relativeProblems(rels, chars) {
  const by = {};
  for (const c of chars) {
    by[fullName(c).toLowerCase()] = c;
    if (c.name && !by[c.name.toLowerCase()]) by[c.name.toLowerCase()] = c;
  }
  const look = (n) => by[(n || '').toLowerCase()];
  const errors = [];
  const warnings = [];
  const parentOf = {};
  for (const [father, wife, ...kids] of rels) {
    for (const n of [father, wife, ...kids]) {
      if (n && !look(n)) errors.push(`${n} is on the family tree but is no character of the faction`);
    }
    if (look(father)?.sex === 'female') errors.push(`${father} heads a couple but is a woman`);
    if (wife && look(wife)?.sex === 'male') errors.push(`${wife} is ${father}'s wife but is a man`);
    for (const k of kids) {
      if (parentOf[k]) errors.push(`${k} has two sets of parents (${parentOf[k]} and ${father})`);
      parentOf[k] = father;
      for (const p of [father, wife]) {
        const pa = look(p)?.age, ka = look(k)?.age;
        if (p && pa != null && ka != null && pa - ka < 14) {
          warnings.push(`${p} (${pa}) is only ${pa - ka} years older than the child ${k} (${ka})`);
        }
      }
    }
  }
  const kidsOf = {};
  for (const [father, wife, ...kids] of rels) {
    for (const p of [father, wife]) if (p) (kidsOf[p] = kidsOf[p] || new Set()), kids.forEach((k) => kidsOf[p].add(k));
  }
  for (const start of Object.keys(kidsOf)) {
    const stack = [...kidsOf[start]];
    const seen = new Set();
    while (stack.length) {
      const n = stack.pop();
      if (n === start) { errors.push(`${start} is their own ancestor`); break; }
      if (!seen.has(n)) { seen.add(n); stack.push(...(kidsOf[n] || [])); }
    }
  }
  return { errors: [...new Set(errors)].sort(), warnings: [...new Set(warnings)].sort() };
}