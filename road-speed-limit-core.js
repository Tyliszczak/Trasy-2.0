export function parseMaxspeed(value){
  const raw=String(value??'').trim().toLowerCase();
  if(!raw||raw.includes(';'))return null;
  const match=raw.match(/^(\d+(?:[.,]\d+)?)\s*(mph|km\/?h|kph)?$/i);
  if(!match)return null;
  let speed=Number(match[1].replace(',','.'));
  if(!Number.isFinite(speed)||speed<=0)return null;
  if(match[2]?.toLowerCase()==='mph')speed*=1.609344;
  if(speed>250)return null;
  return speed;
}

function toLocalMeters(point,origin){
  const latRad=origin.lat*Math.PI/180;
  return{
    x:(point.lon-origin.lon)*111320*Math.cos(latRad),
    y:(point.lat-origin.lat)*110540
  };
}

function segmentDistanceAndBearing(origin,a,b){
  const p1=toLocalMeters(a,origin);
  const p2=toLocalMeters(b,origin);
  const dx=p2.x-p1.x;
  const dy=p2.y-p1.y;
  const len2=dx*dx+dy*dy;
  let t=0;
  if(len2>0)t=Math.max(0,Math.min(1,-((p1.x*dx)+(p1.y*dy))/len2));
  const x=p1.x+t*dx;
  const y=p1.y+t*dy;
  const distance=Math.hypot(x,y);
  const bearing=(Math.atan2(dx,dy)*180/Math.PI+360)%360;
  return{distance,bearing};
}

function angleDiff(a,b){
  return Math.abs(((a-b+540)%360)-180);
}

function headingMismatch(tags,bearing,heading){
  if(!Number.isFinite(heading))return 0;
  const forward=angleDiff(heading,bearing);
  const backward=angleDiff(heading,(bearing+180)%360);
  const oneway=String(tags?.oneway||'').trim().toLowerCase();
  if(oneway==='yes'||oneway==='1'||oneway==='true')return forward;
  if(oneway==='-1')return backward;
  return Math.min(forward,backward);
}

function directionalLimit(tags,bearing,heading){
  const base=parseMaxspeed(tags?.maxspeed);
  if(!Number.isFinite(heading))return base;
  const forward=angleDiff(heading,bearing)<=90;
  const directional=parseMaxspeed(tags?.[forward?'maxspeed:forward':'maxspeed:backward']);
  return directional??base;
}

export function nearestRoadLimit(elements,position,{maxDistance=55,heading=null,previousWayId=null,maxHeadingMismatch=68}={}){
  const origin={lat:Number(position?.lat),lon:Number(position?.lon)};
  if(!Number.isFinite(origin.lat)||!Number.isFinite(origin.lon))return null;

  const parsedHeading=heading===null||heading===undefined||heading===''?null:Number(heading);
  const usableHeading=Number.isFinite(parsedHeading)?parsedHeading:null;

  let best=null;
  for(const element of elements||[]){
    if(element?.type!=='way'||!element?.tags?.highway||!Array.isArray(element.geometry)||element.geometry.length<2)continue;
    for(let i=1;i<element.geometry.length;i+=1){
      const a={lat:Number(element.geometry[i-1]?.lat),lon:Number(element.geometry[i-1]?.lon)};
      const b={lat:Number(element.geometry[i]?.lat),lon:Number(element.geometry[i]?.lon)};
      if(!Number.isFinite(a.lat)||!Number.isFinite(a.lon)||!Number.isFinite(b.lat)||!Number.isFinite(b.lon))continue;
      const segment=segmentDistanceAndBearing(origin,a,b);
      const mismatch=headingMismatch(element.tags,segment.bearing,usableHeading);
      if(usableHeading!==null&&mismatch>maxHeadingMismatch)continue;
      const continuity=previousWayId!==null&&String(previousWayId)===String(element.id);
      const score=segment.distance+(mismatch*.45)-(continuity?16:0);
      if(!best||score<best.score){
        best={element,distance:segment.distance,bearing:segment.bearing,mismatch,score};
      }
    }
  }

  if(!best||best.distance>maxDistance)return null;
  const limit=directionalLimit(best.element.tags,best.bearing,usableHeading);
  return{
    maxspeed:limit,
    roadClass:String(best.element.tags.highway||''),
    highSpeedRoad:['motorway','motorway_link','trunk','trunk_link'].includes(String(best.element.tags.highway||'')),
    distance:best.distance,
    headingMismatch:best.mismatch,
    osmWayId:best.element.id??null,
    rawMaxspeed:best.element.tags.maxspeed??'',
    name:String(best.element.tags.name||best.element.tags.ref||'')
  };
}
