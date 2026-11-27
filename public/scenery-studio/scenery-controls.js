'use strict';
/* global app, SceneryCAS, ScenerySpace */
(function(){
  function install(api){
    const {studio,selected,current,sitePoint}=api,S=ScenerySpace,canvas=document.querySelector('#gl');
    const overlay=document.createElement('canvas');overlay.id='scGizmo';overlay.setAttribute('aria-hidden','true');document.body.append(overlay);
    const tip=document.createElement('div');tip.id='scPickTip';tip.hidden=true;document.body.append(tip);
    const ctx=overlay.getContext('2d'),axes=[
      {label:'X · East',colour:'#ff8c82',field:'east',vector:[1,0,0]},
      {label:'Y · North',colour:'#86e6aa',field:'north',vector:[0,0,-1]},
      {label:'Z · Up',colour:'#8cc9ff',field:'lift',vector:[0,1,0]}
    ];
    const faces=[[0,2,6,4],[1,3,7,5],[0,1,5,4],[2,3,7,6],[0,1,3,2],[4,5,7,6]];
    let handles=[],drag=null,hover=null,lastHover=0,lastPaint='',frame=0;
    const active=()=>document.body.classList.contains('scenery-mode')&&app.view?.opts.is3D&&document.querySelector('#loading').hidden;
    const xy=ev=>{const r=canvas.getBoundingClientRect();return {x:ev.clientX-r.left,y:ev.clientY-r.top};};
    const ray=p=>app.view.ray3D(p.x,p.y);
    const visible=t=>t.ref||t.guide||(app.view.opts.pieces&&app.view.opts.mode===0);
    const target=()=>studio.scene.targets.find(t=>t.ref&&t.ref===selected());
    function selection(){
      const c=selected(),t=target();if(!c||!t?.bounds)return null;
      const points=S.box(t.bounds,c.transform,t.origin),centre=S.mul(points.reduce((v,p)=>S.add(v,p),[0,0,0]),1/8);
      return {c,t,points,centre};
    }
    function pickAt(x,y){
      const v=app.view;if(!active())return null;
      const r=v.ray3D(x,y),ground=v.pick3D(x,y);
      const limit=ground?Math.hypot(...S.sub([ground.x,v._y(ground.h),ground.y],r.o))+.06:Infinity;
      const hit=S.pick(r,studio.scene.targets.filter(visible),limit);if(hit)return hit;
      if(!v.opts.pieces||v.opts.mode!==0)return null;
      // Small native objects and bridge/ford crossings remain selectable at their tile centres.
      // Custom designs are picked at their real geometry, never their old tile marker.
      let best=null,distance=10;
      for(const site of studio.sites){
        if(studio.scene.replaced?.has(`${site.kind}:${site.x}:${site.y}`))continue;
        const p=sitePoint(site),h=Math.max(0,v.heightAt(p.x,p.y)),world=[p.x,h*v.zScale(),p.y];
        if(Math.hypot(...S.sub(world,r.o))>limit+.15)continue;
        if(ground&&Math.hypot(p.x-ground.x,p.y-ground.y)>1.35)continue;
        const at=v.projectWorld(world);if(!at)continue;
        const d=Math.hypot(at.x-x,at.y-y);if(d<distance){distance=d;best={site,component:-1,world};}
      }
      return best;
    }
    function line(a,b,colour,width=1,dash=[]){ctx.beginPath();ctx.strokeStyle=colour;ctx.lineWidth=width;ctx.setLineDash(dash);ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();ctx.setLineDash([]);}
    function label(p,text,colour){ctx.font='600 12px system-ui';ctx.lineWidth=4;ctx.strokeStyle='#14202bef';ctx.strokeText(text,p.x,p.y);ctx.fillStyle=colour;ctx.fillText(text,p.x,p.y);}
    function volume(screen){
      for(const face of faces){ctx.beginPath();face.forEach((i,j)=>j?ctx.lineTo(screen[i].x,screen[i].y):ctx.moveTo(screen[i].x,screen[i].y));ctx.closePath();ctx.fillStyle='#8bd1f309';ctx.fill();ctx.strokeStyle='#b4def0a0';ctx.lineWidth=1;ctx.stroke();}
    }
    function paint(){
      const r=canvas.getBoundingClientRect(),dpr=window.devicePixelRatio||1;
      overlay.hidden=!active();if(overlay.hidden){handles=[];return;}
      Object.assign(overlay.style,{left:r.left+'px',top:r.top+'px',width:r.width+'px',height:r.height+'px'});
      const width=Math.round(r.width*dpr),height=Math.round(r.height*dpr);if(overlay.width!==width||overlay.height!==height){overlay.width=width;overlay.height=height;}
      ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,r.width,r.height);handles=[];
      const sel=selection(),dimensions=document.querySelector('#scDimensions');
      if(!sel){
        dimensions.textContent='';const site=studio.site;if(!site)return;
        const native=studio.scene.targets.filter(t=>visible(t)&&!t.ref&&t.site.kind===site.kind&&t.site.x===site.x&&t.site.y===site.y),points=[];
        for(const t of native){const b=S.bounds(t.model.parts);if(!b)continue;const c=Math.cos(t.turn||0),s=Math.sin(t.turn||0),k=2*(t.size||1);for(const p of S.corners(b))points.push(S.add(t.origin,[k*(c*p[0]-s*p[2]),k*p[1],k*(s*p[0]+c*p[2])]));}
        if(!points.length)return;
        const b={min:[0,1,2].map(i=>Math.min(...points.map(p=>p[i]))),max:[0,1,2].map(i=>Math.max(...points.map(p=>p[i])))},screen=S.corners(b).map(p=>app.view.projectWorld(p));
        if(screen.some(p=>!p))return;volume(screen);
        const centre=app.view.projectWorld(b.min.map((v,i)=>(v+b.max[i])/2));if(centre){line({x:centre.x-5,y:centre.y},{x:centre.x+5,y:centre.y},'#fff0c7',2);line({x:centre.x,y:centre.y-5},{x:centre.x,y:centre.y+5},'#fff0c7',2);}
        dimensions.textContent='Current model selected · Use current model to edit';return;
      }
      const {c,t,points,centre}=sel,project=p=>app.view.projectWorld(p),screen=points.map(project),middle=project(centre);
      if(!middle||screen.some(p=>!p))return;
      // Transparent faces and all twelve edges reveal both the volume and its centre.
      volume(screen);
      const dims=t.bounds.max.map((v,i)=>(v-t.bounds.min[i])*c.transform[['sx','sy','sz'][i]]);
      dimensions.textContent=`Box: ${dims[0].toFixed(3)} wide × ${dims[2].toFixed(3)} deep × ${dims[1].toFixed(3)} high · tiles`;
      line({x:middle.x-6,y:middle.y},{x:middle.x+6,y:middle.y},'#fff0c7',2);line({x:middle.x,y:middle.y-6},{x:middle.x,y:middle.y+6},'#fff0c7',2);
      const pivot=project(S.toWorld([c.transform.east,c.transform.lift,c.transform.north],t.origin));
      if(pivot){line(middle,pivot,'#ffe1a87f',1,[3,3]);ctx.beginPath();ctx.arc(pivot.x,pivot.y,3,0,Math.PI*2);ctx.strokeStyle='#ffe1a8';ctx.stroke();}
      if(studio.mode==='scale'){
        const local=t.bounds.min.map((v,i)=>(v+t.bounds.max[i])/2);
        for(let axis=0;axis<3;axis++)for(const sign of [-1,1]){
          if(t.bounds.max[axis]-t.bounds.min[axis]<1e-8)continue;
          const p=local.slice();p[axis]=sign>0?t.bounds.max[axis]:t.bounds.min[axis];
          const world=S.toWorld(S.point(p,c.transform),t.origin),at=project(world);if(!at)continue;
          const localAxis=[0,0,0];localAxis[axis]=1;const direction=SceneryCAS.rotate(localAxis,c.transform),vector=[direction[0],direction[1],-direction[2]];
          const end=project(S.add(world,vector));if(!end||Math.hypot(end.x-at.x,end.y-at.y)<2)continue;
          const colour=axes[[0,2,1][axis]].colour;
          ctx.fillStyle=colour;ctx.strokeStyle='#10202a';ctx.lineWidth=2;ctx.fillRect(at.x-5,at.y-5,10,10);ctx.strokeRect(at.x-5,at.y-5,10,10);
          handles.push({type:'stretch',axis,sign,vector,world,at,label:['Width','Height','Depth'][axis]+' · drag to stretch',depth:Math.hypot(...S.sub(world,app.view._camera().eye))});
        }
        label({x:middle.x+10,y:middle.y-10},'Stretch faces', '#f8e5b9');
      }else if(studio.mode==='rotate'){
        const radius=Math.max(.6,Math.hypot(dims[0],dims[2])+.3),ring=[];
        for(let i=0;i<=64;i++){const a=i/64*Math.PI*2;ring.push(project(S.add(centre,[Math.cos(a)*radius,0,Math.sin(a)*radius])));}
        for(let i=1;i<ring.length;i++)if(ring[i-1]&&ring[i]){line(ring[i-1],ring[i],'#ffcf80',3);handles.push({type:'rotate',a:ring[i-1],at:ring[i],label:'Rotate about the centre'});}
      }else{
        for(const axis of axes){
          const p=project(S.add(centre,axis.vector));if(!p)continue;
          const dx=p.x-middle.x,dy=p.y-middle.y,pixels=Math.hypot(dx,dy);if(pixels<2)continue;
          const footprint=Math.max(0,...screen.map(q=>((q.x-middle.x)*dx+(q.y-middle.y)*dy)/pixels));
          let length=Math.min(12,Math.max(70,footprint+28)/pixels),world=S.add(centre,S.mul(axis.vector,length)),at=project(world);if(!at)continue;
          // Stagger arrow tips when two axes line up in this camera view.
          for(let i=0;i<4&&handles.some(h=>Math.hypot(h.at.x-at.x,h.at.y-at.y)<25);i++){length*=1.3;world=S.add(centre,S.mul(axis.vector,length));at=project(world);if(!at)break;}if(!at)continue;
          line(middle,at,axis.colour,2.5);
          const angle=Math.atan2(at.y-middle.y,at.x-middle.x);ctx.fillStyle=axis.colour;ctx.beginPath();ctx.moveTo(at.x,at.y);ctx.lineTo(at.x-11*Math.cos(angle-.42),at.y-11*Math.sin(angle-.42));ctx.lineTo(at.x-11*Math.cos(angle+.42),at.y-11*Math.sin(angle+.42));ctx.closePath();ctx.fill();
          label({x:at.x+8,y:at.y-7},axis.label,axis.colour);
          handles.push({type:'axis',...axis,world:centre,at,a:{x:middle.x+(at.x-middle.x)*.3,y:middle.y+(at.y-middle.y)*.3},depth:0});
        }
        handles.push({type:'move',world:centre,at:middle,label:'Move on a horizontal plane',depth:-1});
      }
    }
    function distanceToSegment(p,a,b){const dx=b.x-a.x,dy=b.y-a.y,k=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1)));return Math.hypot(p.x-a.x-dx*k,p.y-a.y-dy*k);}
    function handleAt(p){
      const tips=handles.map(h=>({h,d:Math.hypot(p.x-h.at.x,p.y-h.at.y)})).filter(x=>x.d<10).sort((a,b)=>a.d-b.d||(a.h.depth||0)-(b.h.depth||0));
      if(tips.length)return tips[0].h;
      return handles.filter(h=>h.a).map(h=>({h,d:distanceToSegment(p,h.a,h.at)})).filter(x=>x.d<6).sort((a,b)=>a.d-b.d)[0]?.h;
    }
    function drawLoop(){
      frame=requestAnimationFrame(drawLoop);if(!app.view)return;
      const c=selected(),r=canvas.getBoundingClientRect(),signature=JSON.stringify([app.view.cam,app.view.opts.is3D,app.view.opts.mode,app.view.opts.pieces,studio.mode,c?.transform,c?.hidden,studio.selected,studio.site,studio.renderSeq,r.x,r.y,r.width,r.height,window.devicePixelRatio]);
      if(signature!==lastPaint){lastPaint=signature;paint();}
    }
    async function choose(hit){
      if(!hit)return;const s=studio.sites.find(s=>s.kind===hit.site.kind&&s.x===hit.site.x&&s.y===hit.site.y)||hit.site;
      await api.selectSite(s,{focus:false,component:Math.max(0,hit.component)});
      if(!selected())api.status(`Selected ${s.name} · ${s.kind}. Use current model to start editing.`);
    }
    function cancel(){
      if(!drag)return;
      if(drag.started&&drag.c){drag.c.transform={...drag.t};studio.history.splice(drag.historyLength);studio.future=drag.future;studio.dirty=drag.dirty;document.querySelector('#scSave').textContent=studio.dirty?'Save designs •':'Save designs';api.redraw();api.renderComponents();}
      if(canvas.hasPointerCapture(drag.id))canvas.releasePointerCapture(drag.id);drag=null;tip.hidden=true;lastPaint='';
    }
    canvas.addEventListener('pointerdown',ev=>{
      if(!active()||ev.button!==0||ev.shiftKey||ev.ctrlKey||ev.altKey)return;
      paint();const p=xy(ev),handle=handleAt(p),hit=handle?null:pickAt(p.x,p.y);if(!handle&&!hit)return;
      ev.preventDefault();ev.stopImmediatePropagation();canvas.setPointerCapture(ev.pointerId);tip.hidden=true;
      const sel=selection(),canTransform=handle||(hit?.ref&&hit.ref===selected()&&studio.mode!=='navigate');
      const type=handle?.type||(canTransform?studio.mode:'select');
      drag={id:ev.pointerId,p,last:p,hit,handle,type,c:canTransform?selected():null,t:canTransform?{...selected().transform}:null,sel,started:false,moved:false,historyLength:studio.history.length,future:studio.future.slice(),dirty:studio.dirty};
      if(type==='axis'||type==='stretch')drag.axisStart=S.axisParameter(ray(p),handle.world,handle.vector);
      if(type==='move'&&sel)drag.planeStart=S.planePoint(ray(p),sel.centre,[0,1,0]);
    },true);
    canvas.addEventListener('pointermove',ev=>{
      if(!active())return;const p=xy(ev);
      if(!drag){
        const h=handleAt(p);canvas.style.cursor=h?'grab':'';
        if(ev.buttons||performance.now()-lastHover<100){tip.hidden=true;return;}lastHover=performance.now();
        hover=h?null:pickAt(p.x,p.y);tip.hidden=!h&&!hover;
        if(!tip.hidden){tip.textContent=h?.label||`${hover.site.name} · ${hover.site.kind}${hover.ref?' · '+hover.ref.name:''}`;tip.style.left=(ev.clientX+16)+'px';tip.style.top=(ev.clientY+18)+'px';canvas.style.cursor=h?'grab':'pointer';}return;
      }
      ev.preventDefault();ev.stopImmediatePropagation();if(ev.pointerId!==drag.id)return;
      const dx=p.x-drag.p.x,dy=p.y-drag.p.y;if(!drag.moved&&Math.hypot(dx,dy)<3)return;drag.moved=true;
      if(drag.type==='select'){app.view.orbit(p.x-drag.last.x,p.y-drag.last.y);drag.last=p;return;}
      if(!drag.c||drag.c!==selected()){cancel();return;}
      let t={...drag.t};const h=drag.handle;
      if(drag.type==='axis'||drag.type==='stretch'){
        const n=S.axisParameter(ray(p),h.world,h.vector);if(n==null||drag.axisStart==null)return;const delta=(n-drag.axisStart)/2;
        if(drag.type==='axis')t[h.field]+=delta;else t=S.stretch(t,drag.sel.t.bounds,h.axis,h.sign,delta);
      }else if(drag.type==='move'){
        const at=S.planePoint(ray(p),drag.sel.centre,[0,1,0]);if(!at||!drag.planeStart)return;
        t.east+=(at[0]-drag.planeStart[0])/2;t.north-=(at[2]-drag.planeStart[2])/2;
      }else if(drag.type==='rotate')t=S.rotateAboutCentre(t,drag.sel.t.bounds,dx*.5);
      else if(drag.type==='scale')t=S.scaleAboutCentre(t,drag.sel.t.bounds,Math.exp(Math.max(-10,Math.min(10,-dy*.008))));
      if(Object.values(t).some(v=>!Number.isFinite(v)||Math.abs(v)>10000))return;
      if(!drag.started){api.snapshot();drag.started=true;}drag.c.transform=t;api.changed();
      for(const n of document.querySelectorAll('#scPanel [data-field]'))n.value=t[n.dataset.field].toFixed(3);
    },true);
    canvas.addEventListener('pointerup',ev=>{
      if(!drag||ev.pointerId!==drag.id)return;ev.preventDefault();ev.stopImmediatePropagation();
      const ended=drag;drag=null;if(canvas.hasPointerCapture(ev.pointerId))canvas.releasePointerCapture(ev.pointerId);
      if(!ended.moved&&ended.hit)choose(ended.hit).catch(e=>api.status(e.message,true));
      else if(ended.started)api.renderComponents();lastPaint='';
    },true);
    canvas.addEventListener('pointercancel',ev=>{if(drag){ev.stopImmediatePropagation();cancel();}},true);
    canvas.addEventListener('lostpointercapture',()=>{if(drag)cancel();});
    canvas.addEventListener('pointerleave',()=>{tip.hidden=true;});
    canvas.addEventListener('wheel',()=>{if(drag)cancel();tip.hidden=true;},true);
    document.addEventListener('keydown',ev=>{
      if(!document.body.classList.contains('scenery-mode')||/INPUT|SELECT|TEXTAREA/.test(ev.target.tagName))return;
      const k=ev.key.toLowerCase();
      if(k==='escape'){ev.preventDefault();ev.stopImmediatePropagation();cancel();return;}
      if(drag){if(['g','r','s','v','z','y'].includes(k)){ev.preventDefault();ev.stopImmediatePropagation();}return;}
      if((ev.ctrlKey||ev.metaKey)&&k==='s'){ev.preventDefault();ev.stopImmediatePropagation();api.saveDesign().catch(e=>api.status(e.message,true));}
      else if((ev.ctrlKey||ev.metaKey)&&(k==='z'||k==='y')){ev.preventDefault();ev.stopImmediatePropagation();api.undo(k==='y'||ev.shiftKey);}
      else if(['g','r','s','v'].includes(k)){ev.preventDefault();ev.stopImmediatePropagation();api.setMode({g:'move',r:'rotate',s:'scale',v:'navigate'}[k]);}
      else if(['b','p','i','h','e','a','k','o'].includes(k)&&!ev.ctrlKey)ev.stopImmediatePropagation();
    },true);
    window.addEventListener('blur',cancel);drawLoop();
    return {pickAt,selection,paint,get handles(){return handles;},cancel};
  }
  globalThis.SceneryControls={install};
})();
