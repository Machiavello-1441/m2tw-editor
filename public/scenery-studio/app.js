'use strict';
/* global host, Images, M2, MapView, CAS */
(function () {
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));
  const LAYER = MapView.LAYER_SIZE;

  // ---------------------------------------------------------------- state
  const state = {
    settings: {},
    project: null,      // loaded map
    layers: [],         // [{ name, file, img, thumb, missing }]
    layerByName: new Map(),
    brush: { gt: -1, cl: -1, label: '', sub: '', thumb: '' },
    clBrush: -1, // the climate the Climates brush paints (its own, so the texture brush is kept)
    tool: 'brush',
    season: 'summer',
    undo: [], redo: [],
    ownWrites: new Map(), // path -> time we last wrote it (to ignore our own watcher events)
    hover: null,
    pen: null,
    target: 'tex',      // what the brush paints: 'tex' (ground types / climates) or 'height'
    tips: [],           // imported alpha brushes [{ name, file, size, mask, canvas, thumb }]
    guides: [],         // guide images on this map, bottom first [{ name, file, cx, cy, w, h, ang, opacity, visible, srcW, srcH, tex, thumb }]
    guidesKey: null,    // the map the guides belong to
    guidesHidden: false,
    adjust: null,       // { g, history } while a guide is being moved and sized
  };
  const DEFAULTS = {
    brushSize: 4, brushDensity: 100, brushHard: 70, pressureSize: true, pressureDensity: false,
    protectCoast: true, rebuildRwm: true, bakeTrees: true, treeGameMatch: true, texScale: 8, relief: 1, sunAz: 315, sunEl: 45, exposure: 1, treeBrightness: 1, treeContrast: 1, treeSat: 1, treeHue: 0, seaBright: 1, seaContrast: 1, seaSat: 1, seaHue: 0, forestOn: false, forestKind: 'both', forestWith: 'nearest', groundTexAdj: {}, groundBright: 1, groundContrast: 1, groundSat: 1, groundHue: 0, pieces: true, riverShape: 'pencil', cityNames: false, regionNames: false, symbols: false, fortModel: 'culture', fortModels: [], tileModels: true, unlistedLevel: 'town', stratCampaign: '',
    heightBlend: true, rivers: true, borders: false, grid: false, settlements: true, climateTint: false,
    matcap: 'clay', cavity: false, cavityStrength: 1, gridTiles: 32,
    rampOn: false, ramps: {}, coastOn: false, coastSide: 'land', coastDist: 2, coastFalloff: 'constant', coastShow: true, maskMode: 'off', maskThr: 0, maskShow: true, maskLo: 0, maskHi: 1000, maskSoft: 0,
    useModLighting: true, slotMap: {}, recent: [], onlyOnMap: true,
    heightTool: 'raise', heightStrength: 20, heightHard: 20, heightTarget: 100, pressureStrength: true, moveCoast: true,
    seaOverlay: false, exag3d: 1, detail3d: 1,
    tip: 'round', tipAngle: 0, tipRandom: false, tipSpacing: 25, tipInvert: {}, strokeMode: 'free',
    guides: {},         // map folder -> saved guide images
    trees: true,
    gameLook: true,     // 3D view matches the game's campaign map renderer
    fowFaction: '',     // fog of war as seen by this faction ('' = off)
  };
  const S = () => state.settings;
  // The game draws the campaign trees lighter and warmer than the painter's copy of its tree shader gives.
  // Measured 2026-11-12 on the user's New_Mount screenshots (two painter/game pairs of the same kind of
  // view): grass matched within 3%, but forest areas were lighter relative to the grass in the game by
  // 1.21/1.13/1.02 and 1.30/1.18/1.08 (R/G/B, linear light). Trees cover about three quarters of a forest
  // area, so the trees themselves need about this much more light. Game look only; Settings can turn it off.
  const TREE_VIEW_MATCH = [1.33, 1.21, 1.06];
  let saveSettingsTimer = 0;
  function saveSettings() {
    clearTimeout(saveSettingsTimer);
    saveSettingsTimer = setTimeout(() => host.saveSettings(state.settings), 300);
  }

  let view;
  const glCanvas = $('#gl');
  const overlay = $('#overlay');
  let octx = overlay.getContext('2d'); // let: an overhead picture borrows it for a moment (takePicture)

  // ---------------------------------------------------------------- ui helpers
  let toastTimer = 0;
  function toast(msg, kind = '', ms = 4000) {
    const t = $('#toast');
    t.textContent = msg; t.className = kind; t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, ms);
  }
  function loading(text) {
    $('#loading').hidden = !text;
    if (text) $('#loadingText').textContent = text;
  }
  function modal(title, bodyEl) {
    onModalClose = null;
    $('#modalTitle').textContent = title;
    const b = $('#modalBody'); b.innerHTML = ''; b.appendChild(bodyEl);
    $('#modal').hidden = false;
  }
  let onModalClose = null;
  function closeModal() {
    $('#modal').hidden = true;
    const cb = onModalClose; onModalClose = null;
    if (cb) cb();
  }
  $('#modalClose').onclick = closeModal;
  $('#modal').addEventListener('mousedown', (e) => { if (e.target.id === 'modal') closeModal(); });
  function el(tag, attrs = {}, ...kids) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class') e.className = v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else if (k === 'text') e.textContent = v;
      else e.setAttribute(k, v);
    }
    for (const k of kids) if (k != null) e.append(k);
    return e;
  }
  const norm = (p) => (p || '').replace(/\//g, '\\').toLowerCase();
  const rgbCss = (c) => (c ? `rgb(${c[0]},${c[1]},${c[2]})` : '#444');

  // ---------------------------------------------------------------- loading a map
  // In-app folder browser: detected mods, a path box, and a clickable folder list.
  async function openDialog() {
    const body = el('div', { class: 'browser' });
    const pathBox = el('input', { type: 'text', class: 'path-box', placeholder: 'Paste a folder path, e.g. C:\\…\\mods\\bare_geomod' });
    const listEl = el('div', { class: 'dir-list' });
    const openBtn = el('button', { class: 'primary' }, 'Open this folder');
    const upBtn = el('button', {}, 'Up');
    let roots = { roots: [], sep: '\\' };
    try { roots = await host.roots(); } catch {}
    const go = async (dir) => {
      pathBox.value = dir || '';
      listEl.innerHTML = '';
      if (!dir) {
        for (const r of roots.roots) listEl.append(el('div', { class: 'dir-row', onclick: () => go(r) }, '💽 ' + r));
        if (roots.home) listEl.append(el('div', { class: 'dir-row', onclick: () => go(roots.home) }, '🏠 ' + roots.home));
        return;
      }
      const entries = (await host.list(dir)).filter((e) => e.isDir).sort((a, b) => a.name.localeCompare(b.name));
      if (!entries.length) listEl.append(el('div', { class: 'muted', text: 'No folders here.' }));
      for (const e of entries) listEl.append(el('div', { class: 'dir-row', onclick: () => go(M2.join(dir, e.name)) }, '📁 ' + e.name));
    };
    const parentOf = (d) => { const p = M2.dirname(d); return p === d || /^[A-Za-z]:\\?$/.test(d) || d === '/' ? '' : (p.length === 2 && p[1] === ':' ? p + '\\' : p); };
    upBtn.onclick = () => go(pathBox.value ? parentOf(pathBox.value.replace(/[\\/]+$/, '') || pathBox.value) : '');
    pathBox.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(pathBox.value.trim()); });
    openBtn.onclick = async () => {
      const dir = pathBox.value.trim();
      if (!dir) return;
      closeModal();
      S().lastDir = dir; saveSettings();
      await openAny(dir);
    };
    const quick = el('div', { class: 'quick' });
    try {
      const games = await host.detectGame();
      for (const g of games) {
        for (const m of g.mods) quick.append(el('button', { onclick: () => { closeModal(); openAny(m.path); } }, m.name));
      }
    } catch {}
    if (quick.childElementCount) body.append(el('div', { class: 'muted', text: 'Mods found on this PC' }), quick);
    body.append(el('div', { class: 'path-row' }, upBtn, pathBox), listEl, el('div', { class: 'browser-foot' },
      el('span', { class: 'muted', text: 'Pick a mod folder, a data folder, or a folder with map_ground_types.tga.' }), openBtn));
    modal('Open a map', body);
    await go(S().lastDir || '');
  }

  async function openAny(dir) {
    const maps = await M2.findMaps(dir);
    if (!maps.length) {
      toast('No campaign map found there. Pick a mod folder or a folder with map_ground_types.tga and map_climates.tga.', 'err', 7000);
      return;
    }
    if (maps.length === 1) return loadMap(maps[0].dir);
    const list = el('div', { class: 'map-list' });
    for (const m of maps) {
      list.append(el('button', { class: 'pick-row', onclick: () => { closeModal(); loadMap(m.dir); } },
        el('span', { text: m.label }), el('span', { class: 'muted', text: m.dir })));
    }
    modal('Which map?', list);
  }

  async function confirmDiscard() {
    // A scenery preview may have suggested texture bakes without any painting.
    // Actual terrain edits still use the painter's confirmation; scenery drafts
    // are saved or cancelled separately by Portable.beforeMap.
    const p=state.project;
    if(document.body.classList.contains('scenery-mode')&&p&&!p.dirty.gt&&!p.dirty.cl&&!p.dirty.h&&!p.pc?.dirty&&!p.pc?.regDirty&&!p.riv?.dirty&&!p.namesDirty&&!p.regStructDirty)return true;
    if (!isDirty()) return true;
    const r = await ask('You have unsaved painting.', 'Save it to the map files first?', ['Save', 'Discard', 'Cancel']);
    if (r === 2) return false;
    if (r === 0) return save();
    return true;
  }

  async function readMapTGA(path) {
    const bytes = await host.read(path);
    return Images.decodeTGA(bytes);
  }

  async function loadMap(mapDir) {
    if (!(await confirmDiscard())) return;
    if (!(await Portable.beforeMap(mapDir))) return;
    const loc = M2.locate(mapDir);
    loading('Reading map files…');
    try {
      const J = M2.join;
      const dataCands = (rel) => [J(loc.dataDir, rel), loc.gameDataDir && J(loc.gameDataDir, rel)];
      const fAerial = await M2.firstExisting(dataCands('descr_aerial_map_ground_types.txt'));
      const fClimates = await M2.firstExisting(dataCands('descr_climates.txt'));
      const fTerrain = await M2.firstExisting([J(mapDir, 'descr_terrain.txt'), J(loc.baseMapDir, 'descr_terrain.txt')]);
      const fRegions = await M2.firstExisting([J(mapDir, 'descr_regions.txt'), J(loc.baseMapDir, 'descr_regions.txt')]);
      const fLightEx = await M2.firstExisting(dataCands('descr_strategy_lighting_ex.txt'));
      const fLight = fLightEx || (await M2.firstExisting(dataCands('descr_strategy_lighting.txt')));
      if (!fAerial) throw new Error('descr_aerial_map_ground_types.txt was not found in the mod or game data folder.');
      if (!fClimates) throw new Error('descr_climates.txt was not found in the mod or game data folder.');

      const aerial = M2.parseAerial(await host.readText(fAerial));
      const climateDefs = M2.parseClimates(await host.readText(fClimates));
      const terrain = fTerrain ? M2.parseTerrain(await host.readText(fTerrain)) : {};
      const regionsTxt = fRegions ? await host.readText(fRegions) : '';
      const regionDefs = fRegions ? M2.parseRegions(regionsTxt) : [];
      const lighting = fLight ? M2.parseLighting(await host.readText(fLight), !!fLightEx) : null;

      const gtFile = await Portable.mapFile(mapDir, 'map_ground_types.tga');
      const clFile = await Portable.mapFile(mapDir, 'map_climates.tga');
      const gtImg = await readMapTGA(gtFile);
      const clImg = await readMapTGA(clFile);
      const W = gtImg.width, H = gtImg.height;
      if (clImg.width !== W || clImg.height !== H) throw new Error(`map_climates.tga is ${clImg.width}×${clImg.height} but map_ground_types.tga is ${W}×${H}.`);

      // ground types -> indices
      const gtTable = M2.GROUND_TYPES.map((g) => ({ ...g }));
      const gtIdx = indexColours(gtImg.data, gtTable, (rgb) => ({
        key: 'unknown_' + rgb.join('_'), label: `Unknown colour ${rgb.join(',')}`, rgb, unknown: true,
      }));
      // climates -> indices
      const climates = climateDefs.filter((c) => c.rgb).map((c) => ({ ...c, label: M2.prettify(c.name) }));
      const clIdx = indexColours(clImg.data, climates, (rgb) => ({
        name: 'unknown_' + rgb.join('_'), label: `Unknown climate ${rgb.join(',')}`, rgb, winter: false, unknown: true,
      }));
      const clCounts = new Uint32Array(64);
      for (let i = 0; i < clIdx.length; i++) clCounts[clIdx[i]]++;

      loading('Reading heights…');
      const heights = await loadHeights(mapDir, W, H, terrain, gtIdx, gtTable);

      loading('Reading regions…');
      let regions = null, features = null;
      const fReg = await M2.firstExisting([J(mapDir, 'map_regions.tga'), J(loc.baseMapDir, 'map_regions.tga')]);
      if (fReg) regions = await readMapTGA(fReg);
      const fFeat = await M2.firstExisting([J(mapDir, 'map_features.tga'), J(loc.baseMapDir, 'map_features.tga')]);
      if (fFeat) features = await readMapTGA(fFeat);
      const regionByColour = new Map(regionDefs.map((r) => [r.rgb.join(','), r]));

      const project = {
        loc, mapDir, W, H, gtFile, clFile, files: { fAerial, fClimates, fTerrain, fRegions, fLight },
        aerial, climates, gtTable, gtIdx, clIdx, clCounts, heights, terrain, regions, features, regionByColour, lighting,
        gtMeta: gtImg.tga, clMeta: clImg.tga, dirty: { gt: false, cl: false, h: false },
        regText: fRegions ? { src: fRegions, lines: regionsTxt.split(/\r?\n/), eol: /\r\n/.test(regionsTxt) ? '\r\n' : '\n' } : null,
        shallowIdx: gtTable.findIndex((g) => g.key === 'sea_shallow'),
      };
      state.project = project;
      state.undo = []; state.redo = [];
      colourBase = colourSnap();
      lightBase = null; lightOrig = null;
      if ($('#lightPanel') && !$('#lightPanel').hidden) setTimeout(() => renderLightPanel(), 0);

      if (!view) { view = new MapView(glCanvas); loadColorGrid(); applyMatcap(); }
      view.setMap(W, H, gtIdx, clIdx, heights.data);
      view.hMin = heights.min; view.hMax = heights.max;
      const blank = new Uint8Array(4 * 4);
      if (regions) view.setRegions(regions.width, regions.height, regions.data); else view.setRegions(2, 2, blank);
      if (features) view.setFeatures(features.width, features.height, features.data); else view.setFeatures(2, 2, blank);
      setPalettes();
      applyViewSettings();

      loading('Loading textures…');
      await groundManifest();
      await loadAllTextures();
      applyViewSettings();
      buildLUT();
      buildKey();
      view.fit();
      if (!$('#colourPanel').hidden) renderColourPanel();
      coastCache = null; setCoast(!!S().coastOn);
      clearPieceCache();
      $('#forestKind').value = S().forestKind || 'both'; $('#forestWith').value = S().forestWith || 'nearest'; setForest(!!S().forestOn);
      for (const k of Object.keys(ADJ_PANELS)) if (!$(ADJ_PANELS[k].box).hidden) renderAdjPanel(k);
      loading('Loading trees…');
      try { await loadTrees(); } catch (e) { console.error(e); toast('The tree models could not be loaded: ' + e.message, 'err', 8000); }
      loading('Loading the game look…');
      try { await loadGameAssets(); } catch (e) { console.error(e); toast('The game look could not be loaded: ' + e.message, 'err', 8000); }
      setupWatch();
      if (window.syncMaskUI) window.syncMaskUI(); // height mask sliders follow this map's height range
      // Portable preview leaves native terrain caches untouched.
      await loadGuides(mapDir);
      await loadFogMask(mapDir);
      farmLoad(mapDir);

      $('#welcome').hidden = true;
      rampSel = -1; renderRamp();
      $('#stMap').textContent = `${M2.basename(loc.modRoot)} · ${M2.basename(mapDir)} · ${(W - 1) / 2}×${(H - 1) / 2} tiles`;
      {
        // the map's own name: its folder under world\maps (base, custom\Region_Test …), with the mod
        const mm = /[\\/]world[\\/]maps[\\/](.+)$/i.exec(mapDir.replace(/[\\/]+$/, ''));
        const mapName = mm ? mm[1].replace(/\//g, '\\') : M2.basename(mapDir);
        const el = $('#mapName');
        el.textContent = `${mapName}  ·  ${M2.basename(loc.modRoot)}`;
        el.title = mapDir; el.hidden = false;
        document.title = `${mapName} (${M2.basename(loc.modRoot)}) — Scenery Studio`;
      }
      const recent = (S().recent || []).filter((r) => r !== mapDir);
      recent.unshift(mapDir); S().recent = recent.slice(0, 8); saveSettings();
      updateButtons();
      if (state.target === 'height' && !heights.editable) setTarget('tex');
      const missing = state.layers.filter((l) => l.missing).length;
      if (missing) toast(`${missing} texture file(s) named in descr_aerial_map_ground_types.txt could not be found. They show as magenta.`, 'err', 8000);
    } catch (e) {
      console.error(e);
      toast('Could not open the map: ' + e.message, 'err', 10000);
    } finally {
      loading(null);
    }
  }

  // Map RGBA pixels to palette indices. table entries need .rgb; unknown colours get appended.
  function indexColours(data, table, makeUnknown) {
    const lookup = new Map(table.map((t, i) => [(t.rgb[0] << 16) | (t.rgb[1] << 8) | t.rgb[2], i]));
    const n = data.length / 4;
    const out = new Uint8Array(n);
    for (let i = 0, p = 0; i < n; i++, p += 4) {
      const key = (data[p] << 16) | (data[p + 1] << 8) | data[p + 2];
      let idx = lookup.get(key);
      if (idx === undefined) {
        if (table.length < 63) {
          table.push(makeUnknown([data[p], data[p + 1], data[p + 2]]));
          idx = table.length - 1;
        } else idx = 0;
        lookup.set(key, idx);
      }
      out[i] = idx;
    }
    return out;
  }

  // Height encodings, checked against Bare Geomod's files:
  //  map_heights.tga (read by the game): land is grey, value = height / max_land_height * 255;
  //    sea (height <= 0) is pure blue, blue = 255 - depth / -min_sea_height * 254.
  //  map_heights.hgt: int32 width, int32 height, float32 heights, bottom row first.
  //  map_heights_ex.png: 16-bit grey, (height - min_sea) / (max_land - min_sea) * 65535, top row first.
  function heightCodec(terrain) {
    const maxLand = terrain.maxLand, minSea = terrain.minSea;
    const ok = maxLand > 0 && minSea < 0;
    return {
      ok, maxLand, minSea,
      fromTGA(r, g, b) {
        if (r === g && g === b) return r === 0 ? 0.01 : (r / 255) * maxLand;
        if (r === 0 && g === 0) return -((255 - b) / 254) * -minSea;
        return ((r + g + b) / 765) * maxLand;
      },
      toTGA(h, out, o) {
        if (h > 0) { const v = Math.min(255, Math.max(0, Math.round(h / maxLand * 255))); out[o] = out[o + 1] = out[o + 2] = v; }
        else { out[o] = out[o + 1] = 0; out[o + 2] = 255 - Math.round(Math.min(1, -h / -minSea) * 254); }
      },
      toPNG: (h) => Math.min(65535, Math.max(0, Math.round((h - minSea) / (maxLand - minSea) * 65535))),
    };
  }

  async function loadHeights(mapDir, W, H, terrain, gtIdx, gtTable) {
    const J = M2.join;
    const paths = { tga: await Portable.mapFile(mapDir, 'map_heights.tga'), hgt: await Portable.mapFile(mapDir, 'map_heights.hgt'), png: await Portable.mapFile(mapDir, 'map_heights_ex.png') };
    const [sTga, sHgt, sPng] = await host.statMany([paths.tga, paths.hgt, paths.png]);
    const codec = heightCodec(terrain);
    const files = { tga: null, hgt: null, png: null };
    let fromTga = null, fromHgt = null, tgaImg = null;
    if (sTga) {
      tgaImg = await readMapTGA(paths.tga);
      if (tgaImg.width === W && tgaImg.height === H) {
        fromTga = new Float32Array(W * H);
        for (let i = 0, o = 0; i < W * H; i++, o += 4) fromTga[i] = codec.fromTGA(tgaImg.data[o], tgaImg.data[o + 1], tgaImg.data[o + 2]);
        files.tga = paths.tga;
      }
    }
    if (sHgt) {
      const b = await host.read(paths.hgt);
      const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
      const w = dv.getInt32(0, true), h = dv.getInt32(4, true);
      if (w === W && h === H && b.byteLength >= 8 + w * h * 4) {
        const f = new Float32Array(b.buffer.slice(b.byteOffset + 8, b.byteOffset + 8 + w * h * 4));
        fromHgt = new Float32Array(W * H);
        for (let y = 0; y < H; y++) fromHgt.set(f.subarray((H - 1 - y) * W, (H - y) * W), y * W); // stored bottom-up
        files.hgt = paths.hgt;
      }
    }
    if (sPng) files.png = paths.png;
    const finish = (data, source) => {
      let min = Infinity, max = -Infinity;
      for (let i = 0; i < data.length; i++) { const v = data[i]; if (v < min) min = v; if (v > max) max = v; }
      const editable = (!!files.tga || !!files.hgt) && (codec.ok || !files.tga);
      const reason = editable ? '' : (!codec.ok ? 'descr_terrain.txt has no min_sea_height / max_land_height, so heights cannot be saved.'
        : 'The height map is a different size from map_ground_types.tga, so it can only be viewed.');
      return { data, orig: data.slice(), min, max, source, files, codec, editable, reason };
    };
    // the TGA is what the game reads; the exact floats are used when they agree with it
    if (fromTga && fromHgt) {
      const px = new Uint8Array(4);
      let same = 0;
      for (let i = 0, o = 0; i < W * H; i += 7, o += 28) {
        codec.toTGA(fromHgt[i], px, 0);
        if (px[0] === tgaImg.data[o] && px[1] === tgaImg.data[o + 1] && px[2] === tgaImg.data[o + 2]) same++;
      }
      if (codec.ok && same >= Math.ceil(W * H / 7) * 0.995) return finish(fromHgt, 'map_heights.hgt');
      return finish(fromTga, 'map_heights.tga');
    }
    if (fromTga) return finish(fromTga, 'map_heights.tga');
    if (fromHgt) return finish(fromHgt, 'map_heights.hgt');
    // a height map of another size: show it stretched, read only
    const out = new Float32Array(W * H);
    if (tgaImg && codec.ok) {
      for (let y = 0; y < H; y++) {
        const sy = Math.min(tgaImg.height - 1, Math.round(y * (tgaImg.height - 1) / Math.max(1, H - 1)));
        for (let x = 0; x < W; x++) {
          const sx = Math.min(tgaImg.width - 1, Math.round(x * (tgaImg.width - 1) / Math.max(1, W - 1)));
          const o = (sy * tgaImg.width + sx) * 4;
          out[y * W + x] = codec.fromTGA(tgaImg.data[o], tgaImg.data[o + 1], tgaImg.data[o + 2]);
        }
      }
      const r = finish(out, 'map_heights.tga (stretched)');
      r.editable = false; r.reason = 'The height map is a different size from map_ground_types.tga, so it can only be viewed.';
      return r;
    }
    // no heights: flat land, shallow sea
    for (let i = 0; i < out.length; i++) out[i] = gtTable[gtIdx[i]].water ? -100 : 50;
    const r = finish(out, 'none');
    r.editable = false; r.reason = 'This map has no map_heights.tga.';
    return r;
  }

  // ---------------------------------------------------------------- textures
  function slotFor(gt) {
    const m = S().slotMap || {};
    return m[gt.key] !== undefined ? m[gt.key] : gt.slot;
  }
  function aerialFor(climate) {
    const a = state.project.aerial;
    return a[climate.name] || a.default || a[Object.keys(a)[0]] || {};
  }
  function textureNameFor(climate, slot, season) {
    const entry = aerialFor(climate)[slot];
    if (!entry) return null;
    if (season === 'winter' && climate.winter && entry.winter) return entry.winter;
    return entry.summer;
  }

  async function loadAllTextures() {
    const p = state.project;
    const names = new Set();
    for (const c of Object.values(p.aerial)) for (const e of Object.values(c)) { names.add(e.summer); if (e.winter) names.add(e.winter); }
    const list = [...names].filter(Boolean).sort((a, b) => a.localeCompare(b));
    state.layers = [];
    state.layerByName = new Map();
    view.allocLayers(Math.min(list.length, 250));
    let done = 0;
    await Promise.all(list.slice(0, 250).map(async (name, i) => {
      const layer = { name, index: i, file: null, img: null, thumb: '', missing: true };
      state.layers[i] = layer;
      state.layerByName.set(name.toLowerCase(), layer);
      await loadLayer(layer);
      done++;
      if (done % 8 === 0) loading(`Loading textures… ${done}/${list.length}`);
    }));
  }

  async function loadLayer(layer, retries = 3) {
    const p = state.project;
    layer.file = await M2.resolveTexture(p.loc, layer.name);
    if (!layer.file) {
      layer.missing = true; layer.thumb = ''; layer.img = null;
      return;
    }
    for (let attempt = 0; ; attempt++) {
      try {
        const bytes = await host.read(groundOriginal(layer.file));
        const img = await Images.decodeAny(bytes, layer.file);
        layer.img = { width: img.width, height: img.height, hasAlpha: img.tga ? img.tga.bpp === 32 : true };
        layer.thumb = Images.thumbnail(img, 96);
        const st = await host.stat(layer.file);
        layer.mtime = st && st.mtimeMs;
        const px = await Images.resizeRGBA(img, LAYER, LAYER);
        layer.srcImg = img; layer.basePx = px; layer.adjusted = false; layer.shownKey = '';
        layer.missing = false;
        if (layerStage(layer.name)) await refreshLayerColour(layer);
        else view.setLayer(layer.index, px);
        layer.error = null;
        return;
      } catch (e) {
        if (attempt >= retries) { layer.error = e.message; layer.missing = true; console.warn(layer.file, e); return; }
        await new Promise((r) => setTimeout(r, 250 * (attempt + 1)));
      }
    }
  }

  function buildLUT() {
    const p = state.project;
    const lut = new Uint8Array(64 * 64).fill(MapView.MISSING);
    p.gtTable.forEach((gt, gi) => {
      p.climates.forEach((cl, ci) => {
        let v;
        if (gt.water) v = MapView.WATER;
        else {
          const name = textureNameFor(cl, slotFor(gt), state.season);
          const layer = name && state.layerByName.get(name.toLowerCase());
          v = layer && !layer.missing ? layer.index : MapView.MISSING;
        }
        lut[ci * 64 + gi] = v;
      });
    });
    // farmland preview: three spare ground indices that show the cultivated textures (fertility texture if missing)
    p.climates.forEach((cl, ci) => {
      FARM_SLOTS.forEach((slot, k) => {
        const fi = p.gtTable.findIndex((g) => g.key === FARM_FROM[k]);
        const name = textureNameFor(cl, slot, state.season);
        const layer = name && state.layerByName.get(name.toLowerCase());
        lut[ci * 64 + FARM_IDX0 + k] = layer && !layer.missing ? layer.index : (fi >= 0 ? lut[ci * 64 + fi] : MapView.MISSING);
      });
    });
    view.setLUT(lut);
  }

  function setPalettes() {
    const p = state.project;
    const g = new Uint8Array(64 * 4), c = new Uint8Array(64 * 4);
    p.gtTable.forEach((t, i) => { g.set([...t.rgb, 255], i * 4); });
    FARM_FROM.forEach((key, k) => { const t = p.gtTable.find((x) => x.key === key); if (t) g.set([...t.rgb, 255], (FARM_IDX0 + k) * 4); });
    p.climates.forEach((t, i) => { c.set([...t.rgb, 255], i * 4); });
    view.setPalettes(g, c);
  }

  function layerFor(gi, ci) {
    const p = state.project;
    const gt = p.gtTable[gi], cl = p.climates[ci];
    if (!gt || !cl || gt.water) return null;
    const name = textureNameFor(cl, slotFor(gt), state.season);
    return name ? (state.layerByName.get(name.toLowerCase()) || { name, missing: true }) : null;
  }

  // ---------------------------------------------------------------- texture key (sidebar)
  function buildKey() {
    const p = state.project;
    const key = $('#key');
    const scroll = key.scrollTop;
    key.innerHTML = '';
    const q = $('#keySearch').value.trim().toLowerCase();
    const onlyOnMap = $('#onlyOnMap').checked;
    const collapsed = new Set(S().collapsed || []);
    const match = (...s) => !q || s.some((x) => x && x.toLowerCase().includes(q));

    const order = p.climates.map((c, i) => i).sort((a, b) => p.clCounts[b] - p.clCounts[a]);
    for (const ci of order) {
      const cl = p.climates[ci];
      if (onlyOnMap && !p.clCounts[ci] && !q) continue;
      const rows = [];
      const usedSlots = new Set();
      p.gtTable.forEach((gt, gi) => {
        if (gt.water || gt.unknown) return;
        const slot = slotFor(gt);
        usedSlots.add(slot);
        const layer = layerFor(gi, ci);
        const texName = layer ? layer.name : null;
        if (!match(cl.label, gt.label, texName, M2.SLOT_LABELS[slot], slot)) return;
        rows.push(keyRow({ gi, ci, layer, title: gt.label, slot }));
      });
      // textures in this climate that no ground type paints directly (farmland, scorched…)
      const extra = [];
      const a = aerialFor(cl);
      for (const slot of Object.keys(a)) {
        if (usedSlots.has(slot)) continue;
        const name = textureNameFor(cl, slot, state.season);
        const layer = name && (state.layerByName.get(name.toLowerCase()) || { name, missing: true });
        if (!match(cl.label, name, M2.SLOT_LABELS[slot], slot)) continue;
        extra.push(keyRow({ gi: -1, ci, layer, title: M2.SLOT_LABELS[slot] || M2.prettify(slot), slot, inert: true }));
      }
      if (!rows.length && !extra.length) continue;
      const sec = el('div', { class: 'k-sec' + (collapsed.has(cl.name) && !q ? ' collapsed' : '') });
      const head = el('div', { class: 'k-head' },
        el('span', { class: 'caret', text: collapsed.has(cl.name) && !q ? '▸' : '▾' }),
        el('span', { class: 'sw', style: `background:${rgbCss(cl.rgb)}` }),
        el('span', { class: 'name', text: cl.label, title: cl.name }),
        cl.winter ? el('span', { class: 'badge win', text: 'winter' }) : null,
        p.aerial[cl.name] ? null : el('span', { class: 'badge warn', title: 'No entry in descr_aerial_map_ground_types.txt, uses "default"', text: 'default' }),
        el('span', { class: 'count', text: p.clCounts[ci] ? `${Math.round(p.clCounts[ci] / 4).toLocaleString()}` : 'not on map', title: 'Tiles of this climate on the map' }),
        el('button', {
          class: 'paint-cl', title: 'Paint only this climate (keeps ground types)',
          onclick: (e) => { e.stopPropagation(); selectClimateOnly(ci); },
        }, 'Paint'));
      head.dataset.ci = ci;
      head.addEventListener('click', () => {
        const set = new Set(S().collapsed || []);
        if (set.has(cl.name)) set.delete(cl.name); else set.add(cl.name);
        S().collapsed = [...set]; saveSettings();
        buildKey();
      });
      const body = el('div', { class: 'k-body' });
      rows.forEach((r) => body.append(r));
      if (extra.length) {
        body.append(el('div', { class: 'k-sub', text: 'Also used by the game (not painted directly)' }));
        extra.forEach((r) => body.append(r));
      }
      sec.append(head, body);
      key.append(sec);
    }

    // water types
    const water = p.gtTable.map((g, i) => [g, i]).filter(([g]) => g.water || g.unknown);
    const wrows = water.filter(([g]) => match(g.label, 'water sea')).map(([g, gi]) => keyRow({ gi, ci: -1, layer: null, title: g.label, swatch: g.rgb, water: g.water }));
    if (wrows.length) {
      const sec = el('div', { class: 'k-sec' });
      sec.append(el('div', { class: 'k-head' }, el('span', { class: 'caret', text: '▾' }), el('span', { class: 'sw', style: 'background:#1d4a5a' }), el('span', { text: 'Water and other' })));
      const body = el('div', { class: 'k-body' }); wrows.forEach((r) => body.append(r)); sec.append(body);
      key.append(sec);
    }
    // the pictures the game's tile models use (rivers, cliffs, mountains, volcanoes) and their blend masks
    const TILE_SET_NAMES = { river_a: 'Rivers', wall_a: 'Walls', volcano: 'Volcanoes', volcano_dormant: 'Dormant volcanoes', cliffs: 'Cliffs', mountains: 'Mountains', hills: 'Hills' };
    const tt = (p.tiles && p.tiles.textures) || [];
    const trows = tt.filter((t) => match(t.name, 'tile models', ...t.sets.map((n) => TILE_SET_NAMES[n] || n))).map((t) => {
      const used = t.sets.map((n) => TILE_SET_NAMES[n] || n).join(', ');
      return keyRow({ gi: -1, ci: -1, layer: { name: t.name, file: t.file, thumb: t.thumb, tile: t }, title: used ? `${used}${t.page ? ' blend mask' : ''}` : `${M2.basename(t.key)} (not on this map)`, slot: t.page ? 'Tile model alpha page' : 'Tile model texture', inert: true });
    });
    if (trows.length) {
      const shut = collapsed.has('__tile_models') && !q;
      const sec = el('div', { class: 'k-sec' + (shut ? ' collapsed' : '') });
      const head = el('div', { class: 'k-head', title: 'The pictures on the game\'s tile models (terrain\\aerial_map\\tile_textures and tile_models\\alpha_pages). Right-click one to open or replace it; edits on disk show at once.' },
        el('span', { class: 'caret', text: shut ? '▸' : '▾' }), el('span', { class: 'sw', style: 'background:#9aa3ad' }), el('span', { class: 'name', text: 'Tile models' }),
        el('span', { class: 'count', text: `${trows.length}` }));
      head.addEventListener('click', () => {
        const set = new Set(S().collapsed || []);
        if (set.has('__tile_models')) set.delete('__tile_models'); else set.add('__tile_models');
        S().collapsed = [...set]; saveSettings();
        buildKey();
      });
      const body = el('div', { class: 'k-body' }); trows.forEach((r) => body.append(r));
      sec.append(head, body);
      key.append(sec);
    }
    key.scrollTop = scroll;
    markSelected();
  }

  function keyRow({ gi, ci, layer, title, slot, inert, swatch, water }) {
    const p = state.project;
    const missing = layer && layer.missing;
    const img = layer && layer.thumb ? el('img', { src: layer.thumb, alt: '' }) : el('div', { class: 'swatch', style: swatch ? `background:${rgbCss(swatch)}` : 'background:repeating-conic-gradient(#a0a 0 25%, #303 0 50%) 0 0/16px 16px' });
    const fileLine = layer ? (missing ? `${layer.name} — missing` : layer.name) : (water ? 'Water (drawn by the game)' : 'Raw colour');
    const where = layer && layer.file ? (norm(layer.file).startsWith(norm(p.loc.dataDir)) ? 'mod' : 'vanilla') : '';
    const t3 = slot ? `${M2.SLOT_LABELS[slot] || slot}${where ? ' · ' + where : ''}` : (gi >= 0 ? rgbText(p.gtTable[gi].rgb) : '');
    const row = el('div', {
      class: 'k-row' + (missing ? ' missing' : '') + (inert ? ' inert' : ''),
      title: layer && layer.file ? layer.file : (layer ? `Not found: ${layer.name}` : ''),
    }, img, el('div', {}, el('div', { class: 't1', text: title }), el('div', { class: 't2', text: fileLine }), el('div', { class: 't3', text: t3 })));
    row.dataset.gi = gi; row.dataset.ci = ci;
    if (layer && layer.index !== undefined) row.dataset.layer = layer.index;
    if (!inert) row.addEventListener('click', () => selectBrush(gi, ci));
    row.addEventListener('contextmenu', (e) => { e.preventDefault(); keyContextMenu(layer, e.clientX, e.clientY); });
    row.addEventListener('mouseenter', () => { if (layer && layer.index !== undefined) { view.opts.hilite = layer.index; view.dirty = true; } });
    row.addEventListener('mouseleave', () => { view.opts.hilite = -1; view.dirty = true; });
    // drag an image file onto a row to replace that texture
    if (layer) {
      row.addEventListener('dragover', (e) => { e.preventDefault(); row.classList.add('drop'); });
      row.addEventListener('dragleave', () => row.classList.remove('drop'));
      row.addEventListener('drop', (e) => {
        e.preventDefault(); row.classList.remove('drop');
        const f = e.dataTransfer.files[0];
        if (f) f.arrayBuffer().then((b) => replaceTexture(layer, { name: f.name, bytes: new Uint8Array(b) }));
      });
    }
    return row;
  }
  const rgbText = (c) => `RGB ${c.join(', ')}`;

  async function keyContextMenu(layer, x, y) {
    if (!layer) return;
    const has = layer.file && !layer.missing;
    const id = await popupMenu(x, y, [
      { id: 'reveal', label: 'Open file location', enabled: !!layer.file },
      { id: 'open', label: 'Open in image editor', enabled: !!layer.file },
      { id: 'copy', label: 'Copy file path', enabled: !!layer.file },
      { type: 'separator' },
      { id: 'replace', label: has ? 'Replace with image…' : 'Import image for this texture…' },
      { id: 'reload', label: 'Reload texture', enabled: !!layer.file },
    ]);
    if (id === 'reveal') host.showItem(layer.file);
    else if (id === 'open') { const err = await host.openPath(layer.file); if (err) toast(err, 'err'); }
    else if (id === 'copy') { host.copyText(layer.file); toast('Path copied'); }
    else if (id === 'replace') {
      const src = await pickImageFile();
      if (src) replaceTexture(layer, src);
    } else if (id === 'reload') reloadLayer(layer);
  }

  function selectBrush(gi, ci) {
    const p = state.project;
    if (state.target === 'climate' && ci >= 0) { selectClimateOnly(ci); return; }
    rampTakeTexture(gi, ci);
    const gt = p.gtTable[gi];
    const cl = ci >= 0 ? p.climates[ci] : null;
    state.brush.gt = gi;
    state.brush.cl = ci;
    const layer = ci >= 0 ? layerFor(gi, ci) : null;
    state.brush.label = gt.label + (cl ? ` · ${cl.label}` : '');
    state.brush.sub = layer ? layer.name : (gt.water ? 'Water' : '');
    state.brush.thumb = layer && layer.thumb ? layer.thumb : '';
    if (ci < 0) $('#paintCL').checked = false;
    if (!$('#paintGT').checked && !$('#paintCL').checked) $('#paintGT').checked = true;
    if (state.tool === 'pick' || state.tool === 'pan') setTool('brush');
    if (state.target !== 'tex') setTarget('tex');
    updateBrushUI();
    markSelected();
    colourFollowBrush();
  }

  // the Climates brush: paints map_climates.tga and nothing else
  function selectClimateOnly(ci) {
    if (!(ci >= 0) || !state.project.climates[ci]) return;
    state.clBrush = ci;
    if (state.tool === 'pick' || state.tool === 'pan') setTool('brush');
    if (state.target !== 'climate') setTarget('climate');
    updateBrushUI();
    markSelected();
  }

  const BLANK = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
  function updateBrushUI() {
    const img = $('#brushThumb');
    if (state.target === 'height') {
      const t = S().heightTool;
      $('#brushLabel').textContent = `Heights · ${HEIGHT_TOOLS[t]}`;
      $('#brushSub').textContent = `${HEIGHT_HELP[t]}${t === 'set' ? ` Target ${S().heightTarget} m.` : ''}`;
      img.src = BLANK; img.style.visibility = 'visible'; img.style.background = 'linear-gradient(180deg,#e8e2d0,#6d6a5f 55%,#1c3c5a 56%,#0c1c2c)';
      return;
    }
    img.style.background = '';
    if (state.target === 'climate') {
      const cl = state.project && state.clBrush >= 0 ? state.project.climates[state.clBrush] : null;
      $('#brushLabel').textContent = cl ? `Climate · ${cl.label}` : 'Climates · pick a climate';
      $('#brushSub').textContent = cl ? 'Paints map_climates.tga only. Ground types and heights stay as they are.' : 'Click any texture of a climate in the key, a climate\'s Paint button, or Alt+click the map.';
      img.src = BLANK; img.style.visibility = cl ? 'visible' : 'hidden';
      if (cl) img.style.background = rgbCss(cl.rgb);
      return;
    }
    $('#brushLabel').textContent = state.brush.label || 'Pick a texture below';
    $('#brushSub').textContent = state.brush.sub || '';
    if (state.brush.thumb) { img.src = state.brush.thumb; img.style.visibility = 'visible'; }
    else if (state.brush.cl >= 0 && state.project) {
      const c = state.project.climates[state.brush.cl].rgb;
      img.src = BLANK; img.style.visibility = 'visible'; img.style.background = rgbCss(c);
    } else img.style.visibility = 'hidden';
  }

  function markSelected(scroll) {
    $$('.k-row.selected').forEach((r) => r.classList.remove('selected'));
    $$('.k-head.selected').forEach((r) => r.classList.remove('selected'));
    if (state.target === 'climate') {
      const h = $$('.k-head').find((r) => r.dataset.ci !== undefined && +r.dataset.ci === state.clBrush);
      if (h) { h.classList.add('selected'); if (scroll) h.scrollIntoView({ block: 'nearest' }); }
      return;
    }
    const sel = $$('.k-row').find((r) => +r.dataset.gi === state.brush.gt && +r.dataset.ci === state.brush.cl);
    if (sel) {
      sel.classList.add('selected');
      if (scroll) {
        const sec = sel.closest('.k-sec');
        if (sec && sec.classList.contains('collapsed')) sec.classList.remove('collapsed');
        sel.scrollIntoView({ block: 'center' });
        sel.classList.remove('flash'); void sel.offsetWidth; sel.classList.add('flash');
      }
    }
  }

  // ---------------------------------------------------------------- texture import / live reload
  // src: { name, bytes } of the image the artist picked or dropped
  async function replaceTexture(layer, src) {
    if (layer.tile) return replaceTileTexture(layer, src);
    const p = state.project;
    try {
      const img = await Images.decodeAny(src.bytes, src.name);
      let target = layer.file;
      if (!target || /\.dds$/i.test(target)) target = M2.join(p.loc.dataDir, 'terrain', 'aerial_map', 'ground_types', layer.name);
      // keep the original's bit depth; carry over its alpha (blend mask) if the new image has none
      let bpp = 24;
      let rgba = img.data;
      if (layer.file && /\.tga$/i.test(layer.file)) {
        const old = Images.decodeTGA(await host.read(layer.file));
        bpp = old.tga.bpp === 32 ? 32 : 24;
        const newHasAlpha = (() => { for (let i = 3; i < rgba.length; i += 4) if (rgba[i] !== 255) return true; return false; })();
        if (bpp === 32 && !newHasAlpha && old.width === img.width && old.height === img.height) {
          rgba = new Uint8Array(rgba);
          for (let i = 3; i < rgba.length; i += 4) rgba[i] = old.data[i];
        }
      }
      const out = Images.encodeTGA(img.width, img.height, rgba, bpp, true);
      const stamp = timestamp();
      state.ownWrites.set(norm(target), Date.now());
      const rep = await host.saveWithBackup({
        files: [{ path: target, data: out }], backupRoot: M2.join(p.loc.modRoot, 'map_painter_backups', stamp), relBase: p.loc.modRoot,
      });
      state.ownWrites.set(norm(target), Date.now());
      if ((img.width & (img.width - 1)) || (img.height & (img.height - 1))) {
        toast(`Imported, but ${img.width}×${img.height} is not a power of two. The game prefers 256, 512 or 1024 square textures.`, 'err', 8000);
      } else toast(`Replaced ${layer.name}. ${rep.backedUp.length ? 'The old file is in map_painter_backups.' : ''}`, 'ok');
      await reloadLayer(layer);
    } catch (e) {
      toast('Could not import that image: ' + e.message, 'err', 8000);
    }
  }

  async function reloadLayer(layer) {
    if (layer.tile) { state.project.tileCache = null; await loadTileModels(); setupWatch(); return; }
    const wasMissing = layer.missing;
    await loadLayer(layer);
    if (wasMissing !== layer.missing) buildLUT();
    refreshKeyThumbs(layer);
    if (state.brush.gt >= 0 && state.brush.cl >= 0) {
      const l = layerFor(state.brush.gt, state.brush.cl);
      if (l === layer) { state.brush.thumb = layer.thumb; updateBrushUI(); }
    }
    view.dirty = true;
  }

  // a tile model picture replaced from the key: written in the file's own format (a .tga.dds keeps its DXT
  // compression, with new mip maps; a .tga its bit depth), into the mod when the picture came from the game,
  // the old file backed up first; the tile models then reload with it
  async function replaceTileTexture(layer, src) {
    const p = state.project, loc = p.loc;
    try {
      const img = await Images.decodeAny(src.bytes, src.name);
      let target = layer.file;
      if (loc.gameDataDir && norm(target).startsWith(norm(loc.gameDataDir) + '\\') && norm(loc.dataDir) !== norm(loc.gameDataDir)) {
        target = M2.join(loc.dataDir, target.slice(loc.gameDataDir.length).replace(/^[\\/]+/, ''));
      }
      const oldBytes = await host.read(layer.file);
      const old = await Images.decodeAny(oldBytes, layer.file);
      const hasAlpha = (d) => { for (let i = 3; i < d.length; i += 4) if (d[i] !== 255) return true; return false; };
      let rgba = img.data;
      // a picture without alpha keeps the old one's alpha (the see-through parts) when the sizes match
      if (!hasAlpha(rgba) && hasAlpha(old.data) && old.width === img.width && old.height === img.height) {
        rgba = new Uint8Array(rgba);
        for (let i = 3; i < rgba.length; i += 4) rgba[i] = old.data[i];
      }
      let out;
      if (/\.dds$/i.test(target)) {
        const fmt = Images.ddsFormat(oldBytes);
        out = fmt === 'DXT1' ? Images.encodeDDS(img.width, img.height, rgba, 'DXT1', hasAlpha(rgba)) : Images.encodeDDS(img.width, img.height, rgba, 'DXT5');
      } else {
        const bpp = /\.tga$/i.test(layer.file) && Images.decodeTGA(oldBytes).tga.bpp === 32 ? 32 : 24;
        out = Images.encodeTGA(img.width, img.height, rgba, bpp, true);
      }
      state.ownWrites.set(norm(target), Date.now());
      const rep = await host.saveWithBackup({ files: [{ path: target, data: out }], backupRoot: M2.join(loc.modRoot, 'map_painter_backups', timestamp()), relBase: loc.modRoot });
      state.ownWrites.set(norm(target), Date.now());
      // a picture Save recoloured: the new one becomes its original, and the next Save puts the colour on it
      const tm = await tileManifest(), te = tm.files[norm(target)];
      if (te) {
        te.original = tileOrigPath(target);
        await host.writeFile(te.original, out);
        delete tm.tex[te.key];
        await host.writeFile(M2.join(tileBakeDir(), 'manifest.json'), new TextEncoder().encode(JSON.stringify(tm, null, 1)));
      }
      p.tileCache = null;
      await loadTileModels(); setupWatch();
      if ((img.width & (img.width - 1)) || (img.height & (img.height - 1))) toast(`Imported, but ${img.width}×${img.height} is not a power of two. The game prefers 128, 256, 512 or 1024 square pictures.`, 'err', 8000);
      else toast(`Replaced ${layer.name}${norm(target) !== norm(layer.file) ? ' (as a copy in the mod)' : ''}. ${(rep.backedUp || []).length ? 'The old file is in map_painter_backups.' : ''}`, 'ok');
    } catch (e) {
      toast('Could not import that image: ' + e.message, 'err', 8000);
    }
  }

  function refreshKeyThumbs(layer) {
    $$(`.k-row[data-layer="${layer.index}"]`).forEach((r) => {
      const first = r.firstElementChild;
      if (layer.thumb) {
        if (first.tagName === 'IMG') first.src = layer.thumb;
        else { const i = el('img', { src: layer.thumb, alt: '' }); r.replaceChild(i, first); }
      }
      r.classList.toggle('missing', !!layer.missing);
      r.querySelector('.t2').textContent = layer.missing ? `${layer.name} — missing` : layer.name;
      r.classList.remove('flash'); void r.offsetWidth; r.classList.add('flash');
    });
  }

  // M2EX keeps the ground textures it has converted as <mod>\terrain\aerial_map\ground_types\<name>.dds (the
  // game's own folder for the base game) and does not notice when a texture changes, so an edit only showed in
  // game after deleting that folder. A cached copy older than its texture is moved aside (into
  // map_painter_backups\game_texture_cache) and the game converts that one texture again on its next start.
  async function clearStaleGroundCache(files) {
    // Scenery Studio previews the current terrain without changing game caches.
    if (document.body.classList.contains('scenery-mode')) return 0;
    const p = state.project;
    if (!p) return 0;
    const srcs = (files || state.layers.filter((l) => l.file && !l.missing).map((l) => l.file)).filter(Boolean);
    if (!srcs.length) return 0;
    const roots = [p.loc.modRoot];
    if (p.loc.gameDataDir) roots.push(M2.dirname(p.loc.gameDataDir));
    let n = 0;
    try {
      const sst = await host.statMany(srcs);
      for (const root of roots) {
        const dir = M2.join(root, 'terrain', 'aerial_map', 'ground_types');
        const caches = srcs.map((f) => M2.join(dir, M2.basename(f).replace(/(\.tga)?(\.dds)?$/i, '') + '.dds'));
        const cst = await host.statMany(caches);
        const moves = [...new Set(caches.filter((c, i) => cst[i] && sst[i] && cst[i].mtimeMs < sst[i].mtimeMs))];
        if (!moves.length) continue;
        await host.saveWithBackup({ files: [], moves, backupRoot: M2.join(p.loc.modRoot, 'map_painter_backups', 'game_texture_cache'), relBase: root });
        n += moves.length;
      }
    } catch (e) { console.warn('game texture cache', e); }
    return n;
  }

  async function setupWatch() {
    const p = state.project;
    const J = M2.join;
    const hf = p.heights.files;
    const files = [p.gtFile, p.clFile, p.files.fAerial, p.files.fClimates, hf.tga, hf.hgt];
    const gtDirs = [J(p.loc.dataDir, 'terrain', 'aerial_map', 'ground_types')];
    if (p.loc.gameDataDir) gtDirs.push(J(p.loc.gameDataDir, 'terrain', 'aerial_map', 'ground_types'));
    for (const l of state.layers) {
      if (l.file && !l.missing) files.push(l.file);
      else for (const d of gtDirs) files.push(J(d, l.name), J(d, l.name + '.dds'));
    }
    if (p.trees) files.push(...p.trees.watch);
    if (p.pieces) files.push(...p.pieces.watch);
    if (p.tiles) files.push(...p.tiles.watch);
    if (p.gameWatch) files.push(...p.gameWatch);
    if (p.files.fLight) files.push(p.files.fLight);
    await host.watchFiles(files);
  }

  const pendingChanges = new Map();
  host.onWatch(({ file }) => {
    if (!state.project) return;
    const k = norm(file);
    const own = state.ownWrites.get(k);
    if (own && Date.now() - own < 4000) return;
    clearTimeout(pendingChanges.get(k));
    pendingChanges.set(k, setTimeout(() => { pendingChanges.delete(k); onFileChanged(file); }, 350));
  });

  async function onFileChanged(file) {
    const p = state.project;
    const k = norm(file);
    const base = M2.basename(k);
    // a texture we display?
    for (const l of state.layers) {
      if (l.file && norm(l.file) === k) {
        const st = await host.stat(l.file);
        if (st && st.mtimeMs === l.mtime) return;
        const took = await groundTakeOutsideEdit(l.file);
        await reloadLayer(l);
        const moved = await clearStaleGroundCache([l.file]);
        toast(`Updated ${l.name}${moved ? '. The game\'s cached copy was moved aside, so it shows in game on the next start' : ''}`, 'ok', moved ? 4000 : 1800);
        return;
      }
    }
    // a missing texture appeared, or a .dds/.tga variant changed
    const missingHit = state.layers.find((l) => l.missing && (base === l.name.toLowerCase() || base === l.name.toLowerCase() + '.dds'));
    if (missingHit) { await reloadLayer(missingHit); buildKey(); return; }
    if (k === norm(p.files.fAerial) || k === norm(p.files.fClimates)) {
      showBanner('Texture definitions changed on disk.', 'Reload', () => reloadDefinitions());
      if (!isDirty()) reloadDefinitions();
      return;
    }
    if (p.files.fLight && k === norm(p.files.fLight)) {
      p.lightText = await lightRead(p.files.fLight);
      lightBase = p.lightText;
      p.lighting = M2.parseLighting(p.lightText, /_ex\.txt$/i.test(p.files.fLight));
      applyViewSettings();
      if (!$('#lightPanel').hidden) renderLightPanel();
      toast('Updated the lighting', 'ok', 1800);
      return;
    }
    if (p.gameWatch && p.gameWatch.some((f) => norm(f) === k)) {
      await loadGameAssets(); setupWatch();
      toast(`Updated ${M2.basename(file)}`, 'ok', 1800);
      return;
    }
    if (p.tiles && p.tiles.watch.some((f) => norm(f) === k)) {
      p.tileCache = null; p.tileBake = null;
      await loadTileModels(); setupWatch();
      toast(`Updated the tile models (${M2.basename(file)})`, 'ok', 1800);
      return;
    }
    if (p.pieces && p.pieces.watch.some((f) => norm(f) === k)) {
      clearPieceCache();
      await loadPieces(); setupWatch();
      toast('Updated the settlements', 'ok', 1800);
      return;
    }
    if (p.trees && p.trees.watch.some((f) => norm(f) === k)) {
      await loadTrees(); setupWatch();
      toast('Updated the trees', 'ok', 1800);
      return;
    }
    const hf = p.heights.files;
    if (k === norm(p.gtFile) || k === norm(p.clFile) || k === norm(hf.tga) || k === norm(hf.hgt)) {
      if (isDirty()) showBanner('The map files were changed by another program.', 'Reload (lose my painting)', () => loadMapForce());
      else loadMapForce();
    }
  }

  async function loadMapForce() {
    const p = state.project;
    p.dirty.gt = p.dirty.cl = p.dirty.h = false;
    state.undo = []; state.redo = [];
    const vs = { ...view.view }, cam = { ...view.cam };
    await loadMap(p.mapDir);
    Object.assign(view.view, vs); Object.assign(view.cam, cam); view.dirty = true;
  }

  async function reloadDefinitions() {
    hideBanner();
    const p = state.project;
    try {
      p.aerial = M2.parseAerial(await host.readText(p.files.fAerial));
      const defs = new Map(M2.parseClimates(await host.readText(p.files.fClimates)).map((c) => [c.name, c]));
      for (const c of p.climates) if (defs.has(c.name)) c.trees = defs.get(c.name).trees;
      loading('Reloading textures…');
      await loadAllTextures();
      applyViewSettings();
      buildLUT(); buildKey();
      await loadTrees();
      setupWatch();
      toast('Reloaded texture definitions', 'ok');
    } finally { loading(null); }
  }

  function showBanner(text, btnText, fn) {
    const b = $('#banner');
    b.innerHTML = '';
    b.append(el('span', { text }), el('button', { onclick: () => { hideBanner(); fn(); } }, btnText), el('button', { onclick: hideBanner }, 'Dismiss'));
    b.hidden = false;
  }
  function hideBanner() { $('#banner').hidden = true; }

  // ---------------------------------------------------------------- painting
  // stroke: { changes: Map(idx -> [gt0, cl0, gt1, cl1]), h0: Map(idx -> height before), decided, flatTo }
  let stroke = null;
  let dirtyRect = null, hDirtyRect = null;

  function brushRadiusPx(pressure) {
    const base = S().brushSize * 2; // tiles -> map vertices
    if (!S().pressureSize || pressure == null) return base;
    return Math.max(0.6, base * (0.15 + 0.85 * pressure));
  }
  const hardKey = () => (state.target === 'height' ? 'heightHard' : 'brushHard');

  function beginStroke(mx, my) {
    const p = state.project;
    stroke = { changes: new Map(), h0: new Map(), decided: new Uint8Array(p.W * p.H) };
    if (coastOn()) coastPrep();
    if (state.target === 'height' && mx != null) stroke.flatTo = view.heightAt(mx, my);
  }

  function endStroke() {
    if (!stroke) return;
    const p = state.project;
    const rec = { t: stroke.changes, h: null };
    if (stroke.h0.size) {
      const n = stroke.h0.size, idx = new Int32Array(n), a = new Float32Array(n), b = new Float32Array(n);
      let k = 0;
      for (const [i, h0] of stroke.h0) { idx[k] = i; a[k] = h0; b[k] = p.heights.data[i]; k++; }
      rec.h = { idx, a, b };
    }
    if (rec.t.size || rec.h) {
      state.undo.push(rec);
      if (state.undo.length > 100) state.undo.shift();
      state.redo = [];
    }
    stroke = null;
    updateButtons();
  }

  function canPaint() {
    if (state.target === 'height') return !!(state.project && state.project.heights.editable);
    if (state.target === 'climate') return state.clBrush >= 0;
    if (forestOn() && S().forestWith !== 'brush') return true;
    if (rampActive()) return ramp().stops.length > 0 && ($('#paintGT').checked || $('#paintCL').checked);
    const b = state.brush;
    const pg = $('#paintGT').checked && b.gt >= 0;
    const pc = $('#paintCL').checked && b.cl >= 0;
    return pg || pc;
  }

  // ----- brush tips. Round is built in; alpha brushes are greyscale images (white paints).
  function activeTip() {
    const name = S().tip;
    return name && name !== 'round' ? state.tips.find((t) => t.name === name) || null : null;
  }
  function tipSample(tip, u, v) {
    const n = tip.size - 1;
    const x = u * n, y = v * n;
    const x0 = Math.floor(x), y0 = Math.floor(y);
    if (x0 < 0 || y0 < 0 || x0 > n || y0 > n) return 0;
    const x1 = Math.min(n, x0 + 1), y1 = Math.min(n, y0 + 1), fx = x - x0, fy = y - y0, M = tip.mask, w = tip.size;
    const a = M[y0 * w + x0] + (M[y0 * w + x1] - M[y0 * w + x0]) * fx;
    const b = M[y1 * w + x0] + (M[y1 * w + x1] - M[y1 * w + x0]) * fx;
    return a + (b - a) * fy;
  }
  // Calls fn(x, y, i, weight) for every map vertex under a dab. Weight is 0..1.
  // angle (radians) turns an alpha brush; by default it comes from the brush settings.
  function forDab(mx, my, r, hard, fn, angle = null) {
    const p = state.project;
    const W = p.W, H = p.H;
    const tip = activeTip();
    const ang = !tip ? 0 : angle != null ? angle : (S().tipRandom ? Math.random() * Math.PI * 2 : S().tipAngle * Math.PI / 180);
    const ca = Math.cos(ang), sa = Math.sin(ang);
    const ext = tip ? r * Math.SQRT2 : r;
    const x0 = Math.max(0, Math.floor(mx - ext)), x1 = Math.min(W - 1, Math.ceil(mx + ext));
    const y0 = Math.max(0, Math.floor(my - ext)), y1 = Math.min(H - 1, Math.ceil(my + ext));
    const r2 = r * r;
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const dx = x - mx, dy = y - my;
        let w;
        if (tip) {
          const lx = dx * ca + dy * sa, ly = -dx * sa + dy * ca;
          const u = (lx / r + 1) / 2, v = (ly / r + 1) / 2;
          if (u < 0 || v < 0 || u > 1 || v > 1) continue;
          w = tipSample(tip, u, v);
        } else {
          const d2 = dx * dx + dy * dy;
          if (d2 > r2) continue;
          const d = Math.sqrt(d2) / r;
          if (d <= hard) w = 1;
          else { const t = (d - hard) / Math.max(0.0001, 1 - hard); w = 1 - t * t * (3 - 2 * t); }
        }
        if (w > 0) fn(x, y, y * W + x, w);
      }
    }
    return { x0, y0, x1, y1 };
  }

  function setTile(i, g, c) {
    const p = state.project;
    if (g === p.gtIdx[i] && c === p.clIdx[i]) return;
    if (!stroke.changes.has(i)) stroke.changes.set(i, [p.gtIdx[i], p.clIdx[i], g, c]);
    else { const ch = stroke.changes.get(i); ch[2] = g; ch[3] = c; }
    if (p.gtIdx[i] !== g) p.dirty.gt = true;
    if (p.clIdx[i] !== c) { p.clCounts[p.clIdx[i]]--; p.clCounts[c]++; p.dirty.cl = true; }
    p.gtIdx[i] = g; p.clIdx[i] = c;
    growDirty(i % p.W, (i / p.W) | 0);
  }

  // ground types / climates. an: anchored stamp { r, ang } (size and angle come from the drag)
  function dab(mx, my, pressure, an = null) {
    if (!stroke || !canPaint()) return;
    if (state.target === 'height') return hdab(mx, my, pressure, an);
    const p = state.project;
    const r = an ? an.r : brushRadiusPx(pressure);
    let density = S().brushDensity / 100;
    if (S().pressureDensity && pressure != null) density *= pressure;
    const hard = S().brushHard / 100;
    const tip = activeTip();
    const paint = texPainter();
    const mask = maskTest();
    forDab(mx, my, r, hard, (x, y, i, w) => {
      if (stroke.decided[i]) return;
      if (mask && !mask(x, y)) return;
      let prob = density;
      if (tip) prob *= Math.min(1, Math.max(0, (w - 0.5) / Math.max(0.02, 1 - hard) + 0.5));
      else prob *= w;
      if (prob <= 0) return;
      if (an) {
        // one stamp, redrawn while dragging: the scatter is fixed per spot so it doesn't flicker
        if (prob < 1 && hash2(x, y) >= prob) return;
      } else if (prob < 1) {
        // soft edges are decided once per stroke, so going over them again doesn't pile up
        if (tip || w < 1) stroke.decided[i] = 1;
        if (Math.random() >= prob) return;
      }
      stroke.decided[i] = 1;
      const v = paint(i, x, y);
      if (v) setTile(i, v[0], v[1]);
    }, an ? an.ang : null);
  }

  // value noise for the Noise height tool, fixed per map position so dabs build on each other
  function hash2(x, y) { let h = (x * 374761393 + y * 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
  function vnoise(x, y, s) {
    const fx = x / s, fy = y / s, x0 = Math.floor(fx), y0 = Math.floor(fy);
    let tx = fx - x0, ty = fy - y0; tx = tx * tx * (3 - 2 * tx); ty = ty * ty * (3 - 2 * ty);
    const a = hash2(x0, y0), b = hash2(x0 + 1, y0), c = hash2(x0, y0 + 1), d = hash2(x0 + 1, y0 + 1);
    return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
  }
  const fractal = (x, y) => (vnoise(x, y, 16) * 0.5 + vnoise(x, y, 7) * 0.3 + vnoise(x, y, 3) * 0.2) * 2 - 1;

  // box average of the heights around each vertex of a rectangle (for smoothing)
  function boxAverage(D, W, H, x0, y0, x1, y1, k) {
    const ax = Math.max(0, x0 - k), ay = Math.max(0, y0 - k), bx = Math.min(W - 1, x1 + k), by = Math.min(H - 1, y1 + k);
    const sw = bx - ax + 2, sh = by - ay + 2;
    const sat = new Float64Array(sw * sh);
    for (let y = 1; y < sh; y++) {
      let row = 0;
      for (let x = 1; x < sw; x++) { row += D[(ay + y - 1) * W + (ax + x - 1)]; sat[y * sw + x] = sat[(y - 1) * sw + x] + row; }
    }
    return (x, y) => {
      const l = Math.max(ax, x - k) - ax, t = Math.max(ay, y - k) - ay, r = Math.min(bx, x + k) - ax + 1, b = Math.min(by, y + k) - ay + 1;
      return (sat[b * sw + r] - sat[t * sw + r] - sat[b * sw + l] + sat[t * sw + l]) / ((r - l) * (b - t));
    };
  }

  // heights
  function hdab(mx, my, pressure, an = null) {
    const p = state.project, hs = p.heights, D = hs.data, W = p.W;
    const r = an ? an.r : brushRadiusPx(pressure);
    const base = S().heightStrength / 100;
    const pf = S().pressureStrength && pressure != null ? pressure : 1;
    const strength = base * pf;
    if (strength <= 0) return;
    const tool = S().heightTool;
    const lo = hs.codec.ok ? hs.codec.minSea : -1e6, hi = hs.codec.ok ? hs.codec.maxLand : 1e6;
    const range = hs.codec.ok ? hi - lo : 3000;
    // metres per dab at full weight. An anchored stamp is applied once, so it does a whole stroke's work.
    const amount = an ? base * pf * 0.25 * range : base * base * pf * 0.05 * range;
    const blend = an ? Math.min(1, strength * 3) : strength;
    let avg = null;
    if (tool === 'smooth') {
      const ext = Math.ceil(r * (activeTip() ? Math.SQRT2 : 1));
      const k = Math.max(1, Math.round(r * 0.3));
      avg = boxAverage(D, W, p.H, Math.max(0, Math.floor(mx - ext)), Math.max(0, Math.floor(my - ext)),
        Math.min(W - 1, Math.ceil(mx + ext)), Math.min(p.H - 1, Math.ceil(my + ext)), k);
    }
    const target = tool === 'flatten' ? stroke.flatTo : S().heightTarget;
    forDab(mx, my, r, S().heightHard / 100, (x, y, i, w) => {
      const h0 = D[i];
      let h1;
      if (tool === 'raise') h1 = h0 + amount * w;
      else if (tool === 'lower') h1 = h0 - amount * w;
      else if (tool === 'noise') h1 = h0 + amount * w * fractal(x, y);
      else if (tool === 'smooth') h1 = h0 + (avg(x, y) - h0) * Math.min(1, w * blend);
      else h1 = h0 + (target - h0) * Math.min(1, w * blend); // flatten / set
      h1 = Math.min(hi, Math.max(lo, h1));
      if (Math.abs(h1 - h0) < 1e-4) return;
      setHeight(i, x, y, h1);
    }, an ? an.ang : null);
  }

  // ----- anchored stroke: click places one stamp, dragging sizes and turns it
  const ANCHOR_MAX = 300; // map vertices
  function revertStroke() {
    const p = state.project, D = p.heights.data;
    for (const [i, c] of stroke.changes) {
      if (p.clIdx[i] !== c[1]) { p.clCounts[p.clIdx[i]]--; p.clCounts[c[1]]++; }
      p.gtIdx[i] = c[0]; p.clIdx[i] = c[1];
      growDirty(i % p.W, (i / p.W) | 0);
    }
    stroke.changes.clear();
    for (const [i, h0] of stroke.h0) { D[i] = h0; growHDirty(i % p.W, (i / p.W) | 0); }
    stroke.h0.clear();
  }
  function anchorAngle(a, c) {
    const d = Math.hypot(c.x - a.x, c.y - a.y);
    // dragging straight up keeps an alpha brush upright
    return (d > 1 ? Math.atan2(c.y - a.y, c.x - a.x) + Math.PI / 2 : 0) + S().tipAngle * Math.PI / 180;
  }
  function applyAnchor() {
    const ap = pointer;
    if (!ap || ap.type !== 'anchor' || !stroke) return;
    ap.pending = false;
    revertStroke();
    if (state.target !== 'height') stroke.decided.fill(0);
    dab(ap.anchor.x, ap.anchor.y, ap.pressure, { r: ap.r, ang: ap.ang });
    flushDirty();
  }
  // ----- grab: the brush area is lifted (or pushed down) by how far the pointer has moved up (or down) since
  // the click, full at the centre and fading to nothing at the edge (hardness sets how soon it fades). Each
  // move starts again from the ground as it was, so it is one smooth pull and one undo step.
  function grabMetresPerPixel() {
    // Strength sets how fast it moves: at 50% a 100 pixel drag lifts the ground by a quarter of the map's
    // height range (sea floor to highest land); the 3D view uses the same rate, its heights are too flat to follow
    const p = state.project, c = p.heights.codec, range = c.ok ? c.maxLand - c.minSea : 3000;
    return range * 0.0025 * Math.max(0.01, S().heightStrength / 50);
  }
  function applyGrab() {
    const gp = pointer;
    if (!gp || gp.type !== 'grab' || !stroke) return;
    gp.pending = false;
    revertStroke();
    const p = state.project, hs = p.heights, D = hs.data;
    const lo = hs.codec.ok ? hs.codec.minSea : -1e6, hi = hs.codec.ok ? hs.codec.maxLand : 1e6;
    if (Math.abs(gp.lift) > 1e-3) {
      forDab(gp.anchor.x, gp.anchor.y, gp.r, S().heightHard / 100, (x, y, i, w) => {
        const h0 = D[i], h1 = Math.min(hi, Math.max(lo, h0 + gp.lift * w));
        if (Math.abs(h1 - h0) >= 1e-4) setHeight(i, x, y, h1);
      });
    }
    flushDirty();
  }
  function scheduleAnchor() {
    if (pointer.pending) return;
    pointer.pending = true;
    requestAnimationFrame(applyAnchor);
  }

  function setHeight(i, x, y, h1) {
    const p = state.project, D = p.heights.data;
    const h0 = D[i];
    if (!stroke.h0.has(i)) stroke.h0.set(i, h0);
    D[i] = h1;
    p.dirty.h = true;
    if (h1 < view.hMin) view.hMin = h1;
    if (h1 > view.hMax) view.hMax = h1;
    growHDirty(x, y);
    // keep the ground type on the right side of the coastline
    if (S().moveCoast && (h0 <= 0) !== (h1 <= 0)) {
      const water = !!p.gtTable[p.gtIdx[i]].water;
      if (h1 <= 0 && !water && p.shallowIdx >= 0) setTile(i, p.shallowIdx, p.clIdx[i]);
      else if (h1 > 0 && water) { const [g, c] = landNear(x, y); setTile(i, g, c); }
    }
  }

  // ground type and climate of the closest land, for a spot that has just risen out of the sea
  function landNear(x, y) {
    const p = state.project, W = p.W, H = p.H;
    for (let r = 1; r <= 6; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const xx = x + dx, yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
          const j = yy * W + xx;
          if (!p.gtTable[p.gtIdx[j]].water) return [p.gtIdx[j], p.clIdx[j]];
        }
      }
    }
    const b = state.brush;
    const i = y * W + x;
    if (b.gt >= 0 && !p.gtTable[b.gt].water) return [b.gt, b.cl >= 0 ? b.cl : p.clIdx[i]];
    return [Math.max(0, p.gtTable.findIndex((g) => g.key === 'fertility_low')), p.clIdx[i]];
  }

  function growDirty(x, y) {
    if (!dirtyRect) dirtyRect = { x0: x, y0: y, x1: x, y1: y };
    else {
      if (x < dirtyRect.x0) dirtyRect.x0 = x; if (x > dirtyRect.x1) dirtyRect.x1 = x;
      if (y < dirtyRect.y0) dirtyRect.y0 = y; if (y > dirtyRect.y1) dirtyRect.y1 = y;
    }
  }
  function growHDirty(x, y) {
    if (!hDirtyRect) hDirtyRect = { x0: x, y0: y, x1: x, y1: y };
    else {
      if (x < hDirtyRect.x0) hDirtyRect.x0 = x; if (x > hDirtyRect.x1) hDirtyRect.x1 = x;
      if (y < hDirtyRect.y0) hDirtyRect.y0 = y; if (y > hDirtyRect.y1) hDirtyRect.y1 = y;
    }
  }

  function flushDirty() {
    const p = state.project;
    if (dirtyRect || hDirtyRect) treesChanged();
    if (dirtyRect) {
      view.updateRect(farmShown(dirtyRect), p.clIdx, dirtyRect.x0, dirtyRect.y0, dirtyRect.x1, dirtyRect.y1);
      dirtyRect = null;
    }
    if (hDirtyRect) {
      view.updateHeights(hDirtyRect.x0, hDirtyRect.y0, hDirtyRect.x1, hDirtyRect.y1);
      hDirtyRect = null;
    }
    updateButtons();
  }

  function strokeTo(from, to, pressure0, pressure1) {
    const r = brushRadiusPx(Math.max(pressure0 ?? 1, pressure1 ?? 1));
    const spacing = activeTip() ? Math.max(0.5, r * 2 * S().tipSpacing / 100) : Math.max(0.5, r * 0.25);
    const dx = to.x - from.x, dy = to.y - from.y;
    const dist = Math.hypot(dx, dy) + (stroke.carry || 0);
    if (dist < spacing) { stroke.carry = dist; return; }
    const steps = Math.floor(dist / spacing);
    const start = spacing - (stroke.carry || 0);
    const len = Math.hypot(dx, dy) || 1;
    for (let s = 0; s < steps; s++) {
      const t = Math.min(1, (start + s * spacing) / len);
      const pr = pressure0 == null ? null : pressure0 + (pressure1 - pressure0) * t;
      dab(from.x + dx * t, from.y + dy * t, pr);
    }
    stroke.carry = dist - steps * spacing;
  }

  function fillAt(mx, my) {
    const p = state.project;
    if (state.target === 'height') { toast('Fill paints textures. Switch the brush to Textures (E) to use it.'); return; }
    if (!canPaint()) { toast(state.target === 'climate' ? 'Pick a climate first.' : rampActive() ? 'Add a stop to the height ramp first.' : 'Pick a texture in the key first.'); return; }
    if (coastOn()) coastPrep();
    const W = p.W, H = p.H;
    const sx = Math.round(mx), sy = Math.round(my);
    if (sx < 0 || sy < 0 || sx >= W || sy >= H) return;
    const start = sy * W + sx;
    const g0 = p.gtIdx[start], c0 = p.clIdx[start];
    const b = state.brush;
    const useRamp = rampActive();
    const clOnly = state.target === 'climate';
    const setGT = !clOnly && $('#paintGT').checked && (useRamp || b.gt >= 0);
    const setCL = clOnly || ($('#paintCL').checked && (useRamp || b.cl >= 0));
    const paint = texPainter();
    // flood across pixels matching what is being changed: filling a climate floods the whole climate area
    const seen = new Uint8Array(W * H);
    const stack = [start];
    seen[start] = 1;
    beginStroke();
    let n = 0;
    const protect = S().protectCoast && !clOnly; // climates don't move the coast, so a climate fill crosses it
    const water0 = !!p.gtTable[g0].water;
    while (stack.length) {
      const i = stack.pop();
      const x = i % W, y = (i / W) | 0;
      const v = paint(i, x, y);
      if (v && (v[0] !== p.gtIdx[i] || v[1] !== p.clIdx[i])) { setTile(i, v[0], v[1]); n++; }
      const nb = [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, y > 0 ? i - W : -1, y < H - 1 ? i + W : -1];
      for (const j of nb) {
        if (j < 0 || seen[j]) continue;
        if (setGT && origGT(j) !== g0) continue;
        if (setCL && origCL(j) !== c0) continue;
        if (protect && !!p.gtTable[origGT(j)].water !== water0) continue;
        seen[j] = 1; stack.push(j);
      }
    }
    function origGT(j) { const c = stroke.changes.get(j); return c ? c[0] : p.gtIdx[j]; }
    function origCL(j) { const c = stroke.changes.get(j); return c ? c[1] : p.clIdx[j]; }
    endStroke();
    flushDirty();
    toast(`Filled ${Math.round(n / 4).toLocaleString()} tiles`, '', 1500);
  }

  function pickAt(mx, my) {
    const p = state.project;
    const x = Math.round(mx), y = Math.round(my);
    if (x < 0 || y < 0 || x >= p.W || y >= p.H) return;
    if (state.target === 'height') {
      setHeightTarget(Math.round(view.heightAt(mx, my)));
      toast(`Target height set to ${S().heightTarget} m`, '', 1500);
      return;
    }
    const i = y * p.W + x;
    const gi = p.gtIdx[i], ci = p.clIdx[i];
    if (state.target === 'climate') { selectClimateOnly(ci); return; }
    if (p.gtTable[gi].water) selectBrush(gi, -1); else selectBrush(gi, ci);
    $('#paintCL').checked = !p.gtTable[gi].water;
    markSelected(true);
  }

  function applyChanges(rec, undo) {
    const p = state.project;
    if (rec.pc) { pcApply(rec.pc, undo); return; }
    if (rec.rv) { rvApply(rec.rv, undo); return; }
    if (rec.nm) { nmApply(rec.nm, undo); return; }
    if (rec.rs) { roRestore(undo ? rec.rs.before : rec.rs.after); return; }
    if (rec.cs) { colourRestore(undo ? rec.cs.before : rec.cs.after); return; }
    if (rec.lt) { lightRestore(undo ? rec.lt.before : rec.lt.after); return; }
    for (const [i, c] of rec.t) {
      const g = undo ? c[0] : c[2], k = undo ? c[1] : c[3];
      if (p.clIdx[i] !== k) { p.clCounts[p.clIdx[i]]--; p.clCounts[k]++; }
      if (c[0] !== c[2]) p.dirty.gt = true; // only the file the change touched needs saving
      if (c[1] !== c[3]) p.dirty.cl = true;
      p.gtIdx[i] = g; p.clIdx[i] = k;
      growDirty(i % p.W, (i / p.W) | 0);
    }
    if (rec.h) {
      const D = p.heights.data, { idx, a, b } = rec.h;
      for (let k = 0; k < idx.length; k++) {
        const i = idx[k];
        D[i] = undo ? a[k] : b[k];
        growHDirty(i % p.W, (i / p.W) | 0);
      }
      p.dirty.h = true;
    }
    flushDirty();
  }
  function undo() { if (rvCurveLive() && rvCurve.pts.length) { rvCurvePop(); return; } const c = state.undo.pop(); if (!c) return; applyChanges(c, true); state.redo.push(c); updateButtons(); }
  function redo() { const c = state.redo.pop(); if (!c) return; applyChanges(c, false); state.undo.push(c); updateButtons(); }

  function isDirty() { const p = state.project; return !!(p && (p.dirty.gt || p.dirty.cl || p.dirty.h || treeBakePending() || groundBakePending() || tileBakePending() || seaBakePending() || (p.pc && (p.pc.dirty || p.pc.regDirty)) || (p.riv && p.riv.dirty) || p.namesDirty || p.regStructDirty)); }

  function updateButtons() {
    $('#btnSave').disabled = !isDirty();
    $('#btnSave').textContent = isDirty() ? 'Save •' : 'Save';
    $('#btnUndo').disabled = !state.undo.length;
    $('#btnRedo').disabled = !state.redo.length;
  }

  // ---------------------------------------------------------------- saving
  function timestamp() {
    const d = new Date(), z = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}${z(d.getMonth() + 1)}${z(d.getDate())}_${z(d.getHours())}${z(d.getMinutes())}${z(d.getSeconds())}`;
  }

  function encodeIndexed(idx, table, W, H, meta) {
    const rgba = new Uint8Array(W * H * 4);
    for (let i = 0, o = 0; i < idx.length; i++, o += 4) {
      const c = table[idx[i]].rgb;
      rgba[o] = c[0]; rgba[o + 1] = c[1]; rgba[o + 2] = c[2]; rgba[o + 3] = 255;
    }
    const bpp = meta && meta.bpp === 32 ? 32 : 24;
    return Images.encodeTGA(W, H, rgba, bpp, !(meta && meta.topDown));
  }

  // New contents for the height files. Only vertices whose height changed are rewritten; everything
  // else keeps the exact bytes the files had.
  async function heightFiles() {
    const p = state.project, hs = p.heights, W = p.W, H = p.H;
    const n = W * H;
    let count = 0;
    for (let i = 0; i < n; i++) if (hs.data[i] !== hs.orig[i]) count++;
    if (!count) return [];
    const changed = new Int32Array(count);
    for (let i = 0, k = 0; i < n; i++) if (hs.data[i] !== hs.orig[i]) changed[k++] = i;
    const out = [];
    if (hs.files.tga) {
      const img = Images.decodeTGA(await host.read(hs.files.tga));
      if (img.width === W && img.height === H) {
        for (const i of changed) hs.codec.toTGA(hs.data[i], img.data, i * 4);
        out.push({ path: hs.files.tga, data: Images.encodeTGA(W, H, img.data, img.tga.bpp === 32 ? 32 : 24, !img.tga.topDown) });
      }
    }
    if (hs.files.hgt) {
      const b = new Uint8Array(await host.read(hs.files.hgt));
      const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
      if (dv.getInt32(0, true) === W && dv.getInt32(4, true) === H && b.byteLength >= 8 + n * 4) {
        for (const i of changed) dv.setFloat32(8 + ((H - 1 - ((i / W) | 0)) * W + (i % W)) * 4, hs.data[i], true);
        out.push({ path: hs.files.hgt, data: b });
      }
    }
    if (hs.files.png && hs.codec.ok) {
      try {
        const png = await Images.decodePNG16(await host.read(hs.files.png));
        if (png.width === W && png.height === H) {
          for (const i of changed) png.data[i] = hs.codec.toPNG(hs.data[i]);
          out.push({ path: hs.files.png, data: await Images.encodePNG16(W, H, png.data, png.chunks) });
        }
      } catch (e) {
        console.warn(e);
        saveNotes.push(`map_heights_ex.png was not updated (${e.message}).`);
      }
    }
    return out;
  }
  let saveNotes = [];
  // text back into the game's Windows-1252 bytes
  let enc1252 = null;
  function encode1252(txt) {
    if (!enc1252) {
      enc1252 = new Map();
      const dec = new TextDecoder('windows-1252');
      for (let b = 128; b < 256; b++) enc1252.set(dec.decode(new Uint8Array([b])), b);
    }
    const out = new Uint8Array(txt.length);
    for (let i = 0; i < txt.length; i++) { const c = txt.charCodeAt(i); out[i] = c < 128 ? c : (enc1252.get(txt[i]) ?? 63); }
    return out;
  }

  async function save() {
    const p = state.project;
    rvCurveCommit();
    if (!isDirty()) return true;
    try {
      loading('Saving…');
      saveNotes = [];
      const files = [];
      if (p.dirty.gt) files.push({ path: p.gtFile, data: encodeIndexed(p.gtIdx, p.gtTable, p.W, p.H, p.gtMeta) });
      if (p.dirty.cl) files.push({ path: p.clFile, data: encodeIndexed(p.clIdx, p.climates, p.W, p.H, p.clMeta) });
      if (p.dirty.h) files.push(...(await heightFiles()));
      const pc = p.pc, pcSaved = pc && (pc.dirty || pc.regDirty);
      if (pc && pc.regDirty) {
        const meta = p.regions.tga || {};
        files.push({ path: M2.join(p.mapDir, 'map_regions.tga'), data: Images.encodeTGA(p.regions.width, p.regions.height, p.regions.data, meta.bpp === 32 ? 32 : 24, !meta.topDown) });
      }
      const rvSaved = !!(p.riv && p.riv.dirty);
      if (rvSaved) {
        const meta = p.features.tga || {};
        files.push({ path: M2.join(p.mapDir, 'map_features.tga'), data: Images.encodeTGA(p.features.width, p.features.height, p.features.data, meta.bpp === 32 ? 32 : 24, !meta.topDown) });
      }
      if (pc && pc.dirty && pc.file) files.push({ path: pc.file, data: encode1252(pc.lines.join(pc.eol) + (pc.lines[pc.lines.length - 1] === '' ? '' : pc.eol)) });
      const moves = [];
      if (S().rebuildRwm) moves.push(M2.join(p.mapDir, 'map.rwm'));
      // regions added or deleted: descr_regions.txt, the name lookup and the campaign files that list regions
      const roSaved = !!p.regStructDirty;
      if (roSaved) {
        const enc = (o) => encode1252(o.lines.join(o.eol));
        files.push({ path: M2.join(p.mapDir, 'descr_regions.txt'), data: enc(p.regText) });
        if (p.lookup) files.push({ path: M2.join(p.mapDir, 'descr_regions_and_settlement_name_lookup.txt'), data: enc(p.lookup) });
        for (const [path, o] of p.regExtra || []) if (o.dirty) files.push({ path, data: enc(o) });
      }
      // renamed regions and settlements: the names file, and its .strings.bin moved aside so the game builds it again
      const nmSaved = !!(p.namesDirty && p.placeNames);
      let nmOut = null, nmMsg = '';
      if (nmSaved) {
        nmOut = namesFileData();
        files.push({ path: p.placeNames.modFile, data: nmOut.data });
        if (p.placeNames.modBin) moves.push(p.placeNames.modBin);
      }
      const backupRoot = M2.join(p.loc.modRoot, 'map_painter_backups', timestamp());
      for (const f of files) state.ownWrites.set(norm(f.path), Date.now());
      const trees = treeBakePending(), ground = groundBakePending(), sea = seaBakePending(), tilesC = tileBakePending();
      if (!files.length && !trees && !ground && !sea && !tilesC) { p.dirty.gt = p.dirty.cl = p.dirty.h = false; updateButtons(); return true; }
      let rep = { moved: [] };
      if (files.length) {
        rep = await host.saveWithBackup({ files, moves, backupRoot, relBase: p.loc.modRoot });
        for (const f of files) state.ownWrites.set(norm(f.path), Date.now());
      }
      p.dirty.gt = p.dirty.cl = p.dirty.h = false;
      p.heights.orig.set(p.heights.data);
      if (rvSaved) { p.riv.dirty = false; renderRiverPanel(); }
      if (roSaved) {
        p.regStructDirty = false;
        for (const o of (p.regExtra || new Map()).values()) o.dirty = false;
      }
      if (nmSaved) {
        const P = p.placeNames;
        P.modTxt = { file: P.modFile, lines: nmOut.lines, eol: nmOut.eol };
        nmMsg = ` Region and settlement names written to data\\text\\${M2.basename(P.modFile)}${P.modBin ? `; ${M2.basename(P.modBin)} was moved into the backup so the game builds it again` : ''}.`;
        P.modBin = null;
        p.namesDirty = false;
      }
      let treeMsg = '';
      if (pcSaved) {
        pc.dirty = pc.regDirty = false;
        // stone forts on the map whose battle maps the mod lacks: copied in from the British Isles campaign
        const used = [...new Set(pcParse().forts.map((f) => f.words[0]).filter((t) => STONE_FORTS.includes(t)))];
        if (used.length && pc.stone !== 'installed') {
          loading('Copying the stone fort battle maps…');
          try {
            const n = await installStoneForts(used);
            if (n) treeMsg += ` Copied the battle maps of ${used.join(', ')} from the British Isles campaign into ${M2.join(p.loc.dataDir, ...STONE_FORT_DIR)} (${n} files).`;
          } catch (e) { console.warn(e); saveNotes.push(`The stone fort battle maps could not be copied into the mod: ${e.message}.`); }
        }
        renderPiecesPanel();
      }
      if (trees) {
        loading('Saving the tree colour…');
        const n = await bakeTrees();
        treeMsg = ` Tree colour written into ${n} tree pictures, with the game's brighter tree lighting taken out so the game shows this shade (originals kept in map_painter_backups\\tree_textures_original).`;
      }
      if (sea) {
        loading('Saving the sea colour…');
        try {
          const f = await bakeSea();
          treeMsg += groundAdjIdentity(seaAdj()) ? ` ${M2.basename(M2.dirname(f))}\water_surface.tga is back to its original.`
            : ` Sea colour written into ${M2.basename(M2.dirname(f))}\water_surface.tga (original kept in map_painter_backups\sea_surface_original).`;
        } catch (e) { console.warn(e); saveNotes.push(`water_surface.tga could not be changed: ${e.message}.`); }
      }
      if (ground) {
        loading('Saving the map colour into the ground textures…');
        const n = await bakeGround();
        await clearStaleGroundCache(Object.values(p.groundBake.files).map((e) => e.target));
        treeMsg += groundAdjIdentity(groundAdj()) && !Object.keys(currentTexAdj()).length
          ? ` The ${n} ground textures are back to their originals.`
          : ` Map colour written into ${n} ground textures (originals kept in map_painter_backups\\ground_textures_original).`;
      }
      if (tilesC) {
        loading('Saving the tile model picture colours…');
        try {
          const n = await bakeTiles();
          treeMsg += Object.keys(currentTileAdj()).length
            ? ` Colour written into ${n} tile model picture${n === 1 ? '' : 's'} (originals kept in map_painter_backups\\tile_textures_original).`
            : ` The ${n} tile model picture${n === 1 ? ' is' : 's are'} back to ${n === 1 ? 'its original' : 'their originals'}.`;
        } catch (e) { console.warn(e); saveNotes.push(`The tile model pictures could not be changed: ${e.message}.`); }
      }
      updateButtons();
      colourState();
      adjState('tree'); adjState('sea');
      const rwm = (rep.moved || []).some((m) => /map\.rwm$/i.test(String(m.from || m))) ? ' map.rwm was moved into the backup so the game rebuilds the map on next launch.'
        : rvSaved && !S().rebuildRwm ? ' map.rwm was left in place, so the game keeps the old rivers until it is removed.' : '';
      const names = files.map((f) => M2.basename(f.path));
      const list = names.length > 1 ? names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1] : names[0];
      const mapMsg = files.length ? `Saved ${list}. Backup: ${backupRoot}.${rwm}` : 'Saved.';
      toast(`${mapMsg}${nmMsg}${treeMsg}${saveNotes.length ? ' ' + saveNotes.join(' ') : ''}`, saveNotes.length ? 'err' : 'ok', 12000);
      return true;
    } catch (e) {
      toast('Save failed: ' + e.message, 'err', 10000);
      return false;
    } finally { loading(null); }
  }

  // ---------------------------------------------------------------- input
  let pointer = null; // active drag
  let spaceDown = false;
  let lastMouse = null;

  function setTool(t) {
    endAdjust();
    if (t !== 'rivers') rvCurveCommit();
    state.tool = t;
    $$('.tool').forEach((b) => b.classList.toggle('active', b.dataset.tool === t));
    glCanvas.classList.toggle('pan', t === 'pan');
    renderPiecesPanel();
    renderRiverPanel();
    renderBorderPanel();
    if (view) applyViewSettings();
    drawOverlay();
  }
  $$('.tool').forEach((b) => b.addEventListener('click', () => setTool(b.dataset.tool)));

  glCanvas.addEventListener('contextmenu', (e) => e.preventDefault());

  const is3D = () => !!(view && view.opts.is3D);
  // screen position -> map vertex coords (in 3D: the terrain under the cursor, or null)
  function screenToMap(cx, cy) {
    if (is3D()) { const h = view.pick3D(cx, cy); return h ? { x: h.x, y: h.y } : null; }
    return view.toMap(cx, cy);
  }

  glCanvas.addEventListener('pointerdown', (e) => {
    if (!state.project) return;
    glCanvas.setPointerCapture(e.pointerId);
    const navTool = state.tool === 'pan' || spaceDown;
    if (e.button === 2 && e.altKey) {
      // as in Photoshop: Alt + right drag sizes the brush (left/right) and sets its hardness (up/down)
      pointer = { type: 'resize', x: e.clientX, y: e.clientY, sx: e.offsetX, sy: e.offsetY, at: screenToMap(e.offsetX, e.offsetY), size0: S().brushSize, hard0: S()[hardKey()] };
      return;
    }
    if (is3D()) {
      // right drag (pen barrel button) turns the camera, middle drag or Shift moves it
      if (e.button === 1 || ((e.button === 2 || navTool) && e.shiftKey)) { pointer = { type: 'pan3d', x: e.clientX, y: e.clientY }; glCanvas.classList.add('panning'); return; }
      if (e.button === 2 || (navTool && e.button === 0)) { pointer = { type: 'orbit', x: e.clientX, y: e.clientY }; glCanvas.classList.add('panning'); return; }
    } else if (e.button === 1 || e.button === 2 || navTool) {
      pointer = { type: 'pan', x: e.clientX, y: e.clientY };
      glCanvas.classList.add('panning');
      return;
    }
    if (e.button !== 0) return;
    if (state.adjust) {
      // handles move, size and turn the guide; dragging outside it moves the view
      const hit = guideHit(state.adjust.g, e.offsetX, e.offsetY);
      if (!hit) { pointer = { type: 'pan', x: e.clientX, y: e.clientY }; glCanvas.style.cursor = 'grabbing'; return; }
      adjustSnapshot();
      const m0 = view.toMap(e.offsetX, e.offsetY);
      const hm = hit.p ? view.toMap(hit.p.x, hit.p.y) : m0; // grab the handle itself, not the point beside it
      pointer = { type: 'guide', kind: hit.kind, sx: hit.sx, sy: hit.sy, m0, off: { x: hm.x - m0.x, y: hm.y - m0.y }, g0: guideXf(state.adjust.g) };
      if (hit.kind === 'rotate') glCanvas.style.cursor = 'grabbing';
      return;
    }
    if (state.tool === 'pieces') { pointer = pcPointerDown(e); drawOverlay(); return; }
    if (state.tool === 'rivers') { pointer = rvPointerDown(e); drawOverlay(); return; }
    if (state.tool === 'borders') { pointer = rgPointerDown(e); drawOverlay(); return; }
    const m = screenToMap(e.offsetX, e.offsetY);
    if (!m) return;
    if (e.altKey || state.tool === 'pick') { pickAt(m.x, m.y); return; }
    if (state.tool === 'fill') { fillAt(m.x, m.y); return; }
    if (!canPaint()) {
      toast(state.target === 'height' ? (state.project.heights.reason || 'Heights cannot be painted on this map.') : state.target === 'climate' ? 'Pick a climate first: click any texture of that climate in the key, its Paint button, or Alt+click the map.' : 'Pick a texture in the key on the right first.', '', 6000);
      return;
    }
    const pr = penPressure(e);
    if (state.target === 'height' && S().heightTool === 'grab') {
      // grab: the ground under the brush is picked up where you click and follows the pointer up or down
      pointer = { type: 'grab', anchor: m, sy: e.offsetY, r: brushRadiusPx(null), lift: 0, perPx: grabMetresPerPixel() };
      beginStroke(m.x, m.y);
      return;
    }
    if (S().strokeMode === 'anchored') {
      // a click stamps at the brush size; dragging away from the click sizes and turns the stamp
      pointer = { type: 'anchor', anchor: m, cur: m, pressure: pr, r: brushRadiusPx(null), ang: anchorAngle(m, m), sized: false };
      beginStroke(m.x, m.y);
      applyAnchor();
      return;
    }
    pointer = { type: 'paint', last: m, pressure: pr };
    beginStroke(m.x, m.y);
    dab(m.x, m.y, pr);
  });

  function penPressure(e) {
    if (e.pointerType === 'pen' || e.pointerType === 'touch') {
      state.pen = e.pressure;
      return e.pressure;
    }
    return null; // mouse: full strength
  }

  glCanvas.addEventListener('pointermove', (e) => {
    if (!state.project) return;
    lastMouse = { x: e.offsetX, y: e.offsetY, pressure: e.pointerType === 'pen' ? e.pressure : null };
    if (e.pointerType === 'pen') { state.pen = e.pressure; $('#stPen').textContent = `Pen ${Math.round(e.pressure * 100)}%`; }
    if (pointer && pointer.type === 'pan') {
      view.pan(e.clientX - pointer.x, e.clientY - pointer.y);
      pointer.x = e.clientX; pointer.y = e.clientY;
    } else if (pointer && (pointer.type === 'orbit' || pointer.type === 'pan3d')) {
      if (pointer.type === 'orbit') view.orbit(e.clientX - pointer.x, e.clientY - pointer.y);
      else view.pan3D(e.clientX - pointer.x, e.clientY - pointer.y);
      pointer.x = e.clientX; pointer.y = e.clientY;
    } else if (pointer && pointer.type === 'anchor') {
      const rr = glCanvas.getBoundingClientRect();
      const m = screenToMap(e.clientX - rr.left, e.clientY - rr.top);
      const pr = penPressure(e);
      // the hardest press counts, so lifting the pen at the end doesn't weaken the stamp
      if (pr != null) pointer.pressure = Math.max(pointer.pressure ?? 0, pr);
      if (m) {
        pointer.cur = m;
        const d = Math.hypot(m.x - pointer.anchor.x, m.y - pointer.anchor.y);
        if (d > 1.5 || pointer.sized) {
          pointer.sized = true;
          pointer.r = Math.min(ANCHOR_MAX, Math.max(0.6, d));
          pointer.ang = anchorAngle(pointer.anchor, m);
        }
      }
      scheduleAnchor();
    } else if (pointer && pointer.type === 'grab') {
      const rr = glCanvas.getBoundingClientRect();
      pointer.lift = (pointer.sy - (e.clientY - rr.top)) * pointer.perPx;
      if (!pointer.pending) { pointer.pending = true; requestAnimationFrame(applyGrab); }
    } else if (pointer && pointer.type === 'resize') {
      // the outline's edge follows the pointer sideways: one screen pixel per pixel of radius
      const r0 = resizeRadius0(pointer);
      const dx = e.clientX - pointer.x, dy = e.clientY - pointer.y;
      setBrushSize(pointer.size0 * Math.max(0.01, (r0 + dx) / r0));
      const hard = Math.round(Math.min(100, Math.max(0, pointer.hard0 + dy * 0.5)));
      S()[hardKey()] = hard; showHardness(); saveSettings();
    } else if (pointer && pointer.type === 'piece') {
      const rr = glCanvas.getBoundingClientRect();
      pcPointerMove(pointer, e.clientX - rr.left, e.clientY - rr.top);
    } else if (pointer && pointer.type === 'river') {
      const rr = glCanvas.getBoundingClientRect();
      const evs = !is3D() && e.getCoalescedEvents ? e.getCoalescedEvents() : [];
      for (const ce of (evs.length ? evs : [e])) rvPointerMove(pointer, ce.clientX - rr.left, ce.clientY - rr.top);
    } else if (pointer && pointer.type === 'region') {
      const rr = glCanvas.getBoundingClientRect();
      const evs = !is3D() && e.getCoalescedEvents ? e.getCoalescedEvents() : [];
      for (const ce of (evs.length ? evs : [e])) rgPointerMove(pointer, ce.clientX - rr.left, ce.clientY - rr.top);
    } else if (pointer && pointer.type === 'guide') {
      const rr = glCanvas.getBoundingClientRect();
      dragGuide(pointer, view.toMap(e.clientX - rr.left, e.clientY - rr.top), e);
    } else if (!pointer && state.adjust) {
      glCanvas.style.cursor = guideCursor(guideHit(state.adjust.g, e.offsetX, e.offsetY));
    } else if (pointer && pointer.type === 'paint') {
      // in 3D every sample needs a ray cast, so the coalesced samples are skipped there
      const evs = !is3D() && e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
      const r = glCanvas.getBoundingClientRect();
      for (const ce of (evs.length ? evs : [e])) {
        const m = screenToMap(ce.clientX - r.left, ce.clientY - r.top);
        // some drivers leave pressure at 0 on coalesced samples; fall back to the parent event
        const pr = (ce.pointerType === 'pen' && !(ce.pressure > 0)) ? penPressure(e) : penPressure(ce);
        if (!m) { pointer.last = null; continue; }
        if (!pointer.last) dab(m.x, m.y, pr);
        else strokeTo(pointer.last, m, pointer.pressure, pr);
        pointer.last = m; pointer.pressure = pr;
      }
    }
    updateHover();
    drawOverlay();
  });

  const endPointer = () => {
    if (pointer && pointer.type === 'piece') { const pt = pointer; pointer = null; pcPointerUp(pt); }
    if (pointer && pointer.type === 'river') { const pt = pointer; pointer = null; rvPointerUp(pt); }
    if (pointer && pointer.type === 'region') { const pt = pointer; pointer = null; rgPointerUp(pt); }
    if (pointer && pointer.type === 'anchor' && pointer.pending) applyAnchor();
    if (pointer && pointer.type === 'grab' && pointer.pending) applyGrab();
    if (pointer && (pointer.type === 'paint' || pointer.type === 'anchor' || pointer.type === 'grab')) endStroke();
    if (pointer && pointer.type === 'guide') persistGuides();
    if (pointer && state.adjust) glCanvas.style.cursor = '';
    const resized = pointer && pointer.type === 'resize';
    pointer = null;
    glCanvas.classList.remove('panning');
    if (resized) drawOverlay();
  };
  glCanvas.addEventListener('pointerup', endPointer);
  glCanvas.addEventListener('pointercancel', endPointer);
  glCanvas.addEventListener('pointerleave', () => { lastMouse = null; drawOverlay(); });

  glCanvas.addEventListener('wheel', (e) => {
    if (!state.project) return;
    e.preventDefault();
    if (e.ctrlKey && !e.deltaMode) { // pinch / ctrl+wheel
      view.zoomAt(e.offsetX, e.offsetY, Math.exp(-e.deltaY * 0.01));
    } else if (e.shiftKey) {
      setBrushSize(S().brushSize * (e.deltaY > 0 ? 0.9 : 1.1));
    } else {
      view.zoomAt(e.offsetX, e.offsetY, Math.exp(-e.deltaY * 0.0015 * (e.deltaMode ? 30 : 1)));
    }
    updateZoom();
    drawOverlay();
  }, { passive: false });

  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' && e.target.type !== 'checkbox' && e.target.type !== 'range' && e.target.type !== 'color') return;
    const k = e.key.toLowerCase();
    if (e.ctrlKey && k === 's') { e.preventDefault(); save(); return; }
    if (e.ctrlKey && k === 'o') { e.preventDefault(); openDialog(); return; }
    if (e.ctrlKey && k === 'z' && !e.shiftKey) { e.preventDefault(); if (state.adjust) adjustUndo(); else undo(); return; }
    if (e.ctrlKey && (k === 'y' || (k === 'z' && e.shiftKey))) { e.preventDefault(); redo(); return; }
    if (e.ctrlKey) return;
    if (k === ' ') { spaceDown = true; glCanvas.classList.add('pan'); e.preventDefault(); return; }
    if (!state.project) return;
    if (state.adjust) {
      if (k === 'escape' || k === 'enter') { e.preventDefault(); endAdjust(); return; }
      if (k.startsWith('arrow') && e.target.type !== 'range') {
        e.preventDefault();
        if (!e.repeat) adjustSnapshot();
        const step = (e.shiftKey ? 10 : 1) * (window.devicePixelRatio || 1) / view.view.scale; // screen pixels
        const g = state.adjust.g;
        if (k === 'arrowleft') g.cx -= step; else if (k === 'arrowright') g.cx += step;
        else if (k === 'arrowup') g.cy -= step; else g.cy += step;
        syncGuides(); updateGuideInfo(); persistGuides(); drawOverlay();
        return;
      }
    }
    if (state.tool === 'rivers' && rvCurveLive()) {
      if (k === 'enter') { e.preventDefault(); rvCurveCommit(); drawOverlay(); return; }
      if (k === 'escape') { e.preventDefault(); rvCurveCancel(); drawOverlay(); return; }
      if (k === 'backspace' || k === 'delete') { e.preventDefault(); rvCurvePop(); drawOverlay(); return; }
    }
    if (k === 'tab') { e.preventDefault(); set3D(!is3D()); }
    else if (k === 'b') setTool('brush');
    else if (k === 'g') setTool('fill');
    else if (k === 'i') setTool('pick');
    else if (k === 'h') setTool('pan');
    else if (k === 'e') setTarget(state.target === 'height' ? 'tex' : 'height');
    else if (k === 'k') setTarget(state.target === 'climate' ? 'tex' : 'climate');
    else if (k === 'a') setStrokeMode(S().strokeMode === 'anchored' ? 'free' : 'anchored');
    else if (k === 'l') setSea(!S().seaOverlay);
    else if (k === 'o') setGuidesHidden(!state.guidesHidden);
    else if (k === 't') setTrees(!S().trees);
    else if (k === 'f') { view.fit(); updateZoom(); }
    else if (k === '[') setBrushSize(S().brushSize - (S().brushSize > 6 ? 2 : 0.5));
    else if (k === ']') setBrushSize(S().brushSize + (S().brushSize >= 6 ? 2 : 0.5));
    else if (k >= '1' && k <= '8') setMode(+k - 1);
    else if (k === 'c') setCavity(!S().cavity);
    else if (k === 'r') setRampOn(!S().rampOn);
    else if (k === 'p') setTool(state.tool === 'pieces' ? 'brush' : 'pieces');
    else if (k === 'v') setTool(state.tool === 'rivers' ? 'brush' : 'rivers');
    else if ((k === 'delete' || k === 'backspace') && state.tool === 'pieces' && state.project.pc && state.project.pc.sel) {
      const it = pcItems().find((x) => pcSame(x, state.project.pc.sel));
      if (it) pcDelete(it);
    } else if (k === 'escape' && state.tool === 'pieces' && state.project.pc) { state.project.pc.sel = null; renderPiecesPanel(); }
    else if ((k === 'delete' || k === 'backspace') && S().rampOn && rampSel >= 0) rampRemove(rampSel);
    else return;
    drawOverlay();
  });
  window.addEventListener('keyup', (e) => {
    if (e.key === 'Alt') e.preventDefault();
    if (e.key === ' ') { spaceDown = false; glCanvas.classList.toggle('pan', state.tool === 'pan'); }
  });

  function updateHover() {
    const p = state.project;
    if (!lastMouse) return;
    const m = screenToMap(lastMouse.x, lastMouse.y);
    const x = m ? Math.round(m.x) : -1, y = m ? Math.round(m.y) : -1;
    if (x < 0 || y < 0 || x >= p.W || y >= p.H) { $('#stPos').textContent = '–'; return; }
    const i = y * p.W + x;
    const tx = Math.min((p.W - 1) / 2 - 1, Math.floor(m.x / 2)), ty = Math.min((p.H - 1) / 2 - 1, Math.floor(m.y / 2));
    const tilesH = (p.H - 1) / 2;
    $('#stPos').textContent = `Tile ${tx}, ${tilesH - 1 - ty}`;
    const gt = p.gtTable[p.gtIdx[i]], cl = p.climates[p.clIdx[i]];
    $('#stClimate').textContent = cl.label;
    $('#stGround').textContent = gt.label;
    const layer = layerFor(p.gtIdx[i], p.clIdx[i]);
    $('#stTex').textContent = layer ? layer.name : (gt.water ? 'water' : '');
    const h = p.heights.data[i];
    $('#stHeight').textContent = `${Math.round(h)} m${h <= 0 ? ' (below sea level)' : ''}`;
    rampHover(h);
    let reg = '';
    if (p.regions) {
      const rx = Math.min(p.regions.width - 1, Math.max(0, tx)), ry = Math.min(p.regions.height - 1, Math.max(0, ty));
      const o = (ry * p.regions.width + rx) * 4;
      const c = [p.regions.data[o], p.regions.data[o + 1], p.regions.data[o + 2]];
      const r = p.regionByColour.get(c.join(','));
      reg = r ? r.name.replace(/_/g, ' ') : (c[0] + c[1] + c[2] === 0 ? 'Settlement' : '');
    }
    $('#stRegion').textContent = reg;
  }

  function updateZoom() {
    if (!view) return;
    $('#stZoom').textContent = is3D() ? '3D' : `${Math.round(view.view.scale * 50)}%`;
  }

  // the brush's screen radius when an Alt + right drag started
  function resizeRadius0(pt) {
    if (pt.r0) return pt.r0;
    const dpr = window.devicePixelRatio || 1, rad = pt.size0 * 2;
    let r = 0;
    if (!is3D()) r = rad * view.view.scale / dpr;
    else if (pt.at) {
      const c = view.project3D(pt.at.x, pt.at.y, view.heightAt(pt.at.x, pt.at.y));
      const e = view.project3D(pt.at.x + rad, pt.at.y, view.heightAt(pt.at.x + rad, pt.at.y));
      if (c && e) r = Math.hypot(e.x - c.x, e.y - c.y);
    }
    pt.r0 = Math.max(4, r || 40);
    return pt.r0;
  }

  // the brush preview while Alt + right dragging: red where it paints fully, fading out where it is soft
  function drawResize(pt) {
    const rad = brushRadiusPx(null);
    const R = resizeRadius0(pt) * S().brushSize / pt.size0;
    const hard = S()[hardKey()] / 100;
    const tip = activeTip();
    if (!tip) {
      const g = octx.createRadialGradient(pt.sx, pt.sy, R * hard * 0.999, pt.sx, pt.sy, R);
      g.addColorStop(0, 'rgba(230,60,50,.5)'); g.addColorStop(1, 'rgba(230,60,50,0)');
      octx.fillStyle = 'rgba(230,60,50,.5)';
      octx.beginPath(); octx.arc(pt.sx, pt.sy, R * hard, 0, Math.PI * 2); octx.fill();
      octx.fillStyle = g;
      octx.beginPath(); octx.arc(pt.sx, pt.sy, R, 0, Math.PI * 2); octx.fill();
    }
    if (pt.at) brushOutline(pt.at, rad, S().tipAngle * Math.PI / 180, tip, null);
    else { octx.strokeStyle = 'rgba(255,240,200,.95)'; octx.lineWidth = 1.5; octx.beginPath(); octx.arc(pt.sx, pt.sy, R, 0, Math.PI * 2); octx.stroke(); }
    const label = `Size ${S().brushSize} · Hardness ${S()[hardKey()]}%`;
    octx.font = '12px Segoe UI';
    const w = octx.measureText(label).width + 12;
    const lx = pt.sx - w / 2, ly = pt.sy - R - 30;
    octx.fillStyle = 'rgba(20,22,27,.88)'; octx.fillRect(lx, ly, w, 20);
    octx.fillStyle = '#fff'; octx.fillText(label, lx + 6, ly + 14);
  }

  function drawOverlay() {
    const dpr = window.devicePixelRatio || 1;
    const r = overlay.getBoundingClientRect();
    if (overlay.width !== Math.round(r.width * dpr) || overlay.height !== Math.round(r.height * dpr)) {
      overlay.width = Math.round(r.width * dpr); overlay.height = Math.round(r.height * dpr);
    }
    octx.setTransform(dpr, 0, 0, dpr, 0, 0);
    octx.clearRect(0, 0, r.width, r.height);
    drawCoastBand();
    drawPlaceNames();
    drawPieceMarks();
    drawLandBridges();
    if (pointer && pointer.type === 'resize' && state.project) { drawResize(pointer); return; }
    if (state.tool === 'rivers') { drawRiverCursor(); return; }
    if (state.tool === 'borders') { drawRegionCursor(); return; }
    if (state.adjust && state.project && !is3D()) { drawGuideFrame(state.adjust.g); return; }
    if (!lastMouse || !state.project) return;
    const { x, y } = lastMouse;
    const anchored = !!(pointer && pointer.type === 'anchor');
    if (pointer && pointer.type === 'grab') {
      brushOutline(pointer.anchor, pointer.r, 0, activeTip(), null);
      octx.fillStyle = '#fff'; octx.font = '12px Segoe UI';
      const v = Math.round(pointer.lift);
      octx.fillText(`Grab ${v > 0 ? '+' : ''}${v} m`, x + 10, y - 10);
      return;
    }
    if (state.tool === 'pan' || spaceDown || (pointer && !anchored && pointer.type !== 'paint')) return;
    const tip = activeTip();
    if (state.tool === 'brush') {
      // the outline sits on the anchor while a stamp is being placed, otherwise under the cursor
      if (anchored) {
        brushOutline(pointer.anchor, pointer.r, pointer.ang, tip, null);
        const a = is3D() ? view.project3D(pointer.anchor.x, pointer.anchor.y, view.heightAt(pointer.anchor.x, pointer.anchor.y)) : view.toScreen(pointer.anchor.x, pointer.anchor.y);
        if (a) {
          octx.setLineDash([4, 4]); octx.lineWidth = 1.5; octx.strokeStyle = 'rgba(255,240,200,.9)';
          octx.beginPath(); octx.moveTo(a.x, a.y); octx.lineTo(x, y); octx.stroke(); octx.setLineDash([]);
          octx.fillStyle = 'rgba(255,240,200,.95)'; octx.beginPath(); octx.arc(a.x, a.y, 3, 0, Math.PI * 2); octx.fill();
        }
      } else {
        const c = screenToMap(x, y);
        const radP = lastMouse.pressure != null && S().pressureSize && S().strokeMode !== 'anchored' ? brushRadiusPx(lastMouse.pressure) : null;
        if (c) brushOutline(c, brushRadiusPx(1), S().tipAngle * Math.PI / 180, tip, radP);
      }
    }
    // crosshair
    octx.lineWidth = 1.5;
    octx.strokeStyle = 'rgba(255,240,200,.9)';
    octx.beginPath(); octx.moveTo(x - 5, y); octx.lineTo(x + 5, y); octx.moveTo(x, y - 5); octx.lineTo(x, y + 5); octx.stroke();
    octx.fillStyle = '#fff'; octx.font = '12px Segoe UI';
    if (state.tool === 'pick') octx.fillText(state.target === 'height' ? 'pick height' : 'pick', x + 8, y - 8);
    if (state.tool === 'fill') octx.fillText('fill', x + 8, y - 8);
    if (state.tool === 'brush' && state.target === 'height') octx.fillText(HEIGHT_TOOLS[S().heightTool] || '', x + 8, y - 8);
    if (state.tool === 'brush' && state.target === 'climate') { const cl = state.clBrush >= 0 && state.project.climates[state.clBrush]; octx.fillText(cl ? `climate: ${cl.label}` : 'climate', x + 8, y - 8); }
  }

  // Draws the brush outline at map point c with radius rad (map units). radP: pressure-scaled radius.
  function brushOutline(c, rad, ang, tip, radP) {
    const dpr = window.devicePixelRatio || 1;
    if (is3D()) {
      // laid on the terrain
      const pts = [];
      const N = tip ? 32 : 48;
      for (let k = 0; k <= N; k++) {
        let px, py;
        if (tip) { // square, walked edge by edge
          const e = Math.floor(k / 8) % 4, t = (k % 8) / 8;
          const q = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
          const a = q[e], b = q[(e + 1) % 4];
          const lx = (a[0] + (b[0] - a[0]) * t) * rad, ly = (a[1] + (b[1] - a[1]) * t) * rad;
          px = c.x + lx * Math.cos(ang) - ly * Math.sin(ang); py = c.y + lx * Math.sin(ang) + ly * Math.cos(ang);
        } else { const th = k / N * Math.PI * 2; px = c.x + Math.cos(th) * rad; py = c.y + Math.sin(th) * rad; }
        const sp = view.project3D(px, py, view.heightAt(px, py));
        if (sp) pts.push(sp);
      }
      for (const [col, w] of [['rgba(0,0,0,.6)', 3], ['rgba(255,240,200,.95)', 1.5]]) {
        octx.strokeStyle = col; octx.lineWidth = w; octx.beginPath();
        pts.forEach((pt, k) => (k ? octx.lineTo(pt.x, pt.y) : octx.moveTo(pt.x, pt.y)));
        octx.stroke();
      }
      return;
    }
    const sc = view.toScreen(c.x, c.y);
    const R = rad * view.view.scale / dpr;
    const RP = radP != null ? radP * view.view.scale / dpr : null;
    octx.lineWidth = 1.5;
    if (tip && tip.canvas) {
      octx.save();
      octx.translate(sc.x, sc.y); octx.rotate(ang);
      octx.globalAlpha = 0.45;
      octx.drawImage(tip.canvas, -(RP ?? R), -(RP ?? R), 2 * (RP ?? R), 2 * (RP ?? R));
      octx.globalAlpha = 1;
      octx.strokeStyle = 'rgba(255,240,200,.8)';
      octx.strokeRect(-R, -R, 2 * R, 2 * R);
      octx.restore();
    } else {
      octx.strokeStyle = 'rgba(0,0,0,.6)';
      octx.beginPath(); octx.arc(sc.x, sc.y, R + 1, 0, Math.PI * 2); octx.stroke();
      octx.strokeStyle = 'rgba(255,240,200,.95)';
      octx.beginPath(); octx.arc(sc.x, sc.y, R, 0, Math.PI * 2); octx.stroke();
      if (RP != null) {
        octx.setLineDash([3, 3]);
        octx.beginPath(); octx.arc(sc.x, sc.y, RP, 0, Math.PI * 2); octx.stroke();
        octx.setLineDash([]);
      }
    }
  }

  // ---------------------------------------------------------------- toolbar wiring
  const HEIGHT_TOOLS = { raise: 'Raise', lower: 'Lower', grab: 'Grab', smooth: 'Smooth', flatten: 'Flatten', set: 'Set height', noise: 'Noise' };
  const HEIGHT_HELP = {
    raise: 'Builds the ground up under the brush.',
    lower: 'Digs the ground down under the brush.',
    grab: 'Click and drag up to pull the ground up, down to push it down. The brush area moves as one, softest at its edge (Hardness). Strength sets how fast it moves.',
    smooth: 'Evens out bumps and sharp edges.',
    flatten: 'Levels the ground to the height where the stroke started.',
    set: 'Levels the ground to the height in the box. Alt+click the map to pick a height.',
    noise: 'Adds rough, natural-looking variation.',
  };

  function setBrushSize(v) {
    v = Math.max(0.5, Math.min(40, Math.round(v * 2) / 2));
    S().brushSize = v; $('#brushSize').value = v; $('#brushSizeVal').textContent = v;
    saveSettings(); drawOverlay();
    if (state.tool === 'borders') { const n = $('#borderPanel .rg-sizenote'); if (n) n.textContent = `${rgMode === 'drag' ? 'Reach' : 'Brush'}: ${v} tile${v === 1 ? '' : 's'} round the pointer. It is the brush Size in the top bar ([ and ], Shift + wheel, or Alt + right-drag).`; }
  }
  function showHardness() { const v = S()[hardKey()]; $('#brushHard').value = v; $('#brushHardVal').textContent = v + '%'; }
  $('#brushSize').addEventListener('input', (e) => setBrushSize(+e.target.value));
  $('#brushDensity').addEventListener('input', (e) => { S().brushDensity = +e.target.value; $('#brushDensityVal').textContent = e.target.value + '%'; saveSettings(); });
  $('#brushHard').addEventListener('input', (e) => { S()[hardKey()] = +e.target.value; $('#brushHardVal').textContent = e.target.value + '%'; saveSettings(); });
  $('#hStrength').addEventListener('input', (e) => { S().heightStrength = +e.target.value; $('#hStrengthVal').textContent = e.target.value + '%'; saveSettings(); updateBrushUI(); });
  $('#hTarget').addEventListener('change', (e) => setHeightTarget(+e.target.value));
  $('#moveCoast').addEventListener('change', (e) => { S().moveCoast = e.target.checked; saveSettings(); });
  $('#exag').addEventListener('input', (e) => { S().exag3d = +e.target.value; $('#exagVal').textContent = (+e.target.value).toFixed(1) + '×'; applyViewSettings(); saveSettings(); drawOverlay(); });
  $('#btnOpen').onclick = openDialog;
  $('#btnOpen2').onclick = openDialog;
  $('#btnSave').onclick = save;
  $('#btnUndo').onclick = undo;
  $('#btnRedo').onclick = redo;
  $('#btnSettings').onclick = openSettings;
  $('#btn3D').onclick = () => state.project && set3D(!is3D());
  $('#btnSea').onclick = () => setSea(!S().seaOverlay);
  $('#keySearch').addEventListener('input', () => state.project && buildKey());
  $('#onlyOnMap').addEventListener('change', (e) => { S().onlyOnMap = e.target.checked; saveSettings(); state.project && buildKey(); });
  $$('#target button').forEach((b) => b.addEventListener('click', () => setTarget(b.dataset.target)));
  $$('#heightTool button').forEach((b) => b.addEventListener('click', () => setHeightTool(b.dataset.htool)));
  $$('#strokeMode button').forEach((b) => b.addEventListener('click', () => setStrokeMode(b.dataset.stroke)));
  // Freehand paints along the stroke; Anchored places one stamp that the drag sizes and turns
  function setStrokeMode(m) {
    S().strokeMode = m; saveSettings();
    document.body.classList.toggle('anchored', m === 'anchored');
    $$('#strokeMode button').forEach((b) => b.classList.toggle('active', b.dataset.stroke === m));
    if (state.tool !== 'brush') setTool('brush');
    drawOverlay();
  }

  // what the brush paints: textures (ground type / climate) or heights
  function setTarget(t) {
    if (t === 'height' && state.project && !state.project.heights.editable) {
      toast(state.project.heights.reason || 'Heights cannot be painted on this map.', 'err', 7000);
      t = 'tex';
    }
    if (t === 'climate' && state.clBrush < 0 && state.brush.cl >= 0) state.clBrush = state.brush.cl;
    state.target = t;
    document.body.classList.toggle('target-height', t === 'height');
    document.body.classList.toggle('target-climate', t === 'climate');
    $$('#target button').forEach((b) => b.classList.toggle('active', b.dataset.target === t));
    showHardness();
    updateBrushUI();
    if (state.project) markSelected();
    applyViewSettings();
    drawOverlay();
  }
  function setHeightTool(t) {
    S().heightTool = t; saveSettings();
    $$('#heightTool button').forEach((b) => b.classList.toggle('active', b.dataset.htool === t));
    $('#hTargetWrap').classList.toggle('dim', t !== 'set');
    if (state.target !== 'height') setTarget('height');
    if (state.tool !== 'brush') setTool('brush');
    updateBrushUI();
  }
  function setHeightTarget(v) {
    if (!Number.isFinite(v)) return;
    const c = state.project && state.project.heights.codec;
    if (c && c.ok) v = Math.min(c.maxLand, Math.max(c.minSea, v));
    S().heightTarget = v; $('#hTarget').value = v; saveSettings();
    updateBrushUI();
  }
  function set3D(on) {
    if (on) endAdjust();
    if (on) {
      try { view.init3D(); } catch (e) { console.error(e); toast('The 3D view could not start on this graphics card: ' + e.message, 'err', 10000); on = false; }
    }
    view.opts.is3D = on;
    $('#btn3D').classList.toggle('active', on);
    $('#hint3d').hidden = !on;
    document.body.classList.toggle('view3d', on);
    view.dirty = true;
    updateZoom(); drawOverlay();
  }
  function setSea(on) {
    S().seaOverlay = on; saveSettings();
    $('#btnSea').classList.toggle('active', on);
    $('#seaLegend').hidden = !on;
    if (view) { view.opts.sea = on; view.dirty = true; }
  }

  function setMode(m) {
    view.opts.mode = m; view.dirty = true;
    $$('#viewMode button').forEach((b) => b.classList.toggle('active', +b.dataset.mode === m));
    $('#matcapSel').hidden = m !== 5;
    drawOverlay();
  }

  // ---------------------------------------------------------------- matcap materials, cavity, colour grid
  // Built-in matcaps are drawn here: a lit ball seen head on, one picture per material.
  const MATCAPS = [['clay', 'Grey clay'], ['white', 'White studio'], ['redwax', 'Red wax'], ['jade', 'Jade'],
    ['chrome', 'Chrome'], ['gold', 'Gold'], ['normals', 'Normals (RGB)'], ['custom', 'Your own picture…']];
  function makeMatcap(name) {
    const N = 256, data = new Uint8Array(N * N * 4);
    const norm = (v) => { const l = Math.hypot(v[0], v[1], v[2]); return v.map((x) => x / l); };
    const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    const key = norm([-0.55, 0.6, 0.6]), fill = norm([0.7, -0.2, 0.5]);
    const mats = {
      clay: { c: [0.4, 0.4, 0.41], spec: 0.08, pow: 12 },
      white: { c: [0.85, 0.85, 0.85], spec: 0.25, pow: 30 },
      redwax: { c: [0.62, 0.1, 0.07], spec: 0.45, pow: 40, wrap: 0.5 },
      jade: { c: [0.18, 0.5, 0.32], spec: 0.35, pow: 50, wrap: 0.4 },
    };
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      let nx = (x + 0.5) / N * 2 - 1, ny = 1 - (y + 0.5) / N * 2;
      const r2 = nx * nx + ny * ny;
      if (r2 > 1) { const r = Math.sqrt(r2); nx /= r; ny /= r; }
      const n = [nx, ny, Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny))];
      let c;
      if (name === 'normals') {
        // the normal straight as colour: red to the right, green up the screen, blue towards you
        c = [n[0] * 0.5 + 0.5, n[1] * 0.5 + 0.5, n[2] * 0.5 + 0.5].map((v) => Math.pow(v, 2.2));
      } else if (name === 'chrome' || name === 'gold') {
        const rf = [2 * n[2] * n[0], 2 * n[2] * n[1], 2 * n[2] * n[2] - 1];  // the view ray reflected
        const t = rf[1];
        const sky = [0.55, 0.65, 0.8], hor = [1.1, 1.1, 1.05], gnd = [0.06, 0.05, 0.04];
        c = t > 0 ? sky.map((v, i) => v + (hor[i] - v) * Math.pow(1 - t, 6)) : gnd.map((v, i) => v + (hor[i] - v) * Math.pow(1 + t, 14));
        const hl = Math.pow(Math.max(0, dot(rf, key)), 120) * 4;
        c = c.map((v) => v + hl);
        if (name === 'gold') c = [c[0], c[1] * 0.72, c[2] * 0.32];
      } else {
        const m = mats[name] || mats.clay, w = m.wrap || 0;
        const d = (L) => Math.max(0, (dot(n, L) + w) / (1 + w));
        const hv = norm([key[0], key[1], key[2] + 1]);
        const lit = 0.12 + 1.0 * d(key) + 0.25 * d(fill) + 0.35 * Math.pow(1 - n[2], 3) * Math.max(0, n[1] + 0.3);
        const sp = m.spec * Math.pow(Math.max(0, dot(n, hv)), m.pow) * 3;
        c = m.c.map((v) => v * lit + sp);
      }
      const i = (y * N + x) * 4;
      for (let k = 0; k < 3; k++) data[i + k] = Math.round(255 * Math.pow(Math.min(1, Math.max(0, c[k])), 1 / 2.2));
      data[i + 3] = 255;
    }
    return { width: N, height: N, data };
  }
  const imageToRgba = (img, size) => {
    const cv = document.createElement('canvas');
    cv.width = size || img.naturalWidth || img.width; cv.height = size || img.naturalHeight || img.height;
    const cx = cv.getContext('2d'); cx.drawImage(img, 0, 0, cv.width, cv.height);
    const id = cx.getImageData(0, 0, cv.width, cv.height);
    return { width: cv.width, height: cv.height, data: new Uint8Array(id.data.buffer) };
  };
  const loadImageUrl = (url) => new Promise((ok, bad) => {
    const im = new Image(); im.onload = () => ok(im); im.onerror = () => bad(new Error('could not read the picture')); im.src = url;
  });
  const MATCAP_KEY = 'm2mp.matcapCustom';
  async function applyMatcap() {
    if (!view) return;
    const name = S().matcap || 'clay';
    $('#matcapSel').value = name;
    if (name === 'custom') {
      let url = null; try { url = localStorage.getItem(MATCAP_KEY); } catch (e) { /* storage blocked */ }
      if (url) { try { view.setMatcap(imageToRgba(await loadImageUrl(url), 256)); return; } catch (e) { console.error(e); } }
      view.setMatcap(makeMatcap('clay'));
      return;
    }
    view.setMatcap(makeMatcap(name));
  }
  async function loadColorGrid() {
    try { view.setColorGrid(imageToRgba(await loadImageUrl('https://media.base44.com/images/public/69b19c3e0adc62e74eaa66c4/65cf6525e614587aebcb76769c7186df_colorgrid.png'))); } catch (e) { console.error(e); }
  }
  {
    const sel = $('#matcapSel');
    for (const [v, t] of MATCAPS) sel.append(el('option', { value: v, text: t }));
    sel.value = S().matcap || 'clay';
    const file = el('input', { type: 'file', accept: 'image/*' });
    file.addEventListener('change', async () => {
      const f = file.files && file.files[0]; file.value = '';
      if (!f) { sel.value = S().matcap; return; }
      try {
        // kept in this browser's storage so it comes back next time
        const rgba = imageToRgba(await loadImageUrl(URL.createObjectURL(f)), 256);
        const cv = document.createElement('canvas'); cv.width = cv.height = 256;
        cv.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(rgba.data.buffer), 256, 256), 0, 0);
        try { localStorage.setItem(MATCAP_KEY, cv.toDataURL('image/png')); } catch (e) { /* storage blocked: this session only */ }
        S().matcap = 'custom'; saveSettings();
        view.setMatcap(rgba);
        toast('Matcap picture loaded');
      } catch (e) { toast('That picture could not be read: ' + e.message, 'err'); sel.value = S().matcap; }
    });
    sel.addEventListener('change', () => {
      if (sel.value === 'custom') { file.click(); return; }
      S().matcap = sel.value; saveSettings(); applyMatcap();
    });
  }
  function setCavity(on) { S().cavity = on; saveSettings(); applyViewSettings(); }
  $('#btnCavity').addEventListener('click', () => setCavity(!S().cavity));
  $('#btnColour').addEventListener('click', () => { if ($('#colourPanel').hidden) { setAdjPanel('tree', false); setAdjPanel('sea', false); } setColourPanel($('#colourPanel').hidden); });
  $('#btnTreeColour').addEventListener('click', () => setAdjPanel('tree', $('#treeColourPanel').hidden));
  $('#btnSeaColour').addEventListener('click', () => setAdjPanel('sea', $('#seaColourPanel').hidden));
  $('#btnLight').addEventListener('click', () => setLightPanel($('#lightPanel').hidden));
  $('#btnForest').addEventListener('click', () => setForest(!S().forestOn));
  $('#forestKind').addEventListener('change', (e) => { S().forestKind = e.target.value; saveSettings(); });
  $('#forestWith').addEventListener('change', (e) => { S().forestWith = e.target.value; saveSettings(); });
  $$('#viewMode button').forEach((b) => b.addEventListener('click', () => state.project && setMode(+b.dataset.mode)));
  $$('#season button').forEach((b) => b.addEventListener('click', () => {
    state.season = b.dataset.season;
    $$('#season button').forEach((x) => x.classList.toggle('active', x === b));
    if (state.project) {
      buildLUT(); buildKey(); buildTreeInstances();
      if (state.brush.gt >= 0 && state.brush.cl >= 0) selectBrush(state.brush.gt, state.brush.cl);
      updateHover();
    }
  }));

  // ---------------------------------------------------------------- alpha brushes
  // Kept as image files in %APPDATA%\M2 Map Painter\brushes. White paints, black leaves alone; an image
  // with transparency uses its alpha instead. Right-click a brush to invert it.
  const TIP_SIZE = 256;
  let tipDir = null;
  async function brushesDir() {
    if (!tipDir) tipDir = (await host.appdir()).brushes;
    return tipDir;
  }

  async function makeTip(name, file, bytes) {
    const img = await Images.decodeAny(bytes, name);
    const sc = TIP_SIZE / Math.max(img.width, img.height);
    const w = Math.max(1, Math.round(img.width * sc)), h = Math.max(1, Math.round(img.height * sc));
    const px = await Images.resizeRGBA(img, w, h);
    let hasAlpha = false;
    for (let i = 3; i < img.data.length; i += 4) if (img.data[i] < 250) { hasAlpha = true; break; }
    const mask = new Float32Array(TIP_SIZE * TIP_SIZE);
    const ox = (TIP_SIZE - w) >> 1, oy = (TIP_SIZE - h) >> 1;
    const inv = !!(S().tipInvert || {})[name];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const o = (y * w + x) * 4;
        let v = hasAlpha ? px[o + 3] / 255 : (0.299 * px[o] + 0.587 * px[o + 1] + 0.114 * px[o + 2]) / 255;
        if (inv) v = 1 - v;
        mask[(y + oy) * TIP_SIZE + x + ox] = v;
      }
    }
    if (inv) { // padding counts as "no paint" either way
      for (let y = 0; y < TIP_SIZE; y++) for (let x = 0; x < TIP_SIZE; x++) if (x < ox || x >= ox + w || y < oy || y >= oy + h) mask[y * TIP_SIZE + x] = 0;
    }
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = TIP_SIZE;
    const g = canvas.getContext('2d');
    const id = g.createImageData(TIP_SIZE, TIP_SIZE);
    for (let i = 0; i < mask.length; i++) { id.data[i * 4] = 255; id.data[i * 4 + 1] = 240; id.data[i * 4 + 2] = 200; id.data[i * 4 + 3] = Math.round(mask[i] * 255); }
    g.putImageData(id, 0, 0);
    const th = document.createElement('canvas');
    th.width = th.height = 64;
    const tg = th.getContext('2d');
    tg.fillStyle = '#0e1013'; tg.fillRect(0, 0, 64, 64);
    tg.drawImage(canvas, 0, 0, 64, 64);
    return { name, file, size: TIP_SIZE, mask, canvas, thumb: th.toDataURL('image/png') };
  }

  async function loadTips() {
    state.tips = [];
    try {
      const dir = await brushesDir();
      const entries = (await host.list(dir)).filter((e) => !e.isDir && /\.(png|tga|dds|jpe?g|bmp|webp|gif)$/i.test(e.name));
      entries.sort((a, b) => a.name.localeCompare(b.name));
      for (const e of entries) {
        const file = M2.join(dir, e.name);
        try { state.tips.push(await makeTip(e.name, file, await host.read(file))); } catch (err) { console.warn('brush', e.name, err); }
      }
    } catch (e) { console.warn(e); }
    if (S().tip !== 'round' && !activeTip()) S().tip = 'round';
    buildTips();
  }

  function buildTips() {
    const box = $('#tips');
    box.innerHTML = '';
    const add = (name, label, thumb) => {
      const b = el('button', { class: 'tip' + (S().tip === name ? ' active' : ''), title: label },
        thumb ? el('img', { src: thumb, alt: '' }) : el('span', { class: 'round-tip' }));
      b.addEventListener('click', () => { S().tip = name; saveSettings(); buildTips(); drawOverlay(); });
      if (name !== 'round') b.addEventListener('contextmenu', (e) => { e.preventDefault(); tipMenu(name, e.clientX, e.clientY); });
      box.append(b);
    };
    add('round', 'Round brush (uses Hardness)', null);
    for (const t of state.tips) add(t.name, t.name + '\nRight-click to invert or remove', t.thumb);
    box.append(el('button', { class: 'tip add', title: 'Import alpha brushes (PNG, TGA, JPG…)', onclick: importTips }, '+'));
    $('#tipOpts').hidden = !activeTip();
  }

  async function importTips() {
    const files = await pickImageFile(true);
    if (!files || !files.length) return;
    let dir;
    try { dir = await brushesDir(); } catch (e) { toast(e.message, 'err', 12000); return; }
    const existing = new Set(state.tips.map((t) => t.name.toLowerCase()));
    let last = null;
    for (const f of files) {
      try {
        await makeTip(f.name, '', f.bytes); // check it decodes before saving it
        const clean = f.name.replace(/[\\/:*?"<>|]/g, '_');
        const dot = clean.lastIndexOf('.') > 0 ? clean.lastIndexOf('.') : clean.length;
        let name = clean;
        for (let n = 2; existing.has(name.toLowerCase()); n++) name = `${clean.slice(0, dot)} (${n})${clean.slice(dot)}`;
        existing.add(name.toLowerCase());
        await host.writeFile(M2.join(dir, name), f.bytes);
        last = name;
      } catch (e) { toast(`Could not use ${f.name} as a brush: ${e.message}`, 'err', 8000); }
    }
    await loadTips();
    if (last) { S().tip = last; saveSettings(); buildTips(); toast(`Imported ${files.length === 1 ? last : files.length + ' brushes'}`, 'ok'); }
  }

  async function tipMenu(name, x, y) {
    const t = state.tips.find((k) => k.name === name);
    if (!t) return;
    const id = await popupMenu(x, y, [
      { id: 'invert', label: (S().tipInvert || {})[name] ? 'Don’t invert' : 'Invert (black paints)' },
      { id: 'reveal', label: 'Open brushes folder' },
      { type: 'separator' },
      { id: 'remove', label: 'Remove brush' },
    ]);
    if (id === 'invert') {
      S().tipInvert = { ...(S().tipInvert || {}), [name]: !(S().tipInvert || {})[name] };
      saveSettings();
      const nt = await makeTip(name, t.file, await host.read(t.file));
      state.tips[state.tips.indexOf(t)] = nt;
      buildTips(); drawOverlay();
    } else if (id === 'reveal') host.showItem(t.file);
    else if (id === 'remove') {
      if ((await ask(`Remove the brush "${name}"?`, 'The image file is deleted from the brushes folder.', ['Remove', 'Cancel'])) !== 0) return;
      try { await host.removeFile(t.file); } catch (e) { toast('Could not remove it: ' + e.message, 'err'); return; }
      if (S().tip === name) S().tip = 'round';
      saveSettings();
      await loadTips();
    }
  }
  $('#tipAngle').addEventListener('input', (e) => { S().tipAngle = +e.target.value; $('#tipAngleVal').textContent = e.target.value + '°'; saveSettings(); drawOverlay(); });
  $('#tipRandom').addEventListener('change', (e) => { S().tipRandom = e.target.checked; saveSettings(); });
  $('#tipSpacing').addEventListener('input', (e) => { S().tipSpacing = +e.target.value; $('#tipSpacingVal').textContent = e.target.value + '%'; saveSettings(); });

  // ---------------------------------------------------------------- guide images
  // Pictures laid over the map to paint against, such as a real map. Each import is copied to
  // %APPDATA%\M2 Map Painter\overlays and remembered per map with its placement. Guides only show
  // in the painter; nothing about them goes into the map files.
  const MAX_GUIDES = 4;
  const GUIDE_EXT = /\.(png|jpe?g|webp|bmp|gif|tga|dds)$/i;
  const GUIDE_KEYS = ['name', 'file', 'cx', 'cy', 'w', 'h', 'ang', 'opacity', 'visible', 'srcW', 'srcH'];
  let guideDir = null;
  async function guidesDir() {
    if (!guideDir) guideDir = M2.join((await host.appdir()).dir, 'overlays');
    return guideDir;
  }

  // Decodes a picture, scaled down to what the graphics card takes. Returns { bmp, srcW, srcH }.
  async function guidePicture(bytes, name) {
    let bmp = null;
    const dds = bytes[0] === 0x44 && bytes[1] === 0x44 && bytes[2] === 0x53 && bytes[3] === 0x20;
    if (!dds && !/\.tga$/i.test(name)) { try { bmp = await createImageBitmap(new Blob([bytes])); } catch { bmp = null; } }
    if (!bmp) {
      const img = await Images.decodeAny(bytes, name);
      bmp = await createImageBitmap(new ImageData(new Uint8ClampedArray(img.data.buffer, img.data.byteOffset, img.width * img.height * 4), img.width, img.height));
    }
    const srcW = bmp.width, srcH = bmp.height;
    const max = view.maxGuideSize();
    if (Math.max(srcW, srcH) > max) {
      const k = max / Math.max(srcW, srcH);
      const small = await createImageBitmap(bmp, { resizeWidth: Math.max(1, Math.round(srcW * k)), resizeHeight: Math.max(1, Math.round(srcH * k)), resizeQuality: 'high' });
      bmp.close(); bmp = small;
    }
    return { bmp, srcW, srcH };
  }

  function attachPicture(g, pic) {
    g.tex = view.makeGuideTexture(pic.bmp);
    g.srcW = pic.srcW; g.srcH = pic.srcH;
    const th = document.createElement('canvas');
    th.width = 56; th.height = 40;
    const tg = th.getContext('2d');
    tg.fillStyle = '#0e1013'; tg.fillRect(0, 0, 56, 40);
    const k = Math.min(56 / pic.bmp.width, 40 / pic.bmp.height);
    const w = pic.bmp.width * k, h = pic.bmp.height * k;
    tg.drawImage(pic.bmp, (56 - w) / 2, (40 - h) / 2, w, h);
    g.thumb = th.toDataURL('image/png');
    pic.bmp.close();
  }

  // stretch: cover the whole map. fit: as large as fits with the picture's own shape. shape: keep the width, restore the shape.
  function placeGuide(g, how) {
    const p = state.project, MW = p.W - 1, MH = p.H - 1;
    if (how === 'stretch') Object.assign(g, { cx: MW / 2, cy: MH / 2, w: MW, h: MH, ang: 0 });
    else if (how === 'fit') {
      const k = Math.min(MW / g.srcW, MH / g.srcH);
      Object.assign(g, { cx: MW / 2, cy: MH / 2, w: g.srcW * k, h: g.srcH * k, ang: 0 });
    } else if (how === 'shape') g.h = g.w * g.srcH / g.srcW;
  }

  // pushes the guides to the renderer
  function syncGuides() {
    if (!view) return;
    view.guides = state.guidesHidden ? [] : state.guides.filter((g) => g.tex && g.visible && g.opacity > 0)
      .map((g) => ({ tex: g.tex, cx: g.cx, cy: g.cy, w: g.w, h: g.h, ang: g.ang, alpha: g.opacity }));
    view.dirty = true;
    $('#btnGuides').classList.toggle('has', state.guides.some((g) => g.tex) && !state.guidesHidden);
    $('#guidesShow').checked = !state.guidesHidden;
  }
  function persistGuides() {
    if (!state.guidesKey) return;
    const all = { ...(S().guides || {}) };
    const list = state.guides.map((g) => Object.fromEntries(GUIDE_KEYS.map((k) => [k, g[k]])));
    if (list.length) all[state.guidesKey] = list; else delete all[state.guidesKey];
    S().guides = all;
    saveSettings();
  }
  function guidesChanged() { syncGuides(); persistGuides(); }

  async function loadGuides(mapDir) {
    const key = norm(mapDir);
    if (state.guidesKey === key) { syncGuides(); buildGuides(); return; } // reloading the same map keeps them
    endAdjust();
    for (const g of state.guides) view.deleteTexture(g.tex);
    state.guides = []; state.guidesKey = key;
    syncGuides(); buildGuides();
    const list = [];
    for (const s of ((S().guides || {})[key] || []).slice(0, MAX_GUIDES)) {
      const g = { ...s };
      try { attachPicture(g, await guidePicture(await host.read(g.file), g.file)); } catch (e) { console.warn('guide', g.file, e); g.missing = true; }
      list.push(g);
    }
    if (state.guidesKey !== key) { list.forEach((g) => view.deleteTexture(g.tex)); return; } // another map was opened meanwhile
    state.guides = list;
    const bad = list.filter((g) => g.missing);
    if (bad.length) toast(`Guide image${bad.length > 1 ? 's' : ''} not found: ${bad.map((g) => g.name).join(', ')}`, 'err', 8000);
    syncGuides(); buildGuides();
  }

  // files: [{ name, bytes }], or none to ask for them
  async function importGuides(files) {
    if (!state.project) { toast('Open a map first.'); return; }
    if (!files) files = await pickImageFile(true);
    if (!files || !files.length) return;
    let dir;
    try { dir = await guidesDir(); } catch (e) { toast(e.message, 'err', 12000); return; }
    const added = [];
    for (const f of files) {
      if (state.guides.length >= MAX_GUIDES) { toast(`A map can have up to ${MAX_GUIDES} guide images. Remove one to add another.`, 'err', 7000); break; }
      try {
        const pic = await guidePicture(f.bytes, f.name);
        const clean = f.name.replace(/[\\/:*?"<>|]/g, '_');
        const dot = clean.lastIndexOf('.') > 0 ? clean.lastIndexOf('.') : clean.length;
        let file = M2.join(dir, clean);
        for (let n = 2; await host.exists(file); n++) file = M2.join(dir, `${clean.slice(0, dot)} (${n})${clean.slice(dot)}`);
        try { await host.writeFile(file, f.bytes); } catch (e) { pic.bmp.close(); throw e; }
        const g = { name: clean.slice(0, dot), file, opacity: 0.5, visible: true };
        attachPicture(g, pic);
        // a picture already shaped like the map is stretched over it; any other keeps its shape
        const p = state.project;
        placeGuide(g, Math.abs((g.srcW / g.srcH) / ((p.W - 1) / (p.H - 1)) - 1) < 0.03 ? 'stretch' : 'fit');
        state.guides.push(g);
        added.push(g);
      } catch (e) { toast(`Could not use ${f.name} as a guide: ${e.message}`, 'err', 8000); }
    }
    if (!added.length) return;
    state.guidesHidden = false;
    guidesChanged();
    showGuidePanel(true);
    toast(added.length === 1 ? `Added ${added[0].name}. Use Adjust to line it up with the map.` : `Added ${added.length} guide images.`, 'ok', 6000);
  }

  async function removeGuide(g) {
    if ((await ask(`Remove the guide "${g.name}"?`, 'It is taken off this map, along with its placement. The map files are not touched.', ['Remove', 'Cancel'])) !== 0) return;
    if (state.adjust && state.adjust.g === g) endAdjust();
    state.guides = state.guides.filter((x) => x !== g);
    view.deleteTexture(g.tex);
    guidesChanged(); buildGuides();
    // the copy in the overlays folder goes too, unless another map still uses it
    const used = Object.values(S().guides || {}).some((l) => l.some((x) => norm(x.file) === norm(g.file)));
    if (!used) host.removeFile(g.file).catch((e) => console.warn(e));
  }

  function showGuidePanel(on) {
    $('#guidePanel').hidden = !on;
    $('#btnGuides').classList.toggle('active', on);
    if (on) buildGuides(); else endAdjust();
  }
  function setGuidesHidden(on) {
    state.guidesHidden = on;
    if (on) endAdjust();
    syncGuides();
    if (state.guides.length) toast(on ? 'Guides hidden. Press O to show them again.' : 'Guides shown.', '', 2500);
  }

  function buildGuides() {
    const list = $('#guideList');
    list.innerHTML = '';
    if (!state.project) { list.append(el('div', { class: 'g-empty', text: 'Open a map first.' })); return; }
    if (!state.guides.length) {
      list.append(el('div', { class: 'g-empty', text: 'Import a picture, such as a real map, to paint over. It sits on top of the map at the opacity you choose and is never saved into the map files. You can also drop pictures onto the map.' }));
      return;
    }
    for (const g of [...state.guides].reverse()) { // the top guide first
      const adjusting = !!(state.adjust && state.adjust.g === g);
      const row = el('div', { class: 'g-row' + (adjusting ? ' adjusting' : '') + (g.missing ? ' missing' : '') });
      const vis = el('input', { type: 'checkbox' });
      vis.checked = !!g.visible; vis.disabled = !!g.missing;
      vis.addEventListener('change', () => { g.visible = vis.checked; if (!g.visible && adjusting) endAdjust(); guidesChanged(); });
      const top = el('div', { class: 'g-top' },
        g.thumb ? el('img', { src: g.thumb, alt: '' }) : null,
        el('label', { class: 'chk g-name', title: g.missing ? `Not found: ${g.file}` : `${g.name}\n${g.srcW}×${g.srcH} pixels` }, vis,
          el('span', { text: g.missing ? `${g.name} (file not found)` : g.name })));
      if (!g.missing) {
        top.append(el('button', {
          class: adjusting ? 'primary' : '', title: adjusting ? 'Finish adjusting (Enter)' : 'Move, resize and turn this guide on the map',
          onclick: () => (adjusting ? endAdjust() : startAdjust(g)),
        }, adjusting ? 'Done' : 'Adjust'));
      }
      top.append(el('button', { class: 'icon', title: 'Remove this guide', onclick: () => removeGuide(g) }, '✕'));
      row.append(top);
      if (!g.missing) {
        const pct = Math.round(g.opacity * 100);
        const val = el('span', { text: pct + '%' });
        const op = el('input', { type: 'range', min: 0, max: 100, step: 1, value: pct });
        op.addEventListener('input', () => {
          g.opacity = +op.value / 100; val.textContent = op.value + '%';
          if (!g.visible && g.opacity > 0) { g.visible = true; vis.checked = true; }
          guidesChanged();
        });
        row.append(el('label', { class: 'tb-field g-op', title: 'How solid the guide looks' }, 'Opacity', op, val));
      }
      if (adjusting) {
        const act = (label, title, fn) => el('button', { title, onclick: () => { adjustSnapshot(); fn(); guidesChanged(); updateGuideInfo(); drawOverlay(); } }, label);
        row.append(
          el('div', { class: 'g-adj' },
            act('Stretch to map', 'Cover the whole map exactly', () => placeGuide(g, 'stretch')),
            act('Fit to map', 'As large as fits on the map, keeping the picture\'s shape', () => placeGuide(g, 'fit')),
            act('Original shape', 'Undo any squashing or stretching, keeping the width', () => placeGuide(g, 'shape')),
            act('Straighten', 'Turn it back to 0°', () => { g.ang = 0; })),
          el('div', { class: 'g-info', id: 'guideInfo' }),
          el('div', { class: 'g-help', text: 'Drag the picture to move it. Drag a corner or edge to resize it (Shift keeps its shape, Alt resizes from the centre). Drag the round handle to turn it (Shift snaps to 15°). Arrow keys nudge it, Ctrl+Z undoes, Enter finishes.' }));
      }
      list.append(row);
    }
    updateGuideInfo();
  }

  function updateGuideInfo() {
    const box = $('#guideInfo');
    if (!box || !state.adjust) return;
    const g = state.adjust.g, p = state.project;
    box.textContent = `${(g.w / 2).toFixed(1)} × ${(g.h / 2).toFixed(1)} tiles · centre ${(g.cx / 2).toFixed(1)}, ${((p.H - 1 - g.cy) / 2).toFixed(1)} · turned ${Math.round(g.ang * 180 / Math.PI)}°`;
  }

  // ---- adjust mode: move, resize and turn one guide with handles on the map (2D only)
  const guideXf = (g) => ({ cx: g.cx, cy: g.cy, w: g.w, h: g.h, ang: g.ang });
  function startAdjust(g) {
    if (is3D()) set3D(false);
    if (!g.visible || g.opacity <= 0) { g.visible = true; if (g.opacity <= 0) g.opacity = 0.5; }
    state.guidesHidden = false;
    state.adjust = { g, history: [] };
    glCanvas.classList.add('adjusting');
    guidesChanged(); buildGuides(); drawOverlay();
  }
  function endAdjust() {
    if (!state.adjust) return;
    state.adjust = null;
    glCanvas.classList.remove('adjusting'); glCanvas.style.cursor = '';
    persistGuides(); buildGuides(); drawOverlay();
  }
  function adjustSnapshot() {
    const a = state.adjust;
    if (!a) return;
    a.history.push(guideXf(a.g));
    if (a.history.length > 200) a.history.shift();
  }
  function adjustUndo() {
    const a = state.adjust, t = a && a.history.pop();
    if (!t) return;
    Object.assign(a.g, t);
    guidesChanged(); updateGuideInfo(); drawOverlay();
  }

  // screen positions of the guide's corners, edge midpoints and turn handle
  function guideFrame(g) {
    const cs = Math.cos(g.ang), sn = Math.sin(g.ang), hw = g.w / 2, hh = g.h / 2;
    const P = (lx, ly) => view.toScreen(g.cx + lx * cs - ly * sn, g.cy + lx * sn + ly * cs);
    const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sy]) => ({ sx, sy, p: P(sx * hw, sy * hh) }));
    const edges = [[0, -1], [1, 0], [0, 1], [-1, 0]].map(([sx, sy]) => ({ sx, sy, p: P(sx * hw, sy * hh) }));
    const top = edges[0].p;
    // the guide's "up" is (sin, -cos) in map and screen space alike
    return { corners, edges, top, cen: P(0, 0), knob: { x: top.x + sn * 28, y: top.y - cs * 28 } };
  }

  function guideHit(g, x, y) {
    const f = guideFrame(g);
    const near = (p, r) => Math.hypot(p.x - x, p.y - y) <= r;
    if (near(f.knob, 10)) return { kind: 'rotate' };
    for (const c of [...f.corners, ...f.edges]) if (near(c.p, 9)) return { kind: 'scale', sx: c.sx, sy: c.sy, p: c.p, cen: f.cen };
    const m = view.toMap(x, y), cs = Math.cos(g.ang), sn = Math.sin(g.ang), dx = m.x - g.cx, dy = m.y - g.cy;
    if (Math.abs(cs * dx + sn * dy) <= g.w / 2 && Math.abs(-sn * dx + cs * dy) <= g.h / 2) return { kind: 'move' };
    return null;
  }
  const RESIZE_CURSORS = ['ew-resize', 'nwse-resize', 'ns-resize', 'nesw-resize'];
  function guideCursor(hit) {
    if (!hit) return 'grab'; // dragging outside the guide moves the view
    if (hit.kind === 'move') return 'move';
    if (hit.kind === 'rotate') return 'grab';
    const a = Math.atan2(hit.p.y - hit.cen.y, hit.p.x - hit.cen.x);
    return RESIZE_CURSORS[((Math.round(a / (Math.PI / 4)) % 4) + 4) % 4];
  }

  // pt: the drag started in pointerdown. m: pointer in map coords.
  function dragGuide(pt, m, e) {
    const g = state.adjust.g, g0 = pt.g0;
    if (pt.kind === 'move') {
      g.cx = g0.cx + m.x - pt.m0.x; g.cy = g0.cy + m.y - pt.m0.y;
    } else if (pt.kind === 'rotate') {
      let a = g0.ang + Math.atan2(m.y - g0.cy, m.x - g0.cx) - Math.atan2(pt.m0.y - g0.cy, pt.m0.x - g0.cx);
      if (e.shiftKey) a = Math.round(a / (Math.PI / 12)) * (Math.PI / 12);
      g.ang = Math.atan2(Math.sin(a), Math.cos(a));
    } else {
      // work in the guide's own frame; the opposite corner or edge stays put (the centre with Alt)
      const cs = Math.cos(g0.ang), sn = Math.sin(g0.ang);
      const hx = m.x + pt.off.x - g0.cx, hy = m.y + pt.off.y - g0.cy;
      const lx = cs * hx + sn * hy, ly = -sn * hx + cs * hy;
      const { sx, sy } = pt, mid = e.altKey, MIN = 1;
      const ax = mid ? 0 : -sx * g0.w / 2, ay = mid ? 0 : -sy * g0.h / 2, k = mid ? 2 : 1;
      let w = sx ? Math.max(MIN, sx * (lx - ax) * k) : g0.w;
      let h = sy ? Math.max(MIN, sy * (ly - ay) * k) : g0.h;
      if (e.shiftKey) {
        if (sx && sy) { const f = Math.max(w / g0.w, h / g0.h); w = g0.w * f; h = g0.h * f; }
        else if (sx) h = g0.h * w / g0.w;
        else w = g0.w * h / g0.h;
      }
      const ncx = mid || !sx ? 0 : ax + sx * w / 2, ncy = mid || !sy ? 0 : ay + sy * h / 2;
      Object.assign(g, { w, h, cx: g0.cx + cs * ncx - sn * ncy, cy: g0.cy + sn * ncx + cs * ncy });
    }
    syncGuides(); updateGuideInfo();
  }

  function drawGuideFrame(g) {
    const f = guideFrame(g);
    const poly = f.corners.map((c) => c.p);
    for (const [col, w] of [['rgba(0,0,0,.65)', 3.5], ['#f0c46a', 1.5]]) {
      octx.strokeStyle = col; octx.lineWidth = w;
      octx.beginPath();
      poly.forEach((p, i) => (i ? octx.lineTo(p.x, p.y) : octx.moveTo(p.x, p.y)));
      octx.closePath();
      octx.moveTo(f.top.x, f.top.y); octx.lineTo(f.knob.x, f.knob.y);
      octx.stroke();
    }
    octx.lineWidth = 1.5; octx.strokeStyle = 'rgba(0,0,0,.85)';
    octx.fillStyle = '#fff';
    for (const c of [...f.corners, ...f.edges]) { octx.beginPath(); octx.rect(c.p.x - 4.5, c.p.y - 4.5, 9, 9); octx.fill(); octx.stroke(); }
    octx.fillStyle = '#f0c46a';
    octx.beginPath(); octx.arc(f.knob.x, f.knob.y, 6, 0, Math.PI * 2); octx.fill(); octx.stroke();
    // centre mark
    octx.strokeStyle = 'rgba(255,240,200,.9)';
    octx.beginPath(); octx.moveTo(f.cen.x - 6, f.cen.y); octx.lineTo(f.cen.x + 6, f.cen.y); octx.moveTo(f.cen.x, f.cen.y - 6); octx.lineTo(f.cen.x, f.cen.y + 6); octx.stroke();
  }

  $('#btnGuides').onclick = () => showGuidePanel($('#guidePanel').hidden);
  $('#btnTrees').onclick = () => setTrees(!S().trees);
  $('#guideClose').onclick = () => showGuidePanel(false);
  $('#guideImport').onclick = () => importGuides();
  $('#guidesShow').addEventListener('change', (e) => setGuidesHidden(!e.target.checked));
  // pictures dropped on the map become guides
  $('#stage').addEventListener('dragover', (e) => {
    if (state.project && e.dataTransfer.types.includes('Files')) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }
  });
  $('#stage').addEventListener('drop', async (e) => {
    e.preventDefault();
    if (!state.project) return;
    const picked = [...e.dataTransfer.files].filter((f) => GUIDE_EXT.test(f.name));
    if (!picked.length) { toast('Drop a picture (PNG, JPG, TGA, DDS…) to use it as a guide.'); return; }
    const files = [];
    for (const f of picked) files.push({ name: f.name, bytes: new Uint8Array(await f.arrayBuffer()) });
    importGuides(files);
  });
  // a file dropped anywhere else must not replace the page
  window.addEventListener('dragover', (e) => e.preventDefault());
  window.addEventListener('drop', (e) => e.preventDefault());

  // ---------------------------------------------------------------- campaign map trees
  // The game draws the models descr_climates.txt names on forest: sparse_tree models on sparse forest,
  // dense_tree and canopy models on dense forest, chosen by the climate and the season. It scatters them
  // itself while it builds the map and keeps the spots only in memory, so here they follow the same rules
  // with a fixed random pattern: the same models on the same ground, and the same spots every time.
  const SPARSE_CHANCE = 0.5;   // share of sparse forest map points that get a tree
  let treeTimer = 0;

  // lower-case 'name.cas' and 'textures/name.tga.dds' -> path, for a tree_models folder
  async function treeFolder(dir) {
    const files = new Map();
    const top = await host.list(dir).catch(() => []);
    for (const e of top) {
      if (!e.isDir) { files.set(e.name.toLowerCase(), M2.join(dir, e.name)); continue; }
      if (e.name.toLowerCase() !== 'textures') continue;
      for (const t of await host.list(M2.join(dir, e.name)).catch(() => [])) if (!t.isDir) files.set('textures/' + t.name.toLowerCase(), M2.join(dir, e.name, t.name));
    }
    return { dir, files };
  }

  // The picture a model names, looked up the way the game does: next to the model, <name>.dds first,
  // then the name itself, in the mod and then the game. Empty placeholder files are passed over.
  async function treePicture(folders, rel, cache) {
    rel = rel.replace(/[\\/]+/g, '/').replace(/^\/+/, '').toLowerCase();
    const names = [rel + '.dds', rel];
    if(!/\.(tga|dds)$/i.test(rel))names.push(rel+'.tga.dds',rel+'.tga');
    if (!rel.includes('/')) names.push('textures/' + rel + '.dds', 'textures/' + rel);
    const cands = [];
    for (const n of names) for (const f of folders) { const hit = f.files.get(n); if (hit && !cands.includes(hit)) cands.push(hit); }
    // Shared scenery textures use a relative path outside the CAS's own folder.
    if(rel.startsWith('../'))for(const n of names)for(const f of folders){const path=M2.join(f.dir,n);if(!cands.includes(path))cands.push(path);}
    if (!cands.length) return null;
    const st = await host.statMany(cands);
    for (let i = 0; i < cands.length; i++) {
      if (!st[i] || !st[i].size) continue;
      const file = cands[i], key = norm(file);
      if (!cache.has(key)) cache.set(key, host.read(treeOriginal(file)).then((b) => Images.decodeAny(b, file)).then((img) => ({ img, file }), () => null));
      const got = await cache.get(key);
      if (got) return got;
    }
    return null;
  }

  // ---------------------------------------------------------------- map colour (ground textures)
  // Brightness, contrast, saturation and hue for the ground as a whole (one 3x3 matrix on the linear texture colour,
  // then contrast on the sRGB value around GROUND_PIVOT). The painter shows them live by working the same function
  // into the textures' full-size pixels (refreshLayerColour), and Save writes it into every ground texture the
  // climates on this map use. The untouched textures are kept once in
  // <mod>\map_painter_backups\ground_textures_original and every save starts from them, so saving again never
  // stacks up; all sliders back to the middle puts the originals back. The painter always loads the originals.
  const GROUND_PIVOT = 0.35; // contrast turns around this sRGB value, about the middle of the ground textures
  const groundBakeDir = () => M2.join(state.project.loc.modRoot, 'map_painter_backups', 'ground_textures_original');
  async function groundManifest() {
    const p = state.project;
    if (document.body.classList.contains('scenery-mode')) return (p.groundBake = {adj:{b:1,c:1,s:1,h:0},files:{}});
    if (p.groundBake) return p.groundBake;
    let m = { adj: { b: 1, c: 1, s: 1, h: 0 }, files: {} };
    try {
      const f = M2.join(groundBakeDir(), 'manifest.json');
      if (await host.exists(f)) {
        m = Object.assign(m, JSON.parse(await host.readText(f)));
        // Save writes the textures and then this file, so a texture newer than it was changed in another
        // program. (Entries marked "outside" come from an older painter that froze such textures.)
        const es = Object.values(m.files);
        const st = await host.statMany([f, ...es.map((e) => e.target)]);
        const edited = es.filter((e, i) => e.outside || (st[0] && st[i + 1] && st[i + 1].mtimeMs > st[0].mtimeMs + 2000));
        for (const e of edited) await groundAdoptEdit(m, e);
        if (edited.length) {
          await host.writeFile(f, new TextEncoder().encode(JSON.stringify(m, null, 1)));
          setTimeout(() => toast(`${edited.length} ground texture${edited.length === 1 ? ' was' : 's were'} changed in another program. The painter now works from ${edited.length === 1 ? 'that edit' : 'those edits'}, and the colour sliders still apply.`, 'ok', 6000), 1500);
        }
      }
    } catch (e) { console.warn('ground texture manifest', e); }
    p.groundBake = m;
    return m;
  }
  function groundAdj() {
    const s = S();
    return { b: Math.round((s.groundBright ?? 1) * 100) / 100, c: Math.round((s.groundContrast ?? 1) * 100) / 100, s: Math.round((s.groundSat ?? 1) * 100) / 100, h: Math.round(s.groundHue || 0) };
  }
  // one texture's own sliders (settings.groundTexAdj[name in lower case]); applied before the map-wide ones
  function texAdj(name) {
    const t = (S().groundTexAdj || {})[String(name).toLowerCase()];
    if (!t) return { b: 1, c: 1, s: 1, h: 0 };
    return { b: Math.round((t.b ?? 1) * 100) / 100, c: Math.round((t.c ?? 1) * 100) / 100, s: Math.round((t.s ?? 1) * 100) / 100, h: Math.round(t.h || 0) };
  }
  // everything Save would write: the map-wide sliders and every texture with its own, as one string
  function groundStateKey(g, tex) {
    const t = Object.entries(tex || {}).filter(([, a]) => !groundAdjIdentity(a)).map(([n, a]) => `${n.toLowerCase()}=${groundAdjKey(a)}`).sort();
    return [groundAdjKey(g), ...t].join(';');
  }
  function currentTexAdj() {
    const out = {};
    for (const n of Object.keys(S().groundTexAdj || {})) { const a = texAdj(n); if (!groundAdjIdentity(a)) out[n] = a; }
    return out;
  }
  const groundAdjKey = (a) => `${(+a.b).toFixed(2)},${(+(a.c ?? 1)).toFixed(2)},${(+a.s).toFixed(2)},${Math.round(a.h)}`;
  const groundAdjIdentity = (a) => groundAdjKey(a) === '1.00,1.00,1.00,0';
  function groundBakePending() {
    const p = state.project;
    return !!(p && p.groundBake && groundStateKey(groundAdj(), currentTexAdj()) !== groundStateKey(p.groundBake.adj || { b: 1, c: 1, s: 1, h: 0 }, p.groundBake.tex));
  }
  function groundOriginal(file) {
    const p = state.project, e = p && p.groundBake && p.groundBake.files[norm(file)];
    return e ? e.original : file;
  }
  // brightness x saturation x hue rotation, row-major, on linear RGB; hue turns around the grey axis and keeps
  // luminance (Rec. 709 weights, as CSS hue-rotate does)
  function groundMatrix(a) {
    const lr = 0.2126, lg = 0.7152, lb = 0.0722;
    const t = a.h * Math.PI / 180, c = Math.cos(t), s = Math.sin(t);
    const H = [
      lr + c * (1 - lr) - s * lr, lg - c * lg - s * lg, lb - c * lb + s * (1 - lb),
      lr - c * lr + s * 0.143, lg + c * (1 - lg) + s * 0.140, lb - c * lb - s * 0.283,
      lr - c * lr - s * (1 - lr), lg - c * lg + s * lg, lb + c * (1 - lb) + s * lb,
    ];
    const S = [];
    for (let r = 0; r < 3; r++) for (let k = 0; k < 3; k++) S.push((1 - a.s) * [lr, lg, lb][k] + (r === k ? a.s : 0));
    const M = [];
    for (let r = 0; r < 3; r++) for (let k = 0; k < 3; k++) {
      let v = 0;
      for (let j = 0; j < 3; j++) v += S[r * 3 + j] * H[j * 3 + k];
      M.push(v * a.b);
    }
    return M;
  }

  // one colour change (matrix on linear, then contrast on the 8-bit sRGB value) as a function on 0..255 values;
  // Save and the painter's preview of a texture's own change both use it, so they agree exactly
  let gLIN = null, gENC = null;
  function groundStage(a) {
    if (!gLIN) {
      gLIN = new Float32Array(256);
      for (let i = 0; i < 256; i++) { const v = i / 255; gLIN[i] = v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }
      gENC = new Uint8Array(4097);
      for (let i = 0; i <= 4096; i++) { const v = i / 4096; gENC[i] = Math.round(255 * (v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055)); }
    }
    const LIN = gLIN, ENC = gENC;
    const M = groundMatrix(a), CON = new Uint8Array(256), pv = GROUND_PIVOT * 255;
    for (let i = 0; i < 256; i++) CON[i] = Math.max(0, Math.min(255, Math.round(pv + (i - pv) * a.c)));
    const enc = (v) => CON[ENC[v <= 0 ? 0 : v >= 1 ? 4096 : Math.round(v * 4096)]];
    return (r, g, b) => {
      const R = LIN[r], G = LIN[g], B = LIN[b];
      return [enc(M[0] * R + M[1] * G + M[2] * B), enc(M[3] * R + M[4] * G + M[5] * B), enc(M[6] * R + M[7] * G + M[8] * B)];
    };
  }
  // groundStage(a) worked into RGBA pixels in place, without a call a pixel (the same numbers)
  function stageInPlace(a, d) {
    groundStage(a); // builds the shared tables
    const LIN = gLIN, ENC = gENC, M = groundMatrix(a), CON = new Uint8Array(4097), pv = GROUND_PIVOT * 255;
    for (let i = 0; i <= 4096; i++) CON[i] = Math.max(0, Math.min(255, Math.round(pv + (ENC[i] - pv) * a.c)));
    const [m0, m1, m2, m3, m4, m5, m6, m7, m8] = M;
    for (let i = 0; i < d.length; i += 4) {
      const R = LIN[d[i]], G = LIN[d[i + 1]], B = LIN[d[i + 2]];
      let x = m0 * R + m1 * G + m2 * B, y = m3 * R + m4 * G + m5 * B, z = m6 * R + m7 * G + m8 * B;
      d[i] = CON[x <= 0 ? 0 : x >= 1 ? 4096 : Math.round(x * 4096)];
      d[i + 1] = CON[y <= 0 ? 0 : y >= 1 ? 4096 : Math.round(y * 4096)];
      d[i + 2] = CON[z <= 0 ? 0 : z >= 1 ? 4096 : Math.round(z * 4096)];
    }
    return d;
  }
  // a ground texture's whole colour change as Save writes it: its own sliders, then the map-wide ones (null: none)
  // a texture changed in another program after the painter recoloured it: the edit is kept as it is, so the
  // painter shows it untouched and Save leaves it alone (its colour sliders no longer apply)
  function groundOutside(file) {
    const p = state.project, e = p && p.groundBake && file && p.groundBake.files[norm(file)];
    return !!(e && e.outside);
  }
  const layerOutside = (name) => { const l = state.layerByName && state.layerByName.get(String(name).toLowerCase()); return !!(l && groundOutside(l.file)); };
  async function groundTakeOutsideEdit(file) {
    const p = state.project, m = p && p.groundBake, e = m && m.files[norm(file)];
    if (!e) return false;
    try {
      await groundAdoptEdit(m, e);
      await host.writeFile(M2.join(groundBakeDir(), 'manifest.json'), new TextEncoder().encode(JSON.stringify(m, null, 1)));
    } catch (err) { console.warn('ground texture edit', err); return false; }
    return true;
  }
  // A texture Save recoloured was then edited in another program: the file holds the edit with the saved
  // colour change in it. Taking that change back out gives the new original, so the painter shows the
  // edit, the colour sliders keep working on it, and the next Save writes the edit with the colour on top.
  // The original it replaces is kept in map_painter_backups\ground_originals_replaced_<time>.
  async function groundAdoptEdit(m, e) {
    const p = state.project, dir = groundBakeDir();
    const name = M2.basename(e.target).toLowerCase().replace(/(\.tga)\.dds$/, '$1');
    const own = (m.tex || {})[name], all = m.adj || { b: 1, c: 1, s: 1, h: 0 };
    const inv = groundUnstage(own && !groundAdjIdentity(own) ? own : null, groundAdjIdentity(all) ? null : all);
    const bytes = await host.read(e.target);
    const out = !inv ? bytes : /\.dds$/i.test(e.target) ? Images.adjustDDS(bytes, inv) : Images.adjustTGA(bytes, inv);
    // the original always lives in the backup folder (a texture only the game has gets its copy there now)
    const prev = e.saved || e.original;
    const orig = prev && norm(prev).startsWith(norm(dir) + '\\') ? prev : M2.join(dir, e.target.slice(p.loc.modRoot.length).replace(/^[\\/]+/, ''));
    await host.saveWithBackup({ files: [{ path: orig, data: out }], backupRoot: M2.join(p.loc.modRoot, 'map_painter_backups', `ground_originals_replaced_${timestamp()}`), relBase: dir });
    e.original = orig; delete e.outside; delete e.saved;
  }
  // the inverse of groundStage(own) then groundStage(all), as one function on 0..255 values (null: nothing to undo)
  function groundUnstage(own, all) {
    const one = (a) => {
      const M = groundMatrix(a);
      const det = M[0] * (M[4] * M[8] - M[5] * M[7]) - M[1] * (M[3] * M[8] - M[5] * M[6]) + M[2] * (M[3] * M[7] - M[4] * M[6]);
      if (Math.abs(det) < 1e-6) return null; // saturation 0 can't be taken back
      const I = [
        (M[4] * M[8] - M[5] * M[7]) / det, (M[2] * M[7] - M[1] * M[8]) / det, (M[1] * M[5] - M[2] * M[4]) / det,
        (M[5] * M[6] - M[3] * M[8]) / det, (M[0] * M[8] - M[2] * M[6]) / det, (M[2] * M[3] - M[0] * M[5]) / det,
        (M[3] * M[7] - M[4] * M[6]) / det, (M[1] * M[6] - M[0] * M[7]) / det, (M[0] * M[4] - M[1] * M[3]) / det,
      ];
      const pv = GROUND_PIVOT * 255, c = a.c || 1;
      const lin = (v) => { v = Math.min(1, Math.max(0, v / 255)); return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
      const enc = (v) => { v = Math.min(1, Math.max(0, v)); return Math.round(255 * (v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055)); };
      return (r, g, b) => {
        const R = lin(pv + (r - pv) / c), G = lin(pv + (g - pv) / c), B = lin(pv + (b - pv) / c);
        return [enc(I[0] * R + I[1] * G + I[2] * B), enc(I[3] * R + I[4] * G + I[5] * B), enc(I[6] * R + I[7] * G + I[8] * B)];
      };
    };
    const ga = all && one(all), oa = own && one(own);
    if (ga && oa) return (r, g, b) => { const t = ga(r, g, b); return oa(t[0], t[1], t[2]); };
    return ga || oa || null;
  }
  const layerStageKey = (name) => (layerOutside(name) ? 'outside' : `${groundAdjKey(texAdj(name))}|${groundAdjKey(groundAdj())}`);
  function layerStage(name) {
    if (layerOutside(name)) return null;
    const own = texAdj(name), all = groundAdj();
    const a = groundAdjIdentity(own) ? null : groundStage(own), b = groundAdjIdentity(all) ? null : groundStage(all);
    return a && b ? (r, g, bl) => { const c = a(r, g, bl); return b(c[0], c[1], c[2]); } : a || b;
  }
  // shows the colour change in the painter exactly as Save writes it: worked into the full-size original
  // pixels with the same function, then sized for the painter (so the preview is the saved picture)
  async function refreshLayerColour(layer) {
    if (!layer || layer.missing || !view) return;
    const key = layerStageKey(layer.name);
    if (layer.shownKey === key) return;
    const fn = layerStage(layer.name);
    if (!layer.srcImg) layer.srcImg = await Images.decodeAny(await host.read(groundOriginal(layer.file)), layer.file);
    if (!layer.basePx) layer.basePx = await Images.resizeRGBA(layer.srcImg, LAYER, LAYER);
    if (!fn) {
      if (layer.adjusted) view.setLayer(layer.index, layer.basePx);
      layer.adjusted = false;
    } else {
      const img = layer.srcImg, d = new Uint8Array(img.data), own = texAdj(layer.name), all = groundAdj();
      if (!groundAdjIdentity(own)) stageInPlace(own, d);
      if (!groundAdjIdentity(all)) stageInPlace(all, d);
      view.setLayer(layer.index, await Images.resizeRGBA({ ...img, data: d }, LAYER, LAYER));
      layer.adjusted = true;
    }
    layer.shownKey = key;
    view.dirty = true;
  }
  // the map-wide sliders: every ground texture again (newest settings win; a run in progress starts over)
  let allLayersRun = 0;
  async function refreshAllLayers() {
    const run = ++allLayersRun;
    for (const l of state.layers || []) {
      if (run !== allLayersRun) return;
      if (!l || l.missing) continue;
      try { await refreshLayerColour(l); } catch (e) { console.warn('texture colour', e); }
    }
  }
  let layerColourBusy = false, layerColourAgain = null;
  async function layerColourChanged(name) {
    const layer = state.layerByName && state.layerByName.get(String(name).toLowerCase());
    if (!layer) return;
    if (layerColourBusy) { layerColourAgain = layer; return; }
    layerColourBusy = true;
    try { await refreshLayerColour(layer); } catch (e) { console.warn('texture colour', e); }
    layerColourBusy = false;
    if (layerColourAgain) { const l = layerColourAgain; layerColourAgain = null; layerColourChanged(l.name); }
  }

  // every ground texture the climates on this map use, summer and winter, as the game finds them (the
  // mod's, else the game's own), with a .tga.dds beside a .tga (or the other way round) included
  async function groundTextureFiles() {
    const p = state.project, names = new Set();
    p.climates.forEach((c, ci) => {
      if (!p.clCounts[ci]) return;
      for (const e of Object.values(aerialFor(c))) { if (e.summer) names.add(e.summer); if (e.winter) names.add(e.winter); }
    });
    const found = new Map();
    for (const name of names) {
      const source = await M2.resolveTexture(p.loc, name);
      if (!source) continue;
      const base = source.replace(/\.dds$/i, '');
      const sibs = [...new Set([source, base, base + '.dds'])];
      const st = await host.statMany(sibs);
      sibs.forEach((src, k) => {
        if (!st[k] || !(st[k].size > 18)) return;
        let target = src;
        if (p.loc.gameDataDir && norm(src).startsWith(norm(p.loc.gameDataDir) + '\\') && norm(p.loc.dataDir) !== norm(p.loc.gameDataDir)) {
          target = M2.join(p.loc.dataDir, src.slice(p.loc.gameDataDir.length).replace(/^[\\/]+/, ''));
        }
        if (!found.has(norm(target))) found.set(norm(target), { target, source: src, name });
      });
    }
    return [...found.values()];
  }

  // writes the map colour into the ground textures; returns how many files were written
  async function bakeGround() {
    const p = state.project, m = await groundManifest(), adj = groundAdj(), tex = currentTexAdj();
    const global = groundAdjIdentity(adj) ? null : groundStage(adj);
    const stages = new Map();
    const fnFor = (name) => {
      const key = String(name || '').toLowerCase();
      if (!stages.has(key)) {
        const own = tex[key] ? groundStage(tex[key]) : null;
        stages.set(key, own && global ? (r, g, b) => { const c = own(r, g, b); return global(c[0], c[1], c[2]); } : own || global);
      }
      return stages.get(key);
    };
    const dir = groundBakeDir();
    const list = await groundTextureFiles();
    // files changed by an earlier save that this map no longer uses still go back to their originals
    for (const e of Object.values(m.files)) if (!list.some((x) => norm(x.target) === norm(e.target))) list.push({ target: e.target, source: e.target, stale: true });
    let n = 0;
    const failed = [];
    for (const { target, source, stale, name } of list) {
      const fn = stale ? null : fnFor(name);
      const key = norm(target);
      try {
        let e = m.files[key];
        if (e && e.outside) continue;
        if (!e) {
          // first time: keep the original. The mod's own file is copied into the backup folder; a texture only
          // the game has stays where it is (the game's own files are never changed)
          let original = source;
          if (norm(source) === key) {
            original = M2.join(dir, target.slice(p.loc.modRoot.length).replace(/^[\\/]+/, ''));
            if (!(await host.exists(original))) await host.writeFile(original, await host.read(target));
          }
          e = m.files[key] = { target, original };
        }
        const orig = await host.read(e.original);
        const out = !fn ? orig : /\.dds$/i.test(target) ? Images.adjustDDS(orig, fn) : Images.adjustTGA(orig, fn);
        state.ownWrites.set(key, Date.now());
        await host.writeFile(target, out);
        n++;
      } catch (err) { console.warn('ground texture', target, err); failed.push(M2.basename(target)); }
    }
    m.adj = adj;
    m.tex = tex;
    await host.writeFile(M2.join(dir, 'manifest.json'), new TextEncoder().encode(JSON.stringify(m, null, 1)));
    if (failed.length) saveNotes.push(`These ground textures could not be changed: ${failed.join(', ')}.`);
    return n;
  }

  // ---- tile model pictures in the Map colour panel (river, cliff, mountain, volcano textures)
  // Each picture can have its own brightness, contrast, saturation and hue (settings.tileTexAdj[name]); the map-wide
  // sliders don't touch them. The painter shows the change at once on the tile models; Save writes it into the
  // picture (in its own format), the mod's copy when the picture came from the game. The untouched pictures are
  // kept once in <mod>\map_painter_backups\tile_textures_original and every save starts from them.
  const tileBakeDir = () => M2.join(state.project.loc.modRoot, 'map_painter_backups', 'tile_textures_original');
  const tileOrigPath = (target) => M2.join(tileBakeDir(), target.slice(state.project.loc.modRoot.length).replace(/^[\\/]+/, ''));
  function tileTarget(f) {
    const loc = state.project.loc;
    if (loc.gameDataDir && norm(f).startsWith(norm(loc.gameDataDir) + '\\') && norm(loc.dataDir) !== norm(loc.gameDataDir)) {
      return M2.join(loc.dataDir, f.slice(loc.gameDataDir.length).replace(/^[\\/]+/, ''));
    }
    return f;
  }
  async function tileManifest() {
    const p = state.project;
    if (document.body.classList.contains('scenery-mode')) return (p.tileBake = {tex:{},files:{}});
    if (p.tileBake) return p.tileBake;
    let m = { tex: {}, files: {} };
    try {
      const f = M2.join(tileBakeDir(), 'manifest.json');
      if (await host.exists(f)) {
        m = Object.assign(m, JSON.parse(await host.readText(f)));
        // Save writes the pictures and then this file, so a picture newer than it was changed in another program
        const es = Object.values(m.files);
        const st = await host.statMany([f, ...es.map((e) => e.target)]);
        const edited = es.filter((e, i) => st[0] && st[i + 1] && st[i + 1].mtimeMs > st[0].mtimeMs + 2000);
        for (const e of edited) await tileAdoptEdit(m, e);
        if (edited.length) {
          await host.writeFile(f, new TextEncoder().encode(JSON.stringify(m, null, 1)));
          setTimeout(() => toast(`${edited.map((e) => M2.basename(e.target)).join(', ')} changed in another program. The painter now works from the edit, and its colour sliders still apply.`, 'ok', 6000), 1500);
        }
      }
    } catch (e) { console.warn('tile texture manifest', e); }
    p.tileBake = m;
    return m;
  }
  // a recoloured picture edited in another program: the saved colour is taken back out and the result kept as
  // the new original (the one it replaces goes to map_painter_backups\tile_originals_replaced_<time>)
  async function tileAdoptEdit(m, e) {
    const own = (m.tex || {})[e.key];
    const inv = own && !groundAdjIdentity(own) ? groundUnstage(own, null) : null;
    const bytes = await host.read(e.target);
    const out = !inv ? bytes : /\.dds$/i.test(e.target) ? Images.adjustDDS(bytes, inv) : Images.adjustTGA(bytes, inv);
    const orig = tileOrigPath(e.target);
    await host.saveWithBackup({ files: [{ path: orig, data: out }], backupRoot: M2.join(state.project.loc.modRoot, 'map_painter_backups', `tile_originals_replaced_${timestamp()}`), relBase: tileBakeDir() });
    e.original = orig;
  }
  function tileOriginal(f) {
    const p = state.project, e = p && p.tileBake && p.tileBake.files[norm(f)];
    return e ? e.original : f;
  }
  function tileAdjOf(k) {
    const t = (S().tileTexAdj || {})[String(k).toLowerCase()];
    if (!t) return { b: 1, c: 1, s: 1, h: 0 };
    return { b: Math.round((t.b ?? 1) * 100) / 100, c: Math.round((t.c ?? 1) * 100) / 100, s: Math.round((t.s ?? 1) * 100) / 100, h: Math.round(t.h || 0) };
  }
  function currentTileAdj() {
    const out = {};
    for (const n of Object.keys(S().tileTexAdj || {})) { const a = tileAdjOf(n); if (!groundAdjIdentity(a)) out[n] = a; }
    return out;
  }
  const IDENT = { b: 1, c: 1, s: 1, h: 0 };
  function tileBakePending() {
    const p = state.project;
    return !!(p && p.tileBake && groundStateKey(IDENT, currentTileAdj()) !== groundStateKey(IDENT, p.tileBake.tex));
  }
  // the picture as the painter shows it: the untouched one with its colour change worked in (Save's maths)
  function tileAdjImage(k, raw) {
    const a = tileAdjOf(k);
    if (!raw || groundAdjIdentity(a)) return raw;
    const d = new Uint8Array(raw.data);
    stageInPlace(a, d);
    return { ...raw, data: d };
  }
  // the sliders moved: the picture is worked again and handed to the tile models already on screen
  let tileTintBusy = false;
  const tileTintAgain = new Set();
  async function tileColourChanged(k) {
    const TC = state.project && state.project.tileCache;
    if (!TC || !TC.raw || !TC.raw.has(k) || !view) return;
    if (tileTintBusy) { tileTintAgain.add(k); return; }
    tileTintBusy = true;
    try {
      const raw = await TC.raw.get(k), oldImg = await TC.pics.get(k), img = tileAdjImage(k, raw);
      if (img && img !== oldImg) {
        TC.pics.set(k, Promise.resolve(img));
        for (const pt of TC.parts.values()) if (pt && pt.image === oldImg) pt.image = img;
        view.retintTileImage(oldImg, img);
      }
    } catch (e) { console.warn('tile picture colour', e); }
    tileTintBusy = false;
    if (tileTintAgain.size) { const ks = [...tileTintAgain]; tileTintAgain.clear(); for (const x of ks) await tileColourChanged(x); }
  }
  const tileRefreshAll = async () => { const TC = state.project && state.project.tileCache; if (TC && TC.raw) for (const k of TC.raw.keys()) await tileColourChanged(k); };
  // the tile pictures that can be recoloured (alpha pages are blend masks, not colours)
  const tileColourList = () => ((state.project && state.project.tiles && state.project.tiles.textures) || []).filter((t) => !t.page);
  // writes the tile picture colours; returns how many files were written
  async function bakeTiles() {
    const p = state.project, m = await tileManifest(), tex = currentTileAdj();
    const list = new Map();
    for (const t of tileColourList()) {
      const target = tileTarget(t.file);
      if (tex[t.key] || m.files[norm(target)]) list.set(norm(target), { target, source: t.file, key: t.key });
    }
    // pictures an earlier save changed go back to their originals when they have no colour change now
    for (const e of Object.values(m.files)) if (!list.has(norm(e.target))) list.set(norm(e.target), { target: e.target, source: e.target, key: e.key });
    let n = 0;
    const failed = [];
    for (const { target, source, key } of list.values()) {
      const k = norm(target);
      try {
        let e = m.files[k];
        if (!e) {
          // first time: the mod's own picture is copied into the backup folder; a picture only the game has
          // stays where it is (the game's files are never changed) and is the original
          let original = source;
          if (norm(source) === k) {
            original = tileOrigPath(target);
            if (!(await host.exists(original))) await host.writeFile(original, await host.read(target));
          }
          e = m.files[k] = { target, original, key };
        }
        const a = tex[e.key], fn = a ? groundStage(a) : null;
        const orig = await host.read(e.original);
        const out = !fn ? orig : /\.dds$/i.test(target) ? Images.adjustDDS(orig, fn) : Images.adjustTGA(orig, fn);
        state.ownWrites.set(k, Date.now());
        await host.writeFile(target, out);
        state.ownWrites.set(k, Date.now());
        n++;
      } catch (err) { console.warn('tile picture', target, err); failed.push(M2.basename(target)); }
    }
    m.tex = tex;
    await host.writeFile(M2.join(tileBakeDir(), 'manifest.json'), new TextEncoder().encode(JSON.stringify(m, null, 1)));
    if (failed.length) saveNotes.push(`These tile model pictures could not be changed: ${failed.join(', ')}.`);
    return n;
  }

  // The Brightness sliders of the colour panels: the left half runs from 0 (black) to 1x, the right half
  // from 1x to 32x, where everything but the darkest pixels has gone white. The slider moves in even steps
  // of light on the right (each 1/10 of the half doubles it).
  const BRIGHT_MAX = 32;
  const brightPos = (b) => (b <= 1 ? Math.max(0, b) / 2 : 0.5 + Math.log2(Math.min(b, BRIGHT_MAX)) / (2 * Math.log2(BRIGHT_MAX)));
  const brightVal = (p) => Math.round((p <= 0.5 ? p * 2 : Math.pow(2, (p - 0.5) * 2 * Math.log2(BRIGHT_MAX))) * 100) / 100;

  // ---- colour presets: brightness, contrast, saturation and hue under a name, shared by the Map colour (the
  // whole map, one texture or one tile picture), Tree colour and Sea colour panels; kept in the painter's
  // settings, so they work in every mod
  function colourPresetBar(get, apply) {
    const nameI = el('input', { type: 'text', placeholder: 'Preset name', maxlength: 40, title: 'A name for the colour the sliders have now' });
    const save = () => {
      const name = nameI.value.trim();
      if (!name) { toast('Type a name for the preset first.'); return; }
      const a = get();
      const list = (S().colourPresets || []).filter((x) => x.name.toLowerCase() !== name.toLowerCase());
      list.push({ name, b: +a.b, c: +a.c, s: +a.s, h: +a.h });
      list.sort((x, y) => x.name.localeCompare(y.name));
      S().colourPresets = list; saveSettings();
      toast(`Saved the colour preset "${name}"`, 'ok', 2000);
      rerenderColourPanels();
    };
    nameI.addEventListener('keydown', (e) => { if (e.key === 'Enter') save(); });
    const chips = el('div', { class: 'light-presets' });
    const presets = S().colourPresets || [];
    if (!presets.length) chips.append(el('span', { class: 'cp-help', text: 'No presets yet. Name the colour you have and save it.' }));
    for (const pr of presets) {
      const chip = el('span', { class: 'light-chip' });
      const desc = `brightness ${pr.b.toFixed(2)}, contrast ${pr.c.toFixed(2)}, saturation ${pr.s.toFixed(2)}, hue ${pr.h > 0 ? '+' : ''}${Math.round(pr.h)}°`;
      const use = el('button', { text: pr.name, title: `Use "${pr.name}" (${desc}). Ctrl+Z goes back.`, onclick: () => apply({ b: pr.b, c: pr.c, s: pr.s, h: pr.h }) });
      const del = el('button', { class: 'light-chip-x', text: '×', title: `Delete the "${pr.name}" preset` });
      del.addEventListener('click', () => {
        chip.textContent = '';
        chip.classList.add('ask');
        chip.append(el('span', { text: `Delete "${pr.name}"?` }),
          el('button', { text: 'Delete', onclick: () => { S().colourPresets = (S().colourPresets || []).filter((x) => x.name !== pr.name); saveSettings(); rerenderColourPanels(); } }),
          el('button', { text: 'Keep', onclick: () => rerenderColourPanels() }));
      });
      chip.append(use, del);
      chips.append(chip);
    }
    return el('div', { class: 'colour-presets' },
      el('div', { class: 'light-pre-head' }, el('b', { text: 'Presets' }), nameI,
        el('button', { text: 'Save preset', title: 'Keep these four values under this name (a preset with the same name is replaced). The same presets show in the Map, Tree and Sea colour panels.', onclick: save })),
      chips);
  }
  function rerenderColourPanels() {
    const cp = $('#colourPanel');
    if (cp && !cp.hidden) renderColourPanel();
    for (const kind of Object.keys(ADJ_PANELS)) { const b = $(ADJ_PANELS[kind].box); if (b && !b.hidden) renderAdjPanel(kind); }
  }

  // the floating Tree colour and Sea colour panels: brightness, contrast, saturation and hue, shown live and
  // written into the game's files with Save (tree pictures; water_surface.tga)
  const ADJ_PANELS = {
    tree: { box: '#treeColourPanel', btn: '#btnTreeColour', title: 'Tree colour', help: 'Trees only. Double-click a slider to reset it.', b0: 0.25, b1: 3,
      keys: { b: 'treeBright', c: 'treeContrast', s: 'treeSat', h: 'treeHue' } },
    sea: { box: '#seaColourPanel', btn: '#btnSeaColour', title: 'Sea colour', help: 'The sea (water_surface.tga). Double-click a slider to reset it.', b0: 0.25, b1: 2.5,
      keys: { b: 'seaBright', c: 'seaContrast', s: 'seaSat', h: 'seaHue' } },
  };
  function renderAdjPanel(kind) {
    const P = ADJ_PANELS[kind], box = $(P.box);
    if (!box) return;
    const s = S(), keys = P.keys;
    box.textContent = '';
    const get = (k, def) => (kind === 'tree' && k === 'b' ? (s.treeBright ?? s.treeBrightness) : s[keys[k]]) ?? def;
    box.append(el('div', { class: 'cp-head' },
      el('b', { text: P.title }),
      el('span', { class: 'cp-help', text: P.help }),
      el('button', { class: 'ramp-x', title: 'Close', text: '×', onclick: () => setAdjPanel(kind, false) })));
    const grid = el('div', { class: 'cp-grid' });
    const row = (label, k, min, max, step, def, fmt) => {
      const br = k === 'b', toS = br ? brightPos : (v) => v, fromS = br ? brightVal : (v) => v;
      if (br) { min = 0; max = 1; step = 0.0005; }
      const val = el('span', { class: 'cp-val', text: fmt(get(k, def)) });
      const inp = el('input', { type: 'range', min, max, step, value: toS(get(k, def)), title: br ? 'Left end: black. Middle: unchanged. Right end: white.' : '' });
      const put = (v) => { s[keys[k]] = v; if (kind === 'tree' && k === 'b') s.treeBrightness = v; val.textContent = fmt(v); adjChanged(kind); };
      inp.addEventListener('input', () => put(fromS(+inp.value)));
      inp.addEventListener('change', colourCommit);
      inp.addEventListener('dblclick', () => { inp.value = toS(def); put(def); colourCommit(); });
      grid.append(el('label', { text: label }), inp, val);
    };
    row('Brightness', 'b', P.b0, P.b1, 0.01, 1, (v) => `${(+v).toFixed(2)}×`);
    row('Contrast', 'c', 0.5, 2, 0.01, 1, (v) => `${(+v).toFixed(2)}×`);
    row('Saturation', 's', 0, 2, 0.01, 1, (v) => `${(+v).toFixed(2)}×`);
    row('Hue', 'h', -180, 180, 1, 0, (v) => `${v > 0 ? '+' : ''}${Math.round(v)}°`);
    box.append(grid);
    box.append(colourPresetBar(() => ({ b: get('b', 1), c: get('c', 1), s: get('s', 1), h: get('h', 0) }), (a) => {
      s[keys.b] = a.b; s[keys.c] = a.c; s[keys.s] = a.s; s[keys.h] = a.h;
      if (kind === 'tree') s.treeBrightness = a.b;
      renderAdjPanel(kind); adjChanged(kind); colourCommit();
    }));
    box.append(el('div', { class: 'cp-foot' },
      el('span', { class: 'adj-state' }),
      el('button', { text: 'Reset', onclick: () => {
        s[keys.b] = 1; s[keys.c] = 1; s[keys.s] = 1; s[keys.h] = 0;
        if (kind === 'tree') s.treeBrightness = 1;
        renderAdjPanel(kind); adjChanged(kind); colourCommit();
      } })));
    adjState(kind);
  }
  function adjState(kind) {
    const t = $(`${ADJ_PANELS[kind].box} .adj-state`);
    if (!t || !state.project) return;
    const p = state.project;
    if (kind === 'tree') {
      t.textContent = S().bakeTrees === false ? 'Saving into the game is off (Settings).'
        : treeBakePending() ? 'Not saved yet. Save writes this into the game\'s tree pictures.'
          : p.treeBake && !groundAdjIdentity(savedTreeAdj(p.treeBake)) ? 'Saved into the tree pictures.' : 'The trees have their own colour.';
    } else {
      t.textContent = !p.sea || !p.sea.file ? 'This map has no water_surface.tga, so there is nothing to save into.'
        : seaBakePending() ? `Not saved yet. Save writes this into ${M2.basename(M2.dirname(seaTarget()))}\\water_surface.tga.`
          : p.sea.bake && !groundAdjIdentity(p.sea.bake.adj || { b: 1, c: 1, s: 1, h: 0 }) ? 'Saved into water_surface.tga.' : 'The sea has its own colour.';
    }
  }
  const adjTimers = {};
  function adjChanged(kind) {
    if (kind === 'sea') seaShow(); else applyViewSettings();
    clearTimeout(adjTimers[kind]);
    adjTimers[kind] = setTimeout(saveSettings, 300);
    adjState(kind);
    updateButtons();
  }
  function setAdjPanel(kind, on) {
    const box = $(ADJ_PANELS[kind].box);
    if (!box) return;
    box.hidden = !on;
    $(ADJ_PANELS[kind].btn).classList.toggle('active', on);
    if (on) {
      setColourPanel(false);
      for (const k of Object.keys(ADJ_PANELS)) if (k !== kind) { $(ADJ_PANELS[k].box).hidden = true; $(ADJ_PANELS[k].btn).classList.remove('active'); }
      renderAdjPanel(kind);
    }
  }
  const setTreeColourPanel = (on) => setAdjPanel('tree', on);

  // ---------------------------------------------------------------- campaign lighting
  // The Lighting panel edits descr_strategy_lighting_ex.txt (or descr_strategy_lighting.txt when a mod only
  // has that), the file the game reads its campaign map light from. Each slider changes the number in the file
  // and keeps everything else in it (comments, layout); the painter follows it as you drag and the file is
  // written when you let go, the first time with a backup in map_painter_backups\lighting_<time>. A file only
  // the game has gets its copy in the mod, so other mods keep their own light. Ctrl+Z undoes each change.
  const LIGHT_ROWS = [
    { label: 'Sun', key: 'diffuse_colour', rgb: true, max: 2, help: 'The sunlight on the land' },
    { label: 'Shade', key: 'ambient_colour', rgb: true, max: 1, help: 'The sky light in the shadows' },
    { label: 'Pieces, sun', key: 'piece_diffuse_colour', rgb: true, max: 2, help: 'Sunlight on trees, settlements and other models' },
    { label: 'Pieces, shade', key: 'piece_ambient_colour', rgb: true, max: 2, help: 'Shade on trees, settlements and other models' },
    { label: 'Sea glint', key: 'sea_specular_colour', rgb: true, max: 0.5, help: 'The sun\'s shine on the sea' },
    { label: 'Glint size', key: 'sea_specular_sharpness', min: 1, max: 200, step: 1, help: 'Higher is a smaller, sharper shine on the sea' },
    { label: 'Shine size', key: 'specular_sharpness', min: 1, max: 200, step: 1, help: 'Higher is a smaller, sharper shine on models' },
    { label: 'Shadows', key: 'shadow_strength', min: 0, max: 1, step: 0.01, help: 'How dark the shadows of hills and mountains are' },
    { label: 'Ambient occlusion', key: 'ao_strength', min: 0, max: 1, step: 0.01, help: 'How dark valleys and creases are' },
    { label: 'Exposure', key: 'exposure', min: 0.25, max: 3, step: 0.01, help: 'Overall brightness' },
  ];
  let lightBase = null, lightTimer = 0, lightBackedUp = null, lightUtf8 = true, lightOrig = null;
  // the file is read and written back in its own encoding (UTF-8, else one byte a character), so letters in
  // its comments come back exactly as they were
  function lightDecode(bytes) {
    try { return { txt: new TextDecoder('utf-8', { fatal: true }).decode(bytes), utf8: true }; } catch (e) { return { txt: new TextDecoder('iso-8859-1').decode(bytes), utf8: false }; }
  }
  async function lightRead(f) {
    const d = lightDecode(await host.read(f));
    lightUtf8 = d.utf8;
    return d.txt;
  }
  // where the mod's own copy of the lighting file is (the file itself when it is already in the mod)
  function lightTarget() {
    const p = state.project, loc = p.loc, src = p.files.fLight;
    if (loc.gameDataDir && norm(src).startsWith(norm(loc.gameDataDir) + '\\') && norm(loc.dataDir) !== norm(loc.gameDataDir)) {
      return M2.join(loc.dataDir, src.slice(loc.gameDataDir.length).replace(/^[\\/]+/, ''));
    }
    return src;
  }
  // The lighting file as it was before the painter first changed it, kept once in
  // map_painter_backups\lighting_original (Reset puts it back). Found in this order: that copy, the oldest
  // map_painter_backups\lighting_<time> backup, the game's file when the mod has no copy yet, the file as it
  // is now.
  async function lightOriginal() {
    if (lightOrig) return lightOrig;
    const p = state.project, loc = p.loc, target = lightTarget();
    const rel = norm(target).startsWith(norm(loc.modRoot) + '\\') ? target.slice(loc.modRoot.length).replace(/^[\\/]+/, '') : M2.basename(target);
    const bk = M2.join(loc.modRoot, 'map_painter_backups');
    const keep = M2.join(bk, 'lighting_original', rel);
    let bytes = null, fromKeep = false;
    try { if (await host.exists(keep)) { bytes = await host.read(keep); fromKeep = true; } } catch (e) { console.warn('lighting original', e); }
    if (!bytes) {
      const dirs = (await host.list(bk).catch(() => [])).filter((e) => e.isDir && /^lighting_\d/i.test(e.name)).map((e) => e.name).sort();
      for (const d of dirs) {
        const f = M2.join(bk, d, rel);
        if (await host.exists(f).catch(() => false)) { bytes = await host.read(f); break; }
      }
    }
    if (!bytes && await host.exists(target).catch(() => false)) bytes = await host.read(target);
    if (!bytes && p.files.fLight) bytes = await host.read(p.files.fLight);
    if (!bytes) return null;
    if (!fromKeep) {
      try { await host.writeFile(keep, bytes); } catch (e) { console.warn('could not keep the original lighting file', e); }
    }
    lightOrig = lightDecode(bytes).txt;
    return lightOrig;
  }
  // jump to a whole new text (Reset, a preset) as one Ctrl+Z step
  function lightJump(txt) {
    const p = state.project;
    if (txt == null || txt === p.lightText) return false;
    if (lightBase === null) lightBase = p.lightText;
    lightApply(txt, false);
    lightCommit();
    lightApply(txt, true);
    renderLightPanel();
    return true;
  }
  // ---- lighting presets: the numbers of every lighting setting, kept in the painter's settings (so they work
  // in every mod); applying one changes only the settings the open file has, its layout and comments stay
  const LIGHT_PRESET_KEYS = () => [...LIGHT_ROWS.map((r) => r.key), 'diffuse_direction'];
  function lightPresetSave(name) {
    const p = state.project;
    name = String(name || '').trim();
    if (!name || p.lightText == null) return;
    const vals = {};
    for (const k of LIGHT_PRESET_KEYS()) { const v = lightGet(p.lightText, k); if (v) vals[k] = v; }
    const list = (S().lightPresets || []).filter((x) => x.name.toLowerCase() !== name.toLowerCase());
    list.push({ name, linear: lightLinear(), vals });
    list.sort((a, b) => a.name.localeCompare(b.name));
    S().lightPresets = list; saveSettings();
    toast(`Saved the lighting preset "${name}"`, 'ok', 2000);
    renderLightPanel();
  }
  function lightPresetApply(name) {
    const p = state.project, pr = (S().lightPresets || []).find((x) => x.name === name);
    if (!pr || p.lightText == null) return;
    const lin = lightLinear(), rgb = new Set(LIGHT_ROWS.filter((r) => r.rgb).map((r) => r.key));
    let txt = p.lightText, n = 0;
    for (const [k, v] of Object.entries(pr.vals)) {
      const now = lightGet(txt, k);
      if (!now || now.length !== v.length) continue;
      // a preset from the other kind of file (linear _ex, or the old gamma file): colours converted
      const vv = rgb.has(k) && !!pr.linear !== lin ? v.map((x) => (lin ? Math.pow(Math.max(0, x), 2.2) : Math.pow(Math.max(0, x), 1 / 2.2))) : v;
      txt = lightSet(txt, k, vv); n++;
    }
    if (!lightJump(txt)) toast(n ? `"${name}" is the lighting you have now` : `"${name}" has none of this file's settings`, 'ok', 2500);
    else toast(`Lighting set to "${name}" (Ctrl+Z goes back)`, 'ok', 2500);
  }
  function lightPresetDelete(name) {
    S().lightPresets = (S().lightPresets || []).filter((x) => x.name !== name); saveSettings();
    renderLightPanel();
  }
  const lightBytes = (txt) => (lightUtf8 ? new TextEncoder().encode(txt) : Uint8Array.from(txt, (c) => Math.min(255, c.charCodeAt(0))));
  const lightRe = (key) => new RegExp('^([ \\t]*' + key + ')([ \\t]+)(-?[\\d.]+)(?:([ \\t]+)(-?[\\d.]+)([ \\t]+)(-?[\\d.]+))?', 'm');
  function lightGet(txt, key) {
    const m = txt.match(lightRe(key));
    if (!m) return null;
    return m[5] !== undefined ? [+m[3], +m[5], +m[7]] : [+m[3]];
  }
  const lightFmt = (v) => String(Math.round(v * 10000) / 10000);
  function lightSet(txt, key, vals) {
    const re = lightRe(key);
    if (!re.test(txt)) return txt.replace(/\s*$/, '') + `\r\n${key}\t\t\t${vals.map(lightFmt).join('\t\t')}\r\n`;
    return txt.replace(re, (m0, k, sp, a, s1, b, s2, c) => (b !== undefined && vals.length === 3)
      ? `${k}${sp}${lightFmt(vals[0])}${s1}${lightFmt(vals[1])}${s2}${lightFmt(vals[2])}`
      : `${k}${sp}${lightFmt(vals[0])}${b !== undefined ? `${s1}${b}${s2}${c}` : ''}`);
  }
  const lightLinear = () => /_ex\.txt$/i.test(state.project.files.fLight || '');
  async function lightEnsureText() {
    const p = state.project;
    if (p.lightText == null && p.files.fLight) p.lightText = await lightRead(p.files.fLight);
    if (lightBase === null) lightBase = p.lightText;
    return p.lightText;
  }
  // the text changed (a slider, undo): the painter follows at once, the file a moment after you let go
  function lightApply(txt, write) {
    const p = state.project;
    p.lightText = txt;
    p.lighting = M2.parseLighting(txt, lightLinear());
    applyViewSettings();
    if (write) { clearTimeout(lightTimer); lightTimer = setTimeout(() => lightWrite().catch((e) => toast('Could not write the lighting file: ' + e.message, 'err', 8000)), 250); }
  }
  async function lightWrite() {
    const p = state.project, loc = p.loc, src = p.files.fLight;
    if (!src || p.lightText == null) return;
    const target = lightTarget();
    await lightOriginal(); // the untouched file is kept before the first write
    const data = lightBytes(p.lightText);
    state.ownWrites.set(norm(target), Date.now());
    if (lightBackedUp !== norm(target)) {
      await host.saveWithBackup({ files: [{ path: target, data }], backupRoot: M2.join(loc.modRoot, 'map_painter_backups', `lighting_${timestamp()}`), relBase: loc.modRoot });
      lightBackedUp = norm(target);
    } else await host.writeFile(target, data);
    state.ownWrites.set(norm(target), Date.now());
    if (norm(target) !== norm(src)) {
      p.files.fLight = target;
      setupWatch();
      toast('The lighting file is now the mod\'s own copy, so other mods keep theirs.', 'ok', 5000);
    }
    lightStateText();
  }
  function lightCommit() {
    const p = state.project;
    if (!p || p.lightText == null) return;
    if (lightBase !== null && p.lightText !== lightBase) {
      state.undo.push({ lt: { before: lightBase, after: p.lightText } });
      state.redo = [];
      updateButtons();
    }
    lightBase = p.lightText;
  }
  function lightRestore(txt) {
    lightBase = txt;
    lightApply(txt, true);
    if (!$('#lightPanel').hidden) renderLightPanel();
  }
  function lightStateText() {
    const t = $('#lightPanel .adj-state');
    if (!t || !state.project) return;
    const f = state.project.files.fLight;
    t.textContent = f ? `Writes ${M2.basename(f)} in ${norm(f).startsWith(norm(state.project.loc.dataDir)) ? 'the mod' : 'the game'}'s data folder as you let go. The game reads it when it loads the campaign.` : 'No lighting file was found.';
  }
  // linear light <-> the colour picker (sRGB); the gamma-space file is shown as it is
  const toSrgb = (v) => Math.round(255 * Math.min(1, v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055));
  const fromSrgb = (c) => { const v = c / 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  async function renderLightPanel() {
    const box = $('#lightPanel');
    if (!box || !state.project) return;
    const txt = await lightEnsureText();
    box.textContent = '';
    box.append(el('div', { class: 'cp-head' },
      el('b', { text: 'Lighting' }),
      el('span', { class: 'cp-help', text: 'The campaign map light. Ctrl+Z undoes each change. Double-click a slider to put back the value the panel opened with.' }),
      el('button', { class: 'ramp-x', title: 'Close', text: '×', onclick: () => setLightPanel(false) })));
    if (txt == null) { box.append(el('div', { class: 'cp-note', text: 'This mod and the game have no descr_strategy_lighting file.' })); return; }
    // presets: click one to use it, × to delete it; save the current lighting under a name
    const pre = el('div', { class: 'light-presets' });
    const presets = S().lightPresets || [];
    if (!presets.length) pre.append(el('span', { class: 'cp-help', text: 'No presets yet. Name the lighting you have and save it.' }));
    for (const pr of presets) {
      const chip = el('span', { class: 'light-chip' });
      const use = el('button', { text: pr.name, title: `Use the "${pr.name}" lighting (Ctrl+Z goes back)`, onclick: () => lightPresetApply(pr.name) });
      const del = el('button', { class: 'light-chip-x', text: '×', title: `Delete the "${pr.name}" preset` });
      del.addEventListener('click', () => {
        chip.textContent = '';
        chip.classList.add('ask');
        chip.append(el('span', { text: `Delete "${pr.name}"?` }),
          el('button', { text: 'Delete', onclick: () => lightPresetDelete(pr.name) }),
          el('button', { text: 'Keep', onclick: () => renderLightPanel() }));
      });
      chip.append(use, del);
      pre.append(chip);
    }
    const nameI = el('input', { type: 'text', placeholder: 'Preset name', maxlength: 40, title: 'A name for the lighting you have now' });
    nameI.addEventListener('keydown', (e) => { if (e.key === 'Enter') lightPresetSave(nameI.value); });
    box.append(el('div', { class: 'light-pre-head' }, el('b', { text: 'Presets' }), nameI,
      el('button', { text: 'Save preset', title: 'Keep the current lighting under this name (a preset with the same name is replaced). Presets are kept in the painter, so they work in every mod.', onclick: () => lightPresetSave(nameI.value) })), pre);
    const lin = lightLinear(), opened = txt;
    const grid = el('div', { class: 'cp-grid light-grid' });
    const cur = () => state.project.lightText;
    for (const r of LIGHT_ROWS) {
      const v0 = lightGet(txt, r.key);
      if (!v0) continue;
      const val = el('span', { class: 'cp-val' });
      if (r.rgb && v0.length === 3) {
        const strength = Math.max(...v0);
        const pick = el('input', { type: 'color', title: 'The colour (its brightness is the slider)' });
        const inp = el('input', { type: 'range', min: 0, max: Math.max(r.max, Math.ceil(strength * 10) / 10), step: 0.01, value: strength, title: r.help });
        const show = (v) => {
          const m = Math.max(...v) || 1, n = v.map((x) => x / m);
          pick.value = '#' + n.map((x) => (lin ? toSrgb(x) : Math.round(255 * Math.min(1, x))).toString(16).padStart(2, '0')).join('');
          val.textContent = v.map((x) => x.toFixed(2)).join(' ');
          val.title = v.map((x) => x.toFixed(4)).join(' ');
        };
        const hue = () => { const h = pick.value; const c = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)); const n = c.map((x) => (lin ? fromSrgb(x) : x / 255)); const m = Math.max(...n) || 1; return n.map((x) => x / m); };
        const put = () => { const s = +inp.value, v = hue().map((x) => x * s); lightApply(lightSet(cur(), r.key, v), false); val.textContent = v.map((x) => x.toFixed(2)).join(' '); };
        show(v0);
        pick.addEventListener('input', put);
        pick.addEventListener('change', () => { lightCommit(); lightApply(cur(), true); });
        inp.addEventListener('input', put);
        inp.addEventListener('change', () => { lightCommit(); lightApply(cur(), true); });
        inp.addEventListener('dblclick', () => { const v = lightGet(opened, r.key); inp.value = Math.max(...v); show(v); lightApply(lightSet(cur(), r.key, v), false); lightCommit(); lightApply(cur(), true); });
        grid.append(el('label', { text: r.label, title: r.help }), el('div', { class: 'light-rgb' }, pick, inp), val);
      } else {
        const inp = el('input', { type: 'range', min: r.min, max: Math.max(r.max, v0[0]), step: r.step, value: v0[0], title: r.help });
        const fmt = (v) => (r.step >= 1 ? String(Math.round(v)) : (+v).toFixed(2));
        val.textContent = fmt(v0[0]);
        const put = () => { lightApply(lightSet(cur(), r.key, [+inp.value]), false); val.textContent = fmt(+inp.value); };
        inp.addEventListener('input', put);
        inp.addEventListener('change', () => { lightCommit(); lightApply(cur(), true); });
        inp.addEventListener('dblclick', () => { inp.value = v0[0]; put(); lightCommit(); lightApply(cur(), true); });
        grid.append(el('label', { text: r.label, title: r.help }), inp, val);
      }
    }
    // the sun's direction as compass bearing and height above the horizon
    const dir = lightGet(txt, 'diffuse_direction');
    if (dir && dir.length === 3) {
      const len = Math.hypot(...dir) || 1;
      let el0 = Math.asin(Math.max(-1, Math.min(1, -dir[1] / len))) * 180 / Math.PI;
      let az0 = (Math.atan2(dir[0], dir[2]) * 180 / Math.PI + 360) % 360;
      const elV = el('span', { class: 'cp-val' }), azV = el('span', { class: 'cp-val' });
      const elI = el('input', { type: 'range', min: 2, max: 90, step: 1, value: Math.round(el0), title: 'How high the sun stands' });
      const azI = el('input', { type: 'range', min: 0, max: 359, step: 1, value: Math.round(az0), title: 'Which way the light travels across the map (0 is toward the top)' });
      const show = () => { elV.textContent = `${elI.value}°`; azV.textContent = `${azI.value}°`; };
      const put = () => {
        const e = +elI.value * Math.PI / 180, a = +azI.value * Math.PI / 180, h = Math.cos(e);
        lightApply(lightSet(cur(), 'diffuse_direction', [h * Math.sin(a) * len, -Math.sin(e) * len, h * Math.cos(a) * len]), false);
        show();
      };
      show();
      for (const i of [elI, azI]) {
        i.addEventListener('input', put);
        i.addEventListener('change', () => { lightCommit(); lightApply(cur(), true); });
      }
      elI.addEventListener('dblclick', () => { elI.value = Math.round(el0); put(); lightCommit(); lightApply(cur(), true); });
      azI.addEventListener('dblclick', () => { azI.value = Math.round(az0); put(); lightCommit(); lightApply(cur(), true); });
      grid.append(el('label', { text: 'Sun height', title: 'diffuse_direction' }), elI, elV, el('label', { text: 'Sun bearing', title: 'diffuse_direction' }), azI, azV);
    }
    box.append(grid);
    const f = state.project.files.fLight;
    box.append(el('div', { class: 'cp-foot' },
      el('span', { class: 'adj-state' }),
      el('button', { text: 'Undo', title: 'Undo the last change (Ctrl+Z)', onclick: () => undo() }),
      el('button', { text: 'Redo', title: 'Redo (Ctrl+Y)', onclick: () => redo() }),
      el('button', { text: 'Reset', title: 'Put the lighting file back as it was before the painter first changed it (kept in map_painter_backups\\lighting_original). Ctrl+Z undoes this.', onclick: async () => {
        const o = await lightOriginal().catch((e) => { toast('Could not read the original lighting file: ' + e.message, 'err', 8000); return null; });
        if (o == null) return;
        if (lightJump(o)) toast('Lighting reset to the original file (Ctrl+Z goes back)', 'ok', 2500); else toast('The lighting is already the original', 'ok', 2000);
      } }),
      el('button', { text: 'Open file', title: 'Open the lighting file in your text editor', onclick: async () => { const err = await host.openPath(state.project.files.fLight); if (err) toast(err, 'err'); } })));
    if (!S().gameLook) box.append(el('div', { class: 'cp-note', text: 'Turn on Settings > Match the game\'s look (3D) to see the shadows, AO and exposure as the game draws them.' }));
    lightStateText();
  }
  function setLightPanel(on) {
    const box = $('#lightPanel');
    if (!box) return;
    box.hidden = !on;
    $('#btnLight').classList.toggle('active', on);
    if (on) renderLightPanel();
  }

  // ---------------------------------------------------------------- sea colour
  // The game's sea takes its colour from water_surface.tga (M2EX PBR sea). The Sea colour panel recolours that
  // picture with the same maths as the map colour; the painter shows the recoloured picture and Save writes it.
  // The untouched picture is kept once in <mod>\map_painter_backups\sea_surface_original, every save starts
  // from it, and the painter always reads it. A water_surface.tga only the game has gets a copy in the mod.
  function seaAdj() {
    const s = S(), r = (v) => Math.round((v ?? 1) * 100) / 100;
    return { b: r(s.seaBright), c: r(s.seaContrast), s: r(s.seaSat), h: Math.round(s.seaHue || 0) };
  }
  const seaBakeDir = () => M2.join(state.project.loc.modRoot, 'map_painter_backups', 'sea_surface_original');
  async function seaManifest() {
    let m = { adj: { b: 1, c: 1, s: 1, h: 0 }, files: {} };
    try {
      const f = M2.join(seaBakeDir(), 'manifest.json');
      if (await host.exists(f)) m = Object.assign(m, JSON.parse(await host.readText(f)));
    } catch (e) { console.warn('sea manifest', e); }
    return m;
  }
  // where Save writes: the file the game reads, or a copy in the mod when only the game has it
  function seaTarget() {
    const p = state.project, f = p.sea.file, loc = p.loc;
    if (loc.gameDataDir && norm(f).startsWith(norm(loc.gameDataDir) + '\\') && norm(loc.dataDir) !== norm(loc.gameDataDir)) {
      return M2.join(loc.dataDir, f.slice(loc.gameDataDir.length).replace(/^[\\/]+/, ''));
    }
    return f;
  }
  // finds water_surface.tga, reads its original, and returns the picture to show
  async function seaLoad(cands) {
    const p = state.project;
    p.sea = { file: null, img: null, bake: await seaManifest() };
    const f = await M2.firstExisting(cands);
    if (!f) return null;
    p.sea.file = f;
    const e = p.sea.bake.files[norm(seaTarget())];
    try { p.sea.img = await Images.decodeAny(await host.read(e ? e.original : f), f); } catch (err) { console.warn('could not read', f, err); return null; }
    return seaPicture();
  }
  function seaPicture() {
    const p = state.project, img = p.sea && p.sea.img;
    if (!img) return null;
    const a = seaAdj();
    if (groundAdjIdentity(a)) return img;
    const fn = groundStage(a), d = new Uint8Array(img.data);
    for (let i = 0; i < d.length; i += 4) { const c = fn(d[i], d[i + 1], d[i + 2]); d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; }
    return { ...img, data: d };
  }
  let seaTimer = 0;
  function seaShow() {
    applyViewSettings();
    clearTimeout(seaTimer);
    seaTimer = setTimeout(() => { if (view && state.project && state.project.sea) view.setSeaSurface(seaPicture()); }, 60);
  }
  function seaBakePending() {
    const p = state.project;
    return !!(p && p.sea && p.sea.file && p.sea.img && groundAdjKey(seaAdj()) !== groundAdjKey(p.sea.bake.adj || { b: 1, c: 1, s: 1, h: 0 }));
  }
  async function bakeSea() {
    const p = state.project, m = p.sea.bake, adj = seaAdj(), target = seaTarget(), key = norm(target);
    let e = m.files[key];
    if (!e) {
      let original = p.sea.file;
      if (norm(original) === key) {
        original = M2.join(seaBakeDir(), target.slice(p.loc.modRoot.length).replace(/^[\\/]+/, ''));
        if (!(await host.exists(original))) await host.writeFile(original, await host.read(target));
      }
      e = m.files[key] = { target, original };
    }
    const orig = await host.read(e.original);
    const out = groundAdjIdentity(adj) ? orig : Images.adjustTGA(orig, groundStage(adj));
    state.ownWrites.set(key, Date.now());
    await host.writeFile(target, out);
    m.adj = adj;
    await host.writeFile(M2.join(seaBakeDir(), 'manifest.json'), new TextEncoder().encode(JSON.stringify(m, null, 1)));
    p.sea.file = target;
    return target;
  }

  // the floating Map colour panel: the map-wide sliders, or one texture's own
  let colourTarget = 'all';
  function mapTextureNames() {
    const p = state.project, names = new Map();
    if (!p) return [];
    p.climates.forEach((c, ci) => {
      if (!p.clCounts[ci]) return;
      for (const e of Object.values(aerialFor(c))) for (const n of [e.summer, e.winter]) {
        if (!n) continue;
        const l = state.layerByName && state.layerByName.get(n.toLowerCase());
        if (l && !l.missing) names.set(n.toLowerCase(), n);
      }
    });
    return [...names.values()].sort((a, b) => a.localeCompare(b));
  }
  function colourTargetFromBrush() {
    const b = state.brush;
    if (!(b.gt >= 0 && b.cl >= 0)) return null;
    const l = layerFor(b.gt, b.cl);
    return l && !l.missing ? l.name.toLowerCase() : null;
  }
  function renderColourPanel() {
    const box = $('#colourPanel');
    if (!box) return;
    const s = S();
    box.textContent = '';
    const names = mapTextureNames(), tiles = tileColourList();
    if (colourTarget.startsWith('tile:') ? !tiles.some((t) => 'tile:' + t.key === colourTarget) : colourTarget !== 'all' && !names.some((n) => n.toLowerCase() === colourTarget)) colourTarget = 'all';
    const all = colourTarget === 'all';
    // a tile model picture: its own entry in settings.tileTexAdj
    const tileK = colourTarget.startsWith('tile:') ? colourTarget.slice(5) : null;
    const store = tileK ? 'tileTexAdj' : 'groundTexAdj', ownKey = tileK || colourTarget;
    // where the sliders read and write: settings for the whole map, or this texture's entry
    const own = () => { s[store] = s[store] || {}; return (s[store][ownKey] = s[store][ownKey] || { b: 1, c: 1, s: 1, h: 0 }); };
    const get = (k, def) => all ? (s[{ b: 'groundBright', c: 'groundContrast', s: 'groundSat', h: 'groundHue' }[k]] ?? def) : (((s[store] || {})[ownKey] || {})[k] ?? def);
    const put = (k, v) => {
      if (all) s[{ b: 'groundBright', c: 'groundContrast', s: 'groundSat', h: 'groundHue' }[k]] = v;
      else {
        own()[k] = v;
        if (groundAdjIdentity(tileK ? tileAdjOf(tileK) : texAdj(colourTarget))) delete s[store][ownKey];
      }
    };
    // the picture on screen follows (the map-wide sliders work through the view settings)
    const shown = () => { if (tileK) tileColourChanged(tileK); else if (!all) layerColourChanged(colourTarget); };
    const head = el('div', { class: 'cp-head' },
      el('b', { text: 'Map colour' }),
      el('span', { class: 'cp-help', text: 'Double-click a slider to reset it.' }),
      el('button', { class: 'ramp-x', title: 'Close', text: '×', onclick: () => setColourPanel(false) }));
    box.append(head);
    const sel = el('select', { class: 'cp-sel', title: 'What the sliders change. A texture\'s own change comes first, then the whole map\'s on top.' });
    sel.append(el('option', { value: 'all', text: 'All ground textures' }));
    const adjusted = currentTexAdj();
    for (const n of names) sel.append(el('option', { value: n.toLowerCase(), text: (adjusted[n.toLowerCase()] ? '● ' : '') + n }));
    const tAdjusted = currentTileAdj();
    if (tiles.length) {
      const TILE_SET_NAMES = { river_a: 'Rivers', wall_a: 'Walls', volcano: 'Volcanoes', volcano_dormant: 'Dormant volcanoes', cliffs: 'Cliffs', mountains: 'Mountains', hills: 'Hills' };
      const og = el('optgroup', { label: 'Tile models' });
      for (const t of tiles) {
        const used = t.sets.map((n) => TILE_SET_NAMES[n] || n).join(', ');
        og.append(el('option', { value: 'tile:' + t.key, text: `${tAdjusted[t.key] ? '● ' : ''}${t.name}${used ? ` (${used})` : ''}` }));
      }
      sel.append(og);
    }
    sel.value = colourTarget;
    sel.addEventListener('change', () => { colourTarget = sel.value; renderColourPanel(); });
    const fromBrush = el('button', { text: 'Brush texture', title: 'Pick the texture on the brush (pick one in the key). While a texture is chosen here, picking another in the key switches to it.', onclick: () => {
      const t = colourTargetFromBrush();
      if (!t) { toast('Pick a texture in the key first.'); return; }
      colourTarget = t; renderColourPanel();
    } });
    box.append(el('div', { class: 'cp-target' }, sel, fromBrush));
    const grid = el('div', { class: 'cp-grid' });
    const row = (label, key, min, max, step, def, fmt) => {
      const br = key === 'b', toS = br ? brightPos : (v) => v, fromS = br ? brightVal : (v) => v;
      if (br) { min = 0; max = 1; step = 0.0005; }
      const val = el('span', { class: 'cp-val', text: fmt(get(key, def)) });
      const inp = el('input', { type: 'range', min, max, step, value: toS(get(key, def)), title: br ? 'Left end: black. Middle: unchanged. Right end: white.' : '' });
      inp.addEventListener('input', () => { const v = fromS(+inp.value); put(key, v); val.textContent = fmt(v); colourChanged(); shown(); });
      inp.addEventListener('change', () => { colourCommit(); if (!all) renderColourPanel(); });
      inp.addEventListener('dblclick', () => { put(key, def); inp.value = toS(def); val.textContent = fmt(def); colourChanged(); colourCommit(); shown(); if (!all) renderColourPanel(); });
      grid.append(el('label', { text: label }), inp, val);
    };
    box.append(grid);
    row('Brightness', 'b', 0.5, 1.5, 0.01, 1, (v) => `${(+v).toFixed(2)}×`);
    row('Contrast', 'c', 0.5, 2, 0.01, 1, (v) => `${(+v).toFixed(2)}×`);
    row('Saturation', 's', 0, 2, 0.01, 1, (v) => `${(+v).toFixed(2)}×`);
    row('Hue', 'h', -180, 180, 1, 0, (v) => `${v > 0 ? '+' : ''}${Math.round(v)}°`);
    box.append(colourPresetBar(() => ({ b: get('b', 1), c: get('c', 1), s: get('s', 1), h: get('h', 0) }), (a) => {
      for (const k of ['b', 'c', 's', 'h']) put(k, a[k]);
      colourChanged(); shown(); colourCommit(); renderColourPanel();
    }));
    const nOwn = Object.keys(adjusted).length + Object.keys(tAdjusted).length;
    const foot = el('div', { class: 'cp-foot' },
      el('span', { id: 'cpState' }),
      el('button', { text: all ? 'Reset' : 'Reset texture', title: all ? 'Puts the map-wide sliders back to the middle' : 'Takes this texture\'s own change off', onclick: () => {
        if (all) { s.groundBright = 1; s.groundContrast = 1; s.groundSat = 1; s.groundHue = 0; } else if (s[store]) { delete s[store][ownKey]; shown(); }
        renderColourPanel(); colourChanged(); colourCommit();
      } }));
    box.append(foot);
    if (tileK) box.append(el('div', { class: 'cp-note', text: 'A tile model picture has only its own change; the whole map\'s sliders don\'t touch it. Shown on the tile models in the 3D game look.' }));
    if (nOwn) box.append(el('div', { class: 'cp-note', text: `${nOwn} texture${nOwn > 1 ? 's have' : ' has'} its own change (● in the list).` }));
    colourState();
  }
  function colourState() {
    const t = $('#cpState');
    if (!t || !state.project) return;
    const p = state.project, gb = p.groundBake;
    const saved = gb && (!groundAdjIdentity(gb.adj || { b: 1, c: 1, s: 1, h: 0 }) || Object.keys(gb.tex || {}).length);
    const tp = tileBakePending(), tsaved = p.tileBake && Object.keys(p.tileBake.tex || {}).length;
    t.textContent = groundBakePending() || tp
      ? `Not saved yet. Save writes this into the ${groundBakePending() ? 'ground textures of the climates on this map' : ''}${groundBakePending() && tp ? ' and the ' : ''}${tp ? 'tile model pictures' : ''}.`
      : tsaved && !saved ? 'Saved into the tile model pictures.'
      : saved ? 'Saved into the ground textures.' : 'The ground textures are unchanged.';
  }
  let colourTimer = 0;
  function colourChanged() {
    applyViewSettings();
    clearTimeout(colourTimer);
    colourTimer = setTimeout(saveSettings, 300);
    colourState();
  }
  function setColourPanel(on) {
    const box = $('#colourPanel');
    if (!box) return;
    box.hidden = !on;
    $('#btnColour').classList.toggle('active', on);
    if (on) renderColourPanel();
  }
  // picking a texture in the key while the panel shows one texture moves the panel to the new one
  function colourFollowBrush() {
    const box = $('#colourPanel');
    if (!box || box.hidden || colourTarget === 'all') return;
    const t = colourTargetFromBrush();
    if (t && t !== colourTarget) { colourTarget = t; renderColourPanel(); }
  }

  // Undo for the Map colour, Tree colour and Sea colour sliders: each finished slider move (let go, double-click,
  // Reset) is one undo step holding every colour setting before and after
  const COLOUR_KEYS = ['groundBright', 'groundContrast', 'groundSat', 'groundHue', 'groundTexAdj', 'tileTexAdj', 'treeBright', 'treeBrightness', 'treeContrast', 'treeSat', 'treeHue', 'seaBright', 'seaContrast', 'seaSat', 'seaHue'];
  let colourBase = null;
  function colourSnap() {
    const s = S(), o = {};
    for (const k of COLOUR_KEYS) o[k] = s[k] === undefined ? null : s[k];
    return JSON.stringify(o);
  }
  function colourCommit() {
    if (!state.project) return;
    const now = colourSnap();
    if (colourBase !== null && now !== colourBase) {
      state.undo.push({ cs: { before: colourBase, after: now } });
      state.redo = [];
      updateButtons();
    }
    colourBase = now;
  }
  function colourRestore(json) {
    const s = S(), o = JSON.parse(json);
    for (const k of COLOUR_KEYS) { if (o[k] === null) delete s[k]; else s[k] = o[k]; }
    colourBase = json;
    saveSettings();
    applyViewSettings();
    refreshAllLayers(); // only the textures whose colour changed are worked again
    tileRefreshAll();
    seaShow();
    const cp = $('#colourPanel');
    if (cp && !cp.hidden) renderColourPanel(); else colourState();
    for (const kind of Object.keys(ADJ_PANELS)) { const b = $(ADJ_PANELS[kind].box); if (b && !b.hidden) renderAdjPanel(kind); else adjState(kind); }
    updateButtons();
  }

  // ---------------------------------------------------------------- tree brightness saved into the textures
  // On save, the Tree brightness setting is written into the tree textures the game uses, so the game's trees
  // look the way the painter shows them. The untouched pictures are kept once, in
  // <mod>\map_painter_backups\tree_textures_original, and every save works from those, so saving again
  // never stacks up; 1x puts the originals back. The painter itself always draws from the originals.
  const treeBakeDir = () => M2.join(state.project.loc.modRoot, 'map_painter_backups', 'tree_textures_original');
  async function treeManifest() {
    const p = state.project;
    if (document.body.classList.contains('scenery-mode')) return (p.treeBake = {gain:1,files:{}});
    if (p.treeBake) return p.treeBake;
    let m = { gain: 1, files: {} };
    try {
      const f = M2.join(treeBakeDir(), 'manifest.json');
      if (await host.exists(f)) m = Object.assign(m, JSON.parse(await host.readText(f)));
    } catch (e) { console.warn('tree texture manifest', e); }
    p.treeBake = m;
    return m;
  }
  // the Tree colour panel's settings (brightness was the Settings tab's Tree brightness before)
  function treeAdj() {
    const s = S(), r = (v, d) => Math.round((v ?? d) * 100) / 100;
    return { b: r(s.treeBright ?? s.treeBrightness, 1), c: r(s.treeContrast, 1), s: r(s.treeSat, 1), h: Math.round(s.treeHue || 0) };
  }
  const savedTreeAdj = (m) => m.adj || { b: m.gain || 1, c: 1, s: 1, h: 0 };
  // The game lights the trees brighter than the painter does: the user's game and painter screenshots of
  // New_Mount (2026-11-10) with the same tree pictures put the game's trees at about 1/0.52, 1/0.64, 1/0.56
  // of the painter's in linear red, green, blue. Saving multiplies this in, so the game's trees come out the
  // shade the painter shows (measured by eye-level screenshot comparison, not from the game's files).
  const TREE_GAME_MATCH = [0.52, 0.64, 0.56];
  const treeCalKey = (c) => (c || [1, 1, 1]).map((v) => (+v).toFixed(3)).join(',');
  function treeBakePending() {
    const p = state.project;
    return !!(p && p.treeBake && S().bakeTrees !== false && (groundAdjKey(treeAdj()) !== groundAdjKey(savedTreeAdj(p.treeBake)) || treeCalKey(p.treeBake.cal) !== treeCalKey(TREE_GAME_MATCH)));
  }
  // the colour panels' live preview: ground textures and tree pictures recoloured when their sliders change
  let shownGround = '', shownTree = '', colourPreviewTimer = 0;
  function colourPreview() {
    if (!view || !state.project) return;
    clearTimeout(colourPreviewTimer);
    colourPreviewTimer = setTimeout(() => {
      const g = groundAdjKey(groundAdj()), t = groundAdjKey(treeAdj());
      if (g !== shownGround) { shownGround = g; refreshAllLayers(); }
      if (t !== shownTree) { shownTree = t; recolourTrees(); }
    }, 40);
  }
  function recolourTrees() {
    if (!view || !view.recolourModels) return;
    const t = treeAdj();
    view.recolourModels('tree', groundAdjIdentity(t) ? null : groundStage(t));
  }

  // the original of a tree picture the painter is about to read (the file itself when it was never changed)
  function treeOriginal(file) {
    const p = state.project, e = p && p.treeBake && p.treeBake.files[norm(file)];
    return e ? e.original : file;
  }

  // every tree picture the game can use for the climates' tree models: both the min_spec and the regular
  // models, the .tga.dds and the .tga of each, as the game finds them (the mod's, else the game's own)
  async function treeTextureFiles() {
    const p = state.project, J = M2.join, rel = ['terrain', 'aerial_map', 'tree_models'];
    const bases = [p.loc.dataDir, p.loc.gameDataDir].filter(Boolean);
    const names = new Set();
    for (const c of p.climates) for (const season of ['summer', 'winter']) for (const list of Object.values((c.trees || {})[season] || {})) for (const n of list) names.add(n.toLowerCase());
    const found = new Map(); // norm(target) -> { target, source }
    for (const sub of [['min_spec'], []]) {
      const folders = [];
      for (const b of bases) folders.push(await treeFolder(J(b, ...rel, ...sub)));
      for (const key of names) {
        const at = folders.findIndex((f) => f.files.has(key));
        if (at < 0) continue;
        let cas;
        try { cas = CAS.parse(await host.read(folders[at].files.get(key))); } catch (e) { continue; }
        for (const mat of cas.materials) {
          if (!mat || mat.image || !mat.texture) continue;
          let r = mat.texture.replace(/\\/g, '/').replace(/^\/+/, '').toLowerCase();
          const tries = r.includes('/') ? [r] : [r, 'textures/' + r];
          for (const t of tries) for (const n of [t + '.dds', t]) {
            const hit = folders.map((f) => f.files.get(n)).filter(Boolean);
            if (!hit.length) continue;
            const st = await host.statMany(hit);
            const k = st.findIndex((x) => x && x.size > 200);
            if (k < 0) continue;
            const source = hit[k];
            // the copy the game reads from the mod: the mod's own file, or a new one in the mod beside it
            let target = source;
            if (p.loc.gameDataDir && norm(source).startsWith(norm(p.loc.gameDataDir) + '\\') && norm(p.loc.dataDir) !== norm(p.loc.gameDataDir)) {
              target = J(p.loc.dataDir, source.slice(p.loc.gameDataDir.length).replace(/^[\\/]+/, ''));
            }
            if (!found.has(norm(target))) found.set(norm(target), { target, source });
          }
        }
      }
    }
    return [...found.values()];
  }

  // writes the brightness into the tree pictures; returns how many files were written
  async function bakeTrees() {
    const p = state.project, m = await treeManifest(), adj = treeAdj();
    const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    const enc = (v) => { v = Math.min(1, Math.max(0, v)); return Math.round(255 * (v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055)); };
    // the tree colour as the painter shows it (the same maths as the ground's), then the game's brighter
    // tree lighting taken out
    const LUT = TREE_GAME_MATCH.map((c) => { const t = new Uint8Array(256); for (let i = 0; i < 256; i++) t[i] = enc(lin(i) * c); return t; });
    const stage = groundAdjIdentity(adj) ? null : groundStage(adj);
    const same = !stage && TREE_GAME_MATCH.every((c) => Math.abs(c - 1) < 1e-6);
    const fn = (r, g, b) => { if (stage) [r, g, b] = stage(r, g, b); return [LUT[0][r], LUT[1][g], LUT[2][b]]; };
    const dir = treeBakeDir();
    const list = await treeTextureFiles();
    let n = 0;
    const failed = [];
    for (const { target, source } of list) {
      const key = norm(target);
      try {
        let e = m.files[key];
        if (!e) {
          // first time: keep the original. The mod's own file is copied into the backup folder; a picture
          // that only the game has stays where it is (the game's own files are never changed)
          let original = source;
          if (norm(source) === key) {
            original = M2.join(dir, target.slice(p.loc.modRoot.length).replace(/^[\\/]+/, ''));
            if (!(await host.exists(original))) await host.writeFile(original, await host.read(target));
          }
          e = m.files[key] = { target, original };
        }
        const orig = await host.read(e.original);
        const out = same ? orig : /\.dds$/i.test(target) ? Images.adjustDDS(orig, fn) : Images.adjustTGA(orig, fn);
        state.ownWrites.set(key, Date.now());
        await host.writeFile(target, out);
        n++;
      } catch (err) { console.warn('tree texture', target, err); failed.push(M2.basename(target)); }
    }
    m.adj = adj;
    m.gain = adj.b;
    m.cal = TREE_GAME_MATCH.slice();
    await host.writeFile(M2.join(dir, 'manifest.json'), new TextEncoder().encode(JSON.stringify(m, null, 1)));
    if (failed.length) saveNotes.push(`These tree pictures could not be changed: ${failed.join(', ')}.`);
    return n;
  }

  async function loadTrees() {
    const p = state.project;
    if (!p || !view) return;
    await treeManifest();
    // The minimum spec models (tree_models\min_spec) come first, in the mod and then the game; the regular
    // ones stand in for any that are missing. A model's pictures are looked for next to it, then further down.
    const J = M2.join, rel = ['terrain', 'aerial_map', 'tree_models'];
    const bases = [p.loc.dataDir, p.loc.gameDataDir].filter(Boolean);
    const folders = [];
    for (const sub of [['min_spec'], []]) for (const b of bases) folders.push(await treeFolder(J(b, ...rel, ...sub)));
    const names = new Map(); // lower name -> as written
    for (const c of p.climates) for (const season of ['summer', 'winter']) for (const list of Object.values((c.trees || {})[season] || {})) for (const n of list) names.set(n.toLowerCase(), n);
    const cache = new Map(), models = [], index = new Map(), missing = [], watch = [];
    for (const [key, name] of names) {
      const at = folders.findIndex((f) => f.files.has(key));
      for (const f of folders) watch.push(J(f.dir, name));
      if (at < 0) { missing.push(name); continue; }
      const file = folders[at].files.get(key), own = folders.slice(at - at % bases.length);
      try {
        const cas = CAS.parse(await host.read(file));
        const parts = [];
        for (const o of cas.objects) {
          if (!o.idx.length) continue;
          const mat = cas.materials[o.material];
          let image = null;
          if (mat && mat.image) image = Images.decodeTGA(mat.image);
          else if (mat && mat.texture) {
            const got = await treePicture(own, mat.texture, cache);
            if (got) { image = got.img; watch.push(got.file); }
          }
          parts.push({ pos: o.pos, nrm: o.nrm, uv: o.uv, idx: o.idx, image });
        }
        if (!parts.length) throw new Error('no mesh in it');
        index.set(key, models.length);
        models.push({ name, file, parts, minSpec: at < bases.length });
      } catch (e) { console.warn('tree model', file, e); missing.push(name); }
      watch.push(file);
    }
    view.setTreeModels(models);
    recolourTrees();
    p.trees = { models, index, missing, watch: [...new Set(watch)] };
    buildTreeInstances();
    if (missing.length) console.warn('tree models not found or unreadable:', missing.join(', '));
  }

  // Where each tree stands. Map points (half a tile apart) on forest get models from their climate's lists.
  function buildTreeInstances() {
    clearTimeout(treeTimer);
    const p = state.project;
    if (!p || !p.trees || !view) return;
    const T = p.trees, W = p.W, H = p.H, gt = p.gtIdx, cl = p.clIdx, D = p.heights.data;
    const dense = p.gtTable.findIndex((g) => g.key === 'forest_dense');
    const sparse = p.gtTable.findIndex((g) => g.key === 'forest_sparse');
    const pools = p.climates.map((c) => {
      const t = c.trees;
      if (!t) return null;
      const s = state.season === 'winter' && Object.keys(t.winter).length ? t.winter : t.summer;
      const get = (k) => (s[k] || []).map((n) => T.index.get(n.toLowerCase())).filter((i) => i !== undefined);
      const pool = { sparse: get('sparse_tree'), dense: get('dense_tree'), canopy: get('canopy') };
      if (!pool.dense.length) pool.dense = pool.sparse;
      return pool.sparse.length || pool.dense.length ? pool : null;
    });
    const out = T.models.map(() => []);
    let h = 0;
    const rnd = () => { h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d); h = Math.imul(h ^ (h >>> 12), 0x297a2d39); h ^= h >>> 15; return (h >>> 0) / 4294967296; };
    const put = (list, x, y, jitter) => {
      if (!list.length) return;
      const m = list[list.length > 1 ? Math.floor(rnd() * list.length) : 0];
      const o = out[m];
      o.push(x + (rnd() - 0.5) * 2 * jitter, y + (rnd() - 0.5) * 2 * jitter, rnd() * Math.PI * 2, 0.85 + rnd() * 0.3);
    };
    for (let y = 0, i = 0; y < H; y++) {
      for (let x = 0; x < W; x++, i++) {
        const g = gt[i];
        if ((g !== dense && g !== sparse) || D[i] <= 0) continue;
        const pool = pools[cl[i]];
        if (!pool) continue;
        h = Math.imul(x + 1, 0x9e3779b1) ^ Math.imul(y + 1, 0x85ebca77);
        if (g === sparse) { if (rnd() < SPARSE_CHANCE) put(pool.sparse, x, y, 0.5); }
        else { put(pool.dense, x, y, 0.3); put(pool.canopy, x, y, 0.3); }
      }
    }
    view.setTreeInstances(out.map((a) => new Float32Array(a)));
  }

  // ---------------------------------------------------------------- campaign pieces
  // Settlements, ports, forts, watchtowers, resources and faction symbols, drawn with the game's own .cas
  // models. Where they stand: settlements on map_regions.tga's black pixels, ports on its white ones (facing
  // the sea next to them), the rest at their descr_strat.txt spots. What they look like: the settlement's
  // level and owner in descr_strat.txt, the owner's culture in descr_sm_factions.txt and that culture's
  // models in descr_cultures.txt (a faction_variants\<faction> copy of a model wins, as in the game).
  // Ports: no port building shows nothing, the first port level the culture's fishing village, the later
  // ones its port_land and port_sea pair.
  const CASTLE_LEVEL = { village: 'moot_and_bailey', town: 'wooden_castle', large_town: 'castle', city: 'fortress', large_city: 'citadel', huge_city: 'citadel' };
  const SKIP_OBJECT = /^(symbol|CaozSceneCustomAttribNode)$/i;

  // parsed models and folder listings, kept between loads so moving a piece redraws quickly (emptied when
  // one of the files changes on disk or another map is opened)
  const pieceCache = { models: new Map(), dirs: new Map(), pics: new Map() };
  const clearPieceCache = () => { pieceCache.models.clear(); pieceCache.dirs.clear(); pieceCache.pics.clear(); };
  async function loadPieces() {
    const p = state.project;
    if (!p || !view) return;
    const J = M2.join, loc = p.loc;
    const dataCands = (...rel) => [J(loc.dataDir, ...rel), loc.gameDataDir && J(loc.gameDataDir, ...rel)].filter(Boolean);
    const watch = [];
    const readFirst = async (name) => {
      const c = dataCands(name); watch.push(...c);
      const f = await M2.firstExisting(c);
      return f ? host.readText(f) : null;
    };
    const tCult = await readFirst('descr_cultures.txt'), tFac = await readFirst('descr_sm_factions.txt');
    const tRes = await readFirst('descr_sm_resources.txt'), tBld = await readFirst('export_descr_buildings.txt');
    const cultures = tCult ? M2.parseCultures(tCult) : new Map();
    const facs = tFac ? M2.parseSmFactions(tFac) : new Map();
    const resModels = tRes ? M2.parseSmResources(tRes) : new Map();
    // port chains and their level order (export_descr_buildings.txt)
    const chainLevels = new Map([['port', ['port', 'shipwright', 'dockyard', 'naval_drydock']], ['castle_port', ['c_port', 'c_shipwright', 'c_dockyard', 'c_naval_drydock']]]);
    if (tBld) for (const m of tBld.matchAll(/^building\s+(\S+)\s*\{[^{]*?levels\s+([^\r\n]+)/gmi)) chainLevels.set(m[1].toLowerCase(), m[2].trim().split(/\s+/).map((x) => x.toLowerCase()));
    const portChains = [...chainLevels.keys()].filter((k) => /port/.test(k));
    p.resTypes = [...resModels.keys()].sort();
    p.resModels = resModels;

    const R = p.regions, strat = p.strat, s = S();
    const out = { places: [], models: [], missing: [] };
    if (!R || !s.pieces) { p.pieces = { watch, ...out }; view.setPieceModels([]); return; }
    const Wt = R.width, Ht = R.height, rd = R.data;
    const keyAt = (x, y) => (x < 0 || y < 0 || x >= Wt || y >= Ht) ? null : `${rd[(y * Wt + x) * 4]},${rd[(y * Wt + x) * 4 + 1]},${rd[(y * Wt + x) * 4 + 2]}`;
    const regionOf = (x, y) => {
      const n = new Map();
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const r = p.regionByColour.get(keyAt(x + dx, y + dy));
        if (r) n.set(r, (n.get(r) || 0) + 1);
      }
      let best = null, bn = 0;
      for (const [r, c] of n) if (c > bn) { best = r; bn = c; }
      return best;
    };
    const setByRegion = new Map();
    for (const t of (strat && strat.settlements) || []) setByRegion.set(t.region.toLowerCase(), t);
    const cultureOf = (faction) => {
      const f = faction && facs.get(faction.toLowerCase());
      return (f && cultures.get(String(f.culture).toLowerCase())) || null;
    };
    const anyCulture = cultures.values().next().value || null;
    // map vertex spot of a tile counted from the top left
    const spot = (tx, ty) => [tx * 2 + 1, ty * 2 + 1];
    const place = (path, faction, at, turn, kind) => { if (path) out.places.push({ path, faction, x: at[0], y: at[1], turn: turn || 0, kind }); };

    // settlements and their ports
    const unlisted = s.unlistedLevel || '';
    const ports = [];
    for (let y = 0; y < Ht; y++) for (let x = 0; x < Wt; x++) {
      const k = keyAt(x, y);
      if (k === '0,0,0') {
        const reg = regionOf(x, y);
        const t = reg && setByRegion.get(reg.name.toLowerCase());
        let level, faction;
        if (t) { level = t.castle ? (CASTLE_LEVEL[t.level] || t.level) : t.level; faction = t.faction; }
        else if (unlisted) { level = unlisted; faction = reg && reg.creator; }
        else continue;
        const cu = cultureOf(faction) || anyCulture;
        if (!cu) continue;
        const path = cu.levels[level] || cu.levels.town || Object.values(cu.levels)[0];
        place(path, faction, spot(x, y), 0, 'settlement');
        if (t && facs.get(String(faction).toLowerCase())) out.places[out.places.length - 1].symbolOf = faction;
      } else if (k === '255,255,255') ports.push([x, y]);
    }
    for (const [x, y] of ports) {
      const reg = regionOf(x, y);
      const t = reg && setByRegion.get(reg.name.toLowerCase());
      let lvl = 0, faction = t ? t.faction : reg && reg.creator;
      if (t) {
        for (const [chain, name] of t.buildings) if (portChains.includes(chain)) lvl = Math.max(lvl, chainLevels.get(chain).indexOf(name) + 1);
      } else if (unlisted) lvl = 1;
      if (!lvl) continue;
      const cu = cultureOf(faction) || anyCulture;
      if (!cu) continue;
      // Native ports choose a cardinal dock from ground tiles, not an average of region colours.
      const facing = SceneryPort.fromMap(p, {x, y: R.height - 1 - y});
      const turn = (facing?.heading || 0) * Math.PI / 180;
      const at = spot(x, y);
      if (lvl === 1) place(cu.fishing, faction, at, turn, 'port');
      else {
        const pr = cu.ports[Math.min(lvl - 2, cu.ports.length - 1)];
        if (pr) { place(pr.land, faction, at, turn, 'port'); place(pr.sea, faction, at, turn, 'port'); }
        else place(cu.fishing, faction, at, turn, 'port');
      }
    }
    // forts, watchtowers and resources: from the descr_strat.txt the Pieces tool edits, with its changes
    const spots = p.pc ? pcStrat() : strat;
    if (spots) {
      const fromBottom = (x, y) => spot(x, Ht - 1 - y);
      for (const f of spots.forts) {
        const cu = (f.words.map((w) => cultures.get(w)).find(Boolean)) || cultureOf(f.faction) || anyCulture;
        const at = fromBottom(f.x, f.y), own = cu ? [cu.fort, cu.fortWall].filter(Boolean) : [];
        const fm = s.fortModel || 'castle';
        if (fm === 'castle' || fm.startsWith('import:')) {
          // the chosen model; the culture's own fort stands in when it can't be found
          out.places.push({ path: fm === 'castle' ? FORT_CASTLE : fm, faction: null, x: at[0], y: at[1], turn: 0, kind: 'fort', alt: own });
        } else for (const m of own) place(m, f.faction, at, 0, 'fort');
      }
      for (const w of spots.watchtowers) {
        const reg = regionOf(w.x, Ht - 1 - w.y);
        const cu = cultureOf(w.faction) || cultureOf(reg && reg.creator) || anyCulture;
        if (cu) place(cu.watchtower, w.faction, fromBottom(w.x, w.y), 0, 'watchtower');
      }
      for (const r of spots.resources) place(resModels.get(r.type), null, fromBottom(r.x, r.y), 0, 'resource');
    }

    // load each model once (per faction when it has a faction_variants copy)
    const dirCache = pieceCache.dirs;
    const listDir = async (dir) => {
      const key = norm(dir);
      if (!dirCache.has(key)) dirCache.set(key, host.list(dir).then((l) => new Map(l.map((e) => [e.name.toLowerCase(), e])), () => new Map()));
      return dirCache.get(key);
    };
    // 'data/models_strat/x.cas' -> the file, mod first, then the game; null when neither has it
    const findData = async (rel) => {
      const parts = rel.replace(/\\/g, '/').replace(/^\/+/, '').split('/');
      if (parts[0].toLowerCase() === 'data') parts.shift();
      for (const base of [loc.dataDir, loc.gameDataDir].filter(Boolean)) {
        let dir = base, ok = true;
        for (let i = 0; i < parts.length && ok; i++) {
          const e = (await listDir(dir)).get(parts[i].toLowerCase());
          if (!e || (i < parts.length - 1 && !e.isDir)) ok = false;
          else dir = J(dir, e.name);
        }
        if (ok) return dir;
      }
      return null;
    };
    const variantOf = async (rel, faction) => {
      if (!faction) return null;
      const parts = rel.replace(/\\/g, '/').split('/');
      const name = parts.pop();
      return findData([...parts, 'faction_variants', faction, name].join('/'));
    };
    const picCache = pieceCache.pics, modelIndex = new Map(), models = [];
    const loadModel = async (file) => {
      const key = norm(file);
      if (modelIndex.has(key)) return modelIndex.get(key);
      let idx = -1;
      const kept = pieceCache.models.get(key);
      if (kept) {
        watch.push(...kept.watch);
        if (kept.parts.length) { idx = models.length; models.push({ file, parts: kept.parts, symbol: kept.symbol }); }
        modelIndex.set(key, idx);
        return idx;
      }
      const seen = [file];
      try {
        const cas = CAS.parse(await host.read(file));
        const dir = M2.dirname(file);
        // pictures next to the model (its textures folder), then the same folder in the mod and the game
        const folders = [await treeFolder(dir)];
        const m = norm(dir).match(/[\\/]data[\\/](.+)$/i);
        if (m) for (const base of [loc.dataDir, loc.gameDataDir].filter(Boolean)) {
          const alt = J(base, ...m[1].split(/[\\/]/));
          if (norm(alt) !== norm(dir)) folders.push(await treeFolder(alt));
          const up = M2.dirname(M2.dirname(M2.dirname(alt)));
          if (/faction_variants/i.test(alt)) folders.push(await treeFolder(up));
        }
        const parts = [];
        let symbol = null;
        for (const o of cas.objects) {
          if (/^symbol$/i.test(o.name)) {
            const c = [0, 0, 0];
            for (let i = 0; i < o.pos.length; i += 3) for (let k = 0; k < 3; k++) c[k] += o.pos[i + k] / (o.pos.length / 3);
            symbol = c;
          }
          if (SKIP_OBJECT.test(o.name) || !o.idx.length) continue;
          const mat = cas.materials[o.material];
          let image = null;
          if (mat && mat.image) image = Images.decodeTGA(mat.image);
          else if (mat && mat.texture) {
            const got = await treePicture(folders, mat.texture, picCache);
            if (got) { image = got.img; watch.push(got.file); seen.push(got.file); }
          }
          // game north is +z, the app's map runs south: mirror z so the model keeps its handedness
          const pos = o.pos.slice(), nrm = o.nrm.slice();
          for (let i = 2; i < pos.length; i += 3) { pos[i] = -pos[i]; nrm[i] = -nrm[i]; }
          parts.push({ pos, nrm, uv: o.uv, idx: o.idx, image });
        }
        if (parts.length) { idx = models.length; models.push({ file, parts, symbol }); }
        pieceCache.models.set(key, { parts, symbol, watch: seen });
      } catch (e) { console.warn('model', file, e); }
      modelIndex.set(key, idx);
      watch.push(file);
      return idx;
    };
    // an imported fort model (Settings > Fort model), kept in the app's fort_models folder
    const loadImport = async (key) => {
      if (modelIndex.has(key)) return modelIndex.get(key);
      let idx = -1;
      try {
        const got = await fortImportModel(key.slice(7));
        if (got) { idx = models.length; models.push({ file: key, parts: got.parts, symbol: null }); }
      } catch (e) { console.warn('imported fort model', key, e); out.missing.push(`${key.slice(7)} (${e.message})`); }
      modelIndex.set(key, idx);
      return idx;
    };
    const lists = [];
    const add = (i, x, y, turn, size = 1) => { if (i < 0) return; (lists[i] = lists[i] || []).push(x, y, turn, size); };
    for (const pl of out.places) {
      if (pl.path.startsWith('import:')) {
        const i = await loadImport(pl.path);
        if (i >= 0) { add(i, pl.x, pl.y, pl.turn, fortImportScale(pl.path.slice(7))); continue; }
      }
      const file = pl.path.startsWith('import:') ? null : (await variantOf(pl.path, pl.faction)) || (await findData(pl.path));
      if (!file) {
        if (pl.alt) { for (const a of pl.alt) out.places.push({ path: a, faction: pl.faction, x: pl.x, y: pl.y, turn: pl.turn, kind: pl.kind }); }
        if (!pl.path.startsWith('import:')) out.missing.push(pl.path);
        continue;
      }
      const i = await loadModel(file);
      pl.modelIndex = i; pl.file = file;
      add(i, pl.x, pl.y, pl.turn);
      // the owner's symbol where the model marks it
      if (i >= 0 && pl.symbolOf && models[i].symbol) {
        const f = facs.get(pl.symbolOf.toLowerCase());
        const sf = f && f.symbol && (await findData(f.symbol));
        if (sf) {
          const si = await loadModel(sf);
          const c = models[i].symbol;
          add(si, pl.x + c[0] * 2, pl.y - c[2] * 2, 0);
        }
      }
    }
    const baseInstances = models.map((m, i) => new Float32Array(lists[i] || []));
    view.setPieceModels(models);
    view.setPieceInstances(baseInstances);
    p.pieces = { watch: [...new Set(watch)], places: out.places, models, instances: baseInstances, missing: [...new Set(out.missing)] };
    window.dispatchEvent(new CustomEvent('scenery-base-ready'));
    if (p.pieces.missing.length) console.warn('campaign models not found:', p.pieces.missing.join(', '));
  }


  // ---------------------------------------------------------------- fort models
  // Forts are drawn with southern_european_castle.cas (the user's choice), the culture's own fort as in the game,
  // or a model imported from .obj or .fbx. Imported models are copied with their pictures into
  // %APPDATA%\M2 Map Painter\fort_models\<name>\ and listed in settings.fortModels: [{ name, file, scale, upright }].
  // They are only drawn in the painter; the game keeps the forts descr_cultures.txt names.
  const FORT_CASTLE = 'models_strat/residences/southern_european_castle.cas';
  const fortImports = () => (S().fortModels = S().fortModels || []);
  const fortImportScale = (name) => { const m = fortImports().find((x) => x.name === name); return m ? (+m.scale || 1) : 1; };
  let fortDir = null;
  async function fortModelsDir() {
    if (!fortDir) fortDir = M2.join((await host.appdir()).dir, 'fort_models');
    return fortDir;
  }
  // reads an imported model: its parts in tiles (1 unit = 1 tile, as .cas), standing on y = 0, centred
  async function fortImportModel(name, given) {
    const m = fortImports().find((x) => x.name === name);
    if (!m && !given) return null;
    let files = given;
    if (!files) {
      const dir = M2.join(await fortModelsDir(), name);
      files = new Map();
      for (const e of await host.list(dir)) if (!e.isDir) files.set(e.name.toLowerCase(), { name: e.name, path: M2.join(dir, e.name) });
    }
    const bytesOf = async (e) => e.bytes || (e.bytes = await host.read(e.path));
    const modelName = (m && m.file) || given.model;
    const me = files.get(modelName.toLowerCase());
    if (!me) throw new Error(`${modelName} is missing`);
    // the .mtl files go to the reader
    const side = new Map();
    for (const [k, e] of files) if (/\.mtl$/.test(k)) side.set(k, await bytesOf(e));
    const mesh = await MeshImport.parse(modelName, await bytesOf(me), side);
    // pictures: the file named, else one with the same name and another extension
    const pics = new Map();
    for (const [key, t] of mesh.textures) {
      let bytes = t.bytes, fname = t.name;
      if (!bytes) {
        const want = M2.basename(t.name).toLowerCase(), stem = want.replace(/\.[^.]*$/, '').replace(/\.tga$/, '');
        const hit = files.get(want) || [...files.values()].find((e) => e.name.toLowerCase().replace(/(\.tga)?\.[^.]*$/, '') === stem && /\.(png|jpe?g|tga|dds|bmp|webp)$/i.test(e.name));
        if (hit) { bytes = await bytesOf(hit); fname = hit.name; }
      }
      if (!bytes) { pics.set(key, null); continue; }
      try { pics.set(key, await Images.decodeAny(bytes, fname)); } catch (e) { console.warn('fort model picture', fname, e); pics.set(key, null); }
    }
    const upright = m ? !!m.upright : false;
    const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
    for (const pt of mesh.parts) {
      if (upright) for (const a of [pt.pos, pt.nrm]) for (let i = 0; i < a.length; i += 3) { const y = a[i + 1]; a[i + 1] = a[i + 2]; a[i + 2] = -y; }
      for (let i = 0; i < pt.pos.length; i += 3) for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], pt.pos[i + k]); max[k] = Math.max(max[k], pt.pos[i + k]); }
    }
    const cx = (min[0] + max[0]) / 2, cz = (min[2] + max[2]) / 2;
    const parts = mesh.parts.map((pt) => {
      const pos = pt.pos, nrm = pt.nrm;
      // centred on the tile, standing on the ground; z mirrored like the game's own models
      for (let i = 0; i < pos.length; i += 3) { pos[i] -= cx; pos[i + 1] -= min[1]; pos[i + 2] = -(pos[i + 2] - cz); nrm[i + 2] = -nrm[i + 2]; }
      return { pos, nrm, uv: pt.uv, idx: pt.idx, image: pics.get(pt.tex) || null };
    });
    return { parts, size: [max[0] - min[0], max[1] - min[1], max[2] - min[2]], missingPics: [...pics].filter(([, v]) => !v).map(([k]) => k) };
  }
  async function importFortModel(after) {
    const files = await new Promise((resolve) => {
      const inp = el('input', { type: 'file', accept: '.obj,.fbx,.mtl,.png,.jpg,.jpeg,.tga,.dds,.bmp,.webp' });
      inp.multiple = true;
      inp.addEventListener('change', async () => {
        const out = [];
        for (const f of inp.files) out.push({ name: f.name, bytes: new Uint8Array(await f.arrayBuffer()) });
        resolve(out);
      });
      inp.click();
    });
    if (!files.length) return;
    const model = files.find((f) => /\.(obj|fbx)$/i.test(f.name));
    if (!model) { toast('Pick an .obj or .fbx file (with its .mtl and pictures, if it has them).', 'err', 8000); return; }
    const given = new Map(files.map((f) => [f.name.toLowerCase(), f]));
    given.model = model.name;
    let got;
    try { got = await fortImportModel(null, given); } catch (e) { toast(`Could not read ${model.name}: ${e.message}`, 'err', 10000); return; }
    // one tile is one unit, as in the game's models; a model far off that size is fitted to one tile
    const foot = Math.max(got.size[0], got.size[2]) || 1;
    const scale = foot > 4 || foot < 0.25 ? +(1 / foot).toPrecision(3) : 1;
    let name = model.name.replace(/\.[^.]*$/, '').replace(/[\\/:*?"<>|]/g, '_') || 'fort';
    const taken = new Set(fortImports().map((x) => x.name.toLowerCase()));
    for (let n = 2, b = name; taken.has(name.toLowerCase()); n++) name = `${b} (${n})`;
    try {
      const dir = M2.join(await fortModelsDir(), name);
      for (const f of files) await host.writeFile(M2.join(dir, f.name.replace(/[\\/:*?"<>|]/g, '_')), f.bytes);
    } catch (e) { toast('Could not keep the model in the app folder: ' + e.message, 'err', 10000); return; }
    fortImports().push({ name, file: model.name.replace(/[\\/:*?"<>|]/g, '_'), scale, upright: false });
    S().fortModel = 'import:' + name;
    saveSettings();
    clearPieceCache();
    await loadPieces();
    const notes = [];
    if (scale !== 1) notes.push(`It was ${foot.toPrecision(3)} units across, so it is scaled to ${scale} to fit one tile; change Scale if that's wrong.`);
    if (got.missingPics.length) notes.push(`Pictures not found: ${got.missingPics.join(', ')} (pick them together with the model).`);
    toast(`Forts now use ${model.name}. ${notes.join(' ')}`, got.missingPics.length ? 'err' : 'ok', 10000);
    if (after) after();
  }
  // the Fort model controls (Settings and the Pieces panel's Fort mode); rebuilds itself
  function fortModelBox(compact) {
    const box = el('div', { class: 'fort-box' + (compact ? ' compact' : '') });
    const render = () => {
      const s = S();
      box.textContent = '';
      const sel = el('select', { class: 'cp-sel', title: 'What the painter draws for forts (the game keeps its own)' });
      sel.append(el('option', { value: 'castle', text: 'southern_european_castle.cas' }));
      sel.append(el('option', { value: 'culture', text: 'The culture\'s own fort (as in the game)' }));
      for (const m of fortImports()) sel.append(el('option', { value: 'import:' + m.name, text: `${m.name} (imported)` }));
      sel.value = s.fortModel || 'castle';
      sel.addEventListener('change', async () => { s.fortModel = sel.value; saveSettings(); render(); await loadPieces(); });
      const imp = el('button', { text: 'Import OBJ or FBX…', title: 'Pick the .obj or .fbx with its .mtl and pictures (you can pick several files at once)', onclick: () => importFortModel(render) });
      box.append(el('div', { class: 'fort-row' }, sel, imp));
      const cur = (s.fortModel || '').startsWith('import:') && fortImports().find((x) => x.name === s.fortModel.slice(7));
      if (cur) {
        const sc = el('input', { type: 'number', min: 0.01, max: 100, step: 0.05, value: cur.scale || 1, class: 'fort-scale' });
        sc.addEventListener('change', async () => { cur.scale = Math.max(0.001, +sc.value || 1); saveSettings(); await loadPieces(); });
        const up = el('input', { type: 'checkbox' }); up.checked = !!cur.upright;
        up.addEventListener('change', async () => { cur.upright = up.checked; saveSettings(); clearPieceCache(); await loadPieces(); });
        const rm = el('button', { text: 'Remove', title: 'Forget this model and delete its copy in the app folder', onclick: async () => {
          if ((await ask(`Remove the fort model "${cur.name}"?`, 'Its copy in the app\'s fort_models folder is deleted. The file you imported it from is not touched.', ['Remove', 'Cancel'])) !== 0) return;
          try {
            const dir = M2.join(await fortModelsDir(), cur.name);
            for (const e of await host.list(dir)) if (!e.isDir) await host.removeFile(M2.join(dir, e.name)).catch(() => {});
          } catch (e) { console.warn(e); }
          s.fortModels = fortImports().filter((x) => x !== cur);
          s.fortModel = 'castle';
          saveSettings(); clearPieceCache(); render(); await loadPieces();
        } });
        box.append(el('div', { class: 'fort-row' }, el('label', { text: 'Scale' }), sc, el('label', {}, up, ' Stand it up (Z was up)'), rm));
      }
      if (!compact) box.append(el('div', { class: 'help', text: 'The model drawn for forts in the painter. Imported models (.obj, or .fbx 7.x binary or text) are copied with their .mtl and pictures into the app\'s fort_models folder; one unit is one tile, as in the game\'s models. The game itself keeps the forts descr_cultures.txt gives it.' }));
    };
    render();
    return box;
  }

  // ---------------------------------------------------------------- pieces tool
  // The Pieces tool (P) moves, adds and removes what stands on the campaign map. Settlements and ports are pixels
  // in map_regions.tga (black and white, one tile each); resources, forts and watchtowers are lines in
  // descr_strat.txt. Spots the game would trip over (a port with no sea beside it, two ports in a region...)
  // are listed in the panel and ringed in red. Changes go into the files with Save, with backups.
  // Permanent stone forts work as in the British Isles campaign: a `fort x y stone_fort_a culture
  // northern_european` line in the region's block of the regions section, and the fort's battle map in
  // data\settlements\north_european\ambient_settlements\stone_fort_a. The battle maps come from the British Isles
  // campaign's own packs\settlements_fix.pack and are copied into the mod on Save when it lacks them.
  const STONE_FORTS = ['stone_fort_a', 'stone_fort_b', 'stone_fort_c', 'stone_fort_d'];
  const STONE_FORT_DIR = ['settlements', 'north_european', 'ambient_settlements'];
  const PC_KINDS = { settlement: 'Settlement', port: 'Port', resource: 'Resource', fort: 'Fort', watchtower: 'Watchtower' };
  let pcMode = 'move';           // move | resource | fort | watchtower | port
  let pcResType = '', pcFortType = 'stone_fort_a';

  // which descr_strat.txt the tool edits: the map's own, unless it is the base map's placeholder and a campaign's
  // file was read instead
  async function pcLoad() {
    const p = state.project, J = M2.join;
    const own = J(p.mapDir, 'descr_strat.txt');
    let file = null;
    if (await host.exists(own)) {
      const isBase = p.loc.baseMapDir && norm(p.mapDir) === norm(p.loc.baseMapDir);
      file = isBase && p.strat && p.strat.file ? p.strat.file : own;
    } else if (p.strat && p.strat.file) file = p.strat.file;
    if (p.pc && p.pc.file && file && norm(p.pc.file) === norm(file) && (p.pc.dirty || p.pc.regDirty)) return; // keep unsaved changes
    const pc = { file, lines: [], eol: '\r\n', dirty: false, regDirty: false, sel: null, ver: 0 };
    if (file) {
      const txt = await host.readText(file);
      pc.eol = /\r\n/.test(txt) ? '\r\n' : '\n';
      pc.lines = txt.split(/\r?\n/);
    }
    p.pc = pc;
    pcStoneStatus();
    if (state.tool === 'pieces') renderPiecesPanel();
  }

  // descr_strat.txt as the tool sees it: resources, forts, watchtowers and characters with their line numbers,
  // and where each region's block in the regions section starts and ends
  function pcParse() {
    const pc = state.project.pc;
    if (pc.parsed && pc.parsed.ver === pc.ver) return pc.parsed;
    const out = { ver: pc.ver, resources: [], forts: [], watchtowers: [], chars: [], blocks: new Map(), regionsAt: -1, faction: null };
    let depth = 0, block = null, faction = null;
    pc.lines.forEach((raw, i) => {
      if (/>>>>\s*start of regions section/i.test(raw)) out.regionsAt = i;
      const l = raw.replace(/;.*$/, '').trim();
      if (!l) return;
      const opens = (l.match(/\{/g) || []).length, closes = (l.match(/\}/g) || []).length;
      if (depth === 0) {
        let m;
        if ((m = l.match(/^faction\s+([^,\s]+)/i))) { faction = m[1]; block = null; }
        else if ((m = l.match(/^region\s+(\S+)/i))) { block = { name: m[1], start: i, end: i }; out.blocks.set(m[1].toLowerCase(), block); faction = null; }
        else if ((m = l.match(STRAT_RES))) out.resources.push({ type: m[1].toLowerCase(), x: +m[2], y: +m[3], line: i });
        else if ((m = l.match(STRAT_FORT))) out.forts.push({ x: +m[1], y: +m[2], words: m[3].toLowerCase().split(/[\s,]+/).filter(Boolean), faction, line: i, block });
        else if ((m = l.match(STRAT_TOWER))) out.watchtowers.push({ x: +m[1], y: +m[2], faction, line: i, block });
        else if (/^character\b/i.test(l)) {
          const x = l.match(/\bx\s+(\d+)/i), y = l.match(/\by\s+(\d+)/i);
          if (x && y) out.chars.push({ x: +x[1], y: +y[1], line: i });
        } else if (/^(settlement|character_record|relative|faction_relationships|core_attitudes|denari|denari_kings_purse|ai_label|superfaction)\b/i.test(l) || /^>>>>/.test(l)) block = null;
        if (block && /^(region|farming_level|famine_threat|fort|watchtower)\b/i.test(l)) block.end = i;
      }
      depth = Math.max(0, depth + opens - closes);
    });
    pc.parsed = out;
    return out;
  }
  // what loadPieces draws from the edited file
  function pcStrat() {
    const t = pcParse();
    return { forts: t.forts, watchtowers: t.watchtowers, resources: t.resources };
  }

  // the tile's ground: water, impassable land or plain land
  function pcGround(tx, ty) {
    const p = state.project, i = (2 * ty + 1) * p.W + 2 * tx + 1;
    const g = p.gtTable[p.gtIdx[i]] || {};
    return { water: !!g.water, impassable: g.key === 'impassable_land', impSea: g.key === 'impassable_sea', label: g.label || '' };
  }
  const pcKey = (tx, ty) => {
    const R = state.project.regions;
    if (!R || tx < 0 || ty < 0 || tx >= R.width || ty >= R.height) return null;
    const o = (ty * R.width + tx) * 4;
    return `${R.data[o]},${R.data[o + 1]},${R.data[o + 2]}`;
  };
  const pcRegionAt = (tx, ty) => state.project.regionByColour.get(pcKey(tx, ty)) || null;
  const pcIsSea = (k) => !!k && k !== '0,0,0' && k !== '255,255,255' && !state.project.regionByColour.has(k);
  // the region a settlement or port pixel belongs to: most of the region pixels around it
  function pcRegionOf(tx, ty, orthoOnly) {
    const n = new Map();
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if ((!dx && !dy) || (orthoOnly && dx && dy)) continue;
      const r = pcRegionAt(tx + dx, ty + dy);
      if (r) n.set(r, (n.get(r) || 0) + 1);
    }
    let best = null, bn = 0;
    for (const [r, c] of n) if (c > bn) { best = r; bn = c; }
    return best;
  }

  // everything the tool can grab, in tiles from the top left
  function pcItems() {
    const p = state.project, pc = p.pc, R = p.regions;
    if (!R) return [];
    if (pc.items && pc.items.ver === pc.ver) return pc.items.list;
    const list = [], Ht = R.height;
    for (let ty = 0; ty < R.height; ty++) for (let tx = 0; tx < R.width; tx++) {
      const o = (ty * R.width + tx) * 4, r = R.data[o], g = R.data[o + 1], b = R.data[o + 2];
      if (r === 0 && g === 0 && b === 0) list.push({ kind: 'settlement', tx, ty, region: pcRegionOf(tx, ty) });
      else if (r === 255 && g === 255 && b === 255) list.push({ kind: 'port', tx, ty, region: pcRegionOf(tx, ty, true) || pcRegionOf(tx, ty) });
    }
    if (pc.file) {
      const t = pcParse();
      for (const e of t.resources) list.push({ kind: 'resource', tx: e.x, ty: Ht - 1 - e.y, type: e.type, line: e.line });
      for (const e of t.forts) list.push({ kind: 'fort', tx: e.x, ty: Ht - 1 - e.y, type: e.words[0] || '', line: e.line, block: e.block });
      for (const e of t.watchtowers) list.push({ kind: 'watchtower', tx: e.x, ty: Ht - 1 - e.y, line: e.line, block: e.block });
    }
    pc.items = { ver: pc.ver, list };
    return list;
  }
  const pcSame = (a, b) => a && b && a.kind === b.kind && a.tx === b.tx && a.ty === b.ty;
  const pcName = (it) => {
    const reg = it.region || pcRegionAt(it.tx, it.ty);
    const where = reg ? ` (${(it.kind === 'settlement' && reg.settlement ? reg.settlement : reg.name).replace(/_/g, ' ')})` : '';
    const what = it.kind === 'resource' ? `Resource ${it.type.replace(/_/g, ' ')}` : it.kind === 'fort' ? `Fort ${it.type.replace(/_/g, ' ')}` : PC_KINDS[it.kind];
    return `${what}${where}`;
  };

  // spots the game would trip over, each { item?, region?, text }
  function pcProblems() {
    const p = state.project, pc = p.pc, R = p.regions;
    if (!R) return [];
    if (pc.probs && pc.probs.ver === pc.ver && pc.probs.stone === pc.stone) return pc.probs.list;
    const items = pcItems(), list = [], Ht = R.height;
    const bad = (item, text) => list.push({ item, text });
    const setBy = new Map(), portBy = new Map(), onTile = new Map();
    for (const it of items) {
      const k = `${it.tx},${it.ty}`;
      if (it.kind !== 'settlement' && it.kind !== 'port') (onTile.get(k) || onTile.set(k, []).get(k)).push(it);
    }
    for (const it of items) {
      const { tx, ty } = it, g = (tx >= 0 && ty >= 0 && tx < R.width && ty < Ht) ? pcGround(tx, ty) : null;
      if (!g) { bad(it, `${pcName(it)} is off the map.`); continue; }
      if (it.kind === 'settlement') {
        if (!it.region) bad(it, 'Settlement: not inside any region.');
        else (setBy.get(it.region) || setBy.set(it.region, []).get(it.region)).push(it);
        if (g.water) bad(it, `${pcName(it)} stands on water.`);
        else if (g.impassable) bad(it, `${pcName(it)} stands on impassable land.`);
      } else if (it.kind === 'port') {
        const regs = new Set();
        let seaO = 0, seaD = 0, seaLand = 0, seaImp = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const k = pcKey(tx + dx, ty + dy);
          if (!k) continue;
          const ortho = !dx || !dy;
          if (ortho && p.regionByColour.has(k)) regs.add(p.regionByColour.get(k));
          if (pcIsSea(k)) {
            const sg = pcGround(tx + dx, ty + dy);
            if (ortho) { if (sg.impSea) seaImp++; else if (sg.water) seaO++; else seaLand++; } else if (sg.water && !sg.impSea) seaD++;
          }
        }
        const name = pcName(it);
        if (!regs.size) bad(it, `${name}: no land of any region beside it.`);
        else if (regs.size > 1) bad(it, `${name}: it touches ${regs.size} regions (${[...regs].map((r) => r.name.replace(/_/g, ' ')).join(', ')}), so the game may give it to the wrong one.`);
        if (it.region) (portBy.get(it.region) || portBy.set(it.region, []).get(it.region)).push(it);
        if (g.water) bad(it, `${name} stands on water; it goes on the last land tile by the sea.`);
        else if (g.impassable) bad(it, `${name} stands on impassable land.`);
        if (!seaO) {
          const tail = pcPortSpot(it) ? '' : ' Its region has no land by the sea, so delete it.';
          if (seaImp) bad(it, `${name}: the only sea beside it is impassable sea.${tail}`);
          else if (seaLand) bad(it, `${name}: the tile map_regions.tga marks as sea beside it is land in the ground types.${tail}`);
          else if (seaD) bad(it, `${name}: the sea only touches it corner to corner; it needs sea directly north, south, east or west.${tail}`);
          else bad(it, `${name}: no sea beside it.${tail}`);
        }
      } else {
        const name = pcName(it);
        if (g.water) bad(it, `${name} stands on water.`);
        else if (g.impassable) bad(it, `${name} stands on impassable land.`);
        const k = pcKey(tx, ty);
        if (k === '0,0,0' || k === '255,255,255') bad(it, `${name} is on a ${k === '0,0,0' ? 'settlement' : 'port'} tile.`);
        const here = onTile.get(`${tx},${ty}`);
        if (here.length > 1 && here[0] !== it) bad(it, `${name} shares its tile with ${pcName(here[0]).toLowerCase()}.`);
        if (it.kind === 'fort' && STONE_FORTS.includes(it.type) && pc.stone === 'missing') bad(it, `${name}: its battle map is not in this mod, and the British Isles campaign's packs\\settlements_fix.pack was not found to copy it from.`);
      }
    }
    for (const [r, l] of setBy) if (l.length > 1) for (const it of l.slice(1)) bad(it, `Second settlement in ${r.name.replace(/_/g, ' ')}; a region has one.`);
    for (const [r, l] of portBy) {
      if (l.length > 1) for (const it of l.slice(1)) bad(it, `Second port in ${r.name.replace(/_/g, ' ')}; a region has one.`);
      if (!setBy.has(r)) bad(l[0], `${pcName(l[0])}: its region has no settlement.`);
    }
    // regions on the map without a settlement
    const present = new Set();
    for (let i = 0; i < R.width * R.height; i++) { const o = i * 4; const r = p.regionByColour.get(`${R.data[o]},${R.data[o + 1]},${R.data[o + 2]}`); if (r) present.add(r); }
    for (const r of present) if (!setBy.has(r)) list.push({ region: r, text: `${r.name.replace(/_/g, ' ')} has no settlement.` });
    pc.probs = { ver: pc.ver, stone: pc.stone, list };
    return list;
  }

  // does the mod have the stone fort battle maps, or can they be copied from the British Isles campaign?
  function stoneForts() {
    const loc = state.project.loc, J = M2.join;
    const gameRoot = loc.gameDataDir ? M2.dirname(loc.gameDataDir) : null;
    return {
      dir: J(loc.dataDir, ...STONE_FORT_DIR),
      packs: gameRoot ? [J(gameRoot, 'mods', 'british_isles', 'packs', 'settlements_fix.pack')] : [],
    };
  }
  async function pcStoneStatus() {
    const p = state.project, pc = p.pc, sf = stoneForts();
    const files = STONE_FORTS.map((t) => M2.join(sf.dir, t, t + '.world'));
    const st = await host.statMany([...files, ...sf.packs]);
    pc.stone = st.slice(0, files.length).every(Boolean) ? 'installed' : st.slice(files.length).some(Boolean) ? 'pack' : 'missing';
    pc.stoneHave = STONE_FORTS.filter((t, i) => st[i]);
    if (state.tool === 'pieces') renderPiecesPanel();
  }
  // copies the battle maps of the stone forts used on the map into the mod; returns the number of files written
  async function installStoneForts(types) {
    const p = state.project, pc = p.pc, sf = stoneForts();
    const need = types.filter((t) => !(pc.stoneHave || []).includes(t));
    if (!need.length) return 0;
    const st = await host.statMany(sf.packs);
    const packFile = sf.packs.find((f, i) => st[i]);
    if (!packFile) throw new Error('the British Isles campaign\'s packs\\settlements_fix.pack was not found');
    const pk = Pack.open(await host.read(packFile));
    let n = 0;
    for (const f of pk.files) {
      const m = f.name.replace(/\\/g, '/').match(/\/settlements\/north_european\/ambient_settlements\/(stone_fort_[a-d])\/(.+)$/i);
      if (!m || !need.includes(m[1].toLowerCase())) continue;
      const target = M2.join(sf.dir, m[1].toLowerCase(), ...m[2].split('/'));
      state.ownWrites.set(norm(target), Date.now());
      await host.writeFile(target, pk.read(f));
      n++;
    }
    await pcStoneStatus();
    return n;
  }

  // ---- changes (each one undo step)
  function pcCommit(before, px, label) {
    const p = state.project, pc = p.pc;
    const after = pc.lines.slice();
    const linesChanged = before.length !== after.length || before.some((l, i) => l !== after[i]);
    if (linesChanged) pc.dirty = true;
    if (px.length) { pc.regDirty = true; }
    state.undo.push({ t: new Map(), pc: { before, after: linesChanged ? after : null, px, label } });
    state.redo = [];
    pcChanged(!!px.length);
  }
  function pcApply(rec, undo) {
    const p = state.project, pc = p.pc, R = p.regions;
    if (rec.after) { pc.lines = (undo ? rec.before : rec.after).slice(); pc.dirty = true; }
    for (const [i, a, b] of rec.px) { const c = undo ? a : b; R.data.set(c, i * 4); }
    if (rec.px.length) pc.regDirty = true;
    pcChanged(!!rec.px.length);
  }
  let pcRedrawTimer = 0;
  function pcChanged(regions) {
    const p = state.project, pc = p.pc;
    pc.ver++;
    if (regions) { view.setRegions(p.regions.width, p.regions.height, p.regions.data); farmRefresh(); }
    if (pc.sel && !pcItems().some((it) => pcSame(it, pc.sel))) pc.sel = null;
    updateButtons();
    renderPiecesPanel();
    drawOverlay();
    clearTimeout(pcRedrawTimer);
    pcRedrawTimer = setTimeout(() => loadPieces().catch((e) => console.warn(e)), 30);
  }
  const pcPixel = (tx, ty, rgb) => {
    const R = state.project.regions, i = ty * R.width + tx;
    const a = R.data.slice(i * 4, i * 4 + 4), b = new Uint8Array([rgb[0], rgb[1], rgb[2], a[3] || 255]);
    R.data.set(b, i * 4);
    return [i, a, b];
  };
  const pcLine = (it) => state.project.pc.lines[it.line];
  const setXY = (line, kw, x, y) => line.replace(new RegExp(`^(\\s*${kw}\\s+${kw === 'resource' ? '[^,\\s]+\\s*,?\\s*' : ''})(\\d+)(\\s*,?\\s*)(\\d+)`, 'i'), `$1${x}$3${y}`);
  // the region's block in the regions section, added at the end of the file when missing; returns the line
  // after which a new line goes
  function pcBlockEnd(reg) {
    const pc = state.project.pc, t = pcParse();
    const b = t.blocks.get(reg.name.toLowerCase());
    if (b) return b.end;
    if (t.regionsAt < 0) { pc.lines.push(';;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;', '; >>>> start of regions section <<<<', ''); }
    while (pc.lines.length && !pc.lines[pc.lines.length - 1].trim()) pc.lines.pop();
    pc.lines.push('', `region ${reg.name}`, '', 'farming_level 0', 'famine_threat 0');
    pc.ver++;
    return pc.lines.length - 1;
  }
  function pcInsertInBlock(reg, text) {
    const pc = state.project.pc, at = pcBlockEnd(reg);
    pc.lines.splice(at + 1, 0, text);
    pc.ver++;
  }

  // batch: { before, px } to gather several moves into one undo step (committed by the caller)
  function pcMove(it, tx, ty, batch) {
    const p = state.project, pc = p.pc, R = p.regions, Ht = R.height;
    if (tx === it.tx && ty === it.ty) return;
    if (tx < 0 || ty < 0 || tx >= R.width || ty >= Ht) return;
    const before = batch ? batch.before : pc.lines.slice(), px = batch ? batch.px : [];
    if (it.kind === 'settlement' || it.kind === 'port') {
      const to = pcRegionAt(tx, ty);
      if (!to) { toast(`${PC_KINDS[it.kind]}s go on a region's land in map_regions.tga, not on the sea or another marker.`, 'err', 6000); return; }
      const from = it.region;
      if (it.kind === 'settlement' && from && to !== from) { toast(`A settlement has to stay inside its own region (${from.name.replace(/_/g, ' ')}).`, 'err', 6000); return; }
      px.push(pcPixel(it.tx, it.ty, (from || to).rgb), pcPixel(tx, ty, it.kind === 'settlement' ? [0, 0, 0] : [255, 255, 255]));
      if (it.kind === 'settlement' && pc.file) {
        // characters standing in the settlement move with it
        const ox = it.tx, oy = Ht - 1 - it.ty, nx = tx, ny = Ht - 1 - ty;
        for (const c of pcParse().chars) if (c.x === ox && c.y === oy) pc.lines[c.line] = pc.lines[c.line].replace(/\bx\s+\d+/i, `x ${nx}`).replace(/\by\s+\d+/i, `y ${ny}`);
      }
    } else {
      const kw = it.kind, y = Ht - 1 - ty;
      const line = setXY(pcLine(it), kw, tx, y);
      const to = pcRegionAt(tx, ty);
      if (it.block && to && it.block.name.toLowerCase() !== to.name.toLowerCase()) {
        // forts and watchtowers listed under a region follow the region they now stand in
        pc.lines.splice(it.line, 1);
        pc.ver++;
        pcInsertInBlock(to, line);
      } else pc.lines[it.line] = line;
    }
    pc.ver++;
    if (batch) return;
    pc.sel = { ...it, tx, ty };
    pcCommit(before, px);
  }
  // a good spot for a port: the nearest tile of its own region that is land, has sea (not impassable) directly
  // north, south, east or west, and touches no other region
  function pcPortSpot(it) {
    const p = state.project, R = p.regions, reg = it.region;
    if (!reg) return null;
    const W = R.width, H = R.height, seen = new Uint8Array(W * H);
    const ok = (x, y) => {
      if (pcRegionAt(x, y) !== reg) return false;
      const g = pcGround(x, y);
      if (g.water || g.impassable) return false;
      let sea = false;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const k = pcKey(x + dx, y + dy);
        if (!k) continue;
        const r = p.regionByColour.get(k);
        if (r && r !== reg) return false;
        if (k === '0,0,0' || k === '255,255,255') return false;
        if (pcIsSea(k)) { const sg = pcGround(x + dx, y + dy); if (sg.water && !sg.impSea) sea = true; }
      }
      return sea;
    };
    let q = [[it.tx, it.ty]];
    seen[it.ty * W + it.tx] = 1;
    for (let d = 0; d < 40 && q.length; d++) {
      const next = [];
      let best = null, bd = 1e9;
      for (const [x, y] of q) {
        if (ok(x, y)) { const dd = Math.hypot(x - it.tx, y - it.ty); if (dd < bd) { bd = dd; best = { tx: x, ty: y }; } }
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H || seen[ny * W + nx]) continue;
          seen[ny * W + nx] = 1;
          if (pcRegionAt(nx, ny) === reg) next.push([nx, ny]);
        }
      }
      if (best) return best;
      q = next;
    }
    return null;
  }
  // ports with no usable sea beside them, moved to the nearest good spot in their region (one undo step)
  const PC_SEA_PROBLEM = /no sea beside it|corner to corner|is land in the ground types|impassable sea|stands on water|stands on impassable/;
  function pcFixPorts(only) {
    const p = state.project, pc = p.pc;
    const ports = only ? [only] : [...new Map(pcProblems().filter((q) => q.item && q.item.kind === 'port' && PC_SEA_PROBLEM.test(q.text)).map((q) => [`${q.item.tx},${q.item.ty}`, q.item])).values()];
    const batch = { before: pc.lines.slice(), px: [] };
    let moved = 0, stuck = 0;
    for (const it of ports) {
      const cur = pcItems().find((x) => pcSame(x, it));
      const to = cur && pcPortSpot(cur);
      if (!to) { stuck++; continue; }
      pcMove(cur, to.tx, to.ty, batch);
      moved++;
      if (only) pc.sel = { ...cur, tx: to.tx, ty: to.ty };
    }
    if (moved) pcCommit(batch.before, batch.px);
    toast(moved ? `Moved ${moved} port${moved > 1 ? 's' : ''} to the coast${stuck ? `; ${stuck} had no good spot in their region` : ''} (Ctrl+Z undoes it).` : 'No good spot by the sea was found in the region.', moved ? 'ok' : 'err', 5000);
  }
  function pcDeleteMany(list) {
    const p = state.project, pc = p.pc, px = [], before = pc.lines.slice();
    for (const it of list) if (it.kind === 'port') px.push(pcPixel(it.tx, it.ty, (it.region || pcRegionOf(it.tx, it.ty)).rgb));
    pc.ver++; pc.sel = null;
    if (px.length) pcCommit(before, px);
    toast(`Deleted ${px.length} port${px.length > 1 ? 's' : ''} (Ctrl+Z undoes it).`, 'ok', 4000);
  }
  function pcDelete(it) {
    const p = state.project, pc = p.pc;
    if (it.kind === 'settlement') { toast('Every region needs its settlement, so it can only be moved.', '', 5000); return; }
    const before = pc.lines.slice(), px = [];
    if (it.kind === 'port') px.push(pcPixel(it.tx, it.ty, (it.region || pcRegionOf(it.tx, it.ty)).rgb));
    else pc.lines.splice(it.line, 1);
    pc.ver++;
    pc.sel = null;
    pcCommit(before, px);
  }
  function pcAdd(tx, ty) {
    const p = state.project, pc = p.pc, R = p.regions, Ht = R.height;
    if (tx < 0 || ty < 0 || tx >= R.width || ty >= Ht) return;
    const reg = pcRegionAt(tx, ty);
    const before = pc.lines.slice(), px = [];
    const y = Ht - 1 - ty;
    if (pcMode === 'port') {
      if (!reg) { toast('A port goes on a region\'s land tile next to the sea.', 'err', 5000); return; }
      px.push(pcPixel(tx, ty, [255, 255, 255]));
      pc.sel = { kind: 'port', tx, ty };
    } else {
      if (!pc.file) { toast('This map has no descr_strat.txt to add it to.', 'err', 6000); return; }
      if (pcMode === 'resource') {
        if (!pcResType) { toast('Pick a resource in the panel first.', '', 4000); return; }
        const t = pcParse();
        let at = t.resources.length ? t.resources[t.resources.length - 1].line : pc.lines.findIndex((l) => />>>>\s*start of resources section/i.test(l));
        if (at < 0) at = pc.lines.findIndex((l) => /^\s*(start_date|timescale)\b/i.test(l));
        pc.lines.splice(at + 1, 0, `resource\t${pcResType},\t${tx}, ${y}`);
        pc.sel = { kind: 'resource', tx, ty };
      } else if (pcMode === 'fort' || pcMode === 'watchtower') {
        if (!reg) { toast(`A ${pcMode} goes on a region's land.`, 'err', 5000); return; }
        pcInsertInBlock(reg, pcMode === 'fort' ? `fort\t${tx} ${y} ${pcFortType} culture northern_european` : `watchtower\t${tx} ${y}`);
        pc.sel = { kind: pcMode, tx, ty };
      } else return;
    }
    pc.ver++;
    pcCommit(before, px);
  }

  // ---- pointer
  function pcScreen(tx, ty) {
    const x = tx * 2 + 1, y = ty * 2 + 1;
    return is3D() ? view.project3D(x, y, view.heightAt(x, y)) : view.toScreen(x, y);
  }
  function pcHit(sx, sy) {
    let best = null, bd = 14;
    const order = { resource: 0, fort: 0, watchtower: 0, port: 1, settlement: 2 };
    for (const it of pcItems()) {
      const s = pcScreen(it.tx, it.ty);
      if (!s) continue;
      const d = Math.hypot(s.x - sx, s.y - sy) + order[it.kind] * 0.5;
      if (d < bd) { bd = d; best = it; }
    }
    return best;
  }
  const pcTileAt = (m) => ({ tx: Math.floor(m.x / 2), ty: Math.floor(m.y / 2) });
  function pcPointerDown(e) {
    const p = state.project, pc = p.pc;
    if (!pc || !p.regions) return null;
    const hit = pcHit(e.offsetX, e.offsetY);
    if (hit && (pcMode === 'move' || !e.shiftKey)) {
      pc.sel = hit; pc.nameReg = null;
      renderPiecesPanel();
      return { type: 'piece', item: hit, cur: { tx: hit.tx, ty: hit.ty } };
    }
    const m = screenToMap(e.offsetX, e.offsetY);
    if (!m) return null;
    const t = pcTileAt(m);
    if (pcMode === 'move') {
      const nh = nameLabelAt(e.offsetX, e.offsetY);
      pc.sel = null; pc.nameReg = null;
      if (nh) {
        const st = pcItems().find((x) => x.kind === 'settlement' && x.region === nh.reg);
        if (st) pc.sel = st; else pc.nameReg = nh.reg;
      }
      renderPiecesPanel(); drawOverlay();
      // after the click is over (the canvas would take the focus back)
      if (nh) setTimeout(() => { const inp = $(nh.kind === 'city' && $('#nmSettlement') ? '#nmSettlement' : '#nmRegion'); if (inp) { inp.focus(); inp.select(); } }, 150);
      return null;
    }
    pcAdd(t.tx, t.ty);
    return null;
  }
  function pcPointerMove(pt, sx, sy) {
    const m = screenToMap(sx, sy);
    if (m) pt.cur = pcTileAt(m);
  }
  function pcPointerUp(pt) {
    if (pt.cur && (pt.cur.tx !== pt.item.tx || pt.cur.ty !== pt.item.ty)) pcMove(pt.item, pt.cur.tx, pt.cur.ty);
    else drawOverlay();
  }

  // ---- drawing the markers
  // Land bridges: map_features.tga marks the straits armies can walk across in green (0,255,0), a line of
  // tiles from one shore over the sea to the other (the base game has nine). Each
  // one gets a red marker on its sea tile, in the Features view, with the river overlay on, or in the Rivers tool.
  function landBridges() {
    const p = state.project, F = p && p.features;
    if (!F) return [];
    const W = F.width, H = F.height, d = F.data, green = (i) => d[i * 4] < 30 && d[i * 4 + 1] > 225 && d[i * 4 + 2] < 30;
    // which tiles are green, as a key (a quick pass; the groups are only worked out again when it changes)
    let key = 0;
    for (let i = 1, n = W * H * 4; i < n; i += 4) if (d[i] > 225 && d[i - 1] < 30 && d[i + 1] < 30) key = (key * 31 + i) | 0;
    if (p.lbCache && p.lbCache.F === F && p.lbCache.key === key) return p.lbCache.list;
    const seen = new Uint8Array(W * H), list = [];
    for (let i = 0; i < W * H; i++) {
      if (seen[i] || !green(i)) continue;
      const comp = [i]; seen[i] = 1;
      for (let h = 0; h < comp.length; h++) {
        const x = comp[h] % W, y = (comp[h] / W) | 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx, ny = y + dy, j = ny * W + nx;
          if (nx >= 0 && ny >= 0 && nx < W && ny < H && !seen[j] && green(j)) { seen[j] = 1; comp.push(j); }
        }
      }
      const sea = comp.filter((j) => rvSeaTile(j));
      const pick = sea.length ? sea : comp;
      const cx = pick.reduce((a, j) => a + (j % W), 0) / pick.length, cy = pick.reduce((a, j) => a + ((j / W) | 0), 0) / pick.length;
      list.push({ x: 2 * cx + 1, y: 2 * cy + 1, n: comp.length });
    }
    p.lbCache = { F, key, list };
    return list;
  }
  function rvSeaTile(i) {
    const p = state.project, w = p.features.width, tx = i % w, ty = (i / w) | 0;
    const v = (2 * ty + 1) * p.W + 2 * tx + 1;
    return v < p.gtIdx.length && !!p.gtTable[p.gtIdx[v]].water;
  }
  function drawLandBridges() {
    const p = state.project;
    if (!p || !p.features || !(view.opts.mode === 7 || S().rivers || state.tool === 'rivers')) return;
    const list = landBridges();
    if (!list.length) return;
    const scr = (x, y) => (is3D() ? view.project3D(x, y, view.heightAt(Math.max(0, Math.min(x, p.W - 1)), Math.max(0, Math.min(y, p.H - 1)))) : view.toScreen(x, y));
    const R = 8;
    let hover = null;
    octx.save();
    for (const b of list) {
      const s = scr(b.x, b.y);
      if (!s || s.x < -20 || s.y < -20 || s.x > overlay.clientWidth + 20 || s.y > overlay.clientHeight + 20) continue;
      // a red disc with a white rim and a small white bridge (an arch over a line)
      octx.beginPath(); octx.arc(s.x, s.y, R, 0, Math.PI * 2);
      octx.fillStyle = '#e02424'; octx.fill();
      octx.lineWidth = 2; octx.strokeStyle = '#fff'; octx.stroke();
      octx.lineWidth = 1.6;
      octx.beginPath(); octx.moveTo(s.x - 5, s.y + 2.5); octx.lineTo(s.x + 5, s.y + 2.5); octx.stroke();
      octx.beginPath(); octx.arc(s.x, s.y + 2.5, 3.6, Math.PI, 0); octx.stroke();
      if (lastMouse && state.tool !== 'rivers' && Math.hypot(lastMouse.x - s.x, lastMouse.y - s.y) <= R + 2) hover = s; // the Rivers tool labels its own cursor
    }
    if (hover) {
      const t = 'Land bridge: armies can walk across here';
      octx.font = '12px Segoe UI';
      const w = octx.measureText(t).width + 12;
      octx.fillStyle = 'rgba(20,22,26,.9)'; octx.fillRect(hover.x + 12, hover.y - 26, w, 20);
      octx.fillStyle = '#fff'; octx.fillText(t, hover.x + 18, hover.y - 12);
    }
    octx.restore();
  }

  function drawPieceMarks() {
    const p = state.project;
    if (!p || !p.pc || !p.regions || state.tool !== 'pieces') return;
    const pc = p.pc, probs = pcProblems();
    const badSet = new Set(probs.filter((q) => q.item).map((q) => `${q.item.kind},${q.item.tx},${q.item.ty}`));
    const z = is3D() ? 1 : Math.min(1.4, Math.max(0.55, view.view.scale / ((window.devicePixelRatio || 1) * 2)));
    const r = 6 * z + 2;
    const dragging = pointer && pointer.type === 'piece' ? pointer : null;
    octx.save();
    octx.lineWidth = 1.5;
    for (const it of pcItems()) {
      let { tx, ty } = it;
      if (dragging && pcSame(dragging.item, it)) ({ tx, ty } = dragging.cur);
      const s = pcScreen(tx, ty);
      if (!s || s.x < -20 || s.y < -20 || s.x > overlay.clientWidth + 20 || s.y > overlay.clientHeight + 20) continue;
      octx.beginPath();
      if (it.kind === 'settlement') { octx.rect(s.x - r, s.y - r, 2 * r, 2 * r); octx.fillStyle = 'rgba(20,20,20,.85)'; octx.strokeStyle = '#fff'; }
      else if (it.kind === 'port') { octx.arc(s.x, s.y, r, 0, Math.PI * 2); octx.fillStyle = 'rgba(40,120,230,.9)'; octx.strokeStyle = '#fff'; }
      else if (it.kind === 'resource') { octx.moveTo(s.x, s.y - r); octx.lineTo(s.x + r, s.y); octx.lineTo(s.x, s.y + r); octx.lineTo(s.x - r, s.y); octx.closePath(); octx.fillStyle = 'rgba(240,200,40,.9)'; octx.strokeStyle = '#332'; }
      else if (it.kind === 'fort') { octx.rect(s.x - r * 0.8, s.y - r * 0.8, 1.6 * r, 1.6 * r); octx.fillStyle = 'rgba(170,170,160,.95)'; octx.strokeStyle = '#222'; }
      else { octx.moveTo(s.x, s.y - r); octx.lineTo(s.x + r * 0.85, s.y + r * 0.7); octx.lineTo(s.x - r * 0.85, s.y + r * 0.7); octx.closePath(); octx.fillStyle = 'rgba(200,140,90,.95)'; octx.strokeStyle = '#222'; }
      octx.fill(); octx.stroke();
      if (badSet.has(`${it.kind},${it.tx},${it.ty}`)) {
        octx.beginPath(); octx.arc(s.x, s.y, r + 5, 0, Math.PI * 2);
        octx.strokeStyle = '#ff3b30'; octx.lineWidth = 2.5; octx.stroke(); octx.lineWidth = 1.5;
      }
      if (pcSame(pc.sel, it)) {
        octx.beginPath(); octx.arc(s.x, s.y, r + 9, 0, Math.PI * 2);
        octx.setLineDash([3, 3]); octx.strokeStyle = '#ffe9a8'; octx.lineWidth = 2; octx.stroke(); octx.setLineDash([]); octx.lineWidth = 1.5;
      }
    }
    // what the click adds, under the cursor
    if (!dragging && lastMouse && pcMode !== 'move') {
      octx.fillStyle = '#fff'; octx.font = '12px Segoe UI';
      const what = pcMode === 'resource' ? (pcResType || 'resource').replace(/_/g, ' ') : pcMode === 'fort' ? pcFortType.replace(/_/g, ' ') : pcMode;
      octx.fillText(`add ${what}`, lastMouse.x + 10, lastMouse.y - 10);
    }
    octx.restore();
  }

  // ---- the panel
  function pcFocus(it, region) {
    const p = state.project;
    let tx, ty;
    if (it) ({ tx, ty } = it);
    else {
      const R = p.regions;
      for (let i = 0; i < R.width * R.height && tx == null; i++) { const o = i * 4; if (p.regionByColour.get(`${R.data[o]},${R.data[o + 1]},${R.data[o + 2]}`) === region) { tx = i % R.width; ty = (i / R.width) | 0; } }
    }
    if (tx == null) return;
    if (it) p.pc.sel = it;
    if (!is3D()) {
      const v = view.view;
      v.scale = Math.max(v.scale, 6);
      v.x = -(tx * 2 + 1) * v.scale + view.canvas.width / 2; v.y = -(ty * 2 + 1) * v.scale + view.canvas.height / 2;
      view.dirty = true; updateZoom();
    }
    renderPiecesPanel(); drawOverlay();
  }
  function renderPiecesPanel() {
    const box = $('#piecesPanel');
    if (!box) return;
    box.hidden = state.tool !== 'pieces' || !state.project;
    if (box.hidden) return;
    const p = state.project, pc = p.pc;
    box.textContent = '';
    box.append(el('div', { class: 'cp-head' },
      el('b', { text: 'Pieces' }),
      el('span', { class: 'cp-help', text: 'Drag to move. Click a settlement (or a name on the map) to rename it. Pick something to add, then click the map.' }),
      el('button', { class: 'ramp-x', title: 'Back to the brush', text: '×', onclick: () => setTool('brush') })));
    if (!pc || !p.regions) { box.append(el('div', { class: 'cp-note', text: 'This map has no map_regions.tga.' })); return; }
    const seg = el('div', { class: 'seg pc-modes' });
    for (const [m, t, tip] of [['move', 'Move', 'Drag settlements, ports, resources, forts and watchtowers'], ['resource', 'Resource', 'Click the map to add the resource picked below'],
      ['fort', 'Stone fort', 'Click a region\'s land to add a permanent stone fort, as in the British Isles campaign'], ['watchtower', 'Watchtower', 'Click a region\'s land to add a watchtower'], ['port', 'Port', 'Click a land tile by the sea to add a port (one a region)']]) {
      seg.append(el('button', { text: t, title: tip, class: pcMode === m ? 'active' : '', onclick: () => { pcMode = m; renderPiecesPanel(); drawOverlay(); } }));
    }
    box.append(seg);
    if (pcMode === 'resource') {
      const sel = el('select', { class: 'cp-sel' });
      const types = p.resTypes || [];
      if (!pcResType || !types.includes(pcResType)) pcResType = types[0] || '';
      for (const t of types) sel.append(el('option', { value: t, text: t.replace(/_/g, ' ') }));
      sel.value = pcResType;
      sel.addEventListener('change', () => { pcResType = sel.value; drawOverlay(); });
      box.append(el('div', { class: 'cp-target' }, el('label', { text: 'Resource' }), sel));
    } else if (pcMode === 'fort') {
      const sel = el('select', { class: 'cp-sel' });
      for (const t of STONE_FORTS) sel.append(el('option', { value: t, text: t.replace(/_/g, ' ') + ((pc.stoneHave || []).includes(t) ? '' : ' (copied in on Save)') }));
      sel.value = pcFortType;
      sel.addEventListener('change', () => { pcFortType = sel.value; drawOverlay(); });
      box.append(el('div', { class: 'cp-target' }, el('label', { text: 'Fort' }), sel));
      box.append(el('div', { class: 'cp-note', text: 'Fort model the painter draws (the game keeps its own):' }), fortModelBox(true));
      box.append(el('div', { class: 'cp-note', text: pc.stone === 'installed' ? 'The mod has the stone fort battle maps.'
        : pc.stone === 'pack' ? 'Save copies the fort\'s battle map from the British Isles campaign into this mod (data\\settlements\\north_european\\ambient_settlements).'
          : 'The British Isles campaign\'s battle maps for these forts were not found, so the game could not load the fort battle.' }));
    }
    // names of the selected settlement's region (or of a region picked by clicking its name)
    {
      const it = pc.sel && pcItems().find((x) => pcSame(x, pc.sel));
      const reg = it && it.kind === 'settlement' ? it.region : !it ? pc.nameReg : null;
      if (reg && p.placeNames) {
        const row = (label, id, key) => {
          const inp = el('input', { type: 'text', id, class: 'nm-input', value: placeName(key), title: `${key} in descr_regions.txt (that stays the same)`, spellcheck: false });
          inp.addEventListener('change', () => renamePlace(key, inp.value));
          inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') inp.blur(); if (e.key === 'Escape') { inp.value = placeName(key); inp.blur(); } });
          return el('div', { class: 'cp-target nm-row' }, el('label', { text: label }), inp);
        };
        const nb = el('div', { class: 'nm-box' });
        if (reg.settlement) nb.append(row('Settlement', 'nmSettlement', reg.settlement));
        nb.append(row('Region', 'nmRegion', reg.name));
        nb.append(el('div', { class: 'cp-note', text: `Renames them as the game shows them. Save writes ${M2.basename(p.placeNames.modFile)} in the mod's data\\text folder${p.placeNames.modBin ? ' and moves its .strings.bin into the backup so the game builds it again' : ''}.` }));
        box.append(nb);
      }
    }
    // the selected piece
    if (pc.sel) {
      const it = pcItems().find((x) => pcSame(x, pc.sel));
      if (it) {
        const Ht = p.regions.height;
        box.append(el('div', { class: 'cp-foot' },
          el('span', { text: `${pcName(it)} · tile ${it.tx}, ${Ht - 1 - it.ty}` }),
          it.kind === 'settlement' ? null : el('button', { text: 'Delete', title: 'Remove it (Delete key)', onclick: () => pcDelete(it) })));
      }
    }
    // problems
    const probs = pcProblems();
    const list = el('div', { class: 'pc-probs' });
    if (!probs.length) list.append(el('div', { class: 'pc-ok', text: 'No problems found with the ports, settlements and pieces.' }));
    else {
      list.append(el('div', { class: 'pc-count', text: `${probs.length} problem${probs.length > 1 ? 's' : ''} the game may trip over:` }));
      const nSea = new Set(probs.filter((q) => q.item && q.item.kind === 'port' && PC_SEA_PROBLEM.test(q.text) && !/so delete it/.test(q.text)).map((q) => `${q.item.tx},${q.item.ty}`)).size;
      const inland = [...new Map(probs.filter((q) => q.item && q.item.kind === 'port' && /so delete it/.test(q.text)).map((q) => [`${q.item.tx},${q.item.ty}`, q.item])).values()];
      if (inland.length) list.append(el('button', { class: 'pc-fixall', text: `Delete the ${inland.length} port${inland.length > 1 ? 's' : ''} in regions with no coast`, title: 'One undo step', onclick: () => pcDeleteMany(inland) }));
      if (nSea) list.append(el('button', { class: 'pc-fixall', text: `Move the ${nSea} port${nSea > 1 ? 's' : ''} without sea to the coast`, title: 'Each goes to the nearest land tile of its own region with sea directly north, south, east or west (one undo step)', onclick: () => pcFixPorts() }));
      for (const q of probs.slice(0, 60)) {
        const row = el('div', { class: 'pc-row' }, el('button', { class: 'pc-prob', text: q.text, title: 'Show it on the map', onclick: () => pcFocus(q.item, q.region) }));
        if (q.item && q.item.kind === 'port' && /so delete it/.test(q.text)) row.append(el('button', { class: 'pc-fix', text: 'Delete', title: 'Remove this port', onclick: () => { const it = pcItems().find((x) => pcSame(x, q.item)); if (it) pcDelete(it); } }));
        else if (q.item && q.item.kind === 'port' && PC_SEA_PROBLEM.test(q.text)) row.append(el('button', { class: 'pc-fix', text: 'Fix', title: 'Move this port to the nearest good spot by the sea in its region', onclick: () => pcFixPorts(q.item) }));
        list.append(row);
      }
      if (probs.length > 60) list.append(el('div', { class: 'cp-note', text: `…and ${probs.length - 60} more.` }));
    }
    box.append(list);
    const where = pc.file ? `${M2.basename(M2.dirname(pc.file))}\\descr_strat.txt` : 'no descr_strat.txt (resources, forts and watchtowers cannot be added)';
    box.append(el('div', { class: 'cp-note', text: `Save writes map_regions.tga and ${where}, with backups. The game rebuilds map.rwm after map_regions.tga changes.` }));
  }

  // ---------------------------------------------------------------- region borders (Borders tool)
  // Paints a region's colour into map_regions.tga, one pixel a tile, so its border moves. Only tiles that
  // already belong to a region, or land tiles, are painted: sea, settlements (black) and ports (white) stay.
  // Alt + click picks the region under the pointer. Each stroke is one undo step; Save writes map_regions.tga.
  // Drag (the default) grabs the borders under the pointer and pulls them along, smoothly fading out to the
  // edge of the reach circle, like a liquify brush: the region you drag from grows, the one you drag into shrinks.
  // both use the brush Size (top bar, [ and ], Shift + wheel, Alt + right-drag): the radius in tiles
  let rgRegion = null, rgMode = 'drag';
  const rgRadius = () => Math.max(0.5, S().brushSize || 1);
  function rgPushStart(m) {
    const p = state.project, R = p.regions, W = R.width, H = R.height, d = R.data, n = W * H;
    // tiles next to a settlement or port keep their region, so no settlement or port changes hands
    const prot = new Uint8Array(n);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 4;
      const special = (d[o] === 0 && d[o + 1] === 0 && d[o + 2] === 0) || (d[o] === 255 && d[o + 1] === 255 && d[o + 2] === 255);
      if (!special) continue;
      for (let yy = Math.max(0, y - 1); yy <= Math.min(H - 1, y + 1); yy++) for (let xx = Math.max(0, x - 1); xx <= Math.min(W - 1, x + 1); xx++) prot[yy * W + xx] = 1;
    }
    const reach = Math.max(1, rgRadius());
    return { type: 'region', mode: 'drag', reach, before: new Map(), snap: d.slice(), dx: new Float32Array(n), dy: new Float32Array(n), prot, last: { x: m.x / 2, y: m.y / 2 }, lock: rgLockAt(m, reach) };
  }
  // "Only the border you grab": the region under the pointer and the nearest other region across a border;
  // a drag then moves only the border between those two, and every other region stays as it is
  const rgLockOn = () => S().rgLock !== false;
  function rgLockAt(m, reach) {
    if (!rgLockOn()) return null;
    const p = state.project, R = p.regions, W = R.width, H = R.height, d = R.data;
    const cx = m.x / 2, cy = m.y / 2, lim = reach + 1;
    const regAt = (x, y) => { const o = (y * W + x) * 4; return p.regionByColour.get(`${d[o]},${d[o + 1]},${d[o + 2]}`); };
    const nearest = (skip) => {
      let best = null, bd = Infinity;
      for (let y = Math.max(0, Math.floor(cy - lim)); y <= Math.min(H - 1, Math.ceil(cy + lim)); y++) for (let x = Math.max(0, Math.floor(cx - lim)); x <= Math.min(W - 1, Math.ceil(cx + lim)); x++) {
        const r = regAt(x, y);
        if (!r || r === skip) continue;
        const dd = (x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2;
        if (dd < bd) { bd = dd; best = r; }
      }
      return bd <= lim * lim ? best : null;
    };
    const a = nearest(null), b = a && nearest(a);
    const regs = [a, b].filter(Boolean);
    return { regs, keys: new Set(regs.map((r) => r.rgb.join(','))) };
  }
  function rgPushStep(pt, q) {
    const p = state.project, R = p.regions, W = R.width, H = R.height, d = R.data, S0 = pt.snap, Rr = pt.reach;
    const lock = pt.lock && pt.lock.keys;
    const isReg = lock ? (o) => lock.has(`${S0[o]},${S0[o + 1]},${S0[o + 2]}`) : (o) => p.regionByColour.has(`${S0[o]},${S0[o + 1]},${S0[o + 2]}`);
    if (lock && lock.size < 2) return;
    let ex = q.x - pt.last.x, ey = q.y - pt.last.y;
    const len = Math.hypot(ex, ey);
    if (len < 0.05) return;
    // long moves in small steps, so the pull stays smooth
    const steps = Math.max(1, Math.ceil(len / (Rr * 0.2)));
    ex /= steps; ey /= steps;
    for (let k = 0; k < steps; k++) {
      const cx = pt.last.x, cy = pt.last.y;
      for (let y = Math.max(0, Math.floor(cy - Rr)); y <= Math.min(H - 1, Math.ceil(cy + Rr)); y++) {
        for (let x = Math.max(0, Math.floor(cx - Rr)); x <= Math.min(W - 1, Math.ceil(cx + Rr)); x++) {
          const dd = Math.hypot(x + 0.5 - cx, y + 0.5 - cy) / Rr;
          if (dd >= 1) continue;
          const w = (1 - dd * dd) ** 2, i = y * W + x;
          pt.dx[i] += ex * w; pt.dy[i] += ey * w;
          if (pt.prot[i]) continue;
          const o = i * 4;
          // only region tiles (and land) change, and only to another region's colour
          if (!isReg(o)) {
            if (lock) continue;
            if ((S0[o] === 0 && S0[o + 1] === 0 && S0[o + 2] === 0) || (S0[o] === 255 && S0[o + 1] === 255 && S0[o + 2] === 255)) continue;
            const v = (2 * y + 1) * p.W + 2 * x + 1;
            if (v >= p.gtIdx.length || p.gtTable[p.gtIdx[v]].water) continue;
          }
          const sx = Math.floor(x + 0.5 - pt.dx[i]), sy = Math.floor(y + 0.5 - pt.dy[i]);
          let so = o;
          if (sx >= 0 && sy >= 0 && sx < W && sy < H) { const s2 = (sy * W + sx) * 4; if (isReg(s2)) so = s2; }
          if (d[o] === S0[so] && d[o + 1] === S0[so + 1] && d[o + 2] === S0[so + 2]) continue;
          if (!pt.before.has(i)) pt.before.set(i, S0.slice(o, o + 4));
          d[o] = S0[so]; d[o + 1] = S0[so + 1]; d[o + 2] = S0[so + 2];
        }
      }
      pt.last = { x: cx + ex, y: cy + ey };
    }
  }
  function rgPickAt(m) {
    const t = pcTileAt(m), r = pcRegionAt(t.tx, t.ty) || pcRegionOf(t.tx, t.ty);
    if (r) { rgRegion = r; renderBorderPanel(); }
    return r;
  }
  function rgAt(pt, tx, ty) {
    const p = state.project, R = p.regions, d = R.data, rgb = pt.reg.rgb, rad = pt.rad;
    for (let y = Math.floor(ty - rad); y <= Math.ceil(ty + rad); y++) for (let x = Math.floor(tx - rad); x <= Math.ceil(tx + rad); x++) {
      if (x < 0 || y < 0 || x >= R.width || y >= R.height) continue;
      if ((x - tx) ** 2 + (y - ty) ** 2 > (rad + 0.25) ** 2) continue;
      const i = y * R.width + x, o = i * 4;
      if (d[o] === rgb[0] && d[o + 1] === rgb[1] && d[o + 2] === rgb[2]) continue;
      if ((d[o] === 0 && d[o + 1] === 0 && d[o + 2] === 0) || (d[o] === 255 && d[o + 1] === 255 && d[o + 2] === 255)) continue;
      if (!p.regionByColour.has(`${d[o]},${d[o + 1]},${d[o + 2]}`)) {
        const v = (2 * y + 1) * p.W + 2 * x + 1;
        if (v >= p.gtIdx.length || p.gtTable[p.gtIdx[v]].water) continue;
      }
      if (!pt.before.has(i)) pt.before.set(i, d.slice(o, o + 4));
      d[o] = rgb[0]; d[o + 1] = rgb[1]; d[o + 2] = rgb[2];
    }
  }
  function rgPointerDown(e) {
    const m = screenToMap(e.offsetX, e.offsetY);
    if (!m || !state.project.regions) return null;
    if (rgMode === 'regions') { if (roPending) { const t = pcTileAt(m); roAddAt(t.tx, t.ty); } return null; }
    if (rgMode === 'drag' && !e.altKey) return rgPushStart(m);
    if (e.altKey || !rgRegion) { if (!rgPickAt(m) || e.altKey) return null; }
    const t = pcTileAt(m);
    const pt = { type: 'region', reg: rgRegion, rad: rgRadius() - 0.5, before: new Map(), last: t };
    rgAt(pt, t.tx, t.ty);
    rgShow();
    return pt;
  }
  function rgPointerMove(pt, sx, sy) {
    const m = screenToMap(sx, sy);
    if (pt.mode === 'drag') { if (m) { rgPushStep(pt, { x: m.x / 2, y: m.y / 2 }); rgShow(); } return; }
    if (!m) { pt.last = null; return; }
    const t = pcTileAt(m);
    if (pt.last && (t.tx !== pt.last.tx || t.ty !== pt.last.ty)) {
      const n = Math.max(Math.abs(t.tx - pt.last.tx), Math.abs(t.ty - pt.last.ty));
      for (let k = 1; k <= n; k++) rgAt(pt, Math.round(pt.last.tx + (t.tx - pt.last.tx) * k / n), Math.round(pt.last.ty + (t.ty - pt.last.ty) * k / n));
    } else if (!pt.last) rgAt(pt, t.tx, t.ty);
    pt.last = t;
    rgShow();
  }
  function rgPointerUp(pt) {
    const R = state.project.regions, px = [];
    for (const [i, a] of pt.before) { const b = R.data.slice(i * 4, i * 4 + 4); if (a[0] !== b[0] || a[1] !== b[1] || a[2] !== b[2]) px.push([i, a, b]); }
    if (!px.length) return;
    pcCommit(state.project.pc.lines.slice(), px, 'Region borders');
    renderBorderPanel();
  }
  let rgFrame = 0;
  function rgShow() {
    if (rgFrame) return;
    rgFrame = requestAnimationFrame(() => {
      rgFrame = 0;
      const R = state.project && state.project.regions;
      if (R) view.setRegions(R.width, R.height, R.data);
      view.dirty = true;
    });
  }
  function drawRegionCursor() {
    if (!lastMouse || !state.project || !state.project.regions || spaceDown) return;
    if (pointer && pointer.type !== 'region') return;
    const m = screenToMap(lastMouse.x, lastMouse.y);
    if (!m) return;
    const t = pcTileAt(m), rad = rgRadius() - 0.5, rgReach = Math.max(1, rgRadius());
    const P = state.project;
    const scr = (x, y) => (is3D() ? view.project3D(x, y, view.heightAt(Math.max(0, Math.min(x, P.W - 1)), Math.max(0, Math.min(y, P.H - 1)))) : view.toScreen(x, y));
    if (rgMode === 'regions') {
      if (!roPending) return;
      const c0 = { x: m.x / 2, y: m.y / 2 }, reach = Math.max(1, rgRadius());
      octx.save();
      octx.beginPath();
      for (let k = 0; k <= 64; k++) {
        const ang = k / 64 * Math.PI * 2, s2 = scr(2 * (c0.x + Math.cos(ang) * reach), 2 * (c0.y + Math.sin(ang) * reach));
        if (!s2) continue;
        if (k) octx.lineTo(s2.x, s2.y); else octx.moveTo(s2.x, s2.y);
      }
      octx.lineWidth = 1.5; octx.strokeStyle = 'rgba(120,230,140,.95)'; octx.stroke();
      octx.fillStyle = '#fff'; octx.font = '12px Segoe UI';
      octx.fillText(`click: ${roPending.settlement} goes here`, lastMouse.x + 12, lastMouse.y - 12);
      octx.restore();
      return;
    }
    if (rgMode === 'drag') {
      // the reach: borders inside it follow the drag, most at the middle
      const drag = pointer && pointer.type === 'region' ? pointer : null, c0 = drag ? drag.last : { x: m.x / 2, y: m.y / 2 }, reach = drag ? drag.reach : rgReach;
      octx.save();
      for (const [f, a] of [[1, 0.95], [0.5, 0.45]]) {
        octx.beginPath();
        for (let k = 0; k <= 64; k++) {
          const ang = k / 64 * Math.PI * 2, s = scr(2 * (c0.x + Math.cos(ang) * reach * f), 2 * (c0.y + Math.sin(ang) * reach * f));
          if (!s) continue;
          if (k) octx.lineTo(s.x, s.y); else octx.moveTo(s.x, s.y);
        }
        octx.lineWidth = 1.5; octx.strokeStyle = `rgba(255,225,120,${a})`; octx.stroke();
      }
      octx.fillStyle = '#fff'; octx.font = '12px Segoe UI';
      if (!pointer) octx.fillText(rgLockOn() ? 'drag a border to move it (only that border)' : 'drag a border to move it', lastMouse.x + 12, lastMouse.y - 12);
      else if (drag && drag.lock) octx.fillText(drag.lock.regs.length > 1 ? drag.lock.regs.map((r) => placeName(r.name)).join('  |  ') : 'no border here to move', lastMouse.x + 12, lastMouse.y - 12);
      octx.restore();
      return;
    }
    octx.save();
    octx.lineWidth = 1.5;
    const c = rgRegion ? rgRegion.rgb : [255, 255, 255];
    octx.strokeStyle = `rgb(${c[0]},${c[1]},${c[2]})`;
    octx.beginPath();
    if (rad >= 1) {
      // a circle of tiles' outline, sampled round the edge
      for (let k = 0; k <= 48; k++) {
        const a = k / 48 * Math.PI * 2, s = scr(2 * (t.tx + 0.5 + Math.cos(a) * (rad + 0.5)), 2 * (t.ty + 0.5 + Math.sin(a) * (rad + 0.5)));
        if (!s) continue;
        if (k) octx.lineTo(s.x, s.y); else octx.moveTo(s.x, s.y);
      }
    } else {
      const x0 = 2 * (t.tx - Math.floor(rad)), y0 = 2 * (t.ty - Math.floor(rad)), x1 = 2 * (t.tx + Math.ceil(rad) + 1), y1 = 2 * (t.ty + Math.ceil(rad) + 1);
      const pts = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]].map(([x, y]) => scr(x, y));
      if (pts.every(Boolean)) { pts.forEach((s, k) => (k ? octx.lineTo(s.x, s.y) : octx.moveTo(s.x, s.y))); octx.closePath(); }
    }
    octx.stroke();
    octx.strokeStyle = 'rgba(0,0,0,.6)'; octx.lineWidth = 0.75; octx.stroke();
    octx.fillStyle = '#fff'; octx.font = '12px Segoe UI';
    const under = pcRegionAt(t.tx, t.ty);
    octx.fillText(rgRegion ? `paint ${placeName(rgRegion.name)}${under && under !== rgRegion ? ` over ${placeName(under.name)}` : ''}` : 'click a region to pick it', lastMouse.x + 12, lastMouse.y - 12);
    octx.restore();
  }
  function renderBorderPanel() {
    const box = $('#borderPanel');
    if (!box) return;
    const p = state.project;
    box.hidden = state.tool !== 'borders' || !p;
    if (box.hidden) return;
    box.textContent = '';
    box.append(el('div', { class: 'cp-head' },
      el('b', { text: 'Region borders' }),
      el('span', { class: 'cp-help', text: rgMode === 'regions' ? 'Add a region or delete one.' : rgMode === 'drag' ? 'Press on a border and drag it where you want it.' : 'Pick a region, then paint its colour onto the map. Alt + click picks the region under the pointer.' }),
      el('button', { class: 'ramp-x', title: 'Back to the brush', text: '×', onclick: () => setTool('brush') })));
    if (!p.regions) { box.append(el('div', { class: 'cp-note', text: 'This map has no map_regions.tga.' })); return; }
    const seg = el('div', { class: 'seg pc-modes' });
    for (const [m, t, tip] of [['drag', 'Drag borders', 'Grab a border and pull it: the region you pull from grows, smoothly, like a curve'], ['paint', 'Paint', 'Paint a picked region\'s colour tile by tile'], ['regions', 'Add / delete', 'Add a new region or delete one, in every game file that lists regions']]) {
      seg.append(el('button', { text: t, title: tip, class: rgMode === m ? 'active' : '', onclick: () => { rgMode = m; renderBorderPanel(); drawOverlay(); } }));
    }
    box.append(seg);
    if (rgMode === 'regions') { roMenu(box); return; }
    box.append(el('div', { class: 'cp-note rg-sizenote', text: `${rgMode === 'drag' ? 'Reach' : 'Brush'}: ${rgRadius()} tile${rgRadius() === 1 ? '' : 's'} round the pointer. It is the brush Size in the top bar ([ and ], Shift + wheel, or Alt + right-drag).` }));
    if (rgMode === 'drag') {
      box.append(el('div', { class: 'seg pc-modes' }, el('button', { text: 'Only the border I grab', class: rgLockOn() ? 'active' : '',
        title: 'On: a drag moves only the border between the region you press on and the nearest region across it; other regions inside the circle stay put. Off: every border inside the circle moves.',
        onclick: () => { S().rgLock = !rgLockOn(); saveSettings(); renderBorderPanel(); drawOverlay(); } })));
      box.append(el('div', { class: 'cp-note', text: rgLockOn() ? 'Only the border you press on moves: the region under the pointer and the nearest region across its border trade land, and every other region stays as it is.' : 'Every border inside the circle moves.' }));
      box.append(el('div', { class: 'cp-note', text: 'Borders inside the circle follow the pointer, most in the middle, so lines bend like curves: pull a border out to grow a region, push it in to shrink it. A small size moves a short stretch, a big one a whole side. One undo step per drag. The sea, settlements, ports and the tiles touching them stay as they are. Save writes map_regions.tga with a backup.' }));
      return;
    }
    const regs = [...p.regionByColour.values()].sort((a, b) => placeName(a.name).localeCompare(placeName(b.name)));
    if (rgRegion && !regs.includes(rgRegion)) rgRegion = null;
    const sel = el('select', { class: 'cp-sel' });
    sel.append(el('option', { value: '', text: '— pick a region —' }));
    regs.forEach((r, k) => sel.append(el('option', { value: String(k), text: `${placeName(r.name)}${r.settlement ? ` (${placeName(r.settlement)})` : ''}` })));
    sel.value = rgRegion ? String(regs.indexOf(rgRegion)) : '';
    sel.addEventListener('change', () => { rgRegion = sel.value === '' ? null : regs[+sel.value]; renderBorderPanel(); drawOverlay(); });
    const sw = el('span', { class: 'rg-swatch' });
    if (rgRegion) sw.style.background = `rgb(${rgRegion.rgb.join(',')})`;
    box.append(el('div', { class: 'cp-target' }, el('label', { text: 'Region' }), sw, sel));
    box.append(el('div', { class: 'cp-note', text: 'Only land and other regions are painted: the sea, settlements (black) and ports (white) stay as they are. A settlement painted over goes to the region around it, so check the Pieces tool afterwards. Save writes map_regions.tga with a backup; the game rebuilds map.rwm after it changes.' }));
  }

  // ---------------------------------------------------------------- adding and deleting regions (Borders > Add / delete)
  // Adding: name the region and its settlement, then click the map where the settlement goes; the new region
  // takes the land of the region there within the brush Size, and gets a colour no region uses. Deleting gives
  // each of the region's tiles to the nearest other region. Either one goes into every file that lists
  // regions: map_regions.tga, descr_regions.txt, descr_regions_and_settlement_name_lookup.txt, the names file
  // in data\text, descr_strat.txt (settlement blocks, the region's block in the regions section) and, when
  // deleting, descr_win_conditions.txt, descr_mercenaries.txt and descr_sounds_music_types.txt. One undo step each.
  let roPending = null; // { name, settlement } waiting for a click on the map
  const roAscii = (t) => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  async function roLoadLookup() {
    const p = state.project;
    if (p.lookup !== undefined) return p.lookup;
    const J = M2.join, f = await M2.firstExisting([J(p.mapDir, 'descr_regions_and_settlement_name_lookup.txt'), J(p.loc.baseMapDir, 'descr_regions_and_settlement_name_lookup.txt')]);
    if (!f) { p.lookup = null; return null; }
    const t = await host.readText(f);
    p.lookup = { src: f, lines: t.split(/\r?\n/), eol: /\r\n/.test(t) ? '\r\n' : '\n' };
    return p.lookup;
  }
  // the campaign files that list regions by name (read once, when a region is first deleted)
  async function roLoadExtra() {
    const p = state.project;
    if (p.regExtra) return p.regExtra;
    const J = M2.join, camp = p.pc && p.pc.file ? M2.dirname(p.pc.file) : p.mapDir;
    const cands = [J(camp, 'descr_win_conditions.txt'), J(camp, 'descr_mercenaries.txt'), J(camp, 'descr_sounds_music_types.txt'), J(p.loc.dataDir, 'descr_sounds_music_types.txt')];
    const out = new Map();
    for (const f of cands) {
      if (!(await host.exists(f))) continue;
      const t = await host.readText(f);
      out.set(f, { lines: t.split(/\r?\n/), eol: /\r\n/.test(t) ? '\r\n' : '\n', dirty: false });
    }
    p.regExtra = out;
    // read only, to warn: scripts that name regions
    p.regScripts = [];
    for (const f of [J(camp, 'campaign_script.txt'), J(camp, 'descr_events.txt')]) {
      if (await host.exists(f)) p.regScripts.push({ f, text: await host.readText(f) });
    }
    return out;
  }
  function roSnapshot() {
    const p = state.project, P = p.placeNames;
    return {
      reg: p.regions.data.slice(), regLines: p.regText.lines.slice(), pcLines: p.pc ? p.pc.lines.slice() : null,
      lookup: p.lookup ? p.lookup.lines.slice() : null,
      names: P ? new Map(P.names) : null, cased: P ? new Map(P.cased) : null, deleted: P ? new Set(P.deleted) : null,
      extra: new Map([...(p.regExtra || new Map())].map(([k, o]) => [k, { lines: o.lines.slice(), dirty: o.dirty }])),
    };
  }
  function roRestore(sn) {
    const p = state.project, P = p.placeNames;
    p.regions.data.set(sn.reg);
    p.regText.lines = sn.regLines.slice();
    if (p.pc && sn.pcLines) { p.pc.lines = sn.pcLines.slice(); p.pc.dirty = true; p.pc.ver++; }
    if (p.lookup && sn.lookup) p.lookup.lines = sn.lookup.slice();
    if (P && sn.names) { P.names = new Map(sn.names); P.cased = new Map(sn.cased); P.deleted = new Set(sn.deleted); p.namesDirty = true; }
    for (const [k, o] of sn.extra) { const e = p.regExtra && p.regExtra.get(k); if (e) { e.lines = o.lines.slice(); e.dirty = true; } }
    p.regStructDirty = true;
    if (p.pc) p.pc.regDirty = true;
    roRebuild();
  }
  // the regions as descr_regions.txt now has them, and everything that hangs on them
  function roRebuild() {
    const p = state.project;
    const defs = M2.parseRegions(p.regText.lines.join('\n'));
    p.regionByColour = new Map(defs.map((r) => [r.rgb.join(','), r]));
    p.regionSpots = null;
    rgRegion = null;
    if (p.pc) { p.pc.sel = null; p.pc.nameReg = null; p.pc.items = null; }
    pcChanged(true);
    renderBorderPanel();
    updateButtons();
  }
  // the lines of region `name`'s block in descr_regions.txt: [start, end] (end exclusive)
  function roBlock(lines, name) {
    let start = -1;
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i].replace(/;.*$/, '');
      if (!l.trim() || /^\s/.test(l)) continue;
      if (start >= 0) return [start, i];
      if (l.trim().toLowerCase() === name.toLowerCase()) start = i;
    }
    if (start < 0) return null;
    let end = lines.length;
    while (end > start + 1 && !lines[end - 1].trim()) end--;
    return [start, end];
  }
  // settlement { ... region NAME ... } blocks in descr_strat.txt: [start, end] (end inclusive)
  function roSettlementBlocks(lines, name) {
    const out = [];
    for (let i = 0; i < lines.length; i++) {
      if (!/^\s*settlement\b/i.test(lines[i].replace(/;.*$/, ''))) continue;
      let depth = 0, opened = false, hit = false, j = i;
      for (; j < lines.length; j++) {
        const l = lines[j].replace(/;.*$/, '');
        const m = l.match(/^\s*region\s+(\S+)/i);
        if (m && opened && m[1].toLowerCase() === name.toLowerCase()) hit = true;
        depth += (l.match(/\{/g) || []).length; if ((l.match(/\{/g) || []).length) opened = true;
        depth -= (l.match(/\}/g) || []).length;
        if (opened && depth <= 0) break;
      }
      if (hit) out.push([i, j]);
      i = j;
    }
    return out;
  }
  function roUnusedColour() {
    const p = state.project, R = p.regions, used = new Set(p.regionByColour.keys());
    const d = R.data;
    for (let i = 0; i < d.length; i += 4) used.add(`${d[i]},${d[i + 1]},${d[i + 2]}`);
    for (let n = 0; n < 5000; n++) {
      const c = [20 + Math.floor(Math.random() * 216), 20 + Math.floor(Math.random() * 216), 20 + Math.floor(Math.random() * 216)];
      if (!used.has(c.join(','))) return c;
    }
    return null;
  }
  async function roStartAdd(name, settlement) {
    const p = state.project;
    if (!p.regText) { toast('This map has no descr_regions.txt.', 'err', 6000); return; }
    name = String(name || '').trim(); settlement = String(settlement || '').trim() || name;
    if (!name) { toast('Give the new region a name first.', 'err', 5000); return; }
    roPending = { name, settlement };
    renderBorderPanel(); drawOverlay();
  }
  async function roAddAt(tx, ty) {
    const p = state.project, R = p.regions, W = R.width, H = R.height, d = R.data, pend = roPending;
    if (!pend) return;
    const src = pcRegionAt(tx, ty);
    if (!src) { toast('Click on a region\'s land (not the sea, a settlement or a port).', 'err', 6000); return; }
    // no settlement or port right beside it
    for (let y = ty - 1; y <= ty + 1; y++) for (let x = tx - 1; x <= tx + 1; x++) {
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      const k = pcKey(x, y);
      if (k === '0,0,0' || k === '255,255,255') { toast('Too close to another settlement or port: pick a spot at least two tiles away.', 'err', 6000); return; }
    }
    if (!placeNamesReady()) await loadPlaceNames();
    await roLoadLookup();
    const P = p.placeNames;
    // keys for the files: from the names, made unique
    const taken = new Set();
    for (const r of p.regionByColour.values()) { taken.add(r.name.toLowerCase()); if (r.settlement) taken.add(r.settlement.toLowerCase()); }
    let base = roAscii(pend.settlement) || roAscii(pend.name) || 'New_Region', setKey = base, k = 2;
    while (taken.has(setKey.toLowerCase()) || taken.has(`${setKey}_Province`.toLowerCase())) setKey = `${base}_${k++}`;
    const regKey = `${setKey}_Province`;
    const rgb = roUnusedColour();
    if (!rgb) { toast('No free colour was found for the new region.', 'err', 6000); return; }
    const before = roSnapshot();
    // descr_regions.txt: the block of the region it is carved from, with the new name, settlement and colour
    const L = p.regText.lines, b = roBlock(L, src.name);
    let block;
    if (b) {
      block = L.slice(b[0], b[1]).filter((l) => l.trim());
      let n = 0;
      block = block.map((l, i) => {
        if (i === 0) return regKey;
        if (/^\s/.test(l) && l.replace(/;.*$/, '').trim()) n++;
        if (n === 1 && i > 0 && /^\s/.test(l) && l.trim() === (src.settlement || '').trim()) return l.replace(src.settlement, setKey);
        if (/^\s*\d+\s+\d+\s+\d+\s*$/.test(l)) return l.replace(/\d+\s+\d+\s+\d+/, rgb.join(' '));
        return l;
      });
      if (!block.some((l) => l.includes(setKey))) block.splice(1, 0, `\t${setKey}`);
    } else {
      block = [regKey, `\t${setKey}`, `\t${src.creator || 'slave'}`, '\tRebels', `\t${rgb.join(' ')}`, '\tnone', '\t5', '\t5', '\treligions { catholic 100 }'];
    }
    let at = L.length;
    while (at > 0 && !L[at - 1].trim()) at--;
    L.splice(at, 0, ...block);
    // map_regions.tga: the settlement, and the source region's land around it within the brush Size
    const rad = Math.max(1, rgRadius());
    for (let y = Math.max(0, Math.floor(ty - rad)); y <= Math.min(H - 1, Math.ceil(ty + rad)); y++) for (let x = Math.max(0, Math.floor(tx - rad)); x <= Math.min(W - 1, Math.ceil(tx + rad)); x++) {
      if ((x - tx) ** 2 + (y - ty) ** 2 > rad * rad || pcRegionAt(x, y) !== src) continue;
      let near = false;
      for (let yy = y - 1; yy <= y + 1 && !near; yy++) for (let xx = x - 1; xx <= x + 1 && !near; xx++) {
        if (xx < 0 || yy < 0 || xx >= W || yy >= H || (xx === tx && yy === ty)) continue;
        const kk = pcKey(xx, yy);
        if (kk === '0,0,0' || kk === '255,255,255') near = true;
      }
      if (near) continue;
      const o = (y * W + x) * 4; d[o] = rgb[0]; d[o + 1] = rgb[1]; d[o + 2] = rgb[2];
    }
    { const o = (ty * W + tx) * 4; d[o] = 0; d[o + 1] = 0; d[o + 2] = 0; }
    // the names the game shows, and the lookup list
    if (P) {
      P.names.set(regKey.toLowerCase(), pend.name); P.cased.set(regKey.toLowerCase(), regKey);
      P.names.set(setKey.toLowerCase(), pend.settlement); P.cased.set(setKey.toLowerCase(), setKey);
      P.deleted.delete(regKey.toLowerCase()); P.deleted.delete(setKey.toLowerCase());
      p.namesDirty = true;
    }
    if (p.lookup) {
      const LL = p.lookup.lines;
      let e = LL.length; while (e > 0 && !LL[e - 1].trim()) e--;
      LL.splice(e, 0, regKey, setKey);
    }
    // descr_strat.txt: a settlement block when the campaign lists its settlements (under the rebels)
    if (p.pc && p.pc.file) {
      const pl = p.pc.lines;
      const anySet = pl.some((l) => /^\s*settlement\b/i.test(l.replace(/;.*$/, '')));
      const slave = pl.findIndex((l) => /^\s*faction\s+slave\b/i.test(l));
      if (anySet && slave >= 0) {
        let ins = slave + 1;
        while (ins < pl.length && !/^\s*(settlement|character|faction)\b/i.test(pl[ins].replace(/;.*$/, ''))) ins++;
        pl.splice(ins, 0, 'settlement', '{', '\tlevel village', `\tregion ${regKey}`, '', '\tyear_founded 0', '\tpopulation 400', '\tplan_set default_set', `\tfaction_creator ${src.creator || 'slave'}`, '}', '');
        p.pc.dirty = true; p.pc.ver++;
      }
    }
    roPending = null;
    p.regStructDirty = true; if (p.pc) p.pc.regDirty = true;
    roRebuild();
    state.undo.push({ t: new Map(), rs: { before, after: roSnapshot() } }); state.redo = [];
    updateButtons();
    toast(`Added ${pend.name} (${regKey}, settlement ${setKey}). Grow it with Drag borders or Paint, then Save.`, 'ok', 8000);
  }
  const placeNamesReady = () => !!(state.project && state.project.placeNames);
  async function roDelete(reg) {
    const p = state.project, R = p.regions, W = R.width, H = R.height, d = R.data;
    if (!reg || !p.regText) return;
    if (p.regionByColour.size < 2) { toast('A map needs at least one region.', 'err', 5000); return; }
    const label = `${placeName(reg.name)}${reg.settlement ? ` (${placeName(reg.settlement)})` : ''}`;
    if (!window.confirm(`Delete the region ${label}? Its land goes to the regions around it, and it is taken out of descr_regions.txt, the names files and the campaign files when you Save. Undo brings it back.`)) return;
    loading('Deleting the region…');
    try {
      if (!placeNamesReady()) await loadPlaceNames();
      await roLoadLookup(); await roLoadExtra();
      const P = p.placeNames;
      const before = roSnapshot();
      // the tiles to give away: the region's own, its settlement and its ports
      const items = pcItems();
      const n = W * H, mine = new Uint8Array(n);
      const isMine = (o) => d[o] === reg.rgb[0] && d[o + 1] === reg.rgb[1] && d[o + 2] === reg.rgb[2];
      for (let i = 0; i < n; i++) if (isMine(i * 4)) mine[i] = 1;
      for (const it of items) if ((it.kind === 'settlement' || it.kind === 'port') && it.region === reg) mine[it.ty * W + it.tx] = 1;
      // nearest other region, spreading from every other region's tiles (over sea too, for islands)
      const owner = new Int32Array(n).fill(-1), q = new Int32Array(n);
      let qh = 0, qt = 0;
      for (let i = 0; i < n; i++) {
        if (mine[i]) continue;
        const o = i * 4, r = p.regionByColour.get(`${d[o]},${d[o + 1]},${d[o + 2]}`);
        if (r && r !== reg) { owner[i] = i; q[qt++] = i; }
      }
      while (qh < qt) {
        const i = q[qh++], x = i % W, y = (i / W) | 0;
        for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, y > 0 ? i - W : -1, y < H - 1 ? i + W : -1]) {
          if (j < 0 || owner[j] >= 0) continue;
          owner[j] = owner[i]; q[qt++] = j;
        }
      }
      for (let i = 0; i < n; i++) if (mine[i] && owner[i] >= 0) { const o = i * 4, s2 = owner[i] * 4; d[o] = d[s2]; d[o + 1] = d[s2 + 1]; d[o + 2] = d[s2 + 2]; }
      // descr_regions.txt
      const L = p.regText.lines, b = roBlock(L, reg.name);
      if (b) L.splice(b[0], b[1] - b[0]);
      // descr_strat.txt: its settlement block(s) and its block in the regions section (forts and watchtowers move on)
      const moved = [];
      if (p.pc) {
        const pl = p.pc.lines;
        for (const [a, z] of roSettlementBlocks(pl, reg.name).reverse()) { pl.splice(a, z - a + 1); while (a < pl.length && a > 0 && !pl[a].trim() && !pl[a - 1].trim()) pl.splice(a, 1); }
        p.pc.ver++;
        const blk = pcParse().blocks.get(reg.name.toLowerCase());
        if (blk) {
          for (let i = blk.start; i <= blk.end; i++) if (/^\s*(fort|watchtower)\b/i.test(pl[i])) moved.push(pl[i]);
          let z = blk.end + 1; while (z < pl.length && !pl[z].trim()) z++;
          pl.splice(blk.start, z - blk.start);
        }
        p.pc.dirty = true; p.pc.ver++;
      }
      // the names the game shows and the lookup list
      const keys = [reg.name, reg.settlement].filter(Boolean).map((k) => k.toLowerCase());
      if (P) { for (const k of keys) { P.names.delete(k); P.deleted.add(k); } p.namesDirty = true; }
      if (p.lookup) p.lookup.lines = p.lookup.lines.filter((l) => !keys.includes(l.trim().toLowerCase()));
      // win conditions, mercenary pools, music: the region's name taken out of their lists
      const re = new RegExp(`(^|[\\s,])${reg.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?=$|[\\s,;])`, 'gi');
      for (const o of p.regExtra.values()) {
        o.lines = o.lines.map((l) => { if (!re.test(l)) { re.lastIndex = 0; return l; } re.lastIndex = 0; o.dirty = true; return l.replace(re, '$1').replace(/[ \t]{2,}/g, ' ').replace(/[ \t]+$/, ''); });
      }
      const scripts = (p.regScripts || []).filter((x) => new RegExp(`\\b${reg.name}\\b|\\b${reg.settlement || '\\0'}\\b`, 'i').test(x.text)).map((x) => M2.basename(x.f));
      p.regStructDirty = true; if (p.pc) p.pc.regDirty = true;
      roRebuild();
      // forts and watchtowers of the deleted region go to the block of the region they now stand in
      if (p.pc && moved.length) {
        const Ht = R.height;
        for (const line of moved) {
          const m = line.match(/^\s*\S+\s+(\d+)\s+(\d+)/);
          const to = m && pcRegionAt(+m[1], Ht - 1 - +m[2]);
          if (to) pcInsertInBlock(to, line);
        }
        p.pc.ver++; pcChanged(false);
      }
      state.undo.push({ t: new Map(), rs: { before, after: roSnapshot() } }); state.redo = [];
      updateButtons();
      const extra = [...p.regExtra].filter(([, o]) => o.dirty).map(([f]) => M2.basename(f));
      toast(`Deleted ${label}.${extra.length ? ` Also taken out of ${extra.join(', ')}.` : ''}${scripts.length ? ` ${scripts.join(' and ')} still name it; edit ${scripts.length > 1 ? 'them' : 'it'} by hand or the game may stop on it.` : ''} Save writes the files.`, scripts.length ? 'err' : 'ok', 12000);
    } catch (e) { console.error(e); toast('The region could not be deleted: ' + e.message, 'err', 8000); } finally { loading(null); }
  }
  function roMenu(box) {
    const p = state.project;
    if (!p.regText) { box.append(el('div', { class: 'cp-note', text: 'This map has no descr_regions.txt.' })); return; }
    // add
    const add = el('div', { class: 'ro-add' });
    if (roPending) {
      add.append(el('div', { class: 'cp-note ro-wait', text: `Click the map where ${roPending.settlement} goes. The new region ${roPending.name} takes the land around it within the brush Size.` }),
        el('div', { class: 'seg pc-modes' }, el('button', { text: 'Cancel', onclick: () => { roPending = null; renderBorderPanel(); drawOverlay(); } })));
    } else {
      const rn = el('input', { type: 'text', class: 'nm-input', id: 'roName', placeholder: 'Region name', spellcheck: false });
      const sn = el('input', { type: 'text', class: 'nm-input', id: 'roSettlement', placeholder: 'Settlement name', spellcheck: false });
      add.append(el('div', { class: 'cp-target nm-row' }, el('label', { text: 'Region' }), rn),
        el('div', { class: 'cp-target nm-row' }, el('label', { text: 'Settlement' }), sn),
        el('div', { class: 'seg pc-modes' }, el('button', { text: 'Add region, then click the map', class: 'active', onclick: () => roStartAdd(rn.value, sn.value) })));
    }
    box.append(add);
    // list with delete
    const search = el('input', { type: 'text', class: 'nm-input ro-search', placeholder: 'Find a region…', spellcheck: false });
    const list = el('div', { class: 'ro-list' });
    const regs = [...p.regionByColour.values()].sort((a, b) => placeName(a.name).localeCompare(placeName(b.name)));
    const fill = () => {
      list.textContent = '';
      const f = search.value.trim().toLowerCase();
      for (const r of regs) {
        const txt = `${placeName(r.name)}${r.settlement ? ` · ${placeName(r.settlement)}` : ''}`;
        if (f && !txt.toLowerCase().includes(f) && !r.name.toLowerCase().includes(f)) continue;
        const sw = el('span', { class: 'rg-swatch' }); sw.style.background = `rgb(${r.rgb.join(',')})`;
        list.append(el('div', { class: 'ro-row' }, sw,
          el('button', { class: 'ro-name', text: txt, title: `${r.name} — show it on the map`, onclick: () => pcFocus(null, r) }),
          el('button', { class: 'pc-fix', text: 'Delete', title: 'Delete this region (undo brings it back)', onclick: () => roDelete(r) })));
      }
    };
    search.addEventListener('input', fill);
    fill();
    box.append(el('div', { class: 'cp-note', text: `${regs.length} regions:` }), search, list);
    box.append(el('div', { class: 'cp-note', text: 'Save writes map_regions.tga, descr_regions.txt, descr_regions_and_settlement_name_lookup.txt, the names file in data\\text and descr_strat.txt, and when a region is deleted also descr_win_conditions.txt, descr_mercenaries.txt and descr_sounds_music_types.txt if they list it, all with backups.' }));
  }

  // ---------------------------------------------------------------- rivers (River tool, V)
  // Rivers live in map_features.tga, one pixel a tile: 0,0,255 river, 0,255,255 ford, 255,255,255 source.
  // Draw lays a river one tile wide along the drag (never on sea), Erase clears rivers, fords and sources.
  // A river with no source gets one at its inland end, as every river on the game's own maps has.
  // Two ways to lay one: Pencil (tile by tile, exactly the tiles the pointer passes over) and Curve
  // (click points; a smooth line through them is laid as tiles, shown live, and kept with Enter).
  let rvMode = 'draw', rvSize = 1;
  const rvTileMode = () => rvMode === 'ford' || rvMode === 'bridge'; // modes that work tile by tile only
  var rvCurve = null, rvLastClick = null; // var: setTool can run before this part of the file
  // a curve belongs to the map it was started on
  function rvCurveLive() { if (rvCurve && rvCurve.p !== state.project) rvCurve = null; return rvCurve; }
  const rvShape = () => (S().riverShape === 'curve' ? 'curve' : 'pencil');
  function setRiverShape(sh) { rvCurveCommit(); S().riverShape = sh; saveSettings(); renderRiverPanel(); drawOverlay(); }
  function rvInit() {
    const p = state.project;
    if (p.riv) return p.riv;
    if (!p.features) {
      const w = (p.W - 1) / 2, h = (p.H - 1) / 2, data = new Uint8Array(w * h * 4);
      for (let i = 3; i < data.length; i += 4) data[i] = 255;
      p.features = { width: w, height: h, data, tga: { bpp: 24, topDown: false } };
    }
    const F = p.features, n = F.width * F.height, kind = new Uint8Array(n);
    for (let i = 0; i < n; i++) kind[i] = M2.RIVER_KIND(F.data[i * 4], F.data[i * 4 + 1], F.data[i * 4 + 2]);
    p.riv = { kind, orig: kind.slice(), dirty: false, edited: false };
    return p.riv;
  }
  const rvSea = (i) => {
    const p = state.project, w = p.features.width, tx = i % w, ty = (i / w) | 0;
    const v = (2 * ty + 1) * p.W + 2 * tx + 1;
    return v < p.gtIdx.length && !!p.gtTable[p.gtIdx[v]].water;
  };
  function rvSet(i, k, changes) {
    const p = state.project, rv = p.riv, F = p.features;
    if (rv.kind[i] === k) return;
    rv.edited = true;
    if (!changes.has(i)) changes.set(i, rv.kind[i]);
    rv.kind[i] = k;
    const c = M2.RIVER_RGB[k] || [0, 0, 0];
    F.data[i * 4] = c[0]; F.data[i * 4 + 1] = c[1]; F.data[i * 4 + 2] = c[2]; F.data[i * 4 + 3] = 255;
  }
  function rvAt(pt, tx, ty) {
    const F = state.project.features, rv = state.project.riv;
    if (pt.mode === 'bridge' || pt.mode === 'unbridge') {
      // a land bridge: green tiles from one shore over the sea to the other; it doesn't go on a river
      if (tx < 0 || ty < 0 || tx >= F.width || ty >= F.height) return;
      const i = ty * F.width + tx;
      if (pt.mode === 'bridge' && !rv.kind[i]) rvSet(i, 4, pt.changes);
      else if (pt.mode === 'unbridge' && rv.kind[i] === 4) rvSet(i, 0, pt.changes);
      return;
    }
    if (pt.mode === 'ford' || pt.mode === 'unford') {
      // a crossing (ford) sits on a river tile; taking it away leaves plain river
      if (tx < 0 || ty < 0 || tx >= F.width || ty >= F.height) return;
      const i = ty * F.width + tx;
      if (pt.mode === 'ford' && rv.kind[i] === 1) rvSet(i, 2, pt.changes);
      else if (pt.mode === 'unford' && rv.kind[i] === 2) rvSet(i, 1, pt.changes);
      return;
    }
    if (pt.mode === 'draw') {
      if (tx < 0 || ty < 0 || tx >= F.width || ty >= F.height) return;
      const i = ty * F.width + tx;
      if (!rv.kind[i] && !rvSea(i)) rvSet(i, 1, pt.changes);
      return;
    }
    const r = (pt.size - 1) >> 1;
    for (let y = ty - r; y <= ty + r; y++) for (let x = tx - r; x <= tx + r; x++) {
      if (x >= 0 && y >= 0 && x < F.width && y < F.height) rvSet(y * F.width + x, 0, pt.changes);
    }
  }
  // steps from tile a to tile b through edge neighbours, so a fast drag still leaves a joined river
  function rvWalk(pt, a, b) {
    const DX = b.tx - a.tx, DY = b.ty - a.ty, sx = Math.sign(DX), sy = Math.sign(DY);
    const off = (x, y) => Math.abs((x - a.tx) * DY - (y - a.ty) * DX); // distance from the straight line
    let tx = a.tx, ty = a.ty;
    while (tx !== b.tx || ty !== b.ty) {
      if (ty === b.ty || (tx !== b.tx && off(tx + sx, ty) <= off(tx, ty + sy))) tx += sx; else ty += sy;
      rvAt(pt, tx, ty);
    }
  }
  function rvPointerDown(e) {
    if (rvShape() === 'curve' && !rvTileMode()) return rvCurveDown(e);
    const m = screenToMap(e.offsetX, e.offsetY);
    if (!m) return null;
    rvInit();
    const t = pcTileAt(m);
    const swap = { draw: 'erase', erase: 'draw', ford: 'unford', bridge: 'unbridge' };
    const pt = { type: 'river', mode: e.shiftKey ? swap[rvMode] : rvMode, size: rvSize, changes: new Map(), start: t, last: t };
    rvAt(pt, t.tx, t.ty);
    rvShow();
    return pt;
  }
  function rvPointerMove(pt, sx, sy) {
    if (pt.curve) { rvCurveMove(pt, sx, sy); return; }
    const m = screenToMap(sx, sy);
    if (!m) { pt.last = null; return; }
    const t = pcTileAt(m);
    if (!pt.last) rvAt(pt, t.tx, t.ty); else if (t.tx !== pt.last.tx || t.ty !== pt.last.ty) rvWalk(pt, pt.last, t);
    pt.last = t;
    rvShow();
  }
  function rvPointerUp(pt) {
    if (pt.curve) { renderRiverPanel(); return; }
    if (pt.changes.size && pt.mode !== 'bridge' && pt.mode !== 'unbridge') rvFixSources(pt);
    if (pt.mode === 'bridge' && pt.changes.size) rvCheckBridge(pt);
    const rv = state.project.riv, px = [];
    for (const [i, a] of pt.changes) if (a !== rv.kind[i]) px.push([i, a, rv.kind[i]]);
    if (!px.length) { rvShow(); return; }
    state.undo.push({ t: new Map(), rv: { px } });
    state.redo = [];
    rvChanged();
  }
  // a land bridge the game can use runs from land over the sea to land; say so when a new one doesn't
  function rvCheckBridge(pt) {
    const F = state.project.features, K = state.project.riv.kind, W = F.width, H = F.height;
    const seen = new Set();
    for (const s of pt.changes.keys()) {
      if (K[s] !== 4 || seen.has(s)) continue;
      const comp = [s]; seen.add(s);
      for (let h = 0; h < comp.length; h++) {
        const x = comp[h] % W, y = (comp[h] / W) | 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx, ny = y + dy, j = ny * W + nx;
          if (nx >= 0 && ny >= 0 && nx < W && ny < H && K[j] === 4 && !seen.has(j)) { seen.add(j); comp.push(j); }
        }
      }
      const sea = comp.filter((i) => rvSea(i)).length, land = comp.length - sea;
      if (!sea) toast('This land bridge has no sea tile in it. Drag from one shore, over the sea, to the other.', 'err', 5000);
      else if (land < 2) toast('A land bridge needs a land tile at each end. Drag from one shore, over the sea, to the other.', 'err', 5000);
    }
  }
  // around the changed tiles: a source in the middle of a river becomes river, and a river left
  // without any source gets one at its end farthest from the sea (or where the drag started)
  function rvFixSources(pt) {
    const F = state.project.features, rv = state.project.riv, W = F.width, H = F.height, K = rv.kind;
    const R = (i) => K[i] > 0 && K[i] < 4; // river tiles (a land bridge is not one)
    const nb = (i) => { const x = i % W, y = (i / W) | 0, o = []; if (y > 0) o.push(i - W); if (x < W - 1) o.push(i + 1); if (y < H - 1) o.push(i + W); if (x > 0) o.push(i - 1); return o; };
    const seeds = new Set();
    for (const i of pt.changes.keys()) { if (R(i)) seeds.add(i); for (const j of nb(i)) if (R(j)) seeds.add(j); }
    const done = new Set();
    for (const s of seeds) {
      if (done.has(s)) continue;
      const comp = [s]; done.add(s);
      for (let h = 0; h < comp.length; h++) for (const j of nb(comp[h])) if (R(j) && !done.has(j)) { done.add(j); comp.push(j); }
      const deg = (i) => nb(i).filter((j) => R(j)).length;
      for (const i of comp) if (K[i] === 3 && deg(i) >= 2) rvSet(i, 1, pt.changes);
      if (comp.some((i) => K[i] === 3)) continue;
      const ends = comp.filter((i) => deg(i) <= 1);
      if (!ends.length) continue;
      // distance along the river from its mouth (tiles beside the sea)
      const inComp = new Set(comp), dist = new Map(), q = comp.filter((i) => nb(i).some((j) => rvSea(j)));
      for (const i of q) dist.set(i, 0);
      for (let h = 0; h < q.length; h++) for (const j of nb(q[h])) if (inComp.has(j) && !dist.has(j)) { dist.set(j, dist.get(q[h]) + 1); q.push(j); }
      let src;
      if (q.length) src = ends.reduce((a, b) => ((dist.get(b) ?? -1) > (dist.get(a) ?? -1) ? b : a));
      else {
        const st = pt.start && pt.start.ty * W + pt.start.tx;
        src = ends.includes(st) ? st : ends[0];
      }
      if (q.length && dist.get(src) === 0 && comp.length > 1) continue; // both ends at the sea
      rvSet(src, 3, pt.changes);
    }
  }
  // ---- Curve: the points are map positions; the line through them (Catmull-Rom) is laid tile by tile
  const rvScr = (x, y) => {
    if (!is3D()) return view.toScreen(x, y);
    const P = state.project;
    return view.project3D(x, y, view.heightAt(Math.max(0, Math.min(x, P.W - 1)), Math.max(0, Math.min(y, P.H - 1))));
  };
  function rvCurvePath(pts) {
    if (pts.length < 2) return pts.slice();
    const out = [pts[0]];
    for (let k = 0; k < pts.length - 1; k++) {
      const p0 = pts[Math.max(0, k - 1)], p1 = pts[k], p2 = pts[k + 1], p3 = pts[Math.min(pts.length - 1, k + 2)];
      const n = Math.max(2, Math.ceil(Math.hypot(p2.x - p1.x, p2.y - p1.y) / 0.25));
      for (let j = 1; j <= n; j++) {
        const t = j / n, t2 = t * t, t3 = t2 * t;
        const f = (a, b, c, d) => 0.5 * (2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (3 * b - a - 3 * c + d) * t3);
        out.push({ x: f(p0.x, p1.x, p2.x, p3.x), y: f(p0.y, p1.y, p2.y, p3.y) });
      }
    }
    return out;
  }
  // puts the tiles under the curve back as they were (the curve is only shown until it is kept)
  function rvCurveUndoTiles() {
    const c = rvCurve, F = state.project.features, rv = state.project.riv;
    for (const [i, k] of c.changes) {
      rv.kind[i] = k;
      const col = M2.RIVER_RGB[k] || [0, 0, 0];
      F.data[i * 4] = col[0]; F.data[i * 4 + 1] = col[1]; F.data[i * 4 + 2] = col[2]; F.data[i * 4 + 3] = 255;
    }
    c.changes = new Map();
  }
  function rvCurveLay() {
    const c = rvCurve;
    rvCurveUndoTiles();
    const pt = { mode: c.mode, size: c.size, changes: c.changes };
    let last = null;
    for (const q of rvCurvePath(c.pts)) {
      const t = pcTileAt(q);
      if (!last) rvAt(pt, t.tx, t.ty); else if (t.tx !== last.tx || t.ty !== last.ty) rvWalk(pt, last, t);
      last = t;
    }
    const rv = state.project.riv;
    rv.edited = rv.kind.some((k, i) => k !== rv.orig[i]);
    rvShow();
    drawOverlay();
  }
  function rvCurveHit(sx, sy) {
    if (!rvCurveLive()) return -1;
    let best = -1, bd = 10;
    rvCurve.pts.forEach((q, k) => { const s = rvScr(q.x, q.y); if (s) { const d = Math.hypot(s.x - sx, s.y - sy); if (d <= bd) { bd = d; best = k; } } });
    return best;
  }
  function rvCurveDown(e) {
    const now = performance.now(), dbl = rvLastClick && now - rvLastClick.t < 400 && Math.hypot(e.offsetX - rvLastClick.x, e.offsetY - rvLastClick.y) < 8;
    rvLastClick = { t: now, x: e.offsetX, y: e.offsetY };
    if (dbl && rvCurve) { rvLastClick = null; rvCurveCommit(); return null; }
    const hit = rvCurveHit(e.offsetX, e.offsetY);
    if (hit >= 0) return { type: 'river', curve: true, idx: hit };
    const m = screenToMap(e.offsetX, e.offsetY);
    if (!m) return null;
    rvInit();
    if (!rvCurveLive()) rvCurve = { p: state.project, mode: e.shiftKey ? (rvMode === 'draw' ? 'erase' : 'draw') : rvMode, size: rvSize, pts: [], changes: new Map() };
    rvCurve.pts.push({ x: m.x, y: m.y });
    rvCurveLay();
    renderRiverPanel();
    return { type: 'river', curve: true, idx: rvCurve.pts.length - 1 };
  }
  function rvCurveMove(pt, sx, sy) {
    if (!rvCurve || !rvCurve.pts[pt.idx]) return;
    const m = screenToMap(sx, sy);
    if (!m) return;
    rvCurve.pts[pt.idx] = { x: m.x, y: m.y };
    rvCurveLay();
  }
  function rvCurvePop() {
    if (!rvCurveLive()) return;
    rvCurve.pts.pop();
    if (!rvCurve.pts.length) { rvCurveCancel(); return; }
    rvCurveLay();
    renderRiverPanel();
  }
  function rvCurveCancel() {
    if (!rvCurveLive()) return;
    rvCurveUndoTiles();
    rvCurve = null;
    const rv = state.project && state.project.riv;
    if (rv) rv.edited = rv.kind.some((k, i) => k !== rv.orig[i]);
    rvShow();
    renderRiverPanel();
  }
  // keeps the curve: one undo step, with a source added as for a drawn river
  function rvCurveCommit() {
    if (!rvCurveLive()) return;
    const c = rvCurve;
    rvCurve = null;
    if (!state.project || !state.project.riv) return;
    const s0 = c.pts[0] && pcTileAt(c.pts[0]);
    rvPointerUp({ type: 'river', mode: c.mode, size: c.size, changes: c.changes, start: s0 });
    renderRiverPanel();
  }

  function rvApply(rec, undo) {
    rvInit();
    const changes = new Map();
    for (const [i, a, b] of rec.px) rvSet(i, undo ? a : b, changes);
    rvChanged();
  }
  let rvFrame = 0;
  // the map view shows the change at once; the 3D river pieces follow when the drag ends
  // the 3D river pieces, again as soon as the last update is done (so they keep up with the drag)
  let rvTilesBusy = false, rvTilesAgain = false;
  function rvTilesLive() {
    if (!S().tileModels || !state.project) return;
    if (rvTilesBusy) { rvTilesAgain = true; return; }
    rvTilesBusy = true;
    loadTileModels().catch((e) => console.warn(e)).finally(() => {
      rvTilesBusy = false;
      if (rvTilesAgain) { rvTilesAgain = false; rvTilesLive(); }
    });
  }
  function rvShow() {
    rvTilesLive();
    if (rvFrame) return;
    rvFrame = requestAnimationFrame(() => {
      rvFrame = 0;
      const F = state.project && state.project.features;
      if (F) view.setFeatures(F.width, F.height, F.data);
    });
  }
  function rvChanged() {
    const rv = state.project.riv;
    rv.dirty = true;
    rv.edited = rv.kind.some((k, i) => k !== rv.orig[i]);
    rvShow();
    updateButtons();
    renderRiverPanel();
    rvTilesLive();
  }
  // map.rwm's pieces with the river pieces worked out again around the edited tiles
  function rvTileIds(ids, Wt, Ht) {
    const rv = state.project.riv;
    if (!rv || !rv.edited || rv.kind.length !== Wt * Ht) return ids;
    const near = new Uint8Array(Wt * Ht);
    for (let i = 0; i < rv.kind.length; i++) {
      if (rv.kind[i] === rv.orig[i]) continue;
      const x0 = i % Wt, y0 = (i / Wt) | 0;
      for (let y = Math.max(0, y0 - 2); y <= Math.min(Ht - 1, y0 + 2); y++) for (let x = Math.max(0, x0 - 2); x <= Math.min(Wt - 1, x0 + 2); x++) near[y * Wt + x] = 1;
    }
    return M2.riverLinks(rv.kind, Wt, Ht, rvSea, ids, (i) => !near[i]);
  }
  function drawRiverCursor() {
    if (state.tool !== 'rivers' || !state.project || spaceDown) return;
    if (rvShape() === 'curve' && !rvTileMode()) { drawRiverCurve(); return; }
    if (!lastMouse) return;
    if (pointer && pointer.type !== 'river') return;
    const m = screenToMap(lastMouse.x, lastMouse.y);
    if (!m) return;
    const t = pcTileAt(m);
    // a faint grid of the tiles around the pointer, so it is clear which tile gets painted
    if (view.view.scale * 2 >= 6 || is3D()) {
      octx.save();
      octx.lineWidth = 1; octx.strokeStyle = 'rgba(255,255,255,.22)';
      const R = 6;
      octx.beginPath();
      for (let k = -R; k <= R + 1; k++) {
        for (const [ax, ay, bx, by] of [[t.tx + k, t.ty - R, t.tx + k, t.ty + R + 1], [t.tx - R, t.ty + k, t.tx + R + 1, t.ty + k]]) {
          for (let j = 0; j <= 2 * R + 1; j++) {
            const x = 2 * (ax + (bx - ax) * j / (2 * R + 1)), y = 2 * (ay + (by - ay) * j / (2 * R + 1));
            const s = rvScr(x, y);
            if (!s) continue;
            if (j) octx.lineTo(s.x, s.y); else octx.moveTo(s.x, s.y);
          }
        }
      }
      octx.stroke();
      octx.restore();
    }
    const mode = pointer ? pointer.mode : rvMode, erase = mode === 'erase', ford = mode === 'ford' || mode === 'unford', bridge = mode === 'bridge' || mode === 'unbridge';
    const r = erase ? ((pointer ? pointer.size : rvSize) - 1) >> 1 : 0;
    const x0 = 2 * (t.tx - r), y0 = 2 * (t.ty - r), x1 = 2 * (t.tx + r + 1), y1 = 2 * (t.ty + r + 1);
    const pts = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]].map(([x, y]) => is3D() ? view.project3D(x, y, view.heightAt(Math.min(x, state.project.W - 1), Math.min(y, state.project.H - 1))) : view.toScreen(x, y));
    if (pts.some((s) => !s)) return;
    octx.save();
    octx.lineWidth = 1.5;
    octx.strokeStyle = erase ? 'rgba(255,120,110,.95)' : ford ? 'rgba(90,255,255,.95)' : bridge ? 'rgba(90,255,110,.95)' : 'rgba(120,190,255,.95)';
    octx.beginPath(); pts.forEach((s, k) => (k ? octx.lineTo(s.x, s.y) : octx.moveTo(s.x, s.y))); octx.closePath(); octx.stroke();
    octx.fillStyle = '#fff'; octx.font = '12px Segoe UI';
    const F = state.project.features, rk = state.project.riv && t.tx >= 0 && t.ty >= 0 && t.tx < F.width && t.ty < F.height ? state.project.riv.kind[t.ty * F.width + t.tx] : 0;
    const label = erase ? 'erase river' : mode === 'draw' ? 'draw river'
      : mode === 'bridge' ? (rk === 4 ? 'land bridge (Shift + drag removes it)' : rk ? 'not on a river' : 'land bridge')
      : mode === 'unbridge' ? (rk === 4 ? 'remove land bridge' : 'no land bridge here')
      : mode === 'unford' ? (rk === 2 ? 'remove crossing' : 'no crossing here')
      : rk === 1 ? 'add crossing' : rk === 2 ? 'crossing (Shift + click removes it)' : 'crossings go on a river';
    octx.fillText(label, lastMouse.x + 10, lastMouse.y - 10);
    octx.restore();
  }
  function drawRiverCurve() {
    const c = rvCurveLive(), erase = c ? c.mode === 'erase' : rvMode === 'erase';
    const col = erase ? 'rgba(255,120,110,.95)' : 'rgba(120,190,255,.95)';
    octx.save();
    octx.lineWidth = 2; octx.strokeStyle = col;
    if (c && c.pts.length) {
      // the line through the points
      octx.beginPath();
      let on = false;
      for (const q of rvCurvePath(c.pts)) { const s = rvScr(q.x, q.y); if (!s) { on = false; continue; } if (on) octx.lineTo(s.x, s.y); else octx.moveTo(s.x, s.y); on = true; }
      octx.stroke();
      // from the last point to the pointer: where the next click continues it
      const m = lastMouse && !pointer && screenToMap(lastMouse.x, lastMouse.y), e0 = c.pts[c.pts.length - 1], a = rvScr(e0.x, e0.y);
      if (m && a) { octx.setLineDash([5, 5]); octx.beginPath(); octx.moveTo(a.x, a.y); octx.lineTo(lastMouse.x, lastMouse.y); octx.stroke(); octx.setLineDash([]); }
      for (const q of c.pts) {
        const s = rvScr(q.x, q.y);
        if (!s) continue;
        octx.beginPath(); octx.arc(s.x, s.y, 5, 0, Math.PI * 2);
        octx.fillStyle = '#fff'; octx.fill(); octx.stroke();
      }
    }
    if (lastMouse && !pointer) {
      octx.fillStyle = '#fff'; octx.font = '12px Segoe UI';
      const hit = rvCurveHit(lastMouse.x, lastMouse.y) >= 0;
      const txt = hit ? 'drag to move the point' : c && c.pts.length ? 'click: next point · Enter or double-click: lay it' : (erase ? 'click: start erasing along a curve' : 'click: start a river curve');
      octx.fillText(txt, lastMouse.x + 12, lastMouse.y - 10);
    }
    octx.restore();
  }
  function renderRiverPanel() {
    const box = $('#riverPanel');
    if (!box) return;
    box.hidden = state.tool !== 'rivers' || !state.project;
    if (box.hidden) return;
    box.textContent = '';
    box.append(el('div', { class: 'cp-head' },
      el('b', { text: 'Rivers' }),
      el('span', { class: 'cp-help', text: rvMode === 'ford' ? 'Click river tiles to make crossings (cyan). Shift + click turns one back into river.' : rvMode === 'bridge' ? 'Drag from land, over the sea, to land (green tiles). Shift + drag removes them.' : rvShape() === 'curve' ? 'Click points along the river. Shift + click starts the other one.' : 'Paint tile by tile. Shift + drag does the other one.' }),
      el('button', { class: 'ramp-x', title: 'Back to the brush', text: '×', onclick: () => setTool('brush') })));
    const seg = el('div', { class: 'seg pc-modes' });
    for (const [m, t, tip] of [['draw', 'Draw', 'Drag to lay a river one tile wide (not on sea)'], ['erase', 'Erase', 'Drag to remove rivers, fords, sources and land bridges'], ['ford', 'Crossing', 'Click a river tile to make it a crossing (ford) armies can walk over. Shift + click turns a crossing back into river'], ['bridge', 'Land bridge', 'Drag from one shore over the sea to the other: armies can walk across there (green in map_features.tga). Shift + drag removes it']]) {
      seg.append(el('button', { text: t, title: tip, class: rvMode === m ? 'active' : '', onclick: () => { if (m === 'ford' || m === 'bridge') rvCurveCommit(); rvMode = m; renderRiverPanel(); drawOverlay(); } }));
    }
    box.append(seg);
    const shp = el('div', { class: 'seg pc-modes' });
    for (const [m, t, tip] of [['pencil', 'Pencil', 'Paints exactly the tiles you drag over, one at a time'], ['curve', 'Curve', 'Click points; a smooth river is laid through them']]) {
      shp.append(el('button', { text: t, title: tip, class: rvShape() === m ? 'active' : '', onclick: () => setRiverShape(m) }));
    }
    if (!rvTileMode()) box.append(shp);
    if (rvShape() === 'curve' && !rvTileMode()) {
      const n = rvCurveLive() ? rvCurve.pts.length : 0;
      box.append(el('div', { class: 'cp-note', text: n ? `${n} point${n === 1 ? '' : 's'}. Drag a point to move it, Backspace takes the last one back, Enter or double-click lays it, Esc drops it.` : 'Click to place the first point, then click along the river. The tiles follow as you go.' }));
      if (n) box.append(el('div', { class: 'seg pc-modes' },
        el('button', { text: rvCurve.mode === 'erase' ? 'Erase along it' : 'Lay the river', class: 'active', onclick: () => { rvCurveCommit(); drawOverlay(); } }),
        el('button', { text: 'Drop it', onclick: () => { rvCurveCancel(); drawOverlay(); } })));
    }
    if (rvMode === 'erase') {
      const sz = el('div', { class: 'seg pc-modes' });
      for (const n of [1, 3, 5]) sz.append(el('button', { text: `${n} × ${n} tiles`, class: rvSize === n ? 'active' : '', onclick: () => { rvSize = n; renderRiverPanel(); drawOverlay(); } }));
      box.append(sz);
    }
    const rwm = S().rebuildRwm ? ' and moves map.rwm aside so the game lays the new rivers' : '. Turn on "Move map.rwm aside when saving" in Settings, or the game keeps showing the old rivers';
    box.append(el('div', { class: 'cp-note', text: `A new river gets a source (white) at its inland end. Save writes map_features.tga with a backup${rwm}.` }));
  }

  // ---------------------------------------------------------------- tile models
  // The game's tile models (data/terrain/aerial_map/tile_models, laid out by descr_aerial_map_tile_models.txt):
  // river channels and their water, hills, cliffs, mountains, volcanoes and walls, one piece a tile. The
  // game picks the pieces while it builds map.rwm and stores the choice there, so they are read from it and
  // land exactly where the game puts them. Without a map.rwm (it is rebuilt by the game after the map
  // images change) none are drawn.
  async function loadTileModels() {
    const p = state.project;
    if (!p || !view) return;
    const J = M2.join, loc = p.loc, s = S();
    const watch = [];
    const out = { count: 0, note: '', missing: [], sets: {}, sample: {} };
    // parsed models, pictures and built pieces are kept between calls (the River tool redraws while you drag);
    // emptied when a tile model file changes on disk or another map is opened
    if (!p.tileCache) p.tileCache = { dirs: new Map(), pics: new Map(), raw: new Map(), pages: {}, sets: new Map(), parts: new Map(), descr: null, descrFile: null, watch: [], missing: [], usedBy: new Map(), textures: null, gen: Date.now() };
    await tileManifest().catch((e) => console.warn('tile texture manifest', e));
    const TC = p.tileCache;
    const finish = (t) => { view.setTileModels(t); p.tiles = { watch: [...new Set([...watch, ...TC.watch])], ...out }; };
    if (!s.tileModels || !p.regions) return finish(null);
    const dataCands = (...rel) => [J(loc.dataDir, ...rel), loc.gameDataDir && J(loc.gameDataDir, ...rel)].filter(Boolean);
    const rwmCands = [J(p.mapDir, 'map.rwm'), J(loc.baseMapDir, 'map.rwm')];
    const descrCands = dataCands('descr_aerial_map_tile_models.txt');
    watch.push(...rwmCands, ...descrCands);
    // which files to read is looked up once (a change on disk empties the cache), so redraws while you drag stay quick
    if (!TC.files) {
      const fRwm = await M2.firstExisting(rwmCands), fDescr = await M2.firstExisting(descrCands);
      const st = fRwm && await host.stat(fRwm);
      TC.files = { fRwm, fDescr, rwmKey: fRwm ? `${norm(fRwm)}|${st && st.size}|${st && st.mtimeMs}` : '' };
    }
    const { fRwm, fDescr, rwmKey } = TC.files;
    if (!fDescr) { out.note = 'descr_aerial_map_tile_models.txt was not found.'; return finish(null); }
    if (!fRwm) { out.note = 'This map has no map.rwm yet (the game builds it on its next start), so the hills, rivers and cliffs it places are not drawn.'; return finish(null); }
    // map.rwm is kept between reloads
    if (!p.rwmCache || p.rwmCache.key !== rwmKey) p.rwmCache = { key: rwmKey, tiles: M2.readRwmTiles(await host.read(fRwm)) };
    const tiles = p.rwmCache.tiles && { ...p.rwmCache.tiles };
    const Wt = p.regions.width, Ht = p.regions.height;
    if (!tiles) { out.note = 'map.rwm could not be read.'; return finish(null); }
    if (tiles.width !== Wt || tiles.height !== Ht) { out.note = `map.rwm is for a ${tiles.width} x ${tiles.height} map, this one is ${Wt} x ${Ht}; start the game once to rebuild it.`; return finish(null); }
    tiles.ids = rvTileIds(tiles.ids, Wt, Ht);
    if (TC.descrFile !== fDescr) { TC.descr = M2.parseTileModels(await host.readText(fDescr)); TC.descrFile = fDescr; }
    const d = TC.descr;

    // 'terrain/aerial_map/x' -> the file, mod first, then the game (names in any case)
    const dirCache = TC.dirs;
    const listDir = (dir) => {
      const key = norm(dir);
      if (!dirCache.has(key)) dirCache.set(key, host.list(dir).then((l) => new Map(l.map((e) => [e.name.toLowerCase(), e])), () => new Map()));
      return dirCache.get(key);
    };
    const findData = async (rel) => {
      const parts = rel.split('/');
      for (const base of [loc.dataDir, loc.gameDataDir].filter(Boolean)) {
        let dir = base, ok = true;
        for (let i = 0; i < parts.length && ok; i++) {
          const e = (await listDir(dir)).get(parts[i].toLowerCase());
          if (!e || (i < parts.length - 1 && !e.isDir)) ok = false;
          else dir = J(dir, e.name);
        }
        if (ok) return dir;
      }
      return null;
    };
    // orig: a picture Save recoloured is read from its untouched original (the colour is put on in the painter)
    const readPic = async (rels, orig) => {
      for (const rel of rels) {
        const f = await findData(rel);
        if (!f) continue;
        const st = await host.stat(f);
        if (!st || !st.size) continue;
        try { const img = await Images.decodeAny(await host.read(orig ? tileOriginal(f) : f), f); TC.watch.push(f); return img; } catch (e) { console.warn('tile picture', f, e); }
      }
      return null;
    };

    // which pieces are used, and where
    const used = new Map(); // set -> Map(link -> [x, y, ...])
    const ids = tiles.ids;
    for (let ty = 0; ty < Ht; ty++) for (let tx = 0; tx < Wt; tx++) {
      const id = ids[ty * Wt + tx];
      if (id === 0xffff || id >= M2.TILE_LINK_LIST.length) continue;
      const [sn, ln] = M2.TILE_LINK_LIST[id];
      if (!used.has(sn)) used.set(sn, new Map());
      const m = used.get(sn);
      if (!m.has(ln)) m.set(ln, []);
      m.get(ln).push(tx, ty);
    }
    // every river piece is built once, so a drawn river never needs new ones (the view then only moves them)
    if (d.sets.river_a) {
      if (!used.has('river_a')) used.set('river_a', new Map());
      for (const ln of Object.keys(d.sets.river_a.links)) if (!used.get('river_a').has(ln)) used.get('river_a').set(ln, []);
    }

    const AM = 'terrain/aerial_map/';
    const pages = TC.pages, partsByKey = TC.parts, cover = new Uint8Array(Wt * Ht);
    const picCache = TC.pics;
    for (const pt of partsByKey.values()) if (pt) pt.list = [];
    for (const [sn, links] of used) {
      const set = d.sets[sn];
      if (!set) { out.missing.push(`tile set ${sn}`); continue; }
      // the set's objects, from all of its model files (tile_models/<set>/<file>)
      let objs = TC.sets.get(sn);
      if (!objs) {
        objs = new Map();
        for (const mf of set.models) {
          const f = await findData(`${AM}tile_models/${sn}/${mf}`);
          if (!f) { TC.missing.push(`${sn}/${mf}`); continue; }
          TC.watch.push(f);
          try {
            const cas = CAS.parse(await host.read(f));
            for (const o of cas.objects) if (!objs.has(o.name.toLowerCase())) objs.set(o.name.toLowerCase(), { o, mat: cas.materials[o.material] });
          } catch (e) { TC.missing.push(`${sn}/${mf} (${e.message})`); }
        }
        TC.sets.set(sn, objs);
      }
      const upN = set.flags.includes('underlay_up_normals');
      const fit = set.flags.includes('allow_unsmooth_underlays');
      const part = async (objName, kind, ov) => {
        const key = `${sn}/${objName}/${kind}`;
        if (partsByKey.has(key)) return partsByKey.get(key);
        const hit = objs.get(objName);
        let pt = null;
        if (hit && hit.o.idx.length) {
          const o = hit.o;
          let image = null;
          if (kind === 'over') {
            const tn = hit.mat && hit.mat.texture ? hit.mat.texture.replace(/\\/g, '/').split('/').pop().toLowerCase() : '';
            if (hit.mat && hit.mat.image) image = Images.decodeTGA(hit.mat.image);
            else if (tn) {
              if (!picCache.has(tn)) {
                const raw = readPic([`${AM}tile_textures/${tn}.dds`, `${AM}tile_textures/${tn}`, `${AM}tile_models/${sn}/textures/${tn}.dds`, `${AM}tile_models/${sn}/textures/${tn}`], true);
                TC.raw.set(tn, raw);
                picCache.set(tn, raw.then((img) => tileAdjImage(tn, img)));
              }
              if (!TC.usedBy.has(tn)) TC.usedBy.set(tn, new Set());
              TC.usedBy.get(tn).add(sn);
              image = await picCache.get(tn);
            }
            if (!image) out.missing.push(`${sn} picture ${tn || objName}`);
          }
          let page = null;
          if (ov && ov.page && d.pages[ov.page.name]) {
            const pg = d.pages[ov.page.name];
            const pk = String(pg.filename).toLowerCase();
            if (!TC.usedBy.has(pk)) TC.usedBy.set(pk, new Set());
            TC.usedBy.get(pk).add(sn);
            if (!(ov.page.name in pages)) pages[ov.page.name] = await readPic([`${AM}tile_models/alpha_pages/${pg.filename}`, `${AM}tile_models/alpha_pages/${pg.filename}.dds`]);
            if (pages[ov.page.name]) page = { name: ov.page.name, col: ov.page.col, row: pg.up - 1 - ov.page.row, turns: Math.round(ov.page.rot / 90) & 3, across: pg.across, up: pg.up };
          }
          // the game's north is +z and the app's map runs south: mirror z, as for the other models
          let pos = Array.from(o.pos), nrm = Array.from(o.nrm), uv = Array.from(o.uv), idx = Array.from(o.idx);
          for (let i = 2; i < pos.length; i += 3) { pos[i] = -pos[i]; nrm[i] = -nrm[i]; }
          if (kind === 'under') {
            // a short skirt down from the tile's border edges hides cracks against the ground beside it
            const count = new Map();
            for (let t = 0; t < idx.length; t += 3) for (let k = 0; k < 3; k++) {
              const a = idx[t + k], b = idx[t + (k + 1) % 3], ek = a < b ? a * 65536 + b : b * 65536 + a;
              count.set(ek, (count.get(ek) || 0) + 1);
            }
            const onBorder = (v) => Math.abs(Math.abs(pos[v * 3]) - 0.5) < 0.01 || Math.abs(Math.abs(pos[v * 3 + 2]) - 0.5) < 0.01;
            for (const [ek, n] of count) {
              if (n !== 1) continue;
              const a = Math.floor(ek / 65536), b = ek % 65536;
              if (!onBorder(a) || !onBorder(b) || pos.length / 3 + 2 > 65000) continue;
              const na = pos.length / 3, nb = na + 1;
              pos.push(pos[a * 3], pos[a * 3 + 1] - 0.04, pos[a * 3 + 2], pos[b * 3], pos[b * 3 + 1] - 0.04, pos[b * 3 + 2]);
              nrm.push(nrm[a * 3], nrm[a * 3 + 1], nrm[a * 3 + 2], nrm[b * 3], nrm[b * 3 + 1], nrm[b * 3 + 2]);
              uv.push(0, 0, 0, 0);
              idx.push(a, b, nb, a, nb, na);
            }
          }
          pt = { key, gen: TC.gen, kind, upN, fit, page, image, pos: new Float32Array(pos), nrm: new Float32Array(nrm), uv: new Float32Array(uv), idx: new Uint16Array(idx), list: [] };
        } else out.missing.push(`${sn} object ${objName}`);
        partsByKey.set(key, pt);
        return pt;
      };
      for (const [ln, spots] of links) {
        const L = set.links[ln], g = L && set.geoms[L.geom];
        if (!g) { out.missing.push(`${sn} link ${ln}`); continue; }
        const turn = L.rot * Math.PI / 180;
        const under = await part(g.obj, 'under', null);
        const ovs = [];
        for (const ov of set.overlays[g.obj] || []) {
          if (ov.lava) continue;
          const pt = await part(ov.obj, ov.water ? 'water' : 'over', ov);
          if (pt) ovs.push(pt);
        }
        for (let i = 0; i < spots.length; i += 2) {
          const tx = spots[i], ty = spots[i + 1], x = 2 * tx + 1, y = 2 * ty + 1;
          out.sets[sn] = (out.sets[sn] || 0) + 1;
          const smp = out.sample[sn] = out.sample[sn] || [];
          if (smp.length < 64) smp.push([x, y, ln]);
          if (under) { under.list.push(x, y, turn, 0); cover[ty * Wt + tx] = 1; }
          for (const pt of ovs) pt.list.push(x, y, turn, 0);
          out.count++;
        }
      }
    }
    const parts = [...partsByKey.values()].filter(Boolean).map((pt) => ({ ...pt, inst: new Float32Array(pt.list) }));
    const shownPages = {};
    for (const k of Object.keys(pages)) if (pages[k]) shownPages[k] = pages[k];
    out.missing = [...new Set([...TC.missing, ...out.missing])];
    if (out.missing.length) console.warn('tile models not found:', out.missing.join(', '));
    // every tile model picture (tile_textures and the alpha pages), the mod's first, for the key; kept until
    // one of them changes on disk (the cache is emptied then and the key shows the new picture)
    if (!TC.textures) {
      const list = [], seen = new Set();
      for (const base of [loc.dataDir, loc.gameDataDir].filter(Boolean)) for (const sub of [['tile_textures'], ['tile_models', 'alpha_pages']]) {
        const dir = J(base, 'terrain', 'aerial_map', ...sub);
        for (const [lname, e] of await listDir(dir)) {
          if (e.isDir || !/\.(tga|dds)$/i.test(lname)) continue;
          const k = lname.replace(/\.dds$/, '');
          if (seen.has(k)) continue;
          seen.add(k);
          const f = J(dir, e.name);
          let thumb = '';
          try { thumb = Images.thumbnail(await Images.decodeAny(await host.read(f), f), 96); } catch (err) { console.warn('tile picture', f, err); }
          list.push({ name: e.name, key: k, file: f, page: !!sub[1], thumb, sets: [...(TC.usedBy.get(k) || [])] });
        }
      }
      TC.textures = list;
    }
    watch.push(...TC.textures.map((t) => t.file));
    out.textures = TC.textures;
    finish({ parts, pages: shownPages, cover });
    if (state.tileKeyShown !== TC.textures) { state.tileKeyShown = TC.textures; buildKey(); }
  }

  // ---------------------------------------------------------------- game look (3D)
  // The pictures the game's campaign map shaders read: the blend templates that decide how neighbouring
  // ground types mix, the sea's wave normals, sky reflection and colour map, and the campaign's
  // starting positions (for the fog of war).
  async function loadGameAssets() {
    const p = state.project;
    if (!p || !view) return;
    const J = M2.join, loc = p.loc;
    const dataCands = (...rel) => [J(loc.dataDir, ...rel), loc.gameDataDir && J(loc.gameDataDir, ...rel)].filter(Boolean);
    const watch = [];
    const readImg = async (cands) => {
      watch.push(...cands);
      const f = await M2.firstExisting(cands);
      if (!f) return null;
      try { return await Images.decodeAny(await host.read(f), f); } catch (e) { console.warn('could not read', f, e); return null; }
    };
    // weights1.tga, weights2.tga… each name is looked for in the mod first, then the game
    const tw = [];
    for (let n = 1; n <= 16; n++) {
      const img = await readImg(dataCands('terrain', 'aerial_map', 'template_weights', `weights${n}.tga`));
      if (!img) break;
      tw.push(img);
    }
    view.setTemplateWeights(tw);
    const sea = ['terrain', 'aerial_map', 'sea'];
    const waves = await readImg(dataCands(...sea, 'waves.tga.dds'));
    const probe = await readImg(dataCands(...sea, 'sky_environment_summer.tga.dds'));
    const seaCands = [J(p.mapDir, 'water_surface.tga'), J(loc.baseMapDir, 'water_surface.tga'),
      loc.gameDataDir && J(loc.gameDataDir, 'world', 'maps', 'base', 'water_surface.tga')].filter(Boolean);
    watch.push(...seaCands);
    const surface = await seaLoad(seaCands);
    view.setSeaTextures({ waves, probe, surface });

    // descr_strat.txt: next to the map, or the main campaign's when the base map is open
    // (the first one that names any factions; a base map's own file is often a placeholder)
    const stratCands = [J(p.mapDir, 'descr_strat.txt'), J(loc.dataDir, 'world', 'maps', 'campaign', 'imperial_campaign', 'descr_strat.txt'), J(loc.baseMapDir, 'descr_strat.txt')];
    // Settings > Campaign picks one campaign's file over the automatic choice
    if (S().stratCampaign) stratCands.unshift(J(loc.dataDir, 'world', 'maps', 'campaign', ...S().stratCampaign.split('/'), 'descr_strat.txt'));
    watch.push(...stratCands);
    p.strat = null;
    for (const f of stratCands) {
      if (!(await host.exists(f))) continue;
      try {
        const st = parseStrat(await host.readText(f));
        if (st.factions.length) { p.strat = st; st.file = f; break; }
      } catch (e) { console.warn('descr_strat.txt', f, e); }
    }
    // ground_albedo_scale (descr_ex.txt, M2EX): brightens the ground textures
    p.albedoScale = 1;
    const exCands = dataCands('descr_ex.txt');
    watch.push(...exCands);
    const fEx = await M2.firstExisting(exCands);
    if (fEx) {
      const m = (await host.readText(fEx)).match(/^\s*ground_albedo_scale\s+([\d.]+)/m);
      if (m && +m[1] > 0) p.albedoScale = +m[1];
    }
    p.gameWatch = [...new Set(watch)];
    try { await pcLoad(); } catch (e) { console.warn('descr_strat.txt for the Pieces tool', e); }
    loadPlaceNames().catch((e) => console.warn('region and settlement names', e));
    applyViewSettings();
    buildFog();
    try { await loadPieces(); } catch (e) { console.error(e); toast('The settlement models could not be loaded: ' + e.message, 'err', 8000); }
    try { await loadTileModels(); } catch (e) { console.error(e); view.setTileModels(null); toast('The hills, rivers and cliffs could not be loaded: ' + e.message, 'err', 8000); }
    if (view.gameError) toast('The game look could not start on this graphics card, so the 3D view uses the simple look: ' + view.gameError, 'err', 10000);
  }

  // descr_strat.txt -> { factions: [{ name, regions, chars: [[x, y]] }], settlements: [{ region, level, faction,
  // buildings: [[chain, level]] }], resources: [{ type, x, y }], forts: [{ x, y, words, faction }],
  // watchtowers: [{ x, y, faction }] }, x and y in tiles from the bottom left
  const STRAT_RES = /^resource\s+([^,\s]+)\s*,?\s*(\d+)\s*,?\s*(\d+)/i;
  const STRAT_FORT = /^fort\s+(\d+)\s*,?\s*(\d+)\s*(.*)$/i;
  const STRAT_TOWER = /^watchtower\s+(\d+)\s*,?\s*(\d+)/i;
  function parseStrat(txt) {
    const factions = [], settlements = [], resources = [], forts = [], watchtowers = [];
    let cur = null, set = null, depth = 0;
    for (const raw of txt.split(/\r?\n/)) {
      const l = raw.replace(/;.*$/, '').trim();
      if (!l) continue;
      let m;
      if (set) {
        if (l === '{') { depth++; continue; }
        if (l === '}') { if (--depth <= 0) set = null; continue; }
        if ((m = l.match(/^level\s+(\S+)/i)) && depth === 1) set.level = m[1].toLowerCase();
        else if ((m = l.match(/^region\s+(\S+)/i))) { set.region = m[1]; if (cur) cur.regions.push(m[1]); }
        else if ((m = l.match(/^type\s+(\S+)\s+(\S+)/i))) set.buildings.push([m[1].toLowerCase(), m[2].toLowerCase()]);
        continue;
      }
      if ((m = l.match(STRAT_RES))) { resources.push({ type: m[1].toLowerCase(), x: +m[2], y: +m[3] }); continue; }
      if ((m = l.match(STRAT_FORT))) { forts.push({ x: +m[1], y: +m[2], words: m[3].toLowerCase().split(/[\s,]+/).filter(Boolean), faction: cur && cur.name }); continue; }
      if ((m = l.match(STRAT_TOWER))) { watchtowers.push({ x: +m[1], y: +m[2], faction: cur && cur.name }); continue; }
      if ((m = l.match(/^faction\s+([^,\s]+)/i))) { cur = { name: m[1], regions: [], chars: [] }; factions.push(cur); continue; }
      if (/^region\s/i.test(l)) { cur = null; continue; } // the regions section: forts there belong to no faction
      if (!cur) continue;
      if (/^settlement\b/i.test(l)) { set = { region: null, level: 'town', castle: /^settlement\s+castle\b/i.test(l), faction: cur.name, buildings: [] }; settlements.push(set); depth = 0; continue; }
      if (/^character\b/i.test(l)) {
        const x = l.match(/\bx\s+(\d+)/i), y = l.match(/\by\s+(\d+)/i);
        if (x && y) cur.chars.push([+x[1], +y[1]]);
      }
    }
    return { factions: factions.filter((f) => f.regions.length || f.chars.length), settlements: settlements.filter((t) => t.region), resources, forts, watchtowers };
  }

  // Fog of war for the chosen faction, one texel per tile: what its settlements and characters can see is
  // clear, the rest takes the game's shroud colour. The game works this out turn by turn from each
  // character's line of sight; this uses the campaign's starting positions and a fixed sight radius.
  // FOG_UNSEEN: how much of the ground shows through the shroud where the faction cannot see (the game
  // also draws drifting cloud over it, which is left out here)
  const SIGHT_CHAR = 10, SIGHT_TOWN = 12, FOG_UNSEEN = 0.3;
  function buildFog() {
    const p = state.project;
    if (!p || !view) return;
    const fac = p.strat && S().fowFaction && p.strat.factions.find((f) => f.name === S().fowFaction);
    const R = p.regions;
    if (!fac || !R) { view.setFog(null); return; }
    const Wt = R.width, Ht = R.height, rd = R.data;
    const own = new Set();
    const nameToRgb = new Map();
    for (const [k, r] of p.regionByColour) nameToRgb.set(r.name.toLowerCase(), k);
    for (const n of fac.regions) { const k = nameToRgb.get(n.toLowerCase()); if (k) own.add(k); }
    const keyAt = (i) => `${rd[i * 4]},${rd[i * 4 + 1]},${rd[i * 4 + 2]}`;
    const seen = new Float32Array(Wt * Ht);
    const eyes = [];
    for (let y = 0, i = 0; y < Ht; y++) {
      for (let x = 0; x < Wt; x++, i++) {
        const k = keyAt(i);
        if (own.has(k)) seen[i] = 1;
        else if (k === '0,0,0') {
          // a settlement: it belongs to the region around it
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const xx = x + dx, yy = y + dy;
            if (xx < 0 || yy < 0 || xx >= Wt || yy >= Ht) continue;
            if (own.has(keyAt(yy * Wt + xx))) { eyes.push([x, y, SIGHT_TOWN]); break; }
          }
        }
      }
    }
    for (const [cx, cy] of fac.chars) eyes.push([cx, Ht - 1 - cy, SIGHT_CHAR]);
    for (const [ex, ey, r] of eyes) {
      const r2 = (r + 1.5) * (r + 1.5);
      for (let y = Math.max(0, Math.floor(ey - r - 2)); y <= Math.min(Ht - 1, ey + r + 2); y++) {
        for (let x = Math.max(0, Math.floor(ex - r - 2)); x <= Math.min(Wt - 1, ex + r + 2); x++) {
          const d2 = (x - ex) * (x - ex) + (y - ey) * (y - ey);
          if (d2 > r2) continue;
          const v = Math.min(1, Math.max(0, r + 1.5 - Math.sqrt(d2)) / 2);
          const i = y * Wt + x;
          if (v > seen[i]) seen[i] = v;
        }
      }
    }
    const data = new Uint8Array(Wt * Ht * 4);
    for (let i = 0; i < Wt * Ht; i++) { data[i * 4] = data[i * 4 + 1] = data[i * 4 + 2] = 255; data[i * 4 + 3] = Math.round((FOG_UNSEEN + (1 - FOG_UNSEEN) * seen[i]) * 255); }
    view.setFog({ width: Wt, height: Ht, data });
  }

  // after painting, once the brush has paused
  function treesChanged() {
    if (!state.project || !state.project.trees) return;
    clearTimeout(treeTimer);
    treeTimer = setTimeout(buildTreeInstances, 250);
  }

  // ---------------------------------------------------------------- names (City names / Region names buttons)
  // The names the game shows, from data\text\<campaign>_regions_and_settlement_names.txt (UTF-16, {key}name)
  // and its .strings.bin, mod first, then the game; a key with no name there is shown as written in
  // descr_regions.txt. Cities sit on their settlement tile, region names in the middle of the region.
  function syncNameButtons() {
    $('#btnCityNames').classList.toggle('active', !!S().cityNames);
    $('#btnRegionNames').classList.toggle('active', !!S().regionNames);
    $('#btnSymbols').classList.toggle('active', !!S().symbols);
    $('#btnBorders').classList.toggle('active', !!S().borders);
  }
  function setNames(which, on) {
    S()[which] = on; saveSettings(); syncNameButtons();
    const p = state.project;
    if (on && p && !p.placeNames) loadPlaceNames().catch((e) => console.warn(e));
    drawOverlay();
  }
  $('#btnCityNames').onclick = () => setNames('cityNames', !S().cityNames);
  $('#btnRegionNames').onclick = () => setNames('regionNames', !S().regionNames);
  $('#btnSymbols').onclick = () => setNames('symbols', !S().symbols);
  $('#btnBorders').onclick = () => { S().borders = !S().borders; saveSettings(); syncNameButtons(); applyViewSettings(); };

  // map symbols: a city on each settlement, a castle on each fort, on round badges of different colours
  function drawCitySymbol(x, y, z) {
    const r = 12 * z;
    octx.beginPath(); octx.arc(x, y, r, 0, Math.PI * 2);
    octx.fillStyle = 'rgba(246,226,170,.97)'; octx.fill();
    octx.lineWidth = 1.5; octx.strokeStyle = '#3b2a10'; octx.stroke();
    const u = r / 10;
    octx.beginPath();
    // three houses with pitched roofs, the middle one a tall church tower
    const house = (x0, x1, top, peak) => { octx.moveTo(x + x0 * u, y + 5 * u); octx.lineTo(x + x0 * u, y + top * u); octx.lineTo(x + (x0 + x1) / 2 * u, y + peak * u); octx.lineTo(x + x1 * u, y + top * u); octx.lineTo(x + x1 * u, y + 5 * u); octx.closePath(); };
    house(-7, -2.5, 0, -3.5); house(-2.2, 2.2, -3, -8.5); house(2.5, 7, 0.5, -3);
    octx.fillStyle = '#7a3418'; octx.fill();
    octx.fillStyle = 'rgba(246,226,170,.97)';
    octx.fillRect(x - 0.8 * u, y + 1.5 * u, 1.6 * u, 3.5 * u); // the church door
  }
  function drawCastleSymbol(x, y, z) {
    const r = 12 * z;
    octx.beginPath(); octx.arc(x, y, r, 0, Math.PI * 2);
    octx.fillStyle = 'rgba(52,58,70,.97)'; octx.fill();
    octx.lineWidth = 1.5; octx.strokeStyle = '#f2f2f2'; octx.stroke();
    const u = r / 10;
    octx.beginPath();
    // a wall between two towers, with battlements
    octx.moveTo(x - 7 * u, y + 5.5 * u);
    octx.lineTo(x - 7 * u, y - 6 * u); octx.lineTo(x - 5.6 * u, y - 6 * u); octx.lineTo(x - 5.6 * u, y - 4.8 * u); octx.lineTo(x - 4.4 * u, y - 4.8 * u); octx.lineTo(x - 4.4 * u, y - 6 * u); octx.lineTo(x - 3 * u, y - 6 * u);
    octx.lineTo(x - 3 * u, y - 2.5 * u); octx.lineTo(x - 2 * u, y - 2.5 * u); octx.lineTo(x - 2 * u, y - 1.5 * u); octx.lineTo(x - 0.5 * u, y - 1.5 * u); octx.lineTo(x - 0.5 * u, y - 2.5 * u);
    octx.lineTo(x + 0.5 * u, y - 2.5 * u); octx.lineTo(x + 0.5 * u, y - 1.5 * u); octx.lineTo(x + 2 * u, y - 1.5 * u); octx.lineTo(x + 2 * u, y - 2.5 * u); octx.lineTo(x + 3 * u, y - 2.5 * u);
    octx.lineTo(x + 3 * u, y - 6 * u); octx.lineTo(x + 4.4 * u, y - 6 * u); octx.lineTo(x + 4.4 * u, y - 4.8 * u); octx.lineTo(x + 5.6 * u, y - 4.8 * u); octx.lineTo(x + 5.6 * u, y - 6 * u); octx.lineTo(x + 7 * u, y - 6 * u);
    octx.lineTo(x + 7 * u, y + 5.5 * u); octx.closePath();
    octx.fillStyle = '#ececec'; octx.fill();
    // the gate
    octx.beginPath(); octx.moveTo(x - 1.8 * u, y + 5.5 * u); octx.lineTo(x - 1.8 * u, y + 2 * u); octx.arc(x, y + 2 * u, 1.8 * u, Math.PI, 0); octx.lineTo(x + 1.8 * u, y + 5.5 * u); octx.closePath();
    octx.fillStyle = 'rgba(52,58,70,1)'; octx.fill();
  }

  function drawPortSymbol(x, y, z) {
    const r = 10 * z;
    octx.beginPath(); octx.arc(x, y, r, 0, Math.PI * 2);
    octx.fillStyle = 'rgba(32,96,178,.97)'; octx.fill();
    octx.lineWidth = 1.5; octx.strokeStyle = '#f2f2f2'; octx.stroke();
    const u = r / 10;
    // an anchor: ring, shank, stock and curved arms with flukes
    octx.strokeStyle = '#f4f4f4'; octx.lineWidth = Math.max(1, 1.5 * u); octx.lineCap = 'round';
    octx.beginPath(); octx.arc(x, y - 5.2 * u, 1.4 * u, 0, Math.PI * 2); octx.stroke();
    octx.beginPath();
    octx.moveTo(x, y - 3.8 * u); octx.lineTo(x, y + 6 * u);
    octx.moveTo(x - 3.2 * u, y - 2.2 * u); octx.lineTo(x + 3.2 * u, y - 2.2 * u);
    octx.moveTo(x - 5.5 * u, y + 1.5 * u); octx.quadraticCurveTo(x - 5 * u, y + 6 * u, x, y + 6 * u); octx.quadraticCurveTo(x + 5 * u, y + 6 * u, x + 5.5 * u, y + 1.5 * u);
    octx.stroke();
    octx.fillStyle = '#f4f4f4';
    for (const sgn of [-1, 1]) { octx.beginPath(); octx.moveTo(x + sgn * 5.5 * u, y + 0.2 * u); octx.lineTo(x + sgn * 7 * u, y + 2.8 * u); octx.lineTo(x + sgn * 4.2 * u, y + 2.6 * u); octx.closePath(); octx.fill(); }
    octx.lineCap = 'butt';
  }

  const decodeGameText = (b) => {
    if (b.length >= 2 && b[0] === 0xff && b[1] === 0xfe) return new TextDecoder('utf-16le').decode(b.subarray(2));
    if (b.length >= 2 && b[0] === 0xfe && b[1] === 0xff) return new TextDecoder('utf-16be').decode(b.subarray(2));
    let z = 0; for (let i = 1; i < Math.min(b.length, 400); i += 2) if (!b[i]) z++;
    if (z > 50) return new TextDecoder('utf-16le').decode(b);
    try { return new TextDecoder('utf-8', { fatal: true }).decode(b); } catch (e) { return new TextDecoder('windows-1252').decode(b); }
  };
  function parseNamesTxt(txt, out, cased) {
    for (const line of txt.split(/\r?\n/)) {
      const m = line.match(/^\s*\{([^}]+)\}(.*)$/);
      if (!m) continue;
      const v = m[2].replace(/\t/g, ' ').trim(), k = m[1].trim();
      if (cased) cased.set(k.toLowerCase(), k);
      if (v) out.set(k.toLowerCase(), v);
    }
  }
  function parseNamesBin(b, out, cased) {
    const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
    if (b.length < 8 || dv.getUint16(0, true) !== 2 || dv.getUint16(2, true) !== 2048) return;
    const n = dv.getUint32(4, true), dec = new TextDecoder('utf-16le');
    let p = 8;
    for (let i = 0; i < n && p + 2 <= b.length; i++) {
      const kl = dv.getUint16(p, true); p += 2;
      const k = dec.decode(b.subarray(p, p + 2 * kl)); p += 2 * kl;
      if (p + 2 > b.length) break;
      const vl = dv.getUint16(p, true); p += 2;
      const v = dec.decode(b.subarray(p, p + 2 * vl)).trim(); p += 2 * vl;
      if (cased) cased.set(k.trim().toLowerCase(), k.trim());
      if (v) out.set(k.trim().toLowerCase(), v);
    }
  }
  async function loadPlaceNames() {
    const p = state.project;
    if (!p) return;
    const J = M2.join, loc = p.loc;
    const strat = (p.pc && p.pc.file) || (p.strat && p.strat.file) || J(p.mapDir, 'descr_strat.txt');
    let camp = M2.basename(M2.dirname(strat));
    if (/^base$/i.test(camp)) camp = 'imperial_campaign';
    const names = new Map(), files = [], cased = new Map();
    const want = `${camp}_regions_and_settlement_names.txt`.toLowerCase();
    const info = { camp, names, files, cased, deleted: new Set(), modTxt: null, gameTxt: null, modBin: null, modFile: J(loc.dataDir, 'text', `${camp}_regions_and_settlement_names.txt`) };
    // the game's first, then the mod's over it; in each, the .strings.bin, then the .txt over it
    for (const base of [loc.gameDataDir, loc.dataDir].filter(Boolean)) {
      const isMod = base === loc.dataDir;
      const dir = J(base, 'text');
      let list = [];
      try { list = await host.list(dir); } catch (e) { continue; }
      const bin = list.find((e) => e.name.toLowerCase() === want + '.strings.bin');
      const txt = list.find((e) => e.name.toLowerCase() === want);
      try { if (bin) { parseNamesBin(await host.read(J(dir, bin.name)), names, cased); files.push(J(dir, bin.name)); if (isMod) info.modBin = J(dir, bin.name); } } catch (e) { console.warn(e); }
      try {
        if (txt) {
          const t = decodeGameText(await host.read(J(dir, txt.name)));
          parseNamesTxt(t, names, cased);
          files.push(J(dir, txt.name));
          const src = { file: J(dir, txt.name), lines: t.split(/\r?\n/), eol: /\r\n/.test(t) ? '\r\n' : '\n' };
          if (isMod) { info.modTxt = src; info.modFile = src.file; } else info.gameTxt = src;
        }
      } catch (e) { console.warn(e); }
    }
    if (state.project !== p) return;
    p.placeNames = info;
    drawOverlay();
  }
  const placeName = (key) => {
    if (!key) return '';
    const p = state.project, n = p.placeNames && p.placeNames.names.get(key.toLowerCase());
    return n || key.replace(/_Province$/i, '').replace(/_/g, ' ');
  };
  // renames a region or settlement as the game shows it (its key in descr_regions.txt stays): one undo step
  function renamePlace(key, value) {
    const p = state.project, P = p && p.placeNames;
    if (!P || !key) return;
    const v = String(value || '').replace(/[\r\n\t{}]/g, ' ').trim();
    const k = key.toLowerCase(), before = P.names.get(k);
    if (!v || v === before) return;
    state.undo.push({ t: new Map(), nm: { key, before: before == null ? null : before, after: v } });
    state.redo = [];
    nmSet(key, v);
  }
  function nmSet(key, v) {
    const p = state.project, P = p.placeNames, k = key.toLowerCase();
    if (v == null) P.names.delete(k); else P.names.set(k, v);
    if (!P.cased.has(k)) P.cased.set(k, key);
    p.namesDirty = true;
    updateButtons();
    renderPiecesPanel();
    drawOverlay();
  }
  function nmApply(rec, undo) { if (state.project && state.project.placeNames) nmSet(rec.key, undo ? rec.before : rec.after); }
  // the names file as Save writes it: the mod's own lines (else the game's) with the names changed, every
  // other name the game had (from its .strings.bin) added, in UTF-16 as the game reads it
  function namesFileData() {
    const P = state.project.placeNames, src = P.modTxt || P.gameTxt;
    const eol = src ? src.eol : '\r\n', seen = new Set();
    const lines = (src ? src.lines : ['\u00ac Regions and settlement names']).map((l) => {
      const m = l.match(/^(\s*\{)([^}]+)(\}\s*)(.*)$/);
      if (!m) return l;
      const k = m[2].trim().toLowerCase();
      seen.add(k);
      if (P.deleted && P.deleted.has(k) && !P.names.has(k)) return null; // a deleted region's name
      let v = P.names.get(k);
      // the game stops on an empty name ("Couldn't find settlement name ... in stringtable"), so an empty one
      // gets the name the painter shows for it: the key without _Province, underscores as spaces
      if (!(v != null ? v : m[4]).trim()) v = placeName(m[2].trim());
      if (v == null || v === m[4].replace(/\t/g, ' ').trim()) return l;
      return m[1] + m[2] + m[3] + v;
    }).filter((l) => l !== null);
    while (lines.length && lines[lines.length - 1] === '') lines.pop();
    for (const [k, v] of P.names) if (!seen.has(k)) lines.push(`{${P.cased.get(k) || k}}\t\t\t${v.trim() ? v : placeName(P.cased.get(k) || k)}`);
    const txt = lines.join(eol) + eol;
    const out = new Uint8Array(2 + txt.length * 2);
    out[0] = 0xff; out[1] = 0xfe;
    for (let i = 0; i < txt.length; i++) { const c = txt.charCodeAt(i); out[2 + 2 * i] = c & 255; out[3 + 2 * i] = c >> 8; }
    return { data: out, lines, eol };
  }

  // one spot a region for its name: the region tile nearest the middle of the region
  function regionLabelSpots() {
    const p = state.project, R = p.regions;
    const ver = p.pc ? p.pc.ver : 0;
    if (p.regionSpots && p.regionSpots.R === R && p.regionSpots.ver === ver) return p.regionSpots.list;
    const acc = new Map(), W = R.width, H = R.height, d = R.data;
    const key = (o) => `${d[o]},${d[o + 1]},${d[o + 2]}`;
    // land tiles only (some maps colour sea with a region too), unless a region has no land at all
    const land = (tx, ty) => { const v = (2 * ty + 1) * p.W + 2 * tx + 1; return v < p.gtIdx.length && !p.gtTable[p.gtIdx[v]].water; };
    for (let ty = 0; ty < H; ty++) for (let tx = 0; tx < W; tx++) {
      const reg = p.regionByColour.get(key((ty * W + tx) * 4));
      if (!reg) continue;
      let a = acc.get(reg);
      if (!a) acc.set(reg, a = { reg, sx: 0, sy: 0, n: 0, ax: 0, ay: 0, an: 0, best: null, bd: Infinity });
      if (land(tx, ty)) { a.sx += tx; a.sy += ty; a.n++; } else { a.ax += tx; a.ay += ty; a.an++; }
    }
    for (const a of acc.values()) { a.useAll = !a.n; if (a.useAll) { a.sx = a.ax; a.sy = a.ay; a.n = a.an; } a.cx = a.sx / a.n; a.cy = a.sy / a.n; }
    for (let ty = 0; ty < H; ty++) for (let tx = 0; tx < W; tx++) {
      const a = acc.get(p.regionByColour.get(key((ty * W + tx) * 4)));
      if (!a || (!a.useAll && !land(tx, ty))) continue;
      const dd = (tx - a.cx) ** 2 + (ty - a.cy) ** 2;
      if (dd < a.bd) { a.bd = dd; a.best = { tx, ty }; }
    }
    const list = [...acc.values()].filter((a) => a.best).map((a) => ({ reg: a.reg, tx: a.best.tx, ty: a.best.ty, n: a.n }));
    p.regionSpots = { R, ver, list };
    return list;
  }
  var nameBoxes = [];
  const nameLabelAt = (x, y) => nameBoxes.find((n) => x >= n.b.x0 && x <= n.b.x1 && y >= n.b.y0 && y <= n.b.y1) || null;
  function drawPlaceNames() {
    const shot = shotLayer;
    if (!shot) nameBoxes = [];
    const p = state.project, s = S();
    if (!p || !p.regions || !p.regionByColour || (!s.cityNames && !s.regionNames && !s.symbols)) return;
    const Wd = shot ? shot.W : overlay.clientWidth, Hd = shot ? shot.H : overlay.clientHeight;
    // in an overhead picture: straight down, k pixels a tile, names scaled with it
    const at = shot ? shot.proj || ((tx, ty) => ({ x: (tx + 0.5) * shot.k, y: (ty + 0.5) * shot.k }))
      : (tx, ty) => { const x = 2 * tx + 1, y = 2 * ty + 1; return is3D() ? view.project3D(x, y, view.heightAt(x, y)) : view.toScreen(x, y); };
    const F = shot ? shot.F || shot.ls * Math.max(1, shot.k / 4) : 1;
    const fogged = (tx, ty) => fogAt(tx, ty) > 0.5;
    const boxes = [];
    const free = (b) => !boxes.some((o) => b.x0 < o.x1 && b.x1 > o.x0 && b.y0 < o.y1 && b.y1 > o.y0);
    octx.save();
    octx.textAlign = 'center'; octx.textBaseline = 'middle'; octx.lineJoin = 'round';
    const regionBoxes = [];
    const label = (sx, sy, text, font, fill, spacing, reg, kind) => {
      octx.font = font;
      if ('letterSpacing' in octx) octx.letterSpacing = spacing || '0px';
      const w = octx.measureText(text).width, h = parseInt(font.match(/(\d+)px/)[1], 10);
      const box = (y) => ({ x0: sx - w / 2 - 3, x1: sx + w / 2 + 3, y0: y - h / 2 - 2, y1: y + h / 2 + 2 });
      let b = box(sy);
      if (b.x1 < 0 || b.x0 > Wd || b.y1 < 0 || b.y0 > Hd) return false;
      if (kind === 'region') {
        // a region name always shows unless another region name is there: first a free spot just above or below,
        // else where it is, over the city name or symbol
        const hitsRegion = (bb) => regionBoxes.some((o) => bb.x0 < o.x1 && bb.x1 > o.x0 && bb.y0 < o.y1 && bb.y1 > o.y0);
        let pick = null;
        for (const dy of [0, h + 6, -(h + 6), 2 * (h + 6), -2 * (h + 6), 3 * (h + 6)]) { const bb = box(sy + dy); if (free(bb) && !hitsRegion(bb)) { pick = sy + dy; break; } }
        if (pick === null) { if (hitsRegion(b)) return false; pick = sy; }
        sy = pick; b = box(sy);
        regionBoxes.push(b);
      } else if (!free(b)) return false;
      boxes.push(b);
      if (reg && !shot) nameBoxes.push({ b, reg, kind });
      octx.lineWidth = 3.5 * F; octx.strokeStyle = 'rgba(0,0,0,.8)'; octx.strokeText(text, sx, sy);
      octx.fillStyle = fill; octx.fillText(text, sx, sy);
      return true;
    };
    // symbols first (names keep clear of them), then cities, then the regions around them
    const sym = s.symbols && p.pc;
    const z = shot ? shot.z || F * Math.min(1.25, Math.max(0.45, shot.k / 4)) : is3D() ? 1 : Math.min(1.25, Math.max(0.45, view.view.scale / ((window.devicePixelRatio || 1) * 2)));
    if (sym) {
      for (const it of pcItems()) {
        if (it.kind !== 'settlement' && it.kind !== 'fort' && it.kind !== 'port') continue;
        if (fogged(it.tx, it.ty)) continue;
        const sc = at(it.tx, it.ty);
        if (!sc || sc.x < -20 || sc.y < -20 || sc.x > Wd + 20 || sc.y > Hd + 20) continue;
        if (it.kind === 'fort') drawCastleSymbol(sc.x, sc.y, z); else if (it.kind === 'port') drawPortSymbol(sc.x, sc.y, z); else drawCitySymbol(sc.x, sc.y, z);
        const r = (it.kind === 'port' ? 10 : 12) * z + 1;
        boxes.push({ x0: sc.x - r, x1: sc.x + r, y0: sc.y - r, y1: sc.y + r });
      }
    }
    if (s.cityNames && p.pc) {
      for (const it of pcItems()) {
        if (it.kind !== 'settlement' || !it.region) continue;
        if (fogged(it.tx, it.ty)) continue;
        const sc = at(it.tx, it.ty);
        if (!sc) continue;
        if (!sym) {
          octx.fillStyle = '#fff'; octx.strokeStyle = '#000'; octx.lineWidth = 1.5;
          octx.beginPath(); octx.arc(sc.x, sc.y, 3 * F, 0, Math.PI * 2); octx.fill(); octx.stroke();
        }
        label(sc.x, sc.y - (sym ? 12 * z + 10 * F : 13 * F), placeName(it.region.settlement), `600 ${Math.round(12 * F)}px Segoe UI, sans-serif`, '#fff', null, it.region, 'city');
      }
    }
    if (s.regionNames) {
      for (const r of regionLabelSpots().sort((a, b) => b.n - a.n)) {
        if (fogged(r.tx, r.ty)) continue;
        const sc = at(r.tx, r.ty);
        if (!sc) continue;
        label(sc.x, sc.y, placeName(r.reg.name).toUpperCase(), `italic 600 ${Math.round(12 * F)}px Georgia, serif`, 'rgba(255,226,160,.97)', `${(1.5 * F).toFixed(1)}px`, r.reg, 'region');
      }
    }
    octx.restore();
  }

  function setTrees(on) {
    S().trees = on; saveSettings();
    $('#btnTrees').classList.toggle('active', on);
    if (view) { view.opts.trees = on; view.dirty = true; }
  }

  function applyViewSettings() {
    if (!view) return;
    const s = S(), o = view.opts;
    Object.assign(o, {
      texScale: s.texScale, relief: s.relief, sunAz: s.sunAz, sunEl: s.sunEl, exposure: s.exposure, treeBrightness: 1,
      heightBlend: s.heightBlend, rivers: s.rivers || state.tool === 'rivers', borders: s.borders || state.tool === 'borders', grid: s.grid, settlements: s.settlements, climateTint: s.climateTint,
      sea: !!s.seaOverlay, exag: s.exag3d, detail3d: s.detail3d, trees: s.trees !== false, pieces: s.pieces !== false, tileModels: s.tileModels !== false,
      cavity: !!s.cavity, cavityStrength: s.cavityStrength, gridTiles: s.gridTiles,
      mask: s.maskShow === false || state.target === 'height' ? 0 : s.maskMode === 'ridges' ? 1 : s.maskMode === 'hollows' ? 2 : s.maskMode === 'height' ? 3 : 0,
      maskLo: Math.min(s.maskLo ?? 0, s.maskHi ?? 1000), maskHi: Math.max(s.maskLo ?? 0, s.maskHi ?? 1000), maskSoft: s.maskSoft || 0,
      maskThr: (s.maskThr || 0) / 100,
    });
    {
      // map colour and tree colour are worked into the pictures themselves (refreshAllLayers, recolourTrees),
      // with the same function Save uses, so what the painter shows is what gets saved
      o.groundMat = null; o.groundPivot = GROUND_PIVOT;
      o.treeMat = null;
      o.treeMatch = s.treeGameMatch === false ? null : TREE_VIEW_MATCH;
      colourPreview();
      const w = seaAdj();
      o.seaMat = groundAdjIdentity(w) ? null : groundMatrix(w);
      o.seaContrast = w.c;
      view.dirty = true;
    }
    if (state.project) updateButtons();
    $('#btnCavity').classList.toggle('active', !!s.cavity);
    const L = state.project && state.project.lighting;
    $('#exag').value = s.exag3d; $('#exagVal').textContent = (+s.exag3d).toFixed(1) + '×';
    if (s.useModLighting && L && L.ambient && L.diffuse) { o.ambient = L.ambient; o.diffuse = L.diffuse; }
    else { o.ambient = [0.22, 0.22, 0.24]; o.diffuse = [1.0, 1.0, 1.05]; }
    // the game look takes everything from the lighting file, as the game does; the vanilla _ex values otherwise
    o.game = s.gameLook !== false;
    const useL = s.useModLighting && L && L.ambient && L.diffuse;
    const num = (v, d) => (typeof v === 'number' && isFinite(v) ? v : d);
    o.gameLight = {
      ambient: useL ? L.ambient : [0.2176, 0.2176, 0.2373],
      sun: useL ? L.diffuse : [1.0107, 1.0107, 1.0855],
      dir: (useL && L.direction) || [-1, -1, 1],
      shadow: Math.min(1, Math.max(0, num(useL && L.shadow, 0.9))),
      ao: Math.min(1, Math.max(0, num(useL && L.ao, 0.45))),
      exposure: Math.max(0, num(useL && L.exposure, 1)),
      albedo: (state.project && state.project.albedoScale) || 1,
      pieceAmbient: (useL && L.pieceAmbient) || [0.6121, 0.6121, 0.6462],
      pieceDiffuse: (useL && L.pieceDiffuse) || [0.6718, 0.6718, 0.6128],
    };
    view.dirty = true;
  }

  function openSettings() {
    const s = S();
    const g = el('div', { class: 'set-grid' });
    const range = (label, key, min, max, step, fmt = (v) => v, help) => {
      const val = el('span', { text: fmt(s[key]) });
      const inp = el('input', { type: 'range', min, max, step, value: s[key] });
      inp.addEventListener('input', () => { s[key] = +inp.value; val.textContent = fmt(s[key]); applyViewSettings(); saveSettings(); drawOverlay(); });
      g.append(el('label', { text: label }), el('div', {}, inp, ' ', val));
      if (help) g.append(el('div', { class: 'help', text: help }));
    };
    const check = (label, key, help, after) => {
      const inp = el('input', { type: 'checkbox' }); inp.checked = !!s[key];
      inp.addEventListener('change', () => { s[key] = inp.checked; applyViewSettings(); saveSettings(); if (after) after(); });
      g.append(el('label', { text: label }), el('div', {}, inp));
      if (help) g.append(el('div', { class: 'help', text: help }));
    };
    g.append(el('h3', { text: 'Look' }));
    range('Texture size (tiles)', 'texScale', 1, 24, 0.5, (v) => `${v} tiles per repeat`, 'How many map tiles one ground texture covers before it repeats. Match this to what you see in game.');
    range('Relief', 'relief', 0, 4, 0.1, (v) => v.toFixed(1), 'Strength of hill and mountain shading from the height map.');
    range('Sun direction', 'sunAz', 0, 359, 1, (v) => `${v}°`);
    range('Sun height', 'sunEl', 5, 90, 1, (v) => `${v}°`);
    range('Brightness', 'exposure', 0.5, 2, 0.05, (v) => v.toFixed(2));
    check('Save the tree colour into the game', 'bakeTrees', 'When you save, the Tree colour panel\'s settings are written into the tree pictures the game uses (tree_models and min_spec, .tga.dds and .tga), so the game\'s trees look the same. The first time, the original pictures are kept in map_painter_backups\\tree_textures_original, and each save starts from them. The game lights trees brighter than the painter, so saving also darkens them by that much, even at 1×. To get the untouched pictures back, copy them from that folder.');
    check('Match the game\'s tree shade', 'treeGameMatch', 'The game draws its campaign trees lighter and a little warmer than its tree shader suggests. With this on, the 3D game look draws them the way the game showed them in side-by-side screenshots. Only the painter\'s picture changes; Save writes the trees as before.');
    check('Use the mod\'s lighting colours', 'useModLighting', 'Takes the ambient and sun colours from descr_strategy_lighting(_ex).txt.');
    check('Blend with texture alpha', 'heightBlend', 'Uses each texture\'s alpha channel to decide which texture wins where two meet.');
    g.append(el('h3', { text: '3D view' }));
    check('Match the game\'s look', 'gameLook', 'Draws the 3D view the way the game draws its campaign map: the same lighting, shadows, ambient occlusion, texture blending, sea and colour curve, taken from the game\'s own shaders and your lighting file. The sun direction, sun height, relief and brightness settings above only apply when this is off; change the lighting file instead and the view follows it.');
    range('Height exaggeration', 'exag3d', 0.1, 10, 0.1, (v) => `${(+v).toFixed(1)}×`, 'How much taller hills and mountains look in 3D. 1× is the height the game shows. Also on the toolbar while 3D is on.');
    g.append(el('h3', { text: 'Checking the shape' }));
    range('Cavity strength', 'cavityStrength', 0.1, 4, 0.1, (v) => `${(+v).toFixed(1)}×`, 'How dark hollows and how light ridges get with Cavity on (C). It follows the height exaggeration.');
    range('Colour grid size', 'gridTiles', 4, 128, 4, (v) => `${v} tiles per repeat`, 'How many tiles one copy of the colour grid covers in the Grid view (7).');
    {
      const p = state.project;
      const sel = el('select');
      sel.append(el('option', { value: '', text: 'Off' }));
      const facs = (p && p.strat && p.strat.factions) || [];
      for (const f of facs) sel.append(el('option', { value: f.name, text: M2.prettify(f.name) }));
      if (s.fowFaction && !facs.some((f) => f.name === s.fowFaction)) sel.append(el('option', { value: s.fowFaction, text: M2.prettify(s.fowFaction) }));
      sel.value = s.fowFaction || '';
      sel.addEventListener('change', () => { s.fowFaction = sel.value; saveSettings(); buildFog(); });
      g.append(el('label', { text: 'Fog of war' }), sel,
        el('div', { class: 'help', text: facs.length
          ? 'Shows the map as this faction sees it at the start of the campaign (from descr_strat.txt), in the game\'s shroud colour. The game works out sight turn by turn; here each settlement sees about 12 tiles and each character about 10, and the faction\'s own regions are clear.'
          : 'Needs a descr_strat.txt next to the map or in the main campaign folder.' }));
    }
    {
      const sel = el('select');
      [[1, 'High (every vertex)'], [2, 'Normal (faster)']].forEach(([v, t]) => sel.append(el('option', { value: v, text: t })));
      sel.value = s.detail3d;
      sel.addEventListener('change', () => { s.detail3d = +sel.value; applyViewSettings(); saveSettings(); });
      g.append(el('label', { text: 'Mesh detail' }), sel,
        el('div', { class: 'help', text: 'Texturing and shading always use every vertex. High also builds the 3D shape from every vertex, which needs a stronger graphics card.' }));
    }
    g.append(el('h3', { text: 'Settlements and other models' }));
    check('Show settlements, ports, forts and resources', 'pieces', 'Draws the game\'s own .cas models for settlements (by level and culture), ports, forts, watchtowers, resources and faction symbols, in 2D and 3D.', () => loadPieces());
    g.append(el('label', { text: 'Fort model' }), fortModelBox(false));
    {
      const p = state.project, t = p && p.tiles;
      const info = !t ? '' : t.note ? ' ' + t.note : ` ${t.count} tiles have one on this map.`;
      check('Show hills, rivers, cliffs and mountains', 'tileModels', 'Draws the game\'s tile models (aerial_map\\tile_models) in the 3D game look, on the tiles the game chose for them when it built map.rwm. River water uses the sea\'s shader.' + info, async () => { await loadTileModels(); setupWatch(); });
    }
    {
      const sel = el('select');
      [['', 'Hide them'], ['village', 'Village'], ['town', 'Town'], ['large_town', 'Large town'], ['city', 'City'], ['large_city', 'Large city'], ['huge_city', 'Huge city'],
        ['moot_and_bailey', 'Motte and bailey'], ['wooden_castle', 'Wooden castle'], ['castle', 'Castle'], ['fortress', 'Fortress'], ['citadel', 'Citadel']]
        .forEach(([v, t]) => sel.append(el('option', { value: v, text: t })));
      sel.value = s.unlistedLevel || '';
      sel.addEventListener('change', () => { s.unlistedLevel = sel.value; saveSettings(); loadPieces(); });
      g.append(el('label', { text: 'Settlements not in descr_strat' }), sel,
        el('div', { class: 'help', text: 'Regions whose settlement the campaign\'s descr_strat.txt doesn\'t list are drawn at this level, in the culture of the faction that founded the region (descr_regions.txt). Their ports show as fishing villages.' }));
    }
    {
      const sel = el('select');
      sel.append(el('option', { value: '', text: 'Automatic' }));
      const p = state.project;
      const fill = async () => {
        if (!p) return;
        const root = M2.join(p.loc.dataDir, 'world', 'maps', 'campaign');
        const names = [];
        for (const e of await host.list(root).catch(() => [])) {
          if (!e.isDir) continue;
          if (e.name.toLowerCase() === 'custom') { for (const c of await host.list(M2.join(root, e.name)).catch(() => [])) if (c.isDir) names.push(e.name + '/' + c.name); }
          else names.push(e.name);
        }
        for (const n of names) sel.append(el('option', { value: n, text: n }));
        if (s.stratCampaign && !names.includes(s.stratCampaign)) sel.append(el('option', { value: s.stratCampaign, text: s.stratCampaign }));
        sel.value = s.stratCampaign || '';
      };
      fill();
      sel.addEventListener('change', async () => { s.stratCampaign = sel.value; saveSettings(); await loadGameAssets(); setupWatch(); });
      const used = p && p.strat && p.strat.file;
      g.append(el('label', { text: 'Campaign (descr_strat.txt)' }), sel,
        el('div', { class: 'help', text: 'Which campaign\'s descr_strat.txt sets the settlements, ports, forts, resources and the fog of war. Automatic uses the one next to the map, else the main campaign\'s.' + (used ? ' Now: ' + used : '') }));
    }
    g.append(el('h3', { text: 'Overlays' }));
    check('Rivers', 'rivers');
    check('Settlements', 'settlements');
    check('Tile grid when zoomed in', 'grid');
    check('Tint by climate', 'climateTint');
    check('Sea level', 'seaOverlay', 'Blue where the ground is below sea level, a white line along sea level, and stripes where the ground type disagrees with the height (red: land texture below sea level, orange: sea above it). Toggle with L.', () => setSea(!!s.seaOverlay));
    g.append(el('h3', { text: 'Brush and pen' }));
    check('Pen pressure changes size', 'pressureSize', 'Light pressure paints a small dab, full pressure paints the whole brush.');
    check('Pen pressure changes density', 'pressureDensity', 'Light pressure scatters a few pixels, full pressure fills.');
    check('Protect the coastline', 'protectCoast', 'Land textures never paint into the sea and water never paints onto land, so the coast stays matched to the height map.');
    g.append(el('h3', { text: 'Height brush' }));
    check('Pen pressure changes strength', 'pressureStrength', 'Light pressure raises, lowers or smooths gently; full pressure works at the strength on the toolbar.');
    check('Move the coastline with the heights', 'moveCoast', 'When a spot is raised above sea level it takes the ground type and climate of the nearest land; when it is lowered below sea level it becomes shallow sea. Turn off to change heights only.', () => { $('#moveCoast').checked = !!s.moveCoast; });
    g.append(el('h3', { text: 'Saving' }));
    check('Move map.rwm aside when saving', 'rebuildRwm', 'The game only picks up edited map images after map.rwm is removed. It is moved into the backup folder, not deleted.');
    g.append(el('h3', { text: 'Ground type → texture slot' }));
    g.append(el('div', { class: 'help', text: 'Which line of descr_aerial_map_ground_types.txt each ground type colour uses. Change these if a ground type looks wrong compared with the game.' }));
    const slots = state.project ? [...new Set(Object.values(state.project.aerial).flatMap((c) => Object.keys(c)))] : Object.keys(M2.SLOT_LABELS);
    for (const gt of M2.GROUND_TYPES) {
      if (gt.water) continue;
      const sel = el('select');
      for (const sl of slots) sel.append(el('option', { value: sl, text: M2.SLOT_LABELS[sl] || sl }));
      sel.value = (s.slotMap || {})[gt.key] || gt.slot;
      sel.addEventListener('change', () => {
        s.slotMap = { ...(s.slotMap || {}), [gt.key]: sel.value };
        saveSettings();
        if (state.project) { buildLUT(); buildKey(); }
      });
      g.append(el('label', {}, el('span', { class: 'sw', style: `display:inline-block;width:12px;height:12px;margin-right:6px;background:${rgbCss(gt.rgb)}` }), gt.label), sel);
    }
    modal('Settings', g);
  }

  // ---------------------------------------------------------------- welcome screen
  async function fillWelcome() {
    const det = $('#detected'); det.innerHTML = '';
    try {
      const games = await host.detectGame();
      const mods = games.flatMap((g) => g.mods);
      if (mods.length) {
        det.append(el('h3', { text: 'Mods found on this PC' }));
        mods.sort((a, b) => (b.name.toLowerCase() === 'bare_geomod') - (a.name.toLowerCase() === 'bare_geomod'));
        for (const m of mods) det.append(el('button', { class: 'pick-row', onclick: () => openAny(m.path) }, el('span', { text: m.name }), el('span', { class: 'muted', text: m.path })));
      }
    } catch {}
    const rec = $('#recent'); rec.innerHTML = '';
    const recent = S().recent || [];
    if (recent.length) {
      rec.append(el('h3', { text: 'Recent maps' }));
      for (const r of recent) rec.append(el('button', { class: 'pick-row', onclick: () => loadMap(r) }, el('span', { text: M2.basename(r) }), el('span', { class: 'muted', text: r })));
    }
  }

  // ---------------------------------------------------------------- frame loop
  function frame(t) {
    if (view && state.project) {
      if (dirtyRect || hDirtyRect) flushDirty();
      if (!shooting && (view.dirty || view.opts.hilite >= 0)) view.draw(t);
    }
    requestAnimationFrame(frame);
  }

  window.addEventListener('resize', () => { if (view) view.dirty = true; drawOverlay(); });

  // ---------------------------------------------------------------- movable panels
  // Every floating panel can be dragged by its title row, so panels need not cover each other or the map.
  // Where each one sits is kept in settings.panelPos (per panel, from the top-left of the map area);
  // double-click a title row to put that panel back where it started.
  const MOVABLE = ['farmPanel', 'fogPanel', 'shotPanel', 'rampPanel', 'colourPanel', 'treeColourPanel', 'seaColourPanel', 'lightPanel', 'coastPanel', 'piecesPanel', 'riverPanel', 'borderPanel', 'guidePanel'];
  const HEADS = '.cp-head, .fp-head, .ramp-head';
  const stageEl = $('#stage');
  let panelZ = 7;
  function panelPlace(pnl) {
    const pos = (S().panelPos || {})[pnl.id];
    if (!pos) { pnl.style.left = pnl.style.top = pnl.style.right = pnl.style.bottom = pnl.style.maxHeight = ''; return; }
    if (pnl.hidden) return;
    const sw = stageEl.clientWidth, sh = stageEl.clientHeight, w = pnl.offsetWidth;
    // keep at least the title row on screen
    const x = Math.max(4 - w + 60, Math.min(sw - 60, pos.x)), y = Math.max(0, Math.min(sh - 32, pos.y));
    Object.assign(pnl.style, { left: `${x}px`, top: `${y}px`, right: 'auto', bottom: 'auto', maxHeight: `${Math.max(120, sh - y - 8)}px`, overflowY: 'auto' });
  }
  // a function declaration (and var) so applyViewSettings may call it before this part of the file has run
  var panelsReady = false;
  function placeAllPanels() { if (panelsReady) MOVABLE.forEach((id) => { const e = document.getElementById(id); if (e) panelPlace(e); }); }
  for (const id of MOVABLE) {
    const pnl = document.getElementById(id);
    if (!pnl) continue;
    new MutationObserver(() => { if (!pnl.hidden) { panelPlace(pnl); pnl.style.zIndex = String(++panelZ); } }).observe(pnl, { attributes: true, attributeFilter: ['hidden'] });
    pnl.addEventListener('pointerdown', (e) => {
      pnl.style.zIndex = String(++panelZ);
      const head = e.target.closest(HEADS);
      if (!head || !pnl.contains(head) || e.button !== 0 || e.target.closest('button, input, select, textarea, label, a')) return;
      e.preventDefault();
      const r0 = pnl.getBoundingClientRect(), st = stageEl.getBoundingClientRect(), ox = e.clientX - r0.left, oy = e.clientY - r0.top;
      head.setPointerCapture(e.pointerId);
      pnl.classList.add('moving');
      const move = (ev) => {
        const pos = S().panelPos || (S().panelPos = {});
        pos[id] = { x: Math.round(ev.clientX - st.left - ox), y: Math.round(ev.clientY - st.top - oy) };
        panelPlace(pnl);
      };
      const up = () => { head.removeEventListener('pointermove', move); head.removeEventListener('pointerup', up); head.removeEventListener('pointercancel', up); pnl.classList.remove('moving'); saveSettings(); };
      head.addEventListener('pointermove', move); head.addEventListener('pointerup', up); head.addEventListener('pointercancel', up);
    });
    pnl.addEventListener('dblclick', (e) => {
      const head = e.target.closest(HEADS);
      if (!head || e.target.closest('button, input, select, textarea, label, a')) return;
      if (S().panelPos) { delete S().panelPos[id]; saveSettings(); }
      panelPlace(pnl);
    });
  }
  panelsReady = true;
  placeAllPanels();
  new ResizeObserver(placeAllPanels).observe(stageEl);

  window.addEventListener('beforeunload', (e) => {
    if (isDirty()) { e.preventDefault(); e.returnValue = ''; }
  });

  // ---------------------------------------------------------------- small dialogs
  function ask(message, detail, buttons) {
    return new Promise((resolve) => {
      const body = el('div', { class: 'ask' }, el('p', { text: detail || '' }));
      const row = el('div', { class: 'ask-buttons' });
      buttons.forEach((b, i) => row.append(el('button', { class: i === 0 ? 'primary' : '', onclick: () => { onModalClose = null; closeModal(); resolve(i); } }, b)));
      body.append(row);
      modal(message, body);
      onModalClose = () => resolve(buttons.length - 1);
    });
  }

  function popupMenu(x, y, items) {
    return new Promise((resolve) => {
      document.querySelectorAll('.ctx-menu').forEach((m) => m.remove());
      const menu = el('div', { class: 'ctx-menu' });
      let done = false;
      const finish = (id) => {
        if (done) return; done = true;
        menu.remove();
        window.removeEventListener('mousedown', outside, true);
        window.removeEventListener('keydown', esc, true);
        resolve(id);
      };
      const outside = (e) => { if (!menu.contains(e.target)) finish(null); };
      const esc = (e) => { if (e.key === 'Escape') finish(null); };
      for (const it of items) {
        if (it.type === 'separator') { menu.append(el('div', { class: 'ctx-sep' })); continue; }
        const b = el('button', { class: 'ctx-item' }, it.label);
        if (it.enabled === false) b.disabled = true;
        b.addEventListener('click', () => finish(it.id));
        menu.append(b);
      }
      document.body.append(menu);
      const r = menu.getBoundingClientRect();
      menu.style.left = Math.min(x, window.innerWidth - r.width - 4) + 'px';
      menu.style.top = Math.min(y, window.innerHeight - r.height - 4) + 'px';
      setTimeout(() => {
        window.addEventListener('mousedown', outside, true);
        window.addEventListener('keydown', esc, true);
      }, 0);
    });
  }

  // one picked file as { name, bytes }, or with multiple=true an array of them
  function pickImageFile(multiple = false) {
    return new Promise((resolve) => {
      const inp = el('input', { type: 'file', accept: '.tga,.dds,.png,.jpg,.jpeg,.bmp,.webp,.gif' });
      if (multiple) inp.multiple = true;
      inp.addEventListener('change', async () => {
        const out = [];
        for (const f of inp.files) out.push({ name: f.name, bytes: new Uint8Array(await f.arrayBuffer()) });
        resolve(multiple ? out : out[0] || null);
      });
      inp.click();
    });
  }

  // ---------------------------------------------------------------- fog mask (Fog button)
  // A black and white picture stretched over the whole map: black is fog, white is clear, grey in between.
  // Painter only (never written to the map files). The picture is copied to %APPDATA%\M2 Map Painter\fog_masks
  // and remembered per map in settings.fogMasks, with how the fog looks.
  const FOG_DEF = { on: true, density: 1, soft: 2, colour: '#000000', hideLabels: true };
  let fogKey = null, fogSrc = null; // this map's settings key; the decoded picture { w, h, fog } (255 = fog)
  let fogCpu = null;                // the same, edges softened, as drawn (for hiding names under the fog)
  const fogCfg = () => { const all = S().fogMasks || {}; return fogKey && all[fogKey] ? { ...FOG_DEF, ...all[fogKey] } : null; };
  function fogPut(patch) {
    const all = { ...(S().fogMasks || {}) };
    if (patch === null) delete all[fogKey]; else all[fogKey] = { ...(fogCfg() || FOG_DEF), ...patch };
    S().fogMasks = all; saveSettings();
  }
  const hexRgb = (h) => { const m = /^#?([0-9a-f]{6})$/i.exec(h || ''); const v = m ? parseInt(m[1], 16) : 0; return [(v >> 16 & 255) / 255, (v >> 8 & 255) / 255, (v & 255) / 255]; };
  async function fogDecode(bytes, name) {
    const pic = await guidePicture(bytes, name);
    const w = pic.bmp.width, h = pic.bmp.height;
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const cx = cv.getContext('2d', { willReadFrequently: true });
    cx.drawImage(pic.bmp, 0, 0); pic.bmp.close();
    const px = cx.getImageData(0, 0, w, h).data, fog = new Uint8Array(w * h);
    // dark is fog; a transparent pixel counts as clear
    for (let i = 0; i < w * h; i++) { const a = px[i * 4 + 3] / 255; fog[i] = Math.round(a * (255 - (0.299 * px[i * 4] + 0.587 * px[i * 4 + 1] + 0.114 * px[i * 4 + 2]))); }
    return { w, h, fog };
  }
  // three box blurs (about a Gaussian) of radius r pixels
  function fogBlur(src, w, h, r) {
    let a = Float32Array.from(src);
    if (r < 1) return src.slice();
    let b = new Float32Array(a.length);
    for (let pass = 0; pass < 3; pass++) {
      for (let y = 0; y < h; y++) {
        const o = y * w; let sum = 0;
        for (let x = -r; x <= r; x++) sum += a[o + Math.min(w - 1, Math.max(0, x))];
        for (let x = 0; x < w; x++) { b[o + x] = sum / (2 * r + 1); sum += a[o + Math.min(w - 1, x + r + 1)] - a[o + Math.max(0, x - r)]; }
      }
      for (let x = 0; x < w; x++) {
        let sum = 0;
        for (let y = -r; y <= r; y++) sum += b[Math.min(h - 1, Math.max(0, y)) * w + x];
        for (let y = 0; y < h; y++) { a[y * w + x] = sum / (2 * r + 1); sum += b[Math.min(h - 1, y + r + 1) * w + x] - b[Math.max(0, y - r) * w + x]; }
      }
    }
    const out = new Uint8Array(a.length);
    for (let i = 0; i < a.length; i++) out[i] = Math.round(a[i]);
    return out;
  }
  function fogBuild() {
    const cfg = fogCfg(), p = state.project;
    if (!cfg || !fogSrc || !p) { fogCpu = null; if (view) view.setFogMask(null); syncFog(); return; }
    // Soft edges is in tiles; three box passes of radius r spread about 1.7 r
    const r = Math.round(cfg.soft * fogSrc.w / ((p.W - 1) / 2) / 1.7);
    const data = fogBlur(fogSrc.fog, fogSrc.w, fogSrc.h, r);
    fogCpu = { w: fogSrc.w, h: fogSrc.h, data };
    view.setFogMask({ width: fogSrc.w, height: fogSrc.h, data });
    syncFog();
  }
  function syncFog() {
    const cfg = fogCfg();
    if (view) { view.opts.fogMask = cfg && cfg.on && fogCpu ? { colour: hexRgb(cfg.colour), density: cfg.density } : null; view.dirty = true; }
    $('#btnFog').classList.toggle('has', !!(view && view.opts.fogMask));
    renderFogPanel(); drawOverlay();
  }
  async function loadFogMask(mapDir) {
    fogKey = norm(mapDir); fogSrc = null;
    const cfg = fogCfg();
    if (cfg && cfg.file) {
      try { fogSrc = await fogDecode(await host.read(cfg.file), cfg.file); } catch (e) { console.warn('fog mask', e); toast(`Fog mask not found: ${cfg.name || cfg.file}`, 'err', 8000); }
    }
    if (norm(mapDir) === fogKey) fogBuild();
  }
  async function importFogMask(file) {
    if (!state.project) { toast('Open a map first.'); return; }
    if (!file) file = await pickImageFile();
    if (!file) return;
    try {
      const src = await fogDecode(file.bytes, file.name);
      const dir = M2.join((await host.appdir()).dir, 'fog_masks');
      const clean = file.name.replace(/[\\/:*?"<>|]/g, '_');
      const dot = clean.lastIndexOf('.') > 0 ? clean.lastIndexOf('.') : clean.length;
      let path = M2.join(dir, clean);
      for (let n = 2; await host.exists(path); n++) path = M2.join(dir, `${clean.slice(0, dot)} (${n})${clean.slice(dot)}`);
      await host.writeFile(path, file.bytes);
      const old = fogCfg();
      fogSrc = src;
      fogPut({ file: path, name: clean, on: true });
      fogBuild();
      setFogPanel(true);
      if (old && old.file && norm(old.file) !== norm(path)) fogForget(old.file);
      const p = state.project, shape = (src.w / src.h) / ((p.W - 1) / (p.H - 1));
      toast(`Fog mask ${clean} is on: black is fog, white is clear.${Math.abs(shape - 1) > 0.03 ? ' It is not shaped like the map, so it is stretched to fit.' : ''}`, 'ok', 7000);
    } catch (e) { toast(`Could not use ${file.name} as a fog mask: ${e.message}`, 'err', 8000); }
  }
  // the copy in fog_masks goes when no map uses it any more
  function fogForget(file) {
    const used = Object.values(S().fogMasks || {}).some((c) => c && norm(c.file) === norm(file));
    if (!used) host.removeFile(file).catch((e) => console.warn(e));
  }
  function removeFogMask() {
    const cfg = fogCfg();
    if (!cfg) return;
    fogPut(null); fogSrc = null;
    if (cfg.file) fogForget(cfg.file);
    fogBuild();
  }
  // how foggy a tile is, 0..1, when names and symbols should hide under the fog
  function fogAt(tx, ty) {
    if (!fogCpu || !view || !view.opts.fogMask) return 0;
    const cfg = fogCfg();
    if (!cfg || !cfg.hideLabels) return 0;
    const p = state.project;
    const x = Math.min(fogCpu.w - 1, Math.max(0, Math.floor((2 * tx + 1) / (p.W - 1) * fogCpu.w)));
    const y = Math.min(fogCpu.h - 1, Math.max(0, Math.floor((2 * ty + 1) / (p.H - 1) * fogCpu.h)));
    return fogCpu.data[y * fogCpu.w + x] / 255 * cfg.density;
  }
  function setFogPanel(on) { $('#fogPanel').hidden = !on; $('#btnFog').classList.toggle('active', on); renderFogPanel(); }
  $('#btnFog').addEventListener('click', () => setFogPanel($('#fogPanel').hidden));
  function renderFogPanel() {
    const box = $('#fogPanel');
    if (!box || box.hidden) return;
    box.textContent = '';
    const cfg = fogCfg();
    box.append(el('div', { class: 'cp-head' }, el('b', { text: 'Fog mask' }), el('span', { class: 'cp-help', text: 'Black is fog, white is clear.' }),
      el('button', { class: 'ramp-x', title: 'Close', text: '×', onclick: () => setFogPanel(false) })));
    if (!state.project) { box.append(el('div', { class: 'cp-note', text: 'Open a map first.' })); return; }
    if (!cfg) {
      box.append(el('div', { class: 'cp-note', text: 'Import a black and white picture (TGA, PNG, DDS…). It is stretched over the whole map: black parts are covered in fog, white parts are clear. A picture the size of map_heights.tga lines up exactly. The painter shows the fog; the map files are not changed.' }),
        el('div', { class: 'seg pc-modes' }, el('button', { class: 'active', text: 'Import fog mask…', onclick: () => importFogMask() })));
      return;
    }
    const show = el('input', { type: 'checkbox' }); show.checked = !!cfg.on;
    show.addEventListener('change', () => { fogPut({ on: show.checked }); syncFog(); });
    box.append(el('div', { class: 'cp-target' }, el('label', { class: 'chk' }, show, ` Show the fog (${cfg.name || 'mask'})`)));
    const grid = el('div', { class: 'cp-grid' });
    const slider = (label, key, min, max, step, fmt, live, tip) => {
      const val = el('span', { class: 'cp-val', text: fmt(cfg[key]) });
      const inp = el('input', { type: 'range', min, max, step, value: cfg[key], title: tip || '' });
      inp.addEventListener('input', () => { val.textContent = fmt(+inp.value); if (live) { fogPut({ [key]: +inp.value }); syncFog(); } });
      inp.addEventListener('change', () => { fogPut({ [key]: +inp.value }); if (!live) fogBuild(); });
      grid.append(el('label', { text: label, title: tip || '' }), inp, val);
    };
    slider('Density', 'density', 0.1, 1, 0.01, (v) => `${Math.round(v * 100)}%`, true, 'How thick the fog is: 100% hides the map under it completely');
    slider('Soft edges', 'soft', 0, 10, 0.5, (v) => `${v} tile${v === 1 ? '' : 's'}`, false, 'How far the fog thins out at its edges');
    const col = el('input', { type: 'color', value: cfg.colour || '#000000', title: 'Fog colour' });
    col.addEventListener('input', () => { fogPut({ colour: col.value }); syncFog(); });
    grid.append(el('label', { text: 'Colour' }), col, el('span'));
    box.append(grid);
    const hide = el('input', { type: 'checkbox' }); hide.checked = !!cfg.hideLabels;
    hide.addEventListener('change', () => { fogPut({ hideLabels: hide.checked }); syncFog(); });
    box.append(el('div', { class: 'cp-target' }, el('label', { class: 'chk' }, hide, ' Hide names and symbols under the fog')));
    box.append(el('div', { class: 'seg pc-modes' },
      el('button', { text: 'Replace…', title: 'Use another picture', onclick: () => importFogMask() }),
      el('button', { text: 'Remove', title: 'Take the fog mask off this map', onclick: () => removeFogMask() })));
  }

  // ---------------------------------------------------------------- overhead picture (Picture button)
  // The whole map from straight above, as it is shown now (2D view, or the 3D look seen from above), with
  // the overlays that are on: borders, rivers, trees, names, symbols, guides and the fog mask. It is drawn
  // a screenful at a time, then the names and symbols go over the whole picture, and it is saved as a PNG
  // in <mod>\map_painter_pictures.
  let shooting = false, shotLayer = null, lastShot = null;
  const SHOT_SIZES = [[2, 'Small'], [4, 'Medium'], [8, 'Large']];
  function setShotPanel(on) { $('#shotPanel').hidden = !on; $('#btnShot').classList.toggle('active', on); renderShotPanel(); }
  $('#btnShot').addEventListener('click', () => setShotPanel($('#shotPanel').hidden));
  function renderShotPanel() {
    const box = $('#shotPanel');
    if (!box || box.hidden) return;
    box.textContent = '';
    const s = S(), p = state.project, k = s.shotScale || 4;
    box.append(el('div', { class: 'cp-head' }, el('b', { text: 'Overhead picture' }), el('span', { class: 'cp-help', text: 'The whole map from straight above.' }),
      el('button', { class: 'ramp-x', title: 'Close', text: '×', onclick: () => setShotPanel(false) })));
    if (!p) { box.append(el('div', { class: 'cp-note', text: 'Open a map first.' })); return; }
    const tw = (p.W - 1) / 2, th = (p.H - 1) / 2;
    const seg = el('div', { class: 'seg pc-modes' });
    for (const [n, t] of SHOT_SIZES) seg.append(el('button', { text: `${t} ${Math.round(tw * n)} × ${Math.round(th * n)}`, title: `${n} pixels a tile`, class: k === n ? 'active' : '', onclick: () => { s.shotScale = n; saveSettings(); renderShotPanel(); } }));
    box.append(seg);
    const grid = el('div', { class: 'cp-grid' });
    const ls = s.shotLabel || 100;
    const val = el('span', { class: 'cp-val', text: `${ls}%` });
    const inp = el('input', { type: 'range', min: 50, max: 300, step: 10, value: ls });
    inp.addEventListener('input', () => { val.textContent = `${inp.value}%`; s.shotLabel = +inp.value; saveSettings(); });
    grid.append(el('label', { text: 'Name size' }), inp, val);
    box.append(grid);
    const on = [is3D() ? '3D look from above' : '2D view', s.borders && 'region borders', s.rivers && 'rivers', s.trees !== false && 'trees', s.cityNames && 'city names', s.regionNames && 'region names', s.symbols && 'symbols', view && view.opts.fogMask && 'fog mask', state.guides.some((g) => g.tex && g.visible) && !state.guidesHidden && 'guides'].filter(Boolean);
    box.append(el('div', { class: 'cp-note', text: `As shown now: ${on.join(', ')}. Turn things on or off in the top bar first.` }));
    box.append(el('div', { class: 'seg pc-modes' }, el('button', { class: 'active', text: 'Take picture', onclick: () => takePicture() })));
    if (lastShot) box.append(el('div', { class: 'cp-note' }, `Saved ${M2.basename(lastShot)} `, el('a', { href: '#', text: 'Show in folder', onclick: (e) => { e.preventDefault(); host.showItem(lastShot); } })));
    renderGrabSection(box);
  }
  async function takePicture(scale) {
    const p = state.project;
    if (!p || !view || shooting) return null;
    const s = S(), k = scale || s.shotScale || 4;
    const OW = Math.round((p.W - 1) / 2 * k), OH = Math.round((p.H - 1) / 2 * k);
    const out = document.createElement('canvas'); out.width = OW; out.height = OH;
    const c = out.getContext('2d');
    if (!c) { toast('That picture is too big for the browser; pick a smaller size.', 'err', 8000); return null; }
    const td = is3D(), keep = { ...view.view }, cw = view.canvas.width, ch = view.canvas.height;
    shooting = true;
    loading('Taking the picture…');
    try {
      for (let y0 = 0; y0 < OH; y0 += ch) for (let x0 = 0; x0 < OW; x0 += cw) {
        // one picture pixel is 2 / k map vertices
        if (td) view.shotCam = { x0: x0 * 2 / k, y0: y0 * 2 / k, x1: (x0 + cw) * 2 / k, y1: (y0 + ch) * 2 / k };
        else { view.view.scale = k / 2; view.view.x = -x0; view.view.y = -y0; }
        view.dirty = true; view.draw(performance.now());
        c.drawImage(view.canvas, x0, y0);
        await new Promise((r) => setTimeout(r, 0));
      }
      // names and symbols over the whole picture at once, so they line up across the screenfuls
      const ko = octx;
      shotLayer = { k, ls: (s.shotLabel || 100) / 100, W: OW, H: OH };
      octx = c;
      try { c.save(); drawPlaceNames(); } finally { c.restore(); octx = ko; shotLayer = null; }
    } finally {
      view.shotCam = null; Object.assign(view.view, keep); view.dirty = true; shooting = false;
      drawOverlay();
    }
    try {
      const blob = await new Promise((r) => out.toBlob(r, 'image/png'));
      const bytes = new Uint8Array(await blob.arrayBuffer());
      const name = `${M2.basename(p.mapDir)} ${timestamp()}.png`;
      const file = M2.join(p.loc.modRoot, 'map_painter_pictures', name);
      await host.writeFile(file, bytes);
      lastShot = file;
      toast(`Saved ${name} (${OW} × ${OH}) in ${M2.basename(p.loc.modRoot)}\\map_painter_pictures.`, 'ok', 9000);
      renderShotPanel();
      return file;
    } catch (e) { console.error(e); toast('The picture could not be saved: ' + e.message, 'err', 9000); return null; } finally { loading(null); }
  }

  // ---------------------------------------------------------------- screen grab (Grab button)
  // The view as it is now (the 3D camera, or the 2D view), rendered again at 1920 x 1080 with the names and
  // symbols that are on and a logo in a corner, saved as a PNG in <mod>\map_painter_pictures. The logo is
  // the Scenery Studio one unless another picture is picked (kept in the app folder's logos).
  const GRAB_W = 1920, GRAB_H = 1080;
  const LOGO_DEF = { on: true, corner: 'br', width: 230, side: 115, edge: 40 };
  const CORNERS = [['tl', 'Top left'], ['tr', 'Top right'], ['bl', 'Bottom left'], ['br', 'Bottom right']];
  let logoImg = null, logoFor = null, lastGrab = null;
  const logoCfg = () => ({ ...LOGO_DEF, ...(S().grabLogo || {}) });
  function logoPut(o) { S().grabLogo = { ...(S().grabLogo || {}), ...o }; saveSettings(); }
  // the logo without the see-through margin around it
  function logoTrim(bmp) {
    const w = bmp.width, h = bmp.height;
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const cx = cv.getContext('2d', { willReadFrequently: true });
    cx.drawImage(bmp, 0, 0); if (bmp.close) bmp.close();
    const a = cx.getImageData(0, 0, w, h).data;
    let x0 = w, y0 = h, x1 = -1, y1 = -1;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (a[(y * w + x) * 4 + 3] > 8) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    if (x1 < 0 || (x0 === 0 && y0 === 0 && x1 === w - 1 && y1 === h - 1)) return cv;
    const out = document.createElement('canvas'); out.width = x1 - x0 + 1; out.height = y1 - y0 + 1;
    out.getContext('2d').drawImage(cv, -x0, -y0);
    return out;
  }
  async function loadLogo() {
    const c = logoCfg(), key = c.file || '';
    if (logoImg && logoFor === key) return logoImg;
    let bmp = null;
    if (c.file) {
      try { bmp = (await guidePicture(await host.read(c.file), c.file)).bmp; }
      catch (e) { console.warn('logo', e); toast(`Logo not found: ${c.name || c.file}. The Scenery Studio wordmark is used instead.`, 'err', 8000); }
    }
    if (!bmp) { bmp=document.createElement('canvas');bmp.width=520;bmp.height=74;const cx=bmp.getContext('2d');cx.font='600 46px Georgia';cx.fillStyle='#e7d6ae';cx.fillText('Scenery Studio',16,54); }
    logoImg = logoTrim(bmp); logoFor = key;
    return logoImg;
  }
  async function importLogo(file) {
    if (!file) file = await pickImageFile();
    if (!file) return;
    try {
      const pic = await guidePicture(file.bytes, file.name); pic.bmp.close();
      const dir = M2.join((await host.appdir()).dir, 'logos');
      const clean = file.name.replace(/[\\/:*?"<>|]/g, '_');
      const dot = clean.lastIndexOf('.') > 0 ? clean.lastIndexOf('.') : clean.length;
      let path = M2.join(dir, clean);
      for (let n = 2; await host.exists(path); n++) path = M2.join(dir, `${clean.slice(0, dot)} (${n})${clean.slice(dot)}`);
      await host.writeFile(path, file.bytes);
      const old = logoCfg().file;
      logoPut({ file: path, name: clean, on: true }); logoImg = null;
      if (old && norm(old) !== norm(path)) host.removeFile(old).catch((e) => console.warn(e));
      toast(`Screen grabs now use ${clean} as the logo.`, 'ok', 6000);
      renderShotPanel();
    } catch (e) { toast(`Could not use ${file.name} as a logo: ${e.message}`, 'err', 8000); }
  }
  function defaultLogo() {
    const old = logoCfg().file;
    logoPut({ file: null, name: null }); logoImg = null;
    if (old) host.removeFile(old).catch((e) => console.warn(e));
    renderShotPanel();
  }
  function drawLogo(c, img) {
    const L = logoCfg(), w = L.width, h = w * img.height / img.width;
    const x = L.corner[1] === 'r' ? GRAB_W - L.side - w : L.side;
    const y = L.corner[0] === 'b' ? GRAB_H - L.edge - h : L.edge;
    c.save(); c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high'; c.drawImage(img, x, y, w, h); c.restore();
  }
  function renderGrabSection(box) {
    const L = logoCfg();
    box.append(el('div', { class: 'cp-head' }, el('b', { text: `Screen grab ${GRAB_W} × ${GRAB_H}` }), el('span', { class: 'cp-help', text: 'The view as it is now, with your logo.' })));
    const grid = el('div', { class: 'cp-grid' });
    const chk = el('input', { type: 'checkbox' }); chk.checked = L.on;
    chk.addEventListener('change', () => { logoPut({ on: chk.checked }); renderShotPanel(); });
    grid.append(el('label', { text: 'Logo' }), chk, el('span', { class: 'cp-val', text: L.file ? L.name : 'Requiem' }));
    const slider = (label, key, min, max) => {
      const val = el('span', { class: 'cp-val', text: `${L[key]}` });
      const inp = el('input', { type: 'range', min, max, step: 1, value: L[key] });
      inp.addEventListener('input', () => { val.textContent = inp.value; logoPut({ [key]: +inp.value }); });
      grid.append(el('label', { text: label }), inp, val);
    };
    slider('Logo width', 'width', 40, 900);
    slider(L.corner[1] === 'r' ? 'From right' : 'From left', 'side', 0, 900);
    slider(L.corner[0] === 'b' ? 'From bottom' : 'From top', 'edge', 0, 500);
    box.append(grid);
    const seg = el('div', { class: 'seg pc-modes' });
    for (const [k, t] of CORNERS) seg.append(el('button', { text: t, class: L.corner === k ? 'active' : '', onclick: () => { logoPut({ corner: k }); renderShotPanel(); } }));
    box.append(seg);
    const row = el('div', { class: 'seg pc-modes' },
      el('button', { class: 'active', text: 'Take screen grab', title: 'Also the Grab button in the top bar', onclick: () => takeGrab() }),
      el('button', { text: 'Use another logo…', title: 'A PNG with a see-through background works best; empty margins are trimmed', onclick: () => importLogo() }));
    if (L.file) row.append(el('button', { text: 'Requiem logo', title: 'Go back to the Scenery Studio logo', onclick: () => defaultLogo() }));
    box.append(row);
    if (lastGrab) box.append(el('div', { class: 'cp-note' }, `Saved ${M2.basename(lastGrab)} `, el('a', { href: '#', text: 'Show in folder', onclick: (e) => { e.preventDefault(); host.showItem(lastGrab); } })));
  }
  $('#btnGrab').addEventListener('click', () => takeGrab());
  async function takeGrab() {
    const p = state.project;
    if (!p || !view || shooting) { if (!p) toast('Open a map first.'); return null; }
    const s = S(), dpr = window.devicePixelRatio || 1, td = is3D();
    const cw = view.canvas.width, ch = view.canvas.height, cssH = overlay.clientHeight || ch / dpr;
    const f = GRAB_H / ch;
    // names and symbols the size they are on screen, as a share of the height
    const F = GRAB_H / cssH * (s.shotLabel || 100) / 100;
    const zs = td ? 1 : Math.min(1.25, Math.max(0.45, view.view.scale / (dpr * 2)));
    let logo = null;
    if (logoCfg().on) { try { logo = await loadLogo(); } catch (e) { console.warn('logo', e); toast('The logo could not be loaded; the grab is saved without it.', 'err', 7000); } }
    const out = document.createElement('canvas'); out.width = GRAB_W; out.height = GRAB_H;
    const c = out.getContext('2d');
    const keep = { ...view.view };
    shooting = true;
    loading('Taking the screen grab…');
    try {
      // 2D: the same middle and the same height of map, so a wider or narrower window shows more or less at the sides
      if (!td) { view.view.scale = keep.scale * f; view.view.x = GRAB_W / 2 - (cw / 2 - keep.x) * f; view.view.y = GRAB_H / 2 - (ch / 2 - keep.y) * f; }
      view.forceSize = { w: GRAB_W, h: GRAB_H };
      view.dirty = true; view.draw(performance.now());
      c.drawImage(view.canvas, 0, 0, GRAB_W, GRAB_H);
      const proj = (tx, ty) => {
        const x = 2 * tx + 1, y = 2 * ty + 1;
        const q = td ? view.project3D(x, y, view.heightAt(x, y)) : view.toScreen(x, y);
        return q && { x: q.x * dpr, y: q.y * dpr };
      };
      const ko = octx;
      shotLayer = { proj, F, z: zs * F, W: GRAB_W, H: GRAB_H };
      octx = c;
      try { c.save(); drawPlaceNames(); } finally { c.restore(); octx = ko; shotLayer = null; }
      if (logo) drawLogo(c, logo);
    } finally {
      view.forceSize = null; Object.assign(view.view, keep); view.dirty = true; shooting = false;
      drawOverlay();
    }
    try {
      const blob = await new Promise((r) => out.toBlob(r, 'image/png'));
      const bytes = new Uint8Array(await blob.arrayBuffer());
      const name = `${M2.basename(p.mapDir)} grab ${timestamp()}.png`;
      const file = M2.join(p.loc.modRoot, 'map_painter_pictures', name);
      await host.writeFile(file, bytes);
      lastGrab = file;
      toast(`Saved ${name} (${GRAB_W} × ${GRAB_H}) in ${M2.basename(p.loc.modRoot)}\\map_painter_pictures.`, 'ok', 9000);
      renderShotPanel();
      return file;
    } catch (e) { console.error(e); toast('The screen grab could not be saved: ' + e.message, 'err', 9000); return null; } finally { loading(null); }
  }

  // ---------------------------------------------------------------- height ramp and cavity mask
  // The height ramp picks the texture for each spot from its height: stops along the ramp, each with a
  // texture (ground type + climate), from the lowest height (left) to the highest (right). Kept per map.
  let rampSel = -1;
  const rampActive = () => !!(S().rampOn && state.project && state.target === 'tex');
  function ramp() {
    const p = state.project;
    const all = S().ramps || (S().ramps = {});
    let R = all[p.mapDir];
    if (!R) {
      // a start: medium fertility at the coast up to high mountains on the peaks, in the map's main climate
      let ci = 0;
      p.clCounts.forEach((n, k) => { if (n > p.clCounts[ci]) ci = k; });
      const gi = (key) => p.gtTable.findIndex((g) => g.key === key);
      const lo = gi('fertility_medium'), hi = gi('mountains_high');
      R = all[p.mapDir] = { lo: 0, hi: Math.max(100, Math.round(p.heights.max || 1000)), blend: 50, stops: [] };
      if (lo >= 0) R.stops.push({ t: 0, gt: lo, cl: ci });
      if (hi >= 0) R.stops.push({ t: 1, gt: hi, cl: ci });
    }
    R.stops = R.stops.filter((st) => st.gt < p.gtTable.length && st.cl < p.climates.length);
    return R;
  }
  const rampSorted = () => ramp().stops.slice().sort((a, b) => a.t - b.t);
  // the stop to paint at height h, map vertex x, y. Between two stops the textures are mixed in a
  // patchy pattern over the middle part of the gap (Mix sets how much of it); 0 gives hard bands.
  function rampPick(st, R, h, x, y) {
    if (!st.length) return null;
    const t = (h - R.lo) / Math.max(1e-6, R.hi - R.lo);
    if (t <= st[0].t) return st[0];
    const last = st[st.length - 1];
    if (t >= last.t) return last;
    let k = 0;
    while (k < st.length - 2 && t >= st[k + 1].t) k++;
    const a = st[k], b = st[k + 1];
    const f = (t - a.t) / Math.max(1e-6, b.t - a.t);
    const bw = Math.min(1, Math.max(0, R.blend / 100));
    const n = Math.min(1, Math.max(0, 0.5 + 0.55 * fractal(x, y))) * 0.65 + hash2(x, y) * 0.35;
    return f > 0.5 + (n - 0.5) * bw ? b : a;
  }

  // cavity at a map vertex, -1 (deep hollow) .. 1 (sharp ridge): the same sum as the Cavity view, at the
  // same exaggeration and strength, so the mask matches what the view shows
  function cavityAt(x, y) {
    const p = state.project, D = p.heights.data, W = p.W, H = p.H;
    const at = (xx, yy) => D[Math.min(H - 1, Math.max(0, yy)) * W + Math.min(W - 1, Math.max(0, xx))];
    const h = D[y * W + x];
    let c = 0;
    for (let k = 0; k < 4; k++) {
      const r = 1 << k;
      const a = 0.25 * (at(x + r, y) + at(x - r, y) + at(x, y + r) + at(x, y - r));
      c += (a - h) / r * (k === 0 ? 1 : 0.6);
    }
    c *= (S().exag3d || 1) * 0.0012;
    return -Math.tanh(2.5 * (S().cavityStrength || 1) * c);
  }
  // null when the mask is off, else a test for map vertex x, y
  function maskTest() {
    const m = S().maskMode;
    if (!m || m === 'off') return null;
    if (m === 'height') {
      // only ground within the height range (metres, at the map vertex), whichever way round the ends are set
      const p = state.project, D = p.heights.data, W = p.W, a = S().maskLo ?? 0, b = S().maskHi ?? 1000;
      const lo = Math.min(a, b), hi = Math.max(a, b), soft = Math.max(0, S().maskSoft || 0);
      if (!soft) return (x, y) => { const h = D[y * W + x]; return h >= lo && h <= hi; };
      // Soften: beyond From and To the chance of a spot being painted falls from 1 to 0 over that many
      // metres. The scatter is fixed per spot, so painting over it again gives the same pattern.
      return (x, y) => {
        const h = D[y * W + x];
        const w = h < lo ? 1 - (lo - h) / soft : h > hi ? 1 - (h - hi) / soft : 1;
        return w >= 1 || (w > 0 && hash2(x + 7919, y + 104729) < w);
      };
    }
    const thr = (S().maskThr || 0) / 100;
    return m === 'ridges' ? (x, y) => cavityAt(x, y) > thr : (x, y) => cavityAt(x, y) < thr;
  }

  // what a texture spot becomes: [ground, climate] or null to leave it. Shared by the brush, fill and
  // Paint whole map. Builds the per-stroke settings once.
  // ---------------------------------------------------------------- coast brush
  // With Coast on, the brush, Fill and "Paint all coasts" only paint within a set distance of the coastline,
  // on the land side, the sea side or both, either everywhere in that band (Constant) or thinning out with
  // distance (Gradient: a fixed dither, so going over the same spot again gives the same pattern).
  const coastOn = () => !!S().coastOn && state.target !== 'height';
  let coastCache = null; // { mask: water at the time, dLand, dSea (vertices), band: canvas }
  // exact Euclidean distance (in vertices) from every vertex to the nearest vertex with src[i] = 1
  function distanceField(src, W, H) {
    const INF = 1e20, n = Math.max(W, H);
    const f = new Float64Array(n), d = new Float64Array(n), z = new Float64Array(n + 1), v = new Int32Array(n);
    const g = new Float64Array(W * H);
    for (let i = 0; i < W * H; i++) g[i] = src[i] ? 0 : INF;
    const pass = (len, get, set) => {
      for (let q = 0; q < len; q++) f[q] = get(q);
      let k = 0; v[0] = 0; z[0] = -INF; z[1] = INF;
      for (let q = 1; q < len; q++) {
        let s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
        while (s <= z[k]) { k--; s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]); }
        k++; v[k] = q; z[k] = s; z[k + 1] = INF;
      }
      k = 0;
      for (let q = 0; q < len; q++) { while (z[k + 1] < q) k++; const r = v[k]; d[q] = (q - r) * (q - r) + f[r]; }
      for (let q = 0; q < len; q++) set(q, d[q]);
    };
    for (let x = 0; x < W; x++) pass(H, (q) => g[q * W + x], (q, val) => { g[q * W + x] = val; });
    for (let y = 0; y < H; y++) pass(W, (q) => g[y * W + q], (q, val) => { g[y * W + q] = val; });
    const out = new Float32Array(W * H);
    for (let i = 0; i < W * H; i++) out[i] = Math.sqrt(g[i]);
    return out;
  }
  // brings the distances up to date with the current coastline (cheap when the coastline hasn't changed)
  function coastPrep() {
    const p = state.project;
    if (!p) return null;
    const N = p.W * p.H, mask = new Uint8Array(N);
    const wt = p.gtTable.map((t) => (t && t.water ? 1 : 0));
    for (let i = 0; i < N; i++) mask[i] = wt[p.gtIdx[i]] || 0;
    if (coastCache && coastCache.project === p && coastCache.mask.length === N) {
      const a = coastCache.mask; let same = true;
      for (let i = 0; i < N; i++) if (a[i] !== mask[i]) { same = false; break; }
      if (same) return coastCache;
    }
    const land = new Uint8Array(N);
    for (let i = 0; i < N; i++) land[i] = mask[i] ? 0 : 1;
    coastCache = { project: p, mask, dLand: distanceField(mask, p.W, p.H), dSea: distanceField(land, p.W, p.H), band: null, bandKey: '' };
    return coastCache;
  }
  const coastHash = (x, y) => { let h = (x * 374761393 + y * 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  // 0..1: how much of this vertex the coast brush takes (before the dither), from the coastline as it was when
  // the stroke began
  function coastFactor(c, i) {
    const s = S(), water = c.mask[i];
    const side = s.coastSide || 'land';
    if (water ? side === 'land' : side === 'sea') return 0;
    const d = (water ? c.dSea[i] : c.dLand[i]) / 2; // tiles (two vertices to a tile)
    const D = Math.max(0.5, +s.coastDist || 2);
    if (d > D) return 0;
    if (s.coastFalloff !== 'gradient') return 1;
    return Math.max(0, Math.min(1, 1 - (d - 0.5) / D));
  }
  function coastTest() {
    if (!coastOn()) return null;
    const c = coastCache && coastCache.project === state.project ? coastCache : coastPrep();
    if (!c) return null;
    return (i, x, y) => { const f = coastFactor(c, i); return f > 0 && (f >= 1 || coastHash(x, y) < f); };
  }
  function coastApplyAll() {
    const p = state.project;
    if (!p) return;
    if (!canPaint()) { toast(state.target === 'climate' ? 'Pick a climate first.' : rampActive() ? 'Add a stop to the height ramp first.' : 'Pick a texture in the key first.'); return; }
    coastPrep();
    const paint = texPainter();
    beginStroke();
    let n = 0;
    for (let y = 0; y < p.H; y++) for (let x = 0; x < p.W; x++) {
      const i = y * p.W + x;
      const v = paint(i, x, y);
      if (v && (v[0] !== p.gtIdx[i] || v[1] !== p.clIdx[i])) { setTile(i, v[0], v[1]); n++; }
    }
    endStroke();
    flushDirty();
    coastCache && (coastCache.bandKey = '');
    drawOverlay();
    toast(n ? `Painted ${Math.round(n / 4).toLocaleString()} tiles along the coast (Ctrl+Z undoes it)` : 'Nothing to change', '', 3000);
  }
  // the band the coast brush can reach, tinted on the 2D view
  function coastBand() {
    const p = state.project, s = S();
    const c = coastCache && coastCache.project === p ? coastCache : coastPrep();
    const key = `${s.coastSide}|${s.coastDist}|${s.coastFalloff}`;
    if (c.band && c.bandKey === key) return c.band;
    const cv = c.band || document.createElement('canvas');
    cv.width = p.W; cv.height = p.H;
    const cx = cv.getContext('2d'), img = cx.createImageData(p.W, p.H), d = img.data;
    for (let y = 0; y < p.H; y++) for (let x = 0; x < p.W; x++) {
      const i = y * p.W + x, f = coastFactor(c, i);
      if (f <= 0) continue;
      const o = i * 4; d[o] = 60; d[o + 1] = 230; d[o + 2] = 255; d[o + 3] = Math.round(40 + 90 * f);
    }
    cx.putImageData(img, 0, 0);
    c.band = cv; c.bandKey = key;
    return cv;
  }
  function drawCoastBand() {
    if (!coastOn() || S().coastShow === false || is3D() || !state.project) return;
    const p = state.project, a = view.toScreen(-0.5, -0.5), b = view.toScreen(p.W - 0.5, p.H - 0.5);
    octx.save();
    octx.imageSmoothingEnabled = false;
    octx.drawImage(coastBand(), a.x, a.y, b.x - a.x, b.y - a.y);
    octx.restore();
  }
  function renderCoastPanel() {
    const box = $('#coastPanel');
    if (!box) return;
    const s = S();
    box.textContent = '';
    const changed = () => { saveSettings(); drawOverlay(); };
    box.append(el('div', { class: 'cp-head' },
      el('b', { text: 'Coast brush' }),
      el('span', { class: 'cp-help', text: 'The brush, Fill and the button below paint only this close to the coastline.' }),
      el('button', { class: 'ramp-x', title: 'Turn the coast brush off', text: '×', onclick: () => setCoast(false) })));
    const grid = el('div', { class: 'cp-grid' });
    const side = el('select', {});
    for (const [v, t] of [['land', 'Land side'], ['sea', 'Sea side'], ['both', 'Both sides']]) side.append(el('option', { value: v, text: t }));
    side.value = s.coastSide || 'land';
    side.addEventListener('change', () => { s.coastSide = side.value; changed(); });
    grid.append(el('label', { text: 'Side' }), side, el('span', {}));
    const dv = el('span', { class: 'cp-val', text: `${(+s.coastDist).toFixed(1)}` });
    const dist = el('input', { type: 'range', min: 0.5, max: 40, step: 0.5, value: s.coastDist });
    dist.addEventListener('input', () => { s.coastDist = +dist.value; dv.textContent = (+dist.value).toFixed(1); changed(); });
    grid.append(el('label', { text: 'Distance (tiles)' }), dist, dv);
    const fall = el('div', { class: 'seg' });
    for (const [v, t, tip] of [['constant', 'Constant', 'Paints every tile in the band'], ['gradient', 'Gradient', 'Paints fewer tiles the further from the coast, none at the set distance']]) {
      const btn = el('button', { text: t, title: tip, class: (s.coastFalloff || 'constant') === v ? 'active' : '' });
      btn.addEventListener('click', () => { s.coastFalloff = v; renderCoastPanel(); changed(); });
      fall.append(btn);
    }
    grid.append(el('label', { text: 'Falloff' }), fall, el('span', {}));
    const show = el('input', { type: 'checkbox' }); show.checked = s.coastShow !== false;
    show.addEventListener('change', () => { s.coastShow = show.checked; changed(); });
    grid.append(el('label', { text: 'Show the band' }), el('div', {}, show, ' in 2D'), el('span', {}));
    box.append(grid);
    box.append(el('div', { class: 'cp-foot' },
      el('span', { text: 'Uses the texture on the brush (or the height ramp when it is on).' }),
      el('button', { text: 'Paint all coasts', title: 'Paints the whole band around every coast of the map at once (one undo step)', onclick: coastApplyAll })));
  }
  function setCoast(on) {
    S().coastOn = on; saveSettings();
    $('#btnCoast').classList.toggle('active', on);
    const box = $('#coastPanel');
    if (box) { box.hidden = !on; if (on) renderCoastPanel(); }
    if (on && state.project) coastPrep();
    drawOverlay();
  }


  // ---------------------------------------------------------------- farmland preview
  // The game swaps low/medium/high fertility ground for the cultivated_low/medium/high textures in farmed
  // regions once a campaign runs. This shows those textures in the regions you choose (all, or picked by
  // clicking the map) so they can be edited in place. Display only: the map files are never changed.
  const FARM_SLOTS = ['cultivated_low', 'cultivated_medium', 'cultivated_high'];
  const FARM_FROM = ['fertility_low', 'fertility_medium', 'fertility_high'];
  const FARM_IDX0 = 61; // ground indices 61..63 are free (maps use about 20)
  let farmKey = null, farmGt = null, farmPick = false;
  function farmCfg() { return farmKey ? ((S().farmland || {})[farmKey] || null) : null; }
  function farmPut(patch) {
    const all = { ...(S().farmland || {}) };
    all[farmKey] = { on: false, mode: 'all', regions: [], ...(farmCfg() || {}), ...patch };
    S().farmland = all; saveSettings();
  }
  const farmOn = () => { const c = farmCfg(); return !!(c && c.on && state.project); };
  // Per tile: farmed or not. Settlement and port pixels (black/white) follow the land next to them.
  function farmTiles() {
    const p = state.project, R = p.regions, c = farmCfg();
    if (!R) return null;
    const W = R.width, H = R.height, d = R.data, out = new Uint8Array(W * H);
    const picked = new Set(c.mode === 'picked' ? c.regions : []);
    const memo = new Map();
    const yes = (k) => {
      let v = memo.get(k);
      if (v === undefined) { const r = p.regionByColour.get(k); v = !!r && (c.mode !== 'picked' || picked.has(r.name)); memo.set(k, v); }
      return v;
    };
    const odd = [];
    for (let i = 0; i < W * H; i++) {
      const o = i * 4, k = d[o] + ',' + d[o + 1] + ',' + d[o + 2];
      if (p.regionByColour.has(k)) out[i] = yes(k) ? 1 : 0; else odd.push(i);
    }
    for (const i of odd) {
      const x = i % W, y = (i / W) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const xx = x + dx, yy = y + dy;
        if (xx >= 0 && yy >= 0 && xx < W && yy < H && out[yy * W + xx]) { out[i] = 1; break; }
      }
    }
    return { W, H, t: out };
  }
  // Ground indices as drawn: the real ones, with fertility swapped for farmland where it applies.
  function farmShown(rect) {
    const p = state.project;
    if (!farmGt) return p.gtIdx;
    const W = p.W, fm = farmGt.map, tl = farmGt.tiles;
    const x0 = rect ? rect.x0 : 0, y0 = rect ? rect.y0 : 0, x1 = rect ? rect.x1 : W - 1, y1 = rect ? rect.y1 : p.H - 1;
    for (let y = y0; y <= y1; y++) {
      const ty = Math.min(tl.H - 1, y >> 1);
      for (let x = x0; x <= x1; x++) {
        const i = y * W + x, g = p.gtIdx[i], f = fm[g];
        farmGt.idx[i] = f !== 255 && tl.t[ty * tl.W + Math.min(tl.W - 1, x >> 1)] ? f : g;
      }
    }
    return farmGt.idx;
  }
  function farmRefresh() {
    const p = state.project;
    if (!p || !view) return;
    const tiles = farmOn() ? farmTiles() : null;
    if (tiles && p.gtTable.length <= FARM_IDX0) {
      const map = new Uint8Array(256).fill(255);
      FARM_FROM.forEach((key, k) => { const gi = p.gtTable.findIndex((g) => g.key === key); if (gi >= 0) map[gi] = FARM_IDX0 + k; });
      farmGt = { tiles, map, idx: new Uint8Array(p.gtIdx.length) };
    } else farmGt = null;
    view.updateRect(farmShown(null), p.clIdx, 0, 0, p.W - 1, p.H - 1);
    $('#btnFarm').classList.toggle('has', !!farmGt);
    view.dirty = true;
  }
  function farmLoad(mapDir) {
    farmKey = norm(mapDir); farmPick = false;
    farmRefresh(); renderFarmPanel();
  }
  function farmToggleAt(cx, cy) {
    const p = state.project, R = p.regions, m = screenToMap(cx, cy);
    if (!R || !m) return;
    const tx = Math.min(R.width - 1, Math.max(0, Math.floor(m.x / 2))), ty = Math.min(R.height - 1, Math.max(0, Math.floor(m.y / 2)));
    const o = (ty * R.width + tx) * 4, r = p.regionByColour.get(R.data[o] + ',' + R.data[o + 1] + ',' + R.data[o + 2]);
    if (!r) return;
    const set = new Set(farmCfg().regions || []);
    if (set.has(r.name)) set.delete(r.name); else set.add(r.name);
    farmPut({ regions: [...set].sort(), mode: 'picked', on: true });
    farmRefresh(); renderFarmPanel();
  }
  // picking: clicks on the map toggle a region instead of painting (capture on the stage, before the canvas)
  $('#stage').addEventListener('pointerdown', (e) => {
    if (!farmPick || !state.project || e.button !== 0 || spaceDown || e.target !== glCanvas) return;
    e.stopPropagation(); e.preventDefault();
    farmToggleAt(e.offsetX, e.offsetY);
  }, true);
  function setFarmPanel(on) {
    $('#farmPanel').hidden = !on;
    $('#btnFarm').classList.toggle('active', on);
    if (!on) farmPick = false;
    renderFarmPanel();
  }
  $('#btnFarm').addEventListener('click', () => setFarmPanel($('#farmPanel').hidden));
  function renderFarmPanel() {
    const box = $('#farmPanel');
    if (!box || box.hidden) return;
    box.textContent = '';
    box.append(el('div', { class: 'cp-head' }, el('b', { text: 'Farmland' }),
      el('span', { class: 'cp-help', text: 'Shows the cultivated textures the game uses on low, medium and high fertility ground in farmed regions.' }),
      el('button', { class: 'ramp-x', title: 'Close', text: '×', onclick: () => setFarmPanel(false) })));
    if (!state.project) { box.append(el('div', { class: 'cp-note', text: 'Open a map first.' })); return; }
    if (!state.project.regions) { box.append(el('div', { class: 'cp-note', text: 'This map has no map_regions.tga, so there are no regions to farm.' })); return; }
    const c = farmCfg() || { on: false, mode: 'all', regions: [] };
    const show = el('input', { type: 'checkbox' }); show.checked = !!c.on;
    show.addEventListener('change', () => { farmPut({ on: show.checked }); farmRefresh(); renderFarmPanel(); });
    box.append(el('div', { class: 'cp-target' }, el('label', { class: 'chk' }, show, ' Show farmland')));
    const seg = el('div', { class: 'seg pc-modes' });
    for (const [v, t, tip] of [['all', 'All regions', 'Every region shows farmland'], ['picked', 'Picked regions', 'Only the regions you pick']]) {
      seg.append(el('button', { text: t, title: tip, class: (c.mode || 'all') === v ? 'active' : '', onclick: () => { farmPut({ mode: v, on: true }); if (v === 'all') farmPick = false; farmRefresh(); renderFarmPanel(); } }));
    }
    box.append(seg);
    if ((c.mode || 'all') === 'picked') {
      const n = (c.regions || []).length;
      box.append(el('div', { class: 'cp-foot' },
        el('span', { text: farmPick ? 'Click regions on the map to add or remove them.' : `${n} region${n === 1 ? '' : 's'} picked.` }),
        el('button', { text: farmPick ? 'Done picking' : 'Pick on map', class: farmPick ? 'active' : '', title: 'While on, a click on the map adds or removes that region instead of painting', onclick: () => { farmPick = !farmPick; renderFarmPanel(); } }),
        n ? el('button', { text: 'Clear', onclick: () => { farmPut({ regions: [] }); farmRefresh(); renderFarmPanel(); } }) : null));
      if (n) box.append(el('div', { class: 'cp-note', text: c.regions.map((r) => r.replace(/_Province$/, '').replace(/_/g, ' ')).join(', ') }));
    }
    const p = state.project, miss = [];
    p.climates.forEach((cl, ci) => { if (!p.clCounts[ci]) return; FARM_SLOTS.forEach((slot) => { if (!textureNameFor(cl, slot, state.season)) miss.push(`${cl.label}: ${M2.SLOT_LABELS[slot]}`); }); });
    box.append(el('div', { class: 'cp-note', text: 'Edit or replace the farmland textures from the Farmland rows in the texture key. The map files are not changed.' +
      (miss.length ? ` No farmland texture is set for ${miss.slice(0, 4).join('; ')}${miss.length > 4 ? '…' : ''}; those show the fertility texture.` : '') }));
  }

  // ---------------------------------------------------------------- forest eraser
  // With Erase forest on, the brush and Fill only touch dense or sparse forest ground. Each spot becomes the
  // nearest open land around it (so the clearing matches its surroundings), or the brush texture. The climate
  // stays as it is; the trees go with the forest ground.
  const FOREST_KEYS = { both: ['forest_dense', 'forest_sparse'], dense: ['forest_dense'], sparse: ['forest_sparse'] };
  const forestOn = () => !!S().forestOn && state.target === 'tex';
  function forestTest() {
    if (!forestOn()) return null;
    const p = state.project, s = S(), b = state.brush;
    const keys = FOREST_KEYS[s.forestKind] || FOREST_KEYS.both;
    const isForest = p.gtTable.map((g) => !!g && keys.includes(g.key));
    const anyForest = p.gtTable.map((g) => !!g && /^forest_/.test(g.key));
    const open = p.gtTable.map((g) => !!g && !g.water && !g.unknown && !/^forest_|^impassable/.test(g.key));
    const useBrush = s.forestWith === 'brush';
    const W = p.W, H = p.H;
    // nearest open land: rings of growing size around the spot
    const nearest = (x, y) => {
      for (let r = 1; r <= 40; r++) {
        let best = -1, bd = 1e9;
        for (let dy = -r; dy <= r; dy++) {
          const yy = y + dy;
          if (yy < 0 || yy >= H) continue;
          const step = Math.abs(dy) === r ? 1 : 2 * r;
          for (let dx = -r; dx <= r; dx += step) {
            const xx = x + dx;
            if (xx < 0 || xx >= W) continue;
            const g = p.gtIdx[yy * W + xx];
            if (!open[g]) continue;
            const d = dx * dx + dy * dy;
            if (d < bd) { bd = d; best = g; }
          }
        }
        if (best >= 0) return best;
      }
      return -1;
    };
    return (i, x, y) => {
      if (!isForest[p.gtIdx[i]]) return null;
      let g;
      if (useBrush) { if (!(b.gt >= 0) || anyForest[b.gt]) return null; g = b.gt; }
      else { g = nearest(x, y); if (g < 0) return null; }
      return [g, p.clIdx[i]];
    };
  }
  function setForest(on) {
    S().forestOn = on; saveSettings();
    $('#btnForest').classList.toggle('active', on);
    $$('.forest-only').forEach((e) => { e.hidden = !on; });
    if (on && S().rampOn) setRampOn(false);
    drawOverlay();
  }

  function texPainter() {
    const p = state.project, b = state.brush;
    if (state.target === 'climate') {
      // the Climates brush: map_climates.tga only (sea included), within the mask and coast band
      const cl = state.clBrush, mask = maskTest(), coast = coastTest();
      return (i, x, y) => {
        if (cl < 0) return null;
        if (mask && !mask(x, y)) return null;
        if (coast && !coast(i, x, y)) return null;
        return [p.gtIdx[i], cl];
      };
    }
    const pGT = $('#paintGT').checked, pCL = $('#paintCL').checked;
    const protect = S().protectCoast;
    const useRamp = rampActive();
    const R = useRamp ? ramp() : null, st = useRamp ? rampSorted() : null;
    const mask = maskTest();
    const coast = coastTest();
    const forest = forestTest();
    return (i, x, y) => {
      if (mask && !mask(x, y)) return null;
      if (coast && !coast(i, x, y)) return null;
      if (forest) return forest(i, x, y);
      let bg = b.gt, bc = b.cl;
      if (useRamp) { const s = rampPick(st, R, p.heights.data[i], x, y); if (!s) return null; bg = s.gt; bc = s.cl; }
      const sG = pGT && bg >= 0, sC = pCL && bc >= 0;
      if (!sG && !sC) return null;
      const curWater = !!p.gtTable[p.gtIdx[i]].water;
      if (protect && sG && !!p.gtTable[bg].water !== curWater) return null;
      if (protect && !sG && curWater) return null;
      return [sG ? bg : p.gtIdx[i], sC ? bc : p.clIdx[i]];
    };
  }

  function rampApplyAll() {
    const p = state.project;
    if (!rampActive() || !ramp().stops.length) return;
    const paint = texPainter();
    beginStroke();
    let n = 0;
    for (let y = 0; y < p.H; y++) for (let x = 0; x < p.W; x++) {
      const i = y * p.W + x;
      const v = paint(i, x, y);
      if (v && (v[0] !== p.gtIdx[i] || v[1] !== p.clIdx[i])) { setTile(i, v[0], v[1]); n++; }
    }
    endStroke();
    flushDirty();
    toast(n ? `Painted ${Math.round(n / 4).toLocaleString()} tiles from the ramp (Ctrl+Z undoes it)` : 'Nothing to change', '', 3000);
  }

  function stopLook(st) {
    const p = state.project;
    const layer = st.cl >= 0 ? layerFor(st.gt, st.cl) : null;
    const gt = p.gtTable[st.gt];
    const name = (gt ? gt.label : '?') + (st.cl >= 0 && p.climates[st.cl] ? ` · ${p.climates[st.cl].label}` : '');
    const bg = layer && layer.thumb ? `url(${layer.thumb}) center/cover` : rgbCss(gt && gt.water ? [40, 90, 160] : gt && gt.rgb);
    return { name, bg };
  }
  function setRampOn(on) {
    S().rampOn = on; saveSettings();
    $('#btnRamp').classList.toggle('active', on);
    if (on && state.target !== 'tex') setTarget('tex');
    if (on && (state.tool === 'pick' || state.tool === 'pan')) setTool('brush');
    renderRamp();
  }
  function renderRamp() {
    const panel = $('#rampPanel');
    const on = !!(S().rampOn && state.project);
    panel.hidden = !on;
    $('#btnRamp').classList.toggle('active', !!S().rampOn);
    if (!on) return;
    const R = ramp();
    if (rampSel >= R.stops.length) rampSel = -1;
    const st = R.stops.map((s, k) => ({ s, k })).sort((a, b) => a.s.t - b.s.t);
    const toM = (t) => Math.round(R.lo + t * (R.hi - R.lo));
    panel.innerHTML = '';
    const bar = el('div', { class: 'ramp-bar', title: 'Double-click to add a stop here' });
    // each stop's texture fills the bar halfway to its neighbours
    st.forEach(({ s }, j) => {
      const a = j === 0 ? 0 : (st[j - 1].s.t + s.t) / 2, b = j === st.length - 1 ? 1 : (s.t + st[j + 1].s.t) / 2;
      bar.append(el('div', { class: 'ramp-seg', style: `left:${a * 100}%;width:${(b - a) * 100}%;background:${stopLook(s).bg}` }));
    });
    bar.append(el('div', { class: 'ramp-cursor', id: 'rampCursor', hidden: true }));
    const stops = el('div', { class: 'ramp-stops' });
    for (const { s, k } of st) {
      const look = stopLook(s);
      const h = el('div', { class: 'ramp-stop' + (k === rampSel ? ' sel' : ''), style: `left:${s.t * 100}%`, title: `${look.name}\n${toM(s.t)} m\nDrag to move. Click, then pick a texture in the key to change it. Delete removes it.` },
        el('div', { class: 'ramp-chip', style: `background:${look.bg}` }), el('div', { class: 'ramp-m', text: `${toM(s.t)} m` }));
      h.addEventListener('pointerdown', (e) => {
        e.preventDefault(); e.stopPropagation();
        rampSel = k;
        const rect = bar.getBoundingClientRect();
        h.setPointerCapture(e.pointerId);
        let moved = false;
        const move = (ev) => {
          moved = true;
          s.t = Math.min(1, Math.max(0, (ev.clientX - rect.left) / rect.width));
          h.style.left = `${s.t * 100}%`; h.querySelector('.ramp-m').textContent = `${toM(s.t)} m`;
        };
        const up = () => { h.removeEventListener('pointermove', move); h.removeEventListener('pointerup', up); saveSettings(); renderRamp(); };
        h.addEventListener('pointermove', move); h.addEventListener('pointerup', up);
        if (!moved) renderRampInfo();
        $$('.ramp-stop').forEach((x) => x.classList.toggle('sel', x === h));
      });
      h.addEventListener('contextmenu', (e) => { e.preventDefault(); rampRemove(k); });
      stops.append(h);
    }
    bar.addEventListener('dblclick', (e) => {
      const rect = bar.getBoundingClientRect();
      const t = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
      const b = state.brush;
      // the new stop takes the texture picked in the key, or its neighbour's
      const near = st.length ? st.reduce((m, x) => (Math.abs(x.s.t - t) < Math.abs(m.s.t - t) ? x : m)).s : null;
      const gt = b.gt >= 0 ? b.gt : near ? near.gt : 0, cl = b.gt >= 0 ? b.cl : near ? near.cl : 0;
      R.stops.push({ t, gt, cl }); rampSel = R.stops.length - 1;
      saveSettings(); renderRamp();
    });
    const num = (key, title) => {
      const inp = el('input', { type: 'number', step: 10, value: R[key], title });
      inp.addEventListener('change', () => { const v = +inp.value; if (isFinite(v)) { R[key] = v; saveSettings(); renderRamp(); } });
      return inp;
    };
    const blend = el('input', { type: 'range', min: 0, max: 100, step: 5, value: R.blend });
    const blendVal = el('span', { text: `${R.blend}%` });
    blend.addEventListener('input', () => { R.blend = +blend.value; blendVal.textContent = `${R.blend}%`; });
    blend.addEventListener('change', () => saveSettings());
    const fit = el('button', { title: 'Lowest = sea level, highest = the highest point on the map' }, 'Map range');
    fit.onclick = () => { R.lo = 0; R.hi = Math.max(100, Math.round(state.project.heights.max || 1000)); saveSettings(); renderRamp(); };
    const add = el('button', { title: 'Add a stop in the middle (or double-click the bar)' }, 'Add stop');
    add.onclick = () => { const b = state.brush; R.stops.push({ t: 0.5, gt: b.gt >= 0 ? b.gt : (R.stops[0] || { gt: 0 }).gt, cl: b.gt >= 0 ? b.cl : (R.stops[0] || { cl: 0 }).cl }); rampSel = R.stops.length - 1; saveSettings(); renderRamp(); };
    const all = el('button', { class: 'primary', title: 'Paint every spot of the map from the ramp, inside the cavity mask. One undo step.' }, 'Paint whole map');
    all.onclick = rampApplyAll;
    const close = el('button', { class: 'ramp-x', title: 'Turn the height ramp off (R)' }, '×');
    close.onclick = () => setRampOn(false);
    panel.append(
      el('div', { class: 'ramp-head' }, el('b', { text: 'Height ramp' }), el('span', { class: 'ramp-help', text: 'The brush and Fill paint the texture for each spot\'s height.' }), close),
      el('div', { class: 'ramp-wrap' }, bar, stops),
      el('div', { class: 'ramp-row' }, el('label', {}, 'Low ', num('lo', 'Height at the left end, in metres'), ' m'), el('label', {}, 'High ', num('hi', 'Height at the right end, in metres'), ' m'), fit),
      el('div', { class: 'ramp-row' }, el('label', { title: 'How much neighbouring textures mix where they meet. 0% gives sharp bands.' }, 'Mix ', blend, ' ', blendVal)),
      el('div', { class: 'ramp-row', id: 'rampInfo' }),
      el('div', { class: 'ramp-row' }, add, all));
    renderRampInfo();
  }
  function renderRampInfo() {
    const box = $('#rampInfo');
    if (!box) return;
    box.innerHTML = '';
    const R = ramp(), s = R.stops[rampSel];
    if (!s) { box.append(el('span', { class: 'ramp-help', text: 'Click a stop, then click a texture in the key on the right to give it that texture.' })); return; }
    const look = stopLook(s);
    const hIn = el('input', { type: 'number', step: 10, value: Math.round(R.lo + s.t * (R.hi - R.lo)), title: 'This stop\'s height in metres' });
    hIn.addEventListener('change', () => { const v = +hIn.value; if (isFinite(v)) { s.t = Math.min(1, Math.max(0, (v - R.lo) / Math.max(1e-6, R.hi - R.lo))); saveSettings(); renderRamp(); } });
    const rm = el('button', { title: 'Remove this stop (Delete)' }, 'Remove');
    rm.onclick = () => rampRemove(rampSel);
    box.append(el('span', { class: 'ramp-chip', style: `background:${look.bg}` }), el('span', { text: ` ${look.name} at ` }), hIn, ' m ', rm);
  }
  function rampRemove(k) {
    const R = ramp();
    if (k < 0 || k >= R.stops.length) return;
    R.stops.splice(k, 1); rampSel = -1;
    saveSettings(); renderRamp();
  }
  // a texture picked in the key goes to the selected stop
  function rampTakeTexture(gi, ci) {
    if (!rampActive() || rampSel < 0) return;
    const s = ramp().stops[rampSel];
    if (!s) return;
    s.gt = gi; s.cl = ci; saveSettings(); renderRamp();
  }
  function rampHover(h) {
    const c = $('#rampCursor');
    if (!c || !S().rampOn) return;
    const R = ramp();
    const t = (h - R.lo) / Math.max(1e-6, R.hi - R.lo);
    c.hidden = !(t >= 0 && t <= 1);
    c.style.left = `${Math.min(1, Math.max(0, t)) * 100}%`;
  }
  $('#btnRamp').addEventListener('click', () => setRampOn(!S().rampOn));
  $('#btnCoast').addEventListener('click', () => setCoast(!S().coastOn));
  {
    const sel = $('#maskMode'), thr = $('#maskThr'), val = $('#maskThrVal'), show = $('#maskShow');
    const lo = $('#maskLo'), hi = $('#maskHi'), soft = $('#maskSoft');
    const sync = () => {
      const m = S().maskMode || 'off';
      document.body.classList.toggle('mask-on', m !== 'off');
      document.body.classList.toggle('mask-cav', m === 'ridges' || m === 'hollows');
      document.body.classList.toggle('mask-height', m === 'height');
      val.textContent = `${S().maskThr || 0}`;
      // the height sliders run from the map's sea floor to its highest land
      const c = state.project && state.project.heights && state.project.heights.codec;
      const mn = c && c.ok ? Math.floor(c.minSea) : -500, mx = c && c.ok ? Math.ceil(c.maxLand) : 5000;
      for (const [inp, k, d] of [[lo, 'maskLo', 0], [hi, 'maskHi', 1000]]) {
        inp.min = mn; inp.max = mx; inp.step = 1; inp.value = S()[k] ?? d;
        $(`#${inp.id}Val`).textContent = `${Math.round(S()[k] ?? d)} m`;
      }
      soft.value = S().maskSoft || 0; $('#maskSoftVal').textContent = `${S().maskSoft || 0} m`;
    };
    soft.addEventListener('input', () => { S().maskSoft = +soft.value; $('#maskSoftVal').textContent = `${soft.value} m`; applyViewSettings(); });
    soft.addEventListener('change', () => saveSettings());
    for (const [inp, k] of [[lo, 'maskLo'], [hi, 'maskHi']]) {
      inp.addEventListener('input', () => { S()[k] = +inp.value; $(`#${inp.id}Val`).textContent = `${Math.round(+inp.value)} m`; applyViewSettings(); });
      inp.addEventListener('change', () => saveSettings());
    }
    sel.addEventListener('change', () => { S().maskMode = sel.value; saveSettings(); sync(); applyViewSettings(); });
    thr.addEventListener('input', () => { S().maskThr = +thr.value; sync(); applyViewSettings(); });
    thr.addEventListener('change', () => saveSettings());
    show.addEventListener('change', () => { S().maskShow = show.checked; saveSettings(); applyViewSettings(); });
    window.syncMaskUI = () => { sel.value = S().maskMode || 'off'; thr.value = S().maskThr || 0; show.checked = S().maskShow !== false; sync(); };
  }

  window.addEventListener('error', (e) => toast('Something went wrong: ' + (e.message || e.error), 'err', 10000));
  window.addEventListener('unhandledrejection', (e) => toast('Something went wrong: ' + ((e.reason && e.reason.message) || e.reason), 'err', 10000));

  // ---------------------------------------------------------------- start
  (async function init() {
    state.settings = Object.assign({}, DEFAULTS, await host.loadSettings());
    // the game repeats a 512 pixel ground texture every 8 tiles (64 pixels per tile); older settings used 4
    if (!state.settings.texScaleV2) { state.settings.texScaleV2 = true; if (state.settings.texScale === 4) state.settings.texScale = 8; saveSettings(); }
    // a console window started before an update keeps running the old server behind the new page
    host.checkServer().then((msg) => {
      if (!msg) return;
      const b = $('#banner');
      b.innerHTML = '';
      b.append(el('span', { text: msg }), el('button', { onclick: hideBanner }, 'Dismiss'));
      b.hidden = false;
    });
    window.syncMaskUI();
    const s = S();
    $('#brushSize').value = s.brushSize; $('#brushSizeVal').textContent = s.brushSize;
    $('#brushDensity').value = s.brushDensity; $('#brushDensityVal').textContent = s.brushDensity + '%';
    $('#brushHard').value = s.brushHard; $('#brushHardVal').textContent = s.brushHard + '%';
    $('#onlyOnMap').checked = s.onlyOnMap;
    $('#hStrength').value = s.heightStrength; $('#hStrengthVal').textContent = s.heightStrength + '%';
    $('#hTarget').value = s.heightTarget;
    $('#moveCoast').checked = !!s.moveCoast;
    $('#exag').value = s.exag3d; $('#exagVal').textContent = (+s.exag3d).toFixed(1) + '×';
    $('#tipAngle').value = s.tipAngle; $('#tipAngleVal').textContent = s.tipAngle + '°';
    $('#tipRandom').checked = !!s.tipRandom;
    $('#tipSpacing').value = s.tipSpacing; $('#tipSpacingVal').textContent = s.tipSpacing + '%';
    $$('#heightTool button').forEach((b) => b.classList.toggle('active', b.dataset.htool === s.heightTool));
    $$('#strokeMode button').forEach((b) => b.classList.toggle('active', b.dataset.stroke === s.strokeMode));
    document.body.classList.toggle('anchored', s.strokeMode === 'anchored');
    $('#hTargetWrap').classList.toggle('dim', s.heightTool !== 'set');
    setSea(!!s.seaOverlay);
    setTrees(s.trees !== false);
    syncNameButtons();
    placeAllPanels();
    updateBrushUI();
    loadTips();
    requestAnimationFrame(frame);
    const args = await host.args().catch(() => ({}));
    await Portable.init(args);
    const open = args.open;
    if (open) await openAny(open); else await fillWelcome();
  })();

  // exposed for automated tests
  window.app = {
    treeFolder, treePicture, state, loadMap, openAny, selectBrush, save, undo, redo, setMode, fillAt, pickAt, buildKey, get view() { return view; }, reloadLayer, replaceTexture, setTool,
    setTarget, setHeightTool, setHeightTarget, set3D, setSea, loadTips, importTips, setStrokeMode,
    importGuides, startAdjust, endAdjust, showGuidePanel, setGuidesHidden, placeGuide, guidesChanged, removeGuide,
    loadTrees, buildTreeInstances, setTrees, loadGameAssets, buildFog, applyViewSettings, loadPieces,
    pcItems, pcProblems, pcMove, pcFixPorts, pcPortSpot, pcDeleteMany, setForest, forestTest, setTreeColourPanel, setAdjPanel, setLightPanel, lightGet, lightSet, tileBakePending, bakeTiles, tileManifest, lightPresetSave, lightPresetApply, lightOriginal, treeAdj, bakeTrees, seaAdj, seaPicture, bakeSea, seaBakePending, seaShow, pcAdd, pcDelete, pcParse, installStoneForts, setPcMode: (m, t) => { pcMode = m; if (t) { if (m === "fort") pcFortType = t; else pcResType = t; } renderPiecesPanel(); },
    coastPrep, setCoast, coastApplyAll, setColourPanel, layerStage, groundStage, stageInPlace, groundOriginal, refreshAllLayers, rvTileIds, fortImportModel, loadTileModels, setNames, loadPlaceNames, placeName, renamePlace, namesFileData, get rgRegion() { return rgRegion; }, set rgRegion(r) { rgRegion = r; renderBorderPanel(); }, set rgMode(m) { rgMode = m; renderBorderPanel(); }, roStartAdd, roAddAt, roDelete, roSnapshot, importFogMask, removeFogMask, setFogPanel, takePicture, setShotPanel, takeGrab, importLogo, defaultLogo, fogAt, get fogCpu() { return fogCpu; }, setRiverShape, rvCurveCommit, get rvCurve() { return rvCurve; }, groundTakeOutsideEdit, clearStaleGroundCache, landBridges,
  };
})();
