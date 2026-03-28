# ===================================================================================
#                            stratmodelconverter.py                                 |
# ===================================================================================
#
# Original Programmer: Sandy Wilson (KnightErrant)
# Creation Date:       10 December 2007
# Python 3 Port:       2024
#
# Changes for Python 3:
#   - tkinter imports updated (Tkinter -> tkinter, tkMessageBox -> tkinter.messagebox)
#   - print statements -> print() functions
#   - Integer division: / -> // where int result required
#   - Binary file reads return bytes; decode with 'latin-1' where strings expected
#   - iseof: compare read() to b'' not ''
#   - str.split() on bytes: decode first
# ===================================================================================

import array
import struct
import math

from tkinter import *
from tkinter.messagebox import showwarning

import os
import os.path
import fnmatch

dialogstates = {}

# ===================================================================================
#                            File operations.
# ===================================================================================
def iseof(fidin):
    val = fidin.read(1)
    if val == b'':
        return True
    fidin.seek(-1, 1)
    return False


# ===================================================================================
#                            Getters for binary files.
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
    # Returns decoded string (latin-1 preserves all byte values)
    raw = fidin.read(nchar)
    return raw.decode('latin-1')


# ===================================================================================
#                            Putters for binary files.
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
#                            Formatters.
# ===================================================================================

def zipstrip(string):
    nch = len(string)
    for ii in range(nch):
        if isinstance(string[ii], int):
            val = string[ii]
        else:
            (val,) = struct.unpack('b', string[ii].encode('latin-1'))
        if val == 0:
            break
    return string[0:ii]

def formatfloat(x, nfield, ndecimal):
    formatstring = '%+' + str(nfield) + '.' + str(ndecimal) + 'f'
    return formatstring % x

def splitpath(fullfilename):
    (fpath, ftemp) = os.path.split(fullfilename)
    (fname, fext) = os.path.splitext(ftemp)
    return [fpath, fname, fext]


# ===================================================================================
#    Utility for reading/writing full format .cas files
# ===================================================================================

def computeeulers(quatfloats):
    nfloats = len(quatfloats)
    nvecs = nfloats // 4          # Python 3: integer division
    eulers = array.array('f')

    for ivec in range(nvecs):
        idx = ivec * 4
        q1 = quatfloats[idx+0]
        q2 = quatfloats[idx+1]
        q3 = quatfloats[idx+2]
        q4 = quatfloats[idx+3]

        sint = 2 * (q2 * q4 - q1 * q3)
        cost_tmp = 1.0 - sint * sint
        if abs(cost_tmp) > 0.0001:
            cost = cost_tmp ** 0.5
        else:
            cost = 0.0

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

        roll = math.atan2(sinv, cosv)
        pitch = math.atan2(sint, cost)
        yaw = math.atan2(sinf, cosf)

        eulers.append(roll)
        eulers.append(-pitch)
        eulers.append(-yaw)

    return eulers


def computequats(eulers):
    nfloats = len(eulers)
    nvecs = nfloats // 3          # Python 3: integer division
    quatfloats = array.array('f')

    for ivec in range(nvecs):
        idx = ivec * 3
        phi_rad   = +eulers[idx+0]
        theta_rad = -eulers[idx+1]
        psi_rad   = -eulers[idx+2]

        sphi   = math.sin(phi_rad)
        cphi   = math.cos(phi_rad)
        stheta = math.sin(theta_rad)
        ctheta = math.cos(theta_rad)
        spsi   = math.sin(psi_rad)
        cpsi   = math.cos(psi_rad)

        R11 = cpsi * ctheta
        R12 = cpsi * stheta * sphi - spsi * cphi
        R13 = cpsi * stheta * cphi + spsi * sphi
        R21 = spsi * ctheta
        R22 = spsi * stheta * sphi + cpsi * cphi
        R23 = spsi * stheta * cphi - cpsi * sphi
        R31 = -stheta
        R32 = ctheta * sphi
        R33 = ctheta * cphi

        q4 = 0.5 * (1 + R11 + R22 + R33) ** 0.5
        q1 = 0.25 * (R32 - R23) / q4
        q2 = 0.25 * (R13 - R31) / q4
        q3 = 0.25 * (R21 - R12) / q4

        quatfloats.append(q1)
        quatfloats.append(q2)
        quatfloats.append(q3)
        quatfloats.append(q4)

    return quatfloats


def readandwritecasheader(fidcas, fidtxt, flags):
    headerdata = []
    WRITECASTXTFILE = fidtxt != []

    signaturebytetriple1 = array.array('B')
    signaturebytetriple2 = array.array('B')

    float_version = getfloat(fidcas)
    for v in [3.02, 3.0, 2.23, 2.22, 3.12, 3.05, 2.19]:
        if abs(float_version - v) < 0.001:
            float_version = v

    int_thirtyeight = getuint(fidcas)
    int_nine        = getuint(fidcas)
    int_zero1       = getuint(fidcas)
    float_animtime  = getfloat(fidcas)
    int_one1        = getuint(fidcas)
    int_zero2       = getuint(fidcas)
    signaturebytetriple1.append(getubyte(fidcas))
    signaturebytetriple1.append(getubyte(fidcas))
    signaturebytetriple1.append(getubyte(fidcas))
    int_one2        = getuint(fidcas)
    int_zero3       = getuint(fidcas)
    signaturebytetriple2.append(getubyte(fidcas))
    signaturebytetriple2.append(getubyte(fidcas))
    signaturebytetriple2.append(getubyte(fidcas))

    headerdata.append(float_version)           # 0
    headerdata.append(int_thirtyeight)         # 1
    headerdata.append(int_nine)                # 2
    headerdata.append(int_zero1)               # 3
    headerdata.append(float_animtime)          # 4
    headerdata.append(int_one1)                # 5
    headerdata.append(int_zero2)               # 6
    headerdata.append(signaturebytetriple1[0]) # 7
    headerdata.append(signaturebytetriple1[1]) # 8
    headerdata.append(signaturebytetriple1[2]) # 9
    headerdata.append(int_one2)                # 10
    headerdata.append(int_zero3)               # 11
    headerdata.append(signaturebytetriple2[0]) # 12
    headerdata.append(signaturebytetriple2[1]) # 13
    headerdata.append(signaturebytetriple2[2]) # 14

    if WRITECASTXTFILE and flags.header == 1:
        s = (formatfloat(float_version, 5, 3) + ' ' + str(int_thirtyeight).ljust(3) + ' ' +
             str(int_nine).ljust(3) + ' ' + str(int_zero1).ljust(3) + ' ' +
             formatfloat(float_animtime, 5, 3) + ' ' + str(int_one1).ljust(3) + ' ' +
             str(int_zero2).ljust(3) + '    ' +
             str(signaturebytetriple1[0]).ljust(3) + ' ' + str(signaturebytetriple1[1]).ljust(3) + ' ' +
             str(signaturebytetriple1[2]).ljust(3) + '    ' +
             str(int_one2).ljust(3) + ' ' + str(int_zero3).ljust(3) + '    ' +
             str(signaturebytetriple2[0]).ljust(3) + ' ' + str(signaturebytetriple2[1]).ljust(3) + ' ' +
             str(signaturebytetriple2[2]).ljust(3) + '\n')
        fidtxt.write(s)

    return headerdata


def readandwritecashierarchytree(fidcas, fidtxt, version_float, flags):
    hierarchydata = array.array('I')
    WRITECASTXTFILE = fidtxt != []

    old_versions = [3.02, 2.23, 3.0, 2.22, 2.19]
    if version_float in old_versions:
        nbones = getubyte(fidcas)
    else:
        nbones = getushort(fidcas)

    for ii in range(nbones):
        hierarchydata.append(getuint(fidcas))

    if WRITECASTXTFILE and flags.hierarchy == 1:
        fidtxt.write(str(nbones).ljust(20) + ' ')
        for ii in range(nbones):
            fidtxt.write(str(hierarchydata[ii]).ljust(3) + ' ')
        fidtxt.write('\n')
        fidtxt.flush()

    return hierarchydata


def readandwritecastimeticks(fidcas, fidtxt, version_float, flags):
    timetickdata = array.array('f')
    WRITECASTXTFILE = fidtxt != []

    nframes = getuint(fidcas)
    if abs(nframes) > 800:
        print('Bad nframes, exiting...')
        exit()

    for ii in range(nframes):
        timetickdata.append(getfloat(fidcas))

    if WRITECASTXTFILE and flags.timeticks == 1:
        fidtxt.write(str(nframes).ljust(20) + ' ')
        for ii in range(nframes):
            fidtxt.write(formatfloat(timetickdata[ii], 5, 3) + ' ')
        fidtxt.write('\n')
        fidtxt.flush()

    return timetickdata


def readandwritecasbonesection(fidcas, fidtxt, nbones, version_float, flags):
    bonedata = []
    bonenames = []
    quatframesperbone = array.array('I')
    animframesperbone = array.array('I')
    quatoffsetperbone = array.array('I')
    animoffsetperbone = array.array('I')
    zerosperbone      = array.array('I')
    onesperbone       = array.array('I')

    WRITECASTXTFILE = fidtxt != []
    old_versions = [3.02, 2.23, 3.0, 2.22, 3.12, 3.05, 2.19]

    for ii in range(nbones):
        nch      = getuint(fidcas)
        bonename = getstring(fidcas, nch - 1)  # now returns str
        dummy    = getubyte(fidcas)

        quatframes = getuint(fidcas)
        animframes = getuint(fidcas)
        quatoffset = getuint(fidcas)
        animoffset = getuint(fidcas)
        zero       = getuint(fidcas)

        if version_float not in old_versions:
            one   = getuint(fidcas)
            byte1 = getubyte(fidcas)
        else:
            one   = 1
            byte1 = 0

        bonenames.append(bonename)
        quatframesperbone.append(quatframes)
        animframesperbone.append(animframes)
        quatoffsetperbone.append(quatoffset)
        animoffsetperbone.append(animoffset)
        zerosperbone.append(zero)
        onesperbone.append(one)

        if WRITECASTXTFILE and flags.bones == 1:
            fidtxt.write(bonename.ljust(20) + ' ')
            s = (str(quatframes).ljust(6) + ' ' + str(animframes).ljust(6) + ' ' +
                 str(quatoffset).ljust(6) + ' ' + str(animoffset).ljust(6) + ' ' +
                 str(zero).ljust(6) + ' ')
            if version_float not in old_versions:
                s += str(one).ljust(6) + ' ' + str(byte1).ljust(6) + '\n'
            else:
                s += '\n'
            fidtxt.write(s)
            fidtxt.flush()

    bonedata.append(bonenames)
    bonedata.append(quatframesperbone)
    bonedata.append(animframesperbone)
    bonedata.append(quatoffsetperbone)
    bonedata.append(animoffsetperbone)
    bonedata.append(zerosperbone)
    bonedata.append(onesperbone)

    return bonedata


def writecasdatatotext(fidtxt, bonedata, quatfloats, animfloats, posefloats, eulers):
    bonenames         = bonedata[0]
    quatframesperbone = bonedata[1]
    animframesperbone = bonedata[2]
    onesperbone       = bonedata[6]
    nbones = len(bonenames)

    iquat  = 0
    ieuler = 0
    for ii in range(nbones):
        nqframes = quatframesperbone[ii]
        if nqframes == 0:
            continue
        fidtxt.write(str(ii-1) + ' ' + bonenames[ii] + '  quaternion data and Milkshape euler angles\n')
        for jj in range(nqframes):
            fidtxt.write(formatfloat(quatfloats[iquat+0], 12, 10) + ' ')
            fidtxt.write(formatfloat(quatfloats[iquat+1], 12, 10) + ' ')
            fidtxt.write(formatfloat(quatfloats[iquat+2], 12, 10) + ' ')
            fidtxt.write(formatfloat(quatfloats[iquat+3], 12, 10) + '     ')
            iquat += 4
            fidtxt.write(formatfloat(180.0 * eulers[ieuler+0] / math.pi, 14, 10) + ' ')
            fidtxt.write(formatfloat(180.0 * eulers[ieuler+1] / math.pi, 14, 10) + ' ')
            fidtxt.write(formatfloat(180.0 * eulers[ieuler+2] / math.pi, 14, 10) + '\n')
            ieuler += 3

    ianim = 0
    for ii in range(nbones):
        naframes = animframesperbone[ii]
        if naframes == 0:
            continue
        fidtxt.write(str(ii-1) + ' ' + bonenames[ii] + '  animation data and deltas\n')
        for jj in range(naframes):
            fidtxt.write(formatfloat(animfloats[ianim+0], 12, 10) + ' ')
            fidtxt.write(formatfloat(animfloats[ianim+1], 12, 10) + ' ')
            fidtxt.write(formatfloat(animfloats[ianim+2], 12, 10) + '\n')
            ianim += 3

    ipose = 0
    fidtxt.write('0    skeleton pose data, all bones including Scene_Root\n')
    for ii in range(nbones):
        npframes = onesperbone[ii]
        if npframes == 0:
            continue
        for jj in range(npframes):
            fidtxt.write(formatfloat(posefloats[ipose+0], 12, 10) + ' ')
            fidtxt.write(formatfloat(posefloats[ipose+1], 12, 10) + ' ')
            fidtxt.write(formatfloat(posefloats[ipose+2], 12, 10) + '\n')
            ipose += 3


def readandwritecasfooter(fidcas, fidtxt, flags):
    HORSEFLAG = False
    CAMELFLAG = False
    footerdata = []
    WRITECASTXTFILE = fidtxt != []

    if iseof(fidcas):
        print('ANOMALOUS CAS FILE DETECTED: NO FOOTER DATA AT ALL...')
        if WRITECASTXTFILE and flags.isdir == 1:
            fidtxt.write('ANOMALOUS CAS FILE DETECTED: NO FOOTER DATA AT ALL...\n')
        return footerdata

    int_104 = getuint(fidcas)
    if int_104 == 170:
        HORSEFLAG = True
    if int_104 == 18:
        CAMELFLAG = True

    if CAMELFLAG:
        int_one1    = getuint(fidcas)
        int_zero1   = getuint(fidcas)
        int_zero2   = getuint(fidcas)
        short_zero1 = getushort(fidcas)
        int_vec1 = array.array('I'); int_vec1.fromfile(fidcas, 4)
        int_vec2 = array.array('I'); int_vec2.fromfile(fidcas, 4)
        int_vec3 = array.array('I'); int_vec3.fromfile(fidcas, 4)
        int_vec4 = array.array('I'); int_vec4.fromfile(fidcas, 4)
        if iseof(fidcas):
            if WRITECASTXTFILE and flags.footer == 1 and flags.isdir == 1:
                fidtxt.write('ANOMALOUS CAS FILE DETECTED: BAD FOOTER DATA...MISSING 24 BYTES\n')
            int_vec5 = []
        else:
            int_vec5 = array.array('I'); int_vec5.fromfile(fidcas, 3)

        footerdata.extend([int_104, int_one1, int_zero1, int_zero2, short_zero1,
                           int_vec1, int_vec2, int_vec3, int_vec4, int_vec5])
        return footerdata

    int_one1 = getuint(fidcas)
    int_one2 = getuint(fidcas)

    if int_104 == 16 and int_one1 == 1 and int_one2 == 0:
        int_zero1 = getuint(fidcas)
        int_vec1 = array.array('I'); int_vec1.fromfile(fidcas, 4)
        int_vec2 = array.array('I'); int_vec2.fromfile(fidcas, 4)
        int_vec3 = array.array('I'); int_vec3.fromfile(fidcas, 4)
        int_vec4 = array.array('I'); int_vec4.fromfile(fidcas, 4)
        footerdata.extend([int_104, int_one1, int_one2, int_zero1,
                           int_vec1, int_vec2, int_vec3, int_vec4])
        return footerdata

    nch          = getuint(fidcas)
    AttribString = getstring(fidcas, nch - 1)
    dummy        = getubyte(fidcas)

    int_one3   = getuint(fidcas)
    byte_zero1 = getubyte(fidcas)
    int_one4   = getuint(fidcas)
    int_zero1  = getuint(fidcas)
    byte_zero2 = getubyte(fidcas)

    float_vec1 = array.array('f'); float_vec1.fromfile(fidcas, 7)
    int_zero2  = getuint(fidcas)
    short_zero1 = getushort(fidcas)
    int_minus1 = getint(fidcas)
    int_zero3  = getuint(fidcas)

    footerdata.extend([int_104, int_one1, int_one2, AttribString,
                       int_one3, byte_zero1, int_one4, int_zero1, byte_zero2,
                       float_vec1, int_zero2, short_zero1, int_minus1, int_zero3])

    if not HORSEFLAG:
        short_zero2  = getushort(fidcas)
        int_something = getuint(fidcas)
        int_vec1 = array.array('I'); int_vec1.fromfile(fidcas, 4)
        int_vec2 = array.array('I'); int_vec2.fromfile(fidcas, 4)
        int_vec3 = array.array('I'); int_vec3.fromfile(fidcas, 4)
        int_vec4 = array.array('I'); int_vec4.fromfile(fidcas, 4)
        int_vec5 = [] if iseof(fidcas) else (lambda a: (a.fromfile(fidcas, 3), a)[1])(array.array('I'))
        int_vec6 = [] if iseof(fidcas) else (lambda a: (a.fromfile(fidcas, 3), a)[1])(array.array('I'))
        footerdata.extend([short_zero2, int_something, int_vec1, int_vec2,
                           int_vec3, int_vec4, int_vec5, int_vec6])
    else:
        nch        = getuint(fidcas)
        string2    = getstring(fidcas, nch - 1)
        dummy      = getubyte(fidcas)
        int_one5   = getuint(fidcas)
        byte_zero3 = getubyte(fidcas)
        int_one6   = getuint(fidcas)
        int_zero4  = getuint(fidcas)
        byte_zero4 = getubyte(fidcas)
        float_vec2 = array.array('f'); float_vec2.fromfile(fidcas, 7)
        int_vec1   = array.array('I'); int_vec1.fromfile(fidcas, 5)
        int_vec2   = array.array('I'); int_vec2.fromfile(fidcas, 4)
        int_vec3   = array.array('I'); int_vec3.fromfile(fidcas, 4)
        int_vec4   = array.array('I'); int_vec4.fromfile(fidcas, 4)
        int_vec5   = array.array('I'); int_vec5.fromfile(fidcas, 4)
        int_count  = getuint(fidcas)
        int_five   = getuint(fidcas)
        int_one7   = getuint(fidcas)
        int_zero5  = getuint(fidcas)
        float_vec3 = array.array('f'); float_vec3.fromfile(fidcas, 7)
        int_vec6   = array.array('I'); int_vec6.fromfile(fidcas, 7)
        byte_zero5 = getubyte(fidcas)
        int_vec7   = array.array('I'); int_vec7.fromfile(fidcas, 3)
        footerdata.extend([string2, int_one5, byte_zero3, int_one6, int_zero4,
                           byte_zero4, float_vec2, int_vec1, int_vec2, int_vec3,
                           int_vec4, int_vec5, int_count, int_five, int_one7,
                           int_zero5, float_vec3, int_vec6, byte_zero5, int_vec7])

    return footerdata


def readresourcechunkheader(fidcas):
    chunkstr  = str(getuint(fidcas))
    chunkstr += ' ' + str(getuint(fidcas))
    chunkstr += ' ' + str(getuint(fidcas))
    nummeshes = 1
    numchars  = getuint(fidcas)
    if numchars == 26:
        chunkstr += ' ' + str(numchars)
        chunkstr += ' ' + getstring(fidcas, 25)
        getubyte(fidcas)
        chunkstr += ' ' + str(getuint(fidcas))
        getubyte(fidcas)
        chunkstr += ' ' + str(getuint(fidcas))
        getubyte(fidcas)
        for _ in range(9):
            chunkstr += ' ' + str(getfloat(fidcas))
        chunkstr += ' ' + str(getushort(fidcas))
        chunkstr += ' ' + str(getint(fidcas))
        chunkstr += ' ' + str(getuint(fidcas))
    else:
        fidcas.seek(-4, 1)
    return [nummeshes, chunkstr]


def readnavychunkheader(fidcas):
    chunkstr  = str(getuint(fidcas))
    chunkstr += ' ' + str(getuint(fidcas))
    chunkstr += ' ' + str(getuint(fidcas))
    nch = getuint(fidcas)
    attribstring = getstring(fidcas, nch - 1)
    getubyte(fidcas)
    chunkstr += ' ' + str(nch) + ' ' + attribstring
    chunkstr += ' ' + str(getuint(fidcas))
    getubyte(fidcas)
    chunkstr += ' ' + str(getuint(fidcas))
    getubyte(fidcas)
    float_vec = array.array('f'); float_vec.fromfile(fidcas, 9)
    for ii in range(9):
        chunkstr += ' ' + str(float_vec[ii])
    chunkstr += ' ' + str(getushort(fidcas))
    chunkstr += ' ' + str(getint(fidcas))
    chunkstr += ' ' + str(getuint(fidcas))
    return [1, chunkstr]


def readchunkheader(fidcas):
    chunkstr  = str(getuint(fidcas))
    chunkstr += ' ' + str(getuint(fidcas))
    chunkstr += ' ' + str(getuint(fidcas))
    chunkstr += ' ' + str(getuint(fidcas))
    chunkstr += ' ' + str(getushort(fidcas))
    chunkstr += ' ' + str(getuint(fidcas))
    chunkstr += ' ' + str(getuint(fidcas))
    nummeshes = getuint(fidcas)
    chunkstr += ' ' + str(nummeshes)
    return [nummeshes, chunkstr]


def readattribnodechunkheader(fidcas):
    chunkstr  = str(getuint(fidcas))
    chunkstr += ' ' + str(getuint(fidcas))
    chunkstr += ' ' + str(getuint(fidcas))
    nch = getuint(fidcas)
    attribnode = getstring(fidcas, nch - 1)
    dummy = getubyte(fidcas)
    chunkstr += ' ' + str(nch) + ' ' + attribnode
    chunkstr += ' ' + str(getuint(fidcas))
    dummy = getubyte(fidcas)
    chunkstr += ' ' + str(getuint(fidcas))
    dummy = getubyte(fidcas)
    float_vec = array.array('f'); float_vec.fromfile(fidcas, 9)
    for ii in range(9):
        chunkstr += ' ' + str(float_vec[ii])
    chunkstr += ' ' + str(getushort(fidcas))
    chunkstr += ' ' + str(getint(fidcas))
    chunkstr += ' ' + str(getushort(fidcas))
    chunkstr += ' ' + str(getuint(fidcas))
    chunkstr += ' ' + str(getuint(fidcas))
    chunkstr += ' ' + str(getuint(fidcas))
    chunkstr += ' ' + str(getuint(fidcas))
    nummeshes = getuint(fidcas)
    chunkstr += ' ' + str(nummeshes)
    return [nummeshes, chunkstr]


def readandwritecasmeshmiddle(fidcas, fidtxt, FLAGRESOURCE, FLAGNAVY):
    WRITECASTXTFILE = fidtxt != []

    if iseof(fidcas):
        print('ANOMALOUS CAS FILE DETECTED: NO FOOTER DATA AT ALL...')
        return []

    if FLAGNAVY:
        chunkdata = readnavychunkheader(fidcas)
    elif FLAGRESOURCE:
        chunkdata = readresourcechunkheader(fidcas)
    else:
        chunklength = getuint(fidcas)
        print('chunklength = ' + str(chunklength))
        fidcas.seek(-4, 1)
        if chunklength == 104:
            chunkdata = readattribnodechunkheader(fidcas)
        else:
            chunkdata = readchunkheader(fidcas)

    nummeshes = int(chunkdata[0])
    chunkstr  = chunkdata[1]
    print('nummeshes = ' + str(nummeshes))
    print('chunkstr  = ' + chunkstr)

    groupnames   = []
    grouptris    = []
    groupmatId   = []
    groupindex   = []
    groupcomments = []

    pos = fidcas.tell()
    print('tell says ' + str(pos))

    nch     = getuint(fidcas)
    meshname = getstring(fidcas, nch - 1)
    dummy   = getubyte(fidcas)
    groupnames.append(meshname)

    comment = str(getuint(fidcas))
    dummy   = getubyte(fidcas)
    if FLAGRESOURCE or FLAGNAVY:
        comment += ' ' + str(getuint(fidcas))
        getubyte(fidcas)
        comment += ' ' + str(getuint(fidcas))

    float_vec1 = array.array('f'); float_vec1.fromfile(fidcas, 7)
    for ii in range(7):
        comment += ' ' + str(float_vec1[ii])
    groupcomments.append(comment)

    pos = fidcas.tell()
    print('tell says ' + str(pos))
    numverts   = getushort(fidcas)
    numfaces   = getushort(fidcas)
    flagTVerts  = getubyte(fidcas)
    flagVColors = getubyte(fidcas)
    print("numverts = " + str(numverts) + ", numfaces = " + str(numfaces) +
          ", flagTVerts = " + str(flagTVerts) + ", flagVColors = " + str(flagVColors))

    if FLAGRESOURCE or FLAGNAVY:
        boneIds = array.array('i')
        for ii in range(numverts):
            boneIds.append(-1)
    else:
        boneIds = array.array('i'); boneIds.fromfile(fidcas, numverts)

    verts   = array.array('f'); verts.fromfile(fidcas, 3 * numverts)
    normals = array.array('f'); normals.fromfile(fidcas, 3 * numverts)
    faces   = array.array('H'); faces.fromfile(fidcas, 3 * numfaces)

    triarr = array.array('H')
    for ii in range(numfaces):
        groupindex.append(0)
        triarr.append(ii)
    grouptris.append(triarr)

    textureId = getuint(fidcas)
    groupmatId.append(textureId)

    if flagTVerts == 1:
        tverts = array.array('f'); tverts.fromfile(fidcas, 2 * numverts)
    else:
        tverts = []

    if flagVColors == 1:
        vcolors = array.array('b'); vcolors.fromfile(fidcas, 4 * numverts)
    else:
        vcolors = []

    int_zero11 = getuint(fidcas)

    for imesh in range(1, nummeshes):
        nch      = getuint(fidcas)
        meshname = getstring(fidcas, nch - 1)
        dummy    = getubyte(fidcas)
        groupnames.append(meshname)

        comment    = str(getuint(fidcas))
        byte_zero1 = getubyte(fidcas)
        float_vec1 = array.array('f'); float_vec1.fromfile(fidcas, 7)
        for ii in range(7):
            comment += ' ' + str(float_vec1[ii])
        groupcomments.append(comment)

        numverts2   = getushort(fidcas)
        numfaces2   = getushort(fidcas)
        flagTVerts2  = getubyte(fidcas)
        flagVColors2 = getubyte(fidcas)
        print("numverts2 = " + str(numverts2) + ", numfaces2 = " + str(numfaces2) +
              ", flagTVerts2 = " + str(flagTVerts2) + ", flagVColors2 = " + str(flagVColors2))

        boneIds2 = array.array('I'); boneIds2.fromfile(fidcas, numverts2)
        verts2   = array.array('f'); verts2.fromfile(fidcas, 3 * numverts2)
        normals2 = array.array('f'); normals2.fromfile(fidcas, 3 * numverts2)
        faces2   = array.array('H'); faces2.fromfile(fidcas, 3 * numfaces2)

        triarr = array.array('H')
        base   = len(faces) // 3     # integer division
        for ii in range(base, base + numfaces2):
            groupindex.append(imesh)
            triarr.append(ii)
        grouptris.append(triarr)

        textureId = getuint(fidcas)
        groupmatId.append(textureId)

        if flagTVerts2 == 1:
            tverts2 = array.array('f'); tverts2.fromfile(fidcas, 2 * numverts2)
        else:
            tverts2 = []

        if flagVColors2 == 1:
            vcolors2 = array.array('b'); vcolors2.fromfile(fidcas, 4 * numverts2)
        else:
            vcolors2 = []

        int_zero11 = getuint(fidcas)

        nvcur = len(verts) // 3      # integer division
        for ii in range(numfaces2):
            faces.append(faces2[3*ii+0] + nvcur)
            faces.append(faces2[3*ii+1] + nvcur)
            faces.append(faces2[3*ii+2] + nvcur)

        for ii in range(numverts2):
            boneIds.append(boneIds2[ii])
            verts.append(verts2[3*ii+0])
            verts.append(verts2[3*ii+1])
            verts.append(verts2[3*ii+2])
            normals.append(normals2[3*ii+0])
            normals.append(normals2[3*ii+1])
            normals.append(normals2[3*ii+2])
            if tverts2:
                tverts.append(tverts2[2*ii+0])
                tverts.append(tverts2[2*ii+1])
            if flagVColors == 1 and flagVColors2 == 1:
                vcolors.append(vcolors2[4*ii+0])
                vcolors.append(vcolors2[4*ii+1])
                vcolors.append(vcolors2[4*ii+2])
                vcolors.append(vcolors2[4*ii+3])

    # Correct geometry: x -> -x.
    for ii in range(len(verts) // 3):   # integer division
        verts[3*ii]   = -verts[3*ii]
        normals[3*ii] = -normals[3*ii]

    # Flip face winding.
    for ii in range(len(faces) // 3):   # integer division
        tmp           = faces[3*ii+1]
        faces[3*ii+1] = faces[3*ii+2]
        faces[3*ii+2] = tmp

    meshdata = [FLAGRESOURCE, chunkstr, boneIds, verts, normals, faces,
                textureId, tverts, vcolors, groupnames, grouptris,
                groupmatId, groupindex, groupcomments]
    return meshdata


def readcasmeshfooter(fidcas, fidtxt, flags):
    int_vec1 = array.array('I'); int_vec1.fromfile(fidcas, 13)
    footerstr = str(int_vec1[0])
    for ii in range(1, 13):
        footerstr += ' ' + str(int_vec1[ii])

    int_footsize = getuint(fidcas)
    footerstr += ' ' + str(int_footsize)

    int_vec2 = array.array('I'); int_vec2.fromfile(fidcas, 3)
    for ii in range(3):
        footerstr += ' ' + str(int_vec2[ii])

    getubyte(fidcas)

    nch = int_footsize - 75
    tmpstring = getstring(fidcas, nch)
    tokens = tmpstring.split()
    if len(tokens) > 1:
        texturefilestring = tokens[0]
        for ii in range(1, len(tokens)):
            texturefilestring += '%' + tokens[ii]
    else:
        texturefilestring = tmpstring
    footerstr += ' ' + texturefilestring

    getubyte(fidcas)

    float_vec1 = array.array('f'); float_vec1.fromfile(fidcas, 14)
    for ii in range(14):
        footerstr += ' ' + str(float_vec1[ii])

    lastbyte = getubyte(fidcas)
    return [footerstr]


def readcasnavymeshfooter(fidcas, fidtxt, flags):
    footerstr = str(getushort(fidcas))
    int_vec1 = array.array('I'); int_vec1.fromfile(fidcas, 17)
    for ii in range(17):
        footerstr += ' ' + str(int_vec1[ii])

    int_footsize = getuint(fidcas)
    footerstr += ' ' + str(int_footsize)

    int_vec2 = array.array('I'); int_vec2.fromfile(fidcas, 3)
    for ii in range(3):
        footerstr += ' ' + str(int_vec2[ii])

    getubyte(fidcas)
    nch = int_footsize - 75
    texturefilestring = getstring(fidcas, nch)
    footerstr += ' ' + texturefilestring

    getubyte(fidcas)

    float_vec1 = array.array('f'); float_vec1.fromfile(fidcas, 14)
    for ii in range(14):
        footerstr += ' ' + str(float_vec1[ii])

    getubyte(fidcas)
    return [footerstr]


def readcasresourcemeshfooter(fidcas, fidtxt, flags):
    nch = getuint(fidcas)
    footerstr = str(nch)
    AttribString = getstring(fidcas, nch - 1)
    dummy = getubyte(fidcas)
    footerstr += ' ' + AttribString
    footerstr += ' ' + str(getuint(fidcas))
    byte_zero1 = getubyte(fidcas)
    footerstr += ' ' + str(getuint(fidcas))
    byte_zero2 = getubyte(fidcas)

    float_vec0 = array.array('f'); float_vec0.fromfile(fidcas, 9)
    for ii in range(9):
        footerstr += ' ' + str(float_vec0[ii])

    footerstr += ' ' + str(getushort(fidcas))
    footerstr += ' ' + str(getint(fidcas))
    footerstr += ' ' + str(getushort(fidcas))

    int_vec0 = array.array('I'); int_vec0.fromfile(fidcas, 18)
    for ii in range(18):
        footerstr += ' ' + str(int_vec0[ii])

    footsize = getuint(fidcas)
    nch = footsize - 75
    footerstr += ' ' + str(footsize)
    footerstr += ' ' + str(getint(fidcas))
    footerstr += ' ' + str(getint(fidcas))
    footerstr += ' ' + str(getint(fidcas))
    getubyte(fidcas)
    texturefilename = getstring(fidcas, nch)
    footerstr += ' ' + texturefilename
    byte_zero2 = getubyte(fidcas)

    float_vec1 = array.array('f'); float_vec1.fromfile(fidcas, 14)
    for ii in range(14):
        footerstr += ' ' + str(float_vec1[ii])

    lastbyte = getubyte(fidcas)
    return [footerstr]


def readcasvariantresourcemeshfooter(fidcas, fidtxt, flags):
    footerstr = str(getushort(fidcas))
    for ii in range(17):
        footerstr += ' ' + str(getuint(fidcas))

    footsize = getuint(fidcas)
    nch = footsize - 75
    footerstr += ' ' + str(footsize)
    footerstr += ' ' + str(getint(fidcas))
    footerstr += ' ' + str(getint(fidcas))
    footerstr += ' ' + str(getint(fidcas))
    getubyte(fidcas)
    texturefilename = getstring(fidcas, nch)
    footerstr += ' ' + texturefilename
    getubyte(fidcas)

    float_vec1 = array.array('f'); float_vec1.fromfile(fidcas, 14)
    for ii in range(14):
        footerstr += ' ' + str(float_vec1[ii])

    lastbyte = getubyte(fidcas)
    return [footerstr]


def readcasfile(fncas, fntxt, flags):
    WRITECASTXTFILE = fntxt != []
    casfiledatalist = []
    fidtxt = []

    fidcas = open(fncas, 'rb')

    if WRITECASTXTFILE:
        mode = 'a' if flags.isdir == 1 else 'w'
        fidtxt = open(fntxt, mode, encoding='latin-1')

    quatfloats = array.array('f')
    animfloats = array.array('f')
    posefloats = array.array('f')

    nnavy     = fncas.find('navy')
    nresource = fncas.find('resource')
    nsymbol   = fncas.find('symbol')

    headerdata    = readandwritecasheader(fidcas, fidtxt, flags)
    version_float = headerdata[0]
    signaturebyte = headerdata[12]

    FLAGRESOURCE = (signaturebyte == 99) or (nresource > -1) or (nsymbol > -1)
    FLAGNAVY     = nnavy > -1

    casfiledatalist.append(headerdata)      # Index 0

    filesizesans = getuint(fidcas)
    int_zero     = getuint(fidcas)
    casfiledatalist.append(filesizesans)    # Index 1
    casfiledatalist.append(int_zero)        # Index 2

    if WRITECASTXTFILE and flags.filesize == 1:
        fidtxt.write(str(filesizesans).ljust(3) + ' ' + str(int_zero).ljust(3) + '\n')

    hierarchydata = readandwritecashierarchytree(fidcas, fidtxt, version_float, flags)
    nbones = len(hierarchydata)
    casfiledatalist.append(hierarchydata)   # Index 3

    timeticksdata = readandwritecastimeticks(fidcas, fidtxt, version_float, flags)
    casfiledatalist.append(timeticksdata)   # Index 4

    bonedata = readandwritecasbonesection(fidcas, fidtxt, nbones, version_float, flags)
    casfiledatalist.append(bonedata)        # Index 5

    nquatframes = 0
    nanimframes = 0
    nposeframes = 0
    quatframesperbone = bonedata[1]
    animframesperbone = bonedata[2]
    onesperbone       = bonedata[6]
    for ii in range(nbones):
        nquatframes += quatframesperbone[ii]
        nanimframes += animframesperbone[ii]
        nposeframes += onesperbone[ii]

    quatfloats.fromfile(fidcas, nquatframes * 4)
    casfiledatalist.append(quatfloats)      # Index 6

    animfloats.fromfile(fidcas, nanimframes * 3)
    casfiledatalist.append(animfloats)      # Index 7

    posefloats.fromfile(fidcas, nposeframes * 3)
    casfiledatalist.append(posefloats)      # Index 8

    eulers = computeeulers(quatfloats)
    casfiledatalist.append(eulers)          # Index 9

    if WRITECASTXTFILE and flags.alldata == 1:
        writecasdatatotext(fidtxt, bonedata, quatfloats, animfloats, posefloats, eulers)

    meshdata = readandwritecasmeshmiddle(fidcas, fidtxt, FLAGRESOURCE, FLAGNAVY)

    bonenames = bonedata[0]
    poseabs   = []
    ib = 0
    poseabs.append(-posefloats[3*ib+0])
    poseabs.append( posefloats[3*ib+1])
    poseabs.append( posefloats[3*ib+2])

    nbones2 = len(posefloats) // 3   # integer division
    for ib in range(1, nbones2):
        idx = hierarchydata[ib]
        poseabs.append(-posefloats[3*ib+0] + poseabs[3*idx+0])
        poseabs.append( posefloats[3*ib+1] + poseabs[3*idx+1])
        poseabs.append( posefloats[3*ib+2] + poseabs[3*idx+2])

    boneIds = meshdata[2]
    verts   = meshdata[3]
    for iv in range(len(boneIds)):
        Id = boneIds[iv]
        verts[3*iv+0] += poseabs[3*Id+0]
        verts[3*iv+1] += poseabs[3*Id+1]
        verts[3*iv+2] += poseabs[3*Id+2]
    meshdata[3] = verts

    for iv in range(len(boneIds)):
        boneIds[iv] -= 1
    meshdata[2] = boneIds

    casfiledatalist.append(meshdata)        # Index 10

    if FLAGRESOURCE:
        intchoice = getuint(fidcas)
        fidcas.seek(-4, 1)
        if intchoice == 26:
            footerdata = readcasresourcemeshfooter(fidcas, fidtxt, flags)
        else:
            footerdata = readcasvariantresourcemeshfooter(fidcas, fidtxt, flags)
    elif FLAGNAVY:
        footerdata = readcasnavymeshfooter(fidcas, fidtxt, flags)
    else:
        footerdata = readcasmeshfooter(fidcas, fidtxt, flags)
    casfiledatalist.append(footerdata)      # Index 11

    fidcas.close()
    if WRITECASTXTFILE:
        fidtxt.close()

    return casfiledatalist


# ===================================================================================
#    Utility for writing a full format .cas file
# ===================================================================================

def computefilesizesans(casfiledatalist):
    hierarchydata = casfiledatalist[3]
    timeticksdata = casfiledatalist[4]
    bonedata      = casfiledatalist[5]
    quatfloats    = casfiledatalist[6]
    animfloats    = casfiledatalist[7]
    posefloats    = casfiledatalist[8]

    filesizesans = 8
    filesizesans += 4 * len(hierarchydata) + 2
    filesizesans += 4 * (len(timeticksdata) + 1)

    bonenames = bonedata[0]
    for name in bonenames:
        filesizesans += len(name) + 1 + 7 * 4 + 1

    filesizesans += 4 * len(quatfloats)
    filesizesans += 4 * len(animfloats)
    filesizesans += 4 * len(posefloats)

    return filesizesans


def writecasheader(fidcas, headerdata):
    putfloat(headerdata[0],  fidcas)
    putuint( headerdata[1],  fidcas)
    putuint( headerdata[2],  fidcas)
    putuint( headerdata[3],  fidcas)
    putfloat(headerdata[4],  fidcas)
    putuint( headerdata[5],  fidcas)
    putuint( headerdata[6],  fidcas)
    putubyte(headerdata[7],  fidcas)
    putubyte(headerdata[8],  fidcas)
    putubyte(headerdata[9],  fidcas)
    putuint( headerdata[10], fidcas)
    putuint( headerdata[11], fidcas)
    putubyte(headerdata[12], fidcas)
    putubyte(headerdata[13], fidcas)
    putubyte(headerdata[14], fidcas)


def writecashierarchydata(fidcas, hierarchydata):
    putushort(len(hierarchydata), fidcas)
    hierarchydata.tofile(fidcas)


def writecastimeticksdata(fidcas, timeticksdata):
    putuint(len(timeticksdata), fidcas)
    timeticksdata.tofile(fidcas)


def writecasbonedata(fidcas, bonedata, version_float):
    bonenames         = bonedata[0]
    quatframesperbone = bonedata[1]
    animframesperbone = bonedata[2]
    quatoffsetperbone = bonedata[3]
    animoffsetperbone = bonedata[4]
    zerosperbone      = bonedata[5]
    onesperbone       = bonedata[6]
    nbones = len(bonenames)
    old_versions = [3.02, 2.23, 3.0, 2.22, 3.12, 3.05, 2.19]

    for ii in range(nbones):
        name = bonenames[ii]
        nch  = len(name) + 1
        putuint(nch, fidcas)
        putstring(name, fidcas)
        putubyte(0, fidcas)
        putuint(quatframesperbone[ii], fidcas)
        putuint(animframesperbone[ii], fidcas)
        putuint(quatoffsetperbone[ii], fidcas)
        putuint(animoffsetperbone[ii], fidcas)
        putuint(zerosperbone[ii],      fidcas)
        if version_float not in old_versions:
            putuint(onesperbone[ii], fidcas)
            putubyte(0, fidcas)


def writecasfile(fncas, casfiledatalist):
    headerdata    = casfiledatalist[0]
    hierarchydata = casfiledatalist[3]
    timeticksdata = casfiledatalist[4]
    bonedata      = casfiledatalist[5]
    quatfloats    = casfiledatalist[6]
    animfloats    = casfiledatalist[7]
    posefloats    = casfiledatalist[8]
    version_float = headerdata[0]

    filesizesans = computefilesizesans(casfiledatalist)

    fidcas = open(fncas, 'wb')
    writecasheader(fidcas, headerdata)
    putuint(filesizesans, fidcas)
    putuint(0, fidcas)
    writecashierarchydata(fidcas, hierarchydata)
    writecastimeticksdata(fidcas, timeticksdata)
    writecasbonedata(fidcas, bonedata, version_float)
    quatfloats.tofile(fidcas)
    animfloats.tofile(fidcas)
    posefloats.tofile(fidcas)
    fidcas.close()


# ===================================================================================
#    Main / GUI  (Milkshape .ms3d -> .cas converter stub)
# ===================================================================================

class Flags:
    def __init__(self):
        self.header    = 1
        self.hierarchy = 1
        self.timeticks = 1
        self.bones     = 1
        self.filesize  = 1
        self.footer    = 1
        self.alldata   = 0
        self.isdir     = 0


def run_converter():
    root = Tk()
    root.withdraw()

    from tkinter.filedialog import askopenfilename
    fncas = askopenfilename(
        title='Select .cas strat model file',
        filetypes=[('CAS files', '*.cas'), ('All files', '*.*')]
    )
    if not fncas:
        print('No file selected.')
        return

    parts  = splitpath(fncas)
    fntxt  = os.path.join(parts[0], parts[1] + '_dump.txt')
    fnout  = os.path.join(parts[0], parts[1] + '_out.cas')

    flags = Flags()
    flags.alldata = 1

    print('Reading: ' + fncas)
    casdata = readcasfile(fncas, fntxt, flags)
    print('Done reading. Text dump written to: ' + fntxt)

    print('Writing: ' + fnout)
    writecasfile(fnout, casdata)
    print('Done writing: ' + fnout)

    showwarning('Done', 'Conversion complete!\nDump: ' + fntxt + '\nOutput: ' + fnout)
    root.destroy()


if __name__ == '__main__':
    run_converter()
