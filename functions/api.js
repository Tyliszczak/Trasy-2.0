import {secureHeaders} from './_shared/security.js';

const COOKIE={driver:'__Host-kursy_driver',refresh:'__Host-kursy_driver_refresh'};
const PUBLIC_ACTIONS=new Set(['driverStatus','activateDriverDevice','refreshDriverSession']);
const SESSION_ACTIONS=new Set([
  'driverStatus','driverRoutes','driverVehicles','driverParkings','driverComputeRoute',
  'driverFeedback','recordPunctuality'
]);
const ALLOWED_ACTIONS=new Set([...PUBLIC_ACTIONS,...SESSION_ACTIONS]);

const json=(body,status=200,headers=new Headers())=>{
  headers.set('Content-Type','application/json; charset=utf-8');
  headers.set('Cache-Control','no-store, max-age=0');
  headers.set('Pragma','no-cache');
  return new Response(JSON.stringify(body),{status,headers:secureHeaders(headers)});
};
const parseCookies=request=>Object.fromEntries((request.headers.get('Cookie')||'').split(';').map(value=>value.trim()).filter(Boolean).map(value=>{
  const index=value.indexOf('=');
  return [decodeURIComponent(index<0?value:value.slice(0,index)),decodeURIComponent(index<0?'':value.slice(index+1))];
}));
const cookie=(name,value,maxAge)=>`${name}=${encodeURIComponent(value)}; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=${Math.max(0,Math.floor(maxAge))}`;
const ttl=expiresAt=>Math.max(0,Math.floor((new Date(expiresAt).getTime()-Date.now())/1000));

function configured(env){
  if(!env?.UPSTREAM_API_URL||!env?.APP_ORIGIN||!env?.GATEWAY_SHARED_SECRET)throw Object.assign(new Error('Brama API nie jest skonfigurowana.'),{status:503,code:'GATEWAY_NOT_CONFIGURED'});
  let upstream,origin;
  try{upstream=new URL(env.UPSTREAM_API_URL);origin=new URL(env.APP_ORIGIN)}catch{throw Object.assign(new Error('Konfiguracja bramy jest nieprawidłowa.'),{status:503,code:'GATEWAY_INVALID_CONFIG'})}
  if(upstream.protocol!=='https:'||origin.protocol!=='https:'||origin.origin!==String(env.APP_ORIGIN).replace(/\/$/,''))throw Object.assign(new Error('Konfiguracja bramy jest nieprawidłowa.'),{status:503,code:'GATEWAY_INVALID_CONFIG'});
  if(new TextEncoder().encode(String(env.GATEWAY_SHARED_SECRET)).length<32)throw Object.assign(new Error('Sekret bramy jest zbyt krótki.'),{status:503,code:'GATEWAY_WEAK_SECRET'});
}
function sameOrigin(request,env){
  const allowed=String(env.APP_ORIGIN).replace(/\/$/,'');
  const origin=String(request.headers.get('Origin')||'').replace(/\/$/,'');
  const fetchSite=request.headers.get('Sec-Fetch-Site');
  if(origin!==allowed||!['same-origin','none',null].includes(fetchSite))throw Object.assign(new Error('Niedozwolone źródło żądania.'),{status:403,code:'ORIGIN_REJECTED'});
}
function injectSession(action,payload,cookies){
  const next={...payload};
  if(SESSION_ACTIONS.has(action))next.driverSessionToken=cookies[COOKIE.driver]||'';
  if(action==='refreshDriverSession')next.refreshToken=cookies[COOKIE.refresh]||'';
  return next;
}
function protectTokens(action,data){
  const headers=new Headers();
  if(['activateDriverDevice','refreshDriverSession'].includes(action)&&data?.driverSession?.token){
    const session=data.driverSession;
    headers.append('Set-Cookie',cookie(COOKIE.driver,session.token,ttl(session.expiresAt)));
    headers.append('Set-Cookie',cookie(COOKIE.refresh,session.refreshToken,ttl(session.refreshExpiresAt)));
    data={...data,driverSession:{companyId:session.companyId,driverId:session.driverId,deviceId:session.deviceId,expiresAt:session.expiresAt,refreshExpiresAt:session.refreshExpiresAt,absoluteExpiresAt:session.absoluteExpiresAt,cookie:true}};
  }
  return {headers,data};
}

export async function onRequestPost({request,env}){
  try{
    configured(env);sameOrigin(request,env);
    const raw=await request.text();
    if(raw.length>250_000)return json({ok:false,code:'REQUEST_TOO_LARGE',message:'Żądanie jest zbyt duże.'},413);
    const body=JSON.parse(raw||'{}'),action=String(body.action||'');
    if(!ALLOWED_ACTIONS.has(action))return json({ok:false,code:'ACTION_NOT_ALLOWED',message:'Ta operacja nie jest dostępna w aplikacji kierowcy.'},403);
    const payload=injectSession(action,body.payload&&typeof body.payload==='object'?body.payload:{},parseCookies(request));
    const upstream=await fetch(env.UPSTREAM_API_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action,payload,gatewaySecret:env.GATEWAY_SHARED_SECRET}),redirect:'follow'});
    const data=await upstream.json().catch(()=>({ok:false,code:'INVALID_UPSTREAM_RESPONSE',message:'Backend zwrócił nieprawidłową odpowiedź.'}));
    const secured=protectTokens(action,data);
    return json(secured.data,upstream.ok?200:502,secured.headers);
  }catch(error){
    return json({ok:false,code:error.code||'GATEWAY_ERROR',message:error.status?'Żądanie zostało odrzucone.':'Brama API jest chwilowo niedostępna.'},error.status||500);
  }
}

export function onRequestGet(){return json({ok:true,service:'trasy-driver-gateway',version:'1.0.0'})}
export function onRequestOptions(){return new Response(null,{status:204,headers:secureHeaders({Allow:'GET, POST, OPTIONS','Cache-Control':'no-store'})})}
