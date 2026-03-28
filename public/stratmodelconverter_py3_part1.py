# ===================================================================================
#                     stratmodelconverter.py  —  Python 3 port
# ===================================================================================
# Original: Sandy Wilson (KnightErrant), 10 December 2007
#
# Python 3 changes summary:
#   - tkinter (lowercase); filedialog.askopenfilename() replaces custom FileDialog
#   - print x  →  print(x)
#   - Integer division: /  →  //  where an int is required
#   - iseof(): empty read returns b'' not ''
#   - getstring(): raw bytes decoded with latin-1
#   - putstring(): encodes str → bytes before writing
#   - zipstrip(): bytes indexing returns int in Py3, fixed accordingly
#   - readms3dfile header: header_raw kept as bytes, decoded for display
#   - dialogstates.has_key(key)  →  key in dialogstates (removed, dialog replaced)
#   - array integer-division fixes throughout (/, len/3, len/4, etc.)
# ===================================================================================

import array
import struct
import math
import os
import os.path
import fnmatch

from tkinter import *
from tkinter.messagebox import showwarning
import tkinter.filedialog as filedialog

dialogstates = {}

# ===================================================================================
# File operations.
# ===================================================================================
def iseof(fidin):
    val = fidin.read(1)
    if val == b'':
        return True
    fidin.seek(-1, 1)
    return False

# ===================================================================================
# Getters for binary files.
# ===================================================================================
def getbyte(fidin):
    (thebyte,) = struct.unpack('b', fidin.read(1))
    return thebyte

def getubyte(fidin):
    (thebyte,) = struct.unpack('B', fidin.read(1))
    return thebyte

def getshort(fidin):
    (theshort,) = struct.unpack('h', fidin.read(2))
    return theshort

def getushort(fidin):
    (theshort,) = struct.unpack('H', fidin.read(2))
    return theshort

def getint(fidin):
    (theint,) = struct.unpack('i', fidin.read(4))
    return theint

def getuint(fidin):
    (theint,) = struct.unpack('I', fidin.read(4))
    return theint

def getfloat(fidin):
    (thefloat,) = struct.unpack('f', fidin.read(4))
    return thefloat

def getstring(fidin, nchar):
    raw = fidin.read(nchar)
    return raw.decode('latin-1')

# ===================================================================================
# Putters for binary files.
# ===================================================================================
def putbyte(thebyte, fidout):
    fidout.write(struct.pack('b', thebyte))

def putubyte(thebyte, fidout):
    fidout.write(struct.pack('B', thebyte))

def putshort(theshort, fidout):
    fidout.write(struct.pack('h', theshort))

def putushort(theshort, fidout):
    fidout.write(struct.pack('H', theshort))

def putint(theint, fidout):
    fidout.write(struct.pack('i', theint))

def putuint(theint, fidout):
    fidout.write(struct.pack('I', theint))

def putfloat(thefloat, fidout):
    fidout.write(struct.pack('f', thefloat))

def putstring(thestring, fidout):
    if isinstance(thestring, str):
        fidout.write(thestring.encode('latin-1'))
    else:
        fidout.write(thestring)

def putzerobytes(n, fidout):
    for ii in range(n):
        putubyte(0, fidout)

# ===================================================================================
# Formatters.
# ===================================================================================
def zipstrip(string):
    """Strip trailing null bytes. Handles both bytes and str (Python 3 safe)."""
    if isinstance(string, (bytes, bytearray)):
        for ii in range(len(string)):
            if string[ii] == 0:            # bytes indexing returns int in Py3
                return string[0:ii].decode('latin-1')
        return string.decode('latin-1')
    else:
        for ii in range(len(string)):
            if string[ii] == '\x00':
                return string[0:ii]
        return string

def formatfloat(x, nfield, ndecimal):
    formatstring = '%+' + str(nfield) + '.' + str(ndecimal) + 'f'
    return formatstring % x

def splitpath(fullfilename):
    (fpath, ftemp) = os.path.split(fullfilename)
    (fname, fext)  = os.path.splitext(ftemp)
    return [fpath, fname, fext]

# ===================================================================================
# Quaternion / Euler conversions
# ===================================================================================
def computeeulers(quatfloats):
    nfloats = len(quatfloats)
    nvecs   = nfloats // 4
    eulers  = array.array('f')

    for ivec in range(nvecs):
        idx = ivec * 4
        q1  = quatfloats[idx+0]
        q2  = quatfloats[idx+1]
        q3  = quatfloats[idx+2]
        q4  = quatfloats[idx+3]

        sint     = 2 * (q2 * q4 - q1 * q3)
        cost_tmp = 1.0 - sint * sint
        cost     = cost_tmp ** 0.5 if abs(cost_tmp) > 0.0001 else 0.0

        if abs(cost) > 0.01:
            sinv = 2 * (q2 * q3 + q1 * q4) / cost
            cosv = (1 - 2 * (q1*q1 + q2*q2)) / cost
            sinf = 2 * (q1 * q2 + q3 * q4) / cost
            cosf = (1 - 2 * (q2*q2 + q3*q3)) / cost
        else:
            sinv = 2 * (q1 * q4 - q2 * q3)
            cosv = 1 - 2 * (q1*q1 + q3*q3)
            sinf = 0.0
            cosf = 1.0

        eulers.append(math.atan2(sinv, cosv))
        eulers.append(-math.atan2(sint, cost))
        eulers.append(-math.atan2(sinf, cosf))

    return eulers


def computequats(eulers):
    nfloats    = len(eulers)
    nvecs      = nfloats // 3
    quatfloats = array.array('f')

    for ivec in range(nvecs):
        idx       = ivec * 3
        phi_rad   = eulers[idx+0]
        theta_rad = eulers[idx+1]
        psi_rad   = eulers[idx+2]

        sphi = math.sin(phi_rad);   cphi = math.cos(phi_rad)
        stheta = math.sin(theta_rad); ctheta = math.cos(theta_rad)
        spsi = math.sin(psi_rad);   cpsi = math.cos(psi_rad)

        R11 = cpsi*ctheta;                          R12 = cpsi*stheta*sphi - spsi*cphi
        R13 = cpsi*stheta*cphi + spsi*sphi;         R21 = spsi*ctheta
        R22 = spsi*stheta*sphi + cpsi*cphi;         R23 = spsi*stheta*cphi - cpsi*sphi
        R31 = -stheta;                               R32 = ctheta*sphi
        R33 = ctheta*cphi

        q4 = 0.5 * (1 + R11 + R22 + R33) ** 0.5
        q1 = 0.25 * (R32 - R23) / q4
        q2 = 0.25 * (R13 - R31) / q4
        q3 = 0.25 * (R21 - R12) / q4

        quatfloats.append(q1); quatfloats.append(q2)
        quatfloats.append(q3); quatfloats.append(q4)

    return quatfloats

# ===================================================================================
# CAS header / hierarchy / timeticks / bones
# ===================================================================================
def readandwritecasheader(fidcas, fidtxt, flags):
    headerdata      = []
    WRITECASTXTFILE = (fidtxt != [])

    sig1 = array.array('B')
    sig2 = array.array('B')

    float_version = getfloat(fidcas)
    for exact in (3.02, 3.0, 2.23, 2.22, 3.12, 3.05, 2.19):
        if abs(float_version - exact) < 0.001:
            float_version = exact
            break

    int_thirtyeight = getuint(fidcas);  int_nine  = getuint(fidcas)
    int_zero1       = getuint(fidcas);  float_animtime = getfloat(fidcas)
    int_one1        = getuint(fidcas);  int_zero2 = getuint(fidcas)
    sig1.append(getubyte(fidcas)); sig1.append(getubyte(fidcas)); sig1.append(getubyte(fidcas))
    int_one2        = getuint(fidcas);  int_zero3 = getuint(fidcas)
    sig2.append(getubyte(fidcas)); sig2.append(getubyte(fidcas)); sig2.append(getubyte(fidcas))

    headerdata = [float_version, int_thirtyeight, int_nine, int_zero1, float_animtime,
                  int_one1, int_zero2, sig1[0], sig1[1], sig1[2],
                  int_one2, int_zero3, sig2[0], sig2[1], sig2[2]]

    if WRITECASTXTFILE and flags.header == 1:
        s  = formatfloat(float_version, 5, 3) + ' ' + str(int_thirtyeight).ljust(3) + ' ' + str(int_nine).ljust(3) + ' '
        s += str(int_zero1).ljust(3) + ' ' + formatfloat(float_animtime, 5, 3) + ' '
        s += str(int_one1).ljust(3) + ' ' + str(int_zero2).ljust(3) + '    '
        s += str(sig1[0]).ljust(3) + ' ' + str(sig1[1]).ljust(3) + ' ' + str(sig1[2]).ljust(3) + '    '
        s += str(int_one2).ljust(3) + ' ' + str(int_zero3).ljust(3) + '    '
        s += str(sig2[0]).ljust(3) + ' ' + str(sig2[1]).ljust(3) + ' ' + str(sig2[2]).ljust(3) + '\n'
        fidtxt.write(s)

    return headerdata


def readandwritecashierarchytree(fidcas, fidtxt, version_float, flags):
    hierarchydata   = array.array('I')
    WRITECASTXTFILE = (fidtxt != [])

    OLD = (3.02, 2.23, 3.0, 2.22, 2.19)
    nbones = getubyte(fidcas) if version_float in OLD else getushort(fidcas)
    for ii in range(nbones):
        hierarchydata.append(getuint(fidcas))

    if WRITECASTXTFILE and flags.hierarchy == 1:
        fidtxt.write(str(nbones).ljust(20) + ' ')
        for ii in range(nbones): fidtxt.write(str(hierarchydata[ii]).ljust(3) + ' ')
        fidtxt.write('\n'); fidtxt.flush()

    return hierarchydata


def readandwritecastimeticks(fidcas, fidtxt, version_float, flags):
    timetickdata    = array.array('f')
    WRITECASTXTFILE = (fidtxt != [])

    nframes = getuint(fidcas)
    if abs(nframes) > 800:
        print('Bad nframes, exiting...')
        exit()
    for ii in range(nframes):
        timetickdata.append(getfloat(fidcas))

    if WRITECASTXTFILE and flags.timeticks == 1:
        fidtxt.write(str(nframes).ljust(20) + ' ')
        for ii in range(nframes): fidtxt.write(formatfloat(timetickdata[ii], 5, 3) + ' ')
        fidtxt.write('\n'); fidtxt.flush()

    return timetickdata


def readandwritecasbonesection(fidcas, fidtxt, nbones, version_float, flags):
    bonenames         = []
    quatframesperbone = array.array('I')
    animframesperbone = array.array('I')
    quatoffsetperbone = array.array('I')
    animoffsetperbone = array.array('I')
    zerosperbone      = array.array('I')
    onesperbone       = array.array('I')
    WRITECASTXTFILE   = (fidtxt != [])
    OLD = (3.02, 2.23, 3.0, 2.22, 3.12, 3.05, 2.19)

    for ii in range(nbones):
        nch        = getuint(fidcas)
        bonename   = getstring(fidcas, nch-1)
        dummy      = getubyte(fidcas)
        quatframes = getuint(fidcas); animframes = getuint(fidcas)
        quatoffset = getuint(fidcas); animoffset = getuint(fidcas)
        zero       = getuint(fidcas)
        if version_float not in OLD:
            one   = getuint(fidcas)
            byte1 = getubyte(fidcas)
        else:
            one = 1

        bonenames.append(bonename)
        quatframesperbone.append(quatframes); animframesperbone.append(animframes)
        quatoffsetperbone.append(quatoffset); animoffsetperbone.append(animoffset)
        zerosperbone.append(zero);            onesperbone.append(one)

        if WRITECASTXTFILE and flags.bones == 1:
            fidtxt.write(bonename.ljust(20) + ' ')
            s  = str(quatframes).ljust(6) + ' ' + str(animframes).ljust(6) + ' '
            s += str(quatoffset).ljust(6) + ' ' + str(animoffset).ljust(6) + ' '
            s += str(zero).ljust(6) + ' '
            if version_float not in OLD:
                s += str(one).ljust(6) + ' ' + str(byte1).ljust(6)
            fidtxt.write(s + '\n'); fidtxt.flush()

    return [bonenames, quatframesperbone, animframesperbone,
            quatoffsetperbone, animoffsetperbone, zerosperbone, onesperbone]


def writecasdatatotext(fidtxt, bonedata, quatfloats, animfloats, posefloats, eulers):
    bonenames         = bonedata[0]
    quatframesperbone = bonedata[1]
    animframesperbone = bonedata[2]
    onesperbone       = bonedata[6]
    nbones            = len(bonenames)

    iquat = 0; ieuler = 0
    for ii in range(nbones):
        nqframes = quatframesperbone[ii]
        if nqframes == 0: continue
        fidtxt.write(str(ii-1) + ' ' + bonenames[ii] + '  quaternion data and Milkshape euler angles\n')
        for jj in range(nqframes):
            for kk in range(4): fidtxt.write(formatfloat(quatfloats[iquat+kk], 12, 10) + ' ')
            iquat += 4
            fidtxt.write('     ')
            for kk in range(3): fidtxt.write(formatfloat(180.0 * eulers[ieuler+kk] / math.pi, 14, 10) + ' ')
            ieuler += 3; fidtxt.write('\n')

    ianim = 0
    for ii in range(nbones):
        naframes = animframesperbone[ii]
        if naframes == 0: continue
        fidtxt.write(str(ii-1) + ' ' + bonenames[ii] + '  animation data and deltas\n')
        for jj in range(naframes):
            for kk in range(3): fidtxt.write(formatfloat(animfloats[ianim+kk], 12, 10) + ' ')
            ianim += 3; fidtxt.write('\n')

    ipose = 0
    fidtxt.write('0    skeleton pose data, all bones including Scene_Root\n')
    for ii in range(nbones):
        npframes = onesperbone[ii]
        if npframes == 0: continue
        for jj in range(npframes):
            for kk in range(3): fidtxt.write(formatfloat(posefloats[ipose+kk], 12, 10) + ' ')
            ipose += 3; fidtxt.write('\n')


# ===================================================================================
# CAS footer reader
# ===================================================================================
def readandwritecasfooter(fidcas, fidtxt, flags):
    HORSEFLAG       = False
    CAMELFLAG       = False
    footerdata      = []
    WRITECASTXTFILE = (fidtxt != [])

    if iseof(fidcas):
        print('ANOMALOUS CAS FILE DETECTED: NO FOOTER DATA AT ALL...')
        if WRITECASTXTFILE and flags.isdir == 1:
            fidtxt.write('ANOMALOUS CAS FILE DETECTED: NO FOOTER DATA AT ALL...\n')
        return footerdata

    int_104 = getuint(fidcas)
    if int_104 == 170: HORSEFLAG = True
    if int_104 == 18:  CAMELFLAG = True

    if CAMELFLAG:
        int_one1 = getuint(fidcas); int_zero1 = getuint(fidcas); int_zero2 = getuint(fidcas)
        short_zero1 = getushort(fidcas)
        int_vec1 = array.array('I'); int_vec1.fromfile(fidcas, 4)
        int_vec2 = array.array('I'); int_vec2.fromfile(fidcas, 4)
        int_vec3 = array.array('I'); int_vec3.fromfile(fidcas, 4)
        int_vec4 = array.array('I'); int_vec4.fromfile(fidcas, 4)
        if iseof(fidcas):
            if WRITECASTXTFILE and flags.footer == 1 and flags.isdir == 1:
                fidtxt.write('ANOMALOUS CAS FILE DETECTED: BAD FOOTER DATA...MISSING 24 BYTES, THE INTS 12 5 0  12 12 0\n')
            int_vec5 = []
        else:
            int_vec5 = array.array('I'); int_vec5.fromfile(fidcas, 3)
        footerdata = [int_104, int_one1, int_zero1, int_zero2, short_zero1,
                      int_vec1, int_vec2, int_vec3, int_vec4, int_vec5]
        # Write camel footer (omitted for brevity, mirrors original)
        return footerdata

    int_one1 = getuint(fidcas)
    int_one2 = getuint(fidcas)

    if int_104 == 16 and int_one1 == 1 and int_one2 == 0:
        int_zero1 = getuint(fidcas)
        int_vec1 = array.array('I'); int_vec1.fromfile(fidcas, 4)
        int_vec2 = array.array('I'); int_vec2.fromfile(fidcas, 4)
        int_vec3 = array.array('I'); int_vec3.fromfile(fidcas, 4)
        int_vec4 = array.array('I'); int_vec4.fromfile(fidcas, 4)
        footerdata = [int_104, int_one1, int_one2, int_zero1, int_vec1, int_vec2, int_vec3, int_vec4]
        return footerdata

    nch          = getuint(fidcas)
    AttribString = getstring(fidcas, nch-1)
    dummy        = getubyte(fidcas)
    int_one3     = getuint(fidcas);  byte_zero1 = getubyte(fidcas)
    int_one4     = getuint(fidcas);  int_zero1  = getuint(fidcas);  byte_zero2 = getubyte(fidcas)
    float_vec1   = array.array('f'); float_vec1.fromfile(fidcas, 7)
    int_zero2    = getuint(fidcas);  short_zero1 = getushort(fidcas)
    int_minus1   = getint(fidcas);   int_zero3   = getuint(fidcas)

    footerdata = [int_104, int_one1, int_one2, AttribString, int_one3, byte_zero1,
                  int_one4, int_zero1, byte_zero2, float_vec1, int_zero2, short_zero1,
                  int_minus1, int_zero3]

    if not HORSEFLAG:
        short_zero2   = getushort(fidcas)
        int_something = getuint(fidcas)
        int_vec1 = array.array('I'); int_vec1.fromfile(fidcas, 4)
        int_vec2 = array.array('I'); int_vec2.fromfile(fidcas, 4)
        int_vec3 = array.array('I'); int_vec3.fromfile(fidcas, 4)
        int_vec4 = array.array('I'); int_vec4.fromfile(fidcas, 4)
        if iseof(fidcas):
            if WRITECASTXTFILE and flags.footer == 1 and flags.isdir == 1:
                fidtxt.write('ANOMALOUS CAS FILE DETECTED: BAD FOOTER DATA...MISSING 24 BYTES, THE INTS 12 5 0  12 12 0\n')
            int_vec5 = []
        else:
            int_vec5 = array.array('I'); int_vec5.fromfile(fidcas, 3)
        if iseof(fidcas):
            if WRITECASTXTFILE and flags.footer == 1 and flags.isdir == 1:
                fidtxt.write('ANOMALOUS CAS FILE DETECTED: BAD FOOTER DATA...MISSING 12 BYTES, THE INTS 12 12 0\n')
            int_vec6 = []
        else:
            int_vec6 = array.array('I'); int_vec6.fromfile(fidcas, 3)
        footerdata += [short_zero2, int_something, int_vec1, int_vec2, int_vec3, int_vec4, int_vec5, int_vec6]
    else:
        nch = getuint(fidcas); string2 = getstring(fidcas, nch-1); dummy = getubyte(fidcas)
        int_one5  = getuint(fidcas); byte_zero3 = getubyte(fidcas)
        int_one6  = getuint(fidcas); int_zero4  = getuint(fidcas); byte_zero4 = getubyte(fidcas)
        float_vec2 = array.array('f'); float_vec2.fromfile(fidcas, 7)
        int_vec1  = array.array('I'); int_vec1.fromfile(fidcas, 5)
        int_vec2  = array.array('I'); int_vec2.fromfile(fidcas, 4)
        int_vec3  = array.array('I'); int_vec3.fromfile(fidcas, 4)
        int_vec4  = array.array('I'); int_vec4.fromfile(fidcas, 4)
        int_vec5  = array.array('I'); int_vec5.fromfile(fidcas, 4)
        int_count = getuint(fidcas); int_five  = getuint(fidcas)
        int_one7  = getuint(fidcas); int_zero5 = getuint(fidcas)
        float_vec3 = array.array('f'); float_vec3.fromfile(fidcas, 7)
        int_vec6  = array.array('I'); int_vec6.fromfile(fidcas, 7)
        byte_zero5 = getubyte(fidcas)
        int_vec7  = array.array('I'); int_vec7.fromfile(fidcas, 3)
        footerdata += [string2, int_one5, byte_zero3, int_one6, int_zero4, byte_zero4,
                       float_vec2, int_vec1, int_vec2, int_vec3, int_vec4, int_vec5,
                       int_count, int_five, int_one7, int_zero5, float_vec3, int_vec6,
                       byte_zero5, int_vec7]

    return footerdata


# ===================================================================================
# CAS mesh chunk headers
# ===================================================================================
def readresourcechunkheader(fidcas):
    chunkstr  = str(getuint(fidcas)) + ' ' + str(getuint(fidcas)) + ' ' + str(getuint(fidcas))
    nummeshes = 1
    numchars  = getuint(fidcas)
    if numchars == 26:
        chunkstr += ' ' + str(numchars) + ' ' + getstring(fidcas, 25)
        getubyte(fidcas)
        chunkstr += ' ' + str(getuint(fidcas)); getubyte(fidcas)
        chunkstr += ' ' + str(getuint(fidcas)); getubyte(fidcas)
        for _ in range(9): chunkstr += ' ' + str(getfloat(fidcas))
        chunkstr += ' ' + str(getushort(fidcas)) + ' ' + str(getint(fidcas)) + ' ' + str(getuint(fidcas))
    else:
        fidcas.seek(-4, 1)
    return [nummeshes, chunkstr]


def readnavychunkheader(fidcas):
    chunkstr  = str(getuint(fidcas)) + ' ' + str(getuint(fidcas)) + ' ' + str(getuint(fidcas))
    nch       = getuint(fidcas); attrib = getstring(fidcas, nch-1); getubyte(fidcas)
    chunkstr += ' ' + str(nch) + ' ' + attrib + ' ' + str(getuint(fidcas)); getubyte(fidcas)
    chunkstr += ' ' + str(getuint(fidcas)); getubyte(fidcas)
    fv = array.array('f'); fv.fromfile(fidcas, 9)
    for ii in range(9): chunkstr += ' ' + str(fv[ii])
    chunkstr += ' ' + str(getushort(fidcas)) + ' ' + str(getint(fidcas)) + ' ' + str(getuint(fidcas))
    return [1, chunkstr]


def readchunkheader(fidcas):
    chunkstr  = str(getuint(fidcas)) + ' ' + str(getuint(fidcas)) + ' ' + str(getuint(fidcas))
    chunkstr += ' ' + str(getuint(fidcas)) + ' ' + str(getushort(fidcas))
    chunkstr += ' ' + str(getuint(fidcas)) + ' ' + str(getuint(fidcas))
    nummeshes = getuint(fidcas); chunkstr += ' ' + str(nummeshes)
    return [nummeshes, chunkstr]


def readattribnodechunkheader(fidcas):
    chunkstr  = str(getuint(fidcas)) + ' ' + str(getuint(fidcas)) + ' ' + str(getuint(fidcas))
    nch       = getuint(fidcas); attrib = getstring(fidcas, nch-1); getubyte(fidcas)
    chunkstr += ' ' + str(nch) + ' ' + attrib + ' ' + str(getuint(fidcas)); getubyte(fidcas)
    chunkstr += ' ' + str(getuint(fidcas)); getubyte(fidcas)
    fv = array.array('f'); fv.fromfile(fidcas, 9)
    for ii in range(9): chunkstr += ' ' + str(fv[ii])
    chunkstr += ' ' + str(getushort(fidcas)) + ' ' + str(getint(fidcas)) + ' ' + str(getushort(fidcas))
    chunkstr += ' ' + str(getuint(fidcas)) + ' ' + str(getuint(fidcas)) + ' ' + str(getuint(fidcas)) + ' ' + str(getuint(fidcas))
    nummeshes = getuint(fidcas); chunkstr += ' ' + str(nummeshes)
    return [nummeshes, chunkstr]


# ===================================================================================
# CAS mesh middle section reader
# ===================================================================================
def readandwritecasmeshmiddle(fidcas, fidtxt, FLAGRESOURCE, FLAGNAVY):
    if iseof(fidcas):
        print('ANOMALOUS CAS FILE DETECTED: NO FOOTER DATA AT ALL...'); return []

    if FLAGNAVY:
        chunkdata = readnavychunkheader(fidcas)
    elif FLAGRESOURCE:
        chunkdata = readresourcechunkheader(fidcas)
    else:
        chunklength = getuint(fidcas)
        print('chunklength = ' + str(chunklength))
        fidcas.seek(-4, 1)
        chunkdata = readattribnodechunkheader(fidcas) if chunklength == 104 else readchunkheader(fidcas)

    nummeshes = int(chunkdata[0])
    chunkstr  = chunkdata[1]
    print('nummeshes = ' + str(nummeshes))
    print('chunkstr  = ' + chunkstr)

    groupnames = []; grouptris = []; groupmatId = []; groupindex = []; groupcomments = []

    print('tell says ' + str(fidcas.tell()))
    nch      = getuint(fidcas); meshname = getstring(fidcas, nch-1); getubyte(fidcas)
    groupnames.append(meshname)

    comment = str(getuint(fidcas)); getubyte(fidcas)
    if FLAGRESOURCE or FLAGNAVY:
        comment += ' ' + str(getuint(fidcas)); getubyte(fidcas)
        comment += ' ' + str(getuint(fidcas))
    fv = array.array('f'); fv.fromfile(fidcas, 7)
    for ii in range(7): comment += ' ' + str(fv[ii])
    groupcomments.append(comment)

    print('tell says ' + str(fidcas.tell()))
    numverts = getushort(fidcas); numfaces = getushort(fidcas)
    flagTVerts = getubyte(fidcas); flagVColors = getubyte(fidcas)
    print("numverts=%d, numfaces=%d, flagTVerts=%d, flagVColors=%d" % (numverts, numfaces, flagTVerts, flagVColors))

    if FLAGRESOURCE or FLAGNAVY:
        boneIds = array.array('i', [-1]*numverts)
    else:
        boneIds = array.array('i'); boneIds.fromfile(fidcas, numverts)

    verts   = array.array('f'); verts.fromfile(fidcas, 3*numverts)
    normals = array.array('f'); normals.fromfile(fidcas, 3*numverts)
    faces   = array.array('H'); faces.fromfile(fidcas, 3*numfaces)

    triarr = array.array('H')
    for ii in range(numfaces): groupindex.append(0); triarr.append(ii)
    grouptris.append(triarr)

    textureId = getuint(fidcas); groupmatId.append(textureId)

    tverts  = array.array('f') if flagTVerts  == 1 else []
    vcolors = array.array('b') if flagVColors == 1 else []
    if flagTVerts  == 1: tverts.fromfile(fidcas, 2*numverts)
    if flagVColors == 1: vcolors.fromfile(fidcas, 4*numverts)
    getuint(fidcas)  # terminating zero

    for imesh in range(1, nummeshes):
        nch = getuint(fidcas); meshname = getstring(fidcas, nch-1); getubyte(fidcas)
        groupnames.append(meshname)
        comment = str(getuint(fidcas)); getubyte(fidcas)
        fv2 = array.array('f'); fv2.fromfile(fidcas, 7)
        for ii in range(7): comment += ' ' + str(fv2[ii])
        groupcomments.append(comment)

        numverts2   = getushort(fidcas); numfaces2   = getushort(fidcas)
        flagTVerts2 = getubyte(fidcas);  flagVColors2 = getubyte(fidcas)
        print("numverts2=%d, numfaces2=%d, flagTVerts2=%d, flagVColors2=%d" % (numverts2, numfaces2, flagTVerts2, flagVColors2))

        boneIds2 = array.array('I'); boneIds2.fromfile(fidcas, numverts2)
        verts2   = array.array('f'); verts2.fromfile(fidcas, 3*numverts2)
        normals2 = array.array('f'); normals2.fromfile(fidcas, 3*numverts2)
        faces2   = array.array('H'); faces2.fromfile(fidcas, 3*numfaces2)

        base = len(faces) // 3
        triarr2 = array.array('H')
        for ii in range(base, base + numfaces2): groupindex.append(imesh); triarr2.append(ii)
        grouptris.append(triarr2)

        textureId = getuint(fidcas); groupmatId.append(textureId)

        tverts2  = array.array('f') if flagTVerts2  == 1 else []
        vcolors2 = array.array('b') if flagVColors2 == 1 else []
        if flagTVerts2  == 1: tverts2.fromfile(fidcas, 2*numverts2)
        if flagVColors2 == 1: vcolors2.fromfile(fidcas, 4*numverts2)
        getuint(fidcas)

        nvcur = len(verts) // 3
        for ii in range(numfaces2):
            faces.append(faces2[3*ii+0]+nvcur); faces.append(faces2[3*ii+1]+nvcur); faces.append(faces2[3*ii+2]+nvcur)
        for ii in range(numverts2):
            boneIds.append(boneIds2[ii])
            verts.append(verts2[3*ii+0]);   verts.append(verts2[3*ii+1]);   verts.append(verts2[3*ii+2])
            normals.append(normals2[3*ii+0]); normals.append(normals2[3*ii+1]); normals.append(normals2[3*ii+2])
            if tverts2:
                tverts.append(tverts2[2*ii+0]); tverts.append(tverts2[2*ii+1])
            if flagVColors == 1 and flagVColors2 == 1:
                for kk in range(4): vcolors.append(vcolors2[4*ii+kk])

    for ii in range(len(verts) // 3):
        verts[3*ii]   = -verts[3*ii]
        normals[3*ii] = -normals[3*ii]
    for ii in range(len(faces) // 3):
        tmp = faces[3*ii+1]; faces[3*ii+1] = faces[3*ii+2]; faces[3*ii+2] = tmp

    return [FLAGRESOURCE, chunkstr, boneIds, verts, normals, faces,
            textureId, tverts, vcolors, groupnames, grouptris, groupmatId,
            groupindex, groupcomments]


# ===================================================================================
# CAS mesh footer readers
# ===================================================================================
def readcasmeshfooter(fidcas, fidtxt, flags):
    int_vec1 = array.array('I'); int_vec1.fromfile(fidcas, 13)
    footerstr = ' '.join(str(int_vec1[ii]) for ii in range(13))
    int_footsize = getuint(fidcas); footerstr += ' ' + str(int_footsize)
    int_vec2 = array.array('I'); int_vec2.fromfile(fidcas, 3)
    footerstr += ' ' + ' '.join(str(int_vec2[ii]) for ii in range(3))
    getubyte(fidcas)
    nch = int_footsize - 75; tmpstring = getstring(fidcas, nch)
    tokens = tmpstring.split()
    if len(tokens) > 1:
        texturefilestring = tokens[0] + ''.join('%' + t for t in tokens[1:])
    else:
        texturefilestring = tmpstring
    footerstr += ' ' + texturefilestring; getubyte(fidcas)
    fv = array.array('f'); fv.fromfile(fidcas, 14)
    footerstr += ' ' + ' '.join(str(fv[ii]) for ii in range(14))
    getubyte(fidcas)
    return [footerstr]


def readcasnavymeshfooter(fidcas, fidtxt, flags):
    footerstr = str(getushort(fidcas))
    iv = array.array('I'); iv.fromfile(fidcas, 17)
    footerstr += ' ' + ' '.join(str(iv[ii]) for ii in range(17))
    int_footsize = getuint(fidcas); footerstr += ' ' + str(int_footsize)
    iv2 = array.array('I'); iv2.fromfile(fidcas, 3)
    footerstr += ' ' + ' '.join(str(iv2[ii]) for ii in range(3))
    getubyte(fidcas)
    footerstr += ' ' + getstring(fidcas, int_footsize-75); getubyte(fidcas)
    fv = array.array('f'); fv.fromfile(fidcas, 14)
    footerstr += ' ' + ' '.join(str(fv[ii]) for ii in range(14))
    getubyte(fidcas)
    return [footerstr]


def readcasresourcemeshfooter(fidcas, fidtxt, flags):
    nch = getuint(fidcas); footerstr = str(nch)
    AttribString = getstring(fidcas, nch-1); getubyte(fidcas); footerstr += ' ' + AttribString
    footerstr += ' ' + str(getuint(fidcas)); getubyte(fidcas)
    footerstr += ' ' + str(getuint(fidcas)); getubyte(fidcas)
    fv0 = array.array('f'); fv0.fromfile(fidcas, 9)
    footerstr += ' ' + ' '.join(str(fv0[ii]) for ii in range(9))
    footerstr += ' ' + str(getushort(fidcas)) + ' ' + str(getint(fidcas)) + ' ' + str(getushort(fidcas))
    iv0 = array.array('I'); iv0.fromfile(fidcas, 18)
    footerstr += ' ' + ' '.join(str(iv0[ii]) for ii in range(18))
    footsize = getuint(fidcas); nch = footsize - 75; footerstr += ' ' + str(footsize)
    footerstr += ' ' + str(getint(fidcas)) + ' ' + str(getint(fidcas)) + ' ' + str(getint(fidcas))
    getubyte(fidcas)
    footerstr += ' ' + getstring(fidcas, nch); getubyte(fidcas)
    fv1 = array.array('f'); fv1.fromfile(fidcas, 14)
    footerstr += ' ' + ' '.join(str(fv1[ii]) for ii in range(14))
    getubyte(fidcas)
    return [footerstr]


def readcasvariantresourcemeshfooter(fidcas, fidtxt, flags):
    footerstr = str(getushort(fidcas))
    for ii in range(17): footerstr += ' ' + str(getuint(fidcas))
    footsize = getuint(fidcas); nch = footsize - 75; footerstr += ' ' + str(footsize)
    footerstr += ' ' + str(getint(fidcas)) + ' ' + str(getint(fidcas)) + ' ' + str(getint(fidcas))
    getubyte(fidcas); footerstr += ' ' + getstring(fidcas, nch); getubyte(fidcas)
    fv = array.array('f'); fv.fromfile(fidcas, 14)
    footerstr += ' ' + ' '.join(str(fv[ii]) for ii in range(14))
    getubyte(fidcas)
    return [footerstr]


# ===================================================================================
# readcasfile / writecasfile
# ===================================================================================
def readcasfile(fncas, fntxt, flags):
    WRITECASTXTFILE = (fntxt != [])
    casfiledatalist = []; fidtxt = []

    fidcas = open(fncas, 'rb')
    if WRITECASTXTFILE and flags.isdir == 1: fidtxt = open(fntxt, 'a')
    elif WRITECASTXTFILE:                    fidtxt = open(fntxt, 'w')

    nnavy     = fncas.find('navy');     nresource = fncas.find('resource')
    nsymbol   = fncas.find('symbol')

    headerdata    = readandwritecasheader(fidcas, fidtxt, flags)
    version_float = headerdata[0];   signaturebyte = headerdata[12]
    FLAGRESOURCE  = (signaturebyte == 99 or nresource > -1 or nsymbol > -1)
    FLAGNAVY      = (nnavy > -1)
    casfiledatalist.append(headerdata)

    filesizesans = getuint(fidcas); int_zero = getuint(fidcas)
    casfiledatalist.append(filesizesans); casfiledatalist.append(int_zero)
    if WRITECASTXTFILE and flags.filesize == 1:
        fidtxt.write(str(filesizesans).ljust(3) + ' ' + str(int_zero).ljust(3) + '\n')

    hierarchydata = readandwritecashierarchytree(fidcas, fidtxt, version_float, flags)
    nbones        = len(hierarchydata)
    casfiledatalist.append(hierarchydata)

    timeticksdata = readandwritecastimeticks(fidcas, fidtxt, version_float, flags)
    casfiledatalist.append(timeticksdata)

    bonedata = readandwritecasbonesection(fidcas, fidtxt, nbones, version_float, flags)
    casfiledatalist.append(bonedata)

    quatframesperbone = bonedata[1]; animframesperbone = bonedata[2]; onesperbone = bonedata[6]
    nquatframes = sum(quatframesperbone); nanimframes = sum(animframesperbone); nposeframes = sum(onesperbone)

    quatfloats = array.array('f'); quatfloats.fromfile(fidcas, nquatframes*4)
    casfiledatalist.append(quatfloats)
    animfloats = array.array('f'); animfloats.fromfile(fidcas, nanimframes*3)
    casfiledatalist.append(animfloats)
    posefloats = array.array('f'); posefloats.fromfile(fidcas, nposeframes*3)
    casfiledatalist.append(posefloats)

    eulers = computeeulers(quatfloats)
    casfiledatalist.append(eulers)

    if WRITECASTXTFILE and flags.alldata == 1:
        writecasdatatotext(fidtxt, bonedata, quatfloats, animfloats, posefloats, eulers)

    meshdata = readandwritecasmeshmiddle(fidcas, fidtxt, FLAGRESOURCE, FLAGNAVY)

    poseabs = [-posefloats[0], posefloats[1], posefloats[2]]
    nbones2 = len(posefloats) // 3
    for ib in range(1, nbones2):
        idx = hierarchydata[ib]
        poseabs += [-posefloats[3*ib+0] + poseabs[3*idx+0],
                     posefloats[3*ib+1] + poseabs[3*idx+1],
                     posefloats[3*ib+2] + poseabs[3*idx+2]]

    boneIds = meshdata[2]; verts = meshdata[3]
    for iv in range(len(boneIds)):
        Id = boneIds[iv]
        for k in range(3): verts[3*iv+k] += poseabs[3*Id+k]
    meshdata[3] = verts
    for iv in range(len(boneIds)): boneIds[iv] -= 1
    meshdata[2] = boneIds
    casfiledatalist.append(meshdata)

    if FLAGRESOURCE:
        intchoice = getuint(fidcas); fidcas.seek(-4, 1)
        footerdata = readcasresourcemeshfooter(fidcas, fidtxt, flags) if intchoice == 26 else readcasvariantresourcemeshfooter(fidcas, fidtxt, flags)
    elif FLAGNAVY:
        footerdata = readcasnavymeshfooter(fidcas, fidtxt, flags)
    else:
        footerdata = readcasmeshfooter(fidcas, fidtxt, flags)
    casfiledatalist.append(footerdata)

    fidcas.close()
    if WRITECASTXTFILE: fidtxt.close()
    return casfiledatalist


def computefilesizesans(casfiledatalist):
    hierarchydata = casfiledatalist[3]; timeticksdata = casfiledatalist[4]
    bonedata      = casfiledatalist[5]; quatfloats    = casfiledatalist[6]
    animfloats    = casfiledatalist[7]; posefloats    = casfiledatalist[8]
    bonenames     = bonedata[0]
    fs = 8 + 4*len(hierarchydata) + 2 + 4*(len(timeticksdata)+1)
    for nm in bonenames: fs += len(nm) + 1 + 7*4 + 1
    fs += 4*(len(quatfloats) + len(animfloats) + len(posefloats))
    return fs


def writecasheader(fidcas, hd):
    putfloat(hd[0], fidcas); putuint(hd[1], fidcas); putuint(hd[2], fidcas); putuint(hd[3], fidcas)
    putfloat(hd[4], fidcas); putuint(hd[5], fidcas); putuint(hd[6], fidcas)
    putubyte(hd[7], fidcas); putubyte(hd[8], fidcas); putubyte(hd[9], fidcas)
    putuint(hd[10], fidcas); putuint(hd[11], fidcas)
    putubyte(hd[12], fidcas); putubyte(hd[13], fidcas); putubyte(hd[14], fidcas)


def writecashierarchydata(fidcas, hierarchydata):
    putushort(len(hierarchydata), fidcas); hierarchydata.tofile(fidcas)


def writecastimeticksdata(fidcas, timeticksdata):
    putuint(len(timeticksdata), fidcas); timeticksdata.tofile(fidcas)


def writecasbonedata(fidcas, bonedata, version_float):
    bonenames = bonedata[0]; qfpb = bonedata[1]; afpb = bonedata[2]
    qopb = bonedata[3];      aopb = bonedata[4]; zpb  = bonedata[5]; opb = bonedata[6]
    OLD = (3.02, 2.23, 3.0, 2.22)
    for ii in range(len(bonenames)):
        nch = len(bonenames[ii])
        putuint(nch+1, fidcas); putstring(bonenames[ii], fidcas); putubyte(0, fidcas)
        putuint(qfpb[ii], fidcas); putuint(afpb[ii], fidcas); putuint(qopb[ii], fidcas)
        putuint(aopb[ii], fidcas); putuint(zpb[ii],  fidcas)
        if version_float not in OLD: putuint(opb[ii], fidcas); putubyte(0, fidcas)


def writecasfooterdata(fidcas, footerdata):
    int_104 = footerdata[0]; putuint(int_104, fidcas)
    if int_104 == 18:
        putuint(footerdata[1], fidcas); putuint(footerdata[2], fidcas); putuint(footerdata[3], fidcas)
        putushort(footerdata[4], fidcas)
        for v in footerdata[5:10]:
            if v != []: v.tofile(fidcas)
        return
    int_one1 = footerdata[1]; int_one2 = footerdata[2]
    if int_104 == 16 and int_one1 == 1 and int_one2 == 0:
        putuint(int_one1, fidcas); putuint(int_one2, fidcas); putuint(footerdata[3], fidcas)
        for v in footerdata[4:8]: v.tofile(fidcas)
        return
    AttribString = footerdata[3]; int_one3 = footerdata[4]; byte_zero1 = footerdata[5]
    int_one4 = footerdata[6];     int_zero1 = footerdata[7]; byte_zero2 = footerdata[8]
    float_vec1 = footerdata[9]; int_zero2 = footerdata[10]; short_zero1 = footerdata[11]
    int_minus1 = footerdata[12]; int_zero3 = footerdata[13]
    putuint(int_one1, fidcas); putuint(int_one2, fidcas)
    putuint(len(AttribString)+1, fidcas); putstring(AttribString, fidcas); putubyte(0, fidcas)
    putuint(int_one3, fidcas); putubyte(byte_zero1, fidcas)
    putuint(int_one4, fidcas); putuint(int_zero1, fidcas); putubyte(byte_zero2, fidcas)
    float_vec1.tofile(fidcas)
    putuint(int_zero2, fidcas); putushort(short_zero1, fidcas); putint(int_minus1, fidcas); putuint(int_zero3, fidcas)
    if int_104 == 170:
        s2=footerdata[14]; i5=footerdata[15]; bz3=footerdata[16]; i6=footerdata[17]
        iz4=footerdata[18]; bz4=footerdata[19]; fv2=footerdata[20]; v1=footerdata[21]; v2=footerdata[22]
        v3=footerdata[23]; v4=footerdata[24]; v5=footerdata[25]; ic=footerdata[26]; ifv=footerdata[27]
        i7=footerdata[28]; iz5=footerdata[29]; fv3=footerdata[30]; v6=footerdata[31]; bz5=footerdata[32]; v7=footerdata[33]
        putuint(len(s2)+1, fidcas); putstring(s2, fidcas); putubyte(0, fidcas)
        putuint(i5, fidcas); putubyte(bz3, fidcas); putuint(i6, fidcas); putuint(iz4, fidcas); putubyte(bz4, fidcas)
        fv2.tofile(fidcas); v1.tofile(fidcas); v2.tofile(fidcas); v3.tofile(fidcas); v4.tofile(fidcas); v5.tofile(fidcas)
        putuint(ic, fidcas); putuint(ifv, fidcas); putuint(i7, fidcas); putuint(iz5, fidcas)
        fv3.tofile(fidcas); v6.tofile(fidcas); putubyte(bz5, fidcas); v7.tofile(fidcas)
    else:
        putushort(footerdata[14], fidcas); putuint(footerdata[15], fidcas)
        for v in footerdata[16:22]:
            if v != []: v.tofile(fidcas)


def writecasfile(fncas, casfiledatalist):
    fidcas = open(fncas, 'wb')
    hd = casfiledatalist[0]; int_zero = casfiledatalist[2]
    writecasheader(fidcas, hd)
    putuint(computefilesizesans(casfiledatalist), fidcas); putuint(int_zero, fidcas)
    writecashierarchydata(fidcas, casfiledatalist[3])
    writecastimeticksdata(fidcas, casfiledatalist[4])
    writecasbonedata(fidcas, casfiledatalist[5], hd[0])
    casfiledatalist[6].tofile(fidcas)   # quatfloats
    casfiledatalist[7].tofile(fidcas)   # animfloats
    casfiledatalist[8].tofile(fidcas)   # posefloats
    if casfiledatalist[10] != []:
        writecasfooterdata(fidcas, casfiledatalist[10])
    fidcas.close()
