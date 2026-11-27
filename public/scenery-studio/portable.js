'use strict';
// The portable shell keeps each server tied to one selected mod. It adds no
// dependency on a user's directory layout, donor mod or installed dev runtime.
(function(){
  const clone=v=>JSON.parse(JSON.stringify(v));
  const norm=p=>String(p||'').replace(/\\/g,'/').replace(/\/+$/,'').toLowerCase();
  const within=(p,base)=>norm(p)===norm(base)||norm(p).startsWith(norm(base)+'/');
  const J=(...p)=>M2.join(...p);
  const bytes=v=>new TextEncoder().encode(typeof v==='string'?v:JSON.stringify(v,null,2)+'\n');
  const originalLocate=M2.locate;
  const token=document.querySelector('meta[name="m2mp-token"]').content;
  const P=window.Portable={config:null,runtimeReady:false,activateOnSave:false,activeCampaign:null};
  const readText=async path=>new TextDecoder('utf-8').decode(await host.read(path));
  const readJSON=async path=>await host.exists(path)?JSON.parse(await readText(path)):{};
  const projectPath=()=>J(P.config.modRoot,'data/scenery_editor/designs.json');
  const campaignKey=()=>{
    const dir=app.state.project?.mapDir;
    if(!dir||!within(dir,P.config.modRoot))throw Error('Choose a campaign in the selected mod.');
    return dir.slice(P.config.modRoot.length).replace(/\\/g,'/').replace(/^\//,'').toLowerCase();
  };
  P.campaignSlug=()=>campaignKey().replace(/^data\/world\/maps\//,'').replace(/[^a-z0-9_-]+/g,'_');
  function checkDatabase(doc){
    if(doc.version>3)throw Error('This scenery project needs a newer portable editor.');
    if(doc.version===3&&(!doc.campaigns||Array.isArray(doc.campaigns)||typeof doc.campaigns!=='object'))throw Error('Invalid portable scenery project. Restore its latest backup.');
    return doc;
  }
  function subdoc(doc){const out=clone(doc);delete out.campaigns;delete out.activeCampaign;if(out.version===3)out.version=2;return out;}
  const roots=()=>[['$mod/',P.config.modRoot],['$game/',P.config.gameRoot],['$library/',P.config.libraryRoot]].filter(([,root])=>root);
  function savePath(path){
    if(!path||path.startsWith('primitive:')||path.startsWith('$'))return path;
    for(const [prefix,root]of roots())if(within(path,root))return prefix+path.slice(root.length).replace(/^[\\/]/,'').replace(/\\/g,'/');
    return path;
  }
  function openPath(path){
    if(!path||!path.startsWith('$'))return path;
    const prefix=path.slice(0,path.indexOf('/')+1),root=roots().find(([p])=>p===prefix)?.[1];
    if(!root)throw Error('This design needs its '+prefix.replace(/[$/]/g,'')+' folder. Choose that folder in the launcher.');
    const rel=path.slice(prefix.length);
    if(rel.split(/[\\/]/).some(p=>p==='..'||p==='.'||!p)||/[:]/.test(rel))throw Error('Invalid portable asset path.');
    return J(root,rel);
  }
  function mapPaths(doc,mapper){
    const out=subdoc(doc);
    function design(d){for(const c of d?.components||[]){c.file=mapper(c.file);for(const k of Object.keys(c.materials||{}))c.materials[k]=mapper(c.materials[k]);}}
    for(const d of Object.values(out.designs||{}))design(d);
    for(const e of Object.values(out.exports||{}))design(e.design);
    return out;
  }
  P.readProject=async()=>{
    const raw=checkDatabase(await readJSON(projectPath())),key=campaignKey();
    P.activeCampaign=raw.activeCampaign||key;
    const selected=raw.campaigns?(raw.campaigns[key]||{}):raw;
    return SceneryProject.normalize(mapPaths(selected,openPath));
  };
  P.saveProject=async(doc,assets=[])=>{
    const raw=checkDatabase(await readJSON(projectPath())),key=campaignKey();
    const campaigns=clone(raw.campaigns||{}),oldKey=raw.activeCampaign||key;
    if(!raw.campaigns&&(raw.designs||raw.sites))campaigns[oldKey]=mapPaths(SceneryProject.normalize(raw),savePath);
    campaigns[key]=mapPaths(SceneryProject.normalize(doc),savePath);
    const active=P.activateOnSave?key:oldKey;
    if(!campaigns[active])campaigns[active]=mapPaths(SceneryProject.normalize({}),savePath);
    // v3 marks relative asset references and campaign partitions. Older editors
    // reject it clearly instead of misreading paths or dropping other campaigns.
    const output={...campaigns[active],version:3,activeCampaign:active,campaigns};
    const backupRoot=J(P.config.modRoot,'backups','scenery-'+new Date().toISOString().replace(/[:.]/g,'-'));
    const files=[...assets,{path:projectPath(),data:bytes(output)}];
    // The runtime consumes only the active campaign. Draft saves for a different
    // campaign must never change an existing game's assignments.
    files.push({path:J(P.config.modRoot,'script/scenery/sites.nut'),data:bytes(SceneryProject.runtime(campaigns[active]))});
    const result=await host.saveWithBackup({files,backupRoot,relBase:P.config.modRoot});
    P.activateOnSave=false;P.activeCampaign=active;P.updateUI();return result;
  };
  P.invisibleCAS=()=>SceneryCAS.encode([{
    name:'invisible',pos:new Float32Array(9),nrm:new Float32Array([0,1,0,0,1,0,0,1,0]),
    uv:new Float32Array(6),idx:new Uint16Array([0,1,2]),material:-1
  }],[]);

  M2.locate=mapDir=>{
    const loc=originalLocate(mapDir);
    if(P.config&&within(mapDir,P.config.modRoot)){
      loc.modRoot=P.config.modRoot;loc.dataDir=J(P.config.modRoot,'data');
      loc.gameDataDir=P.config.gameRoot?J(P.config.gameRoot,'data'):null;
      loc.baseMapDir=J(loc.dataDir,'world/maps/base');
    }
    return loc;
  };
  P.mapFile=async(dir,file)=>{
    const loc=M2.locate(dir),candidates=[J(dir,file),J(loc.baseMapDir,file)];
    if(loc.gameDataDir)candidates.push(J(loc.gameDataDir,'world/maps/base',file));
    return await M2.firstExisting(candidates)||candidates[0];
  };
  M2.findMaps=async dir=>{
    if(!P.config)return [];
    if(!within(dir,P.config.modRoot))throw Error('This window belongs to '+M2.basename(P.config.modRoot)+'. Run Scenery Studio.cmd to choose another mod.');
    const base=J(P.config.modRoot,'data/world/maps/base');
    const usable=async d=>await host.exists(await P.mapFile(d,'map_ground_types.tga'))&&await host.exists(await P.mapFile(d,'map_climates.tga'));
    if(norm(dir).includes('/world/maps/')&&(await host.exists(J(dir,'descr_strat.txt'))||await host.exists(J(dir,'map_ground_types.tga'))))return await usable(dir)?[{dir,label:M2.basename(dir)}]:[];
    const maps=[];
    for(const group of ['campaign','campaign/custom']){
      const root=J(P.config.modRoot,'data/world/maps',group);
      for(const e of await host.list(root))if(e.isDir&&e.name!=='custom'){
        const d=J(root,e.name);
        if(await host.exists(J(d,'descr_strat.txt'))&&await usable(d))maps.push({dir:d,label:'Campaign: '+e.name});
      }
    }
    if(!maps.length&&await usable(base))maps.push({dir:base,label:'Base map'});
    return maps;
  };
  P.beforeMap=async dir=>{
    if(!P.config||!within(dir,P.config.modRoot))throw Error('Choose a map inside the selected mod. Relaunch the app to change mods.');
    if(window.scenery?.studio.dirty){
      if(!window.confirm('Save your designs before opening another campaign? Cancel keeps this campaign open.'))return false;
      await scenery.saveDesign();
    }
    return true;
  };
  P.refreshCatalogue=async()=>{
    const catalogue=await host.catalogue();
    if(window.scenery){scenery.studio.catalogue=catalogue;scenery.renderLibrary();scenery.renderTextures();}
  };
  async function entryInfo(){
    const manifest=J(P.config.modRoot,'script/manifest.nut');
    let entry='main';
    if(await host.exists(manifest)){
      const m=/\bentry\s*=\s*"([a-zA-Z0-9_./]+)"/.exec(await readText(manifest));
      if(!m||m[1].includes('..'))throw Error('The mod uses a custom script manifest. Add require("scenery.studio_runtime") to its entry script manually; see README.txt.');
      entry=m[1].replace(/\./g,'/');
    }
    const path=J(P.config.modRoot,'script',entry+'.nut');
    return {path,manifest,source:await host.exists(path)?await readText(path):''};
  }
  async function detectRuntime(){
    const info=await entryInfo();
    const custom=J(P.config.modRoot,'script/modules/custom_scenery.nut');
    if(await host.exists(custom)&&/listModules\(\s*"modules"\s*\)/.test(info.source)){
      const text=await readText(custom);
      if(text.includes('require("scenery.sites")')&&text.includes('setOnTile'))return true;
    }
    return /require\(\s*"scenery\.studio_runtime"\s*\)/.test(info.source)&&await host.exists(J(P.config.modRoot,'script/scenery/studio_runtime.nut'));
  }
  P.enableRuntime=async()=>{
    const info=await entryInfo();
    if(await detectRuntime()){P.runtimeReady=true;P.updateUI();return;}
    // Existing custom_scenery modules must not compete for the same model IDs.
    if(await host.exists(J(P.config.modRoot,'script/modules/custom_scenery.nut')))throw Error('A custom_scenery module already exists with an unrecognized loader. Connect that module in the mod entry script instead of installing a second one.');
    const response=await fetch('runtime/studio_runtime.nut');if(!response.ok)throw Error('The bundled runtime is missing. Extract the complete ZIP.');
    const runtime=new Uint8Array(await response.arrayBuffer()),raw=checkDatabase(await readJSON(projectPath()));
    const modulePath=J(P.config.modRoot,'script/scenery/studio_runtime.nut');
    const addition='\n// Scenery Studio Portable integration\nrequire("scenery.studio_runtime")\n';
    const files=[{path:modulePath,data:runtime},{path:J(P.config.modRoot,'script/scenery/sites.nut'),data:bytes(SceneryProject.runtime(subdoc(raw)))}];
    if(!await host.exists(info.manifest))files.push({path:info.manifest,data:bytes('return { name="scenery_studio", entry="main", apiVersion=1 }\n')});
    if(!/require\(\s*"scenery\.studio_runtime"\s*\)/.test(info.source)){
      // Preserve the original script bytes, including its encoding and comments.
      const old=await host.exists(info.path)?await host.read(info.path):new Uint8Array(),append=bytes(addition),combined=new Uint8Array(old.length+append.length);
      combined.set(old);combined.set(append,old.length);files.push({path:info.path,data:combined});
    }
    const backupRoot=J(P.config.modRoot,'backups','scenery-runtime-'+new Date().toISOString().replace(/[:.]/g,'-'));
    await host.saveWithBackup({files,backupRoot,relBase:P.config.modRoot});
    P.runtimeReady=true;P.updateUI();
    document.querySelector('#scStatus').hidden=false;
    document.querySelector('#scStatus').textContent='M2EX loader prepared. Export and install a design, then restart M2EX. Backup: '+backupRoot;
  };
  P.updateUI=()=>{
    const b=document.querySelector('#scExport'),kind=window.scenery?.studio.site?.kind;
    if(b)b.textContent=kind==='bridge'?'Export bridge CAS only':P.runtimeReady?'Export CAS & install at this site':'Export CAS & textures';
    const runtime=document.querySelector('#portableRuntime');
    if(runtime){runtime.textContent=P.runtimeReady?'M2EX integration ready':'Enable M2EX integration';runtime.disabled=P.runtimeReady;}
    const info=document.querySelector('#portableMode');
    if(info)info.textContent=(P.runtimeReady?'Unique tile assignments use the M2EX Squirrel API.':'CAS export mode. Enable integration only for a compatible M2EX Squirrel mod.')+(P.activeCampaign?' Active in game: '+P.activeCampaign.replace('data/world/maps/','')+'.':'');
  };
  P.init=async args=>{
    P.config=args;
    const until=Date.now()+15000;
    while(!window.scenery){if(Date.now()>until)throw Error('Scenery Studio did not finish loading. Reload this page.');await new Promise(r=>setTimeout(r,20));}
    // The welcome page and Open dialog only list the server's selected mod.
    host.detectGame=async()=>[{gameDir:args.gameRoot,mods:[{name:M2.basename(args.modRoot),path:args.modRoot}]}];
    try{P.runtimeReady=await detectRuntime();}catch(e){console.warn(e.message);}
    const b=document.createElement('button');b.id='portableRuntime';b.title='Back up the mod entry script and install the bundled M2EX Squirrel loader.';
    b.onclick=async()=>{b.disabled=true;try{await P.enableRuntime();}catch(e){const s=document.querySelector('#scStatus');s.hidden=false;s.textContent=e.message;}finally{P.updateUI();}};
    const p=document.createElement('div');p.id='portableMode';p.className='sc-note';
    document.querySelector('#scExport').before(p,b);
    document.querySelector('#btnOpen').textContent='Campaign…';
    document.querySelector('#btnOpen').title='Choose a campaign in this mod. Relaunch Scenery Studio.cmd for another mod.';
    // Bind the button to this mod instead of offering a drive-wide map browser.
    document.querySelector('#btnOpen').onclick=()=>app.openAny(args.modRoot);
    P.updateUI();
  };
})();
