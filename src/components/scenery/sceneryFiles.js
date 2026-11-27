// All model/map bytes stay in the browser and the folders selected by the user.
export function normalizePath(path) {
  const out=[];
  for(const part of String(path).replace(/\\/g,'/').split('/')){
    if(!part||part==='.')continue;
    if(part==='..'){if(out.length<=1)throw Error('Path leaves the selected folder.');out.pop();}
    else out.push(part);
  }
  if(out.length)out[0]=out[0].toLowerCase();
  if(!['mod','game','library','workspace'].includes(out[0]))throw Error('Choose a local folder first.');
  return '/'+out.join('/');
}
export function fileListMount(files){
  const entries=new Map();
  for(const file of files){const rel=(file.webkitRelativePath||file.name).replace(/\\/g,'/').split('/');if(file.webkitRelativePath)rel.shift();entries.set(rel.join('/').toLowerCase(),{file,name:rel.at(-1),rel:rel.join('/')});}
  return {name:files[0]?.webkitRelativePath?.split('/')[0]||'Selected folder',entries};
}
export function createScenerySession(mounts,onChange=()=>{}){
  const memory=new Map(),pending=new Map(),directoryCache=new Map();
  const name=mounts.mod?.name||'mod',settingsKey='m2tw_scenery_settings:'+name;
  const key=p=>normalizePath(p).toLowerCase();
  const parts=p=>normalizePath(p).slice(1).split('/');
  async function entries(handle,dir){
    if(!directoryCache.has(dir)){const map=new Map();for await(const child of handle.values())map.set(child.name.toLowerCase(),child);directoryCache.set(dir,map);}
    return directoryCache.get(dir);
  }
  async function native(path,create=false,file=false){
    const a=parts(path),mount=a.shift();let handle=mounts[mount];
    if(!handle||handle.entries instanceof Map)throw new DOMException('File not found','NotFoundError');
    let dir='/'+mount;
    for(let i=0;i<a.length;i++){
      const last=i===a.length-1,existing=(await entries(handle,dir)).get(a[i].toLowerCase());
      if(existing)handle=existing;
      else if(create){handle=last&&file?await handle.getFileHandle(a[i],{create:true}):await handle.getDirectoryHandle(a[i],{create:true});directoryCache.delete(dir);}
      else throw new DOMException('File not found','NotFoundError');
      dir+='/'+a[i].toLowerCase();
    }
    return handle;
  }
  async function read(path){
    const k=key(path);if(memory.has(k))return memory.get(k).slice();
    const a=parts(path),mount=mounts[a.shift()];
    if(mount?.entries instanceof Map){const entry=mount.entries.get(a.join('/').toLowerCase());if(!entry)throw Error('File not found: '+path);return new Uint8Array(await entry.file.arrayBuffer());}
    try{const h=await native(path);if(h.kind!=='file')throw Error('Not a file');return new Uint8Array(await(await h.getFile()).arrayBuffer());}
    catch(e){throw Error('Cannot read '+path+': '+e.message);}
  }
  async function stat(path){
    const k=key(path);if(memory.has(k))return {isDir:false,size:memory.get(k).length,mtimeMs:0};
    const a=parts(path),mountName=a.shift(),mount=mounts[mountName],rel=a.join('/').toLowerCase();
    if(mount?.entries instanceof Map){const e=mount.entries.get(rel);if(e)return {isDir:false,size:e.file.size,mtimeMs:e.file.lastModified};if(!rel||[...mount.entries.keys()].some(k=>k.startsWith(rel+'/')))return {isDir:true,size:0,mtimeMs:0};}
    if(mount&&!(mount.entries instanceof Map))try{const h=await native(path);if(h.kind==='directory')return {isDir:true,size:0,mtimeMs:0};const f=await h.getFile();return {isDir:false,size:f.size,mtimeMs:f.lastModified};}catch(e){if(e.name!=='NotFoundError'&&e.name!=='TypeMismatchError')throw e;}
    if([...memory.keys()].some(n=>n.startsWith(k+'/')))return {isDir:true,size:0,mtimeMs:0};return null;
  }
  async function list(path){
    const k=key(path),a=parts(path),mount=mounts[a.shift()],rel=a.join('/').toLowerCase(),out=new Map();
    function add(rest,original){const p=rest.split('/');if(p[0])out.set(p[0],{name:p.length===1?(original||p[0]):p[0],isDir:p.length>1});}
    if(mount?.entries instanceof Map){for(const[r,e]of mount.entries)if(!rel||r.startsWith(rel+'/'))add(rel?r.slice(rel.length+1):r,e.name);}
    else if(mount)try{const h=await native(path);if(h.kind==='directory')for(const c of (await entries(h,k)).values())out.set(c.name.toLowerCase(),{name:c.name,isDir:c.kind==='directory'});}catch(e){if(e.name!=='NotFoundError'&&e.name!=='TypeMismatchError')throw e;}
    for(const p of memory.keys())if(p.startsWith(k+'/'))add(p.slice(k.length+1));
    return [...out.values()];
  }
  async function write(path,data){
    const p=normalizePath(path),k=p.toLowerCase(),root=parts(path)[0];
    if(!['mod','workspace'].includes(root))throw Error('Game and extra-library folders are read-only.');
    const bytes=data instanceof Uint8Array?data:new Uint8Array(data);
    if(root==='workspace'||mounts.mod.entries instanceof Map){memory.set(k,bytes.slice());if(root==='mod'){pending.set(p.slice(5),bytes.slice());session.pendingVersion++;}}
    else {const handle=await native(p,true,true),stream=await handle.createWritable();try{await stream.write(bytes);await stream.close();}catch(e){await stream.abort().catch(()=>{});throw e;}}
    directoryCache.delete(p.slice(0,p.lastIndexOf('/')).toLowerCase());onChange();
  }
  async function catalogue(){
    const models=[],textures=[];
    const bases=[['/mod/data/models_strat','Mod models'],['/mod/data/terrain/aerial_map/bridges','Mod bridges'],['/mod/data/scenery_editor','Imported']];
    if(mounts.game)bases.push(['/game/data/models_strat','Game models'],['/game/data/terrain/aerial_map/bridges','Game bridges']);
    if(mounts.library)bases.push(['/library','Extra library']);
    async function walk(dir,label,base){for(const entry of await list(dir)){const p=dir+'/'+entry.name;if(entry.isDir)await walk(p,label,base);else if(/\.(cas|tga|dds)$/i.test(p)){const item={path:p,label:label+' / '+p.slice(base.length+1),group:label};(/\.cas$/i.test(p)?models:textures).push(item);}}}
    for(const[dir,label]of bases)await walk(dir,label,dir);return {models,textures,modRoot:'/mod'};
  }
  async function saveWithBackup({files=[],moves=[],backupRoot,relBase='/mod'}){
    if(moves.length)throw Error('Moving terrain files is not supported in the online scenery editor.');
    const backedUp=[],written=[];
    for(const f of files)if(await stat(f.path)){const backup=backupRoot+'/'+normalizePath(f.path).slice(normalizePath(relBase).length+1);await write(backup,await read(f.path));backedUp.push(backup);}
    for(const f of files){await write(f.path,f.data);written.push(f.path);}
    return {backupRoot,backedUp,written};
  }
  const session={mounts,read,stat,list,write,catalogue,saveWithBackup,pending,pendingVersion:0,downloadedVersion:0,
    config:{open:'/mod',modRoot:'/mod',gameRoot:mounts.game?'/game':'',libraryRoot:mounts.library?'/library':'',portable:true,web:true,webDownloadOnly:mounts.mod.entries instanceof Map},
    loadSettings:()=>JSON.parse(localStorage.getItem(settingsKey)||'{}'),
    saveSettings:value=>localStorage.setItem(settingsKey,JSON.stringify(value)),
    remove:path=>{if(parts(path)[0]!=='workspace')throw Error('Only editor workspace files can be removed.');memory.delete(key(path));},
  };
  return session;
}
