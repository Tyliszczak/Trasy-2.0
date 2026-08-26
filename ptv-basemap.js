import { isNightAt } from './map-theme-core.js?v=1';

(()=>{
  const PTV_STYLE_URL='https://vectormaps-resources.myptv.com/styles/latest/standard.json';
  const PTV_API_ORIGIN='https://api.myptv.com';
  const PROXY_PREFIX='/ptv-map';
  const OSM_FALLBACK_STYLE={
    version:8,
    sources:{
      osm:{
        type:'raster',
        tiles:['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
        tileSize:256,
        attribution:'© OpenStreetMap contributors'
      }
    },
    layers:[{id:'osm-fallback',type:'raster',source:'osm'}]
  };
  const HEALTH_TILE=`${PROXY_PREFIX}/maps/v1/vector-tiles/0/0/0`;
  const REQUEST_TIMEOUT_MS=6500;
  const PTV_RETRY_MS=300000;
  const ERROR_WINDOW_MS=12000;
  const ERROR_LIMIT=3;

  let map=null;
  let ptvStylePromise=null;
  let disabledUntil=0;
  let provider='initial';
  let switching=false;
  let generation=0;
  let errorTimes=[];
  let routeReady=false;
  let errorCheckPending=false;

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
    const center=map?.getCenter?.();
    const lat=Number(center?.lat),lon=Number(center?.lng);
    return Number.isFinite(lat)&&Number.isFinite(lon)?{lat,lon}:null;
  }

  function isNightNow(){
    const point=pointFromPosition(window.__trasyGps?.current?.())||pointFromMap();
    return point?isNightAt(new Date(),point.lat,point.lon):false;
  }

  function hasRoute(){
    try{return Boolean(map?.getSource?.('route'))}catch{return false}
  }

  function ensureRouteReady(){
    if(routeReady)return true;
    routeReady=hasRoute();
    return routeReady;
  }

  function markStyleSwitching(value,reason=''){
    window.__trasyMapStyleSwitching=value===true;
    document.dispatchEvent(new CustomEvent(value?'trasy:map-style-switch-start':'trasy:map-style-switch-end',{detail:{source:'ptv-basemap',reason}}));
  }

  async function fetchWithTimeout(url,init={}){
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),REQUEST_TIMEOUT_MS);
    try{
      return await fetch(url,{...init,signal:controller.signal});
    }finally{
      clearTimeout(timer);
    }
  }

  function proxiedPtvUrl(value){
    if(typeof value!=='string')return value;
    let url;
    try{url=new URL(value)}catch{return value}
    if(url.origin!==PTV_API_ORIGIN)return value;
    return `${location.origin}${PROXY_PREFIX}${url.pathname}${url.search}`;
  }

  function rewritePtvRequests(value){
    if(typeof value==='string')return proxiedPtvUrl(value);
    if(Array.isArray(value))return value.map(rewritePtvRequests);
    if(!value||typeof value!=='object')return value;
    const next={};
    for(const [key,item] of Object.entries(value))next[key]=rewritePtvRequests(item);
    return next;
  }

  function currentHealthTile(){
    const center=map?.getCenter?.();
    const lat=Number(center?.lat),lon=Number(center?.lng);
    if(!Number.isFinite(lat)||!Number.isFinite(lon))return HEALTH_TILE;
    const z=Math.max(0,Math.min(17,Math.floor(Number(map?.getZoom?.())||0)));
    const n=2**z;
    const x=Math.max(0,Math.min(n-1,Math.floor((lon+180)/360*n)));
    const rad=Math.max(-85.0511,Math.min(85.0511,lat))*Math.PI/180;
    const y=Math.max(0,Math.min(n-1,Math.floor((1-Math.asinh(Math.tan(rad))/Math.PI)/2*n)));
    return `${PROXY_PREFIX}/maps/v1/vector-tiles/${z}/${x}/${y}`;
  }

  async function probePtv(){
    if(Date.now()<disabledUntil)throw Error('PTV map temporarily disabled');
    const response=await fetchWithTimeout(currentHealthTile(),{cache:'no-store',credentials:'same-origin'});
    if(!response.ok)throw Error(`PTV map proxy ${response.status}`);
  }

  async function loadPtvStyle(){
    if(ptvStylePromise)return clone(await ptvStylePromise);
    ptvStylePromise=(async()=>{
      await probePtv();
      const response=await fetchWithTimeout(PTV_STYLE_URL,{cache:'force-cache',mode:'cors'});
      if(!response.ok)throw Error(`PTV style ${response.status}`);
      const style=await response.json();
      const rewritten=rewritePtvRequests(style);
      if(!rewritten?.sources||!Array.isArray(rewritten?.layers))throw Error('Invalid PTV style');
      return rewritten;
    })().catch(error=>{
      ptvStylePromise=null;
      throw error;
    });
    return clone(await ptvStylePromise);
  }

  function snapshotRoute(){
    const source=map?.getSource?.('route');
    if(!source)return null;
    let data=null;
    try{data=source.serialize?.().data}catch{}
    if(!data&&source._data)data=source._data;
    return clone(data);
  }

  function addRouteLayer(id,paint,beforeId){
    if(!map||map.getLayer?.(id))return;
    const spec={id,type:'line',source:'route',layout:{'line-cap':'round','line-join':'round'},paint};
    if(beforeId)map.addLayer(spec,beforeId);else map.addLayer(spec);
  }

  function restoreRoute(data){
    if(!data||!map)return;
    try{
      if(map.getSource?.('route'))map.getSource('route').setData(data);
      else map.addSource('route',{type:'geojson',data});
      const beforeId=map.getStyle?.()?.layers?.find(layer=>layer.type==='symbol')?.id||(map.getLayer?.('etoll-lubuskie-line')?'etoll-lubuskie-line':undefined);
      addRouteLayer('route-outline',{'line-color':'#202020','line-width':11,'line-opacity':.7},beforeId);
      addRouteLayer('route-line',{'line-color':'#ccff33','line-width':7,'line-opacity':.95},beforeId);
    }catch(error){
      console.warn('PTV: odtworzenie trasy po zmianie mapy:',error);
    }
  }

  function markProvider(next,reason=''){
    provider=next;
    const container=map?.getContainer?.();
    if(container)container.dataset.mapProvider=next;
    document.documentElement.dataset.mapProvider=next;
    window.__trasyBasemapState={provider:next,reason,disabledUntil};
    document.dispatchEvent(new CustomEvent('trasy:basemap-provider-change',{detail:window.__trasyBasemapState}));
  }

  function setStyle(target,nextProvider,reason=''){
    if(!map||switching)return;
    const route=snapshotRoute();
    const localGeneration=++generation;
    switching=true;
    markStyleSwitching(true,reason);
    let settled=false;
    const finish=()=>{
      switching=false;
      markStyleSwitching(false,reason);
    };
    const timeout=setTimeout(()=>{
      if(settled||localGeneration!==generation)return;
      settled=true;
      finish();
      if(nextProvider==='ptv'){
        disabledUntil=Date.now()+PTV_RETRY_MS;
        ptvStylePromise=null;
        applyFallback('ptv-style-timeout');
      }
    },12000);

    map.once('style.load',()=>{
      if(settled||localGeneration!==generation)return;
      settled=true;
      clearTimeout(timeout);
      restoreRoute(route);
      markProvider(nextProvider,reason);
      finish();
    });

    try{
      map.setStyle(target,{diff:false});
    }catch(error){
      settled=true;
      clearTimeout(timeout);
      finish();
      if(nextProvider==='ptv'){
        disabledUntil=Date.now()+PTV_RETRY_MS;
        ptvStylePromise=null;
        console.warn('PTV map:',error);
        applyFallback('ptv-style-error');
      }
    }
  }

  function applyFallback(reason){
    if(!map||provider==='osm')return;
    setStyle(clone(OSM_FALLBACK_STYLE),'osm',reason);
  }

  async function applyDay(force=false){
    if(!map||isNightNow()||!ensureRouteReady())return;
    if(!force&&provider==='ptv')return;
    if(provider==='ptv')return;
    try{
      const style=await loadPtvStyle();
      if(!map||isNightNow()||!ensureRouteReady())return;
      setStyle(style,'ptv','secure-proxy');
    }catch(error){
      console.warn('PTV niedostępne — awaryjnie OSM:',error);
      disabledUntil=Math.max(disabledUntil,Date.now()+PTV_RETRY_MS);
      applyFallback('ptv-unavailable');
    }
  }

  async function verifyPtvBeforeFallback(){
    if(errorCheckPending||provider!=='ptv')return;
    errorCheckPending=true;
    try{
      await probePtv();
      errorTimes=[];
    }catch(error){
      console.warn('PTV nie odpowiada dla aktualnego obszaru — awaryjnie OSM:',error);
      disabledUntil=Date.now()+PTV_RETRY_MS;
      ptvStylePromise=null;
      applyFallback('ptv-health-failed');
    }finally{
      errorCheckPending=false;
    }
  }

  function onMapError(event){
    if(provider==='osm'||provider==='initial')return;
    const message=String(event?.error?.message||event?.message||'').toLowerCase();
    const ptvError=provider==='ptv'&&(message.includes('ptv-map')||message.includes('myptv')||message.includes('vectormaps-resources'));
    const nightError=provider==='openfreemap-dark'&&(message.includes('openfreemap')||message.includes('tiles.openfreemap'));
    if(!ptvError&&!nightError)return;
    const now=Date.now();
    errorTimes=errorTimes.filter(time=>now-time<=ERROR_WINDOW_MS);
    errorTimes.push(now);
    if(errorTimes.length<ERROR_LIMIT)return;
    errorTimes=[];
    if(provider==='ptv'){
      verifyPtvBeforeFallback();
      return;
    }
    applyFallback('night-style-errors');
  }

  function activateAfterRoute(){
    if(routeReady)return;
    routeReady=true;
    if(!map||isNightNow()||provider==='ptv')return;
    if(provider==='osm'&&Date.now()<disabledUntil)return;
    applyDay(true);
  }

  function install(nextMap){
    if(!nextMap||nextMap===map)return;
    map=nextMap;
    map.on('error',onMapError);
    const markedProvider=map.getContainer?.()?.dataset?.mapProvider||document.documentElement.dataset.mapProvider;
    if(markedProvider)provider=markedProvider;
    routeReady=hasRoute();
    markProvider(provider||'initial','initial-style');
    if(routeReady&&!isNightNow()&&provider!=='ptv')setTimeout(()=>applyDay(true),0);
  }

  document.addEventListener('trasy:route-progress-rendered',activateAfterRoute);
  document.addEventListener('trasy:map-theme-change',event=>{
    if(event.detail?.theme==='night'){
      if(provider!=='osm')markProvider('openfreemap-dark','night-theme');
      return;
    }
    if(event.detail?.theme==='day'&&ensureRouteReady()&&provider!=='ptv')applyDay(true);
  });
  document.addEventListener('trasy:route-map-ready',event=>install(event.detail?.map||window.__routeMap));
  window.addEventListener('online',()=>{
    if(routeReady&&provider!=='ptv'&&!isNightNow()&&Date.now()>=disabledUntil)applyDay(true);
  });

  window.__trasyBasemapProvider={
    applyDay:()=>applyDay(true),
    applyFallback,
    state:()=>window.__trasyBasemapState||{provider,disabledUntil,routeReady},
    ptvStyleUrl:PTV_STYLE_URL,
    fallbackDayStyle:OSM_FALLBACK_STYLE
  };

  if(window.__routeMap)install(window.__routeMap);
})();
