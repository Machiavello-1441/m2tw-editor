// Format reference: Medieval2-GUI-Toolkit v2.4.0 (8634137), cas.py/casanim.py.
// Independent bounded reader for the documented little-endian layouts.
export default class CasBinaryReader {
  constructor(buffer) { this.view = new DataView(buffer); this.p = 0; }
  need(n) { if (n < 0 || this.p + n > this.view.byteLength) throw new Error(`Truncated CAS data at byte ${this.p}.`); }
  skip(n) { this.need(n); this.p += n; }
  u8() { this.need(1); return this.view.getUint8(this.p++); }
  u16() { this.need(2); const v = this.view.getUint16(this.p, true); this.p += 2; return v; }
  u32() { this.need(4); const v = this.view.getUint32(this.p, true); this.p += 4; return v; }
  i32() { this.need(4); const v = this.view.getInt32(this.p, true); this.p += 4; return v; }
  f32() { this.need(4); const v = this.view.getFloat32(this.p, true); this.p += 4; if (!Number.isFinite(v)) throw new Error('Non-finite CAS value.'); return v; }
  floats(n) { this.need(n * 4); return Array.from({ length: n }, () => this.f32()); }
  text() { const n = this.u32(); this.need(n); const end = this.p + n; let s = ''; while (this.p < end) { const c = this.u8(); if (c) s += String.fromCharCode(c); else break; } this.p = end; return s; }
  cstring() { let s = ''; for (;;) { const c = this.u8(); if (!c) return s; s += String.fromCharCode(c); } }
}