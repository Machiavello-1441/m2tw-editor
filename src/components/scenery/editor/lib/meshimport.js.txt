'use strict';
// Reads .obj and .fbx models (FBX 7.x, binary or ASCII) for the painter's imported fort models.
// Returns { parts: [{ pos, nrm, uv, idx, tex }], textures: Map(tex -> { name, bytes }) } in the model's own
// units, Y up, V flipped to the .cas way (v = 0 at the top of the picture). tex names a picture: a file name
// to find among the files imported with the model, or one the FBX carries inside it (bytes set).
(function () {
  const lower = (s) => String(s || '').toLowerCase();
  const baseName = (s) => String(s || '').replace(/\\/g, '/').split('/').pop();

  // triangles grouped by picture, cut into parts of at most 65535 vertices (16-bit indices)
  function collector() {
    const groups = new Map();
    return {
      tri(tex, p, n, t) { // p, n: 9 numbers; t: 6 numbers
        let g = groups.get(tex);
        if (!g) groups.set(tex, (g = { pos: [], nrm: [], uv: [] }));
        if (!n) {
          const ax = p[3] - p[0], ay = p[4] - p[1], az = p[5] - p[2], bx = p[6] - p[0], by = p[7] - p[1], bz = p[8] - p[2];
          let nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx;
          const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
          n = [nx, ny, nz, nx, ny, nz, nx, ny, nz];
        }
        g.pos.push(...p); g.nrm.push(...n); g.uv.push(...(t || [0, 0, 0, 0, 0, 0]));
      },
      parts() {
        const out = [];
        for (const [tex, g] of groups) {
          const nv = g.pos.length / 3, per = 65535 - 65535 % 3;
          for (let s = 0; s < nv; s += per) {
            const e = Math.min(nv, s + per), k = e - s;
            const idx = new Uint16Array(k);
            for (let i = 0; i < k; i++) idx[i] = i;
            out.push({ tex, pos: Float32Array.from(g.pos.slice(s * 3, e * 3)), nrm: Float32Array.from(g.nrm.slice(s * 3, e * 3)), uv: Float32Array.from(g.uv.slice(s * 2, e * 2)), idx });
          }
        }
        return out;
      },
    };
  }

  // ---------------------------------------------------------------- OBJ (+ MTL)
  function parseMTL(text) {
    const maps = new Map();
    let cur = null;
    for (const raw of text.split(/\r?\n/)) {
      const l = raw.trim();
      if (!l || l[0] === '#') continue;
      const sp = l.search(/\s/), key = lower(sp < 0 ? l : l.slice(0, sp)), rest = sp < 0 ? '' : l.slice(sp + 1).trim();
      if (key === 'newmtl') cur = rest;
      else if (cur != null && key === 'map_kd') {
        // options (-s 1 1 1, -o …) come first; the file name is what follows them
        const parts = rest.split(/\s+/);
        let i = 0;
        const argc = { '-blendu': 1, '-blendv': 1, '-bm': 1, '-boost': 1, '-cc': 1, '-clamp': 1, '-imfchan': 1, '-mm': 2, '-o': 3, '-s': 3, '-t': 3, '-texres': 1 };
        while (i < parts.length && parts[i][0] === '-' && argc[lower(parts[i])] != null) {
          const n = argc[lower(parts[i])]; i++;
          let k = 0; while (k < n && i < parts.length && /^[-+.\d]/.test(parts[i]) && !argc[lower(parts[i])]) { i++; k++; }
        }
        maps.set(cur, parts.slice(i).join(' '));
      }
    }
    return maps;
  }
  // files: Map(lower name -> bytes) of everything imported with the model (for the .mtl)
  function parseOBJ(text, files) {
    const V = [], T = [], N = [], col = collector();
    const mtl = new Map();
    let mat = '';
    const dec = new TextDecoder();
    const lines = text.split(/\r?\n/);
    for (let li = 0; li < lines.length; li++) {
      let l = lines[li];
      while (l.endsWith('\\') && li + 1 < lines.length) l = l.slice(0, -1) + ' ' + lines[++li];
      l = l.trim();
      if (!l || l[0] === '#') continue;
      const w = l.split(/\s+/), k = w[0];
      if (k === 'v') V.push(+w[1], +w[2], +w[3]);
      else if (k === 'vt') T.push(+w[1], +(w[2] || 0));
      else if (k === 'vn') N.push(+w[1], +w[2], +w[3]);
      else if (k === 'usemtl') mat = l.slice(6).trim();
      else if (k === 'mtllib') {
        const name = l.slice(6).trim();
        const bytes = files.get(lower(baseName(name)));
        if (bytes) for (const [m, f] of parseMTL(dec.decode(bytes))) mtl.set(m, f);
      } else if (k === 'f') {
        const at = (s, n, len) => { const i = parseInt(s, 10); return isNaN(i) ? -1 : i < 0 ? len / n + i : i - 1; };
        const vs = w.slice(1).map((s) => { const [a, b, c] = s.split('/'); return [at(a, 3, V.length), b ? at(b, 2, T.length) : -1, c ? at(c, 3, N.length) : -1]; });
        const tex = mtl.has(mat) ? mtl.get(mat) : '';
        for (let i = 1; i + 1 < vs.length; i++) {
          const tri = [vs[0], vs[i], vs[i + 1]];
          const p = [], n = [], t = [];
          let hasN = true;
          for (const [a, b, c] of tri) {
            p.push(V[a * 3], V[a * 3 + 1], V[a * 3 + 2]);
            if (b >= 0) t.push(T[b * 2], 1 - T[b * 2 + 1]); else t.push(0, 0);
            if (c >= 0) n.push(N[c * 3], N[c * 3 + 1], N[c * 3 + 2]); else hasN = false;
          }
          if (p.some((x) => !Number.isFinite(x))) continue;
          col.tri(tex, p, hasN ? n : null, t);
        }
      }
    }
    const parts = col.parts();
    if (!parts.length) throw new Error('the .obj has no faces');
    const textures = new Map();
    for (const pt of parts) if (pt.tex) textures.set(pt.tex, { name: pt.tex, bytes: null });
    return { parts, textures, upAxis: 1 };
  }

  // ---------------------------------------------------------------- FBX: the node tree
  async function inflate(u8) {
    const ds = new DecompressionStream('deflate');
    const out = await new Response(new Blob([u8]).stream().pipeThrough(ds)).arrayBuffer();
    return new Uint8Array(out);
  }
  async function fbxBinary(bytes) {
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const ver = dv.getUint32(23, true), big = ver >= 7500;
    if (ver < 7000) throw new Error(`FBX version ${ver} is too old; export as FBX 7.x`);
    const latin = (o, n) => { let s = ''; for (let i = 0; i < n; i++) s += String.fromCharCode(bytes[o + i]); return s; };
    let p = 27;
    const typed = (type, buf) => {
      const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
      if (type === 'd') return new Float64Array(ab);
      if (type === 'f') return new Float32Array(ab);
      if (type === 'i') return new Int32Array(ab);
      if (type === 'l') return Float64Array.from(new BigInt64Array(ab), Number);
      return new Uint8Array(ab);
    };
    const readNode = async () => {
      const end = big ? Number(dv.getBigUint64(p, true)) : dv.getUint32(p, true);
      const np = big ? Number(dv.getBigUint64(p + 8, true)) : dv.getUint32(p + 4, true);
      p += big ? 24 : 12;
      const nl = bytes[p++];
      if (!end) return null;
      const node = { name: latin(p, nl), props: [], children: [] };
      p += nl;
      for (let i = 0; i < np; i++) {
        const t = String.fromCharCode(bytes[p++]);
        switch (t) {
          case 'Y': node.props.push(dv.getInt16(p, true)); p += 2; break;
          case 'C': node.props.push(bytes[p]); p += 1; break;
          case 'I': node.props.push(dv.getInt32(p, true)); p += 4; break;
          case 'F': node.props.push(dv.getFloat32(p, true)); p += 4; break;
          case 'D': node.props.push(dv.getFloat64(p, true)); p += 8; break;
          case 'L': node.props.push(dv.getBigInt64(p, true)); p += 8; break; // ids: kept exact
          case 'S': case 'R': {
            const n = dv.getUint32(p, true); p += 4;
            node.props.push(t === 'S' ? latin(p, n) : bytes.slice(p, p + n)); p += n; break;
          }
          case 'f': case 'd': case 'l': case 'i': case 'b': {
            const n = dv.getUint32(p, true), enc = dv.getUint32(p + 4, true), clen = dv.getUint32(p + 8, true);
            p += 12;
            let raw = bytes.subarray(p, p + clen);
            p += clen;
            if (enc === 1) raw = await inflate(raw);
            const a = typed(t, raw);
            node.props.push(a.length > n ? a.subarray(0, n) : a);
            break;
          }
          default: throw new Error(`unknown FBX property type ${t}`);
        }
      }
      while (p < end) { const c = await readNode(); if (!c) break; node.children.push(c); }
      p = end;
      return node;
    };
    const top = [];
    while (p + 13 <= bytes.length) { const n = await readNode(); if (!n) break; top.push(n); }
    return top;
  }
  function fbxAscii(text) {
    let i = 0;
    const n = text.length;
    const skip = () => {
      for (;;) {
        while (i < n && /\s/.test(text[i])) i++;
        if (text[i] === ';') { while (i < n && text[i] !== '\n') i++; continue; }
        break;
      }
    };
    // a token: key (name followed by ':'), '{', '}', ',', string, number, *count, or a bare word
    const token = () => {
      skip();
      if (i >= n) return null;
      const c = text[i];
      if (c === '{' || c === '}' || c === ',') { i++; return { t: c }; }
      if (c === '"') { let e = i + 1; while (e < n && text[e] !== '"') e++; const s = text.slice(i + 1, e); i = e + 1; return { t: 'v', v: s }; }
      if (c === '*') { let e = i + 1; while (e < n && /\d/.test(text[e])) e++; const v = +text.slice(i + 1, e); i = e; return { t: 'count', v }; }
      let e = i;
      while (e < n && !/[\s,{}:;"]/.test(text[e])) e++;
      const w = text.slice(i, e);
      i = e;
      if (text[i] === ':') { i++; return { t: 'key', v: w }; }
      const num = Number(w);
      return { t: 'v', v: w !== '' && !isNaN(num) ? num : w };
    };
    let peeked = null;
    const next = () => { const t = peeked || token(); peeked = null; return t; };
    const peek = () => (peeked = peeked || token());
    const nodeList = (closing) => {
      const out = [];
      for (;;) {
        const t = peek();
        if (!t) break;
        if (t.t === '}') { if (closing) next(); break; }
        if (t.t !== 'key') { next(); continue; }
        next();
        const node = { name: t.v, props: [], children: [] };
        for (;;) {
          const v = peek();
          if (!v || v.t === 'key' || v.t === '}') break;
          next();
          if (v.t === '{') { node.children = nodeList(true); break; }
          if (v.t === 'v') node.props.push(v.v);
          else if (v.t === 'count') node.props.push(v);
        }
        // an array: "Vertices: *n { a: 1,2,3 }"
        if (node.props.length === 1 && node.props[0] && node.props[0].t === 'count') {
          const a = node.children.find((c) => c.name === 'a');
          node.props = [Float64Array.from(a ? a.props.map(Number) : [])];
          node.children = [];
        }
        out.push(node);
      }
      return out;
    };
    return nodeList(false);
  }

  // ---------------------------------------------------------------- FBX: the scene
  const kid = (n, name) => n && n.children.find((c) => c.name === name);
  function props70(n) {
    const out = new Map();
    const p = kid(n, 'Properties70') || kid(n, 'Properties60');
    if (p) for (const c of p.children) if (c.name === 'P' || c.name === 'Property') out.set(c.props[0], c.props.slice(c.name === 'P' ? 4 : 3));
    return out;
  }
  const mul = (a, b) => { const o = new Array(16).fill(0); for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k]; return o; };
  const ident = () => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  const trans = (x, y, z) => { const m = ident(); m[12] = x; m[13] = y; m[14] = z; return m; };
  const scale = (x, y, z) => { const m = ident(); m[0] = x; m[5] = y; m[10] = z; return m; };
  const rot = (deg) => {
    // FBX's default order (XYZ): x first, then y, then z
    const [x, y, z] = deg.map((d) => d * Math.PI / 180);
    const rx = [1, 0, 0, 0, 0, Math.cos(x), Math.sin(x), 0, 0, -Math.sin(x), Math.cos(x), 0, 0, 0, 0, 1];
    const ry = [Math.cos(y), 0, -Math.sin(y), 0, 0, 1, 0, 0, Math.sin(y), 0, Math.cos(y), 0, 0, 0, 0, 1];
    const rz = [Math.cos(z), Math.sin(z), 0, 0, -Math.sin(z), Math.cos(z), 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
    return mul(rz, mul(ry, rx));
  };
  const objName = (s) => { s = String(s || ''); const z = s.indexOf('\x00\x01'); if (z >= 0) return s.slice(0, z); const c = s.indexOf('::'); return c >= 0 ? s.slice(c + 2) : s; };

  function fbxScene(top) {
    const objects = top.find((n) => n.name === 'Objects'), conns = top.find((n) => n.name === 'Connections');
    if (!objects) throw new Error('the FBX has no Objects section');
    const gs = props70(top.find((n) => n.name === 'GlobalSettings'));
    const upAxis = gs.has('UpAxis') ? +gs.get('UpAxis')[0] : 1;
    const byId = new Map();
    for (const o of objects.children) byId.set(String(o.props[0]), o);
    const parentsOf = new Map(), childrenOf = new Map();
    for (const c of (conns ? conns.children : [])) {
      if (c.name !== 'C' && c.name !== 'Connect') continue;
      const [kind, c0, p0, prop] = c.props, child = String(c0), parent = String(p0);
      if (!parentsOf.has(child)) parentsOf.set(child, []);
      parentsOf.get(child).push({ id: parent, kind, prop });
      if (!childrenOf.has(parent)) childrenOf.set(parent, []);
      childrenOf.get(parent).push({ id: child, kind, prop });
    }
    const local = (m) => {
      const P = props70(m), v = (k, d) => (P.has(k) ? P.get(k).slice(0, 3).map(Number) : d);
      const T = v('Lcl Translation', [0, 0, 0]), R = v('Lcl Rotation', [0, 0, 0]), S = v('Lcl Scaling', [1, 1, 1]), pre = v('PreRotation', [0, 0, 0]);
      return mul(trans(...T), mul(rot(pre), mul(rot(R), scale(...S))));
    };
    const world = (id, depth = 0) => {
      const m = byId.get(id);
      if (!m || m.name !== 'Model' || depth > 64) return ident();
      const par = (parentsOf.get(id) || []).find((x) => byId.get(x.id) && byId.get(x.id).name === 'Model');
      return mul(par ? world(par.id, depth + 1) : ident(), local(m));
    };
    // a material's picture: the texture plugged into its diffuse colour (or any), then that texture's file
    const textures = new Map();
    const texOf = (matId) => {
      const ts = (childrenOf.get(matId) || []).filter((x) => byId.get(x.id) && byId.get(x.id).name === 'Texture');
      const t = ts.find((x) => /diffuse/i.test(x.prop || '')) || ts[0];
      if (!t) return '';
      const tn = byId.get(t.id);
      const file = (kid(tn, 'RelativeFilename') || kid(tn, 'FileName') || { props: [''] }).props[0];
      const key = baseName(file) || objName(tn.props[1]);
      if (!textures.has(key)) {
        // a picture carried inside the FBX (Video node with Content)
        let bytes = null;
        for (const v of (childrenOf.get(t.id) || [])) {
          const vn = byId.get(v.id);
          const content = vn && vn.name === 'Video' && kid(vn, 'Content');
          if (content && content.props[0] instanceof Uint8Array && content.props[0].length) bytes = content.props[0];
        }
        textures.set(key, { name: key, bytes });
      }
      return key;
    };
    const col = collector();
    for (const g of objects.children) {
      if (g.name !== 'Geometry') continue;
      const verts = kid(g, 'Vertices'), pvi = kid(g, 'PolygonVertexIndex');
      if (!verts || !pvi) continue;
      const V = verts.props[0], I = pvi.props[0];
      const modelId = ((parentsOf.get(String(g.props[0])) || []).find((x) => byId.get(x.id) && byId.get(x.id).name === 'Model') || {}).id;
      const M = modelId != null ? world(modelId) : ident();
      const mats = modelId != null ? (childrenOf.get(modelId) || []).filter((x) => byId.get(x.id) && byId.get(x.id).name === 'Material').map((x) => texOf(x.id)) : [];
      // a layer element's value for polygon-vertex k (corner of vertex v, in polygon f)
      const layer = (name, dataName, idxName, size) => {
        const le = kid(g, name);
        if (!le) return null;
        const data = kid(le, dataName), ix = kid(le, idxName);
        const map = String((kid(le, 'MappingInformationType') || { props: [''] }).props[0]);
        const ref = String((kid(le, 'ReferenceInformationType') || { props: [''] }).props[0]);
        if (!data) return null;
        const D = data.props[0], X = ix ? ix.props[0] : null, indexed = /index/i.test(ref) && X;
        return (k, v, f) => {
          let j = /ByPolygonVertex/i.test(map) ? k : /ByVert/i.test(map) ? v : /ByPolygon$/i.test(map) ? f : 0;
          if (indexed) j = X[j];
          return Array.from(D.subarray ? D.subarray(j * size, j * size + size) : D.slice(j * size, j * size + size));
        };
      };
      const nrm = layer('LayerElementNormal', 'Normals', 'NormalsIndex', 3);
      const uv = layer('LayerElementUV', 'UV', 'UVIndex', 2);
      const lm = kid(g, 'LayerElementMaterial');
      const mIdx = lm && kid(lm, 'Materials') ? kid(lm, 'Materials').props[0] : null;
      const mAll = lm && /AllSame/i.test(String((kid(lm, 'MappingInformationType') || { props: [''] }).props[0]));
      const xf = (x, y, z) => [M[0] * x + M[4] * y + M[8] * z + M[12], M[1] * x + M[5] * y + M[9] * z + M[13], M[2] * x + M[6] * y + M[10] * z + M[14]];
      const xn = (x, y, z) => { const r = [M[0] * x + M[4] * y + M[8] * z, M[1] * x + M[5] * y + M[9] * z, M[2] * x + M[6] * y + M[10] * z]; const l = Math.hypot(...r) || 1; return r.map((c) => c / l); };
      let poly = [], f = 0;
      for (let k = 0; k < I.length; k++) {
        let v = I[k];
        const last = v < 0;
        if (last) v = ~v;
        poly.push({ k, v });
        if (!last) continue;
        const mi = mIdx ? (mAll ? mIdx[0] : mIdx[f]) : 0;
        const tex = mats[mi] || mats[0] || '';
        for (let i = 1; i + 1 < poly.length; i++) {
          const tri = [poly[0], poly[i], poly[i + 1]];
          const P = [], Nn = [], Tt = [];
          for (const c of tri) {
            P.push(...xf(V[c.v * 3], V[c.v * 3 + 1], V[c.v * 3 + 2]));
            if (nrm) Nn.push(...xn(...nrm(c.k, c.v, f)));
            if (uv) { const t = uv(c.k, c.v, f); Tt.push(t[0], 1 - t[1]); } else Tt.push(0, 0);
          }
          col.tri(tex, P, nrm ? Nn : null, Tt);
        }
        poly = []; f++;
      }
    }
    const parts = col.parts();
    if (!parts.length) throw new Error('the FBX has no meshes');
    return { parts, textures, upAxis };
  }

  // name: the model's file name; bytes: its contents; files: Map(lower name -> bytes) of the files imported with it
  async function parse(name, bytes, files = new Map()) {
    const ext = lower(name).split('.').pop();
    let m;
    if (ext === 'obj') m = parseOBJ(new TextDecoder().decode(bytes), files);
    else if (ext === 'fbx') {
      const head = String.fromCharCode(...bytes.subarray(0, 18));
      m = fbxScene(head === 'Kaydara FBX Binary' ? await fbxBinary(bytes) : fbxAscii(new TextDecoder().decode(bytes)));
    } else throw new Error('pick an .obj or .fbx file');
    // Z up -> Y up
    if (m.upAxis === 2) for (const pt of m.parts) for (const a of [pt.pos, pt.nrm]) for (let i = 0; i < a.length; i += 3) { const y = a[i + 1]; a[i + 1] = a[i + 2]; a[i + 2] = -y; }
    return m;
  }

  window.MeshImport = { parse, parseOBJ, parseMTL };
})();
