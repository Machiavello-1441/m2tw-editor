'use strict';
(function(){
  function bounds(src){
    const lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];
    for(const part of src.parts)for(let i=0;i<part.pos.length;i+=3)for(let k=0;k<3;k++){lo[k]=Math.min(lo[k],part.pos[i+k]);hi[k]=Math.max(hi[k],part.pos[i+k]);}
    if(!Number.isFinite(lo[0]))return {center:[0,0,0],radius:0};
    return {center:lo.map((n,i)=>(n+hi[i])/2),radius:Math.hypot(...lo.map((n,i)=>(hi[i]-n)/2))};
  }
  function planes(m){const out=[];for(let axis=0;axis<3;axis++)for(const sign of [-1,1]){const p=[m[3]+sign*m[axis],m[7]+sign*m[4+axis],m[11]+sign*m[8+axis],m[15]+sign*m[12+axis]],n=Math.hypot(p[0],p[1],p[2])||1;out.push(p.map(v=>v/n));}return out;}
  function visible(planes,x,y,z,r){return planes.every(p=>p[0]*x+p[1]*y+p[2]*z+p[3]>=-r);}
  function same(a,b){if(!a||a.length!==b.length)return false;for(let i=0;i<a.length;i++)if(a[i]!==b[i])return false;return true;}
  window.SceneryPerformance={bounds,planes,visible,same};
})();
