import { nearestRoadLimit } from './road-speed-limit-core.js?v=2';

(()=>{
  const gps=window.__trasyGps;
  if(!gps?.subscribe)return;

  const ENDPOINTS=['https://overpass-api.de/api/interpreter','https://overpass.kumi.systems/api/interpreter'];
  const QUERY_RADIUS_M=120;
  const MATCH_DISTANCE_M=70;
  const MIN_QUERY_MS=12000;
  const MIN_MOVE_M=45;
  const MAX_GPS_ACCURACY_M=90;
  const REQUEST_TIMEOUT_MS=10000;
  const LIMIT_TTL_MS=60000;
  const DRIVABLE='motorway|motorway_link|trunk|trunk_link|primary|primary_link|secondary|secondary_link|tertiary|tertiary_link|unclassified|residential|living_street|service|road';

  let lastQueryAt=0;
  let lastQueryPoint=null;
  let lastGpsPoint=null;
  let inFlight=false;
  let lastHeading=null;
  let staleTimer=0;
  let validUntil=0;
  let cachedElements=[];
  let cachedAt=0;
  let previousWayId=null;
  let endpointIndex=0;

  function haversine(a,b){
    const R=6371000,p=Math.PI/180;
    const dLat=(b.lat-a.lat)*p;
    const dLon=(b.lon-a.lon)*p;
    const h=Math.sin(dLat/2)**2+Math.cos(a.lat*p)*Math.cos(b.lat*p)*Math.sin(dLon/2)**2;
    return 2*R*Math.asin(Math.sqrt(h));
  }

  function bearing(a,b){
    const p=Math.PI/180;
    const lat1=a.lat*p,lat2=b.lat*p,dLon=(b.lon-a.lon)*p;
    const y=Math.sin(dLon)*Math.cos(lat2);
    const x=Math.cos(lat1)*Math.sin(lat2)-Math.sin(lat1)*Math.cos(lat2)*Math.cos(dLon);
    return(Math.atan2(y,x)*180/Math.PI+360)%360;
  }

  function active(){
    const map=document.getElementById('routeMapNav');
    const schedule=document.getElementById('scheduleView');
    return map?.hidden===false||schedule?.hidden===false;
  }

  function publish(detail,{staleReason=''}={}){
    clearTimeout(staleTimer);
    staleTimer=0;

    const value=Number(detail?.maxspeed);
    const hasLimit=Number.isFinite(value)&&value>0;
    window.__routeRoadSpeedLimitKmh=hasLimit?value:null;
    window.__routeRoadClass=detail?.roadClass||'';
    window.__routeHighSpeedRoad=!!detail?.highSpeedRoad;
    validUntil=hasLimit?Date.now()+LIMIT_TTL_MS:0;
    window.__routeRoadSpeedLimitValidUntil=validUntil;
    window.__routeRoadSpeedLimitState={
      hasLimit,
      osmWayId:detail?.osmWayId??null,
      roadName:detail?.name||'',
      staleReason,
      updatedAt:Date.now()
    };

    document.dispatchEvent(new CustomEvent('trasy:road-speed-limit',{detail:{
      maxspeed:window.__routeRoadSpeedLimitKmh,
      roadClass:window.__routeRoadClass,
      highSpeedRoad:window.__routeHighSpeedRoad,
      source:'openstreetmap',
      osmWayId:detail?.osmWayId??null,
      roadName:detail?.name||'',
      validUntil,
      stale:!hasLimit&&!!staleReason,
      staleReason
    }}));

    if(hasLimit){
      staleTimer=setTimeout(()=>{
        if(validUntil&&Date.now()>=validUntil)publish({},{staleReason:'ttl'});
      },LIMIT_TTL_MS+50);
    }
  }

  function queryText(lat,lon){
    return `[out:json][timeout:9];way(around:${QUERY_RADIUS_M},${lat.toFixed(6)},${lon.toFixed(6)})[highway~"^(${DRIVABLE})$"];out tags geom;`;
  }

  function match(point,heading){
    return nearestRoadLimit(cachedElements,point,{maxDistance:MATCH_DISTANCE_M,heading,previousWayId});
  }

  async function requestEndpoint(url,point){
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),REQUEST_TIMEOUT_MS);
    try{
      const body=new URLSearchParams({data:queryText(point.lat,point.lon)});
      const response=await fetch(url,{
        method:'POST',
        headers:{'Content-Type':'application/x-www-form-urlencoded;charset=UTF-8'},
        body,
        cache:'no-store',
        signal:controller.signal
      });
      if(!response.ok)throw Error(`Overpass HTTP ${response.status}`);
      const data=await response.json();
      return Array.isArray(data?.elements)?data.elements:[];
    }finally{
      clearTimeout(timeout);
    }
  }

  async function requestElements(point){
    let lastError=null;
    for(let attempt=0;attempt<ENDPOINTS.length;attempt+=1){
      const index=(endpointIndex+attempt)%ENDPOINTS.length;
      try{
        const elements=await requestEndpoint(ENDPOINTS[index],point);
        endpointIndex=index;
        return elements;
      }catch(error){
        lastError=error;
      }
    }
    endpointIndex=(endpointIndex+1)%ENDPOINTS.length;
    throw lastError||Error('Brak odpowiedzi Overpass');
  }

  async function onPosition(position){
    if(!active())return;
    const coords=position?.coords;
    const lat=Number(coords?.latitude),lon=Number(coords?.longitude),accuracy=Number(coords?.accuracy);
    if(!Number.isFinite(lat)||!Number.isFinite(lon)||!Number.isFinite(accuracy))return;

    const point={lat,lon};
    const nativeHeading=Number(coords?.heading);
    if(Number.isFinite(nativeHeading)&&nativeHeading>=0){
      lastHeading=nativeHeading;
    }else if(lastGpsPoint){
      const delta=haversine(lastGpsPoint,point);
      if(delta>=5)lastHeading=bearing(lastGpsPoint,point);
    }
    if(!lastGpsPoint||haversine(lastGpsPoint,point)>=3)lastGpsPoint=point;

    if(accuracy>MAX_GPS_ACCURACY_M){
      if(Date.now()>=validUntil)publish({},{staleReason:'gps-accuracy'});
      return;
    }

    const moved=lastQueryPoint?haversine(lastQueryPoint,point):Infinity;
    const elapsed=Date.now()-lastQueryAt;
    const local=cachedElements.length&&Date.now()-cachedAt<LIMIT_TTL_MS?match(point,lastHeading):null;
    if(local){previousWayId=local.osmWayId;publish(local)}
    if(inFlight)return;
    if(lastQueryPoint&&elapsed<MIN_QUERY_MS)return;
    if(lastQueryPoint&&moved<MIN_MOVE_M&&elapsed<30000)return;

    inFlight=true;
    lastQueryAt=Date.now();
    lastQueryPoint=point;
    try{
      cachedElements=await requestElements(point);
      cachedAt=Date.now();
      const result=match(point,lastHeading);
      previousWayId=result?.osmWayId??previousWayId;
      publish(result||{},{staleReason:result?'':'no-limit'});
    }catch(error){
      if(!local&&Date.now()>=validUntil)publish({},{staleReason:'error'});
      console.warn('Limit prędkości OSM:',error);
    }finally{
      inFlight=false;
    }
  }

  gps.subscribe(onPosition,()=>{});
  window.addEventListener('online',()=>{
    lastQueryAt=0;
    const current=gps.current?.();
    if(current)onPosition(current);
  });
  document.addEventListener('route-direction-change',()=>{
    lastQueryAt=0;
    lastQueryPoint=null;
    cachedElements=[];
    cachedAt=0;
    previousWayId=null;
    publish({},{staleReason:'route-change'});
  });
})();
