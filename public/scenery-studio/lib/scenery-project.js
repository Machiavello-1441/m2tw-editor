'use strict';
// One editable document owns both drafts and the installed site assignments.
(function(){
  const kinds=['settlement','port','fort','watchtower','resource','bridge'];
  const clone=v=>JSON.parse(JSON.stringify(v));
  const key=s=>`${s.kind}:${s.x}:${s.y}`;
  function normalize(value={},legacySites=[],recovered=[]){
    if(value.version>2)throw Error('This scenery project needs a newer editor.');
    const doc={...clone(value),version:2,designs:clone(value.designs||{}),exports:clone(value.exports||{}),sites:clone(value.sites??legacySites)};
    if(Array.isArray(doc.designs)||typeof doc.designs!=='object'||!Array.isArray(doc.sites))throw Error('Invalid scenery project document');
    for(const d of recovered)if(d?.site&&Array.isArray(d.components)&&!doc.designs[key(d.site)])doc.designs[key(d.site)]=clone(d);
    const seen=new Set();
    for(const s of doc.sites){
      if(s.kind==='bridge')throw Error('Bridge installation is disabled until a replacement API is confirmed.');
      if(!kinds.includes(s.kind)||!Number.isInteger(s.x)||!Number.isInteger(s.y)||s.x<0||s.y<0||!s.primary)throw Error('Invalid installed scenery site');
      if(seen.has(key(s)))throw Error('Duplicate installed scenery site: '+key(s));seen.add(key(s));
    }
    return doc;
  }
  function mergeDesigns(doc,designs){
    const out=normalize(doc);
    for(const [k,d]of Object.entries(designs))if(d.components.length||out.designs[k])out.designs[k]=clone(d);
    return out;
  }
  function install(doc,record){
    if(record.kind==='bridge')throw Error('Bridges can be designed and exported, but cannot be installed yet.');
    const out=normalize(doc);
    if(record.kind!=='bridge'&&out.sites.some(s=>s.kind!=='bridge'&&s.x===record.x&&s.y===record.y&&s.kind!==record.kind))throw Error('Another site override already occupies this tile. Remove it before installing a different kind.');
    out.sites=out.sites.filter(s=>key(s)!==key(record));out.sites.push(clone(record));return normalize(out);
  }
  function uninstall(doc,site){const out=normalize(doc);out.sites=out.sites.filter(s=>key(s)!==key(site));return out;}
  function recordExport(doc,record,design){const out=normalize(doc);out.exports[key(record)]={record:clone(record),design:clone(design??null)};return out;}
  function sq(v){if(Array.isArray(v))return '['+v.map(sq).join(',\n')+']';if(v&&typeof v==='object')return '{'+Object.entries(v).map(([k,v])=>'['+JSON.stringify(k)+']='+sq(v)).join(',')+'}';return JSON.stringify(v);}
  function runtime(doc){return '// Generated from data/scenery_editor/designs.json by Scenery Studio.\n// Edit and save the project in the editor; this file is generated for M2EX.\nreturn '+sq(normalize(doc).sites)+'\n';}
  function sitesFromMap(p,items,placeName){
    const regionAt=(x,ty)=>{
      for(const [dx,dy]of [[0,0],[-1,0],[1,0],[0,-1],[0,1]]){
        const xx=x+dx,yy=ty+dy;if(xx<0||yy<0||xx>=p.regions.width||yy>=p.regions.height)continue;
        const at=(yy*p.regions.width+xx)*4,r=p.regionByColour.get(Array.from(p.regions.data.slice(at,at+3)).join(','));if(r)return r;
      }
      return null;
    };
    const regionName=(r,fallback)=>placeName(r?.settlement||r?.name||fallback).replace(/_(City|Province)$/i,'').replace(/_/g,' ');
    const sites=items.filter(i=>kinds.includes(i.kind)).map(i=>{
      const y=p.regions.height-1-i.ty,r=i.region||regionAt(i.tx,i.ty),near=regionName(r,`${i.tx}, ${y}`);
      const s={kind:i.kind,x:i.tx,y,name:i.kind==='settlement'?near:i.kind+' '+near,region:r?.name||''};
      if(i.kind==='resource'){
        s.resourceType=i.type;
        const model=p.resModels?.get(i.type),label=model?M2.basename(model).replace(/\.cas$/i,'').replace(/^resource_/i,'').replace(/_(spring|summer|autumn|winter)$/i,''):i.type;
        s.name=label.replace(/_/g,' ')+' near '+near;
      }
      return s;
    });
    const f=p.features;
    if(f){
      const river=(x,y)=>x>=0&&y>=0&&x<f.width&&y<f.height&&[1,2,3].includes(M2.RIVER_KIND(...f.data.slice((y*f.width+x)*4,(y*f.width+x)*4+3)));
      for(let ty=0;ty<f.height;ty++)for(let x=0;x<f.width;x++){
        const at=(ty*f.width+x)*4;if(M2.RIVER_KIND(f.data[at],f.data[at+1],f.data[at+2])!==2)continue;
        const r=regionAt(x,ty),y=p.regions.height-1-ty;
        const vertical=Number(river(x,ty-1))+Number(river(x,ty+1)),horizontal=Number(river(x-1,ty))+Number(river(x+1,ty));
        sites.push({kind:'bridge',x,y,name:'Crossing near '+regionName(r,`${x}, ${y}`),region:r?.name||'',nativeHeading:vertical>horizontal?90:0,bridgeStyle:'stone'});
      }
    }
    return sites.sort((a,b)=>a.name.localeCompare(b.name));
  }
  window.SceneryProject={normalize,mergeDesigns,install,uninstall,recordExport,runtime,key,kinds,sitesFromMap};
})();
