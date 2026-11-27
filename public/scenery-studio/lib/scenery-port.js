'use strict';
// Port geometry is authored in final map coordinates. The native renderer still
// rotates it and places the land and dock parts on different tiles at sea level.
(function(){
  const directions=[[0,1],[1,0],[0,-1],[-1,0]],normalAngle=n=>((n%360)+540)%360-180;
  function facing(x,y,sea){
    // M2EX SM::PORT_BUILDING::setup_orientation, RVA 0x1178870 in this build:
    // cardinal order N/E/S/W; headings 180/270/0/90; sea ground types 10..12.
    // Its byte counter resets only on a new best candidate (not on a tie).
    let best=0,count=0,result=null;
    for(let i=0;i<4;i++){
      const [dx,dy]=directions[i],cx=x+dx,cy=y+dy;if(!sea(cx,cy))continue;
      for(const [ox,oy]of directions)if(sea(cx+ox,cy+oy))count++;
      if(count>best){best=count;count=0;result={heading:normalAngle(180+i*90),dockX:cx,dockY:cy,seaDirection:['north','east','south','west'][i]};}
    }
    return result;
  }
  function fromMap(p,site){
    const width=p.regions.width,height=p.regions.height,heights=p.heights?.data;
    const measured=!!heights&&p.heights.source!=='none';
    const sea=(x,y)=>{
      if(x<0||y<0||x>=width||y>=height)return false;
      const index=(2*(height-1-y)+1)*p.W+2*x+1;
      // WORLD_MAP::calculate_ground_types (0x193e910) forces non-positive
      // height centres to sea and positive centres to land, overriding paint.
      // map.rwm's visual ground byte alone is therefore not the gameplay type.
      if(measured)return heights[index]<=0;
      const key=p.gtTable[p.gtIdx[index]]?.key;
      return ['ocean','sea_deep','sea_shallow'].includes(key);
    };
    const value=facing(site.x,site.y,sea);return value?{...value,source:measured?(p.heights.source||'height map'):'ground map (no heights)'}:null;
  }
  function placement(p,site){
    let result=fromMap(p,site);
    if(site.portFacingMode==='manual'){
      const heading=Number(site.nativeHeading);if(!Number.isFinite(heading)||Math.abs(heading/90-Math.round(heading/90))>1e-6)throw Error('Port facing must be a multiple of 90°. Use Heading to rotate your design freely.');
      const a=heading*Math.PI/180;result={heading:normalAngle(heading),dockX:site.x-Math.round(Math.sin(a)),dockY:site.y-Math.round(Math.cos(a)),source:'manual'};
    }
    if(!result)throw Error('No valid sea-facing dock was found for this port. Check the map or choose a manual port facing.');
    const index=(2*(p.regions.height-1-site.y)+1)*p.W+2*site.x+1,baseLift=Math.max(0,p.heights?.data?.[index]||0)*.0006;
    return {version:1,...result,baseLift};
  }
  function toNative(object,slot,site,placement){
    const dock=slot==='secondary',offset={...SceneryCAS.identity(),east:dock?site.x-placement.dockX:0,north:dock?site.y-placement.dockY:0,lift:placement.baseLift};
    const shifted=SceneryCAS.transform(object,offset);
    // Counter-rotate the whole composition, including offsets and normals.
    return SceneryCAS.transform(shifted,{...SceneryCAS.identity(),yaw:-placement.heading});
  }
  function fromNative(object,slot,site,placement){
    const turned=SceneryCAS.transform(object,{...SceneryCAS.identity(),yaw:placement.heading}),dock=slot==='secondary';
    return SceneryCAS.transform(turned,{...SceneryCAS.identity(),east:dock?placement.dockX-site.x:0,north:dock?placement.dockY-site.y:0,lift:-placement.baseLift});
  }
  globalThis.SceneryPort={facing,fromMap,placement,toNative,fromNative};
})();
