(()=>{
  if(window.__trasyOfflineMap)return;

  const CACHE_NAME='trasy-offline-map-v1';
  const ROUTES_KEY='trasy2.routes';
  const META_KEY='trasy2.offlineMap.v1';
  const STYLE_URLS=[
    'https://tiles.openfreemap.org/styles/liberty',
    'https://tiles.openfreemap.org/styles/dark'
  ];
  const TILEJSON_URL='https://tiles.openfreemap.org/planet';
  const STATIC_URLS=[
    ...STYLE_URLS,
    TILEJSON_URL,
    'https://tiles.openfreemap.org/sprites/ofm_f384/ofm.json',
    'https://tiles.openfreemap.org/sprites/ofm_f384/ofm.png',
    'https://tiles.openfreemap.org/sprites/ofm_f384/ofm@2x.json',
    'https://tiles.openfreemap.org/sprites/ofm_f384/ofm@2x.png',
    'https://tiles.openfreemap.org/fonts/Noto%20Sans%20Regular/0-255.pbf',
    'https://tiles.openfreemap.org/fonts/Noto%20Sans%20Regular/256-511.pbf',
    'https://tiles.openfreemap.org/fonts/Noto%20Sans%20Italic/0-255.pbf',
    'https://tiles.openfreemap.org/fonts/Noto%20Sans%20Italic/256-511.pbf',
    'https://tiles.openfreemap.org/fonts/Noto%20Sans%20Bold/0-255.pbf',
    'https://tiles.openfreemap.org/fonts/Noto%20Sans%20Bold/256-511.pbf'
  ];
  const MIN_ZOOM=8;
  const MAX_ZOOM=14;
  const MAX_TILES=3200;
  const CONCURRENCY=4;
  const REFRESH_MS=7*24*60*60*1000;

  let running=null;
  let lastState={status:'idle',cached:0,total:0};

  const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

  function parseCoord(value){
    const match=String(value||'').match(/(-?\d+(?:\.\d+)?)\s*[,; ]\s*(-?\d+(?:\.\d+)?)/);
    if(!match)return null;
    const lat=Number(match[1]),lng=Number(match[2]);
    return Number.isFinite(lat)&&Number.isFinite(lng)&&Math.abs(lat)<=90&&Math.abs(lng)<=180?[lat,lng]:null;
  }

  function hav(a,b){
    const R=6371000,p=Math.PI/180;
    const dLat=(b[0]-a[0])*p,dLng=(b[1]-a[1])*p;
    const h=Math.sin(dLat/2)**2+Math.cos(a[0]*p)*Math.cos(b[0]*p)*Math.sin(dLng/2)**2;
    return 2*R*Math.asin(Math.sqrt(h));
  }

  function tileAt(lat,lng,z){
    const n=2**z;
    const safeLat=Math.max(-85.05112878,Math.min(85.05112878,lat));
    const x=Math.floor((lng+180)/360*n);
    const rad=safeLat*Math.PI/180;
    const y=Math.floor((1-Math.asinh(Math.tan(rad))/Math.PI)/2*n);
    return{x:Math.max(0,Math.min(n-1,x)),y:Math.max(0,Math.min(n-1,y)),z};
  }

  function tileWidthMeters(lat,z){
    return 40075016.686*Math.max(.15,Math.cos(lat*Math.PI/180))/(2**z);
  }

  function addTile(set,z,x,y){
    const n=2**z;
    if(x<0||y<0||x>=n||y>=n||set.size>=MAX_TILES)return;
    set.add(`${z}/${x}/${y}`);
  }

  function addPointTiles(set,lat,lng,z,radius){
    const tile=tileAt(lat,lng,z);
    for(let dx=-radius;dx<=radius;dx++)for(let dy=-radius;dy<=radius;dy++)addTile(set,z,tile.x+dx,tile.y+dy);
  }

  function coverSequence(set,points){
    if(points.length<1)return;
    for(let z=MIN_ZOOM;z<=MAX_ZOOM&&set.size<MAX_TILES;z++){
      const radius=z>=13?1:0;
      if(points.length===1){addPointTiles(set,points[0][0],points[0][1],z,radius);continue}
      for(let index=0;index<points.length-1&&set.size<MAX_TILES;index++){
        const a=points[index],b=points[index+1];
        const distance=hav(a,b);
        const midLat=(a[0]+b[0])/2;
        const spacing=Math.max(400,tileWidthMeters(midLat,z)*.72);
        const steps=Math.max(1,Math.ceil(distance/spacing));
        for(let step=0;step<=steps&&set.size<MAX_TILES;step++){
          const t=step/steps;
          addPointTiles(set,a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,z,radius);
        }
      }
    }
  }

  function routes(){
    try{
      const parsed=JSON.parse(localStorage.getItem(ROUTES_KEY)||'[]');
      return Array.isArray(parsed)?parsed:[];
    }catch{return[]}
  }

  function routeSequences(items=routes()){
    const result=[];
    for(const route of items){
      const stops=Array.isArray(route?.stops)?route.stops:[];
      const forward=stops.map(stop=>parseCoord(stop?.coordinates)).filter(Boolean);
      const backward=stops.map(stop=>parseCoord(stop?.returnCoordinates||stop?.coordinates)).filter(Boolean).reverse();
      if(forward.length)result.push(forward);
      if(backward.length)result.push(backward);
    }
    return result;
  }

  function fingerprint(items=routes()){
    let hash=2166136261;
    const text=items.map(route=>`${route?.name||''}|${(route?.stops||[]).map(stop=>`${stop?.coordinates||''}>${stop?.returnCoordinates||''}`).join(';')}`).join('||');
    for(let i=0;i<text.length;i++){hash^=text.charCodeAt(i);hash=Math.imul(hash,16777619)}
    return String(hash>>>0);
  }

  function meta(){try{return JSON.parse(localStorage.getItem(META_KEY)||'null')}catch{return null}}
  function saveMeta(value){try{localStorage.setItem(META_KEY,JSON.stringify(value))}catch{}}

  async function storageSafe(){
    try{
      await navigator.storage?.persist?.();
      const estimate=await navigator.storage?.estimate?.();
      if(estimate?.quota&&estimate?.usage/estimate.quota>.82)return false;
    }catch{}
    return true;
  }

  async function cacheResponse(cache,url,{parseJson=false}={}){
    const request=new Request(url,{mode:'cors',credentials:'omit'});
    const existing=await cache.match(request,{ignoreVary:true});
    if(existing){
      if(parseJson){try{return await existing.clone().json()}catch{}}
      return true;
    }
    const response=await fetch(request);
    if(!response.ok)throw Error(`Offline mapa HTTP ${response.status}: ${url}`);
    await cache.put(request,response.clone());
    if(parseJson)return response.json();
    return true;
  }

  function resolveTileTemplate(tileJson){
    const template=Array.isArray(tileJson?.tiles)?tileJson.tiles.find(value=>typeof value==='string'&&value.includes('{z}')&&value.includes('{x}')&&value.includes('{y}')):null;
    return template||'';
  }

  function tileUrl(template,key){
    const [z,x,y]=key.split('/');
    return template.replace('{z}',z).replace('{x}',x).replace('{y}',y);
  }

  async function cacheUrls(cache,urls){
    let cursor=0,cached=0;
    async function worker(){
      while(cursor<urls.length){
        const index=cursor++;
        if(!(await storageSafe()))return;
        try{await cacheResponse(cache,urls[index]);cached++}catch{}
        lastState={status:'caching',cached,total:urls.length};
        if(index%20===0)await sleep(25);
      }
    }
    await Promise.all(Array.from({length:Math.min(CONCURRENCY,urls.length||1)},worker));
    return cached;
  }

  async function prefetch({force=false}={}){
    if(running)return running;
    running=(async()=>{
      if(!navigator.onLine){lastState={status:'offline',cached:0,total:0};return lastState}
      if(navigator.connection?.saveData){lastState={status:'save-data',cached:0,total:0};return lastState}
      const items=routes();
      if(!items.length){lastState={status:'no-routes',cached:0,total:0};return lastState}
      const fp=fingerprint(items),previous=meta();
      if(!force&&previous?.fingerprint===fp&&Date.now()-Number(previous?.completedAt||0)<REFRESH_MS){
        lastState={status:'ready',cached:Number(previous?.tiles||0),total:Number(previous?.tiles||0)};
        return lastState;
      }

      lastState={status:'preparing',cached:0,total:0};
      const cache=await caches.open(CACHE_NAME);
      let tileJson=null;
      for(const url of STATIC_URLS){
        try{
          const data=await cacheResponse(cache,url,{parseJson:url===TILEJSON_URL});
          if(url===TILEJSON_URL&&data&&typeof data==='object')tileJson=data;
        }catch(error){console.warn('Pakiet map offline:',error)}
      }
      if(!tileJson){
        try{tileJson=await (await fetch(TILEJSON_URL,{cache:'no-store'})).json()}catch{}
      }
      const template=resolveTileTemplate(tileJson);
      if(!template)throw Error('OpenFreeMap nie zwrócił szablonu kafelków.');

      const tiles=new Set();
      routeSequences(items).forEach(sequence=>coverSequence(tiles,sequence));
      const urls=[...tiles].map(key=>tileUrl(template,key));
      const cached=await cacheUrls(cache,urls);
      const completed={fingerprint:fp,completedAt:Date.now(),tiles:tiles.size,cached};
      saveMeta(completed);
      lastState={status:'ready',cached,total:tiles.size};
      document.dispatchEvent(new CustomEvent('trasy:offline-map-ready',{detail:{...completed,cacheName:CACHE_NAME}}));
      return lastState;
    })().catch(error=>{
      console.warn('Przygotowanie map offline:',error);
      lastState={status:'error',cached:0,total:0,error:String(error?.message||error)};
      return lastState;
    }).finally(()=>{running=null});
    return running;
  }

  function schedule(force=false){
    const start=()=>prefetch({force});
    if('requestIdleCallback'in window)requestIdleCallback(start,{timeout:5000});
    else setTimeout(start,3500);
  }

  document.addEventListener('trasy:route-data-updated',()=>setTimeout(()=>schedule(false),0));
  window.addEventListener('online',()=>schedule(false));

  window.__trasyOfflineMap={
    prefetch,
    state:()=>({...lastState,meta:meta()}),
    cacheName:CACHE_NAME,
    clear:async()=>{await caches.delete(CACHE_NAME);localStorage.removeItem(META_KEY);lastState={status:'idle',cached:0,total:0}}
  };

  schedule(false);
})();
