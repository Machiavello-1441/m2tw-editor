export const FAMILY_RULES_KEY = 'm2tw_family_tree_rules';
export const FAMILY_RULES_EVENT = 'family-tree-rules-loaded';
export const FAMILY_RULE_FILES = new Set(['descr_campaign_db.xml']);

export function parseFamilyRules(text, source) {
  // Game files may use unquoted bool values elsewhere; those sections are
  // unrelated to family rules and must not block loading valid parameters.
  const content = text.replace(/^\uFEFF/, '').replace(/<!--[\s\S]*?-->/g, '');
  const section = content.match(/<family_tree\b[^>]*>[\s\S]*?<\/family_tree\s*>/i)?.[0];
  if (!section) throw new Error(`${source}: missing <family_tree> parameters`);
  const doc = new DOMParser().parseFromString(section, 'application/xml');
  if (doc.querySelector('parsererror')) throw new Error(`${source}: invalid <family_tree> parameters`);
  const family = doc.documentElement;
  const values = {};
  for (const element of family.querySelectorAll('*')) {
    const raw = ['uint', 'int', 'float', 'value'].map(key => element.getAttribute(key)).find(value => value !== null) ?? element.textContent.trim();
    if (!raw || element.children.length) continue;
    const value = Number(raw);
    if (!Number.isFinite(value)) throw new Error(`${source}: invalid ${element.tagName} value`);
    values[element.tagName.toLowerCase()] = value;
  }
  if (!Object.keys(values).length) throw new Error(`${source}: no numeric family-tree parameters`);
  return { source, values };
}

export function readFamilyRules() {
  const saved = localStorage.getItem(FAMILY_RULES_KEY);
  return saved ? JSON.parse(saved) : null;
}

export async function loadFamilyRulesFile(file) {
  if (!FAMILY_RULE_FILES.has(file.name.toLowerCase())) return false;
  const bytes = new Uint8Array(await file.arrayBuffer());
  const encoding = bytes[0] === 255 && bytes[1] === 254 ? 'utf-16le' : bytes[0] === 254 && bytes[1] === 255 ? 'utf-16be' : 'utf-8';
  const rules = parseFamilyRules(new TextDecoder(encoding).decode(bytes), file.name);
  localStorage.setItem(FAMILY_RULES_KEY, JSON.stringify(rules));
  window.dispatchEvent(new Event(FAMILY_RULES_EVENT));
  return true;
}