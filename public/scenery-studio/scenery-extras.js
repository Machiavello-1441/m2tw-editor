'use strict';
(function(){
  const $=s=>document.querySelector(s),J=(...p)=>M2.join(...p),clone=x=>JSON.parse(JSON.stringify(x));
  const E=window.SceneryExtras={geo:null,bbox:null,project:null,serial:0,tiles:new Map(),stats:null};
  function el(tag,attrs={},...children){const n=document.createElement(tag);for(const[k,v]of Object.entries(attrs)){if(k==='text')n.textContent=v;else if(k.startsWith('on'))n.addEventListener(k.slice(2),v);else n.setAttribute(k,v);}n.append(...children);return n;}
  const message=(text,error=false)=>{const s=$('#scStatus');s.hidden=false;s.textContent=text;s.style.borderColor=error?'#cb7966':'#62717c';};
  const run=fn=>async(...args)=>{try{return await fn(...args);}catch(e){message(e.message,true);}};
  const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
  const merge=SceneryProject.mergeDesigns;
  SceneryProject.mergeDesigns=(doc,designs)=>{const out=merge(doc,designs);if(E.project===app.state.project&&E.geo)out.georeference=clone(E.geo);return out;};
  const dirty=()=>{scenery.studio.dirty=true;$('#scSave').textContent='Save designs •';};
  function designState(id,d){
    const p=scenery.studio.project,e=p?.exports?.[id],installed=p?.sites?.some(s=>SceneryProject.key(s)===id);
    if(!e)return 'Draft';
    if(!same(d.components,e.design?.components)||d.name!==e.design?.name)return 'Needs export';
    return installed?'Installed':'Exported';
  }
  const listDialog=el('dialog',{id:'scEditedDialog','aria-label':'Edited models'});
  const query=el('input',{type:'search',placeholder:'Search names, types or coordinates…','aria-label':'Search edited models'});
  const filter=el('select',{'aria-label':'Filter edited models'},...['All','Draft','Needs export','Exported','Installed'].map(t=>el('option',{text:t,value:t})));
  const rows=el('div',{class:'sc-edited-rows'}),summary=el('p',{class:'sc-note'});
  function refreshList(){
    const all=Object.entries(scenery.studio.designs).filter(([,d])=>d.components?.length),needle=query.value.toLowerCase();rows.replaceChildren();
    const groups={};for(const[id,d]of all){const state=designState(id,d);groups[state]=(groups[state]||0)+1;if(filter.value!=='All'&&filter.value!==state)continue;if(!`${d.name} ${id} ${d.site.x}, ${d.site.y}`.toLowerCase().includes(needle))continue;
      const b=el('button',{class:'sc-edited-row',onclick:run(async()=>{listDialog.close();await scenery.selectSite(d.site);})},el('strong',{text:d.name}),el('span',{text:`${d.site.kind} · ${d.site.x}, ${d.site.y} · ${d.components.length} components`}),el('span',{class:'sc-state',text:state}));rows.append(b);
    }
    summary.textContent=`${all.length} edited sites · `+Object.entries(groups).map(([s,n])=>`${n} ${s.toLowerCase()}`).join(' · ');
    if(!rows.childElementCount)rows.append(el('p',{text:'No designs match this filter.'}));
  }
  query.oninput=refreshList;filter.onchange=refreshList;
  listDialog.append(el('div',{class:'sc-dialog-heading'},el('h2',{text:'Edited models'}),el('button',{text:'Close',onclick:()=>listDialog.close()})),summary,el('div',{class:'sc-row'},query,filter),rows,el('p',{class:'sc-note',text:'Select a row to focus and edit that site. Saving keeps all designs together; exporting updates its existing model files.'}));document.body.append(listDialog);
  $('#toolbar').prepend(el('button',{id:'scEdited',text:'Edited models',onclick:()=>{refreshList();listDialog.showModal();}}));
  const panel=el('details',{id:'scGeoPanel'},el('summary',{text:'Geographic map overlay'}));
  const source=el('select',{id:'scGeoSource','aria-label':'Geographic overlay source'},el('option',{value:'off',text:'Overlay off'}),...Object.entries(SceneryGeo.sources).map(([value,s])=>el('option',{value,text:s.name})));
  const opacity=el('input',{id:'scGeoOpacity',type:'range',min:0,max:1,step:.05,value:.6,'aria-label':'Map overlay opacity'});
  const info=el('div',{id:'scGeoInfo',class:'sc-note',text:'Choose a campaign to load its bbox_coords.txt.'});
  const bboxFile=el('input',{type:'file',accept:'.txt,.json',hidden:''});
  function applyBBox(text){const p=app.state.project;if(!p?.regions)throw Error('Open a campaign first.');E.bbox=SceneryGeo.parse(text,p.regions.width,p.regions.height);E.geo={...(E.geo||{}),bbox:E.bbox,source:source.value,opacity:+opacity.value};dirty();updateInfo();schedule();}
  bboxFile.onchange=run(async()=>{if(bboxFile.files[0])applyBBox(await bboxFile.files[0].text());bboxFile.value='';});
  panel.append(el('p',{class:'sc-note',text:'Align online reference maps with the campaign terrain in 2D and 3D. Only the area currently in view is requested.'}),source,el('label',{text:'Overlay opacity'},opacity),el('button',{text:'Import bbox_coords.txt…',onclick:()=>bboxFile.click()}),bboxFile,info);
  $('#scPanel h2').after(panel);
  const renderInfo=el('div',{id:'scPerformance',class:'sc-note'});$('#scHud').after(renderInfo);
  const attribution=el('div',{id:'scMapAttribution',hidden:''});document.querySelector('main').append(attribution);
  source.onchange=run(()=>{if(source.value!=='off'&&!E.bbox){source.value='off';throw Error('Load the matching bbox_coords.txt first.');}E.geo={...(E.geo||{}),bbox:E.bbox,source:source.value,opacity:+opacity.value};dirty();schedule();});
  opacity.oninput=()=>{if(E.geo){E.geo.opacity=+opacity.value;dirty();}if(E.guide){E.guide.alpha=+opacity.value;if(app.view)app.view.dirty=true;}};
  function updateInfo(extra=''){info.textContent=E.bbox?`${E.bbox.west}°–${E.bbox.east}° E · ${E.bbox.south}°–${E.bbox.north}° N${E.bbox.rotation?' · '+E.bbox.rotation+'° rotation':''}${extra?'\n'+extra:''}`:extra||'No matching bbox_coords.txt has been loaded.';}
  function clearGuide(){E.serial++;if(E.guide&&app.view){app.view.guides=app.view.guides.filter(g=>g!==E.guide);app.view.deleteTexture(E.guide.tex);}E.guide=null;attribution.hidden=true;}
  let timeout=null,lastView='';
  function schedule(){clearTimeout(timeout);E.serial++;if(source.value==='off'){clearGuide();return;}timeout=setTimeout(run(refreshOverlay),350);}
  async function tile(url){
    const cached=E.tiles.get(url);if(cached){E.tiles.delete(url);E.tiles.set(url,cached);return cached;}
    const result=new Promise(resolve=>{const img=new Image();img.crossOrigin='anonymous';img.onload=()=>resolve(img);img.onerror=()=>{E.tiles.delete(url);resolve(null);};img.src=url;});E.tiles.set(url,result);
    while(E.tiles.size>96)E.tiles.delete(E.tiles.keys().next().value);return result;
  }
  function viewport(){
    const v=app.view,p=app.state.project,w=p.W-1,h=p.H-1,points=[];
    if(v.opts.is3D){const r=v.canvas.getBoundingClientRect();for(const x of [.02,.5,.98])for(const y of [.02,.5,.98]){const hit=v.pick3D(r.width*x,r.height*y);if(hit)points.push(hit);}}
    else {const z=v.view;points.push({x:-z.x/z.scale,y:-z.y/z.scale},{x:(v.canvas.width-z.x)/z.scale,y:(v.canvas.height-z.y)/z.scale});}
    if(!points.length){const c=v.cam,d=c.dist;points.push({x:c.tx-d,y:c.tz-d},{x:c.tx+d,y:c.tz+d});}
    const x0=Math.max(0,Math.min(w,...points.map(p=>p.x))),x1=Math.max(0,Math.min(w,Math.max(...points.map(p=>p.x)))),y0=Math.max(0,Math.min(h,...points.map(p=>p.y))),y1=Math.max(0,Math.min(h,Math.max(...points.map(p=>p.y))));
    return {x0,y0,x1:Math.max(x0+.01,x1),y1:Math.max(y0+.01,y1)};
  }
  async function refreshOverlay(){
    if(!E.bbox||source.value==='off'||!app.view)return;
    const v=app.view,p=app.state.project,bbox=E.bbox,provider=SceneryGeo.sources[source.value],seq=++E.serial,rect=viewport();
    const plan=SceneryGeo.plan(bbox,rect,p.W-1,p.H-1,v.canvas.clientWidth,provider.maxZoom),jobs=[];
    for(let y=plan.y0;y<=plan.y1;y++)for(let x=plan.x0;x<=plan.x1;x++)jobs.push({x,y,url:provider.url.replace('{z}',plan.z).replace('{x}',x).replace('{y}',y)});
    updateInfo('Loading '+jobs.length+' visible tiles…');
    let cursor=0,loaded=0;await Promise.all(Array.from({length:Math.min(4,jobs.length)},async()=>{while(cursor<jobs.length&&seq===E.serial){const j=jobs[cursor++];j.image=await tile(j.url);if(j.image)loaded++;}}));
    if(seq!==E.serial)return;
    if(!loaded){clearGuide();updateInfo(provider.name+' tiles are unavailable. Choose another source or try again later.');return;}
    const mosaic=document.createElement('canvas');mosaic.width=(plan.x1-plan.x0+1)*256;mosaic.height=(plan.y1-plan.y0+1)*256;
    const ctx=mosaic.getContext('2d');for(const j of jobs)if(j.image)ctx.drawImage(j.image,(j.x-plan.x0)*256,(j.y-plan.y0)*256);
    const canvas=document.createElement('canvas');canvas.width=Math.min(2048,Math.max(256,v.canvas.width));canvas.height=Math.min(2048,Math.max(256,v.canvas.height));
    const tilePoint=(x,y)=>{const g=SceneryGeo.projected(bbox,x,y,p.W-1,p.H-1);return {x:((g.lon+180)/360*plan.n-plan.x0)*256,y:((1-g.my/Math.PI)/2*plan.n-plan.y0)*256};};
    const o=tilePoint(rect.x0,rect.y0),right=tilePoint(rect.x1,rect.y0),bottom=tilePoint(rect.x0,rect.y1),a=(right.x-o.x)/canvas.width,b=(bottom.x-o.x)/canvas.height,d=(right.y-o.y)/canvas.width,e=(bottom.y-o.y)/canvas.height,det=a*e-b*d;
    if(Math.abs(det)<1e-12)throw Error('The overlay has an invalid projected extent.');
    const c=canvas.getContext('2d');c.setTransform(e/det,-d/det,-b/det,a/det,(b*o.y-e*o.x)/det,(d*o.x-a*o.y)/det);c.drawImage(mosaic,0,0);
    const guide={tex:v.makeGuideTexture(canvas),cx:(rect.x0+rect.x1)/2,cy:(rect.y0+rect.y1)/2,w:rect.x1-rect.x0,h:rect.y1-rect.y0,ang:0,alpha:+opacity.value,_sceneryGeo:true};
    const previous=E.guide;v.guides=[...v.guides.filter(g=>!g._sceneryGeo).slice(0,3),guide];E.guide=guide;if(previous)v.deleteTexture(previous.tex);v.dirty=true;
    attribution.replaceChildren(el('a',{href:'https://www.openstreetmap.org/copyright',target:'_blank',rel:'noopener',text:'© OpenStreetMap contributors'}));
    if(source.value==='topo')attribution.append(' · ',el('a',{href:'https://opentopomap.org',target:'_blank',rel:'noopener',text:'OpenTopoMap · SRTM · CC-BY-SA'}));attribution.hidden=false;
    updateInfo(`${provider.name} · zoom ${plan.z} · ${loaded}/${jobs.length} tiles`);E.stats={requested:jobs.length,loaded,zoom:plan.z,rect};
  }
  async function mapReady(){
    const p=app.state.project;if(!p||E.project===p)return;clearGuide();E.project=p;E.geo=null;E.bbox=null;lastView='';
    const doc=await scenery.readProject();E.geo=doc.georeference?clone(doc.georeference):null;
    if(E.geo?.bbox)E.bbox=SceneryGeo.validate(E.geo.bbox,p.regions.width,p.regions.height);
    else for(const path of [J(p.mapDir,'bbox_coords.txt'),J(p.loc.baseMapDir,'bbox_coords.txt')])if(await host.exists(path)){E.bbox=SceneryGeo.parse(new TextDecoder().decode(await host.read(path)),p.regions.width,p.regions.height);break;}
    E.geo={bbox:E.bbox,source:E.geo?.source||'off',opacity:E.geo?.opacity??.6};source.value=E.geo.source;opacity.value=E.geo.opacity;updateInfo();if(source.value!=='off')schedule();
  }
  window.addEventListener('scenery-map-ready',run(mapReady));
  window.addEventListener('scenery-saved',e=>{if(listDialog.open)refreshList();if(e.detail.unchanged)message(`Saved changes; reused ${e.detail.unchanged} unchanged files. Identical files were not copied into another backup.`);});
  setInterval(()=>{
    if(document.hidden)return;
    if(window.scenery?.studio.project&&$('#loading').hidden&&E.project!==app.state.project)run(mapReady)();
    if(listDialog.open)refreshList();
    const v=app.view;if(!v)return;
    const s=v.sceneryStats;if(s)renderInfo.textContent=`Models in view: ${s.visible.toLocaleString()} / ${s.total.toLocaleString()} · ${s.drawCalls.toLocaleString()} draw calls`;
    const signature=JSON.stringify([v.opts.is3D,v.cam,v.view,v.canvas.width,v.canvas.height,source.value]);
    if(signature!==lastView){lastView=signature;if(E.bbox&&source.value!=='off')schedule();}
  },400);
  E.applyBBox=applyBBox;E.refreshOverlay=refreshOverlay;E.viewport=viewport;E.refreshList=refreshList;
})();
