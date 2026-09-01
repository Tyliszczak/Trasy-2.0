const APP_VERSION='2.0.184';
const CACHE_NAME='trasy-2.0-v215';
const OFFLINE_MAP_CACHE='trasy-offline-map-v1';
const OFFLINE_ROUTE_CACHE='trasy-offline-routes-v1';
const APP_SHELL=['./','./index.html','./style.css','./navigation.css','./i18n.js','./time-core.js','./geo-core.js','./eta-core.js','./route-data-service.js','./parking-data.js','./gps-hub.js','./gps-stop-engine.js','./stop-target-policy.js','./stop-alert-core.js','./schedule-time.js','./app.js','./wake-style.js','./map-runtime.js','./offline-map-cache.js','./offline-route-cache.js','./offline-vmax-cache.js','./vehicles.js','./return-route.js','./speed-display.js','./road-speed-limit-core.js','./road-speed-limit.js','./navigation-live-core.js','./navigation-live-engine.js','./gps-stop-tracker.js','./active-stop-guard.js','./return-navigation-origin-fix.js','./google-routes-provider.js','./route-renderer-bridge.js','./nav-map.js','./guidance-text-fix.js','./maneuver-bubble.js','./route-progress-core.js','./route-progress-style.js','./map-theme-core.js','./traffic-delay-ui.js','./navigation-ui-controls.js','./navigation-compass.js','./navigation-feedback.js','./navigation-layout-fix.js','./android-back-navigation.js','./etoll-overlay.js','./skip-stop-control.js','./skip-detection.js','./final-stop-ui.js','./stop-map-links.js','./eta-status.js','./next-stop-header.js','./visual-stop-alert.js','./routes.js','./schedule.js','./manifest.json','./Tyliszczak.png'];
const KEEP_CACHES=new Set([CACHE_NAME,OFFLINE_MAP_CACHE,OFFLINE_ROUTE_CACHE]);

self.addEventListener('install',e=>{
  e.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(APP_SHELL.map(url=>new Request(url,{cache:'reload'})))))
});

self.addEventListener('activate',e=>{
  e.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(key=>!KEEP_CACHES.has(key)).map(key=>caches.delete(key)));
    await self.clients.claim();
  })())
});

self.addEventListener('message',e=>{
  if(e.data?.type==='GET_VERSION'){
    e.ports?.[0]?.postMessage({version:APP_VERSION});
    return;
  }
  if(e.data?.type==='SKIP_WAITING')self.skipWaiting();
});

async function openFreeMapResponse(event){
  const cache=await caches.open(OFFLINE_MAP_CACHE);
  const cached=await cache.match(event.request,{ignoreVary:true});
  if(cached){
    event.waitUntil((async()=>{
      try{
        const fresh=await fetch(new Request(event.request,{cache:'no-store'}));
        if(fresh.ok)await cache.put(event.request,fresh.clone());
      }catch{}
    })());
    return cached;
  }
  try{
    const fresh=await fetch(event.request);
    if(fresh.ok)await cache.put(event.request,fresh.clone());
    return fresh;
  }catch{
    return Response.error();
  }
}

async function osrmResponse(request){
  const cache=await caches.open(OFFLINE_ROUTE_CACHE);
  try{
    const fresh=await fetch(new Request(request,{cache:'no-store'}));
    if(fresh.ok)await cache.put(request,fresh.clone());
    return fresh;
  }catch{
    const cached=await cache.match(request);
    return cached??Response.error();
  }
}

self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  const url=new URL(e.request.url);

  if(url.origin==='https://tiles.openfreemap.org'){
    e.respondWith(openFreeMapResponse(e));
    return;
  }

  if(url.origin==='https://router.project-osrm.org'&&url.pathname.startsWith('/route/v1/driving/')){
    e.respondWith(osrmResponse(e.request));
    return;
  }

  if(url.origin!==self.location.origin)return;
  if(url.pathname.startsWith('/ptv-map/'))return;
  if(url.pathname.startsWith('/osm-vmax/'))return;
  if(url.pathname==='/trasy-data')return;

  e.respondWith((async()=>{
    const cache=await caches.open(CACHE_NAME);
    try{
      const fresh=await fetch(new Request(e.request,{cache:'no-store'}));
      if(fresh.ok)await cache.put(e.request,fresh.clone());
      return fresh;
    }catch{
      const cached=await cache.match(e.request,{ignoreSearch:true});
      return cached??Response.error();
    }
  })());
});