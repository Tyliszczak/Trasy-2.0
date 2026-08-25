const R=6371000;

export function distanceMeters(a,b){
  if(!a||!b)return Infinity;
  const p=Math.PI/180;
  const lat1=Number(a[0])*p;
  const lat2=Number(b[0])*p;
  const dLat=(Number(b[0])-Number(a[0]))*p;
  const dLon=(Number(b[1])-Number(a[1]))*p;
  const h=Math.sin(dLat/2)**2+Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLon/2)**2;
  return 2*R*Math.asin(Math.sqrt(h));
}

export function cumulativeDistances(geometry){
  const points=(geometry||[]).map(point=>[Number(point[1]),Number(point[0])]);
  const cumulative=new Array(points.length).fill(0);
  for(let i=1;i<points.length;i+=1){
    cumulative[i]=cumulative[i-1]+distanceMeters(points[i-1],points[i]);
  }
  return{points,cumulative};
}

export function nearestRouteIndex(points,position,{start=0,end=null}={}){
  if(!points?.length||!position)return{index:0,distance:Infinity};
  const from=Math.max(0,Math.min(points.length-1,Number(start)||0));
  const to=Math.min(points.length-1,Number.isInteger(end)?end:points.length-1);
  let best=from;
  let bestDistance=Infinity;
  for(let i=from;i<=to;i+=1){
    const distance=distanceMeters(position,points[i]);
    if(distance<bestDistance){
      best=i;
      bestDistance=distance;
    }
  }
  return{index:best,distance:bestDistance};
}

export function legRemainingSeconds({
  cumulative,
  startIndex,
  endIndex,
  legDistance,
  legDuration
}){
  const duration=Number(legDuration);
  const distance=Number(legDistance);
  if(!cumulative?.length||!Number.isFinite(duration)||duration<0||!Number.isFinite(distance)||distance<=0)return null;
  const start=Math.max(0,Math.min(cumulative.length-1,Number(startIndex)||0));
  const end=Math.max(start,Math.min(cumulative.length-1,Number(endIndex)||0));
  const remaining=Math.max(0,cumulative[end]-cumulative[start]);
  const ratio=Math.max(0,Math.min(1,remaining/distance));
  return duration*ratio;
}

export function interpolateLngLat(from,to,t){
  const k=Math.max(0,Math.min(1,Number(t)||0));
  return[
    Number(from[0])+(Number(to[0])-Number(from[0]))*k,
    Number(from[1])+(Number(to[1])-Number(from[1]))*k
  ];
}

export function cameraProfileForSpeed(speedKmh){
  const speed=Math.max(0,Math.min(110,Number(speedKmh)||0));
  const raw=Math.max(0,Math.min(1,(speed-8)/(110-8)));
  const eased=raw*raw*(3-2*raw);
  return{
    zoom:17.45-(17.45-16.75)*eased,
    pitch:52+(65-52)*eased
  };
}
