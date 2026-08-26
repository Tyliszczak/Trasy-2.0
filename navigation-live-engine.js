import{
  distanceMeters,
  cumulativeDistances,
  nearestRouteIndex,
  legRemainingSeconds,
  interpolateLngLat,
  cameraProfileForSpeed
}from'./navigation-live-core.js';

const body=document.getElementById('scheduleBody');
const TOLERANCE_SECONDS=30;
const MAX_ROUTE_SNAP_M=120;

let routeModel=null;
let lastSnapIndex=0;
let liveEtaSeconds=null;
let liveEtaMeasuredAt=0;
let liveEtaLeg=-1;
let lastGps=null;
let lastGpsAt=0;
let currentSpeedMps=0;
let cameraSpeedKmh=0;
let cameraSpeedReady=false;

function coord(value){
  const match=String(value||'').match(/(-?\d+(?:\.\d+)?)\s*[,; ]\s*(-?\d+(?:\.\d+)?)/);
  return match?[Number(match[1]),Number(match[2])]:null;
}

function parseRouteWaypoints(url){
  try{
    const match=String(url).match(/\/route\/v1\/driving\/([^?]+)/);
    if(!match)return[];
    return decodeURIComponent(match[1]).split(';').map(value=>{
      const [lng,lat]=value.split(',').map(Number);
      return Number.isFinite(lat)&&Number.isFinite(lng)?[lat,lng]:null;
    }).filter(Boolean);
  }catch{return[]}
}

function captureRoute(url,data){
  const route=data?.routes?.[0];
  const geometry=route?.geometry?.coordinates;
  const waypoints=parseRouteWaypoints(url);
  if(!Array.isArray(geometry)||geometry.length<2||waypoints.length<2||!Array.isArray(route?.legs)||!route.legs.length)return;

  const built=cumulativeDistances(geometry);
  let from=0;
  const endIndices=waypoints.slice(1).map(waypoint=>{
    const hit=nearestRouteIndex(built.points,waypoint,{start:from});
    from=Math.max(from,hit.index);
    return hit.index;
  });

  routeModel={
    points:built.points,
    cumulative:built.cumulative,
    waypoints,
    endIndices,
    legs:route.legs.map(leg=>({
      duration:Number(leg?.duration)||0,
      distance:Number(leg?.distance)||0
    }))
  };
  lastSnapIndex=0;
  liveEtaSeconds=null;
  liveEtaMeasuredAt=0;
  liveEtaLeg=-1;
}

window.__trasyCaptureRoute=captureRoute;

function activeRow(){
  if(!body)return null;
  const rows=[...body.querySelectorAll('tr')].filter(row=>row.dataset.coordinate);
  const index=Number(body.dataset.gpsNextStop);
  if(Number.isInteger(index)&&index>=0&&index<rows.length)return rows[index];
  return rows.find(row=>row.classList.contains('gpsNextStop'))||rows[0]||null;
}

function activeLegIndex(){
  if(!routeModel)return-1;
  const target=coord(activeRow()?.dataset.coordinate);
  if(!target)return-1;
  let best=-1;
  let bestDistance=Infinity;
  routeModel.waypoints.slice(1).forEach((waypoint,index)=>{
    const distance=distanceMeters(target,waypoint);
    if(distance<bestDistance){
      bestDistance=distance;
      best=index;
    }
  });
  return bestDistance<=180?best:-1;
}

function updateSpeed(position,here,now){
  const nativeSpeed=Number(position?.coords?.speed);
  if(Number.isFinite(nativeSpeed)&&nativeSpeed>=0){
    currentSpeedMps=nativeSpeed;
  }else if(lastGps&&lastGpsAt){
    const elapsed=Math.max(.2,(now-lastGpsAt)/1000);
    currentSpeedMps=distanceMeters(lastGps,here)/elapsed;
  }
  lastGps=here;
  lastGpsAt=now;
}

function smoothedCameraSpeed(){
  const rawKmh=Math.max(0,Math.min(130,currentSpeedMps*3.6));
  const raw=rawKmh<4?0:rawKmh;
  if(!cameraSpeedReady){
    cameraSpeedKmh=raw;
    cameraSpeedReady=true;
  }else{
    const delta=raw-cameraSpeedKmh;
    if(Math.abs(delta)<.8){
      cameraSpeedKmh=raw;
    }else{
      cameraSpeedKmh+=delta*(delta>0?.26:.36);
    }
  }
  window.__routeCameraSpeedKmh=cameraSpeedKmh;
  return cameraSpeedKmh;
}

function currentCameraProfile(){
  const profile=cameraProfileForSpeed(smoothedCameraSpeed());
  window.__routeCameraProfile={...profile,speedKmh:cameraSpeedKmh};
  return profile;
}

function updateLiveEta(position){
  const nav=document.getElementById('routeMapNav');
  if(nav?.hidden!==false)return;

  const here=[Number(position?.coords?.latitude),Number(position?.coords?.longitude)];
  if(!Number.isFinite(here[0])||!Number.isFinite(here[1]))return;

  const now=performance.now();
  updateSpeed(position,here,now);
  if(!routeModel?.points?.length)return;

  const accuracy=Math.max(0,Number(position?.coords?.accuracy)||0);
  const hereDistance=routeModel.cumulative[lastSnapIndex]||0;
  let searchStart=lastSnapIndex;
  while(searchStart>0&&hereDistance-routeModel.cumulative[searchStart-1]<250)searchStart-=1;
  let searchEnd=lastSnapIndex;
  while(searchEnd<routeModel.points.length-1&&routeModel.cumulative[searchEnd+1]-hereDistance<1200)searchEnd+=1;
  const snap=nearestRouteIndex(routeModel.points,here,{start:searchStart,end:searchEnd});
  if(snap.distance>Math.max(MAX_ROUTE_SNAP_M,accuracy*2))return;
  if(snap.index>=lastSnapIndex-20)lastSnapIndex=Math.max(lastSnapIndex,snap.index);

  const legIndex=activeLegIndex();
  if(legIndex<0||legIndex>=routeModel.legs.length)return;
  const endIndex=routeModel.endIndices[legIndex];
  const leg=routeModel.legs[legIndex];
  if(!Number.isInteger(endIndex)||!leg)return;

  const calculated=legRemainingSeconds({
    cumulative:routeModel.cumulative,
    startIndex:lastSnapIndex,
    endIndex,
    legDistance:leg.distance,
    legDuration:leg.duration
  });
  if(!Number.isFinite(calculated))return;

  if(liveEtaLeg!==legIndex||liveEtaSeconds===null||Math.abs(calculated-liveEtaSeconds)>180){
    liveEtaSeconds=calculated;
  }else{
    liveEtaSeconds=liveEtaSeconds*.35+calculated*.65;
  }
  liveEtaLeg=legIndex;
  liveEtaMeasuredAt=Date.now();
  window.__routeLiveEtaSeconds=liveEtaSeconds;
}

function liveEtaNow(){
  if(!Number.isFinite(liveEtaSeconds)||!liveEtaMeasuredAt)return null;
  const elapsed=Math.max(0,(Date.now()-liveEtaMeasuredAt)/1000);
  const moving=currentSpeedMps>=1.2;
  return Math.max(0,liveEtaSeconds-(moving?Math.min(elapsed,3):0));
}

function planText(row){
  const cell=row?.children?.[1];
  const source=String(cell?.dataset.routeRolePlan||cell?.dataset.finalStopPlan||cell?.textContent||'').trim();
  return source.match(/\b(\d{1,2}):(\d{2})\b/)?.[0]||'';
}

function nearestPlanDate(row,predicted){
  const match=planText(row).match(/^(\d{1,2}):(\d{2})$/);
  if(!match)return null;
  const base=new Date(predicted);
  base.setHours(Number(match[1]),Number(match[2]),0,0);
  const candidates=[-1,0,1].map(day=>new Date(base.getTime()+day*86400000));
  candidates.sort((a,b)=>Math.abs(a.getTime()-predicted.getTime())-Math.abs(b.getTime()-predicted.getTime()));
  return candidates[0]||null;
}

if(body){
  body.addEventListener('nav-eta-update',event=>{
    const seconds=liveEtaNow();
    if(!Number.isFinite(seconds)||!event.detail)return;
    event.detail.etaSeconds=seconds;
    const predicted=new Date(Date.now()+seconds*1000);
    const plan=nearestPlanDate(activeRow(),predicted);
    if(plan){
      const diff=(predicted.getTime()-plan.getTime())/1000;
      event.detail.diffSeconds=diff;
      event.detail.kind=diff>TOLERANCE_SECONDS?'late':diff<-TOLERANCE_SECONDS?'early':'onTime';
    }
  },true);

  body.addEventListener('gps-next-stop-change',()=>{
    liveEtaSeconds=null;
    liveEtaMeasuredAt=0;
    liveEtaLeg=-1;
  });
}

if(window.__trasyGps?.subscribe){
  window.__trasyGps.subscribe(updateLiveEta,()=>{});
}

function isVehicleMarker(marker){
  const element=marker?.getElement?.();
  return Boolean(element?.style?.clipPath?.includes('polygon')&&element?.style?.width==='36px');
}

function installMarkerSmoothing(){
  const proto=window.maplibregl?.Marker?.prototype;
  if(!proto||proto.__trasySmoothSetLngLat)return;
  const nativeSetLngLat=proto.setLngLat;
  const states=new WeakMap();

  proto.setLngLat=function(value){
    if(!isVehicleMarker(this)||!window.requestAnimationFrame)return nativeSetLngLat.call(this,value);
    const target=Array.isArray(value)?[Number(value[0]),Number(value[1])]:[Number(value?.lng),Number(value?.lat)];
    if(!Number.isFinite(target[0])||!Number.isFinite(target[1]))return nativeSetLngLat.call(this,value);

    const nav=document.getElementById('routeMapNav');
    let state=states.get(this);
    const current=this.getLngLat?.();
    if(!state||!current||nav?.hidden!==false){
      if(state?.raf)cancelAnimationFrame(state.raf);
      nativeSetLngLat.call(this,target);
      states.set(this,{raf:0,lastAt:performance.now()});
      return this;
    }

    if(state.raf)cancelAnimationFrame(state.raf);
    const from=[Number(current.lng),Number(current.lat)];
    const distance=distanceMeters([from[1],from[0]],[target[1],target[0]]);
    if(!Number.isFinite(distance)||distance>250){
      nativeSetLngLat.call(this,target);
      state.lastAt=performance.now();
      state.raf=0;
      return this;
    }

    const now=performance.now();
    const interval=state.lastAt?now-state.lastAt:900;
    const duration=Math.max(550,Math.min(1350,interval*1.12));
    state.lastAt=now;
    const start=now;
    const marker=this;
    const animate=time=>{
      const t=Math.min(1,(time-start)/duration);
      nativeSetLngLat.call(marker,interpolateLngLat(from,target,t));
      if(t<1&&document.getElementById('routeMapNav')?.hidden===false){
        state.raf=requestAnimationFrame(animate);
      }else{
        state.raf=0;
        nativeSetLngLat.call(marker,target);
      }
    };
    state.raf=requestAnimationFrame(animate);
    states.set(this,state);
    return this;
  };
  proto.__trasySmoothSetLngLat=true;
}

function installCameraSmoothing(){
  const controller=window.__routeCameraController;
  if(!controller||controller.__trasyLiveSmooth)return;
  controller.__trasyLiveSmooth=true;
  let lastAt=0;
  let lastTarget=null;

  controller.moveToTarget=function(target,duration){
    const camera=currentCameraProfile();
    this.map.easeTo({
      center:target.center,
      zoom:camera.zoom,
      bearing:this.smoothBearing(target),
      pitch:camera.pitch,
      offset:target.offset,
      duration,
      easing:t=>1-Math.pow(1-t,3),
      essential:true
    },{trasyCamera:true});
  };

  controller.follow=function(target){
    this.latestTarget={
      center:target.center.slice(),
      bearing:Number(target.bearing)||0,
      offset:Array.isArray(target.offset)?target.offset.slice():[0,0],
      instant:target.instant===true
    };
    if(this.state==='manual')return;
    this.state='following';
    window.__routeManualView=false;

    const now=performance.now();
    let center=this.latestTarget.center.slice();
    if(!this.latestTarget.instant&&lastTarget){
      const movement=distanceMeters([lastTarget[1],lastTarget[0]],[center[1],center[0]]);
      if(movement<1.5){
        center=lastTarget.slice();
      }else if(movement<8){
        center=[lastTarget[0]+(center[0]-lastTarget[0])*.72,lastTarget[1]+(center[1]-lastTarget[1])*.72];
      }
    }
    const interval=lastAt?now-lastAt:900;
    lastAt=now;
    lastTarget=center.slice();
    const duration=this.latestTarget.instant?0:Math.max(600,Math.min(1400,interval*1.18));
    const bearing=this.smoothBearing({...this.latestTarget,center});
    const camera=currentCameraProfile();

    this.map.easeTo({
      center,
      zoom:camera.zoom,
      bearing,
      pitch:camera.pitch,
      offset:this.latestTarget.offset,
      duration,
      easing:t=>t,
      essential:true
    },{trasyCamera:true});
  };
}

installMarkerSmoothing();
document.addEventListener('trasy:route-map-ready',()=>{
  installMarkerSmoothing();
  installCameraSmoothing();
});
