const DEFAULT_SHEETS_URL='https://script.google.com/macros/s/AKfycbyQcnU6xvvrUZNVUJRhQ293L47hZwlvsc6i3n9s9hiYqhLUAoKSqGbPohe_lSB0apfUcw/exec';
const ALLOWED_ORIGINS=new Set(['https://trasy.tyli.pl','https://trasy-2-0.pages.dev']);
const MAX_REQUEST_BYTES=64*1024;
const MAX_UPSTREAM_BYTES=32*1024;
const MAX_EVENTS=40;

function json(body,status=200){
  return new Response(JSON.stringify(body),{status,headers:{
    'Content-Type':'application/json; charset=utf-8',
    'Cache-Control':'no-store, max-age=0',
    'X-Content-Type-Options':'nosniff',
    'Referrer-Policy':'no-referrer'
  }});
}

function text(value,max=160){return String(value??'').trim().slice(0,max)}
function validId(value,max=180){return /^[A-Za-z0-9:._-]+$/.test(value)&&value.length<=max}

function sanitizeEvent(event){
  if(!event||typeof event!=='object'||Array.isArray(event))return null;
  const id=Number(event.id);
  const at=text(event.at,40);
  const type=text(event.type,80);
  const sessionId=text(event.sessionId,180);
  if(!Number.isSafeInteger(id)||id<1||!validId(sessionId)||!/^\d{4}-\d{2}-\d{2}T/.test(at)||!validId(type,80))return null;
  return{
    id,sessionId,at,type,
    elapsedMs:Math.max(0,Math.min(86400000,Number(event.elapsedMs)||0)),
    snapshot:event.snapshot&&typeof event.snapshot==='object'?event.snapshot:{},
    detail:event.detail&&typeof event.detail==='object'?event.detail:{}
  };
}

async function readJsonLimited(response){
  if(!response.body)return{};
  const reader=response.body.getReader();
  const decoder=new TextDecoder();
  let size=0,body='';
  while(true){
    const {done,value}=await reader.read();
    if(done)break;
    size+=value.byteLength;
    if(size>MAX_UPSTREAM_BYTES){await reader.cancel();throw new Error('UPSTREAM_RESPONSE_TOO_LARGE')}
    body+=decoder.decode(value,{stream:true});
  }
  body+=decoder.decode();
  return JSON.parse(body||'{}');
}

export async function onRequest({request,env}){
  if(request.method!=='POST')return json({status:'error',message:'METHOD_NOT_ALLOWED'},405);
  const origin=request.headers.get('Origin')||'';
  if(!ALLOWED_ORIGINS.has(origin))return json({status:'error',message:'ORIGIN_NOT_ALLOWED'},403);
  if(!String(request.headers.get('Content-Type')||'').toLowerCase().startsWith('application/json'))return json({status:'error',message:'CONTENT_TYPE_REQUIRED'},415);
  const declared=Number(request.headers.get('Content-Length')||0);
  if(declared>MAX_REQUEST_BYTES)return json({status:'error',message:'PAYLOAD_TOO_LARGE'},413);
  if(!env?.DIAGNOSTICS_SHARED_SECRET)return json({status:'error',message:'DIAGNOSTICS_NOT_CONFIGURED'},503);

  try{
    const raw=await request.text();
    if(new TextEncoder().encode(raw).byteLength>MAX_REQUEST_BYTES)return json({status:'error',message:'PAYLOAD_TOO_LARGE'},413);
    const input=JSON.parse(raw||'{}');
    const batchId=text(input.batchId,180);
    const installationId=text(input.installationId,100);
    const appVersion=text(input.appVersion,24);
    const sessionId=text(input.sessionId,180);
    if(!validId(batchId)||!validId(installationId,100)||!/^2\.0\.\d+$/.test(appVersion)||!validId(sessionId))return json({status:'error',message:'INVALID_METADATA'},400);
    if(!Array.isArray(input.events)||!input.events.length||input.events.length>MAX_EVENTS)return json({status:'error',message:'INVALID_EVENT_COUNT'},400);
    const events=input.events.map(sanitizeEvent);
    if(events.some(event=>!event))return json({status:'error',message:'INVALID_EVENT'},400);
    if(events.some(event=>event.sessionId!==sessionId))return json({status:'error',message:'MIXED_SESSION'},400);

    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),10000);
    try{
      const upstream=await fetch(env.DIAGNOSTICS_SHEETS_URL||DEFAULT_SHEETS_URL,{
        method:'POST',
        headers:{'Content-Type':'application/json','Accept':'application/json'},
        body:JSON.stringify({
          action:'appendTestDiagnostics',
          secret:env.DIAGNOSTICS_SHARED_SECRET,
          batchId,installationId,appVersion,sessionId,events
        }),
        redirect:'follow',signal:controller.signal
      });
      if(!upstream.ok)return json({status:'error',message:'SHEETS_UPSTREAM_ERROR'},502);
      const result=await readJsonLimited(upstream);
      if(result?.status!=='success')return json({status:'error',message:'SHEETS_REJECTED'},502);
      return json({status:'success',batchId,duplicate:Boolean(result.duplicate)});
    }finally{clearTimeout(timeout)}
  }catch(error){
    const code=error?.name==='AbortError'?'SHEETS_TIMEOUT':'DIAGNOSTICS_UPLOAD_FAILED';
    console.error(JSON.stringify({event:'test-diagnostics-error',code,message:String(error?.message||error).slice(0,300)}));
    return json({status:'error',message:code},502);
  }
}
