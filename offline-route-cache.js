(()=>{
  if(window.__trasyOfflineRoutes)return;

  const CACHE_NAME='trasy-offline-routes-v1';
  const ROUTES_KEY='trasy2.routes';
  const OSRM_ORIGIN='https://router.project-osrm.org';
  const PREFIX=`${location.origin}/_offline-route/`;
  const MAX_ROUTE_DISTANCE_M=2500;
  let prefetching=null;

  function parseCoord(value){
    const match=String(value||'').match(/(-?\d+(?:\.\d+)?)\s*[,; ]\s*(-?\d+(?:\.\d+)?)/);
    if(!match)return null;
    const lat=Number(match[1]),lng=Number(match[2]);
    return Number.isFinite(lat)&&Number.isFinite(lng)?[lat,lng]:null;
  }

  function hav(a,b){
    const R=6371000,p=Math.PI/180;
    const dLat=(b[0]-a[0])*p,dLng=(b[1]-a[1])*p;
    const h=Math.sin(dLat/2)**2+Math.cos(a[0]*p)*Math.cos(b[0]*p)*Math.sin(dLng/2)**2;
    return 2*R*Math.asin(Math.sqrt(h));
  }

  function routeCoordinates(url){
    try{
      const parsed=new URL(url,location.href);
      if(parsed.origin!==OSRM_ORIGIN||!parsed.pathname.startsWith('/route/v1/driving/'))return null;
      const raw=decodeURIComponent(parsed.pathname.split('/route/v1/driving/')[1]||'');
      const points=raw.split(';').map(value=>{
        const [lng,lat]=value.split(',').map(Number);
        return Number.isFinite(lat)&&Number.isFinite(lng)?[lat,lng]:null;
      }).filter(Boolean);
      return points.length>=2?points:null;
    }catch{return null}
  }

  function signatureFromPoints(points){
    if(!Array.isArray(points)||points.length<2)return'';
    return points.slice(1).map(([lat,lng])=>`${lat.toFixed(5)},${lng.toFixed(5)}`).join(';');
  }

  function hash(text){
    let value=2166136261;
    for(let index=0;index<text.length;index++){value^=text.charCodeAt(index);value=Math.imul(value,16777619)}
    return(value>>>0).toString(36);
  }

  function syntheticRequest(signature){
    return new Request(`${PREFIX}${hash(signature)}`,{method:'GET'});
  }

  async function routeJson(response){try{return await response.clone().json()}catch{return null}}

  async function store(cache,url,response){
    if(!response?.ok)return;
    const points=routeCoordinates(url);
    const signature=signatureFromPoints(points);
    try{await cache.put(new Request(url,{method:'GET'}),response.clone())}catch{}
    if(signature){
      const data=await routeJson(response);
      if(data?.routes?.[0]?.geometry?.coordinates?.length){
        const copy=new Response(JSON.stringify(data),{status:200,headers:{'Content-Type':'application/json','X-Trasy-Offline-Route':'1'}});
        try{await cache.put(syntheticRequest(signature),copy)}catch{}
        document.dispatchEvent(new CustomEvent('trasy:route-geometry-cached',{detail:{signature,coordinates:data.routes[0].geometry.coordinates}}));
      }
    }
  }

  function originNearGeometry(points,data){
    const origin=points?.[0];
    const geometry=data?.routes?.[0]?.geometry?.coordinates;
    if(!origin||!Array.isArray(geometry)||!geometry.length)return false;
    let best=Infinity;
    const stride=Math.max(1,Math.floor(geometry.length/250));
    for(let index=0;index<geometry.length;index+=stride){
      const item=geometry[index];
      const lng=Number(item?.[0]),lat=Number(item?.[1]);
      if(!Number.isFinite(lat)||!Number.isFinite(lng))continue;
      best=Math.min(best,hav(origin,[lat,lng]));
      if(best<=MAX_ROUTE_DISTANCE_M)return true;
    }
    const last=geometry[geometry.length-1];
    if(last)best=Math.min(best,hav(origin,[Number(last[1]),Number(last[0])]));
    return best<=MAX_ROUTE_DISTANCE_M;
  }

  async function cachedFallback(cache,url){
    try{
      const exact=await cache.match(new Request(url,{method:'GET'}),{ignoreSearch:false});
      if(exact)return exact;
    }catch{}
    const points=routeCoordinates(url);
    const signature=signatureFromPoints(points);
    if(!signature)return null;
    const candidate=await cache.match(syntheticRequest(signature));
    if(!candidate)return null;
    const data=await routeJson(candidate);
    if(!originNearGeometry(points,data))return null;
    return new Response(JSON.stringify(data),{status:200,headers:{'Content-Type':'application/json','X-Trasy-Offline-Route':'1'}});
  }

  async function routeFetch(input,init={}){
    const url=typeof input==='string'?input:input?.url;
    if(!routeCoordinates(url))return fetch(input,init);
    const cache=await caches.open(CACHE_NAME);
    try{
      const response=await fetch(input,{...init,cache:'no-store'});
      if(response.ok){await store(cache,url,response.clone());return response}
      const fallback=await cachedFallback(cache,url);
      return fallback||response;
    }catch(error){
      const fallback=await cachedFallback(cache,url);
      if(fallback)return fallback;
      throw error;
    }
  }

  function routes(){try{const data=JSON.parse(localStorage.getItem(ROUTES_KEY)||'[]');return Array.isArray(data)?data:[]}catch{return[]}}

  function routeUrl(points){
    const coordinates=points.map(([lat,lng])=>`${lng.toFixed(6)},${lat.toFixed(6)}`).join(';');
    return `${OSRM_ORIGIN}/route/v1/driving/${coordinates}?overview=full&geometries=geojson&steps=true&annotations=duration,distance`;
  }

  async function prefetchSequence(cache,sequence){
    if(sequence.length<2)return false;
    // Pierwszy punkt jest jednocześnie pozycją startową i pierwszym celem.
    // Dzięki temu sygnatura jest taka sama jak podczas normalnego startu GPS.
    const points=[sequence[0],...sequence];
    const url=routeUrl(points);
    const signature=signatureFromPoints(points);
    if(await cache.match(syntheticRequest(signature)))return true;
    try{
      const response=await fetch(url,{cache:'no-store'});
      if(!response.ok)return false;
      await store(cache,url,response.clone());
      return true;
    }catch{return false}
  }

  async function prefetch(){
    if(prefetching)return prefetching;
    prefetching=(async()=>{
      if(!navigator.onLine)return{cached:0,total:0};
      const cache=await caches.open(CACHE_NAME);
      const sequences=[];
      for(const route of routes()){
        const stops=Array.isArray(route?.stops)?route.stops:[];
        const forward=stops.map(stop=>parseCoord(stop?.coordinates)).filter(Boolean);
        const backward=stops.map(stop=>parseCoord(stop?.returnCoordinates||stop?.coordinates)).filter(Boolean).reverse();
        if(forward.length>=2)sequences.push(forward);
        if(backward.length>=2)sequences.push(backward);
      }
      let cached=0;
      for(const sequence of sequences){
        if(await prefetchSequence(cache,sequence))cached++;
        await new Promise(resolve=>setTimeout(resolve,120));
      }
      return{cached,total:sequences.length};
    })().finally(()=>{prefetching=null});
    return prefetching;
  }

  function schedule(){
    const run=()=>prefetch().catch(error=>console.warn('Geometrie offline:',error));
    if('requestIdleCallback'in window)requestIdleCallback(run,{timeout:7000});
    else setTimeout(run,5000);
  }

  window.__trasyRouteFetch=routeFetch;
  window.__trasyOfflineRoutes={prefetch,cacheName:CACHE_NAME,clear:()=>caches.delete(CACHE_NAME)};
  document.addEventListener('trasy:route-data-updated',()=>setTimeout(schedule,0));
  window.addEventListener('online',schedule);
  schedule();
})();
