import { layoutForest } from '@/components/map/familyGraphLayout';
import { addChild } from '@/components/map/familyGraphOps';
import { treeToRelatives, orderRelatives, relativeProblems } from '@/components/map/familyTreeLogic';
import familyRuleValidation from '@/components/map/familyRuleValidation';
import { marriageEligibility } from '@/components/map/familyMarriageRules';

// Represent each newly edited couple explicitly so either sex can be the anchor.
function ensureCouple(trees, node) {
  if (node.unit.isRoot) return { trees, treeId: node.unit.treeId };
  const source = trees.find(tree => tree.id === node.unit.treeId);
  const id = node.unit.parentId;
  const spouses = { ...source.spouses }, nestedChildren = { ...source.nestedChildren };
  delete spouses[id]; delete nestedChildren[id];
  const couple = { id: crypto.randomUUID(), father: node.unit.parents.find(c => c.sex === 'male') || null,
    mother: node.unit.parents.find(c => c.sex === 'female') || null, children: source.nestedChildren?.[id] || [], spouses, nestedChildren };
  return { trees: [...trees.map(tree => tree.id === source.id ? { ...tree, spouses, nestedChildren } : tree), couple], treeId: couple.id };
}

export default function assignFamilyMember(trees, chars, request, member, rules) {
  const limits = rules?.values || {};
  const anchor = chars.find(c => String(c.id) === String(request.anchorId));
  if (request.sex && member.sex !== request.sex) return { error: `Choose a ${request.sex} character for this relationship.` };
  if (anchor?.id === member.id) return { error: 'A character cannot be their own relative.' };
  if (anchor && member.faction !== anchor.faction) return { error: 'Choose a character from the same faction.' };
  const nodes = layoutForest(trees).flatMap(tree => tree.nodes);
  let base = trees, treeId = request.treeId, slot = request.slot;
  if (request.kind !== 'slot') {
    const node = nodes.find(n => n.char?.id === anchor?.id);
    if (!node) return { error: 'Select a character in the tree first.' };
    if (request.kind === 'parent') {
      const root = trees.find(tree => tree.children?.some(c => c.id === anchor.id));
      const source = trees.find(tree => Object.values(tree.nestedChildren || {}).some(kids => kids.some(c => c.id === anchor.id)));
      if (root) treeId = root.id;
      else if (source) {
        const parentId = Object.keys(source.nestedChildren).find(key => source.nestedChildren[key].some(c => c.id === anchor.id));
        const parentNode = nodes.find(n => String(n.char?.id) === parentId && n.unit.treeId === source.id);
        ({ trees: base, treeId } = ensureCouple(trees, parentNode));
      } else {
        base = ensureCouple(trees, node).trees;
        treeId = crypto.randomUUID();
        base = [...base, { id: treeId, father: null, mother: null, children: [anchor], spouses: {}, nestedChildren: {} }];
      }
      slot = member.sex === 'male' ? 'father' : 'mother';
    } else {
      ({ trees: base, treeId } = ensureCouple(trees, node));
      if (request.kind === 'child') {
        const couple = base.find(tree => tree.id === treeId);
        const result = addChild(base, [...chars, member], { treeId, parentId: null, parents: [couple.father, couple.mother].filter(Boolean) }, member, limits);
        if (result.error) return result;
        base = result.trees;
      } else {
        slot = member.sex === 'male' ? 'father' : 'mother';
        const issues = [...marriageEligibility(anchor, limits), ...marriageEligibility(member, limits)];
        if (issues.length) return { error: issues.join('; ') };
        const partnered = trees.some(tree => (tree.father?.id === member.id && tree.mother) || (tree.mother?.id === member.id && tree.father) || Object.values(tree.spouses || {}).some(c => c?.id === member.id) || tree.spouses?.[member.id]);
        if (partnered) return { error: 'This character already has a spouse.' };
      }
    }
  }
  if (slot) {
    const target = base.find(tree => tree.id === treeId);
    if (!target) return { error: 'Family tree not found.' };
    if (target[slot]) return { error: `This character already has a ${slot}.` };
    base = base.map(tree => tree.id === treeId ? { ...tree, [slot]: member } : tree);
  }
  const errorsFor = (list, people) => {
    const relatives = orderRelatives(list.flatMap(treeToRelatives));
    return [...relativeProblems(relatives, people, 0).errors, ...familyRuleValidation(relatives, people, rules).errors];
  };
  const previous = new Set(errorsFor(trees, chars));
  const errors = errorsFor(base, [...chars.filter(c => c.id !== member.id), member]).filter(error => !previous.has(error));
  return errors.length ? { error: errors.join('; ') } : { trees: base };
}