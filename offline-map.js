(()=>{
  const DB_NAME='trasy2-offline-map',STORE='maps',KEY='routes-area-v1',ROUTES_KEY='trasy2.routes';
  const OVERPASS='https://overpass-api.de/api/interpreter';
  let readyPromise=null;

  function parseCoord(value){const m=String(value||'').match(/(-?\d+(?:[.,]\d+)?)\s*[,; ]\s*(-?\d+(?:[.,]\d+)?)/);return m?[+m[1].replace(',','.'),+m[2].replace(',','.')]:null}
  function readRouteCoords(){
    try{
      const routes=JSON.parse(localStorage.getItem(ROUTES_KEY)||'[]');
      const out=[];(Array.isArray(routes)?routes:[]).forEach(r=>(r.stops||[]).forEach(s=>{const c=parseCoord(s.coordinates);if(c)out.push(c)}));return out;
    }catch{return []}
  }
  function boundsFor(coords){
    if(!coords.length)return null;let s=90,w=180,n=-90,e=-180;coords.forEach(([lat,lng])=>{s=Math.min(s,lat);n=Math.max(n,lat);w=Math.min(w,lng);e=Math.max(e,lng)});
    const latPad=Math.max(.025,(n-s)*.12),lngPad=Math.max(.035,(e-w)*.12);return[s-latPad,w-lngPad,n+latPad,e+lngPad]
  }
  function signature(b){return b.map(v=>v.toFixed(3)).join(',')}
  function openDb(){return new Promise((resolve,reject)=>{const r=indexedDB.open(DB_NAME,1);r.onupgradeneeded=()=>r.result.createObjectStore(STORE);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
  async function dbGet(){const db=await openDb();return new Promise((resolve,reject)=>{const tx=db.transaction(STORE),r=tx.objectStore(STORE).get(KEY);r.onsuccess=()=>resolve(r.result||null);r.onerror=()=>reject(r.error)})}
  async function dbPut(value){const db=await openDb();return new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).put(value,KEY);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error)})}
  function notify(text,done=false){
    let el=document.getElementById('offlineMapNotice');if(!el){el=document.createElement('div');el.id='offlineMapNotice';el.style.cssText='position:fixed;left:12px;right:12px;bottom:12px;z-index:25000;padding:10px 12px;border-radius:8px;background:#222;color:#fff;border:1px solid #555;text-align:center;font-weight:800;box-shadow:0 3px 16px #0008';document.body.append(el)}
    el.textContent=text;if(done)setTimeout(()=>el.remove(),3500)
  }
  function toGeoJson(data,bounds,sig){
    const features=[];
    for(const el of data.elements||[]){
      if(el.type==='way'&&Array.isArray(el.geometry)&&el.geometry.length>1){const tags=el.tags||{};features.push({type:'Feature',properties:{kind:'road',highway:tags.highway||'',name:tags.name||'',ref:tags.ref||''},geometry:{type:'LineString',coordinates:el.geometry.map(p=>[p.lon,p.lat])}})}
      else if(el.type==='node'&&el.lat!=null&&el.lon!=null&&el.tags?.name){features.push({type:'Feature',properties:{kind:'place',place:el.tags.place||'',name:el.tags.name},geometry:{type:'Point',coordinates:[el.lon,el.lat]}})}
    }
    return{version:1,signature:sig,bounds,downloadedAt:Date.now(),geojson:{type:'FeatureCollection',features}}
  }
  async function download(bounds,sig){
    notify('Pobieranie mapy offline dla obszaru tras…');
    const [s,w,n,e]=bounds,q=`[out:json][timeout:60];(way["highway"~"^(motorway|motorway_link|trunk|trunk_link|primary|primary_link|secondary|secondary_link|tertiary|tertiary_link|unclassified|residential|living_street|service)$"](${s},${w},${n},${e});node["place"~"^(city|town|village|suburb|neighbourhood)$"](${s},${w},${n},${e}););out geom;`;
    const res=await fetch(OVERPASS,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded;charset=UTF-8'},body:'data='+encodeURIComponent(q)});if(!res.ok)throw Error(`HTTP ${res.status}`);
    const data=await res.json(),mapData=toGeoJson(data,bounds,sig);await dbPut(mapData);notify('Mapa offline zapisana w telefonie.',true);window.dispatchEvent(new CustomEvent('trasy-offline-map-ready',{detail:mapData}));return mapData
  }
  async function ensure(){
    const coords=readRouteCoords(),bounds=boundsFor(coords);if(!bounds)return null;const sig=signature(bounds),saved=await dbGet().catch(()=>null);if(saved?.signature===sig&&saved.geojson?.features?.length)return saved;
    try{return await download(bounds,sig)}catch(e){notify('Nie udało się pobrać mapy offline. Mapa będzie dostępna online.',true);return saved||null}
  }
  async function waitForRoutes(){for(let i=0;i<40;i++){if(readRouteCoords().length)return ensure();await new Promise(r=>setTimeout(r,750))}return null}
  window.TrasyOfflineMap={get:()=>readyPromise||(readyPromise=ensure()),refresh:()=>readyPromise=ensure(),read:dbGet};
  readyPromise=waitForRoutes();
})();