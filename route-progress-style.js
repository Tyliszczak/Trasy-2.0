import { advanceRouteProgress, projectRoutePosition, splitRemainingRouteAtPosition } from './route-progress-core.js?v=4';

(()=>{
  const body=document.getElementById('scheduleBody');
  const gps=window.__trasyGps;
  if(!body||!gps)return;

  const ACTIVE_SOURCE='route';
  const ACTIVE_OUTLINE='route-outline';
  const ACTIVE_LINE='route-line';
  const FUTURE_SOURCE='route-future';
  const FUTURE_OUTLINE='route-future-outline';
  const FUTURE_LINE='route-future-line';
  const ERASE_MIN_MS=550;
  const ERASE_MAX_MS=1400;
  const ERASE_INTERVAL_FACTOR=1.15;

  let map=null;
  let fullCoords=[];
  let progressIndex=0;
  let displayRoutePosition=0;
  let targetRoutePosition=0;
  let animationFromPosition=0;
  let animationStartedAt=0;
  let eraseAnimationMs=900;
  let latestPosition=gps.current?.()||null;
  let lastGpsAt=0;
  let renderQueued=false;

  function cloneCoords(coords){
    return(Array.isArray(coords)?coords:[])
      .map(point=>[Number(point?.[0]),Number(point?.[1])])
      .filter(point=>Number.isFinite(point[0])&&Number.isFinite(point[1]));
  }

  function coordsFromGeoJson(data){
    if(data?.type==='Feature'&&data?.geometry?.type==='LineString')return cloneCoords(data.geometry.coordinates);
    return[];
  }

  function routeGeoJson(coords){return{type:'Feature',properties:{},geometry:{type:'LineString',coordinates:cloneCoords(coords)}}}
  const emptyRoute=()=>routeGeoJson([]);

  function parseCoord(value){
    const match=String(value||'').match(/(-?\d+(?:\.\d+)?)\s*[,; ]\s*(-?\d+(?:\.\d+)?)/);
    if(!match)return null;
    const lat=Number(match[1]),lng=Number(match[2]);
    return Number.isFinite(lat)&&Number.isFinite(lng)?[lng,lat]:null;
  }

  function nextStopPoint(){
    const rows=[...body.querySelectorAll('tr')].filter(row=>parseCoord(row.dataset.coordinate));
    if(!rows.length)return null;
    let index=Number(body.dataset.gpsNextStop);
    if(!Number.isInteger(index)||index<0||index>=rows.length){
      const active=rows.findIndex(row=>row.classList.contains('gpsNextStop'));
      index=active>=0?active:0;
    }
    return parseCoord(rows[index]?.dataset.coordinate);
  }

  function latestLngLat(){
    const lat=Number(latestPosition?.coords?.latitude),lng=Number(latestPosition?.coords?.longitude);
    return Number.isFinite(lat)&&Number.isFinite(lng)?[lng,lat]:null;
  }

  function firstSymbolLayer(){return map?.getStyle?.()?.layers?.find(layer=>layer.type==='symbol')?.id}

  function addLayer(spec,beforeId){
    if(!map||map.getLayer?.(spec.id))return;
    if(beforeId)map.addLayer(spec,beforeId);else map.addLayer(spec);
  }

  function ensureLayers(){
    if(!map?.isStyleLoaded?.())return false;
    try{
      const beforeId=firstSymbolLayer();
      if(!map.getSource(FUTURE_SOURCE))map.addSource(FUTURE_SOURCE,{type:'geojson',data:emptyRoute()});
      if(!map.getSource(ACTIVE_SOURCE))map.addSource(ACTIVE_SOURCE,{type:'geojson',data:emptyRoute()});

      addLayer({id:FUTURE_OUTLINE,type:'line',source:FUTURE_SOURCE,layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'#4b5442','line-width':9,'line-opacity':.28}},beforeId);
      addLayer({id:FUTURE_LINE,type:'line',source:FUTURE_SOURCE,layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'#b8c99f','line-width':6,'line-opacity':.5}},beforeId);
      addLayer({id:ACTIVE_OUTLINE,type:'line',source:ACTIVE_SOURCE,layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'#203000','line-width':11,'line-opacity':.82}},beforeId);
      addLayer({id:ACTIVE_LINE,type:'line',source:ACTIVE_SOURCE,layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'#86c900','line-width':7,'line-opacity':1}},beforeId);
      keepBelowLabels();
      return true;
    }catch(error){
      console.warn('Warstwy trasy:',error);
      return false;
    }
  }

  function keepBelowLabels(){
    if(!map)return;
    const beforeId=firstSymbolLayer();
    if(!beforeId)return;
    for(const id of[FUTURE_OUTLINE,FUTURE_LINE,ACTIVE_OUTLINE,ACTIVE_LINE]){
      try{if(map.getLayer?.(id))map.moveLayer(id,beforeId)}catch{}
    }
  }

  function setSource(id,data){
    try{map?.getSource?.(id)?.setData(data)}catch(error){console.warn(`Źródło ${id}:`,error)}
  }

  function snapVisualPosition(point,index,accuracy){
    if(!point||fullCoords.length<2)return null;
    const projected=projectRoutePosition(fullCoords,point,Math.max(0,index-1),4,160);
    const tolerance=Math.max(70,Math.max(0,Number(accuracy)||0)*2.2);
    return Number.isFinite(projected.distance)&&projected.distance<=tolerance?projected:null;
  }

  function resetProgress(){
    progressIndex=0;
    displayRoutePosition=0;
    targetRoutePosition=0;
    animationFromPosition=0;
    animationStartedAt=0;
    eraseAnimationMs=900;
    lastGpsAt=0;
  }

  function capture(data){
    const coords=coordsFromGeoJson(data);
    fullCoords=coords;
    resetProgress();
    if(coords.length<2)return false;

    const point=latestLngLat();
    if(point){
      const progress=advanceRouteProgress(fullCoords,point,0,latestPosition?.coords?.accuracy);
      progressIndex=progress.index;
      const projected=snapVisualPosition(point,progressIndex,latestPosition?.coords?.accuracy);
      const initial=projected?.position??progressIndex;
      displayRoutePosition=initial;
      targetRoutePosition=initial;
      animationFromPosition=initial;
    }
    return true;
  }

  function updateEraseDuration(now=performance.now()){
    const interval=lastGpsAt?now-lastGpsAt:900;
    lastGpsAt=now;
    eraseAnimationMs=Math.max(ERASE_MIN_MS,Math.min(ERASE_MAX_MS,interval*ERASE_INTERVAL_FACTOR));
  }

  function startEraseAnimation(nextPosition){
    const next=Number(nextPosition);
    if(!Number.isFinite(next)||next<=targetRoutePosition+1e-5)return;
    animationFromPosition=displayRoutePosition;
    targetRoutePosition=next;
    animationStartedAt=performance.now();
  }

  function advanceEraseAnimation(now=performance.now()){
    if(targetRoutePosition<=displayRoutePosition+1e-6){displayRoutePosition=targetRoutePosition;return false}
    if(!animationStartedAt){displayRoutePosition=targetRoutePosition;return false}
    const linear=Math.max(0,Math.min(1,(now-animationStartedAt)/eraseAnimationMs));
    displayRoutePosition=animationFromPosition+(targetRoutePosition-animationFromPosition)*linear;
    if(linear>=1){displayRoutePosition=targetRoutePosition;animationStartedAt=0;return false}
    return true;
  }

  function render(){
    renderQueued=false;
    if(!map||fullCoords.length<2)return;
    if(!ensureLayers()){setTimeout(queueRender,80);return}

    const animationContinues=advanceEraseAnimation();
    const point=latestLngLat();
    if(point){
      const progress=advanceRouteProgress(fullCoords,point,progressIndex,latestPosition?.coords?.accuracy);
      progressIndex=progress.index;
      const projected=snapVisualPosition(point,progressIndex,latestPosition?.coords?.accuracy);
      if(projected)startEraseAnimation(Math.max(targetRoutePosition,projected.position));
    }

    const split=splitRemainingRouteAtPosition(fullCoords,displayRoutePosition,nextStopPoint());
    setSource(ACTIVE_SOURCE,routeGeoJson(split.active));
    setSource(FUTURE_SOURCE,routeGeoJson(split.future));
    keepBelowLabels();

    window.__routeProgressState={
      fullPoints:fullCoords.length,
      progressIndex,
      displayRoutePosition,
      targetRoutePosition,
      eraseAnimationMs,
      nextStopIndex:split.stopIndex,
      activePoints:split.active.length,
      futurePoints:split.future.length
    };
    document.dispatchEvent(new CustomEvent('trasy:route-progress-rendered',{detail:window.__routeProgressState}));
    if(animationContinues||targetRoutePosition>displayRoutePosition+1e-6)queueRender();
  }

  function queueRender(){if(renderQueued)return;renderQueued=true;requestAnimationFrame(render)}

  function setRoute(data){
    if(!capture(data)){
      clear();
      return false;
    }
    ensureLayers();
    queueRender();
    return true;
  }

  function clear(){
    fullCoords=[];
    resetProgress();
    if(map&&ensureLayers()){
      setSource(ACTIVE_SOURCE,emptyRoute());
      setSource(FUTURE_SOURCE,emptyRoute());
    }
    window.__routeProgressState={fullPoints:0,progressIndex:0,displayRoutePosition:0,targetRoutePosition:0,activePoints:0,futurePoints:0};
  }

  function install(nextMap){
    if(!nextMap||nextMap===map)return;
    map=nextMap;
    map.on('style.load',()=>{
      ensureLayers();
      queueRender();
    });
    ensureLayers();
    queueRender();
  }

  gps.subscribe(position=>{
    latestPosition=position;
    const panel=document.getElementById('routeMapNav');
    if(!panel||panel.hidden)return;
    updateEraseDuration();
    queueRender();
  },()=>{});

  body.addEventListener('gps-next-stop-change',queueRender);
  body.addEventListener('route-direction-change',()=>{resetProgress();queueRender()});
  body.addEventListener('route-mode-change',()=>{resetProgress();queueRender()});
  document.addEventListener('trasy:route-map-ready',event=>install(event.detail?.map||window.__routeMap));

  window.__trasyRouteRenderer={setRoute,clear,state:()=>({...window.__routeProgressState}),install};
  if(window.__routeMap)install(window.__routeMap);
})();