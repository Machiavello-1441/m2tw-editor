'use strict';
// WebGL2 map renderer. The 2D view draws one full-screen quad; the 3D view draws the height map as a
// mesh with a water plane at sea level. Both shade with the same function: it looks up the ground type
// and climate at each map vertex, picks the texture the game would use, blends neighbours and lights it.
(function () {
  const LAYER_SIZE = 512;
  const WATER = 255;
  const MISSING = 254;
  const BG = [0.082, 0.09, 0.106];
  const SEA_FLOOR = 0.15; // the 3D view draws depths below sea level this much shallower, so coasts don't look like cliffs

  const HEAD = `#version 300 es
  precision highp float; precision highp int;
  precision highp sampler2D; precision highp usampler2D; precision highp sampler2DArray;
  `;

  const COMMON = `
  uniform usampler2D uGT, uCL, uLUT;
  uniform sampler2D uH, uRegion, uFeat, uGTCol, uCLCol;
  uniform sampler2DArray uArr;
  uniform int uGAdjOn;       // map colour (brightness, saturation, hue) on the ground textures
  uniform mat3 uGAdj;        // ... as one matrix on linear colour, the same one saving writes into the files
  uniform vec2 uGAdjC;       // then contrast: x = amount, y = pivot, per channel on the sRGB value
  vec3 gContrast(vec3 c, float k, float p){
    if (k == 1.) return c;
    vec3 e = mix(c * 12.92, 1.055 * pow(c, vec3(1. / 2.4)) - 0.055, step(0.0031308, c));
    e = clamp(p + (e - p) * k, 0., 1.);
    return mix(e / 12.92, pow((e + 0.055) / 1.055, vec3(2.4)), step(0.04045, e));
  }
  // (a texture's own change is already in its layer: app.js writes those pixels the way Save will)
  vec3 gAdj(vec3 c){ return gContrast(clamp(uGAdj * c, 0., 1.), uGAdjC.x, uGAdjC.y); }
  uniform int uSAdjOn;       // Sea colour, for the flat view's own water colour (the game look recolours water_surface.tga)
  uniform mat3 uSAdj;
  uniform vec2 uSAdjC;
  uniform ivec2 uMap;        // vertex grid size
  uniform float uTexScale;   // map vertices per texture repeat
  uniform float uRelief;
  uniform vec3 uLight;
  uniform vec3 uAmbient, uDiffuse;
  uniform float uExposure;
  uniform int uMode;         // 0 textured, 1 ground types, 2 climates, 3 heights, 4 regions, 5 matcap, 6 colour grid, 7 map_features
  uniform sampler2D uMC, uCG; // matcap material; colour grid picture
  uniform vec3 uVR, uVU;     // the view's right and up directions in the 3D frame (x east, y up, z south)
  uniform float uMZ;         // 3D height per metre, for true normals
  uniform int uCav;          // cavity shading on
  uniform float uCavS;       // cavity strength
  uniform float uCGRep;      // map vertices per colour grid repeat
  uniform int uMask;         // cavity paint mask shown: 1 ridges only, 2 hollows only
  uniform float uMaskThr;    // where the mask cuts, -1 (dark hollows) .. 1 (bright ridges)
  uniform vec2 uMaskH;       // height range mask (uMask 3): lowest and highest height painted, in metres
  uniform float uMaskSoft;   // ... and how many metres beyond them it fades out (0: a hard edge)
  uniform int uBorders, uRivers, uGrid, uClimateTint, uHeightBlend, uSettlements, uSea, uIs3D;
  uniform float uHMin, uHMax;
  uniform int uHilite;       // layer to highlight, -1 none
  uniform float uTime;
  // guide images laid over the map: centre x, y and size in map vertices; cos, sin of the turn; opacity (0 = off)
  uniform sampler2D uOv0, uOv1, uOv2, uOv3;
  uniform vec4 uOvT[4];
  uniform vec2 uOvR[4];
  uniform float uOvA[4];

  float H(ivec2 c){ c = clamp(c, ivec2(0), uMap-1); return texelFetch(uH, c, 0).r; }
  float Hb(vec2 m){ vec2 f = fract(m); ivec2 i = ivec2(floor(m));
    return mix(mix(H(i),H(i+ivec2(1,0)),f.x), mix(H(i+ivec2(0,1)),H(i+ivec2(1,1)),f.x), f.y); }
  uint layerAt(ivec2 c){ c = clamp(c, ivec2(0), uMap-1);
    uint g = texelFetch(uGT, c, 0).r; uint k = texelFetch(uCL, c, 0).r;
    return texelFetch(uLUT, ivec2(int(g), int(k)), 0).r; }
  vec3 lin2srgb(vec3 c){ return pow(max(c,0.), vec3(1./2.2)); }
  vec4 rgbaRegion(ivec2 t){ ivec2 s = ivec2(textureSize(uRegion,0)); t = clamp(t, ivec2(0), s-1); return texelFetch(uRegion, t, 0); }
  vec3 waterColour(float h, float lam){
    float depth = clamp(-h / 600., 0., 1.);
    vec3 c = mix(vec3(0.16,0.42,0.47), vec3(0.03,0.11,0.22), sqrt(depth));
    return c * (0.92 + 0.08*lam);
  }
  vec4 guideOver(vec4 acc, sampler2D s, int k, vec2 m, float px){
    if (uOvA[k] <= 0.) return acc;
    vec2 d = m - uOvT[k].xy;
    vec2 uv = vec2(uOvR[k].x*d.x + uOvR[k].y*d.y, -uOvR[k].y*d.x + uOvR[k].x*d.y) / uOvT[k].zw + 0.5;
    if (uv.x < 0. || uv.y < 0. || uv.x > 1. || uv.y > 1.) return acc;
    vec2 ts = vec2(textureSize(s, 0));
    float lod = log2(max(px * max(ts.x / uOvT[k].z, ts.y / uOvT[k].w), 1e-6));
    vec4 g = textureLod(s, uv, lod);
    float a = g.a * uOvA[k];
    return vec4(g.rgb * a + acc.rgb * (1. - a), a + acc.a * (1. - a));
  }
  // all guides composited bottom to top, premultiplied
  vec4 guides(vec2 m, float px){
    vec4 acc = vec4(0.);
    acc = guideOver(acc, uOv0, 0, m, px);
    acc = guideOver(acc, uOv1, 1, m, px);
    acc = guideOver(acc, uOv2, 2, m, px);
    acc = guideOver(acc, uOv3, 3, m, px);
    return acc;
  }

  // cavity: darkens hollows and creases, lightens ridges and edges, from the height curvature over
  // 1, 2, 4 and 8 map vertices (true 3D heights, so it follows the exaggeration)
  // t > 0 in hollows, < 0 on ridges, -1..1 (app.js cavityAt works it out the same way for the mask)
  float cavityT(vec2 m){
    float h = Hb(m), c = 0.;
    for (int k = 0; k < 4; k++) {
      float r = float(1 << k);
      float a = 0.25 * (Hb(m + vec2(r, 0.)) + Hb(m - vec2(r, 0.)) + Hb(m + vec2(0., r)) + Hb(m - vec2(0., r)));
      c += (a - h) * uMZ / r * (k == 0 ? 1. : 0.6);
    }
    return tanh(2.5 * uCavS * c);
  }
  float cavity(vec2 m){
    float t = cavityT(m);
    return 1. - (t > 0. ? 0.6 : 0.35) * t;
  }

  // m: map vertex coords (y down). px: one screen pixel in map units. hpx: height change per screen
  // pixel, or 0 to work it out from the slope (2D).
  vec3 overlays(vec3 col, vec2 m, float px, float hpx, float h, float hx, float hy);
  vec3 shade(vec2 m, float px, float hpx){
    ivec2 i0 = ivec2(floor(m)); vec2 f = fract(m);
    ivec2 cs[4] = ivec2[4](i0, i0+ivec2(1,0), i0+ivec2(0,1), i0+ivec2(1,1));
    float w[4] = float[4]((1.-f.x)*(1.-f.y), f.x*(1.-f.y), (1.-f.x)*f.y, f.x*f.y);
    ivec2 nc = clamp(ivec2(floor(m + 0.5)), ivec2(0), uMap-1);

    float h = Hb(m);
    float hx = Hb(m+vec2(1,0)) - Hb(m-vec2(1,0));
    float hy = Hb(m+vec2(0,1)) - Hb(m-vec2(0,1));
    vec3 n = normalize(vec3(-hx*uRelief, hy*uRelief, 1.0));
    float lam = max(dot(n, uLight), 0.);
    vec3 light = uAmbient + uDiffuse * lam;

    vec3 col;
    if (uMode == 1) {
      col = texelFetch(uGTCol, ivec2(int(texelFetch(uGT, nc, 0).r), 0), 0).rgb;
    } else if (uMode == 2) {
      col = texelFetch(uCLCol, ivec2(int(texelFetch(uCL, nc, 0).r), 0), 0).rgb;
    } else if (uMode == 3) {
      float t = h > 0. ? 0.35 + 0.65*clamp(h/max(uHMax,1.),0.,1.) : 0.3*(1.-clamp(h/min(uHMin,-1.),0.,1.));
      col = h > 0. ? vec3(t) : vec3(0.05,0.1,0.25+t);
      if (uIs3D == 1) col *= 0.7 + 0.45*lam;
    } else if (uMode == 4) {
      col = rgbaRegion(ivec2(floor(m/2.))).rgb;
    } else if (uMode == 5) {
      // matcap: the surface normal as the camera sees it picks a spot on the material ball
      vec3 nw = normalize(vec3(-hx * 0.5 * uMZ, 1., -hy * 0.5 * uMZ));
      vec2 q = vec2(dot(nw, uVR), dot(nw, uVU));
      q /= max(1., length(q));
      col = texture(uMC, vec2(0.5 + 0.49 * q.x, 0.5 - 0.49 * q.y)).rgb;
    } else if (uMode == 6) {
      col = texture(uCG, m / uCGRep).rgb;
    } else if (uMode == 7) {
      // map_features.tga on its own: plain shaded land and dark sea underneath, every tile the file marks in
      // a strong colour (river blue, crossing cyan, source white, anything else in the file's own colour)
      bool sea = layerAt(nc) == ${WATER}u;
      col = sea ? vec3(0.03, 0.05, 0.09) : vec3(0.2) * (0.55 + 0.6 * lam);
      ivec2 ft = clamp(ivec2(floor(m / 2.)), ivec2(0), ivec2(textureSize(uFeat, 0)) - 1);
      vec3 fe = texelFetch(uFeat, ft, 0).rgb;
      if (fe.r + fe.g + fe.b > 0.05) {
        vec3 fc = fe;
        if (fe.b > 0.9 && fe.r < 0.1 && fe.g < 0.1) fc = vec3(0.16, 0.48, 1.0);       // river
        else if (fe.b > 0.9 && fe.g > 0.9 && fe.r < 0.1) fc = vec3(0.0, 1.0, 0.95);   // crossing (ford)
        // a thin dark edge round each marked tile once tiles are big enough to see
        vec2 q = abs(fract(m / 2.) - 0.5) * 2.;
        float edge = px < 0.25 ? smoothstep(1. - 2.5 * px, 1. - 1.2 * px, max(q.x, q.y)) : 0.;
        col = mix(fc, vec3(0.), 0.55 * edge);
      }
    } else {
      vec2 uv = m / uTexScale;
      vec3 land = vec3(0.); float ww = 0.;
      vec4 s[4]; float bw[4]; bool isW[4];
      float best = -1.;
      for (int k=0;k<4;k++){
        uint L = layerAt(cs[k]);
        isW[k] = (L == ${WATER}u);
        if (isW[k]) { ww += w[k]; s[k] = vec4(0.); bw[k] = 0.; continue; }
        if (L == ${MISSING}u) { vec2 cb = floor(uv*8.); s[k] = vec4(mod(cb.x+cb.y,2.)>0.5 ? vec3(1.,0.,1.) : vec3(0.2,0.,0.2), 1.); }
        else { s[k] = texture(uArr, vec3(uv, float(L))); if (uGAdjOn == 1) s[k].rgb = gAdj(s[k].rgb); }
        if (int(L) == uHilite) s[k].rgb = mix(s[k].rgb, vec3(1.,0.85,0.2), 0.35 + 0.15*sin(uTime*4.));
        float hb = uHeightBlend == 1 ? s[k].a * 0.6 : 0.;
        bw[k] = w[k] + hb;
        best = max(best, bw[k]);
      }
      float tot = 0.;
      for (int k=0;k<4;k++){
        if (isW[k]) continue;
        float b = uHeightBlend == 1 ? max(bw[k] - best + 0.25, 0.) : w[k];
        land += s[k].rgb * b; tot += b;
      }
      land = tot > 0. ? land / tot : vec3(0.);
      vec3 landLit = lin2srgb(land * light * uExposure);
      vec3 water;
      if (uIs3D == 1) {
        // sea bed; the water plane drawn on top gives it its colour
        float d = clamp(-h / 900., 0., 1.);
        water = lin2srgb(mix(vec3(0.32,0.30,0.22), vec3(0.05,0.07,0.08), sqrt(d)) * light * uExposure);
      } else {
        water = waterColour(h, lam);
        if (uSAdjOn == 1) water = pow(gContrast(clamp(uSAdj * pow(max(water, 0.), vec3(2.2)), 0., 1.), uSAdjC.x, uSAdjC.y), vec3(1. / 2.2));
      }
      float wf = smoothstep(0.35, 0.65, ww);
      col = mix(landLit, water, wf);
      if (uIs3D == 0) { float foam = (1. - abs(ww - 0.5)*2.); col = mix(col, vec3(0.75,0.8,0.78), 0.18*foam*foam*step(0.01,ww)*step(ww,0.99)); }
      if (uClimateTint == 1) col = mix(col, texelFetch(uCLCol, ivec2(int(texelFetch(uCL, nc, 0).r), 0), 0).rgb, 0.35);
    }
    if (uMode != 0 && uMode != 3 && uMode != 5 && uMode != 7) col *= 0.75 + 0.35*lam;
    if (uCav == 1) col *= cavity(m);
    return overlays(col, m, px, hpx, h, hx, hy);
  }

  // guides, sea level, rivers, borders, settlements and the tile grid, drawn over the ground colour
  vec3 overlays(vec3 col, vec2 m, float px, float hpx, float h, float hx, float hy){
    ivec2 nc = clamp(ivec2(floor(m + 0.5)), ivec2(0), uMap-1);
    if (uMask > 0) {
      // the cavity mask: ground the brush leaves alone is tinted
      float keep;
      if (uMask == 3) {
        if (uMaskSoft > 0.) {
          // softened: the tint fades in smoothly with the height between the vertices
          float d = max(uMaskH.x - h, h - uMaskH.y);
          keep = 1. - clamp(d / uMaskSoft, 0., 1.);
        } else { float hv = H(nc); keep = hv >= uMaskH.x && hv <= uMaskH.y ? 1. : 0.; }
      } else { float sh = -cavityT(m); keep = (uMask == 1 ? sh > uMaskThr : sh < uMaskThr) ? 1. : 0.; }
      col = mix(col, vec3(0.75, 0.1, 0.55), 0.45 * (1. - keep));
    }
    vec4 gd = guides(m, px);
    col = gd.rgb + col * (1. - gd.a);

    // sea level: blue below it, a white line along it, stripes where the ground type disagrees with the height
    if (uSea == 1 && uMode != 3) {
      if (h <= 0.) col = mix(col, vec3(0.12,0.38,1.0), 0.42);
      float hp = hpx > 0. ? hpx : length(vec2(hx, hy)) * 0.5 * px;
      float dpx = abs(h) / max(hp, 1e-4);
      col = mix(col, vec3(1.), 0.9 * (1. - smoothstep(0.7, 1.7, dpx)));
      bool wType = layerAt(nc) == ${WATER}u;
      float hv = H(nc);
      if ((wType && hv > 0.) || (!wType && hv <= 0.)) {
        vec2 sp = m / px;
        float st = step(0.5, fract((sp.x + sp.y) / 10.));
        col = mix(col, wType ? vec3(1.,0.6,0.1) : vec3(1.,0.12,0.12), 0.35 + 0.4*st);
      }
    }

    if (uRivers == 1 && uMode != 7) {
      ivec2 t = ivec2(floor(m/2.));
      vec4 fe = texelFetch(uFeat, clamp(t, ivec2(0), ivec2(textureSize(uFeat,0))-1), 0);
      if (fe.b > 0.9 && fe.r < 0.1 && fe.g < 0.1) col = mix(col, vec3(0.2,0.45,0.85), 0.75);
      else if (fe.b > 0.9 && fe.g > 0.9 && fe.r < 0.1) col = mix(col, vec3(0.45,0.85,0.9), 0.75);   // ford
      else if (fe.b > 0.9 && fe.g > 0.9 && fe.r > 0.9) col = mix(col, vec3(0.95,0.97,1.0), 0.8);   // source
      else if (fe.g > 0.9 && fe.r < 0.1 && fe.b < 0.1) col = mix(col, vec3(0.25,0.95,0.35), 0.75);   // land bridge
    }
    if (uBorders == 1) {
      ivec2 t = ivec2(floor(m/2.));
      vec4 c0 = rgbaRegion(t);
      float d = 1.2*px;
      bool edge = false;
      for (int k=0;k<4;k++){
        vec2 off = k==0? vec2(d,0.) : k==1? vec2(-d,0.) : k==2? vec2(0.,d) : vec2(0.,-d);
        vec4 c1 = rgbaRegion(ivec2(floor((m+off)/2.)));
        if (distance(c0.rgb, c1.rgb) > 0.01 && !(c1.r+c1.g+c1.b < 0.01) && !(c0.r+c0.g+c0.b < 0.01)) edge = true;
      }
      if (edge) col = mix(col, vec3(0.95,0.85,0.35), 0.85);
    }
    if (uSettlements == 1) {
      ivec2 t = ivec2(floor(m/2.));
      vec4 c0 = rgbaRegion(t);
      if (c0.r+c0.g+c0.b < 0.01) { vec2 q = fract(m/2.) - 0.5; float r = length(q);
        col = mix(col, r < 0.32 ? vec3(0.1) : vec3(1.), step(r, 0.5)); }
    }
    if (uGrid == 1 && px < 1./6.) {
      vec2 gg = abs(fract(m/2. + 0.5) - 0.5) * 2.;  // tile grid
      float e = min(gg.x, gg.y) / (2.*px);
      col = mix(col, vec3(0.), 0.14 * (1. - smoothstep(0.5, 1.5, e)));
    }
    return col;
  }
  `;

  const VS2D = `#version 300 es
  in vec2 p; void main(){ gl_Position = vec4(p,0.,1.); }`;

  const FS2D = HEAD + COMMON + `
  uniform vec2 uCanvas;      // canvas size in device px
  uniform vec3 uView;        // offset.xy (device px), scale (device px per map vertex)
  out vec4 o;
  void main(){
    vec2 sp = vec2(gl_FragCoord.x, uCanvas.y - gl_FragCoord.y);
    vec2 m = (sp - uView.xy) / uView.z;
    if (m.x < 0. || m.y < 0. || m.x > float(uMap.x-1) || m.y > float(uMap.y-1)) { o = vec4(${BG.join(',')},1.); return; }
    o = vec4(shade(m, 1.0 / uView.z, 0.), 1.);
  }`;

  // terrain mesh: vertex positions come from the height texture, so painting updates it for free
  const VS3D = HEAD + `
  uniform sampler2D uH;
  uniform ivec2 uMap, uMesh;
  uniform int uStride;
  uniform float uZS;
  uniform mat4 uMVP;
  uniform int uGameMesh;
  out vec2 vM;
  out float vZ;
  void main(){
    int id = gl_VertexID;
    ivec2 c = min(ivec2(id % uMesh.x, id / uMesh.x) * uStride, uMap - 1);
    float h = texelFetch(uH, c, 0).r;
    vZ = h;
    float y = h * uZS;
    // the game draws the sea bed at its real depth; the simple look flattens it
    if (uGameMesh == 0 && h < 0.) y *= ${SEA_FLOOR};
    vM = vec2(c);
    gl_Position = uMVP * vec4(float(c.x), y, float(c.y), 1.0);
  }`;

  const FS3D = HEAD + COMMON + `
  in vec2 vM;
  out vec4 o;
  void main(){
    vec2 fw = fwidth(vM);
    float hpx = max(fwidth(Hb(vM)), 1e-3);
    o = vec4(shade(vM, max(max(fw.x, fw.y), 1e-4), hpx), 1.);
  }`;

  const VSW = HEAD + `
  uniform ivec2 uMap;
  uniform mat4 uMVP;
  out vec2 vM;
  void main(){
    vec2 q = vec2(float(gl_VertexID & 1), float(gl_VertexID >> 1));
    vec2 m = q * vec2(uMap - 1);
    vM = m;
    gl_Position = uMVP * vec4(m.x, 0., m.y, 1.);
  }`;

  const FSW = HEAD + COMMON + `
  in vec2 vM;
  out vec4 o;
  void main(){
    vec2 fw = fwidth(vM);
    float h = Hb(vM);
    if (h > 0.) discard;
    float depth = clamp(-h / 600., 0., 1.);
    vec3 c = waterColour(h, 1.);
    float a = mix(0.5, 0.9, sqrt(depth));
    if (uSea == 1) { c = mix(c, vec3(0.12,0.38,1.0), 0.35); a = min(a, 0.6); }
    // guides sit on top of the water as well as the sea bed under it
    vec4 gd = guides(vM, max(max(fw.x, fw.y), 1e-4));
    c = gd.rgb + c * (1. - gd.a);
    o = vec4(c, a);
  }`;

  // ---------------------------------------------------------------- fog mask
  // A black and white picture stretched over the whole map: black is fog, white is clear. The fog is drawn
  // over everything, as soft cloudy banks: noise breaks up its edges and shades it a little inside.
  const FOGM = `
  uniform sampler2D uFM;     // fog amount, 1 = fog (the picture inverted, edges softened)
  uniform vec4 uFMc;         // fog colour, density
  uniform ivec2 uMap;
  float fmHash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
  float fmNoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
    return mix(mix(fmHash(i), fmHash(i + vec2(1., 0.)), f.x), mix(fmHash(i + vec2(0., 1.)), fmHash(i + vec2(1., 1.)), f.x), f.y); }
  float fmFbm(vec2 p){ float s = 0., a = 0.5; for (int i = 0; i < 5; i++) { s += a * fmNoise(p); p = p * 2.03 + vec2(17.1, 9.7); a *= 0.5; } return s; }
  vec4 fogMaskAt(vec2 m){
    float f = texture(uFM, m / vec2(uMap - 1)).r;
    if (f <= 0.002) return vec4(0.);
    float n = fmFbm(m / 22.), n2 = fmFbm(m / 6. + 31.7);
    // the noise only moves the edge; deep inside the fog it is solid
    float e = smoothstep(0.08, 0.92, f + (n - 0.5) * 0.55 * (1. - f * f * f));
    float a = clamp(e * uFMc.a, 0., 1.);
    // cloudy: lighter and darker wisps through it
    vec3 c = clamp(uFMc.rgb + (n2 - 0.5) * 0.11 + (n - 0.5) * 0.07 + 0.025, 0., 1.);
    return vec4(c * a, a);
  }`;
  const FSF2 = HEAD + FOGM + `
  uniform vec2 uCanvas;
  uniform vec3 uView;
  out vec4 o;
  void main(){
    vec2 sp = vec2(gl_FragCoord.x, uCanvas.y - gl_FragCoord.y);
    vec2 m = (sp - uView.xy) / uView.z;
    if (m.x < 0. || m.y < 0. || m.x > float(uMap.x-1) || m.y > float(uMap.y-1)) discard;
    o = fogMaskAt(m);
  }`;
  // in 3D the fog lies a little above the ground (and the sea), over trees and pieces
  const VSF3 = HEAD + `
  uniform sampler2D uH;
  uniform ivec2 uMap, uMesh;
  uniform int uStride;
  uniform float uZS, uLift;
  uniform mat4 uMVP;
  out vec2 vM;
  void main(){
    int id = gl_VertexID;
    ivec2 c = min(ivec2(id % uMesh.x, id / uMesh.x) * uStride, uMap - 1);
    float h = texelFetch(uH, c, 0).r;
    vM = vec2(c);
    gl_Position = uMVP * vec4(float(c.x), max(h, 0.) * uZS + uLift, float(c.y), 1.0);
  }`;
  const FSF3 = HEAD + FOGM + `
  in vec2 vM;
  out vec4 o;
  void main(){ o = fogMaskAt(vM); }`;

  // ---------------------------------------------------------------- the game's campaign map look
  // Ported from M2EX.exe's own shaders (terrain: aerial "live" pixel shader; sea: the installed PBR sea
  // shader). Lighting is linear, then exposure and the engine's GT tone curve, then sRGB.
  // World units here are the engine's: one tile = 1, height = 0.0006 per metre. One map vertex is half a tile.
  const PRESENT = `
  uniform float uGExpo;     // exposure from descr_strategy_lighting_ex.txt times the Brightness setting
  uniform vec4 uTm;         // tone curve: peak, contrast, linear start, linear length
  uniform float uTmToe;     // tone curve: toe
  float gtCurve(float x){
    float P = uTm.x, a = uTm.y, m = uTm.z, l = uTm.w, c = uTmToe;
    float l0 = ((P - m) * l) / a;
    float S0 = m + l0, S1 = m + a * l0;
    float C2 = (a * P) / (P - S1), CP = -C2 / P;
    float w0 = 1. - smoothstep(0., m, x);
    float w2 = step(m + l0, x);
    float w1 = 1. - w0 - w2;
    float T = m * pow(max(x, 0.) / m, c);
    float S = P - (P - S1) * exp(CP * (x - S0));
    float L = m + a * (x - m);
    return T * w0 + L * w1 + S * w2;
  }
  vec3 srgbEncode(vec3 c){
    c = clamp(c, 0., 1.);
    return mix(c * 12.92, 1.055 * pow(c, vec3(1./2.4)) - 0.055, step(0.0031308, c));
  }
  vec3 present(vec3 c){
    c *= uGExpo;
    return srgbEncode(vec3(gtCurve(c.r), gtCurve(c.g), gtCurve(c.b)));
  }
  `;

  const GAME = PRESENT + `
  uniform sampler2D uHF;    // x, y: ground height (world units); z: height of the sun's horizon here; w: its distance
  uniform sampler2D uFow;   // fog of war, one texel per tile: rgb tint, a = explored
  uniform highp sampler2DArray uTW; // template_weights/weights*.tga
  uniform int uTWn;
  uniform float uGroundRep; // map vertices per ground texture repeat
  uniform float uGAlb;      // ground_albedo_scale (descr_ex.txt)
  uniform vec3 uGAmb;       // ambient_colour
  uniform vec4 uGSun;       // diffuse_colour, shadow_strength
  uniform vec3 uGL;         // towards the sun: x east, y up, z north
  uniform vec4 uGAo;        // step (texels), ao_strength, distance scale
  uniform vec4 uHaze;       // fog of war shroud colour, strength
  uniform int uTMOn;        // tile models drawn: the ground of a tile with an underlay comes from the model
  uniform int uLandFill;    // 1 while drawing tile model underlays

  vec4 HF(vec2 m){ return texture(uHF, (m + 0.5) / vec2(uMap)); }
  uint hash2(ivec2 p){ uint h = uint(p.x) * 0x8da6b343u ^ uint(p.y) * 0xd8163841u; h ^= h >> 13; h *= 0x5bd1e995u; h ^= h >> 15; return h; }
  // template weight of a corner at q, measured from that corner across the cell (0..1)
  float cornerWeight(int v, vec2 q){
    if (uTWn == 0) return (1. - q.x) * (1. - q.y);
    return texture(uTW, vec3((q * 14. + 0.5) / 15., float(v))).r;
  }
  vec3 groundTexel(uint L, vec2 uv, vec2 gx, vec2 gy){
    vec3 c;
    if (L == ${MISSING}u) { vec2 cb = floor(uv * 8.); c = mod(cb.x + cb.y, 2.) > 0.5 ? vec3(1., 0., 1.) : vec3(0.03, 0., 0.03); }
    else { c = textureGrad(uArr, vec3(uv, float(L)), gx, gy).rgb; if (uGAdjOn == 1) c = gAdj(c); }
    if (int(L) == uHilite) c = mix(c, vec3(1., 0.7, 0.05), 0.35 + 0.15 * sin(uTime * 4.));
    return c;
  }
  // The engine keeps up to four textures per cell (one per distinct corner) and blends them with
  // weights built from the template_weights pictures; a cell with one texture is sampled once.
  vec3 groundAlbedo(vec2 m){
    ivec2 i0 = ivec2(floor(m)); vec2 f = fract(m);
    vec2 uv = m / uGroundRep;
    vec2 gx = dFdx(uv), gy = dFdy(uv);
    ivec2 cs[4] = ivec2[4](i0, i0 + ivec2(1, 0), i0 + ivec2(0, 1), i0 + ivec2(1, 1));
    vec2 q[4] = vec2[4](f, vec2(1. - f.x, f.y), vec2(f.x, 1. - f.y), 1. - f);
    uint L[4];
    for (int k = 0; k < 4; k++) L[k] = layerAt(cs[k]);
    if (L[0] == L[1] && L[0] == L[2] && L[0] == L[3] && L[0] != ${WATER}u) return groundTexel(L[0], uv, gx, gy);
    int v = uTWn > 0 ? int(hash2(i0) % uint(uTWn)) : 0;
    uint sl[4]; float sw[4]; int n = 0;
    for (int k = 0; k < 4; k++) {
      if (L[k] == ${WATER}u) continue;
      float w = cornerWeight(v, q[k]);
      bool found = false;
      for (int j = 0; j < 4; j++) { if (j < n && sl[j] == L[k]) { sw[j] += w; found = true; } }
      if (!found) { sl[n] = L[k]; sw[n] = w; n++; }
    }
    if (n == 0) {
      // tile models can lift ground over cells the ground types call water (cliffs on a coast): give it the
      // nearest land's texture
      if (uLandFill == 1) for (int r = 1; r <= 3; r++) for (int dy = -r; dy <= r; dy++) for (int dx = -r; dx <= r; dx++) {
        uint Lk = layerAt(i0 + ivec2(dx, dy));
        if (Lk != ${WATER}u) return groundTexel(Lk, uv, gx, gy);
      }
      return vec3(0.09, 0.08, 0.05);
    }
    vec3 acc = vec3(0.); float tot = 0.;
    for (int j = 0; j < 4; j++) { if (j < n) { acc += sw[j] * groundTexel(sl[j], uv, gx, gy); tot += sw[j]; } }
    return acc / max(tot, 1e-5);
  }
  vec3 fogOfWar(vec3 col, vec2 m){
    vec4 f = texture(uFow, m / vec2(uMap - 1));
    float wgt = 1. + uHaze.w * (f.a - 1.);
    return wgt * (col * f.rgb - uHaze.rgb) + uHaze.rgb;
  }
  float sunShadow(vec4 c){
    if (uGSun.w <= 0.) return 1.;
    float s = clamp((c.x - c.z) / max(c.w * 0.08, 0.12) + 0.5, 0., 1.);
    return 1. - uGSun.w * (1. - s);
  }
  // ground normal from the height field: x east, y up, z north
  vec3 terrainNormal(vec2 m){
    float hL = HF(m - vec2(1., 0.)).x, hR = HF(m + vec2(1., 0.)).x;
    float hN = HF(m - vec2(0., 1.)).x, hS = HF(m + vec2(0., 1.)).x;
    return normalize(vec3(hL - hR, 1., hS - hN));
  }
  vec3 gameTerrainN(vec2 m, vec3 n){
    vec3 alb = groundAlbedo(m) * uGAlb;
    vec4 c = HF(m);
    float ndl = max(dot(n, uGL), 0.);
    float sh = sunShadow(c);
    float ao = 1.;
    if (uGAo.z > 0.) {
      float sum = 0.;
      for (int d = 0; d < 8; d++) {
        float a = float(d) * 0.785398163;
        vec2 dir = vec2(cos(a), sin(a)) * uGAo.xy;
        float mx = 0.;
        for (int r = 0; r < 4; r++) {
          float rr = float(1 << r);
          mx = max(mx, (HF(m + dir * rr).y - c.y) / (rr * uGAo.w));
        }
        sum += mx / (1. + mx);
      }
      ao = 1. - sum * uGAo.z * 0.125;
    }
    vec3 col = alb * (uGSun.rgb * ndl * sh + uGAmb) * ao;
    return fogOfWar(col, m);
  }
  `;

  // tiles with an underlay (hills, rivers, cliffs, mountains) get their ground from the model instead
  const TILE_CUT = `
  bool tileCovered(vec2 m){
    ivec2 t = clamp(ivec2(floor(m / 2.)), ivec2(0), ivec2(textureSize(uFeat, 0)) - 1);
    return texelFetch(uFeat, t, 0).a < 0.5;
  }
  // the ground is kept for a couple of pixels inside a covered tile's border, so no crack opens
  // between it and the model's edge
  bool tileCut(vec2 m){
    if (uTMOn == 0) return false;
    vec2 fw = fwidth(m); float e = 1.5 * max(max(fw.x, fw.y), 1e-3);
    return tileCovered(m + vec2(-e, -e)) && tileCovered(m + vec2(e, -e)) && tileCovered(m + vec2(-e, e)) && tileCovered(m + vec2(e, e));
  }
  vec3 gameTerrain(vec2 m){ return gameTerrainN(m, terrainNormal(m)); }
  `;

  const FSG = HEAD + COMMON + GAME + TILE_CUT + `
  in vec2 vM;
  in float vZ;
  out vec4 o;
  void main(){
    // Ground under the sea is hidden by the opaque sea; pushing its depth back keeps the sea from
    // flickering against a sea bed only a few metres below it when seen from far away.
    if (tileCut(vM)) discard;
    gl_FragDepth = vZ < 0. ? 0.9999999 : gl_FragCoord.z;
    vec2 m = vM;
    vec2 fw = fwidth(m);
    float px = max(max(fw.x, fw.y), 1e-4);
    float h = Hb(m);
    float hpx = max(fwidth(h), 1e-3);
    vec3 col = present(gameTerrain(m));
    float hx = Hb(m + vec2(1, 0)) - Hb(m - vec2(1, 0));
    float hy = Hb(m + vec2(0, 1)) - Hb(m - vec2(0, 1));
    // rivers, borders and the other map marks fade under the fog of war, as the game's do
    float vis = uHaze.w > 0. ? texture(uFow, m / vec2(uMap - 1)).a : 1.;
    o = vec4(mix(col, overlays(col, m, px, hpx, h, hx, hy), vis), 1.);
  }`;

  // Ground heights and sun horizon for the whole map, one texel per map vertex. Marches towards the
  // sun: z is the highest the ground in that direction reaches over this point, w how far away it is.
  const FSHF = HEAD + `
  uniform sampler2D uH;
  uniform ivec2 uMap;
  uniform float uZ;     // world units per metre
  uniform vec2 uDir;    // towards the sun on the map, in map vertices (y down)
  uniform float uTan;   // sun height: rise per world unit
  uniform int uSteps;
  out vec4 o;
  float H(ivec2 c){ c = clamp(c, ivec2(0), uMap-1); return texelFetch(uH, c, 0).r; }
  float Hb(vec2 m){ vec2 f = fract(m); ivec2 i = ivec2(floor(m));
    return mix(mix(H(i),H(i+ivec2(1,0)),f.x), mix(H(i+ivec2(0,1)),H(i+ivec2(1,1)),f.x), f.y); }
  void main(){
    ivec2 c = ivec2(gl_FragCoord.xy);
    float h0 = H(c) * uZ;
    float best = h0 - 1., bd = 0.;
    vec2 lim = vec2(uMap - 1);
    for (int i = 1; i <= 1024; i++) {
      if (i > uSteps) break;
      vec2 p = vec2(c) + uDir * float(i);
      if (p.x < 0. || p.y < 0. || p.x > lim.x || p.y > lim.y) break;
      float d = float(i) * 0.5;
      float hh = Hb(p) * uZ - d * uTan;
      if (hh > best) { best = hh; bd = d; }
    }
    o = vec4(h0, h0, best, bd);
  }`;

  // The sea: M2EX PBR sea shader v18 (waves.tga.dds normal map with macro, warp and detail maps; the water
  // colour straight from water_surface.tga, sRGB-decoded as the engine does; sky probe reflection with
  // Fresnel and the probe's alpha glitter boost), drawn as one plane at sea level.
  const FSS = HEAD + `
  uniform ivec2 uMap;
  uniform sampler2D uWaves, uProbe, uWS, uFow;
  uniform int uHasWaves, uHasProbe, uHasWS;
  uniform int uRiver;       // 1: a river's water (tile model overlay): no sea mask, river colour
  uniform sampler2D uH;
  uniform vec3 uEye;        // camera, map units (x, up, y down)
  uniform vec2 uScroll;     // wave scroll
  uniform float uSeaGain;
  uniform usampler2D uGT, uCL, uLUT;
  uniform vec3 uGAmb; uniform vec4 uGSun; uniform vec3 uGL; uniform vec4 uHaze;
  ` + PRESENT + `
  in vec2 vM;
  out vec4 o;
  float H(ivec2 c){ c = clamp(c, ivec2(0), uMap-1); return texelFetch(uH, c, 0).r; }
  float Hb(vec2 m){ vec2 f = fract(m); ivec2 i = ivec2(floor(m));
    return mix(mix(H(i),H(i+ivec2(1,0)),f.x), mix(H(i+ivec2(0,1)),H(i+ivec2(1,1)),f.x), f.y); }
  vec2 rot(vec2 q, float deg, float s){ float a = radians(deg); return vec2(dot(q, vec2(cos(a), -sin(a))), dot(q, vec2(sin(a), cos(a)))) * s; }
  bool water(ivec2 c){ c = clamp(c, ivec2(0), uMap-1);
    uint g = texelFetch(uGT, c, 0).r, k = texelFetch(uCL, c, 0).r;
    return texelFetch(uLUT, ivec2(int(g), int(k)), 0).r == ${WATER}u; }
  void main(){
    vec2 m = vM;
    // the engine only builds sea where the ground type is water: land below sea level stays land
    ivec2 i0 = ivec2(floor(m));
    if (uRiver == 0 && !(water(i0) || water(i0 + ivec2(1, 0)) || water(i0 + ivec2(0, 1)) || water(i0 + ivec2(1, 1)))) discard;
    vec2 wq = vec2(m.x, -m.y) * 0.5 * 0.025;   // engine wave UV: 0.05 per tile, times the shader's 0.5 tiling
    vec3 N = vec3(0., 1., 0.);
    if (uHasWaves == 1) {
      float a1 = textureLod(uWaves, rot(wq, 37., 0.13), 5.).a;
      float a2 = textureLod(uWaves, rot(wq, 101., 0.13 * 2.4), 5.).a;
      float mm = clamp(((a1 - 0.5) + (a2 - 0.5) * 0.6) * 3.5 + 0.5, 0., 1.);
      float w1 = textureLod(uWaves, rot(wq, 63., 0.21), 7.).a;
      float w2 = textureLod(uWaves, rot(wq, 149., 0.21 * 2.3), 7.).a;
      vec2 warp = vec2(w1, w2) * 0.7 - 0.35;
      vec2 qs = wq + uScroll;
      vec4 b = texture(uWaves, qs + warp);
      vec4 d = texture(uWaves, vec2(-3. * qs.y + warp.y, 3. * qs.x + warp.x));
      vec3 n0 = vec3(b.a * 2. - 1., b.g * 2. - 1., 0.);
      n0.z = sqrt(max(1. - dot(n0.xy, n0.xy), 0.));
      vec2 dn = vec2(d.a * 2. - 1., d.g * 2. - 1.);
      n0.xy *= 0.4 * (0.25 + (1.15 - 0.25) * mm);
      float k2 = (1.25 - mm) * 0.3;
      n0.x += dn.y * k2; n0.y -= dn.x * k2;
      N = normalize(vec3(n0.x, n0.z, -n0.y));
    }
    // game frame: x east, y up, z north
    vec3 V = normalize(vec3(m.x - uEye.x, -uEye.y, -(m.y - uEye.z)));
    float dvn = dot(V, N);
    vec3 R = V - 2. * dvn * N;
    float cf = 1. - clamp(-dvn, 0., 1.);
    float F = clamp(0.02 + 0.98 * cf * cf * cf * cf * cf, 0., 1.);
    vec3 probe = vec3(0.3, 0.45, 0.6);
    if (uHasProbe == 1) {
      vec2 s = length(uGL.xz) > 1e-6 ? normalize(uGL.xz) : vec2(1., 0.);
      vec3 r4 = normalize(vec3(R.z * s.y + R.x * s.x, max(R.y, 0.), R.z * s.x - R.x * s.y) + vec3(0., 1e-8, 0.));
      vec2 p = r4.xz * (0.5 / (r4.y + 1.)) + 0.5;
      vec4 pr = texture(uProbe, p);
      probe = pr.rgb * (1. + 10. * pr.a);
    }
    vec3 lightFlat = max(uGL.y, 0.) * uGSun.rgb + uGAmb;
    vec3 lit = max(lightFlat + (clamp(dot(N, uGL), 0., 1.) - max(uGL.y, 0.)) * uGSun.g, 0.);
    vec3 wc;
    if (uRiver == 0 && uHasWS == 1) {
      // v16+: water_surface.tga holds the sea colour itself (mip bias 1.5 softens its texels)
      wc = texture(uWS, m / vec2(uMap - 1), 1.5).rgb;
    } else {
      // rivers, and a map without water_surface.tga: the older shallow -> deep palette by depth
      float Y = uRiver == 1 ? 0.7 : 0.85 - clamp(-Hb(m) / 900., 0., 1.) * 0.72;
      float t = clamp((Y - 0.13) / (0.85 - 0.13), 0., 1.);
      t = t + 0.2 * (t * t * (3. - 2. * t) - t);
      vec3 shallow = vec3(100., 150., 157.) / 255., deep = vec3(37., 81., 111.) / 255.;
      wc = pow(deep + t * (shallow - deep), vec3(2.2));
    }
    // uSeaGain: brightness of the water colour, calibrated against an in-game screenshot (the engine's
    // sea alpha and vertex light constants are not in the files the app can read)
    vec3 col = mix(lit * wc * uSeaGain, probe, F);
    vec4 f = texture(uFow, m / vec2(uMap - 1));
    float wgt = 1. + uHaze.w * (f.a - 1.);
    col = wgt * (col * f.rgb - uHaze.rgb) + uHaze.rgb;
    o = vec4(present(col), 1.);
  }`;

  // campaign map trees: one instanced draw per model; each instance stands on the ground at its map spot
  const TREE_CHUNK = 64;        // map vertices per side of a culling block
  const TREE_UNIT = 2;          // map vertices per model unit (one model unit is one tile)
  const VST = HEAD + `
  uniform sampler2D uH;
  uniform ivec2 uMap;
  uniform mat4 uMVP;
  uniform float uZS;            // world units per metre of ground height (0 in the flat view)
  in vec3 aPos; in vec3 aNrm; in vec2 aUV;
  in vec4 aInst;                // map x, map y, turn, size
  uniform sampler2D uHF;        // game look: heights and sun horizon (see FSHF)
  uniform float uShadowStr;
  uniform int uGame;
  out vec3 vN; out vec2 vUV; out float vSh; out vec2 vMap;
  float H(ivec2 c){ c = clamp(c, ivec2(0), uMap-1); return texelFetch(uH, c, 0).r; }
  float Hb(vec2 m){ vec2 f = fract(m); ivec2 i = ivec2(floor(m));
    return mix(mix(H(i),H(i+ivec2(1,0)),f.x), mix(H(i+ivec2(0,1)),H(i+ivec2(1,1)),f.x), f.y); }
  void main(){
    float c = cos(aInst.z), s = sin(aInst.z);
    vec3 p = aPos * (aInst.w * ${TREE_UNIT}.);
    p = vec3(c*p.x - s*p.z, p.y, s*p.x + c*p.z);
    vN = vec3(c*aNrm.x - s*aNrm.z, aNrm.y, s*aNrm.x + c*aNrm.z);
    vUV = aUV;
    vMap = aInst.xy;
    // the engine's tree shader: the ground's sun shadow at the tree's foot
    vec4 hf = textureLod(uHF, (aInst.xy + 0.5) / vec2(uMap), 0.);
    float sv = clamp((hf.x - hf.z) / max(hf.w * 0.08, 0.12) + 0.5, 0., 1.);
    vSh = 1. - uShadowStr * (1. - sv);
    // models stand on the ground, or on the water where it is sea (ports): trees only grow on land
    float h = max(Hb(aInst.xy), 0.);
    gl_Position = uMVP * vec4(aInst.x + p.x, h * uZS + p.y, aInst.y + p.z, 1.);
  }`;
  const FST = HEAD + PRESENT + `
  uniform sampler2D uTex, uFow;
  uniform ivec2 uMap;
  uniform vec3 uSun;            // towards the sun: x east, y up, z south
  uniform vec3 uAmbient, uDiffuse;
  uniform float uExposure;
  uniform float uTreeGain;      // the user's tree brightness setting
  uniform vec3 uTreeMatch;      // the game draws its trees this much lighter and warmer (measured, game look only)
  uniform int uTAdjOn;          // Tree colour: one matrix on linear colour, then contrast on the sRGB value (as Save writes it)
  uniform mat3 uTAdj;
  uniform vec2 uTAdjC;
  uniform int uGame;
  vec3 tContrast(vec3 c, float k, float p){
    if (k == 1.) return c;
    vec3 e = mix(c * 12.92, 1.055 * pow(c, vec3(1. / 2.4)) - 0.055, step(0.0031308, c));
    e = clamp(p + (e - p) * k, 0., 1.);
    return mix(e / 12.92, pow((e + 0.055) / 1.055, vec3(2.4)), step(0.04045, e));
  }
  uniform vec4 uHaze;
  in vec3 vN; in vec2 vUV; in float vSh; in vec2 vMap;
  out vec4 o;
  void main(){
    vec4 t = texture(uTex, vUV);
    if (t.a < 0.35) discard;
    if (uTAdjOn == 1) t.rgb = tContrast(clamp(uTAdj * t.rgb, 0., 1.), uTAdjC.x, uTAdjC.y);
    // some models carry zero-length normals on a few faces; light those as if facing up
    vec3 n = dot(vN, vN) > 1e-10 ? normalize(vN) : vec3(0., 1., 0.);
    float d = dot(n, uSun);
    if (uGame == 1) {
      // engine tree shader: ambient + sun * N.L * ground shadow, in linear light
      vec3 c = t.rgb * (uAmbient + max(uDiffuse * vSh * d, 0.)) * uTreeGain * uTreeMatch;
      vec4 f = texture(uFow, vMap / vec2(uMap - 1));
      float wgt = 1. + uHaze.w * (f.a - 1.);
      c = wgt * (c * f.rgb - uHaze.rgb) + uHaze.rgb;
      o = vec4(present(c), 1.);
      return;
    }
    // leaves pass some light through, so the shaded side isn't black
    float lam = mix(max(d, 0.), d * 0.5 + 0.5, 0.45);
    vec3 c = t.rgb * (uAmbient + uDiffuse * lam) * uExposure * uTreeGain;
    o = vec4(pow(max(c, 0.), vec3(1./2.2)), 1.);
  }`;

  // ---------------------------------------------------------------- tile models
  // descr_aerial_map_tile_models.txt pieces (rivers, hills, cliffs, mountains, volcanoes, walls), one tile
  // each, draped over the ground: a model point at (x, y, z) sits y above the ground under it. Underlays
  // replace the tile's ground (and are shaded as ground); overlays are drawn on top with their own picture,
  // or as water. aInst: map x, map y of the tile centre, turn (radians), 0.
  const VSD = HEAD + `
  uniform sampler2D uH;
  uniform ivec2 uMap;
  uniform mat4 uMVP;
  uniform float uZS;            // world units per metre of ground height (0 in the flat view)
  uniform float uYS;            // model heights: the height exaggeration (0 in the flat view)
  uniform int uFit;             // 1: the model's 0..0.1 heights span the tile's lowest to highest ground (cliffs)
  in vec3 aPos; in vec3 aNrm; in vec2 aUV; in vec4 aInst;
  out vec2 vM; out float vZ; out vec3 vN; out vec2 vUV; out vec2 vQ;
  float H(ivec2 c){ c = clamp(c, ivec2(0), uMap-1); return texelFetch(uH, c, 0).r; }
  float Hb(vec2 m){ vec2 f = fract(m); ivec2 i = ivec2(floor(m));
    return mix(mix(H(i),H(i+ivec2(1,0)),f.x), mix(H(i+ivec2(0,1)),H(i+ivec2(1,1)),f.x), f.y); }
  void main(){
    float c = cos(aInst.z), s = sin(aInst.z);
    vec3 p = aPos * ${TREE_UNIT}.;
    vec2 m = aInst.xy + vec2(c*p.x - s*p.z, s*p.x + c*p.z);
    float h = Hb(m), y;
    if (uFit == 1) {
      float lo = 1e9, hi = -1e9;
      ivec2 t0 = ivec2(floor(aInst.xy)) - 1;
      for (int j = 0; j < 3; j++) for (int i = 0; i < 3; i++) { float v = H(t0 + ivec2(i, j)); lo = min(lo, v); hi = max(hi, v); }
      // on the tile's border the model meets the ground beside it, so it takes that ground's height there
      bool border = abs(abs(aPos.x) - 0.5) < 0.01 || abs(abs(aPos.z) - 0.5) < 0.01;
      if (!border) h = mix(lo, hi, aPos.y / 0.1);
      y = h * uZS;
    } else y = h * uZS + p.y * uYS;
    vZ = h;
    vM = m;
    vec3 n = vec3(c*aNrm.x - s*aNrm.z, aNrm.y, s*aNrm.x + c*aNrm.z);
    vN = vec3(n.x, n.y, -n.z);  // the game's frame: z north
    vUV = aUV;
    vQ = vec2(aPos.x + 0.5, 0.5 - aPos.z);  // across the tile, east and north (the model's z is mirrored on load)
    gl_Position = uMVP * vec4(m.x, y, m.y, 1.);
  }`;

  const FSU = HEAD + COMMON + GAME + TILE_CUT + `
  uniform int uUpN;             // underlay_up_normals: lit as the ground under it
  in vec2 vM; in float vZ; in vec3 vN; in vec2 vUV; in vec2 vQ;
  out vec4 o;
  void main(){
    gl_FragDepth = vZ < 0. ? 0.9999999 : gl_FragCoord.z;
    vec2 m = vM;
    vec2 fw = fwidth(m);
    float px = max(max(fw.x, fw.y), 1e-4);
    float h = Hb(m);
    float hpx = max(fwidth(h), 1e-3);
    vec3 n = terrainNormal(m);
    if (uUpN == 0) {
      // the model's slopes added to the ground's
      vec3 b = dot(vN, vN) > 1e-10 ? normalize(vN) : vec3(0., 1., 0.);
      n = normalize(n / n.y + vec3(b.x, 0., b.z) / max(b.y, 0.2));
    }
    vec3 col = present(gameTerrainN(m, n));
    float hx = Hb(m + vec2(1, 0)) - Hb(m - vec2(1, 0));
    float hy = Hb(m + vec2(0, 1)) - Hb(m - vec2(0, 1));
    float vis = uHaze.w > 0. ? texture(uFow, m / vec2(uMap - 1)).a : 1.;
    o = vec4(mix(col, overlays(col, m, px, hpx, h, hx, hy), vis), 1.);
  }`;

  // a textured overlay (mountain rock, cliff faces, a ford's bank): ground lighting with the model's
  // normals, the sun shadow and fog of war of the ground under it, and an alpha page cell when it has one
  const FSO = HEAD + PRESENT + `
  uniform sampler2D uTex, uPage, uHF, uFow;
  uniform ivec2 uMap;
  uniform vec4 uPageP;          // alpha page cell: column, row from the top, quarter turns, on
  uniform vec2 uPageN;          // alpha page cells across, up
  uniform vec3 uGAmb; uniform vec4 uGSun; uniform vec3 uGL; uniform vec4 uHaze;
  in vec2 vM; in float vZ; in vec3 vN; in vec2 vUV; in vec2 vQ;
  out vec4 o;
  void main(){
    vec4 t = texture(uTex, vUV);
    float a = t.a;
    if (uPageP.w > 0.) {
      vec2 q = clamp(vQ, 0., 1.);
      for (int k = 0; k < 4; k++) if (float(k) < uPageP.z) q = vec2(q.y, 1. - q.x);
      a *= texture(uPage, (uPageP.xy + vec2(q.x, 1. - q.y)) / uPageN).r;
    }
    if (a < 0.02) discard;
    vec3 n = dot(vN, vN) > 1e-10 ? normalize(vN) : vec3(0., 1., 0.);
    vec4 c = texture(uHF, (vM + 0.5) / vec2(uMap));
    float sh = 1.;
    if (uGSun.w > 0.) sh = 1. - uGSun.w * (1. - clamp((c.x - c.z) / max(c.w * 0.08, 0.12) + 0.5, 0., 1.));
    vec3 col = t.rgb * (uGSun.rgb * max(dot(n, uGL), 0.) * sh + uGAmb);
    vec4 f = texture(uFow, vM / vec2(uMap - 1));
    float wgt = 1. + uHaze.w * (f.a - 1.);
    col = wgt * (col * f.rgb - uHaze.rgb) + uHaze.rgb;
    o = vec4(present(col), a);
  }`;

  // ---------------------------------------------------------------- small vector helpers
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const normalize = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
  function mul4(a, b) { // column-major a*b
    const o = new Float32Array(16);
    for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
      let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
      o[c * 4 + r] = s;
    }
    return o;
  }

  class MapView {
    constructor(canvas) {
      this.canvas = canvas;
      const gl = canvas.getContext('webgl2', { antialias: true, preserveDrawingBuffer: true });
      if (!gl) throw new Error('WebGL2 is not available on this computer.');
      this.gl = gl;
      this.prog2d = this._program(VS2D, FS2D, ['p']);
      this.U2 = this._uniforms(this.prog2d);
      this.prog3d = null; // compiled the first time 3D is used
      // 2D quad
      this.vao2d = gl.createVertexArray();
      gl.bindVertexArray(this.vao2d);
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(this.prog2d, 'p');
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      this.vao3d = gl.createVertexArray();
      this.vaoW = gl.createVertexArray();
      gl.bindVertexArray(null);
      this.mesh = null;

      this.tex = {};
      this.view = { x: 0, y: 0, scale: 1 };
      this.cam = { tx: 0, tz: 0, yaw: 0, pitch: 0.95, dist: 1000, fov: 45 * Math.PI / 180 };
      this.opts = {
        mode: 0, borders: false, rivers: true, grid: false, climateTint: false, heightBlend: true, settlements: true,
        texScale: 6, relief: 1, exposure: 1, sunAz: 315, sunEl: 45,
        ambient: [0.22, 0.22, 0.24], diffuse: [1.0, 1.0, 1.05], hilite: -1,
        sea: false, is3D: false, exag: 1, detail3d: 2,
        trees: true, treeBudget: 2.5e6, // triangles per frame
        pieces: true,                     // settlements, ports, forts and resources
        tileModels: true,                 // hills, rivers, cliffs and mountains from map.rwm (game look)
        // the game's look in 3D (descr_strategy_lighting_ex.txt values; vanilla defaults until a map loads)
        game: true,
        gameLight: {
          ambient: [0.2176, 0.2176, 0.2373], sun: [1.0107, 1.0107, 1.0855], dir: [-1, -1, 1],
          shadow: 0.9, ao: 0.45, exposure: 1,
        },
        tonemap: { peak: 1, contrast: 1, linearStart: 0.22, linearLength: 0.4, toe: 1 },
      };
      this.hfDirty = true;
      this.hfKey = '';
      this.layerCount = 0;
      this.dirty = true;
      this.mapW = this.mapH = 0;
      this.heights = null;
      this.guides = []; // [{ tex, cx, cy, w, h, ang, alpha }], drawn in order, up to 4
      this.treeModels = []; // [{ vao, tex, count, top, inst, start, n }]
      this.treeGrid = null;
      this.treeStats = { drawn: 0, total: 0 };
      this._noGuide = this._tex2d('noguide', 1, 1, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
    }

    _program(vs, fs, attribs) {
      const gl = this.gl;
      const mk = (type, src) => {
        const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
        return s;
      };
      const p = gl.createProgram();
      gl.attachShader(p, mk(gl.VERTEX_SHADER, vs)); gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fs));
      (attribs || []).forEach((a, i) => gl.bindAttribLocation(p, i, a));
      gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
      return p;
    }

    _uniforms(prog) {
      const gl = this.gl;
      const u = {};
      const n = gl.getProgramParameter(prog, gl.ACTIVE_UNIFORMS);
      for (let i = 0; i < n; i++) { const a = gl.getActiveUniform(prog, i); u[a.name.replace(/\[0\]$/, '')] = gl.getUniformLocation(prog, a.name); }
      return u;
    }

    _tex2d(name, w, h, ifmt, fmt, type, data, filter) {
      const gl = this.gl;
      if (this.tex[name]) gl.deleteTexture(this.tex[name]);
      const t = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      gl.texImage2D(gl.TEXTURE_2D, 0, ifmt, w, h, 0, fmt, type, data);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter || gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter || gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      this.tex[name] = t;
      this.dirty = true;
      return t;
    }

    setMap(w, h, gt, cl, heights) {
      const gl = this.gl;
      this.mapW = w; this.mapH = h;
      this.heights = heights;
      this._tex2d('gt', w, h, gl.R8UI, gl.RED_INTEGER, gl.UNSIGNED_BYTE, gt);
      this._tex2d('cl', w, h, gl.R8UI, gl.RED_INTEGER, gl.UNSIGNED_BYTE, cl);
      this._tex2d('h', w, h, gl.R32F, gl.RED, gl.FLOAT, heights);
      this.hfDirty = true;
      if (!this.tex.fow) this.setFog(null);
      this.mesh = null;
      this.treeGrid = null;
      for (const m of this.treeModels) m.n = 0;
    }

    _subImage(tex, data, x0, y0, x1, y1, fmt, type) {
      const gl = this.gl;
      const w = x1 - x0 + 1, h = y1 - y0 + 1;
      if (w <= 0 || h <= 0) return;
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      gl.pixelStorei(gl.UNPACK_ROW_LENGTH, this.mapW);
      gl.pixelStorei(gl.UNPACK_SKIP_PIXELS, x0);
      gl.pixelStorei(gl.UNPACK_SKIP_ROWS, y0);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, x0, y0, w, h, fmt, type, data);
      gl.pixelStorei(gl.UNPACK_ROW_LENGTH, 0);
      gl.pixelStorei(gl.UNPACK_SKIP_PIXELS, 0);
      gl.pixelStorei(gl.UNPACK_SKIP_ROWS, 0);
      this.dirty = true;
    }

    // Upload a changed rectangle of the ground type / climate index arrays.
    updateRect(gt, cl, x0, y0, x1, y1) {
      const gl = this.gl;
      this._subImage(this.tex.gt, gt, x0, y0, x1, y1, gl.RED_INTEGER, gl.UNSIGNED_BYTE);
      this._subImage(this.tex.cl, cl, x0, y0, x1, y1, gl.RED_INTEGER, gl.UNSIGNED_BYTE);
    }

    // Upload a changed rectangle of the height array.
    updateHeights(x0, y0, x1, y1) {
      const gl = this.gl;
      this._subImage(this.tex.h, this.heights, x0, y0, x1, y1, gl.RED, gl.FLOAT);
      this.hfDirty = true;
      const g = this.treeGrid;
      if (g) {
        for (let cy = Math.max(0, Math.floor((y0 - 1) / TREE_CHUNK)); cy <= Math.min(g.ch - 1, Math.floor((y1 + 1) / TREE_CHUNK)); cy++)
          for (let cx = Math.max(0, Math.floor((x0 - 1) / TREE_CHUNK)); cx <= Math.min(g.cw - 1, Math.floor((x1 + 1) / TREE_CHUNK)); cx++) g.hDirty[cy * g.cw + cx] = 1;
      }
    }

    // Largest guide image side worth uploading; bigger pictures are scaled down to this.
    maxGuideSize() { return Math.min(4096, this.gl.getParameter(this.gl.MAX_TEXTURE_SIZE)); }

    // A guide image as a mipmapped texture. src: ImageBitmap, canvas or { width, height, data } RGBA.
    makeGuideTexture(src) {
      const gl = this.gl;
      const t = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      if (src.data) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, src.width, src.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, src.data);
      else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, src);
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      this.dirty = true;
      return t;
    }
    deleteTexture(t) { if (t) this.gl.deleteTexture(t); this.dirty = true; }

    setRegions(w, h, rgba) { const gl = this.gl; this._tex2d('region', w, h, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, rgba); }
    setFeatures(w, h, rgba) { this.featSrc = { w, h, rgba }; this._applyCover(); }
    // the features texture's alpha marks the tiles whose ground a tile model's underlay replaces
    _applyCover() {
      const gl = this.gl, f = this.featSrc;
      if (!f) return;
      const c = this.tileCover;
      this.tileCoverOK = !!(c && c.length === f.w * f.h);
      const data = new Uint8Array(f.rgba);
      for (let i = 0, n = f.w * f.h; i < n; i++) data[i * 4 + 3] = this.tileCoverOK && c[i] ? 0 : 255;
      this._tex2d('feat', f.w, f.h, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, data);
    }

    // 64x64 lookup: x = ground type index, y = climate index -> texture layer
    setLUT(lut) { const gl = this.gl; this._tex2d('lut', 64, 64, gl.R8UI, gl.RED_INTEGER, gl.UNSIGNED_BYTE, lut); }
    setPalettes(gtCols, clCols) {
      const gl = this.gl;
      this._tex2d('gtcol', 64, 1, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, gtCols);
      this._tex2d('clcol', 64, 1, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, clCols);
    }

    // template_weights/weights1..N.tga as one texture array (each 15x15 greyscale)
    setTemplateWeights(imgs) {
      const gl = this.gl;
      if (this.tex.tw) gl.deleteTexture(this.tex.tw);
      const list = (imgs || []).filter(Boolean);
      const n = Math.max(1, list.length), S = 15;
      const data = new Uint8Array(S * S * n).fill(255);
      list.forEach((img, k) => {
        for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
          const sx = Math.min(img.width - 1, Math.round(x * (img.width - 1) / (S - 1)));
          const sy = Math.min(img.height - 1, Math.round(y * (img.height - 1) / (S - 1)));
          data[k * S * S + y * S + x] = img.data[(sy * img.width + sx) * 4];
        }
      });
      const t = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D_ARRAY, t);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      gl.texImage3D(gl.TEXTURE_2D_ARRAY, 0, gl.R8, S, S, n, 0, gl.RED, gl.UNSIGNED_BYTE, data);
      gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      this.tex.tw = t;
      this.twCount = list.length;
      this.dirty = true;
    }

    _texImage(name, img, srgb, mips) {
      const gl = this.gl;
      if (this.tex[name]) { gl.deleteTexture(this.tex[name]); this.tex[name] = null; }
      if (!img) { this.dirty = true; return; }
      const t = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      gl.texImage2D(gl.TEXTURE_2D, 0, srgb ? gl.SRGB8_ALPHA8 : gl.RGBA8, img.width, img.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, img.data);
      if (mips) gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, mips ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      const wrap = name === 'waves' || name === 'cgrid' ? gl.REPEAT : gl.CLAMP_TO_EDGE;
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
      if (mips) { const ext = gl.getExtension('EXT_texture_filter_anisotropic'); if (ext) gl.texParameterf(gl.TEXTURE_2D, ext.TEXTURE_MAX_ANISOTROPY_EXT, 8); }
      this.tex[name] = t;
      this.dirty = true;
    }

    // sea pictures, each { width, height, data } RGBA or null: waves.tga.dds (normal map),
    // sky_environment_summer.tga.dds (light probe), water_surface.tga (depth/colour map)
    // water_surface.tga again, recoloured by the Sea colour panel
    setSeaSurface(surface) { this._texImage('wsurf', surface, true, true); this.dirty = true; }
    setSeaTextures({ waves, probe, surface }) {
      this._texImage('waves', waves, false, true);
      this._texImage('probe', probe, true, true);
      this._texImage('wsurf', surface, true, true);  // sRGB: the engine decodes it with the sRGB curve
    }

    // matcap material ball and colour grid picture, each { width, height, data } RGBA
    setMatcap(img) { this._texImage('matcap', img, false, true); }
    setColorGrid(img) { this._texImage('cgrid', img, false, true); }

    // Fog of war, one texel per tile: { width, height, data } RGBA (rgb tint, a = explored), or null for none.
    setFog(img) {
      const gl = this.gl;
      if (!img) img = { width: 1, height: 1, data: new Uint8Array([255, 255, 255, 255]) };
      this._texImage('fow', img, false, false);
      this.fogOn = img.width > 1;
    }

    // Heights and sun horizon (see FSHF), redone when the heights, the sun or the exaggeration change.
    _computeHF() {
      const gl = this.gl, W = this.mapW, H = this.mapH, o = this.opts;
      const L = this._sunGame();
      const key = [W, H, o.exag, L.map((v) => v.toFixed(4))].join();
      if (!this.hfDirty && this.hfKey === key && this.tex.hf) return;
      this.hfDirty = false; this.hfKey = key;
      if (!this.tex.hf || this.hfW !== W || this.hfH !== H) {
        if (this.tex.hf) gl.deleteTexture(this.tex.hf);
        const t = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, t);
        gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA16F, W, H);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        this.tex.hf = t; this.hfW = W; this.hfH = H;
        if (this.hfFbo) gl.deleteFramebuffer(this.hfFbo);
        this.hfFbo = null;
      }
      const zw = 0.0006 * o.exag;       // world units per metre
      if (this.hfRender) {
        if (!this.hfFbo) {
          this.hfFbo = gl.createFramebuffer();
          gl.bindFramebuffer(gl.FRAMEBUFFER, this.hfFbo);
          gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.tex.hf, 0);
          if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) { this.hfRender = false; gl.deleteFramebuffer(this.hfFbo); this.hfFbo = null; }
        }
      }
      // sun direction on the map (y down), its height, and how far a shadow can reach
      const lxz = Math.hypot(L[0], L[2]);
      const tanEl = Math.max(0.0874886, lxz > 1e-6 ? L[1] / lxz : 100);
      const dir = lxz > 1e-6 ? [L[0] / lxz, -L[2] / lxz] : [1, 0];
      const maxH = Math.max(0, this.hMax || 0) * zw;
      const steps = Math.min(1024, Math.ceil(2 * (2.6667 * maxH / tanEl + 1)));
      if (this.hfRender && this.hfFbo) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.hfFbo);
        gl.viewport(0, 0, W, H);
        gl.disable(gl.DEPTH_TEST); gl.disable(gl.BLEND);
        gl.useProgram(this.progHF);
        const U = this.UHF;
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.tex.h);
        gl.uniform1i(U.uH, 0);
        gl.uniform2i(U.uMap, W, H);
        gl.uniform1f(U.uZ, zw);
        gl.uniform2f(U.uDir, dir[0], dir[1]);
        gl.uniform1f(U.uTan, tanEl);
        gl.uniform1i(U.uSteps, steps);
        gl.bindVertexArray(this.vao2d);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        gl.bindVertexArray(null);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, this.canvas.width, this.canvas.height);
      } else {
        // no float render targets on this card: heights only, no cast shadows
        const D = this.heights, px = new Float32Array(W * H * 4);
        for (let i = 0; i < W * H; i++) { const h = D[i] * zw; px[i * 4] = h; px[i * 4 + 1] = h; px[i * 4 + 2] = h - 1; px[i * 4 + 3] = 0; }
        gl.bindTexture(gl.TEXTURE_2D, this.tex.hf);
        gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, W, H, gl.RGBA, gl.FLOAT, px);
      }
    }

    // towards the sun in the game's frame (x east, y up, z north), from descr_strategy_lighting
    _sunGame() {
      const d = this.opts.gameLight.dir;
      const l = Math.hypot(d[0], d[1], d[2]) || 1;
      return [-d[0] / l, -d[1] / l, -d[2] / l];
    }

    allocLayers(n) {
      const gl = this.gl;
      if (this.tex.arr) gl.deleteTexture(this.tex.arr);
      const t = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D_ARRAY, t);
      const levels = Math.log2(LAYER_SIZE) + 1;
      gl.texStorage3D(gl.TEXTURE_2D_ARRAY, levels, gl.SRGB8_ALPHA8, LAYER_SIZE, LAYER_SIZE, Math.max(1, n));
      gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.REPEAT);
      const ext = gl.getExtension('EXT_texture_filter_anisotropic');
      if (ext) gl.texParameterf(gl.TEXTURE_2D_ARRAY, ext.TEXTURE_MAX_ANISOTROPY_EXT, 8);
      this.tex.arr = t;
      this.layerCount = n;
      this.dirty = true;
    }

    setLayer(i, rgba512) {
      const gl = this.gl;
      gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.tex.arr);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      gl.texSubImage3D(gl.TEXTURE_2D_ARRAY, 0, 0, 0, i, LAYER_SIZE, LAYER_SIZE, 1, gl.RGBA, gl.UNSIGNED_BYTE, rgba512);
      this._mipsPending = true;
      this.dirty = true;
    }

    resize() {
      const dpr = window.devicePixelRatio || 1;
      const r = this.canvas.getBoundingClientRect();
      let w = Math.max(1, Math.round(r.width * dpr)), h = Math.max(1, Math.round(r.height * dpr));
      // a screen grab renders at a set size (e.g. 1920 x 1080) whatever the window is
      if (this.forceSize) { w = this.forceSize.w; h = this.forceSize.h; }
      if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = w; this.canvas.height = h; this.dirty = true; }
    }

    // ---------------------------------------------------------------- 2D navigation
    // screen (CSS px) -> map vertex coords
    toMap(cx, cy) {
      const dpr = window.devicePixelRatio || 1;
      return { x: (cx * dpr - this.view.x) / this.view.scale, y: (cy * dpr - this.view.y) / this.view.scale };
    }
    toScreen(mx, my) {
      const dpr = window.devicePixelRatio || 1;
      return { x: (mx * this.view.scale + this.view.x) / dpr, y: (my * this.view.scale + this.view.y) / dpr };
    }

    fit() {
      this.resize();
      const s = Math.min(this.canvas.width / this.mapW, this.canvas.height / this.mapH) * 0.95;
      this.view.scale = s;
      this.view.x = (this.canvas.width - this.mapW * s) / 2;
      this.view.y = (this.canvas.height - this.mapH * s) / 2;
      Object.assign(this.cam, { tx: (this.mapW - 1) / 2, tz: (this.mapH - 1) / 2, yaw: 0, pitch: 0.95, dist: Math.max(this.mapW, this.mapH) * 0.95 });
      this.dirty = true;
    }

    zoomAt(cx, cy, factor) {
      if (this.opts.is3D) return this.zoom3D(cx, cy, factor);
      const dpr = window.devicePixelRatio || 1;
      const px = cx * dpr, py = cy * dpr;
      const ns = Math.min(80, Math.max(0.05, this.view.scale * factor));
      const f = ns / this.view.scale;
      this.view.x = px - (px - this.view.x) * f;
      this.view.y = py - (py - this.view.y) * f;
      this.view.scale = ns;
      this.dirty = true;
    }

    pan(dx, dy) {
      const dpr = window.devicePixelRatio || 1;
      this.view.x += dx * dpr; this.view.y += dy * dpr; this.dirty = true;
    }

    // ---------------------------------------------------------------- 3D camera
    // world units per metre; one map vertex is one unit. The game draws 0.0006 tiles per metre (M2EX.exe:
    // heights are scaled by 0.0006 where the terrain vertices are built) and a tile is two map vertices.
    zScale() { return this.opts.exag * 0.0012; }
    _y(h) { return (h < 0 && !this.gameLook() ? h * SEA_FLOOR : h) * this.zScale(); }

    _camera() {
      if (this.shotCam) return this._shotCamera(this.shotCam);
      const c = this.cam;
      const cp = Math.cos(c.pitch), sp = Math.sin(c.pitch);
      const target = [c.tx, 0, c.tz];
      const eye = [c.tx + c.dist * cp * Math.sin(c.yaw), c.dist * sp, c.tz + c.dist * cp * Math.cos(c.yaw)];
      const fwd = normalize(sub(target, eye));
      const right = normalize(cross(fwd, [0, 1, 0]));
      const up = cross(right, fwd);
      const aspect = this.canvas.width / Math.max(1, this.canvas.height);
      const near = Math.max(0.5, c.dist * 0.03), far = c.dist * 4 + Math.max(this.mapW, this.mapH) * 2;
      const f = 1 / Math.tan(c.fov / 2);
      const P = new Float32Array([f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) / (near - far), -1, 0, 0, 2 * far * near / (near - far), 0]);
      const V = new Float32Array([
        right[0], up[0], -fwd[0], 0,
        right[1], up[1], -fwd[1], 0,
        right[2], up[2], -fwd[2], 0,
        -dot(right, eye), -dot(up, eye), dot(fwd, eye), 1]);
      return { eye, fwd, right, up, aspect, mvp: mul4(P, V), tanH: Math.tan(c.fov / 2) };
    }

    // Straight down, no perspective, over r = { x0, y0, x1, y1 } in map vertices (for overhead pictures).
    _shotCamera(r) {
      const w = r.x1 - r.x0, h = r.y1 - r.y0, cx = (r.x0 + r.x1) / 2, cz = (r.y0 + r.y1) / 2;
      let top = 0; const H = this.heights;
      if (H) for (let i = 0; i < H.length; i += 7) if (H[i] > top) top = H[i];
      const eyeH = top * this.zScale() + Math.max(w, h) + 50;
      const eye = [cx, eyeH, cz], fwd = [0, -1, 0], right = [1, 0, 0], up = [0, 0, -1];
      const near = 1, far = eyeH + 4000 * this.zScale() + 50;
      const P = new Float32Array([2 / w, 0, 0, 0, 0, 2 / h, 0, 0, 0, 0, -2 / (far - near), 0, 0, 0, -(far + near) / (far - near), 1]);
      const V = new Float32Array([
        right[0], up[0], -fwd[0], 0,
        right[1], up[1], -fwd[1], 0,
        right[2], up[2], -fwd[2], 0,
        -dot(right, eye), -dot(up, eye), dot(fwd, eye), 1]);
      // tanH chosen so "pixels per unit at the eye's distance" (tree culling) matches this picture's scale
      return { eye, fwd, right, up, aspect: w / h, mvp: mul4(P, V), tanH: h / 2 / eyeH, ortho: true };
    }

    // The fog mask: { width, height, data } one byte a pixel, 255 = fog; or null for none.
    setFogMask(img) {
      const gl = this.gl;
      if (this.tex.fmask) { gl.deleteTexture(this.tex.fmask); this.tex.fmask = null; }
      if (img) {
        const t = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, t);
        gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, img.width, img.height, 0, gl.RED, gl.UNSIGNED_BYTE, img.data);
        gl.generateMipmap(gl.TEXTURE_2D);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        this.tex.fmask = t;
      }
      this.dirty = true;
    }

    _drawFogMask(cam) {
      const gl = this.gl, o = this.opts;
      if (!this.tex.fmask || !o.fogMask) return;
      if (!this.progF2) {
        try {
          this.progF2 = this._program(VS2D, FSF2, ['p']); this.UF2 = this._uniforms(this.progF2);
          this.progF3 = this._program(VSF3, FSF3); this.UF3 = this._uniforms(this.progF3);
        } catch (e) { console.warn('fog mask shaders', e); this.tex.fmask = null; return; }
      }
      const c = o.fogMask.colour || [0, 0, 0], a = o.fogMask.density == null ? 0.9 : o.fogMask.density;
      gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      if (!cam) {
        gl.disable(gl.DEPTH_TEST);
        const U = this.UF2;
        gl.useProgram(this.progF2);
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.tex.fmask); gl.uniform1i(U.uFM, 0);
        gl.uniform4f(U.uFMc, c[0], c[1], c[2], a);
        gl.uniform2i(U.uMap, this.mapW, this.mapH);
        gl.uniform2f(U.uCanvas, this.canvas.width, this.canvas.height);
        gl.uniform3f(U.uView, this.view.x, this.view.y, this.view.scale);
        gl.bindVertexArray(this.vao2d);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      } else {
        const mesh = this._ensureMesh(), U = this.UF3;
        gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.depthMask(false);
        gl.useProgram(this.progF3);
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.tex.h); gl.uniform1i(U.uH, 0);
        gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.tex.fmask); gl.uniform1i(U.uFM, 1);
        gl.uniform4f(U.uFMc, c[0], c[1], c[2], a);
        gl.uniform2i(U.uMap, this.mapW, this.mapH);
        gl.uniform2i(U.uMesh, mesh.cols, mesh.rows);
        gl.uniform1i(U.uStride, mesh.stride);
        gl.uniform1f(U.uZS, this.zScale());
        gl.uniform1f(U.uLift, 1.5);
        gl.uniformMatrix4fv(U.uMVP, false, cam.mvp);
        gl.bindVertexArray(this.vao3d);
        gl.drawElements(gl.TRIANGLES, mesh.count, gl.UNSIGNED_INT, 0);
        gl.depthMask(true); gl.disable(gl.DEPTH_TEST);
      }
      gl.bindVertexArray(null);
      gl.disable(gl.BLEND);
      gl.activeTexture(gl.TEXTURE0);
    }

    orbit(dx, dy) {
      this.cam.yaw -= dx * 0.006;
      this.cam.pitch = Math.min(1.55, Math.max(0.06, this.cam.pitch + dy * 0.006));
      this.dirty = true;
    }

    pan3D(dx, dy) {
      const c = this.cam, s = c.dist * 0.0016;
      const rx = Math.cos(c.yaw), rz = -Math.sin(c.yaw);     // camera right, on the ground
      const fx = -Math.sin(c.yaw), fz = -Math.cos(c.yaw);    // camera forward, on the ground
      c.tx = Math.min(this.mapW, Math.max(0, c.tx - rx * dx * s + fx * dy * s));
      c.tz = Math.min(this.mapH, Math.max(0, c.tz - rz * dx * s + fz * dy * s));
      this.dirty = true;
    }

    zoom3D(cx, cy, factor) {
      const c = this.cam;
      const hit = this.pick3D(cx, cy);
      const nd = Math.min(Math.max(this.mapW, this.mapH) * 3, Math.max(8, c.dist / factor));
      const k = 1 - nd / c.dist;
      if (hit) { c.tx += (hit.x - c.tx) * k; c.tz += (hit.y - c.tz) * k; }
      c.dist = nd;
      this.dirty = true;
    }

    // bilinear height at map coords
    heightAt(x, y) {
      const W = this.mapW, H = this.mapH, D = this.heights;
      x = Math.min(W - 1, Math.max(0, x)); y = Math.min(H - 1, Math.max(0, y));
      const x0 = Math.floor(x), y0 = Math.floor(y), x1 = Math.min(W - 1, x0 + 1), y1 = Math.min(H - 1, y0 + 1);
      const fx = x - x0, fy = y - y0;
      const a = D[y0 * W + x0] + (D[y0 * W + x1] - D[y0 * W + x0]) * fx;
      const b = D[y1 * W + x0] + (D[y1 * W + x1] - D[y1 * W + x0]) * fx;
      return a + (b - a) * fy;
    }

    // A world-space ray through a CSS-pixel position, also used to pick scenery meshes.
    ray3D(cx, cy) {
      this.resize();
      const dpr = window.devicePixelRatio || 1;
      const cam = this._camera();
      const nx = (cx * dpr / this.canvas.width) * 2 - 1, ny = 1 - (cy * dpr / this.canvas.height) * 2;
      const d = normalize([
        cam.fwd[0] + cam.right[0] * nx * cam.tanH * cam.aspect + cam.up[0] * ny * cam.tanH,
        cam.fwd[1] + cam.right[1] * nx * cam.tanH * cam.aspect + cam.up[1] * ny * cam.tanH,
        cam.fwd[2] + cam.right[2] * nx * cam.tanH * cam.aspect + cam.up[2] * ny * cam.tanH]);
      return { o: cam.eye, d };
    }

    // The point of the terrain under screen (CSS px) position, or null.
    pick3D(cx, cy) {
      if (!this.heights) return null;
      const { o, d } = this.ray3D(cx, cy);
      // clip the ray to the map's footprint
      let t0 = 0, t1 = 1e7;
      for (const [oi, di, hi] of [[o[0], d[0], this.mapW - 1], [o[2], d[2], this.mapH - 1]]) {
        if (Math.abs(di) < 1e-9) { if (oi < 0 || oi > hi) return null; continue; }
        let a = (0 - oi) / di, b = (hi - oi) / di;
        if (a > b) [a, b] = [b, a];
        t0 = Math.max(t0, a); t1 = Math.min(t1, b);
      }
      if (t0 > t1) return null;
      const above = (t) => o[1] + d[1] * t - this._y(this.heightAt(o[0] + d[0] * t, o[2] + d[2] * t));
      const step = 0.5 / Math.max(0.05, Math.hypot(d[0], d[2]));
      let prev = t0;
      if (above(t0) < 0) return null;
      for (let t = t0 + step; t <= t1 + step; t += step) {
        const tt = Math.min(t, t1);
        if (above(tt) < 0) {
          let a = prev, b = tt;
          for (let k = 0; k < 20; k++) { const m = (a + b) / 2; if (above(m) < 0) b = m; else a = m; }
          const x = o[0] + d[0] * b, y = o[2] + d[2] * b;
          return { x, y, h: this.heightAt(x, y) };
        }
        prev = tt;
        if (tt >= t1) break;
      }
      return null;
    }

    // map coords + height -> screen (CSS px), or null if behind the camera
    project3D(mx, my, h) {
      return this.projectWorld([mx, this._y(h), my]);
    }

    projectWorld(point) {
      const m = this._camera().mvp;
      const v = [...point, 1];
      const c = [0, 0, 0, 0];
      for (let r = 0; r < 4; r++) c[r] = m[r] * v[0] + m[4 + r] * v[1] + m[8 + r] * v[2] + m[12 + r] * v[3];
      if (c[3] <= 0) return null;
      const dpr = window.devicePixelRatio || 1;
      return { x: (c[0] / c[3] + 1) / 2 * this.canvas.width / dpr, y: (1 - c[1] / c[3]) / 2 * this.canvas.height / dpr };
    }

    // Compiles the 3D shaders. Throws if this graphics card can't, so the app can stay in 2D.
    init3D() {
      if (this.prog3d) return;
      const p3 = this._program(VS3D, FS3D), pw = this._program(VSW, FSW);
      this.prog3d = p3; this.progW = pw;
      this.U3 = this._uniforms(p3); this.UW = this._uniforms(pw);
      // the game look; if this card can't build it the old look stays
      try {
        this.progG = this._program(VS3D, FSG); this.UG = this._uniforms(this.progG);
        this.progS = this._program(VSW, FSS); this.US = this._uniforms(this.progS);
        this.progHF = this._program(VS2D, FSHF, ['p']); this.UHF = this._uniforms(this.progHF);
        // tile models: underlays as ground, river water as the sea, textured overlays
        const at = ['aPos', 'aNrm', 'aUV', 'aInst'];
        this.progU = this._program(VSD, FSU, at); this.UU = this._uniforms(this.progU);
        this.progR = this._program(VSD, FSS, at); this.UR = this._uniforms(this.progR);
        this.progO = this._program(VSD, FSO, at); this.UO = this._uniforms(this.progO);
        const gl = this.gl;
        this.hfRender = !!(gl.getExtension('EXT_color_buffer_float') || gl.getExtension('EXT_color_buffer_half_float'));
        if (!this.tex.tw) this.setTemplateWeights([]);
        if (!this.tex.fow) this.setFog(null);
        this.gameOK = true;
      } catch (e) {
        console.error('Game look shaders failed:', e);
        this.gameOK = false;
        this.gameError = e.message;
      }
    }

    _ensureMesh() {
      const s = Math.max(1, this.opts.detail3d | 0);
      if (this.mesh && this.mesh.stride === s) return this.mesh;
      const gl = this.gl;
      const cols = Math.ceil((this.mapW - 1) / s) + 1, rows = Math.ceil((this.mapH - 1) / s) + 1;
      const idx = new Uint32Array((cols - 1) * (rows - 1) * 6);
      let k = 0;
      for (let y = 0; y < rows - 1; y++) {
        for (let x = 0; x < cols - 1; x++) {
          const a = y * cols + x, b = a + 1, c = a + cols, d = c + 1;
          idx[k++] = a; idx[k++] = c; idx[k++] = b;
          idx[k++] = b; idx[k++] = c; idx[k++] = d;
        }
      }
      gl.bindVertexArray(this.vao3d);
      if (this.mesh) gl.deleteBuffer(this.mesh.buf);
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buf);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
      gl.bindVertexArray(null);
      this.mesh = { stride: s, cols, rows, count: idx.length, buf };
      return this.mesh;
    }

    // ---------------------------------------------------------------- trees
    _initTrees() {
      if (this.progT) return;
      this.progT = this._program(VST, FST, ['aPos', 'aNrm', 'aUV', 'aInst']);
      this.UT = this._uniforms(this.progT);
    }

    // models: [{ parts: [{ pos, nrm, uv, idx, image: { width, height, data } or null }] }], in the order
    // setTreeInstances uses. A model's parts share its spots and each draws with its own picture.
    setTreeModels(models) {
      const gl = this.gl;
      this._initTrees();
      this._freeModels(this.treeModels);
      this.treeModels = models.map((src) => this._gpuModel(src));
      this.treeGrid = null;
      this.dirty = true;
    }

    // re-uploads the models' pictures with fn(r, g, b) -> [r, g, b] worked in (null: the pictures as loaded)
    recolourModels(which, fn) {
      const gl = this.gl, list = which === 'tree' ? this.treeModels : this.pieceModels;
      for (const m of list || []) for (const pt of m.parts) {
        if (!pt.src) continue;
        let d = pt.src.data;
        if (fn) {
          d = new Uint8Array(d);
          for (let i = 0; i < d.length; i += 4) { const c = fn(d[i], d[i + 1], d[i + 2]); d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; }
        }
        gl.bindTexture(gl.TEXTURE_2D, pt.tex);
        gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.SRGB8_ALPHA8, pt.src.width, pt.src.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, d);
        gl.generateMipmap(gl.TEXTURE_2D);
      }
      this.dirty = true;
    }

    // one model's parts as vertex arrays and textures, with an instance buffer (4 floats an instance)
    _gpuModel(src, texCache) {
      const gl = this.gl;
      const inst = gl.createBuffer();
      let top = 0, tris = 0;
      const parts = src.parts.map((pt) => {
        const nv = pt.pos.length / 3;
        const v = new Float32Array(nv * 8);
        for (let i = 0; i < nv; i++) {
          v[i * 8] = pt.pos[i * 3]; v[i * 8 + 1] = pt.pos[i * 3 + 1]; v[i * 8 + 2] = pt.pos[i * 3 + 2];
          v[i * 8 + 3] = pt.nrm[i * 3]; v[i * 8 + 4] = pt.nrm[i * 3 + 1]; v[i * 8 + 5] = pt.nrm[i * 3 + 2];
          v[i * 8 + 6] = pt.uv[i * 2]; v[i * 8 + 7] = pt.uv[i * 2 + 1];
          top = Math.max(top, pt.pos[i * 3 + 1], Math.abs(pt.pos[i * 3]), Math.abs(pt.pos[i * 3 + 2]));
        }
        tris += pt.idx.length / 3;
        const vao = gl.createVertexArray();
        gl.bindVertexArray(vao);
        const vbuf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, vbuf);
        gl.bufferData(gl.ARRAY_BUFFER, v, gl.STATIC_DRAW);
        gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 32, 0);
        gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 32, 12);
        gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 32, 24);
        const ibuf = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibuf);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, pt.idx, gl.STATIC_DRAW);
        gl.bindBuffer(gl.ARRAY_BUFFER, inst);
        gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3, 4, gl.FLOAT, false, 16, 0);
        gl.vertexAttribDivisor(3, 1);
        gl.bindVertexArray(null);
        const img = pt.image || { width: 1, height: 1, data: new Uint8Array([60, 90, 40, 255]) };
        // pieces with the same picture share one texture when a cache is given (the tile models)
        let tex = texCache && pt.image ? texCache.get(pt.image) : null;
        if (!tex) {
          tex = gl.createTexture();
          gl.bindTexture(gl.TEXTURE_2D, tex);
          gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.SRGB8_ALPHA8, img.width, img.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, img.data);
          gl.generateMipmap(gl.TEXTURE_2D);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
          if (texCache && pt.image) texCache.set(pt.image, tex);
        }
        if(texCache&&pt.image){texCache.refs ||= new Map();texCache.refs.set(tex,(texCache.refs.get(tex)||0)+1);}
        return { vao, vbuf, ibuf, tex, count: pt.idx.length, src: pt.image || null, texCache:pt.image?texCache:null };
      });
      return { parts, inst, top, tris, start: null, n: 0, bounds:window.SceneryPerformance?.bounds(src) };
    }

    _freeModels(list) {
      const gl = this.gl;
      for (const m of list) {
        gl.deleteBuffer(m.inst);
        for (const t of m.parts) {
          gl.deleteVertexArray(t.vao); gl.deleteBuffer(t.vbuf); gl.deleteBuffer(t.ibuf);
          const pool=t.texCache;
          if(pool?.refs){const n=(pool.refs.get(t.tex)||1)-1;if(n>0)pool.refs.set(t.tex,n);else{pool.refs.delete(t.tex);if(pool.get(t.src)===t.tex)pool.delete(t.src);gl.deleteTexture(t.tex);}}
          else gl.deleteTexture(t.tex);
        }
      }
    }

    // Campaign pieces (settlements, ports, forts, resources, faction symbols): models as setTreeModels takes
    // them, and lists[i] of (map x, map y, turn, size) for model i.
    setPieceModels(models) {
      this._initTrees();
      this.sceneryStart = null;
      this._freeModels(this.pieceModels || []);
      this._pieceTextureCache ||= new Map();
      this.pieceModels = models.map((src) => this._gpuModel(src,this._pieceTextureCache));
      this._pieceSources = models.slice();
      this.dirty = true;
    }

    // Keep the campaign's uploaded models while editing a handful of local components.
    setSceneryModels(models) {
      this._initTrees();
      const old=this.pieceModels||[],sources=this._pieceSources||[],gl=this.gl,kept=new Set();
      this.pieceModels=models.map((src,i)=>{
        if(sources[i]===src&&old[i]){kept.add(old[i]);return old[i];}
        const gpu=old[i],before=sources[i];
        if(gpu&&before&&before.parts.length===src.parts.length&&src.parts.every((pt,j)=>pt.image===before.parts[j].image&&pt.pos.length===before.parts[j].pos.length&&pt.idx===before.parts[j].idx)){
          src.parts.forEach((pt,j)=>{
            const verts=new Float32Array(pt.pos.length/3*8);
            for(let k=0;k<pt.pos.length/3;k++){verts.set(pt.pos.subarray(k*3,k*3+3),k*8);verts.set(pt.nrm.subarray(k*3,k*3+3),k*8+3);verts.set(pt.uv.subarray(k*2,k*2+2),k*8+6);}
            gl.bindBuffer(gl.ARRAY_BUFFER,gpu.parts[j].vbuf);gl.bufferSubData(gl.ARRAY_BUFFER,0,verts);
          });
          gpu.bounds=window.SceneryPerformance?.bounds(src);kept.add(gpu);return gpu;
        }
        return this._gpuModel(src,this._pieceTextureCache ||= new Map());
      });
      this._freeModels(old.filter(m=>!kept.has(m)));
      this._pieceSources=models.slice();this.dirty=true;
    }

    setPieceInstances(lists) {
      const gl = this.gl;
      (this.pieceModels || []).forEach((m, i) => {
        const d = lists[i] || new Float32Array(0);
        m.allInstances=d;
        if(!window.SceneryPerformance?.same(m.uploadedInstances,d)){
          gl.bindBuffer(gl.ARRAY_BUFFER,m.inst);gl.bufferData(gl.ARRAY_BUFFER,d,gl.DYNAMIC_DRAW);m.uploadedInstances=d;
        }
        m.n=d.length/4;
      });
      this.dirty = true;
    }

    // Tile models (map.rwm, see app.js loadTileModels). parts: [{ kind: 'under' | 'water' | 'over', pos, nrm, uv,
    // idx, image, upN, fit, page: { name, col, row (from the top), turns, across, up } or null, inst: Float32Array of
    // (map x, map y, turn, 0) }]; pages: { name: picture }; cover: a byte a tile (top row first), 1 where an
    // underlay replaces the ground. null clears them.
    setTileModels(t) {
      const gl = this.gl;
      // the same pieces as before (the River tool redrawing): only where they stand changes
      const keep = t ? t.parts.filter((pt) => pt.idx.length) : [];
      // gen changes when the pictures are read again (a tile picture changed on disk), so they are uploaded anew
      const sig = keep.map((pt) => `${pt.key || '?'}#${pt.gen || 0}`).join('|');
      if (t && sig && sig === this._tileSig && this.tileParts && this.tileParts.length === keep.length) {
        keep.forEach((pt, i) => {
          const m = this.tileParts[i];
          gl.bindBuffer(gl.ARRAY_BUFFER, m.inst);
          gl.bufferData(gl.ARRAY_BUFFER, pt.inst, gl.DYNAMIC_DRAW);
          m.n = pt.inst.length / 4;
        });
        this.tileHasRivers = this.tileParts.some((m) => m.kind === 'water' && m.n);
        this.tileCover = t.cover || null;
        this._applyCover();
        this.dirty = true;
        return;
      }
      this._tileSig = t ? sig : '';
      this._freeModels(this.tileParts || []);
      for (const tx of Object.values(this.tilePages || {})) gl.deleteTexture(tx);
      this.tileParts = []; this.tilePages = {};
      if (t) {
        for (const [name, img] of Object.entries(t.pages || {})) {
          const tx = gl.createTexture();
          gl.bindTexture(gl.TEXTURE_2D, tx);
          gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, img.width, img.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, img.data);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
          this.tilePages[name] = tx;
        }
        const texCache = new Map();
        this.tileParts = keep.map((pt) => {
          const m = this._gpuModel({ parts: [pt] }, texCache);
          gl.bindBuffer(gl.ARRAY_BUFFER, m.inst);
          gl.bufferData(gl.ARRAY_BUFFER, pt.inst, gl.STATIC_DRAW);
          return Object.assign(m, { n: pt.inst.length / 4, kind: pt.kind, upN: !!pt.upN, fit: !!pt.fit, page: pt.page || null });
        });
      }
      this.tileHasRivers = this.tileParts.some((m) => m.kind === 'water' && m.n);
      this.tileCover = t && t.cover ? t.cover : null;
      this._applyCover();
      this.dirty = true;
    }

    // a tile model picture recoloured (Map colour panel): its texture gets the new pixels, the pieces stay
    retintTileImage(oldImg, newImg) {
      const gl = this.gl, done = new Set();
      for (const m of this.tileParts || []) for (const t of m.parts) {
        if (t.src !== oldImg) continue;
        if (!done.has(t.tex)) {
          gl.bindTexture(gl.TEXTURE_2D, t.tex);
          gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.SRGB8_ALPHA8, newImg.width, newImg.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, newImg.data);
          gl.generateMipmap(gl.TEXTURE_2D);
          done.add(t.tex);
        }
        t.src = newImg;
      }
      this.dirty = true;
      return done.size;
    }

    // tile models are drawn in the game look only
    _tilesOn() { return !!(this.opts.tileModels && this.tileParts && this.tileParts.length && this.gameLook() && this.progU); }

    _drawTiles(cam) {
      const gl = this.gl;
      if (!this._tilesOn()) return;
      const list = this.tileParts;
      const draw = (m) => {
        if (!m.n) return;
        const pt = m.parts[0];
        gl.bindVertexArray(pt.vao);
        gl.bindBuffer(gl.ARRAY_BUFFER, m.inst);
        gl.vertexAttribPointer(3, 4, gl.FLOAT, false, 16, 0);
        gl.drawElementsInstanced(gl.TRIANGLES, pt.count, gl.UNSIGNED_SHORT, 0, m.n);
      };
      const vsUniforms = (U, m) => {
        gl.uniformMatrix4fv(U.uMVP, false, cam.mvp);
        gl.uniform1f(U.uZS, this.zScale());
        gl.uniform1f(U.uYS, this.opts.exag);
        gl.uniform1i(U.uFit, m && m.fit ? 1 : 0);
        gl.uniform2i(U.uMap, this.mapW, this.mapH);
      };
      gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.depthMask(true);
      gl.disable(gl.BLEND);
      // underlays: the ground of their tiles
      gl.useProgram(this.progU);
      this._common(this.UU);
      for (const m of list) {
        if (m.kind !== 'under') continue;
        vsUniforms(this.UU, m);
        gl.uniform1i(this.UU.uUpN, m.upN ? 1 : 0);
        gl.uniform1i(this.UU.uLandFill, 1);
        draw(m);
      }
      // overlays lie on their underlays
      gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(-1, -4);
      if (list.some((m) => m.kind === 'water')) {
        this._seaSetup(this.progR, this.UR, cam);
        gl.uniform1i(this.UR.uRiver, 1);
        for (const m of list) if (m.kind === 'water') { vsUniforms(this.UR, m); draw(m); }
      }
      const over = list.filter((m) => m.kind === 'over');
      if (over.length) {
        const U = this.UO;
        gl.useProgram(this.progO);
        gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        [['uH', this.tex.h], ['uHF', this.tex.hf || this.tex.h], ['uFow', this.tex.fow]].forEach(([u, t], i) => {
          gl.activeTexture(gl.TEXTURE2 + i); gl.bindTexture(gl.TEXTURE_2D, t || null); if (U[u]) gl.uniform1i(U[u], 2 + i);
        });
        this._gameUniforms(U);
        if (U.uTex) gl.uniform1i(U.uTex, 0);
        if (U.uPage) gl.uniform1i(U.uPage, 1);
        for (const m of over) {
          vsUniforms(U, m);
          const pg = m.page, ptex = pg && this.tilePages[pg.name];
          gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, ptex || null);
          gl.uniform4f(U.uPageP, pg ? pg.col : 0, pg ? pg.row : 0, pg ? pg.turns : 0, ptex ? 1 : 0);
          gl.uniform2f(U.uPageN, pg ? pg.across : 1, pg ? pg.up : 1);
          gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, m.parts[0].tex);
          draw(m);
        }
      }
      gl.bindVertexArray(null);
      gl.disable(gl.POLYGON_OFFSET_FILL); gl.disable(gl.BLEND);
      gl.depthMask(true);
    }

    // lists[i]: Float32Array of (map x, map y, turn, size) for model i
    setTreeInstances(lists) {
      const gl = this.gl;
      const cw = Math.ceil(this.mapW / TREE_CHUNK), ch = Math.ceil(this.mapH / TREE_CHUNK), nc = cw * ch;
      const old = this.treeGrid;
      const g = old && old.cw === cw && old.ch === ch ? old : { cw, ch, hb: new Float32Array(nc * 2), hDirty: new Uint8Array(nc).fill(1) };
      g.tris = new Float64Array(nc); g.top = new Float32Array(nc);
      let total = 0;
      this.treeModels.forEach((m, mi) => {
        const data = lists[mi] || new Float32Array(0);
        const n = data.length / 4;
        const start = new Uint32Array(nc + 1), cid = new Uint32Array(n);
        for (let i = 0; i < n; i++) {
          const cx = Math.min(cw - 1, Math.max(0, Math.floor(data[i * 4] / TREE_CHUNK)));
          const cy = Math.min(ch - 1, Math.max(0, Math.floor(data[i * 4 + 1] / TREE_CHUNK)));
          const c = cy * cw + cx;
          cid[i] = c; start[c + 1]++;
          g.top[c] = Math.max(g.top[c], m.top * data[i * 4 + 3] * TREE_UNIT);
        }
        for (let c = 0; c < nc; c++) start[c + 1] += start[c];
        const fill = start.slice(0, nc), sorted = new Float32Array(n * 4);
        for (let i = 0; i < n; i++) {
          const j = fill[cid[i]]++ * 4, k = i * 4;
          sorted[j] = data[k]; sorted[j + 1] = data[k + 1]; sorted[j + 2] = data[k + 2]; sorted[j + 3] = data[k + 3];
        }
        // shuffle each block, so drawing the start of one thins it out evenly
        let h = 0x2545f491;
        for (let c = 0; c < nc; c++) {
          for (let i = start[c + 1] - 1; i > start[c]; i--) {
            h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d); h ^= h >>> 13;
            const j = start[c] + (h >>> 0) % (i - start[c] + 1);
            for (let k = 0; k < 4; k++) { const t = sorted[i * 4 + k]; sorted[i * 4 + k] = sorted[j * 4 + k]; sorted[j * 4 + k] = t; }
          }
        }
        gl.bindBuffer(gl.ARRAY_BUFFER, m.inst);
        gl.bufferData(gl.ARRAY_BUFFER, sorted, gl.STATIC_DRAW);
        m.start = start; m.n = n;
        for (let c = 0; c < nc; c++) g.tris[c] += (start[c + 1] - start[c]) * m.tris;
        total += n;
      });
      this.treeGrid = g;
      this.treeStats.total = total;
      this.dirty = true;
    }

    // lowest and highest ground in a culling block, in world units
    _chunkHeights(c) {
      const g = this.treeGrid;
      if (g.hDirty[c]) {
        const W = this.mapW, D = this.heights;
        const x0 = (c % g.cw) * TREE_CHUNK, y0 = Math.floor(c / g.cw) * TREE_CHUNK;
        let lo = Infinity, hi = -Infinity;
        for (let y = y0; y <= Math.min(this.mapH - 1, y0 + TREE_CHUNK); y++)
          for (let x = x0; x <= Math.min(W - 1, x0 + TREE_CHUNK); x++) { const h = D[y * W + x]; if (h < lo) lo = h; if (h > hi) hi = h; }
        g.hb[c * 2] = lo; g.hb[c * 2 + 1] = hi; g.hDirty[c] = 0;
      }
      return [this._y(g.hb[c * 2]), this._y(g.hb[c * 2 + 1])];
    }

    // Which culling blocks to draw this frame, nearest first, within the triangle budget.
    _treeBlocks(cam) {
      const g = this.treeGrid;
      if (!g) return [];
      const nc = g.cw * g.ch, out = [];
      if (cam) {
        const m = cam.mvp, planes = [];
        for (const [i, sg] of [[0, 1], [0, -1], [1, 1], [1, -1], [2, 1], [2, -1]])
          planes.push([m[3] + sg * m[i], m[7] + sg * m[4 + i], m[11] + sg * m[8 + i], m[15] + sg * m[12 + i]]);
        const pxPerUnit = this.canvas.height / 2 / cam.tanH;
        for (let c = 0; c < nc; c++) {
          if (!g.tris[c]) continue;
          const x0 = (c % g.cw) * TREE_CHUNK, z0 = Math.floor(c / g.cw) * TREE_CHUNK;
          const [lo, hi0] = this._chunkHeights(c), hi = hi0 + g.top[c];
          const mn = [x0, lo, z0], mx = [x0 + TREE_CHUNK, hi, z0 + TREE_CHUNK];
          let inside = true;
          for (const p of planes) {
            if (p[0] * (p[0] > 0 ? mx[0] : mn[0]) + p[1] * (p[1] > 0 ? mx[1] : mn[1]) + p[2] * (p[2] > 0 ? mx[2] : mn[2]) + p[3] < 0) { inside = false; break; }
          }
          if (!inside) continue;
          const e = cam.eye;
          const dx = Math.max(mn[0] - e[0], 0, e[0] - mx[0]), dy = Math.max(mn[1] - e[1], 0, e[1] - mx[1]), dz = Math.max(mn[2] - e[2], 0, e[2] - mx[2]);
          const d = Math.hypot(dx, dy, dz);
          // trees smaller than about a pixel on screen aren't worth drawing, and small ones are thinned out
          const px = g.top[c] / Math.max(d, 1e-3) * pxPerUnit;
          if (px < 1.2) continue;
          out.push({ c, d, f: Math.min(1, Math.max(0.2, (px - 1) / 5)) });
        }
      } else {
        const s = this.view.scale;
        let top = 0;
        for (const m of this.treeModels) top = Math.max(top, m.top * TREE_UNIT);
        if (top * s < 2.5) return [];
        const mx0 = -this.view.x / s, my0 = -this.view.y / s;
        const mx1 = (this.canvas.width - this.view.x) / s, my1 = (this.canvas.height - this.view.y) / s;
        const cx = (mx0 + mx1) / 2, cy = (my0 + my1) / 2;
        const pad = 2;
        for (let by = Math.max(0, Math.floor((my0 - pad) / TREE_CHUNK)); by <= Math.min(g.ch - 1, Math.floor((my1 + pad) / TREE_CHUNK)); by++) {
          for (let bx = Math.max(0, Math.floor((mx0 - pad) / TREE_CHUNK)); bx <= Math.min(g.cw - 1, Math.floor((mx1 + pad) / TREE_CHUNK)); bx++) {
            const c = by * g.cw + bx;
            if (g.tris[c]) out.push({ c, d: Math.hypot((bx + 0.5) * TREE_CHUNK - cx, (by + 0.5) * TREE_CHUNK - cy), f: 1 });
          }
        }
      }
      out.sort((a, b) => a.d - b.d);
      const pick = [];
      let tris = 0;
      for (const o of out) {
        const t = g.tris[o.c] * o.f;
        if (tris && tris + t > this.opts.treeBudget) break;
        tris += t;
        pick.push(o);
      }
      return pick.sort((a, b) => a.c - b.c);
    }

    _drawTrees(cam) {
      const gl = this.gl;
      this.treeStats.drawn = 0;
      if (!this.opts.trees || this.opts.mode !== 0 || !this.progT || !this.treeGrid || !this.treeModels.length) return;
      const blocks = this._treeBlocks(cam);
      if (!blocks.length) return;
      this._modelSetup(cam, this.opts.treeBrightness == null ? 1 : this.opts.treeBrightness, this.opts.treeMat);
      let drawn = 0;
      // neighbouring whole blocks sit next to each other in the buffers, so a run of them is one draw;
      // a thinned block draws the start of its (shuffled) list
      const runs = [];
      for (let i = 0; i < blocks.length;) {
        let j = i;
        if (blocks[i].f >= 1) while (j + 1 < blocks.length && blocks[j + 1].f >= 1 && blocks[j + 1].c === blocks[j].c + 1) j++;
        runs.push([blocks[i].c, blocks[j].c + 1, blocks[i].f]);
        i = j + 1;
      }
      for (const m of this.treeModels) {
        if (!m.n) continue;
        for (const pt of m.parts) {
          gl.bindTexture(gl.TEXTURE_2D, pt.tex);
          gl.bindVertexArray(pt.vao);
          gl.bindBuffer(gl.ARRAY_BUFFER, m.inst);
          for (const [c0, c1, f] of runs) {
            const a = m.start[c0], b = m.start[c1], n = f >= 1 ? b - a : Math.ceil((b - a) * f);
            if (n <= 0) continue;
            gl.vertexAttribPointer(3, 4, gl.FLOAT, false, 16, a * 16);
            gl.drawElementsInstanced(gl.TRIANGLES, pt.count, gl.UNSIGNED_SHORT, 0, n);
            if (pt === m.parts[0]) drawn += n;
          }
        }
      }
      gl.bindVertexArray(null);
      gl.disable(gl.DEPTH_TEST);
      this.treeStats.drawn = drawn;
    }

    // Keep every placement, but upload and draw only instances intersecting the view.
    _drawPieces(cam) {
      const gl = this.gl, list = this.pieceModels;
      const perf=window.SceneryPerformance;
      const stats=this.sceneryStats={total:0,visible:0,drawCalls:0,triangles:0};
      if(perf&&list){
        const planes=cam?perf.planes(cam.mvp):null;
        for(const m of list){
          const all=m.allInstances;if(!all)continue;
          stats.total+=all.length/4;
          const kept=[],b=m.bounds||{center:[0,0,0],radius:m.top*1.74};
          for(let j=0;j<all.length;j+=4){
            const scale=all[j+3]*TREE_UNIT,c=Math.cos(all[j+2]),s=Math.sin(all[j+2]),x=all[j]+scale*(c*b.center[0]-s*b.center[2]),z=all[j+1]+scale*(s*b.center[0]+c*b.center[2]),r=Math.abs(scale)*b.radius;
            const seen=planes?perf.visible(planes,x,Math.max(0,this.heightAt(all[j],all[j+1]))*this.zScale()+scale*b.center[1],z,r):((x+r)*this.view.scale+this.view.x>=0&&(x-r)*this.view.scale+this.view.x<=this.canvas.width&&(z+r)*this.view.scale+this.view.y>=0&&(z-r)*this.view.scale+this.view.y<=this.canvas.height);
            if(seen)kept.push(all[j],all[j+1],all[j+2],all[j+3]);
          }
          if(!perf.same(m.uploadedInstances,kept)){const d=new Float32Array(kept);gl.bindBuffer(gl.ARRAY_BUFFER,m.inst);gl.bufferData(gl.ARRAY_BUFFER,d,gl.DYNAMIC_DRAW);m.uploadedInstances=d;}
          m.n=kept.length/4;stats.visible+=m.n;
        }
      }
      const ordinary = this.opts.pieces && this.opts.mode === 0;
      const scenery = !!cam && Number.isInteger(this.sceneryStart);
      if ((!ordinary && !scenery) || !this.progT || !list || !list.some((m) => m.n)) return;
      this._modelSetup(cam, 1);
      for (let i = 0; i < list.length; i++) {
        if (!ordinary && i < this.sceneryStart) continue;
        const m = list[i];
        if (!m.n) continue;
        for (const pt of m.parts) {
          gl.bindTexture(gl.TEXTURE_2D, pt.tex);
          gl.bindVertexArray(pt.vao);
          gl.bindBuffer(gl.ARRAY_BUFFER, m.inst);
          gl.vertexAttribPointer(3, 4, gl.FLOAT, false, 16, 0);
          gl.drawElementsInstanced(gl.TRIANGLES, pt.count, gl.UNSIGNED_SHORT, 0, m.n);
          stats.drawCalls++;stats.triangles+=pt.count/3*m.n;
        }
      }
      gl.bindVertexArray(null);
      gl.disable(gl.DEPTH_TEST);
    }

    // the model program's state for this frame: camera (null in the flat view), lights, shadows, fog
    _modelSetup(cam, gain, tmat) {
      const gl = this.gl;
      let mvp;
      if (cam) mvp = cam.mvp;
      else {
        const W = this.canvas.width, H = this.canvas.height, s = this.view.scale;
        mvp = new Float32Array([2 * s / W, 0, 0, 0, 0, 0, -0.02, 0, 0, -2 * s / H, 0, 0, 2 * this.view.x / W - 1, 1 - 2 * this.view.y / H, 0, 1]);
        gl.clearDepth(1); gl.clear(gl.DEPTH_BUFFER_BIT);
      }
      gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.depthMask(true);
      gl.disable(gl.BLEND);
      gl.useProgram(this.progT);
      const U = this.UT, o = this.opts;
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.tex.h);
      gl.uniform1i(U.uH, 0); gl.uniform1i(U.uTex, 1);
      gl.uniform2i(U.uMap, this.mapW, this.mapH);
      gl.uniformMatrix4fv(U.uMVP, false, mvp);
      gl.uniform1f(U.uZS, cam ? this.zScale() : 0);
      const game = !!cam && this.gameLook();
      if (game) {
        const g = o.gameLight, L = this._sunGame();
        gl.uniform3f(U.uSun, L[0], L[1], -L[2]);
        // trees are campaign pieces: the engine lights them with piece_ambient/piece_diffuse_colour
        gl.uniform3fv(U.uAmbient, g.pieceAmbient || [0.6121, 0.6121, 0.6462]);
        gl.uniform3fv(U.uDiffuse, g.pieceDiffuse || [0.6718, 0.6718, 0.6128]);
        this._gameUniforms(U);
      } else {
        const az = o.sunAz * Math.PI / 180, el = o.sunEl * Math.PI / 180;
        gl.uniform3f(U.uSun, Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el));
        gl.uniform3fv(U.uAmbient, o.ambient);
        gl.uniform3fv(U.uDiffuse, o.diffuse);
      }
      gl.uniform1i(U.uGame, game ? 1 : 0);
      gl.uniform1f(U.uShadowStr, game && this.hfRender ? o.gameLight.shadow : 0);
      gl.uniform1f(U.uExposure, o.exposure);
      gl.uniform1f(U.uTreeGain, gain);
      gl.uniform3fv(U.uTreeMatch, game && o.treeMatch ? o.treeMatch : [1, 1, 1]);
      // tmat is row-major; GLSL wants columns
      gl.uniform1i(U.uTAdjOn, tmat ? 1 : 0);
      if (tmat) {
        gl.uniformMatrix3fv(U.uTAdj, false, [tmat[0], tmat[3], tmat[6], tmat[1], tmat[4], tmat[7], tmat[2], tmat[5], tmat[8]]);
        gl.uniform2f(U.uTAdjC, o.treeContrast || 1, o.groundPivot || 0.35);
      }
      gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, (game && this.tex.hf) || this.tex.h);
      gl.uniform1i(U.uHF, 2);
      gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, this.tex.fow || null);
      gl.uniform1i(U.uFow, 3);
      gl.activeTexture(gl.TEXTURE1);
    }

    // ---------------------------------------------------------------- drawing
    _common(U) {
      const gl = this.gl;
      const units = [['uGT', 'gt', gl.TEXTURE_2D], ['uCL', 'cl', gl.TEXTURE_2D], ['uLUT', 'lut', gl.TEXTURE_2D], ['uH', 'h', gl.TEXTURE_2D],
        ['uRegion', 'region', gl.TEXTURE_2D], ['uFeat', 'feat', gl.TEXTURE_2D], ['uGTCol', 'gtcol', gl.TEXTURE_2D], ['uCLCol', 'clcol', gl.TEXTURE_2D],
        ['uArr', 'arr', gl.TEXTURE_2D_ARRAY]];
      units.forEach(([u, t, target], i) => {
        gl.activeTexture(gl.TEXTURE0 + i);
        gl.bindTexture(target, this.tex[t] || null);
        if (U[u]) gl.uniform1i(U[u], i);
      });
      // guides on the units after those
      const T = new Float32Array(16), R = new Float32Array(8), A = new Float32Array(4);
      for (let k = 0; k < 4; k++) {
        const g = this.guides[k];
        gl.activeTexture(gl.TEXTURE0 + units.length + k);
        gl.bindTexture(gl.TEXTURE_2D, (g && g.tex) || this._noGuide);
        if (U['uOv' + k]) gl.uniform1i(U['uOv' + k], units.length + k);
        if (!g || !g.tex) continue;
        T.set([g.cx, g.cy, Math.max(1e-3, g.w), Math.max(1e-3, g.h)], k * 4);
        R.set([Math.cos(g.ang), Math.sin(g.ang)], k * 2);
        A[k] = g.alpha;
      }
      if (U.uOvT) gl.uniform4fv(U.uOvT, T);
      if (U.uOvR) gl.uniform2fv(U.uOvR, R);
      if (U.uOvA) gl.uniform1fv(U.uOvA, A);
      // matcap, colour grid and game look textures on the units after the guides, only those the shader uses
      let next = units.length + 4;
      [['uMC', 'matcap', gl.TEXTURE_2D], ['uCG', 'cgrid', gl.TEXTURE_2D], ['uHF', 'hf', gl.TEXTURE_2D], ['uFow', 'fow', gl.TEXTURE_2D], ['uTW', 'tw', gl.TEXTURE_2D_ARRAY]].forEach(([u, t, target]) => {
        if (!U[u]) return;
        const unit = next++;
        gl.activeTexture(gl.TEXTURE0 + unit);
        gl.bindTexture(target, this.tex[t] || null);
        gl.uniform1i(U[u], unit);
      });
      this._gameUniforms(U);
      const o = this.opts;
      const set = (name, fn, ...v) => { if (U[name]) gl[fn](U[name], ...v); };
      set('uMap', 'uniform2i', this.mapW, this.mapH);
      set('uTexScale', 'uniform1f', o.texScale * 2);
      // o.groundMat is row-major; GLSL wants columns
      const gm = o.groundMat;
      set('uGAdjOn', 'uniform1i', gm ? 1 : 0);
      if (gm) set('uGAdj', 'uniformMatrix3fv', false, [gm[0], gm[3], gm[6], gm[1], gm[4], gm[7], gm[2], gm[5], gm[8]]);
      set('uGAdjC', 'uniform2f', o.groundContrast || 1, o.groundPivot || 0.35);
      const sm = o.seaMat;
      set('uSAdjOn', 'uniform1i', sm ? 1 : 0);
      if (sm) set('uSAdj', 'uniformMatrix3fv', false, [sm[0], sm[3], sm[6], sm[1], sm[4], sm[7], sm[2], sm[5], sm[8]]);
      set('uSAdjC', 'uniform2f', o.seaContrast || 1, o.groundPivot || 0.35);
      set('uRelief', 'uniform1f', o.relief * 0.012);
      const az = o.sunAz * Math.PI / 180, el = o.sunEl * Math.PI / 180;
      // azimuth measured clockwise from north (screen up); map y grows downward
      set('uLight', 'uniform3f', Math.sin(az) * Math.cos(el), Math.cos(az) * Math.cos(el), Math.sin(el));
      set('uAmbient', 'uniform3fv', o.ambient);
      set('uDiffuse', 'uniform3fv', o.diffuse);
      set('uExposure', 'uniform1f', o.exposure);
      set('uMode', 'uniform1i', o.mode);
      {
        const c = o.is3D ? this._camera() : null;
        if (c) { set('uVR', 'uniform3fv', c.right); set('uVU', 'uniform3fv', c.up); }
        else { set('uVR', 'uniform3f', 1, 0, 0); set('uVU', 'uniform3f', 0, 0, -1); }  // 2D: looking straight down, north up
      }
      set('uMZ', 'uniform1f', this.zScale());
      set('uCav', 'uniform1i', o.cavity ? 1 : 0);
      set('uCavS', 'uniform1f', o.cavityStrength == null ? 1 : o.cavityStrength);
      set('uCGRep', 'uniform1f', (o.gridTiles || 32) * 2);
      set('uMask', 'uniform1i', o.mask || 0);
      set('uMaskThr', 'uniform1f', o.maskThr || 0);
      set('uMaskH', 'uniform2f', o.maskLo ?? -1e9, o.maskHi ?? 1e9);
      set('uMaskSoft', 'uniform1f', o.maskSoft || 0);
      set('uBorders', 'uniform1i', o.borders ? 1 : 0);
      // with the tile models drawn, rivers are their water, not marked squares
      set('uRivers', 'uniform1i', o.rivers && !(this.tileHasRivers && this._tilesOn()) ? 1 : 0);
      set('uGrid', 'uniform1i', o.grid ? 1 : 0);
      set('uClimateTint', 'uniform1i', o.climateTint ? 1 : 0);
      set('uHeightBlend', 'uniform1i', o.heightBlend ? 1 : 0);
      set('uSettlements', 'uniform1i', o.settlements ? 1 : 0);
      set('uSea', 'uniform1i', o.sea ? 1 : 0);
      set('uIs3D', 'uniform1i', o.is3D ? 1 : 0);
      set('uHMin', 'uniform1f', this.hMin || -1);
      set('uHMax', 'uniform1f', this.hMax || 1);
      set('uHilite', 'uniform1i', o.hilite);
      set('uTime', 'uniform1f', (this._time || 0) / 1000);
    }

    // lighting, tone curve and fog of war uniforms of the game look
    _gameUniforms(U) {
      const gl = this.gl, o = this.opts, g = o.gameLight, tm = o.tonemap;
      const set = (name, fn, ...v) => { if (U[name]) gl[fn](U[name], ...v); };
      const L = this._sunGame();
      set('uGExpo', 'uniform1f', g.exposure == null ? 1 : g.exposure);
      set('uGAlb', 'uniform1f', g.albedo || 1);
      set('uTm', 'uniform4f', tm.peak, tm.contrast, tm.linearStart, tm.linearLength);
      set('uTmToe', 'uniform1f', tm.toe);
      set('uGAmb', 'uniform3fv', g.ambient);
      set('uGSun', 'uniform4f', g.sun[0], g.sun[1], g.sun[2], this.hfRender ? g.shadow : 0);
      set('uGL', 'uniform3f', L[0], L[1], L[2]);
      // ambient occlusion as the engine sets it (AoParams = 2/W, 2/H, strength, 0.5 on its 4-texel-per-tile
      // height field): one map vertex per step, radii 1, 2, 4 and 8 vertices, heights over 0.5 world units
      set('uGAo', 'uniform4f', 1, 1, g.ao, 0.5);
      set('uHaze', 'uniform4f', 0.391573, 0.351533, 0.287441, this.fogOn ? 1 : 0);
      set('uTWn', 'uniform1i', this.twCount || 0);
      set('uTMOn', 'uniform1i', this.tileCoverOK && this._tilesOn() ? 1 : 0);
      set('uGroundRep', 'uniform1f', o.texScale * 2);
    }

    draw(time) {
      const gl = this.gl;
      if (!this.tex.gt || !this.tex.arr) return;
      this._time = time;
      this.resize();
      if (this._mipsPending) {
        gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.tex.arr);
        gl.generateMipmap(gl.TEXTURE_2D_ARRAY);
        this._mipsPending = false;
      }
      gl.viewport(0, 0, this.canvas.width, this.canvas.height);
      if (this.opts.is3D && this.prog3d) { this._draw3D(); this._drawFogMask(this._camera()); } else { this._draw2D(); this._drawFogMask(null); }
      this.dirty = false;
    }

    _draw2D() {
      const gl = this.gl;
      gl.disable(gl.DEPTH_TEST); gl.disable(gl.BLEND);
      gl.useProgram(this.prog2d);
      this._common(this.U2);
      gl.uniform2f(this.U2.uCanvas, this.canvas.width, this.canvas.height);
      gl.uniform3f(this.U2.uView, this.view.x, this.view.y, this.view.scale);
      gl.bindVertexArray(this.vao2d);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      gl.bindVertexArray(null);
      this._drawTrees(null);
      this._drawPieces(null);
    }

    // true while the 3D view draws the game's look (textured view, setting on, shaders built)
    gameLook() { return !!(this.opts.is3D && this.opts.game && this.opts.mode === 0 && this.gameOK); }

    _drawSea(cam) {
      const gl = this.gl, U = this.US;
      gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL);
      // with the sea level overlay on, the sea is see-through so the sea bed shows
      if (this.opts.sea) { gl.enable(gl.BLEND); gl.blendFunc(gl.CONSTANT_ALPHA, gl.ONE_MINUS_CONSTANT_ALPHA); gl.blendColor(0, 0, 0, 0.55); gl.depthMask(false); }
      else { gl.disable(gl.BLEND); gl.depthMask(true); }
      this._seaSetup(this.progS, U, cam);
      if (U.uRiver) gl.uniform1i(U.uRiver, 0);
      gl.uniformMatrix4fv(U.uMVP, false, cam.mvp);
      gl.bindVertexArray(this.vaoW);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      gl.bindVertexArray(null);
      gl.depthMask(true);
      gl.disable(gl.BLEND); gl.disable(gl.DEPTH_TEST);
    }

    // the sea shader's textures and uniforms (the sea plane, and river water)
    _seaSetup(P, U, cam) {
      const gl = this.gl;
      gl.useProgram(P);
      const units = [['uH', 'h'], ['uWaves', 'waves'], ['uProbe', 'probe'], ['uWS', 'wsurf'], ['uFow', 'fow'], ['uGT', 'gt'], ['uCL', 'cl'], ['uLUT', 'lut']];
      units.forEach(([u, t], i) => {
        gl.activeTexture(gl.TEXTURE0 + i);
        gl.bindTexture(gl.TEXTURE_2D, this.tex[t] || null);
        if (U[u]) gl.uniform1i(U[u], i);
      });
      const set = (name, fn, ...v) => { if (U[name]) gl[fn](U[name], ...v); };
      set('uHasWaves', 'uniform1i', this.tex.waves ? 1 : 0);
      set('uHasProbe', 'uniform1i', this.tex.probe ? 1 : 0);
      set('uHasWS', 'uniform1i', this.tex.wsurf ? 1 : 0);
      set('uMap', 'uniform2i', this.mapW, this.mapH);
      set('uEye', 'uniform3f', cam.eye[0], cam.eye[1], cam.eye[2]);
      set('uScroll', 'uniform2f', 0, 0);
      set('uSeaGain', 'uniform1f', this.opts.seaGain == null ? 1.6 : this.opts.seaGain);
      this._gameUniforms(U);
    }

    _draw3D() {
      const gl = this.gl;
      const mesh = this._ensureMesh();
      const game = this.gameLook();
      if (game) this._computeHF();
      const cam = this._camera();
      gl.clearColor(BG[0], BG[1], BG[2], 1);
      gl.clearDepth(1);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.depthMask(true);
      gl.disable(gl.BLEND);
      const P = game ? this.progG : this.prog3d, U = game ? this.UG : this.U3;
      gl.useProgram(P);
      this._common(U);
      gl.uniform2i(U.uMesh, mesh.cols, mesh.rows);
      gl.uniform1i(U.uStride, mesh.stride);
      if (U.uGameMesh) gl.uniform1i(U.uGameMesh, game ? 1 : 0);
      gl.uniform1f(U.uZS, this.zScale());
      gl.uniformMatrix4fv(U.uMVP, false, cam.mvp);
      gl.bindVertexArray(this.vao3d);
      gl.drawElements(gl.TRIANGLES, mesh.count, gl.UNSIGNED_INT, 0);
      if (game) this._drawTiles(cam);
      this._drawTrees(cam);
      this._drawPieces(cam);
      if (game) { this._drawSea(cam); return; }
      if (this.opts.mode >= 5) { gl.disable(gl.DEPTH_TEST); return; }  // matcap and colour grid show the bare ground
      gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL);
      // water at sea level
      gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.depthMask(false);
      gl.useProgram(this.progW);
      this._common(this.UW);
      gl.uniformMatrix4fv(this.UW.uMVP, false, cam.mvp);
      gl.bindVertexArray(this.vaoW);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      gl.bindVertexArray(null);
      gl.depthMask(true);
      gl.disable(gl.BLEND); gl.disable(gl.DEPTH_TEST);
    }
  }

  window.MapView = MapView;
  MapView.LAYER_SIZE = LAYER_SIZE;
  MapView.WATER = WATER;
  MapView.MISSING = MISSING;
})();
