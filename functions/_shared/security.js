const DEFAULT_ALLOWED_HOSTS=['trasy.tyli.pl','trasy-2-0.pages.dev','.trasy-2-0.pages.dev'];

export const FUNCTION_SECURITY_HEADERS={
  'Strict-Transport-Security':'max-age=31536000; includeSubDomains',
  'X-Content-Type-Options':'nosniff',
  'X-Frame-Options':'DENY',
  'Referrer-Policy':'no-referrer',
  'Permissions-Policy':'camera=(), microphone=(), payment=(), usb=()',
  'Cross-Origin-Resource-Policy':'same-origin',
  'X-Robots-Tag':'noindex, nofollow'
};

function allowedHosts(env){
  const configured=String(env?.TRASY_ALLOWED_HOSTS||'').split(',').map(value=>value.trim().toLowerCase()).filter(Boolean);
  return new Set(configured.length?configured:DEFAULT_ALLOWED_HOSTS);
}

function hostAllowed(hostname,rules){
  const host=hostname.toLowerCase();
  return [...rules].some(rule=>rule.startsWith('.')?host.endsWith(rule):host===rule);
}

export function requestAllowed(request,env,{testOnly=false}={}){
  let url;
  try{url=new URL(request.url)}catch{return false}
  const hosts=allowedHosts(env);
  if(!hostAllowed(url.hostname,hosts))return false;
  if(testOnly&&!hostAllowed(url.hostname,new Set(DEFAULT_ALLOWED_HOSTS)))return false;
  const origin=request.headers.get('Origin');
  if(origin){try{return new URL(origin).origin===url.origin}catch{return false}}
  const referer=request.headers.get('Referer');
  if(referer){try{return new URL(referer).origin===url.origin}catch{return false}}
  return request.headers.get('Sec-Fetch-Site')==='same-origin';
}

export function secureHeaders(headers={}){
  const result=new Headers(headers);
  for(const [name,value] of Object.entries(FUNCTION_SECURITY_HEADERS))result.set(name,value);
  return result;
}

export function secureResponse(response){
  return new Response(response.body,{status:response.status,statusText:response.statusText,headers:secureHeaders(response.headers)});
}

export function securityJson(body,status=200,headers={}){
  return new Response(JSON.stringify(body),{
    status,
    headers:secureHeaders({'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store, max-age=0',...headers})
  });
}
