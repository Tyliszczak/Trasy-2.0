const PTV_ORIGIN='https://api.myptv.com';
const TILE_PATHS=[
  /^maps\/v1\/vector-tiles\/\d+\/\d+\/\d+$/,
  /^maps\/overlays\/v1\/vector-tiles\/\d+\/\d+\/\d+$/
];
const MAPMATCH_PATH=/^mapmatch\/v1\/positions\/(-?\d+(?:\.\d+)?)\/(-?\d+(?:\.\d+)?)$/;

function json(body,status=200){
  return new Response(JSON.stringify(body),{
    status,
    headers:{
      'Content-Type':'application/json; charset=utf-8',
      'Cache-Control':'no-store, max-age=0',
      'X-Content-Type-Options':'nosniff'
    }
  });
}

function pathFromParams(params){
  const raw=Array.isArray(params?.path)?params.path.join('/'):String(params?.path||'');
  return raw.replace(/^\/+|\/+$/g,'');
}

function mapMatch(path){
  const match=path.match(MAPMATCH_PATH);
  if(!match)return false;
  const lat=Number(match[1]),lon=Number(match[2]);
  return Number.isFinite(lat)&&lat>=-90&&lat<=90&&Number.isFinite(lon)&&lon>=-180&&lon<=180;
}

function allowedPath(path){
  return TILE_PATHS.some(pattern=>pattern.test(path))||mapMatch(path);
}

function copyResponseHeaders(upstream,isMapMatch){
  const headers=new Headers();
  for(const name of ['content-type','cache-control','etag','last-modified','expires','vary']){
    const value=upstream.headers.get(name);
    if(value)headers.set(name,value);
  }
  headers.set('X-Content-Type-Options','nosniff');
  headers.set('X-Trasy-Map-Provider','ptv');
  if(isMapMatch)headers.set('X-Trasy-Speed-Provider','ptv');
  return headers;
}

async function handleGet({request,env,params}){
  const apiKey=String(env?.PTV_API_KEY||'').trim();
  if(!apiKey)return json({ok:false,code:'PTV_MAP_NOT_CONFIGURED'},503);

  const path=pathFromParams(params);
  if(!allowedPath(path))return json({ok:false,code:'PTV_MAP_PATH_REJECTED'},404);
  if(request.url.length>1800)return json({ok:false,code:'PTV_MAP_REQUEST_TOO_LONG'},414);

  const incoming=new URL(request.url);
  const isMapMatch=mapMatch(path);
  const target=new URL(`${PTV_ORIGIN}/${path}`);

  if(isMapMatch){
    target.searchParams.set('results','SEGMENT_ATTRIBUTES');
    target.searchParams.set('calculationMode','QUALITY');
    const heading=Number(incoming.searchParams.get('heading'));
    if(Number.isFinite(heading)&&heading>=0&&heading<=360)target.searchParams.set('heading',String(heading));
  }else{
    for(const [key,value] of incoming.searchParams){
      if(key.toLowerCase()==='apikey')continue;
      target.searchParams.append(key,value);
    }
  }

  try{
    const upstream=await fetch(target.toString(),{
      method:'GET',
      headers:{
        ApiKey:apiKey,
        Accept:isMapMatch?'application/json':request.headers.get('Accept')||'application/vnd.mapbox-vector-tile,application/x-protobuf,*/*'
      },
      redirect:'follow'
    });
    if(!upstream.ok){
      return json({ok:false,code:isMapMatch?'PTV_SPEEDMAX_UPSTREAM_ERROR':'PTV_MAP_UPSTREAM_ERROR',status:upstream.status},upstream.status>=500?502:upstream.status);
    }
    return new Response(upstream.body,{status:upstream.status,headers:copyResponseHeaders(upstream,isMapMatch)});
  }catch{
    return json({ok:false,code:isMapMatch?'PTV_SPEEDMAX_UNAVAILABLE':'PTV_MAP_UNAVAILABLE'},502);
  }
}

export async function onRequest(context){
  if(context.request.method!=='GET')return json({ok:false,code:'METHOD_NOT_ALLOWED'},405);
  return handleGet(context);
}
