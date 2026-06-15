/**
 * Parser and serializer for descr_banners_new.xml
 *
 * Parsed structure:
 * {
 *   settings: string,          // raw inner XML of <Settings>
 *   factionBanners: Banner[],  // <FactionBanners>
 *   unitBanners: Banner[],     // <UnitSpecificBanners>
 *   holyBanners: Banner[],     // <HolyBanners>
 *   royalBanner: RoyalBanner,  // <RoyalBanner Name="...">
 * }
 *
 * FactionBanner:
 * { name, mainMesh, miniMesh, generalMesh, buildingMesh, effectOffsetX, effectOffsetY, effectOffsetZ,
 *   textures: [{ faction, diffuseMap, translucencyMap }] }
 *
 * UnitBanner / HolyBanner:
 * { name, meshesAndTextures: [{ faction, mesh, diffuseMap, translucencyMap }] }
 *
 * RoyalBanner:
 * { name, meshesAndTextures: [{ faction, mesh, diffuseMap, translucencyMap }] }
 */

function parseAttrs(tag) {
  const attrs = {};
  const re = /(\w+)="([^"]*)"/g;
  let m;
  while ((m = re.exec(tag)) !== null) attrs[m[1]] = m[2];
  return attrs;
}

function innerXml(xml, tag) {
  const open = new RegExp(`<${tag}[^>]*>`, 'i');
  const close = new RegExp(`</${tag}>`, 'i');
  const start = xml.search(open);
  if (start === -1) return '';
  const openMatch = xml.match(open);
  const contentStart = start + openMatch[0].length;
  const end = xml.search(close);
  if (end === -1) return '';
  return xml.slice(contentStart, end).trim();
}

function sectionXml(xml, tag) {
  const re = new RegExp(`(<${tag}[\\s\\S]*?<\\/${tag}>)`, 'i');
  const m = xml.match(re);
  return m ? m[1] : '';
}

export function parseBannersXml(text) {
  // Settings — keep raw inner XML so we don't lose comments/structure
  const settingsMatch = text.match(/<Settings>([\s\S]*?)<\/Settings>/i);
  const settings = settingsMatch ? settingsMatch[1] : '';

  // FactionBanners
  const fbSection = sectionXml(text, 'FactionBanners');
  const factionBanners = parseFactionBanners(fbSection);

  // UnitSpecificBanners
  const ubSection = sectionXml(text, 'UnitSpecificBanners');
  const unitBanners = parseMeshBanners(ubSection);

  // HolyBanners
  const hbSection = sectionXml(text, 'HolyBanners');
  const holyBanners = parseMeshBanners(hbSection);

  // RoyalBanner (single, different tag pattern)
  const rbMatch = text.match(/<RoyalBanner([^>]*)>([\s\S]*?)<\/RoyalBanner>/i);
  let royalBanner = { name: 'royal', meshesAndTextures: [] };
  if (rbMatch) {
    const attrs = parseAttrs(rbMatch[1]);
    royalBanner = { name: attrs.Name || 'royal', meshesAndTextures: parseMeshAndTextures(rbMatch[2]) };
  }

  return { settings, factionBanners, unitBanners, holyBanners, royalBanner };
}

function parseFactionBanners(xml) {
  const banners = [];
  const re = /<Banner([^>]*)>([\s\S]*?)<\/Banner>/gi;
  let m;
  while ((m = re.exec(xml)) !== null) {
    const attrs = parseAttrs(m[1]);
    const textures = [];
    const texRe = /<Texture([^/]*)\/?>/gi;
    let t;
    while ((t = texRe.exec(m[2])) !== null) {
      const ta = parseAttrs(t[1]);
      textures.push({ faction: ta.Faction || '', diffuseMap: ta.DiffuseMap || '', translucencyMap: ta.TranslucencyMap || '' });
    }
    banners.push({
      name: attrs.Name || '',
      mainMesh: attrs.MainMesh || '',
      miniMesh: attrs.MiniMesh || '',
      generalMesh: attrs.GeneralMesh || '',
      buildingMesh: attrs.BuildingMesh || '',
      effectOffsetX: attrs.EffectOffsetX || '0.0',
      effectOffsetY: attrs.EffectOffsetY || '0.0',
      effectOffsetZ: attrs.EffectOffsetZ || '0.0',
      textures,
    });
  }
  return banners;
}

function parseMeshAndTextures(xml) {
  const entries = [];
  const re = /<MeshAndTexture([^/]*)\/?>/gi;
  let m;
  while ((m = re.exec(xml)) !== null) {
    const a = parseAttrs(m[1]);
    entries.push({ faction: a.Faction || '', mesh: a.Mesh || '', diffuseMap: a.DiffuseMap || '', translucencyMap: a.TranslucencyMap || '' });
  }
  return entries;
}

function parseMeshBanners(xml) {
  const banners = [];
  const re = /<Banner([^>]*)>([\s\S]*?)<\/Banner>/gi;
  let m;
  while ((m = re.exec(xml)) !== null) {
    const attrs = parseAttrs(m[1]);
    banners.push({ name: attrs.Name || '', meshesAndTextures: parseMeshAndTextures(m[2]) });
  }
  return banners;
}

// ---- Serializer ----

function indent(n) { return '   '.repeat(n); }

function serialiseFactionBanner(b) {
  const lines = [];
  lines.push(`${indent(2)}<Banner Name="${b.name}" MainMesh="${b.mainMesh}" MiniMesh="${b.miniMesh}" GeneralMesh="${b.generalMesh}" BuildingMesh="${b.buildingMesh}" EffectOffsetX="${b.effectOffsetX}" EffectOffsetY="${b.effectOffsetY}" EffectOffsetZ="${b.effectOffsetZ}">`);
  lines.push(`${indent(3)}<Textures>`);
  for (const t of b.textures) {
    lines.push(`${indent(4)}<Texture Faction="${t.faction}" DiffuseMap="${t.diffuseMap}" TranslucencyMap="${t.translucencyMap}"/>`);
  }
  lines.push(`${indent(3)}</Textures>`);
  lines.push(`${indent(2)}</Banner>`);
  return lines.join('\n');
}

function serialiseMeshBanner(b, ind = 2) {
  const lines = [];
  lines.push(`${indent(ind)}<Banner Name="${b.name}">`);
  lines.push(`${indent(ind + 1)}<MeshesAndTextures>`);
  for (const t of b.meshesAndTextures) {
    lines.push(`${indent(ind + 2)}<MeshAndTexture Faction="${t.faction}" Mesh="${t.mesh}" DiffuseMap="${t.diffuseMap}" TranslucencyMap="${t.translucencyMap}"/>`);
  }
  lines.push(`${indent(ind + 1)}</MeshesAndTextures>`);
  lines.push(`${indent(ind)}</Banner>`);
  return lines.join('\n');
}

export function serialiseBannersXml(data) {
  const lines = [];
  lines.push('<Banners>');
  lines.push(`${indent(1)}<Settings>`);
  lines.push(data.settings);
  lines.push(`${indent(1)}</Settings>`);

  lines.push(`${indent(1)}<FactionBanners>`);
  for (const b of data.factionBanners) lines.push(serialiseFactionBanner(b));
  lines.push(`${indent(1)}</FactionBanners>`);

  lines.push(`${indent(1)}<UnitSpecificBanners>`);
  for (const b of data.unitBanners) lines.push(serialiseMeshBanner(b));
  lines.push(`${indent(1)}</UnitSpecificBanners>`);

  lines.push(`${indent(1)}<HolyBanners>`);
  for (const b of data.holyBanners) lines.push(serialiseMeshBanner(b));
  lines.push(`${indent(1)}</HolyBanners>`);

  lines.push(`${indent(1)}<RoyalBanner Name="${data.royalBanner.name}">`);
  lines.push(`${indent(2)}<MeshesAndTextures>`);
  for (const t of data.royalBanner.meshesAndTextures) {
    lines.push(`${indent(3)}<MeshAndTexture Faction="${t.faction}" Mesh="${t.mesh}" DiffuseMap="${t.diffuseMap}" TranslucencyMap="${t.translucencyMap}"/>`);
  }
  lines.push(`${indent(2)}</MeshesAndTextures>`);
  lines.push(`${indent(1)}</RoyalBanner>`);

  lines.push('</Banners>');
  return lines.join('\n');
}