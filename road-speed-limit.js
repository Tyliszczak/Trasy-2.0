import { normalizePtvSpeedLimit,distanceMeters,bearingDegrees } from './road-speed-limit-core.js?v=3';

(()=>{
  const gps=window.__trasyGps;
  if(!gps?.subscribe)return;

  const PTV_PROXY='/ptv-map/mapmatch/v1/positions';
  const MAX_GPS_ACCURACY_M=80;
  const MAX_MATCH_DISTANCE_M=80;
  const MIN_QUERY_INTERVAL_MS=10000;
  const STATIONARY_QUERY_INTERVAL_MS=30000;
  const MIN_MOVE_M=35;
  const HEADING_MIN_MOVE_M=8;
  const HEADING_MIN_SPEED_MPS=1.4;
  const HEADING_MAX_AGE_MS=45000;
  const REQUEST_TIMEOUT_MS=10000;
  const LIMIT_TTL_MS=45000;


  let lastQueryAt=0;
  let lastQueryPoint=null;
  let lastGpsPoint=null;
  let lastHeading=null;
  let lastHeadingAt=0;
  let inFlight=false;
  let validUntil=0;
  let staleTimer=0;

  function active(){
    const map=document.getElementById('routeMapNav');
    const schedule=document.getElementById('scheduleView');
    return map?.hidden===false||schedule?.hidden===false;
  }

  function publish(limit,{staleReason=''}={}){
    clearTimeout(staleTimer);
    staleTimer=0;

    const value=Number(limit?.maxspeed);
    const hasLimit=Number.isFinite(value)&&value>0;
    window.__routeRoadSpeedLimitKmh=hasLimit?value:null;
    window.__routeRoadClass='';
    window.__routeHighSpeedRoad=false;
    validUntil=hasLimit?Date.now()+LIMIT_TTL_MS:0;
    window.__routeRoadSpeedLimitValidUntil=validUntil;
    window.__routeRoadSpeedLimitState={
      hasLimit,
      source:hasLimit?'ptv-map-matching':'',
      staleReason,
      matchDistance:limit?.matchDistance??null,
      angleDifference:limit?.angleDifference??null,
      builtUpArea:limit?.builtUpArea===true,
      updatedAt:Date.now()
    };

    document.dispatchEvent(new CustomEvent('trasy:road-speed-limit',{detail:{
      maxspeed:window.__routeRoadSpeedLimitKmh,
      source:hasLimit?'ptv-map-matching':'',
      matchDistance:limit?.matchDistance??null,
      angleDifference:limit?.angleDifference??null,
      builtUpArea:limit?.builtUpArea===true,
      validUntil,
      stale:!hasLimit&&!!staleReason,
      staleReason
    }}));

    if(hasLimit){
      staleTimer=setTimeout(()=>{
        if(validUntil&&Date.now()>=validUntil)publish(null,{staleReason:'ttl'});
      },LIMIT_TTL_MS+50);
    }
  }

  function updateHeading(position,point,now){
    const speed=Number(position?.coords?.speed);
    const nativeHeading=Number(position?.coords?.heading);

    if(Number.isFinite(nativeHeading)&&nativeHeading>=0&&(!Number.isFinite(speed)||speed>=HEADING_MIN_SPEED_MPS)){
      lastHeading=(nativeHeading+360)%360;
      lastHeadingAt=now;
    }else if(lastGpsPoint){
      const moved=distanceMeters(lastGpsPoint,point);
      if(moved>=HEADING_MIN_MOVE_M){
        const derived=bearingDegrees(lastGpsPoint,point);
        if(Number.isFinite(derived)){
          lastHeading=derived;
          lastHeadingAt=now;
        }
      }
    }

    if(!lastGpsPoint||distanceMeters(lastGpsPoint,point)>=3)lastGpsPoint=point;
  }

  function usableHeading(now){
    return Number.isFinite(lastHeading)&&now-lastHeadingAt<=HEADING_MAX_AGE_MS?lastHeading:null;
  }

  function shouldQuery(point,now){
    if(inFlight)return false;
    if(!lastQueryPoint)return true;
    const elapsed=now-lastQueryAt;
    if(elapsed<MIN_QUERY_INTERVAL_MS)return false;
    const moved=distanceMeters(lastQueryPoint,point);
    return moved>=MIN_MOVE_M||elapsed>=STATIONARY_QUERY_INTERVAL_MS;
  }

  async function requestLimit(point,heading){
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),REQUEST_TIMEOUT_MS);
    try{
      const url=new URL(`${PTV_PROXY}/${point.lat.toFixed(7)}/${point.lon.toFixed(7)}`,location.origin);
      if(Number.isFinite(heading))url.searchParams.set('heading',String(Math.round(heading)));
      const response=await fetch(url.href,{
        method:'GET',
        cache:'no-store',
        credentials:'same-origin',
        headers:{Accept:'application/json'},
        signal:controller.signal
      });
      if(!response.ok)throw Error(`PTV HTTP ${response.status}`);
      const data=await response.json();
      return normalizePtvSpeedLimit(data,{maxMatchDistance:MAX_MATCH_DISTANCE_M});
    }finally{
      clearTimeout(timeout);
    }
  }

  async function onPosition(position){
    if(!active())return;
    const coords=position?.coords;
    const lat=Number(coords?.latitude),lon=Number(coords?.longitude),accuracy=Number(coords?.accuracy);
    if(!Number.isFinite(lat)||!Number.isFinite(lon)||!Number.isFinite(accuracy))return;

    const now=Date.now();
    const point={lat,lon};
    updateHeading(position,point,now);

    if(accuracy>MAX_GPS_ACCURACY_M){
      if(validUntil&&now>=validUntil)publish(null,{staleReason:'gps-accuracy'});
      return;
    }
    if(!shouldQuery(point,now))return;

    inFlight=true;
    lastQueryAt=now;
    lastQueryPoint=point;
    try{
      const limit=await requestLimit(point,usableHeading(now));
      if(limit)publish(limit);
      else publish(null,{staleReason:'no-limit'});
    }catch(error){
      if(!validUntil||Date.now()>=validUntil)publish(null,{staleReason:'error'});
      console.warn('SpeedMax PTV:',error);
    }finally{
      inFlight=false;
    }
  }

  function reset(){
    lastQueryAt=0;
    lastQueryPoint=null;
    lastGpsPoint=null;
    lastHeading=null;
    lastHeadingAt=0;
    validUntil=0;
    publish(null,{staleReason:'route-change'});
  }

  gps.subscribe(onPosition,()=>{});
  window.addEventListener('online',()=>{
    lastQueryAt=0;
    const current=gps.current?.();
    if(current)onPosition(current);
  });
  document.addEventListener('route-direction-change',reset);
})();
