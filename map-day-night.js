import './ptv-basemap.js?v=4';
import { isNightAt } from './map-theme-core.js?v=1';

(()=>{
  const DAY_STYLE='https://vectormaps-resources.myptv.com/styles/latest/standard.json';
  const DARK_STYLE='https://tiles.openfreemap.org/styles/dark';
  const CHECK_MS=60000;
  const gps=window.__trasyGps;

  let map=null;
  let dayStyle=null;
  let currentTheme='day';
  let switching=false;
  let lastPoint=null;
  let timer=0;
  let routeReady=false;

  function clone(value){
    if(value===undefined||value===null)return value;
    try{return structuredClone(value)}catch{}
    try{return JSON.parse(JSON.stringify(value))}catch{return null}
  }

  function pointFromPosition(position){
    const lat=Number(position?.coords?.latitude),lon=Number(position?.coords?.longitude);
    return Number.isFinite(lat)&&Number.isFinite(lon)?{lat,lon}:null;
  }

  function pointFromMap(){
    if(!map)return null;
    const center=map.getCenter?.();
    const lat=Number(center?.lat),lon=Number(center?.lng);
    return Number.isFinite(lat)&&Number.isFinite(lon)?{lat,lon}:null;
  }

  function hasRoute(){
    try{return Boolean(map?.getSource?.('route'))}catch{return false}
  }

  function ensureRouteReady(){
    if(routeReady)return true;
    routeReady=hasRoute();
    return routeReady;
  }

  function markStyleSwitching(value,reason='theme'){
    window.__trasyMapStyleSwitching=value===true;
    document.dispatchEvent(new CustomEvent(value?'trasy:map-style-switch-start':'trasy:map-style-switch-end',{detail:{source:'map-day-night',reason}}));
  }

  function snapshotRoute(){
    if(!map)return null;
    const source=map.getSource?.('route');
    if(!source)return null;
    let data=null;
    try{data=source.serialize?.().data}catch{}
    if(!data&&source._data)data=source._data;
    return clone(data);
  }

  function addRouteLayer(id,paint,beforeId){
    if(map.getLayer?.(id))return;
    const spec={
      id,
      type:'line',
      source:'route',
      layout:{'line-cap':'round','line-join':'round'},
      paint
    };
    if(beforeId)map.addLayer(spec,beforeId);else map.addLayer(spec);
  }

  function restoreRoute(data){
    if(!data||!map)return;
    try{
      if(map.getSource?.('route')){
        map.getSource('route').setData(data);
      }else{
        map.addSource('route',{type:'geojson',data});
      }
      const beforeId=map.getStyle?.()?.layers?.find(layer=>layer.type==='symbol')?.id||(map.getLayer?.('etoll-lubuskie-line')?'etoll-lubuskie-line':undefined);
      addRouteLayer('route-outline',{
        'line-color':'#202020',
        'line-width':11,
        'line-opacity':.7
      },beforeId);
      addRouteLayer('route-line',{
        'line-color':'#ccff33',
        'line-width':7,
        'line-opacity':.95
      },beforeId);
    }catch(error){
      console.warn('Odtworzenie trasy po zmianie motywu mapy:',error);
    }
  }

  function setThemeMarker(theme){
    currentTheme=theme;
    const container=map?.getContainer?.();
    if(container)container.dataset.mapTheme=theme;
    document.documentElement.dataset.mapTheme=theme;
    document.dispatchEvent(new CustomEvent('trasy:map-theme-change',{detail:{theme}}));
  }

  function switchTheme(theme){
    if(!map||switching||theme===currentTheme||!ensureRouteReady())return;
    if(window.__trasyMapStyleSwitching){
      setTimeout(()=>evaluate(),250);
      return;
    }
    const route=snapshotRoute();
    const target=theme==='night'?DARK_STYLE:(clone(dayStyle)||DAY_STYLE);
    if(!target)return;

    switching=true;
    markStyleSwitching(true,theme);
    let settled=false;
    const finish=()=>{
      switching=false;
      markStyleSwitching(false,theme);
    };
    const timeout=setTimeout(()=>{
      if(settled)return;
      settled=true;
      finish();
      console.warn('Zmiana motywu mapy trwała zbyt długo.');
      window.__trasyBasemapProvider?.applyFallback?.('theme-style-timeout');
    },12000);

    map.once('style.load',()=>{
      if(settled)return;
      settled=true;
      clearTimeout(timeout);
      restoreRoute(route);
      setThemeMarker(theme);
      if(theme==='day'){
        dayStyle=clone(map.getStyle?.())||dayStyle;
        const container=map.getContainer?.();
        if(container)container.dataset.mapProvider='ptv';
        document.documentElement.dataset.mapProvider='ptv';
      }
      finish();
    });

    try{
      map.setStyle(target,{diff:false});
    }catch(error){
      settled=true;
      clearTimeout(timeout);
      finish();
      console.warn('Zmiana motywu mapy:',error);
      window.__trasyBasemapProvider?.applyFallback?.('theme-style-error');
    }
  }

  function evaluate(point=lastPoint||pointFromMap()){
    if(!map||!point)return;
    lastPoint=point;
    const theme=isNightAt(new Date(),point.lat,point.lon)?'night':'day';
    if(theme!==currentTheme)switchTheme(theme);
  }

  function install(nextMap){
    if(!nextMap||nextMap===map)return;
    map=nextMap;
    routeReady=hasRoute();
    lastPoint=pointFromPosition(gps?.current?.())||pointFromMap();

    const markedTheme=map.getContainer?.()?.dataset?.mapTheme||document.documentElement.dataset.mapTheme;
    currentTheme=markedTheme==='night'?'night':'day';
    if(currentTheme==='day')dayStyle=clone(map.getStyle?.());
    setThemeMarker(currentTheme);
    evaluate(lastPoint);

    clearInterval(timer);
    timer=setInterval(()=>evaluate(),CHECK_MS);

    if(gps?.subscribe){
      gps.subscribe(position=>{
        const point=pointFromPosition(position);
        if(point){
          lastPoint=point;
          evaluate(point);
        }
      },()=>{});
    }
  }

  function initialTheme(){
    const point=pointFromPosition(gps?.current?.());
    if(point)return isNightAt(new Date(),point.lat,point.lon)?'night':'day';
    return document.documentElement.dataset.mapTheme==='night'?'night':'day';
  }

  window.__trasyResolveMapTheme=({latitude,longitude}={})=>{
    if(Number.isFinite(Number(latitude))&&Number.isFinite(Number(longitude))){
      return isNightAt(new Date(),Number(latitude),Number(longitude))?'night':'day';
    }
    return initialTheme();
  };

  document.documentElement.dataset.mapTheme=initialTheme();

  document.addEventListener('trasy:route-progress-rendered',()=>{
    if(routeReady)return;
    routeReady=true;
    evaluate();
  });
  document.addEventListener('trasy:route-map-ready',event=>install(event.detail?.map||window.__routeMap));
  document.addEventListener('visibilitychange',()=>{
    if(document.visibilityState==='visible')evaluate();
  });
  window.addEventListener('pageshow',()=>evaluate());
  if(window.__routeMap)install(window.__routeMap);
})();
