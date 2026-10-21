import JSZip from 'jszip';

export default async function armoryExport(name, geometry, recipe, sources) {
  if (!geometry.meshes.length) throw new Error('Select at least one visible part before exporting.');
  const zip = new JSZip(), safe = name.trim().replace(/[^a-zA-Z0-9_-]+/g, '_') || 'unit_variation';
  const lines = [`# Armory geometry draft; not a game-ready M2TW model`, `mtllib ${safe}.mtl`], materials = [];
  const used = [...new Set(geometry.meshes.map(mesh => mesh.armorySource))];
  for (let i = 0; i < used.length; i++) {
    const atlas = sources[used[i]].atlas;
    materials.push(`newmtl skin_${i}\nKd 1 1 1\n${atlas ? `map_Kd skin_${i}.png\n` : ''}`);
    if (atlas) {
      const blob = await new Promise(resolve => atlas.toBlob(resolve, 'image/png'));
      if (!blob) throw new Error('Could not export a texture atlas.');
      zip.file(`skin_${i}.png`, blob);
    }
  }
  let offset = 1;
  geometry.meshes.forEach((mesh, index) => {
    lines.push(`o ${mesh.name.replace(/\s+/g, '_')}_${index}`, `usemtl skin_${used.indexOf(mesh.armorySource)}`);
    for (let v = 0; v < mesh.numVertices; v++) {
      lines.push(`v ${mesh.positions[v * 3]} ${mesh.positions[v * 3 + 1]} ${mesh.positions[v * 3 + 2]}`);
      lines.push(`vt ${mesh.uvs[v * 2] * 0.5} ${1 - mesh.uvs[v * 2 + 1]}`);
      lines.push(`vn ${mesh.normals[v * 3]} ${mesh.normals[v * 3 + 1]} ${mesh.normals[v * 3 + 2]}`);
    }
    for (let f = 0; f < mesh.indices.length; f += 3) lines.push(`f ${[0, 1, 2].map(c => { const n = mesh.indices[f + c] + offset; return `${n}/${n}/${n}`; }).join(' ')}`);
    offset += mesh.numVertices;
  });
  zip.file(`${safe}.obj`, lines.join('\n')); zip.file(`${safe}.mtl`, materials.join('\n'));
  zip.file('armory-project.json', JSON.stringify(recipe, null, 2));
  zip.file('README.txt', 'Geometry draft only. OBJ contains the selected, transformed parts and diffuse texture atlases. It has no skeleton or skin weights. Rig and convert with a supported M2TW modelling tool, create valid game LOD meshes, then add a ModelDB entry and duplicate the EDU unit. Original units and files were not changed. Projects reference source files; reselect the same mod folder when reopening.');
  const url = URL.createObjectURL(await zip.generateAsync({ type: 'blob' }));
  const link = document.createElement('a'); link.href = url; link.download = `${safe}_armory.zip`; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}