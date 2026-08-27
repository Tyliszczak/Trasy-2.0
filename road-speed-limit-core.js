export function normalizePtvSpeedLimit(response,{maxMatchDistance=80}={}){
  const attributes=response?.segmentAttributes||{};
  const speed=Number(attributes.speedLimit);
  const matchDistance=Number(response?.matchDistance);
  const angleDifference=Number(response?.angleDifference);

  if(Number.isFinite(matchDistance)&&matchDistance>maxMatchDistance)return null;
  if(!Number.isFinite(speed)||speed<=0||speed>250)return null;

  return{
    maxspeed:Math.round(speed),
    matchDistance:Number.isFinite(matchDistance)?matchDistance:null,
    angleDifference:Number.isFinite(angleDifference)?angleDifference:null,
    builtUpArea:attributes.builtUpArea===true,
    matchedLatitude:Number.isFinite(Number(response?.latitude))?Number(response.latitude):null,
    matchedLongitude:Number.isFinite(Number(response?.longitude))?Number(response.longitude):null
  };
}

export function parseMaxspeed(value){
  const raw=String(value??'').trim().toLowerCase();
  if(!raw||raw.includes(';'))return null;
  const match=raw.match(/^(\d+(?:[.,]\d+)?)\s*(mph|km\/?h|kph)?$/i);
  if(!match)return null;
  let speed=Number(match[1].replace(',','.'));
  if(!Number.isFinite(speed)||speed<=0)return null;
  if(match[2]?.toLowerCase()==='mph')speed*=1.609344;
  return speed<=250?Math.round(speed):null;
}

const CONTEXT_LIMITS=new Map([
  ['PL:URBAN',50],
  ['PL:RURAL',90],
  ['PL:MOTORWAY',140],
  ['PL:LIVING_STREET',20],
  ['PL:LIVING-STREET',20]
]);

export function parseContextMaxspeed(value){
  const raw=String(value??'').trim().toUpperCase().replace(/\s+/g,'_');
  if(!raw||raw.includes(';'))return null;
  if(CONTEXT_LIMITS.has(raw))return CONTEXT_LIMITS.get(raw);
  const zone=raw.match(/^PL:(?:ZONE(?::|_)?|)(\d{1,3})$/);
  if(!zone)return null;
  const speed=Number(zone[1]);
  return speed>0&&speed<=250?speed:null;
}

function limitFromTags(tags,key='maxspeed'){
  const direct=parseMaxspeed(tags?.[key])??parseContextMaxspeed(tags?.[key]);
  if(direct!==null)return direct;
  if(key!=='maxspeed')return null;
  return parseContextMaxspeed(tags?.['maxspeed:type'])
    ??parseContextMaxspeed(tags?.['source:maxspeed'])
    ??parseContextMaxspeed(tags?.['zone:maxspeed']);
}

export function distanceMeters(a,b){
  const lat1=Number(a?.lat),lon1=Number(a?.lon),lat2=Number(b?.lat),lon2=Number(b?.lon);
  if(![lat1,lon1,lat2,lon2].every(Number.isFinite))return Infinity;
  const p=Math.PI/180,R=6371000;
  const dLat=(lat2-lat1)*p,dLon=(lon2-lon1)*p;
  const h=Math.sin(dLat/2)**2+Math.cos(lat1*p)*Math.cos(lat2*p)*Math.sin(dLon/2)**2;
  return 2*R*Math.asin(Math.sqrt(h));
}

export function bearingDegrees(a,b){
  const lat1=Number(a?.lat),lon1=Number(a?.lon),lat2=Number(b?.lat),lon2=Number(b?.lon);
  if(![lat1,lon1,lat2,lon2].every(Number.isFinite))return null;
  const p=Math.PI/180;
  const y=Math.sin((lon2-lon1)*p)*Math.cos(lat2*p);
  const x=Math.cos(lat1*p)*Math.sin(lat2*p)-Math.sin(lat1*p)*Math.cos(lat2*p)*Math.cos((lon2-lon1)*p);
  return(Math.atan2(y,x)*180/Math.PI+360)%360;
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
  const dx=p2.x-p1.x,dy=p2.y-p1.y;
  const lengthSquared=dx*dx+dy*dy;
  const t=lengthSquared>0?Math.max(0,Math.min(1,-((p1.x*dx)+(p1.y*dy))/lengthSquared)):0;
  return{
    distance:Math.hypot(p1.x+t*dx,p1.y+t*dy),
    bearing:(Math.atan2(dx,dy)*180/Math.PI+360)%360
  };
}

function angleDifference(a,b){
  return Math.abs(((a-b+540)%360)-180);
}

function headingMismatch(tags,bearing,heading){
  if(!Number.isFinite(heading))return 0;
  const forward=angleDifference(heading,bearing);
  const backward=angleDifference(heading,(bearing+180)%360);
  const oneway=String(tags?.oneway||'').trim().toLowerCase();
  if(['yes','1','true'].includes(oneway))return forward;
  if(oneway==='-1')return backward;
  return Math.min(forward,backward);
}

function directionalLimit(tags,bearing,heading){
  const base=limitFromTags(tags);
  if(!Number.isFinite(heading))return base;
  const forward=angleDifference(heading,bearing)<=90;
  return limitFromTags(tags,forward?'maxspeed:forward':'maxspeed:backward')??base;
}

export function nearestRoadLimit(elements,position,{maxDistance=70,heading=null,previousWayId=null,maxHeadingMismatch=68}={}){
  const origin={lat:Number(position?.lat),lon:Number(position?.lon)};
  if(!Number.isFinite(origin.lat)||!Number.isFinite(origin.lon))return null;
  const parsedHeading=heading===null||heading===undefined||heading===''?null:Number(heading);
  const usableHeading=Number.isFinite(parsedHeading)?parsedHeading:null;

  let best=null;
  for(const element of elements||[]){
    if(element?.type!=='way'||!element?.tags?.highway||!Array.isArray(element.geometry)||element.geometry.length<2)continue;
    for(let index=1;index<element.geometry.length;index+=1){
      const a={lat:Number(element.geometry[index-1]?.lat),lon:Number(element.geometry[index-1]?.lon)};
      const b={lat:Number(element.geometry[index]?.lat),lon:Number(element.geometry[index]?.lon)};
      if(!Number.isFinite(a.lat)||!Number.isFinite(a.lon)||!Number.isFinite(b.lat)||!Number.isFinite(b.lon))continue;
      const segment=segmentDistanceAndBearing(origin,a,b);
      const mismatch=headingMismatch(element.tags,segment.bearing,usableHeading);
      if(usableHeading!==null&&mismatch>maxHeadingMismatch)continue;
      const continuity=previousWayId!==null&&String(previousWayId)===String(element.id);
      const score=segment.distance+(mismatch*.45)-(continuity?14:0);
      if(!best||score<best.score)best={element,...segment,mismatch,score};
    }
  }

  if(!best||best.distance>maxDistance)return null;
  const maxspeed=directionalLimit(best.element.tags,best.bearing,usableHeading);
  return{
    maxspeed,
    roadClass:String(best.element.tags.highway||''),
    highSpeedRoad:['motorway','motorway_link','trunk','trunk_link'].includes(String(best.element.tags.highway||'')),
    distance:best.distance,
    headingMismatch:best.mismatch,
    osmWayId:best.element.id??null,
    rawMaxspeed:String(best.element.tags.maxspeed??''),
    name:String(best.element.tags.name||best.element.tags.ref||''),
    hasRoadMatch:true
  };
}

