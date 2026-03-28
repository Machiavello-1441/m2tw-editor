# ===================================================================================
#  stratmodelconverter.py  -  Python 3 port of KnightErrant's strat model converter
# ===================================================================================
# Run this script directly:
#   python stratmodelconverter.py
#
# Requires: stratmodelconverter_lib.py in the same directory.
#
# Supports:
#   *.cas  ->  *.ms3d    (convertcastoms3d)
#   *.ms3d ->  *_converted.cas  (convertms3dtocas)
# ===================================================================================

import array
import os
import os.path
import tkinter as tk
from tkinter import filedialog
from tkinter.messagebox import showwarning

from stratmodelconverter_lib import (
    # binary i/o helpers
    getfloat, getuint, getushort, getushort, getint, getubyte, getstring,
    putfloat, putuint, putushort, putint, putubyte, putstring, putbyte, putzerobytes,
    # cas
    readcasfile, writecasfile,
    # ms3d
    readms3dfile, writems3dfile,
    # data classes
    dataflags if False else object,  # dummy – use class below
)

# Re-import everything from lib so we can use it freely
from stratmodelconverter_lib import *


# ===================================================================================
# Flags class (simple data container).
# ===================================================================================
class dataflags:
    def __init__(self):
        self.header    = 0
        self.filesize  = 0
        self.hierarchy = 0
        self.timeticks = 0
        self.bones     = 0
        self.alldata   = 0
        self.footer    = 0
        self.isdir     = 0


# ===================================================================================
# convertcastoms3d
# ===================================================================================
def convertcastoms3d(fncas, fntxt, flags):
    cdl    = readcasfile(fncas, fntxt, flags)
    nch    = fncas.find('.cas')
    fnms3d = fncas[0:nch] + '.ms3d'
    print('fnms3d = ' + fnms3d)
    FLAGNAVY = 'navy' in fncas

    hd=cdl[0]; fsz=cdl[1]; iz=cdl[2]; hier=cdl[3]; tt=cdl[4]
    bd=cdl[5]; qf=cdl[6]; af=cdl[7]; pf=cdl[8]
    eu=cdl[9]; md=cdl[10]; foot=cdl[11]
    print('footerdata[0] = ' + str(foot[0]))

    FR=md[0]; chunkstr=md[1]; boneIds=md[2]; verts=md[3]; normals=md[4]
    faces=md[5]; textureId=md[6]; tverts=md[7]; vcolors=md[8]
    groupnames=md[9]; grouptris=md[10]; groupmatIds=md[11]
    groupindex=md[12]; groupcomments=md[13]

    # MS3D header
    msheaderdata = [b'MS3D000000', 4]

    # Vertex data
    numverts = len(boneIds)
    vertexdata = [[1]*numverts, verts, boneIds, [1]*numverts]

    # Face data
    numfaces       = len(faces) // 3
    triflags       = [1] * numfaces
    s_array        = []; t_array = []; smoothingGroup = []
    for ii in range(numfaces):
        idx1=faces[3*ii]; idx2=faces[3*ii+1]; idx3=faces[3*ii+2]
        s_array += [tverts[2*idx1], tverts[2*idx2], tverts[2*idx3]]
        t_array += [tverts[2*idx1+1], tverts[2*idx2+1], tverts[2*idx3+1]]
        smoothingGroup.append(1)
    triangledata = [triflags, faces, normals, s_array, t_array, smoothingGroup, groupindex]

    # Group data
    nummeshes = len(groupnames)
    groupdata = [[1]*nummeshes, groupnames, grouptris, groupmatIds]

    # Standard materials
    NULL128 = b'\x00'*128
    FIG32   = b'Figure\x00' + b'\x00'*25
    ATT32   = b'Attachments\x00' + b'\x00'*20
    amb = array.array('f',[1.0,1.0,1.0,1.0]); dif = array.array('f',[0.8,0.8,0.8,1.0])
    spc = array.array('f',[0.0,0.0,0.0,1.0]); ems = array.array('f',[0.0,0.0,0.0,1.0])
    mat0 = [FIG32,amb,dif,spc,ems,0.0,1.0,0,NULL128,NULL128]
    mat1 = [ATT32,amb,dif,spc,ems,0.0,1.0,0,NULL128,NULL128]
    materialdata = [mat0, mat1]

    keyframerdata = [5.0, 0.0, 1]

    # Joints
    bonenames = bd[0]; nbones = len(bonenames)
    parentnames = ['']
    for ib in range(2, nbones): parentnames.append(bonenames[hier[ib]])
    localrot = array.array('f',[0.0,0.0,0.0])
    rotfr = array.array('f'); posfr = array.array('f')
    jointdata = []
    for ib in range(1, nbones):
        lp = array.array('f',[-pf[3*ib], pf[3*ib+1], pf[3*ib+2]])
        jointdata.append([8, bonenames[ib], parentnames[ib-1], localrot, lp, rotfr, posfr])

    subversionnum1 = 1

    groupindices_c = list(range(nummeshes))
    groupcommentdata = [groupindices_c, groupcomments]

    headerstr    = ' '.join(str(v) for v in hd)
    hierarchystr = ' '.join(str(v) for v in hier)
    timeticksstr = ' '.join(str(v) for v in tt)
    firstmatcomment = headerstr + '%%' + hierarchystr + '%%' + timeticksstr
    materialcommentdata = [[0,1], [firstmatcomment, chunkstr]]

    jointcommentdata = []
    modelcommentdata = [foot[0]]
    subversionnum2   = 2

    vbs = array.array('b',[-1]*numverts); vbt = array.array('b',[-1]*numverts)
    vbf = array.array('b',[-1]*numverts); vwt = array.array('B'); vtw = array.array('B',[0]*numverts)
    ext = array.array('I',[0]*numverts)
    for _ in range(numverts): vwt.append(100); vwt.append(0)
    weightdata = [vbs, vbt, vbf, vwt, vtw, ext]

    ms3dfiledatalist = [msheaderdata, vertexdata, triangledata, groupdata,
                        materialdata, keyframerdata, jointdata, subversionnum1,
                        groupcommentdata, materialcommentdata, jointcommentdata,
                        modelcommentdata, subversionnum2, weightdata]
    writems3dfile(fnms3d, ms3dfiledatalist)


# ===================================================================================
# convertms3dtocas
# ===================================================================================
def convertms3dtocas(fnms3d, fncas):
    dl = readms3dfile(fnms3d, [])
    hd=dl[0]; vd=dl[1]; td=dl[2]; gd=dl[3]; matd=dl[4]; kd=dl[5]
    jd=dl[6]; sv1=dl[7]; gc=dl[8]; mc=dl[9]; jc=dl[10]; mmc=dl[11]; sv2=dl[12]; wd=dl[13]

    matindices=mc[0]; matcomments=mc[1]
    fmc=matcomments[0]; chunkstr=matcomments[1]
    parts=fmc.split('%%')
    headerstr=parts[0]; hierarchystr=parts[1]; timeticksstr=parts[2]
    header=headerstr.split()

    FR = (int(header[12])==99) or ('resource' in fnms3d) or ('symbol' in fnms3d)
    FN = 'navy' in fnms3d
    if FR: print('Converting a resource model.')
    else:  print('Converting a non-resource model.')

    hierarchy = [int(x) for x in hierarchystr.split()]
    timeticks = [float(x) for x in timeticksstr.split()]
    bonenames = [j[1] for j in jd]
    nbones    = len(bonenames)

    # Compute filesizesans
    fsz  = 8 + 4*len(hierarchy)+2 + 4*(len(timeticks)+1)
    fsz += 10+1+7*4+1 + 12   # Scene_Root
    for bn in bonenames:
        enc = bn.encode('latin-1') if isinstance(bn,str) else bn
        fsz += len(enc)+1+7*4+1
    fsz += 4*3*nbones

    fid = open(fncas, 'wb')

    # Write CAS header from stored token list
    putfloat(float(header[0]),fid); putuint(int(header[1]),fid); putuint(int(header[2]),fid)
    putuint(int(header[3]),fid);   putfloat(float(header[4]),fid); putuint(int(header[5]),fid)
    putuint(int(header[6]),fid);   putubyte(int(header[7]),fid); putubyte(int(header[8]),fid)
    putubyte(int(header[9]),fid);  putuint(int(header[10]),fid); putuint(int(header[11]),fid)
    putubyte(int(header[12]),fid); putubyte(int(header[13]),fid); putubyte(int(header[14]),fid)
    putuint(fsz,fid); putuint(0,fid)

    # Hierarchy
    putushort(len(hierarchy),fid)
    for v in hierarchy: putuint(int(v),fid)

    # Timeticks
    putuint(len(timeticks),fid)
    for v in timeticks: putfloat(float(v),fid)

    # Bone section — Scene_Root first
    putuint(11,fid); putstring(b'Scene_Root',fid); putubyte(0,fid)
    for _ in range(5): putuint(0,fid)
    putuint(1,fid); putubyte(0,fid)
    for bn in bonenames:
        enc=bn.encode('latin-1') if isinstance(bn,str) else bn
        putuint(len(enc)+1,fid); putstring(enc,fid); putubyte(0,fid)
        for _ in range(5): putuint(0,fid)
        putuint(1,fid); putubyte(0,fid)

    # Pose floats
    putfloat(0.0,fid); putfloat(0.0,fid); putfloat(0.0,fid)
    poseabs = []
    if len(jd) > 0:
        lp=jd[0][4]
        putfloat(-lp[0],fid); putfloat(lp[1],fid); putfloat(lp[2],fid)
        poseabs = [-lp[0], lp[1], lp[2]]
        print("poseabs[0,1,2] = ("+str(poseabs[0])+", "+str(poseabs[1])+", "+str(poseabs[2])+")")
        for ii in range(1, len(jd)):
            lp=jd[ii][4]
            putfloat(-lp[0],fid); putfloat(lp[1],fid); putfloat(lp[2],fid)
            idx=hierarchy[ii+1]-1
            print("For ii = "+str(ii)+", hierarchy idx = "+str(idx))
            poseabs += [-lp[0]+poseabs[3*idx], lp[1]+poseabs[3*idx+1], lp[2]+poseabs[3*idx+2]]
            print("poseabs[0,1,2] = ("+str(poseabs[3*ii])+", "+str(poseabs[3*ii+1])+", "+str(poseabs[3*ii+2])+")")

    verts   = vd[1]; boneIds = vd[2]; nverts = len(boneIds)
    faces   = td[1]; normals = td[2]; s_array = td[3]; t_array = td[4]
    groupnames = gd[1]; grouptris = gd[2]; groupmatId = gd[3]
    groupcomments_ms3d = gc[1] if gc != [] else []
    nummeshes = len(groupnames)
    print("Size of s_array = "+str(len(s_array))+", size of t_array = "+str(len(t_array)))
    nfaces    = len(faces) // 3
    tokens_c  = chunkstr.split(); nct = len(tokens_c)

    # Compute mesh chunk offset
    if FR:
        modelcomments = mmc[0]; footerstr = modelcomments[0]
        tok_f = footerstr.split()
        offset = 110 if (int(tok_f[0])==26 or nct==19) else 24
        offset += 32*nverts + 6*nfaces
        for gnm in groupnames:
            enc=gnm.encode('latin-1') if isinstance(gnm,str) else gnm
            offset += len(enc)+47+8
    elif FN:
        offset = 110 + 32*nverts + 6*nfaces
        for gnm in groupnames:
            enc=gnm.encode('latin-1') if isinstance(gnm,str) else gnm
            offset += len(enc)+47+8
    else:
        offset = 16 + 36*nverts + 6*nfaces
        for gnm in groupnames:
            enc=gnm.encode('latin-1') if isinstance(gnm,str) else gnm
            offset += len(enc)+44+8

    # Write chunk header
    if (not FR) and (not FN) and (nct==8):
        for i in [0,1,2,3]: putuint(int(tokens_c[i]),fid)
        putushort(int(tokens_c[4]),fid); putuint(int(offset),fid)
        putuint(int(tokens_c[6]),fid); putuint(nummeshes,fid)
    elif (not FR) and (not FN) and (nct==24):
        print('Doing attrib node')
        for i in [0,1,2,3]: putuint(int(tokens_c[i]),fid)
        putstring(tokens_c[4].encode('latin-1'),fid); putubyte(0,fid)
        putuint(int(tokens_c[5]),fid); putubyte(0,fid)
        putuint(int(tokens_c[6]),fid); putubyte(0,fid)
        for i in range(7,16): putfloat(float(tokens_c[i]),fid)
        putushort(int(tokens_c[16]),fid); putint(int(tokens_c[17]),fid); putushort(int(tokens_c[18]),fid)
        putuint(int(tokens_c[19]),fid); putuint(int(tokens_c[20]),fid)
        putuint(offset,fid); putuint(int(tokens_c[22]),fid); putuint(nummeshes,fid)
    elif FR and (nct==3):
        putuint(offset,fid); putuint(int(tokens_c[1]),fid); putuint(int(tokens_c[2]),fid)
    elif FN or (FR and nct>3):
        putuint(offset,fid); putuint(int(tokens_c[1]),fid); putuint(int(tokens_c[2]),fid)
        putuint(int(tokens_c[3]),fid)
        putstring(tokens_c[4].encode('latin-1'),fid); putubyte(0,fid)
        putuint(int(tokens_c[5]),fid); putubyte(0,fid)
        putuint(int(tokens_c[6]),fid); putubyte(0,fid)
        for i in range(7,16): putfloat(float(tokens_c[i]),fid)
        putushort(int(tokens_c[16]),fid); putint(int(tokens_c[17]),fid); putuint(int(tokens_c[18]),fid)

    # Loop over meshes
    nv = 0
    for imesh in range(nummeshes):
        tid_m  = groupmatId[imesh]
        gnm    = groupnames[imesh]
        enc    = gnm.encode('latin-1') if isinstance(gnm,str) else gnm
        nch    = len(enc)
        putuint(nch+1,fid); putstring(enc,fid); putubyte(0,fid)

        if FR or FN:
            comment = groupcomments_ms3d[imesh]
            tok = comment.split()
            putuint(int(tok[0]),fid); putubyte(0,fid)
            putuint(int(tok[1]),fid); putubyte(0,fid)
            putuint(int(tok[2]),fid)
            for i in range(3,10): putfloat(float(tok[i]),fid)
        else:
            putuint(1,fid); putubyte(0,fid)
            for _ in range(7): putfloat(0.0,fid)

        triarr = grouptris[imesh]; ntris = len(triarr)
        imin=100000; imax=-10000
        for itri in range(ntris):
            idx=triarr[itri]
            for k in range(3):
                v=faces[3*idx+k]
                if v>imax: imax=v
                if v<imin: imin=v

        print("For mesh "+str(imesh)+", imin="+str(imin)+", imax="+str(imax))
        putushort(imax+1-imin,fid); putushort(ntris,fid)
        putubyte(1,fid); putubyte(0,fid)

        if boneIds[0] > -1:
            for ii in range(imin, imax+1): putuint(boneIds[ii]+1,fid)

        for ii in range(imin, imax+1):
            Id=boneIds[ii]
            if Id > -1:
                putfloat(-verts[3*ii]-poseabs[3*Id],   fid)
                putfloat( verts[3*ii+1]-poseabs[3*Id+1],fid)
                putfloat( verts[3*ii+2]-poseabs[3*Id+2],fid)
            else:
                putfloat(-verts[3*ii],fid); putfloat(verts[3*ii+1],fid); putfloat(verts[3*ii+2],fid)

        for ii in range(imin, imax+1):
            putfloat(-normals[3*ii],fid); putfloat(normals[3*ii+1],fid); putfloat(normals[3*ii+2],fid)

        for itri in range(ntris):
            idx=triarr[itri]
            putushort(faces[3*idx+0]-nv,fid)
            putushort(faces[3*idx+2]-nv,fid)   # switched indices
            putushort(faces[3*idx+1]-nv,fid)

        svert = array.array('f',[0.0]*(imax+1-imin))
        tvert = array.array('f',[0.0]*(imax+1-imin))
        for itri in range(ntris):
            idx=triarr[itri]
            i1=faces[3*idx]-nv; i2=faces[3*idx+1]-nv; i3=faces[3*idx+2]-nv
            svert[i1]=s_array[3*idx]; svert[i2]=s_array[3*idx+1]; svert[i3]=s_array[3*idx+2]
            tvert[i1]=t_array[3*idx]; tvert[i2]=t_array[3*idx+1]; tvert[i3]=t_array[3*idx+2]

        putuint(tid_m,fid)
        for ii in range(imax+1-imin): putfloat(svert[ii],fid); putfloat(tvert[ii],fid)
        putuint(0,fid)
        nv += imax+1-imin
        print("nv = "+str(nv))

    # Footer
    modelcomments = mmc[0]; footerstr = modelcomments[0]
    print('footer = '+footerstr); tok_f = footerstr.split(); ntoks = len(tok_f)
    print('ntoks  = '+str(ntoks))

    if FR and (int(tok_f[0])==26):
        att=tok_f[1]; txf=tok_f[38]; fs=75+len(txf); nch2=len(att)
        putuint(nch2+1,fid); putstring(att.encode('latin-1'),fid); putubyte(0,fid)
        putuint(int(tok_f[2]),fid); putubyte(0,fid); putuint(int(tok_f[3]),fid); putubyte(0,fid)
        for i in range(4,13): putfloat(float(tok_f[i]),fid)
        putushort(int(tok_f[13]),fid); putint(int(tok_f[14]),fid); putushort(int(tok_f[15]),fid)
        for i in range(16,34): putuint(int(tok_f[i]),fid)
        putuint(fs,fid); putuint(int(tok_f[35]),fid); putuint(int(tok_f[36]),fid); putuint(int(tok_f[37]),fid)
        putubyte(0,fid); putstring(tok_f[38].encode('latin-1'),fid); putubyte(0,fid)
        for i in range(39,53): putfloat(float(tok_f[i]),fid)
        putubyte(1,fid)
    elif FR and (int(tok_f[0])==0):
        putushort(int(tok_f[0]),fid)
        for i in range(1,18): putuint(int(tok_f[i]),fid)
        fs=len(tok_f[22])+75; putuint(fs,fid)
        putuint(int(tok_f[19]),fid); putuint(int(tok_f[20]),fid); putuint(int(tok_f[21]),fid)
        putubyte(0,fid); putstring(tok_f[22].encode('latin-1'),fid); putubyte(0,fid)
        for i in range(23,37): putfloat(float(tok_f[i]),fid)
        putubyte(1,fid)
    elif FN:
        txf=tok_f[22]; fs=75+len(txf)
        putushort(int(tok_f[0]),fid)
        for i in range(1,18): putuint(int(tok_f[i]),fid)
        putuint(fs,fid); putuint(int(tok_f[19]),fid); putuint(int(tok_f[20]),fid); putuint(int(tok_f[21]),fid)
        putubyte(0,fid); putstring(txf.encode('latin-1'),fid); putubyte(0,fid)
        for i in range(23,37): putfloat(float(tok_f[i]),fid)
        putubyte(1,fid)
    else:
        txf=tok_f[17].replace('%',' '); fs=75+len(txf)
        putuint(nummeshes,fid)
        for i in range(1,13): putuint(int(tok_f[i]),fid)
        putuint(fs,fid); putuint(int(tok_f[14]),fid); putuint(int(tok_f[15]),fid); putuint(int(tok_f[16]),fid)
        putubyte(0,fid); putstring(txf.encode('latin-1'),fid); putubyte(0,fid)
        for i in range(18,32): putfloat(float(tok_f[i]),fid)
        putubyte(1,fid)

    fid.close()


# ===================================================================================
# main()
# ===================================================================================
UNSUPPORTED = {
    'resource_wool.cas','navy_eastern.cas','navy_egypt.cas','navy_greek.cas',
    'navy_roman.cas','navy_roman_shadow.cas','late_captain_northern_shadow.cas',
    'spy.cas','princess.cas','priest.cas','diplomat.cas','barb_strat_map_captain.cas',
    'bishop.cas','captain_drag_model.cas','cardinal.cas','carthage_strat_captain.cas',
    'character_pontus.cas','crossed_swords.cas','flood_water.cas','general_pontus.cas',
    'good_old_blue.cas','inquisitor.cas','resource_chocolate.cas','resource_mine.cas',
}

flags          = dataflags()
flags.header   = 1; flags.filesize  = 1; flags.hierarchy = 1; flags.timeticks = 1
flags.bones    = 1; flags.alldata   = 1; flags.footer    = 1; flags.isdir     = 0

root = tk.Tk(); root.withdraw()
fn = filedialog.askopenfilename(
    title='Select a .cas or .ms3d file',
    filetypes=[('CAS/MS3D files','*.cas *.ms3d'),('All files','*.*')]
)
if not fn:
    print('No file selected, exiting.'); exit()

print('file name = ' + fn)
head, tail = os.path.split(fn)
if tail in UNSUPPORTED:
    showwarning('Bad File','Cannot process '+tail+', must terminate script.'); exit()

root_path, ext = os.path.splitext(fn)
if ext.lower() == '.cas':
    convertcastoms3d(fn, [], flags)
elif ext.lower() == '.ms3d':
    convertms3dtocas(fn, root_path + '_converted.cas')
