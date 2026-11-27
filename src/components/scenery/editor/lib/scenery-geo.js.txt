'use strict';
(function(){
  const limit=85.05112878,merc=lat=>Math.log(Math.tan(Math.PI/4+lat*Math.PI/360)),inv=y=>(2*Math.atan(Math.exp(y))-Math.PI/2)*180/Math.PI;
  function validate(b,width,height){
    for(const k of ['north','south','east','west'])if(!Number.isFinite(b[k]))throw Error('bbox_coords.txt needs numeric north, south, west and east values.');
    if(b.north<=b.south||b.east<=b.west||b.north>limit||b.south<-limit||b.west<-180||b.east>180)throw Error('The bounding box is outside the supported Mercator extent or has reversed edges.');
    if(b.rotation!==undefined&&!Number.isFinite(b.rotation))throw Error('Invalid bbox rotation.');
    for(const k of ['map_width','map_height','heightmap_width','heightmap_height'])if(b[k]!==undefined&&(!Number.isInteger(b[k])||b[k]<=0))throw Error('Invalid bbox dimension: '+k);
    if(width&&b.map_width&&b.map_width!==width||height&&b.map_height&&b.map_height!==height)throw Error(`The bbox is for ${b.map_width} × ${b.map_height} tiles; this campaign has ${width} × ${height}. Use its matching bbox file.`);
    if(width&&b.heightmap_width&&b.heightmap_width!==2*width+1||height&&b.heightmap_height&&b.heightmap_height!==2*height+1)throw Error('The bbox heightmap dimensions do not match this campaign.');
    return {...b,rotation:b.rotation||0};
  }
  function parse(text,width,height){
    if(text.trim().startsWith('{'))return validate(JSON.parse(text.replace(/^\uFEFF/,'')),width,height);
    const b={};for(const line of text.replace(/^\uFEFF/,'').split(/\r?\n/)){const m=/^\s*(north|south|west|east|rotation|map_width|map_height|heightmap_width|heightmap_height)\s*=\s*([^#;]+?)(?:\s*[#;].*)?\s*$/.exec(line);if(m){if(m[1] in b)throw Error('Duplicate bbox value: '+m[1]);b[m[1]]=Number(m[2]);}}
    return validate(b,width,height);
  }
  function projected(b,x,y,w,h){
    const mx=b.west+x/w*(b.east-b.west),my=merc(b.north)-y/h*(merc(b.north)-merc(b.south));
    const cx=(b.west+b.east)/2,cy=merc((b.north+b.south)/2),angle=(b.rotation||0)*Math.PI/180,dx=(mx-cx)*Math.PI/180,dy=my-cy;
    return {lon:cx+(dx*Math.cos(angle)+dy*Math.sin(angle))*180/Math.PI,my:cy+dy*Math.cos(angle)-dx*Math.sin(angle)};
  }
  function geo(b,x,y,w,h){const p=projected(b,x,y,w,h);return {lat:inv(p.my),lon:p.lon};}
  function plan(b,rect,w,h,pixels,maxZoom=18){
    const corners=[[rect.x0,rect.y0],[rect.x1,rect.y0],[rect.x0,rect.y1],[rect.x1,rect.y1]].map(([x,y])=>projected(b,x,y,w,h));
    const west=Math.min(...corners.map(p=>p.lon)),east=Math.max(...corners.map(p=>p.lon)),north=Math.max(...corners.map(p=>p.my)),south=Math.min(...corners.map(p=>p.my));
    let z=Math.max(1,Math.min(maxZoom,Math.ceil(Math.log2(Math.max(1,pixels)*360/(256*Math.max(.000001,east-west))))));
    let area;
    do{const n=2**z;area={z,n,x0:Math.max(0,Math.floor((west+180)/360*n)),x1:Math.min(n-1,Math.floor((east+180)/360*n)),y0:Math.max(0,Math.floor((1-north/Math.PI)/2*n)),y1:Math.min(n-1,Math.floor((1-south/Math.PI)/2*n))};if((area.x1-area.x0+1)*(area.y1-area.y0+1)<=48)break;z--;}while(z>=1);
    return area;
  }
  const sources={osm:{name:'OpenStreetMap',url:'https://tile.openstreetmap.org/{z}/{x}/{y}.png',maxZoom:19},topo:{name:'OpenTopoMap',url:'https://a.tile.opentopomap.org/{z}/{x}/{y}.png',maxZoom:17}};
  window.SceneryGeo={parse,validate,merc,inv,projected,geo,plan,sources};
})();
