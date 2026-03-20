/**
 * Campaign Import Pipeline
 * Parses M2TW text files and bulk-inserts into the DB entities:
 * Region, Faction, Character, CampaignData, HistoricEvent
 */
import { base44 } from '@/api/base44Client';
import { parseDescrRegions, parseDescrStrat, parseDescrSmFactions } from './stratParser';

// ── Helpers ───────────────────────────────────────────────────────────────────

function cleanLine(l) { return l.replace(/;.*$/, '').trim(); }

// ── Factions from descr_strat.txt playability section ────────────────────────
function parsePlayability(text) {
  const lines = text.split('\n');
  const playability = {}; // name → 1=playable, 2=unlockable, 0=nonplayable
  let mode = null;
  for (const raw of lines) {
    const line = cleanLine(raw);
    if (!line) continue;
    if (line === 'playable') { mode = 1; continue; }
    if (line === 'unlockable') { mode = 2; continue; }
    if (line === 'nonplayable') { mode = 0; continue; }
    if (line === 'end') { mode = null; continue; }
    if (mode !== null && !line.includes(' ')) playability[line] = mode;
  }
  return playability;
}

// ── descr_strat.txt → faction money/ai fields ────────────────────────────────
function parseFactionStatus(text) {
  const lines = text.split('\n');
  const status = {}; // name → { money, kings_purse, label_ai, economic_ai, military_ai, undiscovered, dead_until_resurrected, dead_until_emerged, reemergent }
  let currentFaction = null;
  for (const raw of lines) {
    const line = cleanLine(raw);
    if (!line) continue;
    let m;
    if ((m = line.match(/^faction\s+(\w+)/))) {
      currentFaction = m[1];
      if (!status[currentFaction]) status[currentFaction] = {};
      continue;
    }
    if (!currentFaction) continue;
    if ((m = line.match(/^denari_kings_purse\s+(\d+)/))) { status[currentFaction].kings_purse = parseInt(m[1]); continue; }
    if ((m = line.match(/^denari\s+(\d+)/))) { status[currentFaction].money = parseInt(m[1]); continue; }
    if ((m = line.match(/^ai_label\s+(\S+)/))) { status[currentFaction].label_ai = m[1]; continue; }
    if (line === 'undiscovered') { status[currentFaction].undiscovered = true; continue; }
    if (line === 'dead_until_resurrected') { status[currentFaction].dead_until_resurrected = true; continue; }
    if (line === 'dead_until_emerged') { status[currentFaction].dead_until_emerged = true; continue; }
    if (line === 're_emergent') { status[currentFaction].reemergent = true; continue; }
  }
  return status;
}

// ── Map descr_sm_factions parsed data → Faction entity records ───────────────
function factionsToEntities(factionColors, playability, factionStatus) {
  return Object.entries(factionColors).map(([name_in, data]) => ({
    name_in,
    name_out: name_in, // will be enriched later if names file is available
    color1_r: data.primaryColor?.r ?? 0,
    color1_g: data.primaryColor?.g ?? 0,
    color1_b: data.primaryColor?.b ?? 0,
    color2_r: data.secondaryColor?.r ?? 0,
    color2_g: data.secondaryColor?.g ?? 0,
    color2_b: data.secondaryColor?.b ?? 0,
    playability: playability[name_in] ?? 0,
    money: factionStatus[name_in]?.money ?? 0,
    kings_purse: factionStatus[name_in]?.kings_purse ?? 0,
    label_ai: factionStatus[name_in]?.label_ai ?? '',
    undiscovered: factionStatus[name_in]?.undiscovered ?? false,
    dead_until_resurrected: factionStatus[name_in]?.dead_until_resurrected ?? false,
    dead_until_emerged: factionStatus[name_in]?.dead_until_emerged ?? false,
    reemergent: factionStatus[name_in]?.reemergent ?? false,
  }));
}

// ── Map descr_regions parsed data + strat data → Region entity records ────────
function regionsToEntities(regionsData, stratData) {
  // Build map: regionName → settlement info from strat
  const settlementMap = {};
  for (const item of (stratData?.items || [])) {
    if (item.category === 'settlement' && item.region) {
      settlementMap[item.region.toLowerCase()] = item;
    }
  }

  return regionsData.map(reg => {
    const strat = settlementMap[reg.regionName?.toLowerCase()] || {};
    const religionsObj = reg.religions || {};
    const religionsArr = Object.entries(religionsObj).map(([name, percentage]) => ({ name, percentage: percentage ?? 0 }));
    return {
      province_in: reg.regionName,
      city_in: reg.settlementName,
      color_r: reg.r,
      color_g: reg.g,
      color_b: reg.b,
      original_faction: reg.factionCreator,
      rebels: reg.rebelFaction,
      resources: reg.resources || [],
      agriculture: reg.val2 ?? 0,
      victory_points: reg.val1 ?? 0,
      religions: religionsArr,
      // from strat settlement block
      faction: strat.faction ?? '',
      castle: strat.castle ?? false,
      population: strat.population ?? 400,
      level: strat.level ? ['village','town','large_town','city','large_city','huge_city'].indexOf(strat.level) : 0,
      buildings: strat.upgrades ?? [],
      city_x: strat.x ?? 0,
      city_y: strat.y ?? 0,
    };
  });
}

// ── Map strat characters → Character entity records ───────────────────────────
function charactersToEntities(stratData) {
  return (stratData?.items || [])
    .filter(i => i.category === 'character')
    .map(char => ({
      name: char.name || '',
      faction: char.faction || '',
      type: capitalizeFirst(char.charType) || 'General',
      pos_x: char.x ?? 0,
      pos_y: char.y ?? 0,
    }));
}

function capitalizeFirst(s) {
  if (!s) return '';
  // handle "named character" → "Named"
  if (s === 'named character') return 'Named';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ── Map strat campaign metadata → CampaignData entity record ─────────────────
function campaignToEntity(stratData, campaignName) {
  return {
    name: campaignName || 'imperial_campaign',
    start_year: parseInt(stratData?.startDate?.split(' ')[0]) || 1080,
    start_season: stratData?.startDate?.split(' ')[1]?.toLowerCase() || 'summer',
    end_year: parseInt(stratData?.endDate?.split(' ')[0]) || 1530,
    end_season: stratData?.endDate?.split(' ')[1]?.toLowerCase() || 'winter',
    timescale: parseFloat(stratData?.timescale) || 0.5,
  };
}

// ── Main import function ──────────────────────────────────────────────────────
/**
 * Call this after parsing all files from the folder.
 * Clears existing data for the campaign and re-inserts everything.
 */
export async function importCampaignToDatabase({
  stratText,
  regionsText,
  factionsText,
  campaignName,
  onProgress, // (step, total) callback
}) {
  const steps = [];

  const stratData = stratText ? parseDescrStrat(stratText) : null;
  const regionsData = regionsText ? parseDescrRegions(regionsText) : null;
  const factionColors = factionsText ? parseDescrSmFactions(factionsText) : null;

  // Build playability + status from strat
  const playability = stratText ? parsePlayability(stratText) : {};
  const factionStatus = stratText ? parseFactionStatus(stratText) : {};

  let step = 0;
  const total = 5;
  const report = () => { step++; onProgress?.(step, total); };

  // 1. Clear + insert Regions
  if (regionsData?.length) {
    await deleteAll('Region');
    const records = regionsToEntities(regionsData, stratData);
    await bulkCreate('Region', records);
  }
  report();

  // 2. Clear + insert Factions
  if (factionColors) {
    await deleteAll('Faction');
    const records = factionsToEntities(factionColors, playability, factionStatus);
    await bulkCreate('Faction', records);
  }
  report();

  // 3. Clear + insert Characters
  if (stratData) {
    await deleteAll('Character');
    const records = charactersToEntities(stratData);
    if (records.length) await bulkCreate('Character', records);
  }
  report();

  // 4. Clear + insert CampaignData (single record)
  if (stratData) {
    await deleteAll('CampaignData');
    const record = campaignToEntity(stratData, campaignName);
    await base44.entities.CampaignData.create(record);
  }
  report();

  report(); // step 5 = done

  return { stratData, regionsData, factionColors };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function deleteAll(entityName) {
  const existing = await base44.entities[entityName].list();
  if (!existing?.length) return;
  await Promise.all(existing.map(r => base44.entities[entityName].delete(r.id)));
}

async function bulkCreate(entityName, records) {
  // Insert in chunks of 50 to avoid timeouts
  const CHUNK = 50;
  for (let i = 0; i < records.length; i += CHUNK) {
    await base44.entities[entityName].bulkCreate(records.slice(i, i + CHUNK));
  }
}