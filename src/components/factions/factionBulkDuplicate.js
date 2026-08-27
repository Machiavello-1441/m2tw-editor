/**
 * Bulk faction duplication helpers — operate on the shared localStorage keys
 * that Home + editors use, and dispatch update events so open tabs refresh.
 */
import { parseBannersXml, serialiseBannersXml } from '@/components/minorfiles/banners/bannersParser';
import { BANNERS_GLOBAL_KEY } from './BannersTab';
import {
  parseDescrCharacter, serialiseDescrCharacter,
  parseDescrModelStrat, serialiseDescrModelStrat,
} from '@/components/minorfiles/stratmap/stratCharParser';

const EXPANDED_KEY = 'm2tw_strings_bin_global';
const MENU_KEY = 'm2tw_menu_strings_bin';
const CHAR_KEY = 'm2tw_descr_character';
const STRAT_KEY = 'm2tw_descr_model_strat';
const NAMES_KEY = 'm2tw_names_file';
const EDU_KEY = 'm2tw_units_file';

const bare = (k) => String(k || '').replace(/[{}]/g, '').toUpperCase();
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function readStore(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return { entries: parsed.entries || [], magic1: parsed.magic1 ?? 2, magic2: parsed.magic2 ?? 2048 };
  } catch { return null; }
}

/**
 * Look up the source faction's existing string values from both
 * expanded.txt.strings.bin and menu_english.txt.strings.bin stores.
 */
export function lookupSourceStrings(srcName) {
  const SRC = (srcName || '').toUpperCase();
  const stores = [readStore(EXPANDED_KEY), readStore(MENU_KEY)].filter(Boolean);
  const find = (bk) => {
    for (const s of stores) {
      const e = s.entries.find((x) => bare(x.key) === bk);
      if (e) return e.value;
    }
    return '';
  };
  return {
    displayName: find(SRC),
    adjective: find(`${SRC}_ADJECTIVE`) || find(`EMT_${SRC}_ADJECTIVE`),
    leaderTitle: find(`EMT_${SRC}_FACTION_LEADER_TITLE`),
    heirTitle: find(`EMT_${SRC}_FACTION_HEIR_TITLE`),
    strengths: find(`${SRC}_STRENGTH`),
    weaknesses: find(`${SRC}_WEAKNESS`),
    customUnit: find(`${SRC}_UNIT`),
  };
}

/**
 * Duplicate all string entries mentioning the source faction in BOTH the
 * expanded and menu strings stores, applying user-provided new values.
 */
export function duplicateFactionStrings(srcName, dstName, payload = {}) {
  const SRC = srcName.toUpperCase();
  const DST = dstName.toUpperCase();
  const displayName = (payload.displayName || '').trim();
  const adjective = (payload.adjective || '').trim();
  const sourceAdjective = (payload.sourceAdjective || '').trim();
  const leaderTitle = (payload.leaderTitle || '').trim();
  const heirTitle = (payload.heirTitle || '').trim();
  const strengths = (payload.strengths || '').trim();
  const weaknesses = (payload.weaknesses || '').trim();
  const customUnit = (payload.customUnit || '').trim();

  // bareKey → forced value (only when the user provided one)
  const overrides = {};
  if (displayName) overrides[DST] = displayName;
  if (leaderTitle) {
    overrides[`EMT_${DST}_FACTION_LEADER_TITLE`] = leaderTitle;
    overrides[`EMT_${DST}_FACTION_LEADER_NAME`] = `${leaderTitle} %S`;
  }
  if (heirTitle) {
    overrides[`EMT_${DST}_FACTION_HEIR_TITLE`] = heirTitle;
    overrides[`EMT_${DST}_FACTION_HEIR_NAME`] = `${heirTitle} %S`;
  }
  if (strengths) overrides[`${DST}_STRENGTH`] = strengths;
  if (weaknesses) overrides[`${DST}_WEAKNESS`] = weaknesses;
  if (customUnit) overrides[`${DST}_UNIT`] = customUnit;

  const written = new Set();

  const processStore = (storageKey, eventName) => {
    const store = readStore(storageKey);
    if (!store) return;
    const { entries, magic1, magic2 } = store;
    // Source entries — exclude any that already mention the new faction
    // (prevents FRANCE→FRANCE_COPY producing FRANCE_COPY_COPY on re-runs)
    const srcEntries = entries.filter((e) => bare(e.key).includes(SRC) && !bare(e.key).includes(DST));
    if (srcEntries.length === 0) return;

    const newEntries = srcEntries.map((e) => {
      const newKey = String(e.key).replace(new RegExp(escapeRe(SRC), 'gi'), DST);
      let newValue = e.value;
      if (sourceAdjective && adjective) {
        newValue = newValue.split(sourceAdjective).join(adjective);
      }
      if (displayName) {
        newValue = newValue.replace(new RegExp(escapeRe(srcName), 'gi'), displayName);
      }
      const bk = bare(newKey);
      if (overrides[bk] !== undefined) newValue = overrides[bk];
      written.add(bk);
      return { key: newKey, value: newValue };
    });

    const filtered = entries.filter((e) => !bare(e.key).includes(DST));
    try {
      localStorage.setItem(storageKey, JSON.stringify({ entries: [...filtered, ...newEntries], magic1, magic2 }));
      if (eventName) window.dispatchEvent(new CustomEvent(eventName));
    } catch {}
  };

  processStore(EXPANDED_KEY, 'strings-bin-updated');
  processStore(MENU_KEY, 'menu-strings-updated');

  // Any user-provided value whose key didn't exist in the source gets created
  // in the expanded store so custom titles/strengths always take effect.
  const missing = Object.keys(overrides).filter((k) => !written.has(k));
  if (missing.length) {
    const store = readStore(EXPANDED_KEY) || { entries: [], magic1: 2, magic2: 2048 };
    for (const k of missing) store.entries.push({ key: k, value: overrides[k] });
    try {
      localStorage.setItem(EXPANDED_KEY, JSON.stringify(store));
      window.dispatchEvent(new CustomEvent('strings-bin-updated'));
    } catch {}
  }
}

/**
 * Bulk duplicate stratmap character entries (descr_character.txt) and
 * strat model textures (descr_model_strat.txt) from source to target faction.
 */
export function duplicateStratmapCharacters(srcName, dstName) {
  let charTypes = 0, stratTextures = 0;
  try {
    const raw = localStorage.getItem(CHAR_KEY);
    if (raw) {
      const data = parseDescrCharacter(raw);
      for (const t of data.types) {
        const row = t.factions.find((f) => f.faction === srcName);
        if (row && !t.factions.some((f) => f.faction === dstName)) {
          t.factions.push({ ...row, faction: dstName, stratModels: [...row.stratModels] });
          charTypes++;
        }
      }
      if (charTypes > 0) {
        const out = serialiseDescrCharacter(data);
        localStorage.setItem(CHAR_KEY, out);
        try { sessionStorage.setItem('m2tw_descr_character_raw', out); } catch {}
        window.dispatchEvent(new CustomEvent('load-descr-character', { detail: out }));
      }
    }
  } catch {}
  try {
    const raw = localStorage.getItem(STRAT_KEY);
    if (raw) {
      const models = parseDescrModelStrat(raw);
      for (const m of models) {
        const tex = m.textures.find((t) => t.faction === srcName);
        if (tex && !m.textures.some((t) => t.faction === dstName)) {
          m.textures.push({ faction: dstName, path: tex.path.replace(new RegExp(escapeRe(srcName), 'g'), dstName) });
          stratTextures++;
        }
      }
      if (stratTextures > 0) {
        const out = serialiseDescrModelStrat(models);
        localStorage.setItem(STRAT_KEY, out);
        try { sessionStorage.setItem('m2tw_descr_model_strat_raw', out); } catch {}
        window.dispatchEvent(new CustomEvent('load-descr-model-strat', { detail: out }));
      }
    }
  } catch {}
  return { charTypes, stratTextures };
}

/**
 * Duplicate the source faction's names block in descr_names.txt,
 * inserting the copy right after the source block.
 */
export function duplicateFactionNames(srcName, dstName) {
  try {
    const raw = localStorage.getItem(NAMES_KEY);
    if (!raw) return false;
    const lines = raw.split('\n');
    const facRe = /^\s*faction\s*:\s*(\S+)/i;
    let start = -1, end = lines.length, endSet = false;
    for (let i = 0; i < lines.length; i++) {
      const m = lines[i].match(facRe);
      if (!m) continue;
      const f = m[1].replace(/,+$/, '').toLowerCase();
      if (f === dstName.toLowerCase()) return false; // already exists
      if (f === srcName.toLowerCase() && start === -1) { start = i; continue; }
      if (start !== -1 && !endSet) { end = i; endSet = true; }
    }
    if (start === -1) return false;
    const block = lines.slice(start, end);
    const newBlock = [...block];
    newBlock[0] = newBlock[0].replace(new RegExp(escapeRe(srcName)), dstName);
    const out = [...lines.slice(0, end), '', ...newBlock, ...lines.slice(end)].join('\n');
    localStorage.setItem(NAMES_KEY, out);
    try { sessionStorage.setItem('m2tw_descr_names_raw', out); } catch {}
    window.dispatchEvent(new CustomEvent('load-character-names', { detail: { raw: out } }));
    return true;
  } catch { return false; }
}

/**
 * In export_descr_unit.txt, add the target faction to the ownership line
 * of every unit owned by the source faction.
 */
export function duplicateEduOwnership(srcName, dstName) {
  try {
    const raw = localStorage.getItem(EDU_KEY);
    if (!raw) return 0;
    let count = 0;
    const lines = raw.split('\n').map((line) => {
      const m = line.match(/^(\s*ownership\s+)(.*)$/i);
      if (!m) return line;
      let rest = m[2], comment = '';
      const ci = rest.indexOf(';');
      if (ci !== -1) { comment = rest.slice(ci); rest = rest.slice(0, ci); }
      const facs = rest.split(',').map((s) => s.trim()).filter(Boolean);
      if (facs.includes(srcName) && !facs.includes(dstName)) {
        facs.push(dstName);
        count++;
        return m[1] + facs.join(', ') + (comment ? ' ' + comment : '');
      }
      return line;
    });
    if (count > 0) {
      const out = lines.join('\n');
      localStorage.setItem(EDU_KEY, out);
      try { sessionStorage.setItem('m2tw_edu_raw', out); } catch {}
    }
    return count;
  } catch { return 0; }
}

/**
 * Copy banner texture entries from the source faction to the new faction
 * in descr_banners_new.xml (moved out of FactionsEditor).
 */
export function copyBannerEntries(srcName, dstName) {
  try {
    const srcBannersData = localStorage.getItem(BANNERS_GLOBAL_KEY);
    if (!srcBannersData) return;
    const parsed = parseBannersXml(srcBannersData);
    const srcNameLower = srcName.toLowerCase();
    const dstNameLower = dstName.toLowerCase();

    const copyTexList = (banner, listKey, withMesh) => {
      const list = banner[listKey];
      if (!list) return;
      const sourceTextures = list.filter((t) => t.faction.toLowerCase() === srcNameLower);
      if (sourceTextures.length === 0) return;
      let newTextures = list.filter((t) => t.faction.toLowerCase() !== dstNameLower);
      sourceTextures.forEach((sourceTex) => {
        newTextures.push({
          faction: dstName,
          ...(withMesh ? { mesh: sourceTex.mesh || '' } : {}),
          diffuseMap: sourceTex.diffuseMap,
          translucencyMap: sourceTex.translucencyMap,
        });
      });
      banner[listKey] = newTextures;
    };

    const copySectionTextures = (section, isMeshSection) => {
      const sectionData = parsed[section];
      if (!sectionData) return;
      if (isMeshSection) {
        const banners = Array.isArray(sectionData) ? sectionData : [sectionData];
        banners.forEach((banner) => copyTexList(banner, 'meshesAndTextures', true));
      } else {
        sectionData.forEach((banner) => copyTexList(banner, 'textures', false));
      }
    };

    copySectionTextures('factionBanners', false);
    copySectionTextures('holyBanners', true);
    copySectionTextures('unitBanners', true);
    copySectionTextures('royalBanner', true);

    const newXml = serialiseBannersXml(parsed);
    localStorage.setItem(BANNERS_GLOBAL_KEY, newXml);
    window.dispatchEvent(new CustomEvent('banners-xml-loaded'));
  } catch (err) {
    console.error('Failed to copy banners:', err);
  }
}