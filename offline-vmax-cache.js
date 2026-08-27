const CACHE_NAME='trasy-vmax-v1';
const CACHE_PREFIX='/_offline-vmax/';
const FRESH_MS=24*60*60*1000;
const MAX_STALE_MS=30*24*60*60*1000;
const MAX_ENTRIES=250;

function cacheStorage(){
  return globalThis.caches&&typeof globalThis.caches.open==='function'?globalThis.caches:null;
}

export function vmaxCacheKey(point,origin=globalThis.location?.origin||'https://trasy.invalid'){
  const lat=Number(point?.lat),lon=Number(point?.lon);
  if(!Number.isFinite(lat)||!Number.isFinite(lon))return null;
  return new Request(`${origin}${CACHE_PREFIX}${lat.toFixed(4)}/${lon.toFixed(4)}`,{method:'GET'});
}

async function payload(response){
  try{
    const data=await response.clone().json();
    const storedAt=Number(data?.storedAt);
    if(!Number.isFinite(storedAt)||!Array.isArray(data?.elements))return null;
    return{storedAt,elements:data.elements};
  }catch{return null}
}

export async function readVmaxCache(point,{allowStale=false,now=Date.now()}={}){
  const storage=cacheStorage(),key=vmaxCacheKey(point);
  if(!storage||!key)return null;
  const cache=await storage.open(CACHE_NAME);
  const response=await cache.match(key);
  if(!response)return null;
  const data=await payload(response);
  if(!data)return null;
  const age=Math.max(0,Number(now)-data.storedAt);
  if(age>MAX_STALE_MS){await cache.delete(key);return null}
  if(!allowStale&&age>FRESH_MS)return null;
  return{...data,age,stale:age>FRESH_MS};
}

async function prune(cache){
  const keys=await cache.keys();
  const excess=Math.max(0,keys.length-MAX_ENTRIES);
  if(excess)await Promise.all(keys.slice(0,excess).map(key=>cache.delete(key)));
}

export async function writeVmaxCache(point,elements,{now=Date.now()}={}){
  const storage=cacheStorage(),key=vmaxCacheKey(point);
  if(!storage||!key||!Array.isArray(elements))return false;
  const cache=await storage.open(CACHE_NAME);
  const response=new Response(JSON.stringify({storedAt:Number(now),elements}),{
    status:200,
    headers:{'Content-Type':'application/json','X-Trasy-Vmax-Cache':'1'}
  });
  await cache.put(key,response);
  await prune(cache);
  return true;
}

export async function clearVmaxCache(){
  const storage=cacheStorage();
  return storage?storage.delete(CACHE_NAME):false;
}

export const VMAX_CACHE={name:CACHE_NAME,freshMs:FRESH_MS,maxStaleMs:MAX_STALE_MS,maxEntries:MAX_ENTRIES};
