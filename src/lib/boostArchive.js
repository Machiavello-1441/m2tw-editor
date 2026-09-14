/**
 * A cursor over a boost::serialization binary archive — which is what an M2TW
 * `.mesh` really is.
 *
 * The one subtlety that matters: `obj()` reads a pointer to a tracked object,
 * and it is TWO BYTES LONGER the first time a class id appears (the tracking
 * flag and the class version follow it). Miss that and every offset after the
 * first record is wrong — the shape of bug that leaves a parser producing
 * plausible-looking rubbish.
 */

export const BOOST_SIGNATURE = 'serialization::archive';

export class ArchiveError extends Error {}

export class BoostArchive {
  constructor(buffer, source = 'model') {
    this.d = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    this.view = new DataView(this.d.buffer, this.d.byteOffset, this.d.byteLength);
    this.p = 0;
    this.source = source;
    this.seen = new Set();
  }

  get length() { return this.d.length; }

  need(n) {
    if (this.p + n > this.d.length) {
      throw new ArchiveError(
        `${this.source} ends early: wanted ${n} more bytes at offset ${this.p} of ${this.d.length}`);
    }
  }

  u8()  { this.need(1); return this.d[this.p++]; }
  u16() { this.need(2); const v = this.view.getUint16(this.p, true);  this.p += 2; return v; }
  u32() { this.need(4); const v = this.view.getUint32(this.p, true);  this.p += 4; return v; }
  f32() { this.need(4); const v = this.view.getFloat32(this.p, true); this.p += 4; return v; }

  peek16() {
    return this.p + 2 <= this.d.length ? this.view.getUint16(this.p, true) : -1;
  }

  /** A uint32 about to be used as a length. Guarded, so a corrupt word is a
   *  sentence rather than a gigabyte allocation. */
  count(what, max = 4000000) {
    const n = this.u32();
    if (n > max) {
      throw new ArchiveError(
        `${this.source} asks for ${n.toLocaleString()} ${what} at offset ${this.p - 4} — not a model file this tool understands`);
    }
    return n;
  }

  /** A length-prefixed string, latin-1. */
  text() {
    const n = this.count('characters', 65536);
    this.need(n);
    let s = '';
    for (let i = 0; i < n; i++) s += String.fromCharCode(this.d[this.p + i]);
    this.p += n;
    return s;
  }

  /** n raw bytes, as a copy (so typed-array views over it are aligned). */
  blob(n) {
    this.need(n);
    const out = this.d.slice(this.p, this.p + n);
    this.p += n;
    return out;
  }

  /**
   * A pointer to a tracked object; returns its class id.
   * A run of zero words can precede the class id (boost's optional-class-id
   * slots). No real class id is zero, so consuming them is unambiguous.
   */
  obj() {
    while (this.peek16() === 0) this.u16();
    const cid = this.u16();
    if (!this.seen.has(cid)) {
      this.seen.add(cid);
      this.u8();   // tracking level
      this.u8();   // class version
    }
    this.u32();    // object id
    return cid;
  }

  /**
   * A pointer to a class the archive has already introduced. Used after the
   * vertex streams, where the stream search skipped the preambles that would
   * have told `seen` about these classes.
   */
  ref() {
    while (this.peek16() === 0) this.u16();
    const cid = this.u16();
    this.u32();
    return cid;
  }

  atEnd() { return this.p >= this.d.length; }
}