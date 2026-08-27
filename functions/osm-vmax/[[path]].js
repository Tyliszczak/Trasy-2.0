const OVERPASS_ENDPOINTS=[
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter'
];
const PATH_PATTERN=/^(-?\d+(?:\.\d+)?)\/(-?\d+(?:\.\d+)?)$/;
const QUERY_RADIUS_METERS=120;
// Oba źródła muszą zmieścić się w 10-sekundowym limicie klienta.
const REQUEST_TIMEOUT_MS=4000;
const MAX_RESPONSE_BYTES=2_000_000;
const MAX_WAYS=100;
const MAX_GEOMETRY_POINTS=6000;
const CACHE_SECONDS=120;
const DRIVABLE='motorway|motorway_link|trunk|trunk_link|primary|primary_link|secondary|secondary_link|tertiary|tertiary_link|unclassified|residential|living_street|service|road';
const SAFE_TAGS=new Set([
  'highway','maxspeed','maxspeed:forward','maxspeed:backward','maxspeed:type',
  'source:maxspeed','zone:maxspeed','maxspeed:conditional','maxspeed:bus',
  'oneway','name','ref'
]);

function json(body,status=200,headers={}){
  return new Response(JSON.stringify(body),{
    status,
    headers:{
      'Content-Type':'application/json; charset=utf-8',
      'Cache-Control':'no-store, max-age=0',
      'X-Content-Type-Options':'nosniff',
      'X-Robots-Tag':'noindex',
      ...headers
    }
  });
}

function pathFromParams(params){
  const raw=Array.isArray(params?.path)?params.path.join('/'):String(params?.path||'');
  return raw.replace(/^\/+|\/+$/g,'');
}

function coordinates(path){
  const match=path.match(PATH_PATTERN);
  if(!match)return null;
  const lat=Number(match[1]),lon=Number(match[2]);
  if(!Number.isFinite(lat)||lat<-90||lat>90||!Number.isFinite(lon)||lon<-180||lon>180)return null;
  return{lat,lon};
}

function isAllowedOrigin(request){
  const origin=request.headers.get('Origin');
  if(!origin)return true;
  try{
    return new URL(origin).origin===new URL(request.url).origin;
  }catch{
    return false;
  }
}

function queryText(point){
  return `[out:json][timeout:7];way(around:${QUERY_RADIUS_METERS},${point.lat.toFixed(5)},${point.lon.toFixed(5)})[highway~"^(${DRIVABLE})$"];out tags geom qt;`;
}

async function readJsonWithLimit(response){
  const declared=Number(response.headers.get('content-length'));
  if(Number.isFinite(declared)&&declared>MAX_RESPONSE_BYTES)throw Error('OVERPASS_RESPONSE_TOO_LARGE');
  if(!response.body)return{};

  const reader=response.body.getReader();
  const decoder=new TextDecoder();
  let total=0,text='';
  try{
    while(true){
      const {done,value}=await reader.read();
      if(done)break;
      total+=value.byteLength;
      if(total>MAX_RESPONSE_BYTES){
        await reader.cancel();
        throw Error('OVERPASS_RESPONSE_TOO_LARGE');
      }
      text+=decoder.decode(value,{stream:true});
    }
    text+=decoder.decode();
    return JSON.parse(text);
  }finally{
    reader.releaseLock();
  }
}

function safeTags(tags){
  const result={};
  for(const [key,value] of Object.entries(tags||{})){
    if(SAFE_TAGS.has(key))result[key]=String(value).slice(0,180);
  }
  return result;
}

function sanitizeElements(elements){
  const result=[];
  let points=0;
  for(const element of elements||[]){
    if(result.length>=MAX_WAYS||points>=MAX_GEOMETRY_POINTS)break;
    if(element?.type!=='way'||!element?.tags?.highway||!Array.isArray(element.geometry))continue;
    const geometry=[];
    for(const rawPoint of element.geometry){
      if(points>=MAX_GEOMETRY_POINTS)break;
      const lat=Number(rawPoint?.lat),lon=Number(rawPoint?.lon);
      if(!Number.isFinite(lat)||!Number.isFinite(lon))continue;
      geometry.push({lat,lon});
      points+=1;
    }
    if(geometry.length>=2)result.push({type:'way',id:element.id??null,tags:safeTags(element.tags),geometry});
  }
  return result;
}

function cacheRequest(request,point){
  const url=new URL(request.url);
  url.pathname=`/osm-vmax/${point.lat.toFixed(4)}/${point.lon.toFixed(4)}`;
  url.search='';
  return new Request(url.toString(),{method:'GET'});
}

async function requestOverpass(endpoint,point){
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),REQUEST_TIMEOUT_MS);
  try{
    const response=await fetch(endpoint,{
      method:'POST',
      headers:{
        'Accept':'application/json',
        'Content-Type':'application/x-www-form-urlencoded;charset=UTF-8',
        'User-Agent':'Trasy-2.0 OSM VMAX proxy'
      },
      body:new URLSearchParams({data:queryText(point)}),
      signal:controller.signal
    });
    if(!response.ok)throw Error(`OVERPASS_HTTP_${response.status}`);
    const data=await readJsonWithLimit(response);
    return sanitizeElements(data?.elements);
  }finally{
    clearTimeout(timeout);
  }
}

async function handleGet(context){
  const point=coordinates(pathFromParams(context.params));
  if(!point)return json({ok:false,code:'OSM_VMAX_INVALID_POSITION'},400);

  const key=cacheRequest(context.request,point);
  const cache=globalThis.caches?.default;
  const cached=cache?await cache.match(key):null;
  if(cached){
    const response=new Response(cached.body,cached);
    response.headers.set('X-Trasy-OSM-Cache','HIT');
    return response;
  }

  let lastError=null;
  for(const endpoint of OVERPASS_ENDPOINTS){
    try{
      const elements=await requestOverpass(endpoint,point);
      const response=json({ok:true,elements},200);
      const headers=new Headers(response.headers);
      headers.set('Cache-Control',`public, max-age=${CACHE_SECONDS}`);
      headers.set('X-Trasy-OSM-Cache','MISS');
      const cacheable=new Response(response.body,{status:200,headers});
      if(cache){
        const write=cache.put(key,cacheable.clone());
        if(typeof context.waitUntil==='function')context.waitUntil(write);
        else await write;
      }
      return cacheable;
    }catch(error){
      lastError=error;
    }
  }

  console.error(JSON.stringify({message:'OSM VMAX upstream failed',error:lastError instanceof Error?lastError.message:String(lastError)}));
  return json({ok:false,code:'OSM_VMAX_UNAVAILABLE'},502);
}

export async function onRequest(context){
  if(context.request.method!=='GET')return json({ok:false,code:'METHOD_NOT_ALLOWED'},405);
  if(!isAllowedOrigin(context.request))return json({ok:false,code:'FORBIDDEN_ORIGIN'},403);
  return handleGet(context);
}

