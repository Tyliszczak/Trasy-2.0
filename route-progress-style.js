import { advanceRouteProgress, createLaggedProgress, splitRemainingRoute } from './route-progress-core.js?v=2';

(()=>{
  const body=document.getElementById('scheduleBody');
  const gps=window.__trasyGps;
  if(!body||!gps)return;

  const FUTURE_SOURCE='route-future';
  const FUTURE_OUTLINE='route-future-outline';
  const FUTURE_LINE='route-future-line';
  const DISPLAY_LAG_FIXES=3;

  let map=null;
  let fullCoords=[];
  let progressIndex=0;
  let displayProgressIndex=0;
  let latestPosition=null;
  let hasNewGpsFix=false;
  let renderQueued=false;
  let internalWrite=false;
  const displayProgress=createLaggedProgress(DISPLAY_LAG_FIXES,0);

  function cloneCoords(coords){
    return (Array.isArray(coords)?coords:[])
      .map(point=>[Number(point?.[0]),Number(point?.[1])])
      .filter(point=>Number.isFinite(point[0])&&Number.isFinite(point[1]));
  }

  function coordsFromGeoJson(data){
    if(data?.type==='Feature'&&data?.geometry?.type==='LineString')return cloneCoords(data.geometry.coordinates);
    return [];
  }

  function routeGeoJson(coords){
    return {
      type:'Feature',
      properties:{},
      geometry:{type:'LineString',coordinates:cloneCoords(coords)}
    };
  }

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

  function rawSetData(source,data){
    if(!source)return;
    const raw=source.__trasyProgressRawSetData;
    internalWrite=true;
    try{
      if(typeof raw==='function')raw(data);
      else source.setData(data);
    }finally{
      internalWrite=false;
    }
  }

  function captureFullRoute(data){
    const coords=coordsFromGeoJson(data);
    if(coords.length<2)return false;
    fullCoords=coords;
    progressIndex=0;
    const point=latestLngLat();
    if(point){
      const progress=advanceRouteProgress(fullCoords,point,0,latestPosition?.coords?.accuracy);
      progressIndex=progress.index;
    }
    displayProgressIndex=displayProgress.reset(progressIndex);
    hasNewGpsFix=false;
    window.__routeProgressState={fullPoints:fullCoords.length,progressIndex,displayProgressIndex,nextStopIndex:null};
    return true;
  }

  function wrapRouteSource(source){
    if(!source||source.__trasyProgressWrapped)return;
    const raw=source.setData.bind(source);
    source.__trasyProgressWrapped=true;
    source.__trasyProgressRawSetData=raw;
    source.setData=function(data){
      if(internalWrite)return raw(data);
      captureFullRoute(data);
      const result=raw(data);
      queueRender();
      return result;
    };
  }

  function patchAddSource(){
    if(!map||map.__trasyProgressAddSourcePatched)return;
    map.__trasyProgressAddSourcePatched=true;
    const rawAddSource=map.addSource.bind(map);
    map.addSource=function(id,spec){
      if(id==='route'&&!fullCoords.length)captureFullRoute(spec?.data);
      const result=rawAddSource(id,spec);
      if(id==='route')wrapRouteSource(map.getSource('route'));
      return result;
    };
  }

  function paintActiveRoute(){
    try{
      if(map.getLayer('route-outline')){
        map.setPaintProperty('route-outline','line-color','#203000');
        map.setPaintProperty('route-outline','line-width',11);
        map.setPaintProperty('route-outline','line-opacity',.82);
      }
      if(map.getLayer('route-line')){
        map.setPaintProperty('route-line','line-color','#86c900');
        map.setPaintProperty('route-line','line-width',7);
        map.setPaintProperty('route-line','line-opacity',1);
      }
    }catch(error){console.warn('Kolor aktywnego odcinka trasy:',error)}
  }

  function ensureFutureLayers(){
    if(!map||!map.getLayer('route-outline')||!map.getLayer('route-line'))return false;
    try{
      if(!map.getSource(FUTURE_SOURCE)){
        map.addSource(FUTURE_SOURCE,{type:'geojson',data:routeGeoJson([])});
      }
      const before='route-outline';
      if(!map.getLayer(FUTURE_OUTLINE)){
        map.addLayer({
          id:FUTURE_OUTLINE,
          type:'line',
          source:FUTURE_SOURCE,
          layout:{'line-cap':'round','line-join':'round'},
          paint:{'line-color':'#4b5442','line-width':9,'line-opacity':.28}
        },before);
      }
      if(!map.getLayer(FUTURE_LINE)){
        map.addLayer({
          id:FUTURE_LINE,
          type:'line',
          source:FUTURE_SOURCE,
          layout:{'line-cap':'round','line-join':'round'},
          paint:{'line-color':'#b8c99f','line-width':6,'line-opacity':.5}
        },before);
      }
      return true;
    }catch(error){
      console.warn('Dalszy odcinek trasy:',error);
      return false;
    }
  }

  function render(){
    renderQueued=false;
    if(!map||fullCoords.length<2)return;
    const routeSource=map.getSource?.('route');
    if(!routeSource)return;
    wrapRouteSource(routeSource);

    const point=latestLngLat();
    if(point){
      const progress=advanceRouteProgress(fullCoords,point,progressIndex,latestPosition?.coords?.accuracy);
      progressIndex=progress.index;
      if(hasNewGpsFix){
        displayProgressIndex=displayProgress.push(progressIndex);
        hasNewGpsFix=false;
      }
    }

    paintActiveRoute();
    if(!ensureFutureLayers()){
      setTimeout(queueRender,80);
      return;
    }

    const split=splitRemainingRoute(fullCoords,displayProgressIndex,nextStopPoint());
    rawSetData(routeSource,routeGeoJson(split.active));
    rawSetData(map.getSource(FUTURE_SOURCE),routeGeoJson(split.future));

    window.__routeProgressState={
      fullPoints:fullCoords.length,
      progressIndex,
      displayProgressIndex,
      displayLagFixes:DISPLAY_LAG_FIXES,
      nextStopIndex:split.stopIndex,
      activePoints:split.active.length,
      futurePoints:split.future.length
    };
    document.dispatchEvent(new CustomEvent('trasy:route-progress-rendered',{detail:window.__routeProgressState}));
  }

  function queueRender(){
    if(renderQueued)return;
    renderQueued=true;
    requestAnimationFrame(render);
  }

  function resetProgress(){
    progressIndex=0;
    displayProgressIndex=displayProgress.reset(0);
    hasNewGpsFix=false;
    queueRender();
  }

  function install(nextMap){
    if(!nextMap||nextMap===map)return;
    map=nextMap;
    fullCoords=[];
    progressIndex=0;
    displayProgressIndex=displayProgress.reset(0);
    hasNewGpsFix=false;
    patchAddSource();

    const existing=map.getSource?.('route');
    if(existing){
      wrapRouteSource(existing);
      let data=null;
      try{data=existing.serialize?.().data}catch{}
      if(!data&&existing._data)data=existing._data;
      captureFullRoute(data);
    }

    map.on('style.load',()=>setTimeout(queueRender,0));
    queueRender();
  }

  gps.subscribe(position=>{
    latestPosition=position;
    hasNewGpsFix=true;
    const panel=document.getElementById('routeMapNav');
    if(!panel||panel.hidden)return;
    queueRender();
  },()=>{});

  body.addEventListener('gps-next-stop-change',queueRender);
  body.addEventListener('route-direction-change',resetProgress);
  body.addEventListener('route-mode-change',resetProgress);
  document.addEventListener('trasy:map-theme-change',()=>setTimeout(queueRender,0));
  document.addEventListener('trasy:route-map-ready',event=>install(event.detail?.map||window.__routeMap));
  if(window.__routeMap)install(window.__routeMap);
})();
