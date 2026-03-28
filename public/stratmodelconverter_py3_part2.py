# ===================================================================================
#     stratmodelconverter_py3_part2.py  —  MS3D reader/writer + conversion routines
#     Import part1 before using this file, OR concatenate both files together.
# ===================================================================================
# Usage:  cat stratmodelconverter_py3_part1.py stratmodelconverter_py3_part2.py > stratmodelconverter_py3.py

# ===================================================================================
# MS3D reader
# ===================================================================================
def readvertices(fidms3d, fout):
    nvert = getushort(fidms3d)
    if fout != []:
        s = 'Number of vertices = ' + str(nvert); fout.write(s+'\n'); fout.flush(); print(s)
    vflags = array.array('B',[0]*nvert); vrefs = array.array('B',[0]*nvert)
    vbonesPrimary = array.array('b',[0]*nvert)
    vvecs = array.array('f',[0.0]*(3*nvert)); vnorms = array.array('f',[0.0]*(3*nvert))
    for ii in range(nvert):
        vflags[ii]        = getubyte(fidms3d)
        vvecs[3*ii]       = getfloat(fidms3d); vvecs[3*ii+1] = getfloat(fidms3d); vvecs[3*ii+2] = getfloat(fidms3d)
        vbonesPrimary[ii] = getbyte(fidms3d);  vrefs[ii]     = getubyte(fidms3d)
    return [vflags, vvecs, vbonesPrimary, vrefs]


def readtriangles(fidms3d, fout, nvert):
    ntriangles = getushort(fidms3d)
    if fout != []:
        s = 'Number of triangle = ' + str(ntriangles); fout.write(s+'\n'); fout.flush(); print(s)
    triflags       = array.array('H',[0]*ntriangles)
    tris           = array.array('H',[0]*(3*ntriangles))
    vnorms         = array.array('f',[0.0]*(3*nvert))
    s              = array.array('f',[0.0]*(3*ntriangles))
    t              = array.array('f',[0.0]*(3*ntriangles))
    smoothingGroup = array.array('B',[0]*ntriangles)
    groupidx       = array.array('B',[0]*ntriangles)
    for ii in range(ntriangles):
        triflags[ii]  = getushort(fidms3d)
        tris[3*ii]    = getushort(fidms3d); tris[3*ii+1] = getushort(fidms3d); tris[3*ii+2] = getushort(fidms3d)
        i1=tris[3*ii]; i2=tris[3*ii+1]; i3=tris[3*ii+2]
        for idx,i in [(0,i1),(1,i2),(2,i3)]:
            vnorms[3*i]=getfloat(fidms3d); vnorms[3*i+1]=getfloat(fidms3d); vnorms[3*i+2]=getfloat(fidms3d)
        s[3*ii]=getfloat(fidms3d); s[3*ii+1]=getfloat(fidms3d); s[3*ii+2]=getfloat(fidms3d)
        t[3*ii]=getfloat(fidms3d); t[3*ii+1]=getfloat(fidms3d); t[3*ii+2]=getfloat(fidms3d)
        smoothingGroup[ii]=getubyte(fidms3d); groupidx[ii]=getubyte(fidms3d)
    return [triflags, tris, vnorms, s, t, smoothingGroup, groupidx]


def readgroups(fidms3d, fout):
    num_groups = getushort(fidms3d)
    if fout != []:
        s = 'Number of groups = ' + str(num_groups); fout.write(s+'\n'); fout.flush(); print(s)
    gflags=[]; group_names=[]; tri_groups=[]; materialindex=[]
    for ii in range(num_groups):
        gflags.append(getubyte(fidms3d))
        group_names.append(zipstrip(fidms3d.read(32)))
        ntris=getushort(fidms3d); triidx=array.array('H')
        for jj in range(ntris): triidx.append(getushort(fidms3d))
        materialindex.append(getbyte(fidms3d)); tri_groups.append(triidx)
    return [gflags, group_names, tri_groups, materialindex]


def readmaterials(fidms3d, fout):
    nMaterials = getushort(fidms3d)
    if fout != []:
        s = 'Number of materials = ' + str(nMaterials); fout.write(s+'\n'); fout.flush(); print(s)
    materialdata = []
    for jj in range(nMaterials):
        ambient=array.array('f'); diffuse=array.array('f'); specular=array.array('f'); emissive=array.array('f')
        name=fidms3d.read(32)
        ambient.fromfile(fidms3d,4); diffuse.fromfile(fidms3d,4); specular.fromfile(fidms3d,4); emissive.fromfile(fidms3d,4)
        shininess=getfloat(fidms3d); transparency=getfloat(fidms3d); mode=getubyte(fidms3d)
        texture=fidms3d.read(128); alphamap=fidms3d.read(128)
        materialdata.append([name,ambient,diffuse,specular,emissive,shininess,transparency,mode,texture,alphamap])
    return materialdata


def readkeyframer(fidms3d, fout):
    fFPS=getfloat(fidms3d); fCT=getfloat(fidms3d); iTF=getuint(fidms3d)
    if fout != []:
        for lbl,val in [('fAnimationFPS',fFPS),('fCurrentTime',fCT),('iTotalFrames',iTF)]:
            s=lbl+' = '+str(val); fout.write(s+'\n'); fout.flush(); print(s)
    return [fFPS, fCT, iTF]


def readjoints(fidms3d, fout):
    njoints = getushort(fidms3d)
    if fout != []:
        s='Number of joints = '+str(njoints); fout.write(s+'\n'); fout.flush(); print(s)
    jointdata = []
    for ii in range(njoints):
        flags      = getubyte(fidms3d)
        bonename   = zipstrip(fidms3d.read(32))
        parentname = zipstrip(fidms3d.read(32))
        if fout != []:
            s=bonename+' from '+parentname; fout.write(s+'\n'); fout.flush(); print(s)
        localrotation = array.array('f',[getfloat(fidms3d),getfloat(fidms3d),getfloat(fidms3d)])
        localposition = array.array('f',[getfloat(fidms3d),getfloat(fidms3d),getfloat(fidms3d)])
        numKeyFramesRot=getshort(fidms3d); numKeyFramesTrans=getshort(fidms3d)
        rotationframes=array.array('f'); positionframes=array.array('f')
        for jj in range(numKeyFramesRot):
            for _ in range(4): rotationframes.append(getfloat(fidms3d))
        for jj in range(numKeyFramesTrans):
            for _ in range(4): positionframes.append(getfloat(fidms3d))
        jointdata.append([flags,bonename,parentname,localrotation,localposition,rotationframes,positionframes])
    return jointdata


def _read_comments(fidms3d, fout, label):
    nNum = getuint(fidms3d)
    if fout != []:
        s=label+' = '+str(nNum); fout.write(s+'\n'); fout.flush(); print(s)
    if nNum == 0: return []
    indices=[]; comments=[]
    for ii in range(nNum):
        indices.append(getuint(fidms3d)); nchars=getuint(fidms3d)
        raw=fidms3d.read(nchars)
        comments.append(raw.decode('latin-1') if isinstance(raw,bytes) else raw)
    return [indices, comments]

def readgroupcomments(fidms3d, fout):
    return _read_comments(fidms3d, fout, 'Number of group comments')

def readmaterialcomments(fidms3d, fout):
    return _read_comments(fidms3d, fout, 'Number of material comments')

def readjointcomments(fidms3d, fout):
    return _read_comments(fidms3d, fout, 'Number of joint comments')

def readmodelcomments(fidms3d, fout):
    nHas = getuint(fidms3d)
    if fout != []:
        s='Number of model comments = '+str(nHas); fout.write(s+'\n'); fout.flush(); print(s)
    if nHas == 0: return []
    comments=[]
    for ii in range(nHas):
        nchars=getuint(fidms3d); raw=fidms3d.read(nchars)
        comments.append(raw.decode('latin-1') if isinstance(raw,bytes) else raw)
    return [comments]


def readboneIdandweights(fidms3d, fout, nvert, subversionnum2):
    vbonesSecondary=array.array('b'); vbonesThird=array.array('b'); vbonesFourth=array.array('b')
    vwts=array.array('B'); extra=array.array('I'); vthirdweight=array.array('B')
    for ii in range(nvert):
        vbonesSecondary.append(getbyte(fidms3d)); vbonesThird.append(getbyte(fidms3d)); vbonesFourth.append(getbyte(fidms3d))
        vwts.append(getubyte(fidms3d)); vwts.append(getubyte(fidms3d))
        vthirdweight.append(getubyte(fidms3d))
        if subversionnum2 == 2: extra.append(getuint(fidms3d))
    return [vbonesSecondary, vbonesThird, vbonesFourth, vwts, vthirdweight, extra]


def readms3dfile(fnin, fnouttxt):
    ms3d = []
    fout = open(fnouttxt, 'w') if fnouttxt != [] else []
    fidms3d    = open(fnin, 'rb')
    header_raw = fidms3d.read(10)         # bytes in Python 3
    versionnum = getuint(fidms3d)
    ms3d.append([header_raw, versionnum])

    if fout != []:
        s = header_raw.decode('latin-1') + ', version number ' + str(versionnum)
        fout.write(s+'\n'); fout.flush(); print(s)

    vertexdata = readvertices(fidms3d, fout);    ms3d.append(vertexdata)
    nvert      = len(vertexdata[0])
    ms3d.append(readtriangles(fidms3d, fout, nvert))
    ms3d.append(readgroups(fidms3d, fout))
    ms3d.append(readmaterials(fidms3d, fout))
    ms3d.append(readkeyframer(fidms3d, fout))
    ms3d.append(readjoints(fidms3d, fout))

    sv1 = getuint(fidms3d)
    if fout != []: s='First subversion number = '+str(sv1); fout.write(s+'\n'); fout.flush(); print(s)
    ms3d.append(sv1)

    ms3d.append(readgroupcomments(fidms3d, fout))
    ms3d.append(readmaterialcomments(fidms3d, fout))
    ms3d.append(readjointcomments(fidms3d, fout))
    ms3d.append(readmodelcomments(fidms3d, fout))

    sv2 = getuint(fidms3d)
    if fout != []: s='Second subversion number = '+str(sv2); fout.write(s+'\n'); fout.flush(); print(s)
    ms3d.append(sv2)
    ms3d.append(readboneIdandweights(fidms3d, fout, nvert, sv2))

    fidms3d.close()
    if fout != []: fout.close()
    return ms3d


# ===================================================================================
# MS3D writer
# ===================================================================================
def writevertices(fidms3d, vd):
    vflags=vd[0]; vvecs=vd[1]; vbonesPrimary=vd[2]; vrefs=vd[3]; nvert=len(vflags)
    putushort(nvert, fidms3d)
    for ii in range(nvert):
        putubyte(vflags[ii],fidms3d); putfloat(vvecs[3*ii],fidms3d); putfloat(vvecs[3*ii+1],fidms3d); putfloat(vvecs[3*ii+2],fidms3d)
        putbyte(vbonesPrimary[ii],fidms3d); putbyte(vrefs[ii],fidms3d)

def writetriangles(fidms3d, td):
    triflags=td[0]; tris=td[1]; vnorms=td[2]; s=td[3]; t=td[4]; sg=td[5]; gi=td[6]
    ntriangles=len(triflags); putushort(ntriangles,fidms3d)
    for ii in range(ntriangles):
        i1=tris[3*ii]; i2=tris[3*ii+1]; i3=tris[3*ii+2]
        putushort(triflags[ii],fidms3d); putushort(i1,fidms3d); putushort(i2,fidms3d); putushort(i3,fidms3d)
        for i in [i1,i2,i3]:
            putfloat(vnorms[3*i],fidms3d); putfloat(vnorms[3*i+1],fidms3d); putfloat(vnorms[3*i+2],fidms3d)
        putfloat(s[3*ii],fidms3d); putfloat(s[3*ii+1],fidms3d); putfloat(s[3*ii+2],fidms3d)
        putfloat(t[3*ii],fidms3d); putfloat(t[3*ii+1],fidms3d); putfloat(t[3*ii+2],fidms3d)
        putubyte(sg[ii],fidms3d); putubyte(gi[ii],fidms3d)

def writegroups(fidms3d, gd):
    gflags=gd[0]; gnames=gd[1]; tg=gd[2]; matidx=gd[3]; ng=len(tg)
    putushort(ng,fidms3d)
    for ii in range(ng):
        nm=gnames[ii]; nname=len(nm); triidx=tg[ii]; ntris=len(triidx)
        putubyte(gflags[ii],fidms3d); putstring(nm,fidms3d); putzerobytes(32-nname,fidms3d)
        putushort(ntris,fidms3d)
        for jj in range(ntris): putushort(triidx[jj],fidms3d)
        putbyte(matidx[ii],fidms3d)

def writematerials(fidms3d, md):
    putushort(len(md),fidms3d)
    for m in md:
        putstring(m[0],fidms3d)
        m[1].tofile(fidms3d); m[2].tofile(fidms3d); m[3].tofile(fidms3d); m[4].tofile(fidms3d)
        putfloat(m[5],fidms3d); putfloat(m[6],fidms3d); putubyte(m[7],fidms3d)
        putstring(m[8],fidms3d); putstring(m[9],fidms3d)

def writekeyframer(fidms3d, kd):
    putfloat(kd[0],fidms3d); putfloat(kd[1],fidms3d); putuint(kd[2],fidms3d)

def writejoints(fidms3d, jd):
    putushort(len(jd),fidms3d)
    for j in jd:
        flags=j[0]; bname=j[1]; pname=j[2]; lr=j[3]; lp=j[4]; rf=j[5]; pf=j[6]
        putubyte(flags,fidms3d)
        putstring(bname,fidms3d); putzerobytes(32-len(bname),fidms3d)
        putstring(pname,fidms3d); putzerobytes(32-len(pname),fidms3d)
        lr.tofile(fidms3d); lp.tofile(fidms3d)
        putushort(len(rf)//4,fidms3d); putushort(len(pf)//4,fidms3d)   # integer division
        rf.tofile(fidms3d); pf.tofile(fidms3d)

def _write_comments(fidms3d, commentdata):
    if not commentdata: putuint(0,fidms3d); return
    indices=commentdata[0]; comments=commentdata[1]; n=len(indices)
    putuint(n,fidms3d)
    for ii in range(n):
        putuint(indices[ii],fidms3d); c=comments[ii]; putuint(len(c),fidms3d); putstring(c,fidms3d)

def writegroupcomments(fidms3d, d):    _write_comments(fidms3d, d)
def writematerialcomments(fidms3d, d): _write_comments(fidms3d, d)
def writejointcomments(fidms3d, d):    _write_comments(fidms3d, d)

def writemodelcomment(fidms3d, d):
    print("Writing model comment...")
    if not d: putuint(0,fidms3d); return
    mc = d[0]; putuint(1,fidms3d); putuint(len(mc),fidms3d); putstring(mc,fidms3d)

def writeboneIdandweights(fidms3d, wd, sv2):
    vs=wd[0]; vt=wd[1]; vf=wd[2]; vw=wd[3]; vtw=wd[4]; ex=wd[5]; nv=len(vs)
    for ii in range(nv):
        putbyte(vs[ii],fidms3d); putbyte(vt[ii],fidms3d); putbyte(vf[ii],fidms3d)
        putubyte(vw[2*ii],fidms3d); putubyte(vw[2*ii+1],fidms3d); putubyte(vtw[ii],fidms3d)
        if sv2 == 2: putuint(ex[ii],fidms3d)

def writems3dfile(fn, ms3d):
    hd=ms3d[0]; vd=ms3d[1]; td=ms3d[2]; gd=ms3d[3]; md=ms3d[4]; kd=ms3d[5]
    jd=ms3d[6]; sv1=ms3d[7]; gcd=ms3d[8]; mcd=ms3d[9]; jcd=ms3d[10]
    moc=ms3d[11]; sv2=ms3d[12]; wd=ms3d[13]
    fidms3d = open(fn, 'wb')
    header=hd[0]; vn=hd[1]
    if isinstance(header,str): header=header.encode('latin-1')
    print('Open file to output ms3d file.')
    print('header = ' + header.decode('latin-1')); print('versionnum = ' + str(vn))
    fidms3d.write(header); putuint(vn,fidms3d); print('Wrote header data.')
    writevertices(fidms3d,vd);     print('Wrote vertex data.')
    writetriangles(fidms3d,td);    print('Wrote triangle data.')
    writegroups(fidms3d,gd);       print('Wrote group data.')
    writematerials(fidms3d,md);    print('Wrote material data.')
    writekeyframer(fidms3d,kd);    print('Wrote keyframer data.')
    writejoints(fidms3d,jd);       print('Wrote joint data.')
    putuint(sv1,fidms3d)
    writegroupcomments(fidms3d,gcd);    print('Wrote group comments.')
    writematerialcomments(fidms3d,mcd); print('Wrote material comments.')
    writejointcomments(fidms3d,jcd);    print('Wrote joint comments.')
    writemodelcomment(fidms3d,moc);     print('Wrote model comment.')
    putuint(sv2,fidms3d)
    writeboneIdandweights(fidms3d,wd,sv2); print('Wrote weights.')
    fidms3d.close()


# ===================================================================================
# convertcastoms3d
# ===================================================================================
def convertcastoms3d(fncas, fntxt, flags):
    cfd = readcasfile(fncas, fntxt, flags)
    nch = fncas.find('.cas'); fnms3d = fncas[0:nch] + '.ms3d'
    print('fnms3d = ' + fnms3d)

    headerdata=cfd[0]; hierarchydata=cfd[3]; timeticksdata=cfd[4]; bonedata=cfd[5]
    posefloats=cfd[8]; meshdata=cfd[10]; footerdata=cfd[11]
    print("footerdata[0] = " + str(footerdata[0]))

    FLAGRESOURCE=meshdata[0]; chunkstr=meshdata[1]; boneIds=meshdata[2]; verts=meshdata[3]
    normals=meshdata[4]; faces=meshdata[5]; tverts=meshdata[7]; vcolors=meshdata[8]
    groupnames=meshdata[9]; grouptris=meshdata[10]; groupmatIds=meshdata[11]
    groupindex=meshdata[12]; groupcomments=meshdata[13]

    numverts  = len(boneIds)
    numfaces  = len(faces) // 3    # integer division
    nummeshes = len(groupnames)

    triflags=[]; s_array=[]; t_array=[]; smoothingGroup=[]
    for ii in range(numfaces):
        triflags.append(1)
        i1=faces[3*ii+0]; i2=faces[3*ii+1]; i3=faces[3*ii+2]
        s_array += [tverts[2*i1],tverts[2*i2],tverts[2*i3]]
        t_array += [tverts[2*i1+1],tverts[2*i2+1],tverts[2*i3+1]]
        smoothingGroup.append(1)

    # Null-padded binary name strings (32 bytes each, 128 bytes for texture paths)
    nullname   = b'\x00'*128
    figname    = b'Figure'     + b'\x00'*26
    attachname = b'Attachments'+ b'\x00'*21
    ambient=array.array('f',[1,1,1,1]); diffuse=array.array('f',[.8,.8,.8,1])
    specular=array.array('f',[0,0,0,1]); emissive=array.array('f',[0,0,0,1])
    mat0=[figname,ambient,diffuse,specular,emissive,0.0,1.0,0,nullname,nullname]
    mat1=[attachname,ambient,diffuse,specular,emissive,0.0,1.0,0,nullname,nullname]

    bonenames=bonedata[0]; nbones=len(bonenames)
    parentnames=['']
    for ib in range(2,nbones): parentnames.append(bonenames[hierarchydata[ib]])

    localrot=array.array('f',[0,0,0]); rotframes=array.array('f'); posframes=array.array('f')
    jointdata=[]
    for ib in range(1,nbones):
        lp=array.array('f',[-posefloats[3*ib],posefloats[3*ib+1],posefloats[3*ib+2]])
        jointdata.append([8,bonenames[ib],parentnames[ib-1],localrot,lp,rotframes,posframes])

    headerstr    = ' '.join(str(x) for x in headerdata)
    hierarchystr = ' '.join(str(x) for x in hierarchydata)
    timeticksstr = ' '.join(str(x) for x in timeticksdata)
    firstmatcomment = headerstr + '%%' + hierarchystr + '%%' + timeticksstr

    vbonessecondary=array.array('b',[-1]*numverts); vbonesthird=array.array('b',[-1]*numverts)
    vbonesfourth=array.array('b',[-1]*numverts)
    vwts=array.array('B'); vthirdwt=array.array('B',[0]*numverts); extra=array.array('I',[0]*numverts)
    for ii in range(numverts): vwts.append(100); vwts.append(0)

    ms3d = [
        ['MS3D000000', 4],
        [[1]*numverts, verts, boneIds, [1]*numverts],
        [triflags, faces, normals, s_array, t_array, smoothingGroup, groupindex],
        [[1]*nummeshes, groupnames, grouptris, groupmatIds],
        [mat0, mat1],
        [5.0, 0.0, 1],
        jointdata,
        1,
        [list(range(nummeshes)), groupcomments],
        [[0,1],[firstmatcomment, chunkstr]],
        [],
        [footerdata[0]],
        2,
        [vbonessecondary,vbonesthird,vbonesfourth,vwts,vthirdwt,extra]
    ]
    writems3dfile(fnms3d, ms3d)


# ===================================================================================
# convertms3dtocas
# ===================================================================================
def convertms3dtocas(fnms3d, fncas):
    ms3d = readms3dfile(fnms3d, [])
    headerdata=ms3d[0]; vertexdata=ms3d[1]; triangledata=ms3d[2]; groupdata=ms3d[3]
    jointdata=ms3d[6]; groupcommentdata=ms3d[8]; materialcommentdata=ms3d[9]
    modelcommentdata=ms3d[11]; subversionnum2=ms3d[12]

    firstmaterialcomment=materialcommentdata[1][0]; chunkstr=materialcommentdata[1][1]
    tokens = firstmaterialcomment.split('%%')
    headerstr=tokens[0]; hierarchystr=tokens[1]; timeticksstr=tokens[2]
    header = headerstr.split()

    FLAGRESOURCE = (int(header[12])==99 or fnms3d.find('resource')>-1 or fnms3d.find('symbol')>-1)
    FLAGNAVY     = (fnms3d.find('navy') > -1)
    print('Converting a resource model.' if FLAGRESOURCE else 'Converting a non-resource model.')

    hierarchy = [int(x) for x in hierarchystr.split()]
    timeticks = [float(x) for x in timeticksstr.split()]
    bonenames = [j[1] for j in jointdata]
    nbones    = len(bonenames)

    filesizesans = 8 + 4*len(hierarchy)+2 + 4*(len(timeticks)+1)
    filesizesans += 10+1+7*4+1 + 12   # Scene_Root
    for nm in bonenames: filesizesans += len(nm)+1+7*4+1
    filesizesans += 4*3*nbones

    fid = open(fncas, 'wb')

    # Write CAS header from stored string tokens
    putfloat(float(header[0]),fid); putuint(int(header[1]),fid); putuint(int(header[2]),fid)
    putuint(int(header[3]),fid);    putfloat(float(header[4]),fid)
    putuint(int(header[5]),fid);    putuint(int(header[6]),fid)
    putubyte(int(header[7]),fid);   putubyte(int(header[8]),fid); putubyte(int(header[9]),fid)
    putuint(int(header[10]),fid);   putuint(int(header[11]),fid)
    putubyte(int(header[12]),fid);  putubyte(int(header[13]),fid); putubyte(int(header[14]),fid)

    putuint(filesizesans,fid); putuint(0,fid)

    putushort(len(hierarchy),fid)
    for v in hierarchy: putuint(int(v),fid)
    putuint(len(timeticks),fid)
    for v in timeticks: putfloat(float(v),fid)

    # Scene_Root
    putuint(11,fid); putstring("Scene_Root",fid); putubyte(0,fid)
    putuint(0,fid); putuint(0,fid); putuint(0,fid); putuint(0,fid); putuint(0,fid); putuint(1,fid); putubyte(0,fid)

    for ii in range(nbones):
        nch=len(bonenames[ii]); putuint(nch+1,fid); putstring(bonenames[ii],fid); putubyte(0,fid)
        putuint(0,fid); putuint(0,fid); putuint(0,fid); putuint(0,fid); putuint(0,fid); putuint(1,fid); putubyte(0,fid)

    putfloat(0.0,fid); putfloat(0.0,fid); putfloat(0.0,fid)   # Scene_Root pose

    poseabs=[]
    if len(jointdata) > 0:
        lp=jointdata[0][4]
        putfloat(-lp[0],fid); putfloat(lp[1],fid); putfloat(lp[2],fid)
        poseabs += [-lp[0], lp[1], lp[2]]
        print("poseabs[0,1,2] = (%s, %s, %s)" % (poseabs[0],poseabs[1],poseabs[2]))
        for ii in range(1,len(jointdata)):
            lp=jointdata[ii][4]
            putfloat(-lp[0],fid); putfloat(lp[1],fid); putfloat(lp[2],fid)
            idx=hierarchy[ii+1]-1
            poseabs += [-lp[0]+poseabs[3*idx+0], lp[1]+poseabs[3*idx+1], lp[2]+poseabs[3*idx+2]]

    verts=vertexdata[1]; boneIds=vertexdata[2]; nverts=len(boneIds)
    faces=triangledata[1]; normals=triangledata[2]; s_array=triangledata[3]; t_array=triangledata[4]
    groupnames=groupdata[1]; grouptris=groupdata[2]; groupmatId=groupdata[3]
    groupcomments_ms3d=groupcommentdata[1] if groupcommentdata else []
    nummeshes=len(groupnames); nfaces=len(faces)//3

    tokens_chunk=chunkstr.split(); nchunktoks=len(tokens_chunk)

    if FLAGRESOURCE:
        tok_mc=modelcommentdata[0][0].split()
        offset = (110 if (int(tok_mc[0])==26 or nchunktoks==19) else 24) + 32*nverts + 6*nfaces
        for nm in groupnames: offset += len(nm)+47+8
    elif FLAGNAVY:
        offset = 110 + 32*nverts + 6*nfaces
        for nm in groupnames: offset += len(nm)+47+8
    else:
        offset = 16 + 36*nverts + 6*nfaces
        for nm in groupnames: offset += len(nm)+44+8

    tokens=chunkstr.split(); nchunktoks=len(tokens)
    if not FLAGRESOURCE and not FLAGNAVY and nchunktoks==8:
        for i,fn2 in enumerate([putuint,putuint,putuint,putuint]): fn2(int(tokens[i]),fid)
        putushort(int(tokens[4]),fid); putuint(int(offset),fid); putuint(int(tokens[6]),fid); putuint(nummeshes,fid)
    elif not FLAGRESOURCE and not FLAGNAVY and nchunktoks==24:
        print('Doing attrib node')
        putuint(int(tokens[0]),fid); putuint(int(tokens[1]),fid); putuint(int(tokens[2]),fid); putuint(int(tokens[3]),fid)
        putstring(tokens[4],fid); putubyte(0,fid)
        putuint(int(tokens[5]),fid); putubyte(0,fid); putuint(int(tokens[6]),fid); putubyte(0,fid)
        for jj in range(7,16): putfloat(float(tokens[jj]),fid)
        putushort(int(tokens[16]),fid); putint(int(tokens[17]),fid); putushort(int(tokens[18]),fid)
        putuint(int(tokens[19]),fid); putuint(int(tokens[20]),fid); putuint(offset,fid); putuint(int(tokens[22]),fid); putuint(nummeshes,fid)
    elif FLAGRESOURCE and nchunktoks==3:
        putuint(offset,fid); putuint(int(tokens[1]),fid); putuint(int(tokens[2]),fid)
    elif FLAGNAVY or (FLAGRESOURCE and nchunktoks>3):
        putuint(offset,fid); putuint(int(tokens[1]),fid); putuint(int(tokens[2]),fid); putuint(int(tokens[3]),fid)
        putstring(tokens[4],fid); putubyte(0,fid)
        putuint(int(tokens[5]),fid); putubyte(0,fid); putuint(int(tokens[6]),fid); putubyte(0,fid)
        for jj in range(7,16): putfloat(float(tokens[jj]),fid)
        putushort(int(tokens[16]),fid); putint(int(tokens[17]),fid); putuint(int(tokens[18]),fid)

    nv = 0
    for imesh in range(nummeshes):
        textureId=groupmatId[imesh]; nch=len(groupnames[imesh])
        putuint(nch+1,fid); putstring(groupnames[imesh],fid); putubyte(0,fid)
        if FLAGRESOURCE or FLAGNAVY:
            c=groupcomments_ms3d[imesh]; tok=c.split()
            putuint(int(tok[0]),fid); putubyte(0,fid); putuint(int(tok[1]),fid); putubyte(0,fid); putuint(int(tok[2]),fid)
            for jj in range(3,10): putfloat(float(tok[jj]),fid)
        else:
            putuint(1,fid); putubyte(0,fid)
            for _ in range(7): putfloat(0.0,fid)

        imin=100000; imax=-10000; triarr=grouptris[imesh]; ntris=len(triarr)
        for itri in range(ntris):
            idx=triarr[itri]
            for vidx in [faces[3*idx],faces[3*idx+1],faces[3*idx+2]]:
                if vidx>imax: imax=vidx
                if vidx<imin: imin=vidx
        print("For mesh %d, imin=%d, imax=%d" % (imesh,imin,imax))
        putushort(imax+1-imin,fid); putushort(ntris,fid); putubyte(1,fid); putubyte(0,fid)

        if boneIds[0] > -1:
            for ii in range(imin,imax+1): putuint(boneIds[ii]+1,fid)

        for ii in range(imin,imax+1):
            Id=boneIds[ii]
            if Id > -1:
                putfloat(-verts[3*ii]-poseabs[3*Id],fid); putfloat(verts[3*ii+1]-poseabs[3*Id+1],fid); putfloat(verts[3*ii+2]-poseabs[3*Id+2],fid)
            else:
                putfloat(-verts[3*ii],fid); putfloat(verts[3*ii+1],fid); putfloat(verts[3*ii+2],fid)

        for ii in range(imin,imax+1):
            putfloat(-normals[3*ii],fid); putfloat(normals[3*ii+1],fid); putfloat(normals[3*ii+2],fid)

        for itri in range(ntris):
            idx=triarr[itri]
            putushort(faces[3*idx]-nv,fid); putushort(faces[3*idx+2]-nv,fid); putushort(faces[3*idx+1]-nv,fid)

        sz=imax+1-imin; svert=array.array('f',[0.0]*sz); tvert=array.array('f',[0.0]*sz)
        for itri in range(ntris):
            idx=triarr[itri]
            i1=faces[3*idx]-nv; i2=faces[3*idx+1]-nv; i3=faces[3*idx+2]-nv
            svert[i1]=s_array[3*idx]; svert[i2]=s_array[3*idx+1]; svert[i3]=s_array[3*idx+2]
            tvert[i1]=t_array[3*idx]; tvert[i2]=t_array[3*idx+1]; tvert[i3]=t_array[3*idx+2]
        putuint(textureId,fid)
        for ii in range(sz): putfloat(svert[ii],fid); putfloat(tvert[ii],fid)
        putuint(0,fid)
        nv += sz; print("nv = " + str(nv))

    # Footer
    footerstr=modelcommentdata[0][0]; print('footer = '+footerstr)
    tokens=footerstr.split(); ntoks=len(tokens); print('ntoks  = '+str(ntoks))

    if FLAGRESOURCE and int(tokens[0])==26:
        attribstr=tokens[1]; tfn=tokens[38]; footsize=75+len(tfn); nch=len(attribstr)
        putuint(nch+1,fid); putstring(attribstr,fid); putubyte(0,fid)
        putuint(int(tokens[2]),fid); putubyte(0,fid); putuint(int(tokens[3]),fid); putubyte(0,fid)
        for jj in range(4,13): putfloat(float(tokens[jj]),fid)
        putushort(int(tokens[13]),fid); putint(int(tokens[14]),fid); putushort(int(tokens[15]),fid)
        for jj in range(16,34): putuint(int(tokens[jj]),fid)
        putuint(footsize,fid); putuint(int(tokens[35]),fid); putuint(int(tokens[36]),fid); putuint(int(tokens[37]),fid)
        putubyte(0,fid); putstring(tokens[38],fid); putubyte(0,fid)
        for jj in range(39,53): putfloat(float(tokens[jj]),fid)
        putubyte(1,fid)
    elif FLAGRESOURCE and int(tokens[0])==0:
        putushort(int(tokens[0]),fid)
        for ii in range(1,18): putuint(int(tokens[ii]),fid)
        footsize=len(tokens[22])+75; putuint(footsize,fid)
        putuint(int(tokens[19]),fid); putuint(int(tokens[20]),fid); putuint(int(tokens[21]),fid)
        putubyte(0,fid); putstring(tokens[22],fid); putubyte(0,fid)
        for ii in range(23,37): putfloat(float(tokens[ii]),fid)
        putubyte(1,fid)
    elif FLAGNAVY:
        tfstr=tokens[22]; footsize=75+len(tfstr)
        putushort(int(tokens[0]),fid)
        for ii in range(1,18): putuint(int(tokens[ii]),fid)
        putuint(footsize,fid); putuint(int(tokens[19]),fid); putuint(int(tokens[20]),fid); putuint(int(tokens[21]),fid)
        putubyte(0,fid); putstring(tokens[22],fid); putubyte(0,fid)
        for ii in range(23,37): putfloat(float(tokens[ii]),fid)
        putubyte(1,fid)
    else:
        tfstr=tokens[17].replace('%',' '); footsize=75+len(tfstr)
        putuint(nummeshes,fid)
        for ii in range(1,13): putuint(int(tokens[ii]),fid)
        putuint(footsize,fid); putuint(int(tokens[14]),fid); putuint(int(tokens[15]),fid); putuint(int(tokens[16]),fid)
        putubyte(0,fid); putstring(tfstr,fid); putubyte(0,fid)
        for ii in range(18,32): putfloat(float(tokens[ii]),fid)
        putubyte(1,fid)

    fid.close()


# ===================================================================================
# Flags / Main
# ===================================================================================
class dataflags:
    def __init__(self):
        self.header=1; self.filesize=1; self.hierarchy=1; self.timeticks=1
        self.bones=1;  self.alldata=1;  self.footer=1;    self.isdir=0

UNSUPPORTED_FILES = {
    'resource_wool.cas','navy_eastern.cas','navy_egypt.cas','navy_greek.cas',
    'navy_roman.cas','navy_roman_shadow.cas','late_captain_northern_shadow.cas',
    'spy.cas','princess.cas','priest.cas','diplomat.cas','barb_strat_map_captain.cas',
    'bishop.cas','captain_drag_model.cas','cardinal.cas','carthage_strat_captain.cas',
    'character_pontus.cas','crossed_swords.cas','flood_water.cas','general_pontus.cas',
    'good_old_blue.cas','inquisitor.cas','resource_chocolate.cas','resource_mine.cas'
}

flags = dataflags()

root = Tk(); root.withdraw()
fn = filedialog.askopenfilename(
    title="Select CAS or MS3D file",
    filetypes=[("CAS/MS3D files","*.cas *.ms3d"),("All files","*.*")]
)
if not fn:
    print('No file selected, exiting.'); exit()

print('file name = ' + fn)
(head, tail) = os.path.split(fn)
if tail in UNSUPPORTED_FILES:
    showwarning('Bad File', 'Can not process ' + tail + ', must terminate script.'); exit()

(root_path, ext) = os.path.splitext(fn)
if ext == ".cas":
    convertcastoms3d(fn, [], flags)
elif ext == ".ms3d":
    convertms3dtocas(fn, root_path + "_converted.cas")
