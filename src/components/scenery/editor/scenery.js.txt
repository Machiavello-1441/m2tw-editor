'use strict';
/* global app, host, CAS, SceneryCAS, SceneryProject, ScenerySpace, SceneryControls, SceneryPort, Images, M2 */
(function(){
  const $=s=>document.querySelector(s), J=(...v)=>M2.join(...v), clone=v=>JSON.parse(JSON.stringify(v));
  const studio={catalogue:null,project:null,sites:[],designs:{},site:null,selected:-1,mode:'navigate',dirty:false,history:[],future:[],cache:new Map(),pictures:new Map(),renderSeq:0,scene:{targets:[],designs:0,components:0},previews:new WeakMap(),undoBySite:new Map()};
  const slug=s=>String(s).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9_]+/g,'_').replace(/^_+|_+$/g,'').slice(0,70)||'landmark';
  const key=s=>`${s.kind}:${s.x}:${s.y}`;
  const current=()=>studio.site&&studio.designs[key(studio.site)];
  const selected=()=>current()?.components[studio.selected];
  const root=()=>app.state.project?.loc.modRoot;
  const dbPath=()=>J(root(),'data/scenery_editor/designs.json');
  const jsonBytes=v=>new TextEncoder().encode(JSON.stringify(v,null,2)+'\n');
  const textFile=async p=>new TextDecoder().decode(await host.read(p));
  const status=(s,error=false)=>{const n=$('#scStatus');n.hidden=false;n.textContent=s;n.style.borderColor=error?'#cb7966':'#62717c';};
  const run=fn=>async(...args)=>{try{return await fn(...args);}catch(e){console.error(e);status(e.message||String(e),true);}};
  function e(tag,props={},...children){const n=document.createElement(tag);for(const[k,v]of Object.entries(props)){if(k==='text')n.textContent=v;else if(k.startsWith('on'))n.addEventListener(k.slice(2),run(v));else if(k==='class')n.className=v;else n.setAttribute(k,v);}for(const c of children)n.append(c);return n;}
  function snapshot(){if(!current())return;studio.history.push(clone(current()));if(studio.history.length>80)studio.history.shift();studio.future=[];}
  let redrawPending=false;
  function changed(){studio.dirty=true;$('#scSave').textContent='Save designs •';if(!redrawPending){redrawPending=true;requestAnimationFrame(()=>{redrawPending=false;run(renderScene)();});}}
  function undo(redo=false){const from=redo?studio.future:studio.history,to=redo?studio.history:studio.future;if(!from.length)return;to.push(clone(current()));studio.designs[key(studio.site)]=from.pop();studio.selected=Math.min(studio.selected,current().components.length-1);changed();renderComponents();}
  function field(label,keyName,step=.01){const input=e('input',{type:'number',step,'data-field':keyName,value:0});input.addEventListener('change',run(()=>{const c=selected();if(!c)return;const n=Number(input.value);if(!Number.isFinite(n)||Math.abs(n)>10000||(keyName.startsWith('s')&&n<=0))throw Error('Enter a finite positive scale or a valid offset.');snapshot();c.transform[keyName]=n;changed();}));return e('label',{text:label},input);}
  function buildUI(){
    const toolbar=$('#toolbar');toolbar.prepend(e('button',{id:'scToggle',text:'Focus site',onclick:focus}));
    const panel=e('aside',{id:'scPanel','aria-label':'Scenery editor'});
    panel.append(e('h2',{text:'A place of its own'}),e('div',{class:'sc-note',text:'Click a model to select its site. All saved and unsaved designs stay visible.'}),e('h3',{text:'1 · Choose a site'}));
    panel.append(e('select',{id:'scSiteKind','aria-label':'Site type',onchange:renderSites},...[
      ['','All sites'],['settlement','Cities'],['port','Ports'],['fort','Forts'],['watchtower','Watchtowers'],['resource','Resources'],['bridge','Bridge crossings']
    ].map(([value,text])=>e('option',{value,text}))));
    panel.append(e('input',{id:'scSiteSearch',type:'search',placeholder:'Find a place, resource or coordinates…',oninput:renderSites}));
    const siteSelect=e('select',{id:'scSites',size:5,'aria-label':'Campaign sites',onchange:()=>selectSite(studio.sites.find(s=>key(s)===$('#scSites').value))});panel.append(siteSelect,e('div',{id:'scSiteInfo',class:'sc-note'}),e('div',{id:'scKindNote',class:'sc-note'}));
    panel.append(e('div',{class:'sc-row'},e('button',{text:'Focus site',onclick:focus}),e('button',{id:'scUseCurrent',text:'Use current model',onclick:useExisting})));
    const coordinates=e('details',{},e('summary',{text:'A resource or tower from a saved campaign…'}));
    coordinates.append(e('div',{class:'sc-note',text:'Enter the game coordinates of an existing resource or watchtower. This selects its scenery; it does not create the game object.'}),e('select',{id:'scCoordinateKind','aria-label':'Coordinate site type'},e('option',{value:'watchtower',text:'Watchtower'}),e('option',{value:'resource',text:'Resource'})),e('div',{class:'sc-row'},e('label',{text:'Game X'},e('input',{id:'scCoordinateX',type:'number',min:0,step:1,value:0})),e('label',{text:'Game Y'},e('input',{id:'scCoordinateY',type:'number',min:0,step:1,value:0}))),e('button',{id:'scCoordinateSelect',text:'Select this tile',onclick:()=>selectCoordinates($('#scCoordinateKind').value,Number($('#scCoordinateX').value),Number($('#scCoordinateY').value))}));panel.append(coordinates);
    panel.append(e('label',{id:'scBridgeStyleRow',text:'Bridge model to start from',hidden:''},e('select',{id:'scBridgeStyle',onchange:()=>{if(current()){snapshot();current().site.bridgeStyle=$('#scBridgeStyle').value;changed();}}},...['stone','dirt','highway'].map(value=>e('option',{value,text:value[0].toUpperCase()+value.slice(1)})))));
    panel.append(e('select',{id:'scBridges','aria-label':'Bridge clearance guides',onchange:()=>renderScene()},e('option',{value:'',text:'Bridge clearance guides: off'}),e('option',{value:'stone',text:'Stone bridge guides · approximate'}),e('option',{value:'dirt',text:'Dirt bridge guides · approximate'}),e('option',{value:'highway',text:'Highway bridge guides · approximate'})));
    panel.append(e('div',{class:'sc-note',text:'Guides use the game’s bridge meshes at nearby crossings. Actual bridges depend on campaign roads; guides are not exported.'}));
    panel.append(e('input',{id:'scName',type:'text',placeholder:'Name for this design',onchange:()=>{if(current()){snapshot();current().name=$('#scName').value;changed();}}}));
    panel.append(e('div',{id:'scFacingRow',hidden:''},e('label',{text:'Keep the port in its final map position'},e('select',{id:'scPortFacingMode',onchange:()=>{snapshot();current().site.portFacingMode=$('#scPortFacingMode').value;updatePortFacing();changed();}},e('option',{value:'auto',text:'Cancel game rotation automatically'}),e('option',{value:'manual',text:'Manual game-facing override…'}))),e('label',{text:'Game-facing angle ° · export compensation'},e('input',{id:'scFacing',type:'number',step:90,value:0,onchange:()=>{const n=Number($('#scFacing').value);if(!Number.isFinite(n)||n%90!==0)throw Error('Enter a multiple of 90°. Use Heading to rotate the design freely.');snapshot();current().site.nativeHeading=n;current().site.portFacingMode='manual';updatePortFacing();changed();}})),e('div',{id:'scPortFacingInfo',class:'sc-note'})));
    panel.append(e('h3',{text:'2 · Assemble'}),e('input',{id:'scAssetSearch',type:'search',placeholder:'Search city / resource / bridge models…',oninput:renderLibrary}),e('select',{id:'scLibrary',size:5,'aria-label':'CAS model library'}));
    panel.append(e('button',{class:'primary',text:'Add selected CAS',onclick:()=>addModel($('#scLibrary').value)}));
    const modelFolder=e('input',{type:'file',webkitdirectory:'',multiple:'',hidden:'',onchange:ev=>importFolder([...ev.target.files])});
    panel.append(e('button',{text:'Import a CAS model folder…',onclick:()=>modelFolder.click()}),modelFolder);
    panel.append(e('div',{class:'sc-row'},...['wall','tower','block'].map(kind=>e('button',{text:'+ '+kind,onclick:()=>addModel('primitive:'+kind)}))));
    panel.append(e('div',{id:'scComponents',class:'sc-list'}),e('div',{class:'sc-row'},e('button',{text:'Duplicate',onclick:()=>{if(!selected())return;snapshot();current().components.push(clone(selected()));studio.selected=current().components.length-1;selected().transform.east+=.15;changed();renderComponents();}}),e('button',{text:'Remove',onclick:()=>{if(!selected())return;snapshot();current().components.splice(studio.selected,1);studio.selected=Math.min(studio.selected,current().components.length-1);changed();renderComponents();}})));
    panel.append(e('h3',{text:'3 · Fit to the landscape'}));
    const modes=e('div',{class:'sc-row'});for(const m of ['navigate','move','rotate','scale'])modes.append(e('button',{'data-mode':m,text:m[0].toUpperCase()+m.slice(1),onclick:()=>setMode(m)}));panel.append(modes);
    panel.append(e('div',{class:'sc-note',id:'scHandleHelp',text:'Drag arrows to move: X east · Y north · Z up. In Scale, drag square face handles to stretch. Esc cancels a drag.'}));
    panel.append(e('div',{id:'scDimensions',class:'sc-note'}));
    panel.append(e('div',{class:'sc-fields'},field('East · tiles','east'),field('North · tiles','north'),field('Lift · tiles','lift'),field('Heading °','yaw',1),field('Tilt °','pitch',1),field('Roll °','roll',1),field('Width ×','sx'),field('Height ×','sy'),field('Depth ×','sz')));
    panel.append(e('div',{class:'sc-row'},e('button',{text:'Rest on ground',onclick:ground}),e('button',{text:'Reset transform',onclick:()=>{if(selected()){snapshot();selected().transform=SceneryCAS.identity();changed();renderComponents();}}})));
    panel.append(e('select',{id:'scSlot','aria-label':'Model part',onchange:()=>{if(selected()){snapshot();selected().slot=$('#scSlot').value;changed();}}},e('option',{value:'primary',text:'Main model / port land'}),e('option',{value:'secondary',text:'Fort walls / port water'})));
    panel.append(e('div',{class:'sc-note',text:'Click selects; drag the selected component in Move / Rotate / Scale. Empty ground or right-drag orbits; middle-drag or Shift-drag pans. G / R / S changes mode; V returns to Navigate.'}),e('h3',{text:'Materials & mesh parts'}));
    panel.append(e('input',{id:'scTextureSearch',type:'search',placeholder:'Find a stone, roof or timber texture…',oninput:renderTextures}),e('select',{id:'scTextures',size:4,'aria-label':'Material textures'}),e('select',{id:'scMaterialTarget','aria-label':'Mesh to retexture'}));
    panel.append(e('div',{class:'sc-row'},e('button',{text:'Apply material',onclick:()=>{const c=selected(),p=$('#scTextures').value;if(!c||!p)return;snapshot();c.materials[$('#scMaterialTarget').value]=p;changed();}}),e('button',{text:'Original material',onclick:()=>{const c=selected();if(!c)return;snapshot();delete c.materials[$('#scMaterialTarget').value];changed();}})));
    panel.append(e('button',{text:'Detach selected mesh as a component',onclick:detachPart}));
    const textureFile=e('input',{type:'file',accept:'.png,.jpg,.jpeg,.tga,.dds',hidden:'',onchange:ev=>importTexture(ev.target.files[0])});
    panel.append(e('button',{text:'Import a new texture…',onclick:()=>textureFile.click()}),textureFile);
    panel.append(e('div',{id:'scParts'}),e('div',{id:'scModelInfo',class:'sc-note'}),e('h3',{text:'4 · Save & use in game'}));
    panel.append(e('div',{class:'sc-row'},e('button',{id:'scSave',text:'Save design',onclick:saveDesign}),e('button',{text:'Undo',onclick:()=>undo()}),e('button',{text:'Redo',onclick:()=>undo(true)})));
    panel.append(e('button',{id:'scExport',class:'primary',text:'Export CAS & install at this site',onclick:install}),e('div',{class:'sc-row'},e('button',{text:'Remove site override',onclick:uninstall})));
    panel.append(e('div',{class:'sc-note',text:'All designs and installed assignments are saved together in data/scenery_editor/designs.json. Export works without M2EX. Unique tile replacement needs the M2EX integration.'}));
    panel.append(e('button',{id:'scStop',text:'Save designs & stop server',onclick:async()=>{if(studio.dirty)await saveDesign();await host.shutdown();status('Designs saved. You can close this editor.');}}));
    document.querySelector('main').append(panel);
    document.body.append(e('div',{id:'scStatus',hidden:''}),e('div',{id:'scHud',text:'Loading terrain and campaign sites…'}));
    new ResizeObserver(()=>document.body.style.setProperty('--sc-top',($('#toolbar').getBoundingClientRect().bottom+12)+'px')).observe($('#toolbar'));
    setActive(true);
  }
  function setActive(on){document.body.classList.toggle('scenery-mode',on);if(app.view){app.setTool('pan');app.view.dirty=true;}setMode('navigate');}
  function setMode(m){studio.mode=m;$('#scPanel').querySelectorAll('[data-mode]').forEach(n=>n.classList.toggle('primary',n.dataset.mode===m));}
  function renderSites(){const q=$('#scSiteSearch').value.toLowerCase(),kind=$('#scSiteKind').value,sel=$('#scSites'),matches=s=>(!kind||s.kind===kind)&&`${s.name} ${s.kind} ${s.resourceType||''} ${s.region||''} ${s.x} ${s.y} ${s.x}, ${s.y}`.toLowerCase().includes(q),items=studio.sites.filter(matches).slice(0,180);if(studio.site&&matches(studio.site)&&!items.some(s=>key(s)===key(studio.site)))items.unshift(studio.site);sel.replaceChildren();for(const s of items)sel.append(e('option',{value:key(s),text:`${s.name} · ${s.kind} (${s.x}, ${s.y})`}));if(studio.site)sel.value=key(studio.site);}
  function renderLibrary(){if(!studio.catalogue)return;const q=$('#scAssetSearch').value.toLowerCase(),sel=$('#scLibrary');sel.replaceChildren();for(const f of studio.catalogue.models.filter(f=>f.label.toLowerCase().includes(q)).slice(0,160))sel.append(e('option',{value:f.path,text:f.label}));if(sel.options.length)sel.selectedIndex=0;}
  function renderTextures(){if(!studio.catalogue)return;const q=$('#scTextureSearch').value.toLowerCase(),sel=$('#scTextures');sel.replaceChildren();for(const f of studio.catalogue.textures.filter(f=>f.label.toLowerCase().includes(q)).slice(0,120))sel.append(e('option',{value:f.path,text:f.label}));if(sel.options.length)sel.selectedIndex=0;}
  async function picture(file){if(!studio.pictures.has(file))studio.pictures.set(file,Images.decodeAny(await host.read(file),file));return studio.pictures.get(file);}
  async function asset(file){
    if(studio.cache.has(file))return studio.cache.get(file);
    let model;
    if(file.startsWith('primitive:')){model=SceneryCAS.primitive(file.slice(10));model.resolved=[null];model.pictures=[null];}
    else{
      model=CAS.parse(await host.read(file));const dir=M2.dirname(file),up=M2.dirname(dir),folders=[await app.treeFolder(dir),await app.treeFolder(up),await app.treeFolder(M2.dirname(up))];model.resolved=[];model.pictures=[];
      for(const m of model.materials){
        if(m.image){model.resolved.push(null);model.pictures.push(Images.decodeTGA(m.image));}
        else {const got=m.texture?await app.treePicture(folders,m.texture,new Map()):null;model.resolved.push(got?.file||null);model.pictures.push(got?.img||null);}
      }
    }
    studio.cache.set(file,model);return model;
  }
  async function addModel(file,slot='primary'){
    if(!current())throw Error('Choose a campaign site first.');if(!file)throw Error('Choose a model.');
    status('Loading '+M2.basename(file)+'…');const model=await asset(file);snapshot();
    current().components.push({file,name:M2.basename(file).replace(/\.cas$/i,''),slot,transform:SceneryCAS.identity(),materials:{},hidden:[]});studio.selected=current().components.length-1;
    changed();await renderComponents();status(`Added ${model.objects.length} mesh parts.${model.notes.length?' Reader notes: '+model.notes.join('; '):''}`);
  }
  function sitePoint(s=studio.site){return {x:s.x*2+1,y:(app.state.project.regions.height-1-s.y)*2+1};}
  async function selectSite(s,options={}){
    if(!s)return;
    if(studio.site&&key(studio.site)!==key(s))studio.undoBySite.set(key(studio.site),{history:studio.history,future:studio.future});
    if(!studio.site||key(studio.site)!==key(s)){const saved=studio.undoBySite.get(key(s));studio.history=saved?.history||[];studio.future=saved?.future||[];}
    studio.site=s;studio.selected=-1;
    if(!current())studio.designs[key(s)]={version:1,name:s.name,site:clone(s),components:[]};
    updatePortFacing();
    $('#scBridgeStyleRow').hidden=s.kind!=='bridge';$('#scBridgeStyle').value=current().site.bridgeStyle||'stone';
    $('#scKindNote').textContent=s.kind==='resource'?'This unique model takes priority over seasonal resource models at this site.':s.kind==='bridge'?'Preview and CAS export only. Installation will need a confirmed per-bridge replacement API.':s.manual?'This site comes from your saved project; add the model used by that campaign.':'';
    Portable.updateUI();
    studio.selected=current().components.length?Math.min(options.component??0,current().components.length-1):-1;
    $('#scName').value=current().name;$('#scSiteInfo').textContent=`${s.kind} · game tile ${s.x}, ${s.y} · ${s.region||''}`;
    if(options.focus===false){$('#scSiteKind').value='';$('#scSiteSearch').value='';}
    renderSites();await renderComponents();if(studio.site!==s)return;
    if(options.focus!==false)focus();else updateHud();await renderScene();
  }
  async function selectCoordinates(kind,x,y){
    const p=app.state.project;if(!p||!['watchtower','resource'].includes(kind)||!Number.isInteger(x)||!Number.isInteger(y)||x<0||y<0||x>=p.regions.width||y>=p.regions.height)throw Error('Enter valid game tile coordinates within this map.');
    let s=studio.sites.find(s=>s.kind===kind&&s.x===x&&s.y===y);
    if(!s){s={kind,x,y,name:kind+' at '+x+', '+y,region:'',manual:true};studio.sites.push(s);}
    $('#scSiteKind').value=kind;$('#scSiteSearch').value='';await selectSite(s);
  }
  function updatePortFacing(){
    const d=current();$('#scFacingRow').hidden=d?.site.kind!=='port';if(d?.site.kind!=='port')return;
    const manual=d.site.portFacingMode==='manual';$('#scPortFacingMode').value=manual?'manual':'auto';$('#scFacing').disabled=!manual;
    try{
      const placement=SceneryPort.placement(app.state.project,d.site);d.site.nativeHeading=placement.heading;
      $('#scFacing').value=placement.heading;$('#scPortFacingInfo').textContent=`Game rotation ${placement.heading}° · dock ${placement.dockX}, ${placement.dockY} · ${placement.source}. Export cancels this rotation; keep arranging the model as you want it to appear.`;
    }catch(err){$('#scPortFacingInfo').textContent=err.message;}
  }
  function updateHud(){if(!studio.site)return;$('#scHud').textContent=`${studio.site.name} • ${studio.site.x}, ${studio.site.y}\n${studio.scene.designs} designs · ${studio.scene.components} components visible across the map\n${selected()?selected().name+' · X east / Y north / Z up':'Use current model to start editing this site'}`;}
  function focus(){if(!studio.site||!app.view)return;const p=sitePoint(),v=app.view;app.setTool('pan');app.set3D(true);Object.assign(v.cam,{tx:p.x,tz:p.y,dist:16,pitch:.85});v.view.scale=26;v.view.x=v.canvas.width*.42-p.x*26;v.view.y=v.canvas.height*.5-p.y*26;v.dirty=true;updateHud();}
  async function useExisting(){
    if(!current())return;
    if(current().components.length){status('This site already has a design. Select its components, or add another CAS from the library.');return;}
    if(studio.site.kind==='bridge'){
      const loc=app.state.project.loc,rel='terrain/aerial_map/bridges/bridge_'+(current().site.bridgeStyle||'stone')+'.cas';
      const file=await M2.firstExisting([J(loc.dataDir,rel),loc.gameDataDir&&J(loc.gameDataDir,rel)].filter(Boolean));
      if(!file)throw Error('The selected bridge model was not found. Choose one from the library.');
      await addModel(file);selected().transform.yaw=current().site.nativeHeading||0;changed();await renderComponents();return;
    }
    const p=sitePoint(),places=app.state.project.pieces?.places||[];
    const found=places.filter(x=>x.kind===studio.site.kind&&x.x===p.x&&x.y===p.y&&x.file);
    if(!found.length)throw Error('This site has no active model at the selected campaign level. Add one from the library.');
    const port=studio.site.kind==='port'?SceneryPort.placement(app.state.project,current().site):null;
    for(let i=0;i<found.length;i++){
      await addModel(found[i].file,i===1?'secondary':'primary');const t=selected().transform;t.yaw=port?port.heading:found[i].turn*180/Math.PI;
      if(port){t.lift=-port.baseLift;if(i===1){t.east=port.dockX-studio.site.x;t.north=port.dockY-studio.site.y;}}
    }
    changed();renderComponents();
  }
  async function renderComponents(){
    updatePortFacing();
    const box=$('#scComponents');box.replaceChildren();(current()?.components||[]).forEach((c,i)=>box.append(e('button',{class:'sc-item'+(i===studio.selected?' selected':''),text:c.name,onclick:()=>{studio.selected=i;renderComponents();renderScene();}})));
    const c=selected();$('#scUseCurrent').disabled=!!current()?.components.length;updateHud();for(const n of $('#scPanel').querySelectorAll('[data-field]')){n.disabled=!c;n.value=c?Number(c.transform[n.dataset.field]).toFixed(n.dataset.field.startsWith('s')?3:2):0;}
    $('#scSlot').value=c?.slot||'primary';$('#scSlot').disabled=!c||!['port','fort'].includes(studio.site?.kind);
    const parts=$('#scParts'),target=$('#scMaterialTarget');parts.replaceChildren();target.replaceChildren(e('option',{value:'*',text:'All mesh materials'}));
    if(!c){$('#scModelInfo').textContent='Add a CAS model or create a wall, tower or block.';return;}
    const model=await asset(c.file);if(c!==selected())return;
    model.objects.forEach((o,i)=>{if(/^symbol$/i.test(o.name))return;const inp=e('input',{type:'checkbox'});inp.checked=!c.hidden.includes(i);inp.addEventListener('change',()=>{snapshot();c.hidden=inp.checked?c.hidden.filter(j=>j!==i):[...c.hidden,i];changed();});parts.append(e('label',{},inp,document.createTextNode(o.name)));target.append(e('option',{value:String(i),text:o.name}));});
    const missing=model.materials.filter((m,i)=>m.texture&&!m.image&&!model.resolved[i]).length;
    $('#scModelInfo').textContent=`${model.objects.reduce((n,o)=>n+o.idx.length/3,0).toLocaleString()} triangles · ${model.materials.length} materials${missing?' · '+missing+' missing texture(s); assign replacements before export.':''}${model.notes.length?' · '+model.notes.join('; '):''}`;
  }
  async function ground(){const c=selected();if(!c)return;const m=await asset(c.file),p=sitePoint(),v=app.view,t=c.transform;snapshot();const base=Math.max(0,v.heightAt(p.x,p.y)),local=Math.max(0,v.heightAt(p.x+t.east*2,p.y-t.north*2));let low=Infinity;for(const o of m.objects){if(/^symbol$/i.test(o.name))continue;const q=SceneryCAS.transform(o,{...t,lift:0});for(let i=1;i<q.pos.length;i+=3)low=Math.min(low,q.pos[i]);}c.transform.lift=(local-base)*.0006-low;changed();renderComponents();}
  async function componentObjects(c,forExport=false){
    const model=await asset(c.file),out=[];
    if(forExport&&model.notes.length)throw Error('This source model was only partially read: '+c.name+'. '+model.notes.join('; '));
    for(let i=0;i<model.objects.length;i++){
      const o=model.objects[i];if(c.hidden.includes(i)||/^CaozSceneCustomAttribNode$/i.test(o.name))continue;
      if(/^symbol$/i.test(o.name)&&!forExport)continue;
      const override=c.materials[String(i)]||c.materials['*'],mat=model.materials[o.material]||{texture:'',image:null};
      const source=override||model.resolved[o.material]||null;
      const image=override?await picture(override):model.pictures[o.material];
      let object=SceneryCAS.transform(o,c.transform);
      if(forExport&&current()?.site.kind==='port')object=SceneryPort.toNative(object,c.slot||'primary',current().site,SceneryPort.placement(app.state.project,current().site));
      out.push({object,sourceIndex:i,material:override?{texture:source,image:null,tail:mat.tail}:mat,source,image});
    }
    return {out,header:model.header};
  }
  function preview(c){
    const signature=JSON.stringify([c.file,c.transform,c.hidden,c.materials]),cached=studio.previews.get(c);
    if(cached?.signature===signature)return cached.promise;
    // Snapshot the component before async texture loads; stale renders never publish.
    const frozen=clone(c),promise=(async()=>{
      const {out}=await componentObjects(frozen),source=await asset(frozen.file);
      const bounds=ScenerySpace.bounds(source.objects.filter((o,i)=>!frozen.hidden.includes(i)&&!/^symbol$|^CaozSceneCustomAttribNode$/i.test(o.name)));
      const parts=out.map(o=>{const pos=o.object.pos.slice(),nrm=o.object.nrm.slice();for(let i=2;i<pos.length;i+=3){pos[i]*=-1;nrm[i]*=-1;}return {pos,nrm,uv:o.object.uv,idx:o.object.idx,image:o.image};});
      return {model:{parts},bounds};
    })();studio.previews.set(c,{signature,promise});promise.catch(()=>{if(studio.previews.get(c)?.promise===promise)studio.previews.delete(c);});return promise;
  }
  async function renderScene(){
    const seq=++studio.renderSeq,p=app.state.project,v=app.view;if(!p?.pieces?.instances||!v)return;
    const models=p.pieces.models.slice(),lists=p.pieces.instances.map(a=>Array.from(a)),targets=[],replaced=new Set(),issues=[];
    const origin=s=>{const at=sitePoint(s);return [at.x,Math.max(0,v.heightAt(at.x,at.y))*v.zScale(),at.y];};
    let designs=0,components=0;
    for(const [id,d]of Object.entries(studio.designs).sort(([a],[b])=>a.localeCompare(b))){
      if(!d.site||!d.components.length)continue;let ready=0;
      for(let i=0;i<d.components.length;i++){
        const c=d.components[i];try{
          const got=await preview(c);if(seq!==studio.renderSeq)return;
          const at=sitePoint(d.site);models.push(got.model);lists.push([at.x,at.y,0,1]);
          targets.push({site:d.site,component:i,ref:c,model:got.model,bounds:got.bounds,origin:origin(d.site)});ready++;components++;
        }catch(err){issues.push(d.name+' / '+c.name+': '+err.message);}
      }
      if(ready){replaced.add(id);designs++;}
    }
    const sites=new Map(studio.sites.map(s=>[key(s),s]));
    for(const pl of p.pieces.places){
      if(pl.modelIndex==null||pl.modelIndex<0)continue;
      const id=`${pl.kind}:${(pl.x-1)/2}:${p.regions.height-1-(pl.y-1)/2}`,site=sites.get(id);
      if(replaced.has(id)){
        const a=lists[pl.modelIndex]||[],filtered=[];for(let i=0;i<a.length;i+=4)if(a[i]!==pl.x||a[i+1]!==pl.y)filtered.push(...a.slice(i,i+4));lists[pl.modelIndex]=filtered;
      }else if(site)targets.push({site,component:-1,model:models[pl.modelIndex],origin:origin(site),turn:pl.turn||0});
    }
    const bridge=$('#scBridges').value;
    if(bridge&&studio.site&&p.loc.gameDataDir){
      try{
        const c={file:J(p.loc.gameDataDir,'terrain/aerial_map/bridges','bridge_'+bridge+'.cas'),transform:SceneryCAS.identity(),hidden:[],materials:{}},got=await preview(c),a=[];
        for(const s of studio.sites){
          if(s.kind!=='bridge'||replaced.has(key(s))||Math.abs(s.x-studio.site.x)>9||Math.abs(s.y-studio.site.y)>9)continue;
          const at=sitePoint(s),turn=(s.nativeHeading||0)*Math.PI/180;a.push(at.x,at.y,turn,1);targets.push({site:s,component:-1,model:got.model,origin:origin(s),turn,guide:true});
        }
        models.push(got.model);lists.push(a);
      }catch(err){issues.push('Bridge guides: '+err.message);}
    }
    if(seq!==studio.renderSeq)return;
    v.setSceneryModels(models);v.sceneryStart=p.pieces.models.length;v.setPieceInstances(lists.map(a=>new Float32Array(a)));v.dirty=true;
    studio.scene={targets,designs,components,replaced,issues};updateHud();studio.controls?.paint();
    if(issues.length)status('Some designs could not be previewed:\n'+issues.join('\n'),true);
  }
  async function readJson(path,fallback){try{return JSON.parse(await textFile(path));}catch(e){if(await host.exists(path))throw e;return fallback;}}
  async function detachPart(){
    const c=selected(),index=Number($('#scMaterialTarget').value);if(!c||$('#scMaterialTarget').value==='*')throw Error('Choose one mesh in the material target list first.');
    const m=await asset(c.file);snapshot();const copy=clone(c);copy.name=m.objects[index].name;copy.hidden=m.objects.map((_,i)=>i).filter(i=>i!==index);c.hidden=[...new Set([...c.hidden,index])];current().components.push(copy);studio.selected=current().components.length-1;changed();await renderComponents();
  }
  async function importFolder(files){
    if(!current())throw Error('Choose a site first.');
    const accepted=files.filter(f=>f.size>0&&/\.(cas|tga|dds)$/i.test(f.name));if(!accepted.some(f=>/\.cas$/i.test(f.name)))throw Error('Choose a folder containing a CAS model and its textures.');
    const folder=slug((accepted[0].webkitRelativePath||'model').split('/')[0])+'_'+Date.now(),dest=J(root(),'data/scenery_editor/imports',folder),writes=[],entries=[];
    for(const f of accepted){const rel=(f.webkitRelativePath||f.name).split('/').slice(1).join('/')||f.name;if(rel.split('/').some(x=>x==='..'||!x))throw Error('Invalid imported path.');const path=J(dest,rel),bytes=new Uint8Array(await f.arrayBuffer());if(/\.cas$/i.test(f.name))CAS.parse(bytes);else await Images.decodeAny(bytes,f.name);writes.push({path,data:bytes});entries.push({path,label:'Imported / '+folder+'/'+rel});}
    await saveFiles(writes);for(const entry of entries)(/\.cas$/i.test(entry.path)?studio.catalogue.models:studio.catalogue.textures).unshift(entry);renderLibrary();renderTextures();status('Imported '+entries.length+' model and texture files.');
  }
  async function saveFiles(files){const backupRoot=J(root(),'backups','scenery-'+new Date().toISOString().replace(/[:.]/g,'-'));return host.saveWithBackup({files,backupRoot,relBase:root()});}
  async function readProject(){return Portable.readProject();}
  async function saveProject(doc,assets=[]){
    const rep=await Portable.saveProject(doc,assets);
    studio.project=doc;studio.dirty=false;$('#scSave').textContent='Save designs';return rep;
  }
  async function saveDesign(){if(!current())throw Error('Choose a site first.');const doc=SceneryProject.mergeDesigns(await readProject(),studio.designs);await saveProject(doc);status('Saved all designs and installed assignments in data/scenery_editor/designs.json.');}
  async function importTexture(file){
    if(!file)return;if(!selected())throw Error('Select a model component first.');
    let bytes=new Uint8Array(await file.arrayBuffer()),ext=file.name.toLowerCase().endsWith('.dds')?'.dds':'.tga';
    if(/\.(png|jpe?g)$/i.test(file.name)){
      const bmp=await createImageBitmap(file),canvas=document.createElement('canvas');canvas.width=bmp.width;canvas.height=bmp.height;
      const ctx=canvas.getContext('2d');ctx.drawImage(bmp,0,0);bytes=Images.encodeTGA(bmp.width,bmp.height,ctx.getImageData(0,0,bmp.width,bmp.height).data,32);bmp.close();
    }
    await Images.decodeAny(bytes,ext);
    const path=J(root(),'data/scenery_editor/materials',slug(file.name.replace(/\.[^.]+$/,''))+'_'+Date.now()+ext);
    await saveFiles([{path,data:bytes}]);studio.catalogue.textures.unshift({path,label:'Imported / '+file.name});renderTextures();
    snapshot();selected().materials[$('#scMaterialTarget').value]=path;changed();status('Imported and applied '+file.name);
  }
  async function exportDesign(){
    const d=current();if(!d?.components.length)throw Error('Add a model before exporting.');
    if(d.site.kind==='port'){d.site.portPlacement=SceneryPort.placement(app.state.project,d.site);d.site.nativeHeading=d.site.portPlacement.heading;updatePortFacing();}
    if(window.SceneryStorage)return SceneryStorage.exportDesign(d,{root:root(),componentObjects,project:await readProject()});
    const base='data/models_strat/custom_sites/'+Portable.campaignSlug()+'/'+slug(d.name)+'_'+d.site.kind+'_'+d.site.x+'_'+d.site.y;
    const files=[],slots={},textures=new Map(),usedNames=new Set();let textureId=0;
    for(const slot of ['primary','secondary']){
      const objects=[],materials=[];let header=null,symbol=false;
      for(const c of d.components.filter(c=>(c.slot||'primary')===slot)){
        const result=await componentObjects(c,true);header=header||result.header;
        for(const r of result.out){
          if(/^symbol$/i.test(r.object.name)){if(symbol||d.site.kind!=='settlement')continue;symbol=true;}
          const noMaterial=r.object.material<0&&!r.source;
          let material={...r.material};
          if(material.image){
            const id=c.file+'#embedded:'+r.object.material;
            if(!textures.has(id)){
              const packaged=SceneryCAS.packageTexture(String(++textureId).padStart(3,'0')+'_embedded',material.image);
              textures.set(id,'textures/'+packaged.reference);
              for(const f of packaged.files)files.push({path:J(root(),base,'textures',f.name),data:f.data});
            }
            material.texture=textures.get(id).replace(/\//g,'\\');material.image=null;
          }else if(!noMaterial&&(material.texture||c.file.startsWith('primitive:'))){
            if(!r.source)throw Error('Choose a material for '+c.name+' / '+r.object.name+' before export.');
            if(!textures.has(r.source)){
              const stem=String(++textureId).padStart(3,'0')+'_'+slug(M2.basename(r.source).replace(/\.(tga\.)?dds$|\.tga$/i,''));
              const packaged=SceneryCAS.packageTexture(stem,await host.read(r.source));
              textures.set(r.source,'textures/'+packaged.reference);
              for(const f of packaged.files)files.push({path:J(root(),base,'textures',f.name),data:f.data});
            }
            material.texture=textures.get(r.source).replace(/\//g,'\\');material.image=null;
          }
          let name=/^symbol$/i.test(r.object.name)?'symbol':slug(d.site.kind==='bridge'?r.object.name:c.name+'_'+r.object.name);if(name!=='symbol'){let q=name,n=1;while(usedNames.has(q))q=name+'_'+n++;name=q;usedNames.add(name);}
          objects.push({...r.object,name,material:noMaterial?-1:materials.length});if(!noMaterial)materials.push(material);
        }
      }
      if(!objects.length){slots[slot]=base+'/_invisible.cas';files.push({path:J(root(),slots[slot]),data:Portable.invisibleCAS()});continue;}
      const relative=base+'/'+slug(d.name)+'_'+slot+'.cas';files.push({path:J(root(),relative),data:SceneryCAS.encode(objects,materials,header)});slots[slot]=relative;
    }
    if(slots.primary.includes('_invisible'))throw Error('The main model is empty. Assign at least one component to the main slot.');
    return {files,record:{...d.site,name:d.name,...slots}};
  }
  async function install(){
    $('#scExport').disabled=true;
    try{
      status('Exporting geometry and copying materials…');const out=await exportDesign();
      let doc=SceneryProject.recordExport(SceneryProject.mergeDesigns(await readProject(),studio.designs),out.record,current());
      if(out.record.kind!=='bridge'&&Portable.runtimeReady)doc=SceneryProject.install(doc,out.record);
      Portable.activateOnSave=out.record.kind!=='bridge'&&Portable.runtimeReady;
      const rep=await saveProject(doc,out.files);
      status(!Portable.runtimeReady?`Exported ${out.record.name}. CAS and textures are ready in ${out.record.primary}.\nTo use unique tile replacements, enable the M2EX integration.\nBackup: ${rep.backupRoot}`:out.record.kind==='bridge'?`Exported bridge CAS: ${out.record.primary}\nDesign and export details saved in the project. Bridge installation is disabled.\nBackup: ${rep.backupRoot}`:`Installed ${out.record.name} at ${out.record.x}, ${out.record.y}.\nRestart M2EX to load the named models.\nBackup: ${rep.backupRoot}`);
    }finally{$('#scExport').disabled=false;}
  }
  async function uninstall(){if(!studio.site)return;Portable.activateOnSave=true;await saveProject(SceneryProject.uninstall(SceneryProject.mergeDesigns(await readProject(),studio.designs),studio.site));status('Removed this site override. Its editable design and exported files are kept. Restart M2EX.');}
  function pointerSetup(){
    studio.controls=SceneryControls.install({studio,selected,current,sitePoint,selectSite,snapshot,changed,renderComponents,undo,saveDesign,setMode,status,redraw:run(renderScene)});
  }
  let lastProject=null;
  async function mapReady(baseChanged=false){
    const p=app.state.project;if(!p?.pc||!p.pieces?.instances||!$('#loading').hidden)return;
    if(lastProject!==p){
      await Portable.refreshCatalogue();
      studio.site=null;studio.selected=-1;studio.history=[];studio.future=[];studio.cache.clear();studio.pictures.clear();
      lastProject=p;studio.sites=SceneryProject.sitesFromMap(p,app.pcItems(),app.placeName);
      studio.project=await readProject();studio.designs=studio.project.designs;studio.undoBySite.clear();
      for(const [id,entry]of Object.entries(studio.project.exports))if(!studio.designs[id]&&entry.design?.components)studio.designs[id]=clone(entry.design);
      const known=new Set(studio.sites.map(key));for(const d of Object.values(studio.designs))if(d.site&&!known.has(key(d.site))){studio.sites.push(clone(d.site));known.add(key(d.site));}renderSites();
      app.state.settings.exag3d=1;app.state.settings.fortModel='culture';app.applyViewSettings();
      const first=studio.sites.find(s=>s.kind==='settlement')||studio.sites[0];
      if(first)await selectSite(first);Portable.updateUI();status(`${studio.sites.length.toLocaleString()} sites ready. Choose a site and add a model to begin.`);
      window.dispatchEvent(new Event('scenery-map-ready'));
    }else if(baseChanged)await renderScene();
  }
  buildUI();pointerSetup();window.addEventListener('scenery-base-ready',run(()=>mapReady(true)));
  setInterval(run(()=>mapReady(false)),2500);
  window.addEventListener('beforeunload',ev=>{if(studio.dirty){ev.preventDefault();ev.returnValue='';}});
  run(async()=>{studio.catalogue=await host.catalogue();renderLibrary();renderTextures();})();
  window.scenery={studio,asset,selectSite,selectCoordinates,addModel,useExisting,renderScene,saveDesign,exportDesign,install,uninstall,focus,ground,setMode,componentObjects,readProject,renderLibrary,renderTextures};
})();
