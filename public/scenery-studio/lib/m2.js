'use strict';
// Medieval II data model: ground type colours, text-file parsers, and locating a map's files.
(function () {
  // Colours the game reads from map_ground_types.tga. `slot` is the entry in
  // descr_aerial_map_ground_types.txt used to texture it (editable in Settings).
  const GROUND_TYPES = [
    { key: 'fertility_low', label: 'Low fertility', rgb: [101, 124, 0], slot: 'fertility_low' },
    { key: 'fertility_medium', label: 'Medium fertility', rgb: [96, 160, 64], slot: 'fertility_medium' },
    { key: 'fertility_high', label: 'High fertility', rgb: [0, 128, 128], slot: 'fertility_high' },
    { key: 'wilderness', label: 'Wilderness', rgb: [0, 0, 0], slot: 'fertility_low' },
    { key: 'mountains_high', label: 'High mountains', rgb: [196, 128, 128], slot: 'mountains_high' },
    { key: 'mountains_low', label: 'Low mountains', rgb: [98, 65, 65], slot: 'mountains_low' },
    { key: 'hills', label: 'Hills', rgb: [128, 128, 64], slot: 'hills' },
    { key: 'forest_dense', label: 'Dense forest', rgb: [0, 64, 0], slot: 'forest_dense' },
    { key: 'forest_sparse', label: 'Sparse forest', rgb: [0, 128, 0], slot: 'forest_sparse' },
    { key: 'swamp', label: 'Swamp', rgb: [0, 255, 128], slot: 'swamp' },
    { key: 'ocean', label: 'Ocean', rgb: [64, 0, 0], water: true },
    { key: 'sea_deep', label: 'Deep sea', rgb: [128, 0, 0], water: true },
    { key: 'sea_shallow', label: 'Shallow sea', rgb: [196, 0, 0], water: true },
    { key: 'beach', label: 'Beach', rgb: [255, 255, 255], slot: 'beach' },
    { key: 'impassable_land', label: 'Impassable land', rgb: [64, 64, 64], slot: 'impassable_land' },
    { key: 'impassable_sea', label: 'Impassable sea', rgb: [0, 0, 64], water: true },
  ];

  const SLOT_LABELS = {
    cultivated_low: 'Farmland, low',
    cultivated_medium: 'Farmland, medium',
    cultivated_high: 'Farmland, high',
    fertility_low: 'Fertility, low',
    fertility_medium: 'Fertility, medium',
    fertility_high: 'Fertility, high',
    forest_dense: 'Forest, dense',
    forest_sparse: 'Forest, sparse',
    hills: 'Hills',
    mountains_high: 'Mountains, high',
    mountains_low: 'Mountains, low',
    swamp: 'Swamp',
    beach: 'Beach',
    scorched: 'Scorched',
    impassable_land: 'Impassable land',
    impassable_sea: 'Impassable sea',
  };

  const prettify = (s) => s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  // ---------- paths (renderer has no node:path) ----------
  const sepOf = (p) => (p.includes('\\') ? '\\' : '/');
  function join(...parts) {
    const sep = sepOf(parts[0] || '');
    return parts.filter(Boolean).map((p, i) => {
      let s = String(p).replace(/[\\/]+/g, sep);
      if (i > 0) s = s.replace(new RegExp('^\\' + sep + '+'), '');
      if (i < parts.length - 1) s = s.replace(new RegExp('\\' + sep + '+$'), '');
      return s;
    }).join(sep);
  }
  function dirname(p) {
    const s = p.replace(/[\\/]+$/, '');
    const i = Math.max(s.lastIndexOf('\\'), s.lastIndexOf('/'));
    return i <= 0 ? s : s.slice(0, i);
  }
  function basename(p) {
    const s = p.replace(/[\\/]+$/, '');
    return s.slice(Math.max(s.lastIndexOf('\\'), s.lastIndexOf('/')) + 1);
  }

  // ---------- text parsing ----------
  function stripComments(txt) {
    return txt.split(/\r?\n/).map((l) => { const i = l.indexOf(';'); return i >= 0 ? l.slice(0, i) : l; });
  }

  // descr_aerial_map_ground_types.txt -> { climateName: { slot: { summer, winter } } }
  function parseAerial(txt) {
    const out = {};
    let cur = null;
    for (const raw of stripComments(txt)) {
      const t = raw.trim();
      if (!t) continue;
      const m = t.match(/^climate\s+(\S+)/i);
      if (m) { cur = out[m[1]] = {}; continue; }
      if (t === '{' || t === '}') continue;
      if (!cur) continue;
      const tok = t.split(/\s+/);
      if (tok.length >= 2) cur[tok[0]] = { summer: tok[1], winter: tok[2] || null };
    }
    return out;
  }

  // descr_climates.txt -> [{ name, rgb, winter, trees }] in the order of the `climates` block.
  // trees: { summer: { sparse_tree: [model.cas], dense_tree: [...], canopy: [...] }, winter: { ... } }
  function parseClimates(txt) {
    const lines = stripComments(txt).map((l) => l.trim());
    const order = [];
    const info = {};
    let i = 0;
    let cur = null;
    while (i < lines.length) {
      const t = lines[i];
      if (/^climates$/i.test(t)) {
        i++;
        while (i < lines.length && lines[i] !== '{') i++;
        i++;
        while (i < lines.length && lines[i] !== '}') { if (lines[i]) order.push(lines[i].split(/\s+/)[0]); i++; }
        i++;
        continue;
      }
      const m = t.match(/^climate\s+(\S+)/i);
      if (m) { cur = info[m[1]] = { name: m[1], rgb: null, winter: false, trees: { summer: {}, winter: {} } }; i++; continue; }
      if (cur) {
        const c = t.match(/^colou?r\s+(\d+)\s+(\d+)\s+(\d+)/i);
        const tr = t.match(/^strategy\s+(summer|winter)\s+(sparse_tree|dense_tree|canopy)\s+(\S+)/i);
        if (c) cur.rgb = [+c[1], +c[2], +c[3]];
        else if (/^winter$/i.test(t)) cur.winter = true;
        else if (tr) (cur.trees[tr[1].toLowerCase()][tr[2].toLowerCase()] ||= []).push(tr[3]);
      }
      i++;
    }
    const names = order.length ? order : Object.keys(info);
    for (const n of Object.keys(info)) if (!names.includes(n)) names.push(n);
    return names.map((n) => info[n] || { name: n, rgb: null, winter: false, trees: { summer: {}, winter: {} } });
  }

  function parseTerrain(txt) {
    const num = (k) => { const m = txt.match(new RegExp(k + '\\s+(-?[\\d.]+)')); return m ? parseFloat(m[1]) : null; };
    return {
      width: num('width'), height: num('height'),
      minSea: num('min_sea_height'), maxLand: num('max_land_height'),
    };
  }

  // descr_regions.txt -> [{ name, settlement, rgb }]
  function parseRegions(txt) {
    // Indentation is optional in the game's format (Mach_0 uses unindented records).
    const lines=txt.split(/\r?\n/).map(l=>l.replace(/;.*$/,'').trim()).filter(Boolean),out=[];
    for(let i=4;i<lines.length;i++){
      const m=lines[i].match(/^(\d+)\s+(\d+)\s+(\d+)$/);
      if(!m||m.slice(1).some(v=>+v>255)||!lines.slice(i-4,i).every(l=>/^[\w-]+$/.test(l)))continue;
      out.push({name:lines[i-4],settlement:lines[i-3],creator:lines[i-2],rgb:m.slice(1).map(Number)});
    }
    return out;
  }

  // descr_cultures.txt -> Map culture -> { levels: { village: path, town: path, ... }, fort, fortWall,
  // fishing, ports: [{ land, sea }] (port levels 2 and up), watchtower }. Paths as written (data/...).
  function parseCultures(txt) {
    const out = new Map();
    let cur = null, level = null, depth = 0, pendingName = null;
    const path = (rest) => rest.split(',')[0].trim();
    for (const raw of txt.split(/\r?\n/)) {
      const l = raw.replace(/;.*$/, '').trim();
      if (!l) continue;
      if (l === '{') { depth++; if (depth === 2) level = pendingName; continue; }
      if (l === '}') { depth--; if (depth < 2) level = null; continue; }
      const m = l.match(/^(\S+)\s*(.*)$/);
      const key = m[1].toLowerCase(), rest = m[2];
      if (depth === 0) {
        if (key === 'culture') { cur = { name: rest.trim(), levels: {}, ports: [] }; out.set(cur.name.toLowerCase(), cur); continue; }
        if (!cur) continue;
        if (key === 'fort') cur.fort = path(rest);
        else if (key === 'fort_wall') cur.fortWall = path(rest);
        else if (key === 'fishing_village') cur.fishing = path(rest);
        else if (key === 'port_land') cur.ports.push({ land: path(rest), sea: null });
        else if (key === 'port_sea' && cur.ports.length) cur.ports[cur.ports.length - 1].sea = path(rest);
        else if (key === 'watchtower') cur.watchtower = path(rest);
      } else if (depth === 1) {
        if (!rest) pendingName = key;
      } else if (depth === 2 && level && cur && key === 'normal') cur.levels[level] = path(rest);
    }
    return out;
  }

  // descr_sm_factions.txt -> Map faction -> { culture, symbol } (symbol relative to data/)
  function parseSmFactions(txt) {
    const out = new Map();
    let cur = null;
    for (const raw of txt.split(/\r?\n/)) {
      const l = raw.replace(/;.*$/, '').trim();
      let m;
      if ((m = l.match(/^faction\s+([^\s,]+)/i))) { cur = { name: m[1] }; out.set(m[1].toLowerCase(), cur); continue; }
      if (!cur) continue;
      if ((m = l.match(/^culture\s+(\S+)/i))) cur.culture = m[1];
      else if ((m = l.match(/^symbol\s+(\S+)/i))) cur.symbol = m[1];
    }
    return out;
  }

  // descr_sm_resources.txt -> Map type -> model path (data/...)
  function parseSmResources(txt) {
    const out = new Map();
    let cur = null;
    for (const raw of txt.split(/\r?\n/)) {
      const l = raw.replace(/;.*$/, '').trim();
      let m;
      if ((m = l.match(/^type\s+(\S+)/i))) { cur = m[1].toLowerCase(); continue; }
      if (cur && (m = l.match(/^item\s+(\S+)/i))) out.set(cur, m[1].split(',')[0]);
    }
    return out;
  }

  // descr_strategy_lighting(_ex).txt -> linear light colours and direction
  function parseLighting(txt, linear) {
    const get = (k, raw) => {
      const m = txt.match(new RegExp('^\\s*' + k + '\\s+(-?[\\d.]+)\\s+(-?[\\d.]+)\\s+(-?[\\d.]+)', 'm'));
      if (!m) return null;
      const v = [+m[1], +m[2], +m[3]];
      return raw || linear || k === 'diffuse_direction' ? v : v.map((x) => Math.pow(Math.max(0, x), 2.2));
    };
    const num = (k) => {
      const m = txt.match(new RegExp('^\\s*' + k + '\\s+(-?[\\d.]+)', 'm'));
      return m ? +m[1] : null;
    };
    const ambient = get('ambient_colour');
    let diffuse = get('diffuse_colour');
    const direction = get('diffuse_direction');
    // The gamma-space file is converted the way M2EX does it (its _ex file documents the result as an
    // "anchor fit"): flat ground under the sun keeps the brightness the 2006 renderer gave it.
    // e.g. vanilla 0.5 / 0.7 gives 0.2176 / 1.0107, the numbers in the game's own _ex file.
    if (!linear && ambient && diffuse && direction) {
      const rawA = get('ambient_colour', true), rawD = get('diffuse_colour', true);
      const len = Math.hypot(direction[0], direction[1], direction[2]) || 1;
      const ly = Math.max(0.05, -direction[1] / len);
      diffuse = rawD.map((d, k) => (Math.pow(Math.max(0, rawA[k] + d * ly), 2.2) - ambient[k]) / ly);
    }
    return {
      linear: !!linear,
      ambient,
      diffuse,
      direction,
      pieceAmbient: get('piece_ambient_colour'),
      pieceDiffuse: get('piece_diffuse_colour'),
      // M2EX extras (_ex file only); the engine clamps shadow and ao to 0..1
      exposure: num('exposure'),
      shadow: num('shadow_strength'),
      ao: num('ao_strength'),
    };
  }

  // ---------- locating files ----------
  const MAP_FILES = ['map_ground_types.tga', 'map_climates.tga'];

  async function hasMapFiles(dir) {
    for (const f of MAP_FILES) if (!(await host.exists(join(dir, f)))) return false;
    return true;
  }

  // Given any folder the user picked, return a list of maps it contains.
  async function findMaps(dir) {
    const maps = [];
    const tryDir = async (d, label) => { if (await hasMapFiles(d)) maps.push({ dir: d, label }); };
    await tryDir(dir, basename(dir));
    if (maps.length) return maps;
    let data = null;
    if (await host.exists(join(dir, 'data', 'world', 'maps'))) data = join(dir, 'data');
    else if (await host.exists(join(dir, 'world', 'maps'))) data = dir;
    if (!data) return maps;
    await tryDir(join(data, 'world', 'maps', 'base'), 'Base map (world/maps/base)');
    for (const group of ['campaign', join('campaign', 'custom')]) {
      const root = join(data, 'world', 'maps', group);
      for (const e of await host.list(root)) {
        if (!e.isDir || e.name.toLowerCase() === 'custom') continue;
        await tryDir(join(root, e.name), (group === 'campaign' ? 'Campaign: ' : 'Custom campaign: ') + e.name);
      }
    }
    return maps;
  }

  // Work out the data folder, mod root and vanilla data folder for a map folder.
  function locate(mapDir) {
    const parts = mapDir.split(/[\\/]/);
    let di = -1;
    for (let i = parts.length - 1; i >= 0; i--) if (parts[i].toLowerCase() === 'data') { di = i; break; }
    const sep = sepOf(mapDir);
    const dataDir = di >= 0 ? parts.slice(0, di + 1).join(sep) : dirname(dirname(dirname(mapDir)));
    const modRoot = dirname(dataDir);
    let gameDataDir = null;
    const parent = dirname(modRoot);
    if (basename(parent).toLowerCase() === 'mods') gameDataDir = join(dirname(parent), 'data');
    return { mapDir, dataDir, modRoot, gameDataDir, baseMapDir: join(dataDir, 'world', 'maps', 'base') };
  }

  // First existing path among candidates.
  async function firstExisting(cands) {
    for (const c of cands) if (c && (await host.exists(c))) return c;
    return null;
  }

  async function resolveTexture(loc, name) {
    if (!name) return null;
    const dirs = [join(loc.dataDir, 'terrain', 'aerial_map', 'ground_types')];
    if (loc.gameDataDir) dirs.push(join(loc.gameDataDir, 'terrain', 'aerial_map', 'ground_types'));
    const cands = [];
    for (const d of dirs) {
      cands.push(join(d, name), join(d, name + '.dds'), join(d, name.replace(/\.tga$/i, '.dds')));
    }
    return firstExisting(cands);
  }

  // ---------------------------------------------------------------- tile models
  // descr_aerial_map_tile_models.txt -> { sets: { name: { flags, models, geoms: { name: { obj, edges, corners } },
  //   links: { name: { geom, rot } }, overlays: { underlay object: [{ obj, water, lava, strips, page }] } } },
  //   pages: { name: { filename, across, up } } }. page: { name, col, row (from the bottom), rot }.
  function parseTileModels(txt) {
    const toks = [];
    for (const line of txt.split(/\r?\n/)) for (const t of line.replace(/;.*$/, '').split(/[\s,]+/)) if (t) toks.push(t);
    let i = 0;
    const block = () => {
      const out = [];
      if (toks[i] !== '{') throw new Error(`descr_aerial_map_tile_models.txt: expected { but found "${toks[i]}"`);
      i++;
      while (i < toks.length && toks[i] !== '}') out.push(toks[i] === '{' ? block() : toks[i++]);
      i++;
      return out;
    };
    const rot = (w) => parseInt(String(w).replace(/^rotation_/i, ''), 10) || 0;
    const sets = {}, pages = {};
    while (i < toks.length) {
      const t = toks[i++].toLowerCase();
      if (t === 'alpha_page') {
        const name = toks[i++].toLowerCase(), b = block(), o = {};
        for (let k = 0; k + 1 < b.length; k += 2) o[String(b[k]).toLowerCase()] = b[k + 1];
        pages[name] = { filename: o.filename, across: +o.cells_across || 1, up: +o.cells_up || 1 };
      } else if (t === 'tile_set') {
        const name = toks[i++].toLowerCase(), b = block();
        const set = { name, flags: [], models: [], geoms: {}, links: {}, overlays: {} };
        for (let k = 0; k < b.length; k++) {
          const x = b[k], w = typeof x === 'string' ? x.toLowerCase() : '';
          if (w === 'model_files') set.models = b[++k].filter((v) => typeof v === 'string');
          else if (w === 'geom') {
            const gn = String(b[++k]).toLowerCase(), g = b[++k];
            const tf = (v) => String(v).toLowerCase() === 'true';
            set.geoms[gn] = { obj: String(g[0]).toLowerCase(), edges: g.slice(1, 5).map(tf),
              corners: String(g[5]).toLowerCase() === 'corners' ? g.slice(6, 10).map(tf) : null };
          } else if (w === 'geom_links') {
            const L = b[++k];
            for (let j = 0; j + 2 < L.length; j += 3) set.links[String(L[j]).toLowerCase()] = { geom: String(L[j + 1]).toLowerCase(), rot: rot(L[j + 2]) };
          } else if (w === 'overlay') {
            const un = String(b[++k]).toLowerCase(), L = b[++k], list = [];
            for (let j = 0; j + 1 < L.length; j += 2) {
              const ov = { obj: String(L[j]).toLowerCase() }, pr = Array.isArray(L[j + 1]) ? L[j + 1] : [];
              for (let q = 0; q < pr.length; q++) {
                const pw = String(pr[q]).toLowerCase();
                if (pw === 'water' || pw === 'lava') ov[pw] = true;
                else if (pw === 'texture_uv_strips') ov.strips = +pr[++q];
                else if (pw === 'relative_lock') ov.lock = +pr[++q];
                else if (pw === 'alpha_page') { ov.page = { name: String(pr[q + 1]).toLowerCase(), col: +pr[q + 2], row: +pr[q + 3], rot: rot(pr[q + 4]) }; q += 4; }
              }
              list.push(ov);
            }
            set.overlays[un] = list;
          } else if (w) set.flags.push(w);
        }
        sets[name] = set;
      }
    }
    return { sets, pages };
  }

  // The engine's own numbering of the tile model links (M2EX.exe's table, in order from 0): map.rwm stores
  // one of these numbers per tile, or 65535 for none.
  const TILE_LINKS = [
    ['river_a', 'line_top line_b_top line_c_top line_bg_top line_bi_top line_ag_top line_ah_top line_ai_top line_cg_top line_ch_top line_ci_top line_bottom line_b_bottom line_c_bottom line_bg_bottom line_bi_bottom line_ag_bottom line_ah_bottom line_ai_bottom line_cg_bottom line_ch_bottom line_ci_bottom line_left line_b_left line_c_left line_bg_left line_bi_left line_ag_left line_ah_left line_ai_left line_cg_left line_ch_left line_ci_left line_right line_b_right line_c_right line_bg_right line_bi_right line_ag_right line_ah_right line_ai_right line_cg_right line_ch_right line_ci_right bend_cw_tl bend_cw_b_tl bend_cw_c_tl bend_cw_d_tl bend_cw_tr bend_cw_b_tr bend_cw_c_tr bend_cw_d_tr bend_cw_bl bend_cw_b_bl bend_cw_c_bl bend_cw_d_bl bend_cw_br bend_cw_b_br bend_cw_c_br bend_cw_d_br bend_acw_tl bend_acw_b_tl bend_acw_c_tl bend_acw_d_tl bend_acw_tr bend_acw_b_tr bend_acw_c_tr bend_acw_d_tr bend_acw_bl bend_acw_b_bl bend_acw_c_bl bend_acw_d_bl bend_acw_br bend_acw_b_br bend_acw_c_br bend_acw_d_br split_in_t_out_lr split_in_t_out_lb split_in_t_out_rb split_in_b_out_lr split_in_b_out_lt split_in_b_out_rt split_in_l_out_tb split_in_l_out_tr split_in_l_out_br split_in_r_out_tb split_in_r_out_tl split_in_r_out_bl join_out_t_in_lr join_out_t_in_lb join_out_t_in_rb join_out_b_in_lr join_out_b_in_lt join_out_b_in_rt join_out_l_in_tb join_out_l_in_tr join_out_l_in_br join_out_r_in_tb join_out_r_in_tl join_out_r_in_bl source_top source_bottom source_left source_right end_top end_bottom end_left end_right ford_top ford_bottom ford_left ford_right'],
    ['wall_a', 'end_top end_bottom end_left end_right corner_tl corner_tr corner_bl corner_br line_horiz line_vert t_top t_bottom t_left t_right cross line_tower_horiz line_tower_vert line_gate_horiz line_gate_vert solo river_a_line_top river_a_line_bottom river_a_line_left river_a_line_right'],
    ['volcano', 'top_left top top_right left centre right bottom_left bottom bottom_right'],
    ['volcano_dormant', 'top_left top top_right left centre right bottom_left bottom bottom_right'],
    ['cliffs', 'wall_1_top wall_1_bottom wall_1_left wall_1_right corner_1_tl corner_1_tr corner_1_bl corner_1_br outcrop_1_top outcrop_1_bottom outcrop_1_left outcrop_1_right pillar_1 bridge_1_horizontal bridge_1_vertical end_cw_1_top end_cw_1_bottom end_cw_1_left end_cw_1_right end_acw_1_top end_acw_1_bottom end_acw_1_left end_acw_1_right end_dbl_1_top end_dbl_1_bottom end_dbl_1_left end_dbl_1_right'],
    ['mountains', 'line0_0 line0_90 line0_180 line0_270 line1_0 line1_90 line1_180 line1_270 line2_0 line2_90 line2_180 line2_270 line3_0 line3_90 line3_180 line3_270 l0_0 l0_90 l0_180 l0_270 l1_0 l1_90 l1_180 l1_270 l2_0 l2_90 l2_180 l2_270 l3_0 l3_90 l3_180 l3_270 lr0_0 lr0_90 lr0_180 lr0_270 lr1_0 lr1_90 lr1_180 lr1_270 lr2_0 lr2_90 lr2_180 lr2_270 lr3_0 lr3_90 lr3_180 lr3_270 t0_0 t0_90 t0_180 t0_270 t1_0 t1_90 t1_180 t1_270 t2_0 t2_90 t2_180 t2_270 t3_0 t3_90 t3_180 t3_270 s0_0 s0_90 s0_180 s0_270 s1_0 s1_90 s1_180 s1_270 s2_0 s2_90 s2_180 s2_270 s3_0 s3_90 s3_180 s3_270 sr0_0 sr0_90 sr0_180 sr0_270 sr1_0 sr1_90 sr1_180 sr1_270 sr2_0 sr2_90 sr2_180 sr2_270 sr3_0 sr3_90 sr3_180 sr3_270 square0_0 square0_90 square0_180 square0_270 square1_0 square1_90 square1_180 square1_270 square2_0 square2_90 square2_180 square2_270 square3_0 square3_90 square3_180 square3_270 single_0 single_90 single_180 single_270'],
    ['hills', 'hill1 hill2 hill3 hill4 hill5 hill6 hill7 hill8 hill9 hill10 hill11 hill12 hill13tl hill13tr hill13bl hill13br hill14tl hill14tr hill14bl hill14br hill15tl hill15tr hill15bl hill15br hill16tl hill16tr hill16bl hill16br hills1 hills2 hills3 hills4 crag1 crag2 crag3 crag4 crag5 crag6 crag7 crag8'],
  ];
  const TILE_LINK_LIST = [];
  for (const [set, names] of TILE_LINKS) for (const n of names.split(' ')) TILE_LINK_LIST.push([set, n]);

  // map.rwm (the map the game builds from the map images) -> { width, height, ids: Uint16Array, top row first },
  // ids being TILE_LINK_LIST numbers. The file's layout is not documented; what is used here: the width and
  // height at bytes 29 and 33, and a table of 20 bytes a tile, bottom row first, holding the tile model at
  // bytes 1-2 and the ground type at byte 19. The table is found by its shape. null when it isn't found.
  function readRwmTiles(b) {
    if (!b || b.length < 64) return null;
    const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
    const W = dv.getUint32(29, true), H = dv.getUint32(33, true);
    if (!(W > 0 && H > 0 && W < 10000 && H < 10000)) return null;
    const N = W * H, size = N * 20, nLinks = TILE_LINK_LIST.length;
    if (b.length < size + 37) return null;
    // Bytes 3-6 hold the region index. M2EX maps can have more than 255 regions:
    // byte 4 is then nonzero, so the original Painter signature rejected Mach_0.
    // The ground byte also carries flag 0x40; the final Mach_0 tile has it set.
    const ok = (r) => b[r + 5] === 0 && b[r + 6] === 0 && b[r + 18] === 0 && (b[r + 19] & 0x3f) < 32 && (() => { const v = b[r + 1] | (b[r + 2] << 8); return v === 0xffff || v < nLinks; })();
    // a run of 256 good records most of which have no model, then the run's end (two bad records in a row)
    // less the table size
    const none = (r) => b[r + 1] === 255 && b[r + 2] === 255;
    let found = -1;
    for (let p = 37; p + 256 * 20 <= b.length; p++) {
      if (!ok(p) || !none(p)) continue;
      let k = 1, n = 1;
      while (k < 256 && ok(p + k * 20)) { if (none(p + k * 20)) n++; k++; }
      if (k === 256 && n > 200) { found = p; break; }
    }
    if (found < 0) return null;
    let e = found;
    while (e + 20 <= b.length && (ok(e) || (e + 40 <= b.length && ok(e + 20)))) e += 20;
    const start = e - size;
    if (start < 37 || start > found) return null;
    for (let k = 0; k < 64; k++) if (!ok(start + k * 20)) return null;
    const ids = new Uint16Array(N), gtype = new Uint8Array(N);
    for (let y = 0; y < H; y++) {
      const row = H - 1 - y;
      for (let x = 0; x < W; x++) {
        const r = start + (row * W + x) * 20;
        ids[y * W + x] = b[r + 1] | (b[r + 2] << 8);
        gtype[y * W + x] = b[r + 19];
      }
    }
    return { width: W, height: H, ids, gtype, start };
  }


  // ---- rivers (map_features.tga: 0,0,255 river, 0,255,255 ford, 255,255,255 source, one tile each)
  // RIVER_* kinds per tile: 0 none, 1 river, 2 ford, 3 source
  // 4 is a land bridge (green): not part of any river
  const RIVER_KIND = (r, g, b) => (r === 0 && g === 0 && b === 255) ? 1 : (r === 0 && g === 255 && b === 255) ? 2 : (r === 255 && g === 255 && b === 255) ? 3 : (r === 0 && g === 255 && b === 0) ? 4 : 0;
  const RIVER_RGB = [null, [0, 0, 255], [0, 255, 255], [255, 255, 255], [0, 255, 0]];
  // the river_a piece the game puts on each river tile, worked out from the features image the way the
  // game's own map.rwm files show it does (checked against Bare Geomod's base map: 2457 of 2458 tiles):
  // the water flows to the sea when the river reaches it, otherwise away from its source; straight pieces
  // are named by the flow (flowing west = line_bottom, north = line_left, south = line_right, east = line_top),
  // and their variants carry the channel across tile edges (an exit g/i/h meets an entry c/a/mid).
  // kinds: Uint8Array(W*H) RIVER kinds, sea(i) true for sea tiles; prev: the ids map.rwm holds; keep(i): the
  // tile's piece in prev still fits (nothing changed around it). Returns new ids.
  function riverLinks(kinds, W, H, sea, prev, keep) {
    if (kinds.some((k) => k > 3)) kinds = kinds.map((k) => (k > 3 ? 0 : k)); // land bridges are no river
    const idOf = new Map(TILE_LINK_LIST.map(([s, n], i) => [`${s}/${n}`, i]));
    const nameOf = (id) => (id < TILE_LINK_LIST.length && TILE_LINK_LIST[id][0] === 'river_a') ? TILE_LINK_LIST[id][1] : null;
    const ids = Uint16Array.from(prev || new Uint16Array(W * H).fill(0xffff));
    const N = W * H, D = [[0, -1, 't'], [1, 0, 'r'], [0, 1, 'b'], [-1, 0, 'l']];
    const OPP = { t: 'b', b: 't', l: 'r', r: 'l' };
    const nb = (i, k) => { const x = i % W + D[k][0], y = ((i / W) | 0) + D[k][1]; return x < 0 || y < 0 || x >= W || y >= H ? -1 : y * W + x; };
    // flow: distance from the sea (negative, so it grows downstream), else from a source
    const dist = new Float64Array(N).fill(NaN);
    let q = [];
    for (let i = 0; i < N; i++) if (kinds[i] && [0, 1, 2, 3].some((k) => { const j = nb(i, k); return j >= 0 && sea(j); })) { dist[i] = 0; q.push(i); }
    for (let h = 0; h < q.length; h++) { const i = q[h]; for (let k = 0; k < 4; k++) { const j = nb(i, k); if (j >= 0 && kinds[j] && isNaN(dist[j])) { dist[j] = dist[i] - 1; q.push(j); } } }
    q = [];
    for (let i = 0; i < N; i++) if (kinds[i] === 3 && isNaN(dist[i])) { dist[i] = -1e6; q.push(i); }
    for (let h = 0; h < q.length; h++) { const i = q[h]; for (let k = 0; k < 4; k++) { const j = nb(i, k); if (j >= 0 && kinds[j] && isNaN(dist[j])) { dist[j] = dist[i] + 1; q.push(j); } } }
    // rivers with neither: from one of their ends
    for (let i = 0; i < N; i++) {
      if (!kinds[i] || !isNaN(dist[i])) continue;
      let s = i;
      { const seen = new Set([i]), st = [i]; while (st.length) { const c = st.pop(); let n = 0; for (let k = 0; k < 4; k++) { const j = nb(c, k); if (j >= 0 && kinds[j]) { n++; if (!seen.has(j)) { seen.add(j); st.push(j); } } } if (n <= 1) { s = c; break; } } }
      dist[s] = -2e6; q = [s];
      for (let h = 0; h < q.length; h++) { const c = q[h]; for (let k = 0; k < 4; k++) { const j = nb(c, k); if (j >= 0 && kinds[j] && isNaN(dist[j])) { dist[j] = dist[c] + 1; q.push(j); } } }
    }
    const LINE = { l: 'bottom', t: 'left', b: 'right', r: 'top' };
    const BEND = { rt: 'cw_?_bl', bl: 'acw_?_tr', tl: 'cw_?_br', rb: 'acw_?_tl', tr: 'acw_?_bl', lb: 'cw_?_tr', lt: 'acw_?_br', br: 'cw_?_tl' };
    const hash = (i, n) => { let h = (i * 2654435761) >>> 0; h ^= h >>> 15; return (h >>> 0) % n; };
    const order = [];
    for (let i = 0; i < N; i++) if (kinds[i]) order.push(i);
    order.sort((a, b) => dist[a] - dist[b]);
    // straight pieces: entry a/b/c and exit g/h/i
    const lineVar = (name) => {
      const m = /^line_(?:([abc])([ghi])?_)?(?:top|bottom|left|right)$/.exec(name || '');
      if (!m) return null;
      return m[2] ? { e: m[1], x: m[2] } : { e: 'b', x: 'h' };
    };
    const NEXT = { g: 'c', i: 'a', h: 'b' }, PREV = { c: 'g', a: 'i', b: 'h' };
    const kind = new Map(); // i -> 'line' | other, for the regenerated tiles
    const info = (i) => {
      const d = dist[i], ups = [], dns = [];
      for (let k = 0; k < 4; k++) { const j = nb(i, k); if (j < 0 || !kinds[j]) continue; if (dist[j] < d) ups.push(D[k][2]); else if (dist[j] > d) dns.push(D[k][2]); }
      return { ups, dns };
    };
    const shape = new Map();
    for (const i of order) {
      const { ups, dns } = info(i);
      let s = null;
      if (kinds[i] === 3 && dns.length === 1 && !ups.length) s = { t: 'source', n: `source_${LINE[dns[0]]}` };
      else if (ups.length === 1 && dns.length === 1) {
        const dir = OPP[ups[0]], out = dns[0];
        if (dir === out) s = kinds[i] === 2 ? { t: 'ford', n: `ford_${LINE[out]}` } : { t: 'line', dir: LINE[out], up: ups[0], dn: dns[0] };
        else s = { t: 'bend', n: `bend_${BEND[ups[0] + out]}` };
      } else if (ups.length === 1 && !dns.length) s = { t: 'end', n: `end_${LINE[OPP[ups[0]]]}` };
      else if (!ups.length && dns.length === 1) s = { t: 'source', n: `source_${LINE[dns[0]]}` };
      else if (ups.length === 2 && dns.length === 1) s = { t: 'join', n: ['join_out_' + dns[0] + '_in_' + ups[0] + ups[1], 'join_out_' + dns[0] + '_in_' + ups[1] + ups[0]] };
      else if (ups.length === 1 && dns.length === 2) s = { t: 'split', n: ['split_in_' + ups[0] + '_out_' + dns[0] + dns[1], 'split_in_' + ups[0] + '_out_' + dns[1] + dns[0]] };
      shape.set(i, s);
    }
    const isLine = (j) => j >= 0 && shape.get(j) && shape.get(j).t === 'line';
    const keptLine = (j) => j >= 0 && keep && keep(j) && lineVar(nameOf(prev[j]));
    const out = new Map();
    for (let i = 0; i < N; i++) if (prev && nameOf(prev[i]) && (!kinds[i] || !(keep && keep(i)))) ids[i] = 0xffff;
    for (const i of order) {
      const s = shape.get(i);
      if (keep && keep(i) && nameOf(prev[i])) { out.set(i, nameOf(prev[i])); continue; }
      let name = null;
      if (!s) name = null;
      else if (s.t === 'line') {
        const upJ = nb(i, D.findIndex((d) => d[2] === s.up)), dnJ = nb(i, D.findIndex((d) => d[2] === s.dn));
        const upV = isLine(upJ) || keptLine(upJ) ? lineVar(out.get(upJ) || nameOf(prev[upJ])) : null;
        const e = upV ? NEXT[upV.x] : 'b';
        let x;
        const dnK = keptLine(dnJ) && keep(dnJ) ? lineVar(nameOf(prev[dnJ])) : null;
        if (dnK) x = PREV[dnK.e];
        else if (isLine(dnJ)) x = 'ghi'[hash(i, 3)];
        else x = 'h';
        const v = e === 'b' && x === 'h' ? ['', 'b_', 'c_'][hash(i + 7, 3)] : `${e}${x}_`;
        name = `line_${v}${s.dir}`;
      } else if (s.t === 'bend') name = s.n.replace('?_', ['', 'b_', 'c_', 'd_'][hash(i, 4)]);
      else if (Array.isArray(s.n)) name = s.n.find((n) => idOf.has(`river_a/${n}`)) || null;
      else name = s.n;
      if (name && idOf.has(`river_a/${name}`)) { ids[i] = idOf.get(`river_a/${name}`); out.set(i, name); }
      else ids[i] = 0xffff;
    }
    return ids;
  }

  window.M2 = {
    GROUND_TYPES, SLOT_LABELS, prettify,
    join, dirname, basename,
    parseAerial, parseClimates, parseTerrain, parseRegions, parseLighting, parseCultures, parseSmFactions, parseSmResources,
    parseTileModels, readRwmTiles, TILE_LINK_LIST, riverLinks, RIVER_KIND, RIVER_RGB,
    findMaps, locate, firstExisting, resolveTexture,
  };
})();
