'use strict';
// Static CAS authoring. Geometry is in game units: X east, Y up, Z north.
(function () {
  const RAD = Math.PI / 180;
  function rotate(v, t) {
    let [x,y,z]=v, a=t.pitch*RAD,b=t.yaw*RAD,c=t.roll*RAD;
    [y,z]=[y*Math.cos(a)-z*Math.sin(a),y*Math.sin(a)+z*Math.cos(a)];
    [x,z]=[x*Math.cos(b)+z*Math.sin(b),-x*Math.sin(b)+z*Math.cos(b)];
    return [x*Math.cos(c)-y*Math.sin(c),x*Math.sin(c)+y*Math.cos(c),z];
  }
  function transform(object,t) {
    for(const k of ['east','north','lift','yaw','pitch','roll','sx','sy','sz'])if(!Number.isFinite(t[k])||(k.startsWith('s')&&t[k]<=0))throw Error('Invalid transform '+k);
    const pos=new Float32Array(object.pos.length),nrm=new Float32Array(object.nrm.length);
    for(let i=0;i<pos.length;i+=3){
      const p=rotate([object.pos[i]*t.sx,object.pos[i+1]*t.sy,object.pos[i+2]*t.sz],t);
      pos.set([p[0]+t.east,p[1]+t.lift,p[2]+t.north],i);
      const n=rotate([object.nrm[i]/t.sx,object.nrm[i+1]/t.sy,object.nrm[i+2]/t.sz],t),l=Math.hypot(...n)||1;
      nrm.set(n.map(v=>v/l),i);
    }
    return {...object,pos,nrm,skinned:false,bones:null};
  }
  class Writer {
    constructor(){this.parts=[];this.size=0;}
    bytes(v){v=new Uint8Array(v.buffer||v,v.byteOffset||0,v.byteLength??v.length);this.parts.push(v);this.size+=v.length;}
    number(v,kind){const n=kind==='u8'?1:kind==='u16'?2:4,b=new Uint8Array(n),d=new DataView(b.buffer);d[kind==='f32'?'setFloat32':kind==='u32'?'setUint32':kind==='u16'?'setUint16':'setUint8'](0,v,true);this.bytes(b);}
    u32(v){this.number(v,'u32');} u16(v){this.number(v,'u16');} u8(v){this.number(v,'u8');} f32(v){this.number(v,'f32');}
    text(s){const b=Uint8Array.from([...s].map(c=>{if(c.charCodeAt(0)>127)throw Error('CAS names must use ASCII');return c.charCodeAt(0);}));this.u32(b.length+1);this.bytes(b);this.u8(0);}
    cstring(s){this.bytes(Uint8Array.from([...s].map(c=>c.charCodeAt(0))));this.u8(0);}
    result(){const out=new Uint8Array(this.size);let p=0;for(const b of this.parts){out.set(b,p);p+=b.length;}return out;}
  }
  function chunk(w,kind,body){w.u32(body.size+8);w.u32(kind);w.bytes(body.result());}
  function encode(objects,materials,header){
    if(!objects.length)throw Error('The design has no visible meshes');
    const w=new Writer();
    if(header?.length===50)w.bytes(header);else w.bytes(Uint8Array.from('cdcc4c402600000009000000000000000000000001000000000000000000000100000000000000000000f107000000000000'.match(/../g),x=>parseInt(x,16)));
    w.u32(1);w.u16(0);w.u32(1);w.f32(0);w.text('Scene Root');for(let i=0;i<5;i++)w.u32(0);w.text('');for(let i=0;i<3;i++)w.f32(0);
    const skeletonSize=w.size-42;
    const meshes=new Writer();meshes.u32(objects.length);
    for(const o of objects){
      const nv=o.pos.length/3,nt=o.idx.length/3;
      if(!Number.isInteger(nv)||nv>65535||nt>65535||o.nrm.length!==o.pos.length||o.uv.length!==nv*2)throw Error('Mesh exceeds CAS limits or has incomplete attributes: '+o.name);
      if([...o.pos,...o.nrm,...o.uv].some(v=>!Number.isFinite(v)))throw Error('Non-finite geometry in '+o.name);
      if(Array.from(o.idx).some(i=>i>=nv))throw Error('Triangle outside mesh: '+o.name);
      if(o.material>=materials.length||o.material<-1)throw Error('Invalid material index: '+o.name);
      meshes.text(o.name);meshes.text(o.properties||'');meshes.text('');meshes.u32(0);
      [0,0,0,1,0,0,0].forEach(v=>meshes.f32(v));
      meshes.u16(nv);meshes.u16(nt);meshes.u8(1);meshes.u8(o.col?1:0);
      for(const v of o.pos)meshes.f32(v);for(const v of o.nrm)meshes.f32(v);for(const v of o.idx)meshes.u16(v);
      meshes.u32(o.material<0?0xffffffff:o.material);for(const v of o.uv)meshes.f32(v);
      if(o.col)for(const v of o.col)meshes.u32(v);meshes.u32(0);
    }
    meshes.u16(0);meshes.u32(objects.length);chunk(w,1,meshes);
    for(const kind of [2,3,8,10]){const b=new Writer();b.u32(0);b.u32(0);chunk(w,kind,b);}
    const mats=new Writer();mats.u32(materials.length);
    for(const m of materials){
      mats.u32(m.texture||m.image?1:0);if(m.texture||m.image){mats.u8(m.image?1:0);mats.cstring(m.texture||'embedded.tga');if(m.image)mats.bytes(m.image);}
      if(m.tail?.length===57)mats.bytes(m.tail);else{for(const f of [1,1,1,1,0,0,0])mats.f32(f);mats.bytes(new Uint8Array(28));mats.u8(1);}
    }
    chunk(w,5,mats);
    const out=w.result(),dv=new DataView(out.buffer);dv.setFloat32(0,3.2,true);dv.setFloat32(16,0,true);dv.setUint32(42,skeletonSize,true);dv.setUint32(46,0,true);
    const check=CAS.parse(out);
    if(check.notes.length||check.objects.length!==objects.length||check.materials.length!==materials.length)throw Error('CAS export validation failed: '+check.notes.join('; '));
    return out;
  }
  function primitive(type){
    const p=[],n=[],uv=[],idx=[];
    const face=(a,b,c,d,normal)=>{const k=p.length/3;for(const v of [a,b,c,d])p.push(...v);for(let i=0;i<4;i++)n.push(...normal);uv.push(0,0,1,0,1,1,0,1);idx.push(k,k+1,k+2,k,k+2,k+3);};
    if(type==='tower'){
      const N=16;for(let i=0;i<N;i++){const a=i/N*2*Math.PI,b=(i+1)/N*2*Math.PI,A=[Math.cos(a)*.5,0,Math.sin(a)*.5],B=[Math.cos(b)*.5,0,Math.sin(b)*.5];face(A,B,[B[0],1,B[2]],[A[0],1,A[2]],[Math.cos((a+b)/2),0,Math.sin((a+b)/2)]);face([0,1,0],[A[0],1,A[2]],[B[0],1,B[2]],[0,1,0],[0,1,0]);}
    }else{
      const h=type==='wall'?.25:.5;
      face([-.5,0,-.5],[.5,0,-.5],[.5,h,-.5],[-.5,h,-.5],[0,0,-1]);face([.5,0,.5],[-.5,0,.5],[-.5,h,.5],[.5,h,.5],[0,0,1]);
      face([-.5,0,.5],[-.5,0,-.5],[-.5,h,-.5],[-.5,h,.5],[-1,0,0]);face([.5,0,-.5],[.5,0,.5],[.5,h,.5],[.5,h,-.5],[1,0,0]);
      face([-.5,h,-.5],[.5,h,-.5],[.5,h,.5],[-.5,h,.5],[0,1,0]);face([-.5,0,.5],[.5,0,.5],[.5,0,-.5],[-.5,0,-.5],[0,-1,0]);
    }
    // CAS city meshes use counterclockwise winding relative to their outward normals.
    for(let i=0;i<idx.length;i+=3)[idx[i+1],idx[i+2]]=[idx[i+2],idx[i+1]];
    return {objects:[{name:type,pos:new Float32Array(p),nrm:new Float32Array(n),uv:new Float32Array(uv),idx:new Uint16Array(idx),material:0}],materials:[{texture:'',image:null}],notes:[]};
  }
  function packageTexture(stem,bytes){
    if(!/^[a-z0-9_-]+$/i.test(stem))throw Error('Invalid exported texture name');
    const reference=stem+'.tga';
    // The native CAS loader uses a TGA reference and an optional .tga.dds companion.
    // A direct .dds reference works in the browser but leaves meshes invisible in game.
    if(bytes.length>=4&&bytes[0]===68&&bytes[1]===68&&bytes[2]===83&&bytes[3]===32){
      if(bytes.length<128)throw Error('Incomplete DDS texture: '+stem);
      const img=Images.decodeDDS(bytes);
      if(!img.width||!img.height||img.width>65535||img.height>65535)throw Error('Invalid texture dimensions: '+stem);
      return {reference,files:[
        {name:reference+'.dds',data:bytes},
        {name:reference,data:Images.encodeTGA(img.width,img.height,img.data,32)}
      ]};
    }
    const img=Images.decodeTGA(bytes);
    if(!img.width||!img.height)throw Error('Invalid TGA texture: '+stem);
    return {reference,files:[{name:reference,data:bytes}]};
  }
  window.SceneryCAS={encode,transform,rotate,primitive,packageTexture,identity:()=>({east:0,north:0,lift:0,yaw:0,pitch:0,roll:0,sx:1,sy:1,sz:1})};
})();
