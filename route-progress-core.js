export function haversineMeters(a,b){
  if(!Array.isArray(a)||!Array.isArray(b))return Infinity;
  const lon1=Number(a[0]),lat1=Number(a[1]),lon2=Number(b[0]),lat2=Number(b[1]);
  if(![lon1,lat1,lon2,lat2].every(Number.isFinite))return Infinity;
  const p=Math.PI/180,R=6371000;
  const dLat=(lat2-lat1)*p,dLon=(lon2-lon1)*p;
  const x=Math.sin(dLat/2)**2+Math.cos(lat1*p)*Math.cos(lat2*p)*Math.sin(dLon/2)**2;
  return 2*R*Math.asin(Math.sqrt(Math.min(1,x)));
}

export function nearestRoutePointIndex(coords,point,start=0,backtrack=40){
  const list=Array.isArray(coords)?coords:[];
  if(!list.length)return {index:0,distance:Infinity};
  const safeStart=Math.max(0,Math.min(Number.isFinite(Number(start))?Math.trunc(Number(start)):0,list.length-1));
  const from=Math.max(0,safeStart-Math.max(0,Math.trunc(Number(backtrack)||0)));
  let best=safeStart,bestDistance=Infinity;
  for(let i=from;i<list.length;i+=1){
    const distance=haversineMeters(list[i],point);
    if(distance<bestDistance){bestDistance=distance;best=i}
    if(i>safeStart+600&&bestDistance<20)break;
  }
  return {index:best,distance:bestDistance};
}

export function advanceRouteProgress(coords,point,previousIndex=0,accuracy=0){
  const list=Array.isArray(coords)?coords:[];
  if(list.length<2)return {index:0,distance:Infinity,advanced:false};
  const previous=Math.max(0,Math.min(Math.trunc(Number(previousIndex)||0),list.length-1));
  const snap=nearestRoutePointIndex(list,point,previous,55);
  const tolerance=Math.max(70,Math.max(0,Number(accuracy)||0)*2.2);
  if(!Number.isFinite(snap.distance)||snap.distance>tolerance){
    return {index:previous,distance:snap.distance,advanced:false};
  }
  const next=Math.max(previous,snap.index);
  return {index:next,distance:snap.distance,advanced:next>previous};
}

function projectPointToSegment(point,a,b){
  if(!Array.isArray(point)||!Array.isArray(a)||!Array.isArray(b))return null;
  const lon=Number(point[0]),lat=Number(point[1]);
  const aLon=Number(a[0]),aLat=Number(a[1]),bLon=Number(b[0]),bLat=Number(b[1]);
  if(![lon,lat,aLon,aLat,bLon,bLat].every(Number.isFinite))return null;
  const p=Math.PI/180;
  const scale=Math.max(.05,Math.cos(((lat+aLat+bLat)/3)*p));
  const px=(lon-aLon)*scale,py=lat-aLat;
  const bx=(bLon-aLon)*scale,by=bLat-aLat;
  const len2=bx*bx+by*by;
  const t=len2>0?Math.max(0,Math.min(1,(px*bx+py*by)/len2)):0;
  const projected=[aLon+(bLon-aLon)*t,aLat+(bLat-aLat)*t];
  return {point:projected,t,distance:haversineMeters(point,projected)};
}

export function projectRoutePosition(coords,point,start=0,backtrack=3,lookahead=140){
  const list=Array.isArray(coords)?coords:[];
  if(list.length<2)return {position:0,index:0,t:0,point:list[0]||null,distance:Infinity};
  const safeStart=Math.max(0,Math.min(Math.trunc(Number(start)||0),list.length-2));
  const from=Math.max(0,safeStart-Math.max(0,Math.trunc(Number(backtrack)||0)));
  const to=Math.min(list.length-2,safeStart+Math.max(1,Math.trunc(Number(lookahead)||1)));
  let best=null;
  for(let i=from;i<=to;i+=1){
    const projected=projectPointToSegment(point,list[i],list[i+1]);
    if(!projected)continue;
    if(!best||projected.distance<best.distance){
      best={position:i+projected.t,index:i,t:projected.t,point:projected.point,distance:projected.distance};
    }
  }
  return best||{position:safeStart,index:safeStart,t:0,point:list[safeStart],distance:Infinity};
}

function pointAtRoutePosition(list,position){
  const max=Math.max(0,list.length-1);
  const value=Math.max(0,Math.min(Number(position)||0,max));
  const index=Math.min(Math.floor(value),Math.max(0,list.length-2));
  const t=Math.max(0,Math.min(1,value-index));
  const a=list[index],b=list[Math.min(index+1,list.length-1)];
  return {
    position:value,
    index,
    t,
    point:[
      Number(a?.[0])+(Number(b?.[0])-Number(a?.[0]))*t,
      Number(a?.[1])+(Number(b?.[1])-Number(a?.[1]))*t
    ]
  };
}

export function splitRemainingRouteAtPosition(coords,routePosition=0,nextStopPoint=null){
  const list=Array.isArray(coords)?coords:[];
  if(list.length<2)return {active:[],future:[],stopIndex:0,progressIndex:0,routePosition:0};
  const start=pointAtRoutePosition(list,routePosition);
  let stopIndex=list.length-1;
  if(Array.isArray(nextStopPoint)){
    stopIndex=Math.max(start.index,nearestRoutePointIndex(list,nextStopPoint,start.index,0).index);
  }
  if(stopIndex<=start.index&&start.index<list.length-1)stopIndex=start.index+1;
  const tail=list.slice(start.index+1,stopIndex+1);
  const active=[start.point,...tail];
  const future=stopIndex<list.length-1?list.slice(stopIndex):[];
  return {active,future,stopIndex,progressIndex:start.index,routePosition:start.position,startPoint:start.point};
}

export function splitRemainingRoute(coords,progressIndex=0,nextStopPoint=null){
  const list=Array.isArray(coords)?coords:[];
  if(list.length<2)return {active:[],future:[],stopIndex:0,progressIndex:0};
  const start=Math.max(0,Math.min(Math.trunc(Number(progressIndex)||0),list.length-1));
  let stopIndex=list.length-1;
  if(Array.isArray(nextStopPoint)){
    stopIndex=Math.max(start,nearestRoutePointIndex(list,nextStopPoint,start,0).index);
  }
  if(stopIndex===start&&start<list.length-1)stopIndex=start+1;
  const active=list.slice(start,stopIndex+1);
  const future=stopIndex<list.length-1?list.slice(stopIndex):[];
  return {active,future,stopIndex,progressIndex:start};
}

export function createLaggedProgress(delayFixes=3,initialIndex=0){
  const delay=Math.max(0,Math.trunc(Number(delayFixes)||0));
  let visible=Math.max(0,Math.trunc(Number(initialIndex)||0));
  let queue=Array(delay).fill(visible);

  return{
    push(index){
      const next=Math.max(0,Math.trunc(Number(index)||0));
      if(delay===0){visible=next;return visible}
      queue.push(next);
      visible=queue.shift();
      return visible;
    },
    reset(index=0){
      visible=Math.max(0,Math.trunc(Number(index)||0));
      queue=Array(delay).fill(visible);
      return visible;
    },
    value(){return visible}
  };
}
