'use strict';
(function(){
  const J=(...p)=>M2.join(...p),slug=s=>String(s).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9_]+/g,'_').slice(0,70)||'model';
  function clean(p){const out=[];for(const part of p.replace(/\\/g,'/').split('/')){if(part==='..')out.pop();else if(part&&part!=='.')out.push(part);}return out.join('/');}
  function relative(from,to){const a=clean(from).split('/'),b=clean(to).split('/');let i=0;while(i<a.length&&i<b.length&&a[i].toLowerCase()===b[i].toLowerCase())i++;return [...a.slice(i).map(()=>'..'),...b.slice(i)].join('/');}
  async function hash(data){const b=await crypto.subtle.digest('SHA-256',data);return Array.from(new Uint8Array(b),x=>x.toString(16).padStart(2,'0')).join('');}
  const originalSave=host.saveWithBackup;
  host.saveWithBackup=async request=>{
    const files=[...new Map((request.files||[]).map(f=>[f.path.toLowerCase(),f])).values()],changed=[];
    const stats=await host.statMany(files.map(f=>f.path));
    for(let i=0;i<files.length;i++){
      const file=files[i],stat=stats[i];
      if(stat?.size===file.data.length){const old=await host.read(file.path);if(SceneryPerformance.same(old,file.data))continue;}
      changed.push(file);
    }
    const result=changed.length||request.moves?.length?await originalSave({...request,files:changed}):{written:[],backedUp:[],backupRoot:request.backupRoot};
    result.unchanged=files.length-changed.length;
    window.dispatchEvent(new CustomEvent('scenery-saved',{detail:result}));return result;
  };
  function invisible(){return SceneryCAS.encode([{name:'invisible',pos:new Float32Array(9),nrm:new Float32Array([0,1,0,0,1,0,0,1,0]),uv:new Float32Array(6),idx:new Uint16Array([0,1,2]),material:-1}],[]);}
  async function exportDesign(design,{root,componentObjects,project}){
    const old=project.exports?.[SceneryProject.key(design.site)]?.record;
    const prefix='data/models_strat/custom_sites/';
    const campaign=window.Portable?.campaignSlug()||'campaign';
    const prior=old?.primary?.replace(/\\/g,'/');
    const base=prior?.startsWith(prefix)&&!prior.includes('/../')?prior.slice(0,prior.lastIndexOf('/')):prefix+campaign+'/'+design.site.kind+'_'+design.site.x+'_'+design.site.y;
    const files=new Map(),textureCache=new Map(),slots={},usedNames=new Set();
    const add=(rel,data)=>files.set(rel,{path:J(root,rel),data});
    async function texture(id,data){
      if(textureCache.has(id))return textureCache.get(id);
      const digest=await hash(data),packaged=SceneryCAS.packageTexture(digest,data),folder=prefix+'_materials';
      for(const f of packaged.files)add(folder+'/'+f.name,f.data);
      const ref=relative(base,folder+'/'+packaged.reference).replace(/\//g,'\\');textureCache.set(id,ref);return ref;
    }
    for(const slot of ['primary','secondary']){
      const objects=[],materials=[],materialIds=new Map();let header=null,symbol=false;
      for(const c of design.components.filter(c=>(c.slot||'primary')===slot)){
        const result=await componentObjects(c,true);header ||= result.header;
        for(const r of result.out){
          if(/^symbol$/i.test(r.object.name)){if(symbol||design.site.kind!=='settlement')continue;symbol=true;}
          const noMaterial=r.object.material<0&&!r.source;
          let mat={...r.material},material=-1;
          if(mat.image){mat.texture=await texture(c.file+'#'+r.object.material,mat.image);mat.image=null;}
          else if(!noMaterial&&(mat.texture||c.file.startsWith('primitive:'))){
            if(!r.source)throw Error('Choose a material for '+c.name+' / '+r.object.name+' before export.');
            mat.texture=await texture(r.source,await host.read(r.source));mat.image=null;
          }
          if(!noMaterial){const mk=JSON.stringify([mat.texture||'',Array.from(mat.tail||[])]);if(!materialIds.has(mk)){materialIds.set(mk,materials.length);materials.push(mat);}material=materialIds.get(mk);}
          let name=/^symbol$/i.test(r.object.name)?'symbol':slug(design.site.kind==='bridge'?r.object.name:c.name+'_'+r.object.name);
          if(name!=='symbol'){const stem=name;let n=1;while(usedNames.has(name))name=stem+'_'+n++;usedNames.add(name);}
          objects.push({...r.object,name,material});
        }
      }
      if(!objects.length){if(slot==='primary')throw Error('Assign at least one visible component to the main slot.');slots[slot]=prefix+'_shared/invisible.cas';add(slots[slot],invisible());continue;}
      const previous=old?.[slot]?.replace(/\\/g,'/');
      slots[slot]=previous?.startsWith(base+'/')&&!previous.includes('_invisible')?previous:base+'/'+slot+'.cas';
      add(slots[slot],SceneryCAS.encode(objects,materials,header));
    }
    return {files:[...files.values()],record:{...design.site,name:design.name,...slots,assets:[...files.keys()].sort(),storageVersion:1}};
  }
  window.SceneryStorage={exportDesign,hash,relative,clean};
})();
