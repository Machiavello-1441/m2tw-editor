'use strict';
// Geometry for picking and handles. CAS is X east / Y up / Z north;
// the renderer uses two map vertices per tile and Z south.
(function(){
  const add=(a,b)=>a.map((v,i)=>v+b[i]), sub=(a,b)=>a.map((v,i)=>v-b[i]);
  const mul=(a,k)=>a.map(v=>v*k), dot=(a,b)=>a.reduce((n,v,i)=>n+v*b[i],0);
  const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  const unit=a=>mul(a,1/(Math.hypot(...a)||1));
  function bounds(parts){
    const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
    for(const p of parts)for(const index of p.idx)for(let a=0;a<3;a++){
      const n=p.pos[index*3+a];min[a]=Math.min(min[a],n);max[a]=Math.max(max[a],n);
    }
    return Number.isFinite(min[0])?{min,max}:null;
  }
  function corners(b){return Array.from({length:8},(_,i)=>b.min.map((v,a)=>i&(1<<a)?b.max[a]:v));}
  function point(p,t){return add(SceneryCAS.rotate([p[0]*t.sx,p[1]*t.sy,p[2]*t.sz],t),[t.east,t.lift,t.north]);}
  const toWorld=(p,origin)=>add(origin,[p[0]*2,p[1]*2,-p[2]*2]);
  function box(b,t,origin){return corners(b).map(p=>toWorld(point(p,t),origin));}
  // Return the first positive ray parameter, or null. Direction need not be normalized.
  function rayBox(ray,b,limit=Infinity){
    if(!b)return null;let lo=0,hi=limit;
    for(let a=0;a<3;a++){
      if(Math.abs(ray.d[a])<1e-12){if(ray.o[a]<b.min[a]||ray.o[a]>b.max[a])return null;continue;}
      let x=(b.min[a]-ray.o[a])/ray.d[a],y=(b.max[a]-ray.o[a])/ray.d[a];if(x>y)[x,y]=[y,x];
      lo=Math.max(lo,x);hi=Math.min(hi,y);if(lo>hi)return null;
    }
    return lo;
  }
  function triangle(ray,a,b,c){
    const e1=sub(b,a),e2=sub(c,a),h=cross(ray.d,e2),det=dot(e1,h);if(Math.abs(det)<1e-12)return null;
    const s=sub(ray.o,a),u=dot(s,h)/det;if(u<0||u>1)return null;
    const q=cross(s,e1),v=dot(ray.d,q)/det;if(v<0||u+v>1)return null;
    const t=dot(e2,q)/det;return t>=0?{t,u,v}:null;
  }
  const modelBounds=new WeakMap(),partBounds=new WeakMap();
  function hitModel(ray,model,limit=Infinity){
    if(!modelBounds.has(model))modelBounds.set(model,bounds(model.parts));
    if(rayBox(ray,modelBounds.get(model),limit)==null)return null;
    let best=null;
    for(const p of model.parts){
      if(!partBounds.has(p))partBounds.set(p,bounds([p]));
      if(rayBox(ray,partBounds.get(p),best?.t??limit)==null)continue;
      for(let j=0;j<p.idx.length;j+=3){
        const ids=[p.idx[j],p.idx[j+1],p.idx[j+2]],pts=ids.map(i=>p.pos.subarray(i*3,i*3+3));
        const h=triangle(ray,...pts);if(!h||h.t>=(best?.t??limit))continue;
        // Match the renderer's alpha cutout, so transparent quads don't intercept clicks.
        if(p.image?.data&&p.uv){
          const uv=[0,1].map(a=>p.uv[ids[0]*2+a]*(1-h.u-h.v)+p.uv[ids[1]*2+a]*h.u+p.uv[ids[2]*2+a]*h.v);
          const x=Math.floor((uv[0]-Math.floor(uv[0]))*p.image.width),y=Math.floor((uv[1]-Math.floor(uv[1]))*p.image.height);
          if(p.image.data[(y*p.image.width+x)*4+3]<89)continue;
        }
        best=h;
      }
    }
    return best;
  }
  function pick(ray,targets,limit=Infinity){
    let best=null;
    for(const target of targets){
      const c=Math.cos(target.turn||0),s=Math.sin(target.turn||0),k=2*(target.size||1);
      const inverse=p=>[(c*p[0]+s*p[2])/k,p[1]/k,(-s*p[0]+c*p[2])/k];
      const local={o:inverse(sub(ray.o,target.origin)),d:inverse(ray.d)};
      const h=hitModel(local,target.model,best?.distance??limit);
      if(h)best={...target,distance:h.t,world:add(ray.o,mul(ray.d,h.t))};
    }
    return best;
  }
  // Closest point along an axis to the mouse ray. Near-parallel axes have no stable drag.
  function axisParameter(ray,origin,axis){
    const v=sub(ray.o,origin),aa=dot(axis,axis),dd=dot(ray.d,ray.d),ad=dot(axis,ray.d),den=aa*dd-ad*ad;
    if(den<aa*dd*.002)return null;
    return (dot(v,axis)*dd-dot(v,ray.d)*ad)/den;
  }
  function planePoint(ray,origin,normal){const den=dot(ray.d,normal);if(Math.abs(den)<1e-6)return null;const t=dot(sub(origin,ray.o),normal)/den;return t>=0?add(ray.o,mul(ray.d,t)):null;}
  // Resize along a component's local axis and hold its opposite face fixed in world space.
  function stretch(t,b,axis,sign,delta){
    const out={...t},field=['sx','sy','sz'][axis],extent=b.max[axis]-b.min[axis];if(extent<1e-8)return out;
    out[field]=Math.min(10000,Math.max(.001,t[field]+sign*delta/extent));
    const anchor=sign>0?b.min[axis]:b.max[axis],local=[0,0,0];local[axis]=anchor*(t[field]-out[field]);
    const shift=SceneryCAS.rotate(local,t);out.east+=shift[0];out.lift+=shift[1];out.north+=shift[2];return out;
  }
  function scaleAboutCentre(t,b,k){
    const out={...t},centre=b.min.map((v,i)=>(v+b.max[i])/2),before=point(centre,t);
    for(const f of ['sx','sy','sz'])out[f]=Math.min(10000,Math.max(.001,t[f]*k));
    const shift=sub(before,point(centre,out));out.east+=shift[0];out.lift+=shift[1];out.north+=shift[2];return out;
  }
  function rotateAboutCentre(t,b,degrees){
    const out={...t,yaw:t.yaw+degrees},centre=b.min.map((v,i)=>(v+b.max[i])/2),shift=sub(point(centre,t),point(centre,out));
    out.east+=shift[0];out.lift+=shift[1];out.north+=shift[2];return out;
  }
  globalThis.ScenerySpace={add,sub,mul,dot,cross,unit,bounds,corners,point,toWorld,box,rayBox,triangle,hitModel,pick,axisParameter,planePoint,stretch,scaleAboutCentre,rotateAboutCentre};
})();
