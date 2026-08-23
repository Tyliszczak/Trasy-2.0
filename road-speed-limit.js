import { nearestRoadLimit } from './road-speed-limit-core.js';

(()=>{
  const gps=window.__trasyGps;
  if(!gps?.subscribe)return;

  const ENDPOINT='https://overpass-api.de/api/interpreter';
  const QUERY_RADIUS_M=55;
  const MIN_QUERY_MS=12000;
  const MIN_MOVE_M=35;
  const MAX_GPS_ACCURACY_M=55;
  const REQUEST_TIMEOUT_MS=6500;
  const DRIVABLE='motorway|motorway_link|trunk|trunk_link|primary|primary_link|secondary|secondary_link|tertiary|tertiary_link|unclassified|residential|living_street|service|road';

  let lastQueryAt=0;
  let lastQueryPoint=null;
  let inFlight=false;
  let lastHeading=null;

  function haversine(a,b){
    const R=6371000,p=Math.PI/180;
    const dLat=(b.lat-a.lat)*p;
    const dLon=(b.lon-a.lon)*p;
    const h=Math.sin(dLat/2)**2+Math.cos(a.lat*p)*Math.cos(b.lat*p)*Math.sin(dLon/2)**2;
    return 2*R*Math.asin(Math.sqrt(h));
  }

  function active(){
    const map=document.getElementById('routeMapNav');
    const schedule=document.getElementById('scheduleView');
    return map?.hidden===false||schedule?.hidden===false;
  }

  function emit(detail){
    const value=Number(detail?.maxspeed);
    window.__routeRoadSpeedLimitKmh=Number.isFinite(value)&&value>0?value:null;
    window.__routeRoadClass=detail?.roadClass||'';
    window.__routeHighSpeedRoad=!!detail?.highSpeedRoad;
    document.dispatchEvent(new CustomEvent('trasy:road-speed-limit',{detail:{
      maxspeed:window.__routeRoadSpeedLimitKmh,
      roadClass:window.__routeRoadClass,
      highSpeedRoad:window.__routeHighSpeedRoad,
      source:'openstreetmap',
      osmWayId:detail?.osmWayId??null,
      roadName:detail?.name||''
    }}));
  }

  function queryText(lat,lon){
    return `[out:json][timeout:5];way(around:${QUERY_RADIUS_M},${lat.toFixed(6)},${lon.toFixed(6)})[highway~"^(${DRIVABLE})$"];out tags geom;`;
  }

  async function lookup(point,heading){
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),REQUEST_TIMEOUT_MS);
    try{
      const body=new URLSearchParams({data:queryText(point.lat,point.lon)});
      const response=await fetch(ENDPOINT,{
        method:'POST',
        headers:{'Content-Type':'application/x-www-form-urlencoded;charset=UTF-8'},
        body,
        cache:'no-store',
        signal:controller.signal
      });
      if(!response.ok)throw Error(`Overpass HTTP ${response.status}`);
      const data=await response.json();
      return nearestRoadLimit(data?.elements||[],point,{maxDistance:MAX_GPS_ACCURACY_M,heading});
    }finally{
      clearTimeout(timeout);
    }
  }

  async function onPosition(position){
    if(!active()||inFlight)return;
    const coords=position?.coords;
    const lat=Number(coords?.latitude),lon=Number(coords?.longitude),accuracy=Number(coords?.accuracy);
    if(!Number.isFinite(lat)||!Number.isFinite(lon)||!Number.isFinite(accuracy)||accuracy>MAX_GPS_ACCURACY_M)return;

    const heading=Number(coords?.heading);
    if(Number.isFinite(heading)&&heading>=0)lastHeading=heading;

    const point={lat,lon};
    const moved=lastQueryPoint?haversine(lastQueryPoint,point):Infinity;
    const elapsed=Date.now()-lastQueryAt;
    if(lastQueryPoint&&elapsed<MIN_QUERY_MS)return;
    if(lastQueryPoint&&moved<MIN_MOVE_M&&elapsed<30000)return;

    inFlight=true;
    lastQueryAt=Date.now();
    lastQueryPoint=point;
    try{
      const result=await lookup(point,lastHeading);
      emit(result||{});
    }catch(error){
      console.warn('Limit prędkości OSM:',error);
    }finally{
      inFlight=false;
    }
  }

  gps.subscribe(onPosition,()=>{});
  document.addEventListener('route-direction-change',()=>{
    lastQueryAt=0;
    lastQueryPoint=null;
  });
})();
