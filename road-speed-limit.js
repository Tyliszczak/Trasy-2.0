import {nearestRoadLimit,distanceMeters,bearingDegrees} from './road-speed-limit-core.js?v=5';
import {readVmaxCache,writeVmaxCache} from './offline-vmax-cache.js?v=1';

(()=>{
  const gps=window.__trasyGps;
  if(!gps?.subscribe)return;

  const OSM_PROXY='/osm-vmax';
  const MAX_GPS_ACCURACY_M=80;
  const MAX_ROAD_DISTANCE_M=70;
  const OSM_MIN_QUERY_INTERVAL_MS=15000;
  const OSM_STATIONARY_QUERY_INTERVAL_MS=60000;
  const OSM_MIN_MOVE_M=65;
  const OSM_CACHE_TTL_MS=90000;
  const HEADING_MIN_MOVE_M=8;
  const HEADING_MIN_SPEED_MPS=1.4;
  const HEADING_MAX_AGE_MS=45000;
  const REQUEST_TIMEOUT_MS=15000;
  const LIMIT_TTL_MS=60000;

  let lastOsmQueryAt=0;
  let lastOsmQueryPoint=null;
  let lastGpsPoint=null;
  let lastHeading=null;
  let lastHeadingAt=0;
  let previousWayId=null;
  let osmElements=[];
  let osmElementsAt=0;
  let inFlight=false;
  let validUntil=0;
  let staleTimer=0;
  let lastSource='';

  function active(){
    const map=document.getElementById('routeMapNav');
    const schedule=document.getElementById('scheduleView');
    return map?.hidden===false||schedule?.hidden===false;
  }

  function publish(limit,{source='',staleReason='',attempts=[]}={}){
    clearTimeout(staleTimer);
    staleTimer=0;

    const value=Number(limit?.maxspeed);
    const hasLimit=Number.isFinite(value)&&value>0;
    const resolvedSource=hasLimit?String(source||limit?.source||lastSource):'';
    if(hasLimit)lastSource=resolvedSource;
    window.__routeRoadSpeedLimitKmh=hasLimit?Math.round(value):null;
    window.__routeRoadClass=String(limit?.roadClass||'');
    window.__routeHighSpeedRoad=!!limit?.highSpeedRoad;
    validUntil=hasLimit?Date.now()+LIMIT_TTL_MS:0;
    window.__routeRoadSpeedLimitValidUntil=validUntil;
    window.__routeRoadSpeedLimitState={
      hasLimit,
      source:resolvedSource,
      staleReason,
      osmWayId:limit?.osmWayId??null,
      roadName:limit?.name||'',
      matchDistance:limit?.matchDistance??limit?.distance??null,
      attempts,
      updatedAt:Date.now()
    };

    document.dispatchEvent(new CustomEvent('trasy:road-speed-limit',{detail:{
      maxspeed:window.__routeRoadSpeedLimitKmh,
      roadClass:window.__routeRoadClass,
      highSpeedRoad:window.__routeHighSpeedRoad,
      source:resolvedSource,
      osmWayId:limit?.osmWayId??null,
      roadName:limit?.name||'',
      validUntil,
      stale:!hasLimit&&!!staleReason,
      staleReason
    }}));

    if(hasLimit){
      staleTimer=setTimeout(()=>{
        if(validUntil&&Date.now()>=validUntil)publish(null,{staleReason:'ttl',attempts:['expired']});
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

  function osmMatch(point,heading){
    if(!osmElements.length||Date.now()-osmElementsAt>OSM_CACHE_TTL_MS)return null;
    return nearestRoadLimit(osmElements,point,{maxDistance:MAX_ROAD_DISTANCE_M,heading,previousWayId});
  }

  function shouldRefreshOsm(point,now){
    if(!lastOsmQueryPoint)return true;
    const elapsed=now-lastOsmQueryAt;
    if(elapsed<OSM_MIN_QUERY_INTERVAL_MS)return false;
    return distanceMeters(lastOsmQueryPoint,point)>=OSM_MIN_MOVE_M||elapsed>=OSM_STATIONARY_QUERY_INTERVAL_MS;
  }

  async function fetchJson(url){
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),REQUEST_TIMEOUT_MS);
    try{
      const response=await fetch(url,{
        method:'GET',
        cache:'no-store',
        credentials:'same-origin',
        headers:{Accept:'application/json'},
        signal:controller.signal
      });
      if(!response.ok)throw Error(`HTTP ${response.status}`);
      return response.json();
    }finally{
      clearTimeout(timeout);
    }
  }

  async function requestOsmNetwork(point){
    const url=new URL(`${OSM_PROXY}/${point.lat.toFixed(5)}/${point.lon.toFixed(5)}`,location.origin);
    const data=await fetchJson(url.href);
    return Array.isArray(data?.elements)?data.elements:[];
  }

  async function requestOsm(point){
    const fresh=await readVmaxCache(point).catch(()=>null);
    if(fresh)return{elements:fresh.elements,cache:'device'};
    try{
      const elements=await requestOsmNetwork(point);
      writeVmaxCache(point,elements).catch(error=>console.warn('Pamięć VMAX:',error));
      return{elements,cache:'network'};
    }catch(error){
      const stale=await readVmaxCache(point,{allowStale:true}).catch(()=>null);
      if(stale)return{elements:stale.elements,cache:'device-stale'};
      throw error;
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
    const heading=usableHeading(now);

    if(accuracy>MAX_GPS_ACCURACY_M){
      if(validUntil&&now>=validUntil)publish(null,{staleReason:'gps-accuracy',attempts:['gps-accuracy']});
      return;
    }

    const local=osmMatch(point,heading);
    if(local?.maxspeed){
      previousWayId=local.osmWayId;
      publish(local,{source:'openstreetmap',attempts:['osm-cache']});
    }

    if(inFlight)return;
    if(!shouldRefreshOsm(point,now)){
      if(!local?.maxspeed&&!validUntil)publish(null,{staleReason:'no-limit',attempts:['osm-cache-no-limit']});
      return;
    }

    inFlight=true;
    lastOsmQueryAt=now;
    lastOsmQueryPoint=point;
    const attempts=['osm'];
    try{
      try{
        const osm=await requestOsm(point);
        osmElements=osm.elements;
        osmElementsAt=Date.now();
        attempts.push(`osm-${osm.cache}`);
        const result=osmMatch(point,heading);
        if(result?.maxspeed){
          previousWayId=result.osmWayId;
          publish(result,{source:'openstreetmap',attempts});
          return;
        }
        attempts.push(result?.hasRoadMatch?'osm-road-without-limit':'osm-no-road-match');
      }catch(error){
        attempts.push('osm-error');
        console.warn('SpeedMax OSM:',error);
      }

      if(!validUntil||Date.now()>=validUntil)publish(null,{staleReason:'no-limit',attempts});
    }finally{
      inFlight=false;
    }
  }

  function reset(){
    lastOsmQueryAt=0;
    lastOsmQueryPoint=null;
    lastGpsPoint=null;
    lastHeading=null;
    lastHeadingAt=0;
    previousWayId=null;
    osmElements=[];
    osmElementsAt=0;
    validUntil=0;
    lastSource='';
    publish(null,{staleReason:'route-change',attempts:['reset']});
  }

  gps.subscribe(onPosition,()=>{});
  window.addEventListener('online',()=>{
    lastOsmQueryAt=0;
    const current=gps.current?.();
    if(current)onPosition(current);
  });
  document.addEventListener('route-direction-change',reset);
})();

