#!/usr/bin/env python3
"""
stratmapconverter.py  –  Debug / test tool for M2TW strat map .cas files
Mirrors the parsing logic in lib/stratCasCodec.js so you can verify
byte offsets, bone counts, mesh sizes against a known-good Python reader.

Usage:
    python stratmapconverter.py path/to/unit.cas
    python stratmapconverter.py path/to/unit.cas --export-ms3d  # also writes unit.ms3d

Requires only Python 3.6+ stdlib.
"""
import struct, sys, os, argparse

# ── Globals ────────────────────────────────────────────────────────────────────
KNOWN_VERSIONS = [3.02, 3.0, 2.23, 2.22, 3.12, 3.05, 2.19]
OLD_VERSIONS   = KNOWN_VERSIONS  # all known versions use the same bone layout (no extra uint/byte)
NEW_VERSIONS   = []              # extend here if a new version with extra uint+byte is found

# ── Binary reader helper ───────────────────────────────────────────────────────
class BinaryReader:
    def __init__(self, data):
        self.data = data
        self.pos  = 0

    def tell(self):   return self.pos
    def eof(self):    return self.pos >= len(self.data)
    def seek(self, n): self.pos += n

    def byte(self):
        v = struct.unpack_from('<B', self.data, self.pos)[0]; self.pos += 1; return v
    def sbyte(self):
        v = struct.unpack_from('<b', self.data, self.pos)[0]; self.pos += 1; return v
    def ushort(self):
        v = struct.unpack_from('<H', self.data, self.pos)[0]; self.pos += 2; return v
    def short(self):
        v = struct.unpack_from('<h', self.data, self.pos)[0]; self.pos += 2; return v
    def uint(self):
        v = struct.unpack_from('<I', self.data, self.pos)[0]; self.pos += 4; return v
    def int_(self):
        v = struct.unpack_from('<i', self.data, self.pos)[0]; self.pos += 4; return v
    def float_(self):
        v = struct.unpack_from('<f', self.data, self.pos)[0]; self.pos += 4; return v
    def read_string(self, n):
        s = self.data[self.pos:self.pos+n].decode('latin-1', errors='replace')
        self.pos += n; return s
    def read_floats(self, n):
        arr = list(struct.unpack_from(f'<{n}f', self.data, self.pos))
        self.pos += 4*n; return arr
    def peek_uint(self):
        return struct.unpack_from('<I', self.data, self.pos)[0]


# ── Header (42 bytes) ──────────────────────────────────────────────────────────
def read_header(r):
    pos0 = r.tell()
    float_version_raw = r.float_()
    # snap to known value
    float_version = float_version_raw
    for v in KNOWN_VERSIONS:
        if abs(float_version_raw - v) < 0.001:
            float_version = v; break

    int_thirtyeight = r.uint()
    int_nine        = r.uint()
    int_zero1       = r.uint()
    float_animtime  = r.float_()
    int_one1        = r.uint()
    int_zero2       = r.uint()
    sig1            = [r.byte(), r.byte(), r.byte()]
    int_one2        = r.uint()
    int_zero3       = r.uint()
    sig2            = [r.byte(), r.byte(), r.byte()]

    print(f"  Header @ offset 0:")
    print(f"    float_version     = {float_version_raw:.4f}  (snapped: {float_version})")
    print(f"    int_thirtyeight   = {int_thirtyeight}")
    print(f"    int_nine          = {int_nine}")
    print(f"    float_animtime    = {float_animtime:.4f}")
    print(f"    sig1              = {sig1}  ({bytes(sig1)})")
    print(f"    sig2              = {sig2}  ({bytes(sig2)})")
    print(f"    signaturebyte     = {sig2[0]}  ({'resource/symbol' if sig2[0]==99 else 'unit'})")
    print(f"    Header end offset = {r.tell()}")
    return float_version, sig2[0]


# ── filesizesans / int_zero ────────────────────────────────────────────────────
def read_post_header(r):
    filesizesans = r.uint()
    int_zero     = r.uint()
    print(f"  filesizesans = {filesizesans}, int_zero = {int_zero}  @ {r.tell()}")


# ── Hierarchy tree ─────────────────────────────────────────────────────────────
def read_hierarchy(r):
    pos = r.tell()
    nbones = r.uint()
    print(f"  nbones = {nbones}  @ offset {pos}")
    if nbones == 0 or nbones > 512:
        raise ValueError(f"Invalid nbones={nbones}")
    hierarchy = [r.uint() for _ in range(nbones)]
    print(f"  hierarchy = {hierarchy}  end @ {r.tell()}")
    return nbones, hierarchy


# ── Time ticks ─────────────────────────────────────────────────────────────────
def read_timeticks(r):
    nframes = r.uint()
    print(f"  nframes (timeticks) = {nframes}  @ {r.tell()}")
    if nframes > 10000:
        raise ValueError(f"nframes too large: {nframes}")
    ticks = [r.float_() for _ in range(nframes)]
    print(f"  timeticks end @ {r.tell()}")
    return ticks


# ── Bone section ───────────────────────────────────────────────────────────────
def read_bones(r, nbones, version_float):
    bonenames = []
    quatframes_per_bone = []
    animframes_per_bone = []
    ones_per_bone       = []

    for ii in range(nbones):
        pos = r.tell()
        nch = r.uint()
        if nch == 0 or nch > 256:
            raise ValueError(f"Invalid bone name length {nch} at bone {ii} (offset {pos})")
        name = r.read_string(nch - 1)
        r.byte()  # null terminator

        quatframes = r.uint()
        animframes = r.uint()
        quatoffset = r.uint()
        animoffset = r.uint()
        zero       = r.uint()

        one = 1
        # Only NEW versions (none currently known) read extra uint+byte here
        if version_float not in OLD_VERSIONS:
            one = r.uint()
            r.byte()  # byte1

        print(f"    Bone {ii:2d}: '{name}'  quatframes={quatframes} animframes={animframes} one={one}")
        bonenames.append(name)
        quatframes_per_bone.append(quatframes)
        animframes_per_bone.append(animframes)
        ones_per_bone.append(one)

    print(f"  Bone section end @ {r.tell()}")
    return bonenames, quatframes_per_bone, animframes_per_bone, ones_per_bone


# ── Regular chunk header ───────────────────────────────────────────────────────
def read_regular_chunk_header(r):
    pos = r.tell()
    chunklength = r.uint()
    one         = r.uint()
    two         = r.uint()
    numchars    = r.uint()
    name        = r.read_string(numchars - 1); r.byte()
    r.uint(); r.byte()   # uint + byte
    r.uint(); r.byte()   # uint + byte
    for _ in range(9): r.float_()   # 9 floats
    r.ushort(); r.int_(); r.ushort(); r.uint(); r.uint(); r.uint(); r.uint()
    nummeshes = r.uint()
    print(f"  RegularChunkHeader: chunklength={chunklength} name='{name}' nummeshes={nummeshes}  end @ {r.tell()}")
    return nummeshes


# ── Resource chunk header ──────────────────────────────────────────────────────
def read_resource_chunk_header(r):
    r.uint(); r.uint(); r.uint()
    numchars = r.uint()
    if numchars == 26:
        r.read_string(25); r.byte()
        r.uint(); r.byte(); r.uint(); r.byte()
        for _ in range(9): r.float_()
        r.ushort(); r.int_(); r.uint()
    else:
        r.pos -= 4  # seek back
    print(f"  ResourceChunkHeader end @ {r.tell()}")
    return 1


# ── One mesh block ─────────────────────────────────────────────────────────────
def read_one_mesh(r, flagresource, flagnavy):
    nch  = r.uint()
    name = r.read_string(nch - 1); r.byte()
    r.uint(); r.byte()   # comment uint + null
    if flagresource or flagnavy:
        r.uint(); r.byte(); r.uint()
    for _ in range(7): r.float_()

    numverts  = r.ushort()
    numfaces  = r.ushort()
    flagtverts  = r.byte()
    flagvcolors = r.byte()

    print(f"    Mesh '{name}': numverts={numverts} numfaces={numfaces} tverts={flagtverts} vcolors={flagvcolors}  @ {r.tell()}")

    boneids = []
    if flagresource or flagnavy:
        boneids = [-1] * numverts
    else:
        for _ in range(numverts): boneids.append(r.int_())

    verts   = r.read_floats(3 * numverts)
    normals = r.read_floats(3 * numverts)
    faces   = [r.ushort() for _ in range(3 * numfaces)]

    r.uint()  # texId
    tverts = r.read_floats(2 * numverts) if flagtverts == 1 else []
    if flagvcolors == 1:
        for _ in range(4 * numverts): r.sbyte()
    r.uint()  # terminating 0

    print(f"    Mesh '{name}' end @ {r.tell()}")
    return name, numverts, numfaces, boneids, verts, normals, faces, tverts, flagtverts == 1


# ── Main parse ─────────────────────────────────────────────────────────────────
def parse_cas(filepath, export_ms3d=False):
    with open(filepath, 'rb') as f:
        data = f.read()

    r = BinaryReader(data)
    print(f"\n=== Parsing: {os.path.basename(filepath)} ({len(data)} bytes) ===\n")

    # Header
    float_version, signaturebyte = read_header(r)
    flagresource = (signaturebyte == 99)
    flagnavy     = False  # set manually if needed
    print(f"  FLAGRESOURCE={flagresource} FLAGNAVY={flagnavy}\n")

    # Post-header padding
    read_post_header(r)

    # Hierarchy
    nbones, hierarchy = read_hierarchy(r)

    # Time ticks
    read_timeticks(r)

    # Bones
    bonenames, qfpb, afpb, opb = read_bones(r, nbones, float_version)

    # Float data blocks
    nquat  = sum(qfpb)
    nanim  = sum(afpb)
    npose  = sum(opb)
    print(f"\n  Float blocks: nquatframes={nquat}  nanimframes={nanim}  nposeframes={npose}")
    r.seek(nquat * 4 * 4)   # quat floats (4 floats each)
    r.seek(nanim * 3 * 4)   # anim floats (3 floats each)
    pose_start = r.tell()
    r.seek(npose * 3 * 4)   # pose floats (3 floats each)
    print(f"  Float data end @ {r.tell()}\n")

    # Chunk header
    if flagnavy:
        read_resource_chunk_header(r)   # reuse for now
        nummeshes = 1
    elif flagresource:
        nummeshes = read_resource_chunk_header(r)
    else:
        nummeshes = read_regular_chunk_header(r)

    print(f"\n  nummeshes = {nummeshes}")

    # Mesh blocks
    all_verts = []; all_normals = []; all_faces = []; all_tverts = []; all_boneids = []
    has_tverts = False
    mesh0name = "strat_model"
    nv_accum = 0

    for imesh in range(nummeshes):
        mname, nv, nf, bids, verts, norms, faces, tverts, htv = read_one_mesh(r, flagresource, flagnavy)
        if imesh == 0:
            mesh0name = mname; has_tverts = htv
        # offset faces
        all_faces  += [fi + nv_accum for fi in faces]
        all_verts  += verts
        all_normals+= norms
        all_boneids+= bids
        if htv: all_tverts += tverts
        nv_accum += nv

    total_verts = nv_accum
    total_faces = len(all_faces) // 3
    print(f"\n  TOTAL verts={total_verts} faces={total_faces}  parse end @ {r.tell()}")

    if export_ms3d:
        _export_ms3d(filepath, bonenames, hierarchy,
                     total_verts, total_faces,
                     all_verts, all_normals, all_faces, all_tverts, all_boneids, has_tverts)

    print(f"\n=== Done ===")


def _export_ms3d(src_path, bonenames, hierarchy,
                 nv, nf, verts, normals, faces, tverts, boneids, has_tverts):
    import struct
    out = src_path.replace('.cas', '.ms3d')
    with open(out, 'wb') as f:
        f.write(b'MS3D000000\x00\x00\x00\x00')  # 10-byte ID + 4-byte version = 14 bytes
        # This is a stub — full MS3D export is complex; this just confirms the counts.
        f.write(struct.pack('<H', nv))
        for i in range(nv):
            x = -verts[3*i]; y = verts[3*i+1]; z = verts[3*i+2]
            f.write(struct.pack('<Bfff', 0, x, y, z))
        f.write(struct.pack('<H', nf))
        for i in range(nf):
            i0 = faces[3*i]; i1 = faces[3*i+2]; i2 = faces[3*i+1]  # swap winding
            f.write(struct.pack('<HHHH', 0, i0, i1, i2))
    print(f"  Stub MS3D written to {out} (vertex/face counts only; not a full export)")


if __name__ == '__main__':
    ap = argparse.ArgumentParser(description='Debug M2TW strat .cas files')
    ap.add_argument('cas_file', help='Path to .cas file')
    ap.add_argument('--export-ms3d', action='store_true', help='Write a stub .ms3d for count verification')
    args = ap.parse_args()

    try:
        parse_cas(args.cas_file, export_ms3d=args.export_ms3d)
    except Exception as e:
        import traceback
        print(f"\nERROR: {e}")
        traceback.print_exc()
        sys.exit(1)
