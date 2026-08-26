import { isNightAt } from './map-theme-core.js?v=1';

const PTV_STYLE='https://vectormaps-resources.myptv.com/styles/latest/standard.json';
const PTV_API_ORIGIN='https://api.myptv.com';
const PTV_PROXY='/ptv-map';
const DAY_FALLBACK='https://tiles.openfreemap.org/styles/liberty';
const NIGHT_STYLE='https://tiles.openfreemap.org/styles/dark';
const CHECK_MS=60000;
const REQUEST_TIMEOUT_MS=6500;
const PTV_RETRY_MS=15000;
const FALLBACK_GRACE_MS=8000;
const FALLBACK_CONFIRM_ATTEMPTS=3;
const FALLBACK_CONFIRM_DELAY_MS=2000;
const ERROR_WINDOW_MS=12000;
const ERROR_LIMIT=3;
const STYLE_TIMEOUT_MS=12000;

let map=null;
let provider='initial';
let theme='day';
let switching=false;
let generation=0;
let errorTimes=[];
let fallbackTimer=0;
let retryTimer=0;
let startupTimer=0;
let lastPtvError='';
let gpsSubscribed=false;
let checkTimer=0;

const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

// Rozgrzewamy tylko plik stylu. Nie blokuje to utworzenia mapy ani pierwszego GPS.
window.__trasyPtvStyleWarmup=fetch(PTV_STYLE,{cache:'force-cache',mode:'cors'}).catch(()=>null);

function pointFromPosition(position){
  const lat=Number(position?.coords?.latitude),lng=Number(position?.coords?.longitude);
  return Number.isFinite(lat)&&Number.isFinite(lng)?{lat,lng}:null;
}

function pointFromMap(){
  const center=map?.getCenter?.();
  const lat=Number(center?.lat),lng=Number(center?.lng);
  return Number.isFinite(lat)&&Number.isFinite(lng)?{lat,lng}:null;
}

function pointFromOptions(options){
  const center=Array.isArray(options?.center)?options.center:null;
  const lng=Number(center?.[0]),lat=Number(center?.[1]);
  return Number.isFinite(lat)&&Number.isFinite(lng)?{lat,lng}:null;
}

function currentPoint(options=null){
  return pointFromPosition(window.__trasyGps?.current?.())||pointFromOptions(options)||pointFromMap();
}

function themeAt(point){
  return point&&isNightAt(new Date(),point.lat,point.lng)?'night':'day';
}

function currentTheme(options=null){return themeAt(currentPoint(options))}

function proxiedPtvUrl(value){
  if(typeof value!=='string')return value;
  try{
    const parsed=new URL(value,location.href);
    if(parsed.origin===PTV_API_ORIGIN)return `${location.origin}${PTV_PROXY}${parsed.pathname}${parsed.search}`;
  }catch{}
  return value;
}

function transformRequest(previous){
  return(url,type)=>{
    const prior=typeof previous==='function'?previous(url,type):null;
    const target=proxiedPtvUrl(prior?.url||url);
    return prior?{...prior,url:target}:{url:target};
  };
}

function styleFor(themeName,providerName=null){
  if(themeName==='night')return NIGHT_STYLE;
  return providerName==='openfreemap-liberty'?DAY_FALLBACK:PTV_STYLE;
}

function providerFor(themeName){return themeName==='night'?'openfreemap-dark':'ptv'}

function setMarkers(nextProvider,nextTheme,reason=''){
  provider=nextProvider;
  theme=nextTheme;
  const container=map?.getContainer?.();
  if(container){
    container.dataset.mapProvider=provider;
    container.dataset.mapTheme=theme;
  }
  document.documentElement.dataset.mapProvider=provider;
  document.documentElement.dataset.mapTheme=theme;
  const detail={provider,theme,reason,lastPtvError};
  window.__trasyBasemapState=detail;
  document.dispatchEvent(new CustomEvent('trasy:basemap-provider-change',{detail}));
  document.dispatchEvent(new CustomEvent('trasy:map-theme-change',{detail:{theme,provider,reason}}));
}

function markSwitch(value,reason=''){
  window.__trasyMapStyleSwitching=value===true;
  document.dispatchEvent(new CustomEvent(value?'trasy:map-style-switch-start':'trasy:map-style-switch-end',{detail:{source:'map-runtime',reason}}));
}

function clearFallbackTimer(){if(fallbackTimer){clearTimeout(fallbackTimer);fallbackTimer=0}}
function clearRetryTimer(){if(retryTimer){clearTimeout(retryTimer);retryTimer=0}}
function clearStartupTimer(){if(startupTimer){clearTimeout(startupTimer);startupTimer=0}}

function tileForPoint(point,z){
  if(!point)return`${PTV_PROXY}/maps/v1/vector-tiles/0/0/0`;
  const zoom=Math.max(0,Math.min(17,Math.floor(Number(z)||0)));
  const n=2**zoom;
  const x=Math.max(0,Math.min(n-1,Math.floor((point.lng+180)/360*n)));
  const rad=Math.max(-85.0511,Math.min(85.0511,point.lat))*Math.PI/180;
  const y=Math.max(0,Math.min(n-1,Math.floor((1-Math.asinh(Math.tan(rad))/Math.PI)/2*n)));
  return`${PTV_PROXY}/maps/v1/vector-tiles/${zoom}/${x}/${y}`;
}

async function fetchWithTimeout(url,init={}){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),REQUEST_TIMEOUT_MS);
  try{return await fetch(url,{...init,signal:controller.signal})}finally{clearTimeout(timer)}
}

async function probePtv(){
  const response=await fetchWithTimeout(tileForPoint(currentPoint(),map?.getZoom?.()),{cache:'no-store',credentials:'same-origin'});
  if(response.ok){lastPtvError='';return true}
  let code='';
  try{const data=await response.clone().json();code=String(data?.code||data?.message||'').trim()}catch{}
  lastPtvError=`HTTP_${response.status}${code?`:${code}`:''}`;
  throw Error(`PTV map proxy ${response.status}${code?` ${code}`:''}`);
}

async function confirmPtvUnavailable(){
  let lastError=null;
  for(let attempt=0;attempt<FALLBACK_CONFIRM_ATTEMPTS;attempt+=1){
    try{await probePtv();return false}catch(error){lastError=error}
    if(attempt<FALLBACK_CONFIRM_ATTEMPTS-1)await sleep(FALLBACK_CONFIRM_DELAY_MS);
  }
  if(lastError)console.warn('PTV: potwierdzona niedostępność:',lastError);
  return true;
}

function safePaint(layerId,property,value){try{map?.setPaintProperty?.(layerId,property,value)}catch{}}

function softenNightMap(){
  if(!map||theme!=='night')return;
  const layers=map.getStyle?.()?.layers||[];
  for(const layer of layers){
    const id=layer?.id;
    const text=`${id||''} ${layer?.['source-layer']||''}`.toLowerCase();
    if(!id||/route|etoll/.test(text))continue;
    if(layer.type==='background'){
      safePaint(id,'background-color','#20252a');safePaint(id,'background-opacity',1);continue;
    }
    if(layer.type==='fill'){
      let color='#292e33';
      if(/water|river|lake|ocean|sea/.test(text))color='#193648';
      else if(/park|forest|wood|grass|green|landcover|nature/.test(text))color='#263a30';
      else if(/building/.test(text))color='#343a40';
      safePaint(id,'fill-color',color);safePaint(id,'fill-opacity',.94);continue;
    }
    if(layer.type==='line'){
      let color='#59616a',opacity=.82;
      if(/motorway|trunk|primary|highway|major/.test(text))color='#7b848e';
      else if(/secondary|tertiary|street|road/.test(text))color='#68717a';
      else if(/path|track|service|minor/.test(text)){color='#50575e';opacity=.72}
      else if(/water|river|stream/.test(text))color='#31566d';
      else if(/boundary|admin/.test(text)){color='#646b73';opacity=.58}
      safePaint(id,'line-color',color);safePaint(id,'line-opacity',opacity);continue;
    }
    if(layer.type==='symbol'){
      safePaint(id,'text-color','#d5d9dd');safePaint(id,'text-halo-color','#20252a');safePaint(id,'text-halo-width',1.2);safePaint(id,'text-halo-blur',.4);
    }
  }
}

function schedulePtvRetry(){
  clearRetryTimer();
  if(!map||theme==='night'||provider==='ptv')return;
  retryTimer=setTimeout(async()=>{
    retryTimer=0;
    if(!map||currentTheme()==='night')return;
    try{
      await probePtv();
      switchStyle(PTV_STYLE,'ptv','day','ptv-recovered');
    }catch{schedulePtvRetry()}
  },PTV_RETRY_MS);
}

function scheduleFallback(reason){
  if(!map||theme==='night'||provider!=='ptv'||fallbackTimer)return;
  fallbackTimer=setTimeout(async()=>{
    fallbackTimer=0;
    if(!map||theme==='night'||provider!=='ptv')return;
    if(!(await confirmPtvUnavailable()))return;
    switchStyle(DAY_FALLBACK,'openfreemap-liberty','day',reason);
  },FALLBACK_GRACE_MS);
}

function startPtvStartupGuard(){
  clearStartupTimer();
  if(provider!=='ptv')return;
  startupTimer=setTimeout(()=>{
    startupTimer=0;
    if(provider==='ptv')scheduleFallback('ptv-style-timeout');
  },STYLE_TIMEOUT_MS);
}

function switchStyle(style,nextProvider,nextTheme,reason=''){
  if(!map)return;
  if(switching){setTimeout(()=>switchStyle(style,nextProvider,nextTheme,reason),250);return}
  if(provider===nextProvider&&theme===nextTheme)return;

  const localGeneration=++generation;
  switching=true;
  markSwitch(true,reason);
  let settled=false;
  const finish=()=>{switching=false;markSwitch(false,reason)};
  const timeout=setTimeout(()=>{
    if(settled||localGeneration!==generation)return;
    settled=true;finish();
    if(nextProvider==='ptv')scheduleFallback('ptv-style-timeout');
  },STYLE_TIMEOUT_MS);

  map.once('style.load',()=>{
    if(settled||localGeneration!==generation)return;
    settled=true;clearTimeout(timeout);
    setMarkers(nextProvider,nextTheme,reason);
    if(nextProvider==='ptv'){
      lastPtvError='';errorTimes=[];clearFallbackTimer();clearRetryTimer();clearStartupTimer();
    }
    if(nextTheme==='night')setTimeout(softenNightMap,0);
    if(nextProvider==='openfreemap-liberty')schedulePtvRetry();
    finish();
  });

  try{map.setStyle(style,{diff:false})}catch(error){
    settled=true;clearTimeout(timeout);finish();
    console.warn('Zmiana mapy:',error);
    if(nextProvider==='ptv')scheduleFallback('ptv-style-error');
  }
}

function applyTheme(nextTheme,reason='theme-change'){
  if(!map||nextTheme===theme)return;
  if(nextTheme==='night'){
    clearFallbackTimer();clearRetryTimer();
    switchStyle(NIGHT_STYLE,'openfreemap-dark','night',reason);
  }else{
    switchStyle(PTV_STYLE,'ptv','day',reason);
  }
}

function evaluateTheme(){if(map)applyTheme(currentTheme(),'astronomical-theme')}

function onMapError(event){
  const message=String(event?.error?.message||event?.message||'').toLowerCase();
  if(provider==='ptv'){
    if(!(message.includes('ptv-map')||message.includes('myptv')||message.includes('vectormaps-resources')))return;
  }else if(provider==='openfreemap-dark'||provider==='openfreemap-liberty'){
    if(!(message.includes('openfreemap')||message.includes('tiles.openfreemap')))return;
  }else return;

  const now=Date.now();
  errorTimes=errorTimes.filter(value=>now-value<=ERROR_WINDOW_MS);
  errorTimes.push(now);
  if(errorTimes.length<ERROR_LIMIT)return;
  errorTimes=[];

  if(provider==='ptv')scheduleFallback('ptv-tile-errors');
  else if(provider==='openfreemap-liberty'&&navigator.onLine)schedulePtvRetry();
}

function installRuntime(nextMap,initialProvider,initialTheme){
  map=nextMap;
  setMarkers(initialProvider,initialTheme,'initial-style');
  map.on('error',onMapError);
  map.on('style.load',()=>{if(theme==='night')setTimeout(softenNightMap,0)});
  if(initialProvider==='ptv')startPtvStartupGuard();

  if(!gpsSubscribed&&window.__trasyGps?.subscribe){
    gpsSubscribed=true;
    window.__trasyGps.subscribe(()=>evaluateTheme(),()=>{});
  }
  if(!checkTimer)checkTimer=setInterval(evaluateTheme,CHECK_MS);
}

function createMap(options){
  if(!window.maplibregl?.Map)throw Error('MapLibre nie jest dostępne.');
  const nextTheme=currentTheme(options);
  const nextProvider=providerFor(nextTheme);
  const mapOptions={
    ...options,
    style:styleFor(nextTheme,nextProvider),
    transformRequest:transformRequest(options?.transformRequest)
  };
  const instance=new window.maplibregl.Map(mapOptions);
  installRuntime(instance,nextProvider,nextTheme);
  window.__routeMap=instance;
  return instance;
}

window.__trasyResolveMapTheme=({latitude,longitude}={})=>{
  const lat=Number(latitude),lng=Number(longitude);
  return Number.isFinite(lat)&&Number.isFinite(lng)?themeAt({lat,lng}):currentTheme();
};

document.documentElement.dataset.mapTheme=currentTheme();
window.addEventListener('online',()=>{
  if(!map)return;
  if(theme==='day'&&provider!=='ptv'){
    clearFallbackTimer();
    schedulePtvRetry();
  }
});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')evaluateTheme()});
window.addEventListener('pageshow',evaluateTheme);

window.__trasyMapRuntime={
  createMap,
  forcePtv:()=>{if(map&&currentTheme()==='day')switchStyle(PTV_STYLE,'ptv','day','manual-ptv')},
  applyFallback:reason=>{if(map&&theme==='day')switchStyle(DAY_FALLBACK,'openfreemap-liberty','day',reason||'manual-fallback')},
  state:()=>({provider,theme,lastPtvError,switching}),
  styles:{ptv:PTV_STYLE,dayFallback:DAY_FALLBACK,night:NIGHT_STYLE}
};
