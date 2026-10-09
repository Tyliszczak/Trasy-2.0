const DEFAULT_SHEETS_URL='https://script.google.com/macros/s/AKfycbyQcnU6xvvrUZNVUJRhQ293L47hZwlvsc6i3n9s9hiYqhLUAoKSqGbPohe_lSB0apfUcw/exec';
const ALLOWED_ORIGINS=new Set([
  'https://trasy.tyli.pl',
  'https://trasy-2-0.pages.dev',
  'https://test.trasy-2-0.pages.dev',
  'https://agent-auto-diagnostics-2-0-2.trasy-2-0.pages.dev'
]);
const PREVIEW_ORIGIN=/^https:\/\/[a-z0-9-]+\.trasy-2-0\.pages\.dev$/i;
const MAX_REQUEST_BYTES=512*1024;
const MAX_UPSTREAM_BYTES=32*1024;
const MAX_EVENTS=500;
const AI_MODEL='@cf/meta/llama-3.1-8b-instruct';

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

function diagnosticsSummary(events){
  const types={};let gps=0;let accuracyTotal=0;let accuracyCount=0;
  for(const event of events){
    types[event.type]=(types[event.type]||0)+1;
    if(event.type==='gps-fix'){
      gps++;
      const accuracy=Number(event.detail?.accuracy);
      if(Number.isFinite(accuracy)){accuracyTotal+=accuracy;accuracyCount++}
    }
  }
  const durationMs=Math.max(0,Number(events.at(-1)?.elapsedMs||0)-Number(events[0]?.elapsedMs||0));
  return{
    eventCount:events.length,gpsFixCount:gps,
    averageGpsAccuracyMeters:accuracyCount?Math.round(accuracyTotal/accuracyCount):null,
    durationSeconds:Math.round(durationMs/1000),
    eventTypes:types,
    hasResume:Boolean(types['application-use-resumed']||types['trasy:navigation-resumed']),
    hasStopTransition:Boolean(types['trasy:stop-transition']||types['gps-next-stop-change']),
    hasErrors:Boolean(types['window-error']||types['unhandled-rejection']||types['gps-error']||types['trasy:gps-refresh-failed'])
  };
}

function localQuality(summary){
  const reasons=[];
  if(summary.gpsFixCount<8)reasons.push('Za mało próbek GPS.');
  if(summary.averageGpsAccuracyMeters!==null&&summary.averageGpsAccuracyMeters>80)reasons.push('Dokładność GPS jest słaba.');
  if(!summary.hasResume)reasons.push('Brakuje zdarzenia wznowienia po tle.');
  if(!summary.hasStopTransition)reasons.push('Brakuje zmiany aktywnego przystanku.');
  const useful=summary.gpsFixCount>=8&&summary.averageGpsAccuracyMeters!==null&&summary.averageGpsAccuracyMeters<=80;
  return{source:'heuristic',useful,score:useful?70:35,reasons,recommendation:useful?'Materiał nadaje się do analizy.':'Wykonaj dłuższy przejazd z włączonym GPS i wznowieniem aplikacji.'};
}

function parseAiQuality(value,fallback){
  try{
    const parsed=JSON.parse(String(value||'').replace(/^```json\s*|```$/g,'').trim());
    if(typeof parsed?.useful!=='boolean')return fallback;
    return{
      source:'workers-ai',useful:parsed.useful,score:Math.max(0,Math.min(100,Math.round(Number(parsed.score)||0))),
      reasons:Array.isArray(parsed.reasons)?parsed.reasons.map(reason=>text(reason,180)).slice(0,4):[],
      recommendation:text(parsed.recommendation,240)||fallback.recommendation
    };
  }catch{return fallback}
}

async function evaluateQuality(env,events){
  const summary=diagnosticsSummary(events);
  const fallback=localQuality(summary);
  return{...fallback,aiAvailable:Boolean(env?.AI?.run),summary};
}

function resumeCandidate(events){
  const event=[...events].reverse().find(item=>item.type==='resume-candidates');
  const detail=event?.detail;
  if(!detail||typeof detail!=='object'||!Array.isArray(detail.candidates))return null;
  const candidates=detail.candidates
    .map(item=>({index:Math.trunc(Number(item?.index)),distanceMeters:Math.max(0,Math.round(Number(item?.distanceMeters))),headingDifference:item?.headingDifference===null?null:Math.max(0,Math.min(180,Math.round(Number(item?.headingDifference))))}))
    .filter(item=>Number.isInteger(item.index)&&Number.isFinite(item.distanceMeters)).slice(0,5);
  const currentIndex=Math.trunc(Number(detail.currentIndex));
  const resumeId=text(detail.resumeId,100);
  if(!resumeId||!Number.isInteger(currentIndex)||!candidates.some(item=>item.index===currentIndex))return null;
  return{resumeId,currentIndex,inactiveSeconds:Math.max(0,Math.min(86400,Math.round(Number(detail.inactiveSeconds)||0))),accuracyMeters:Math.max(0,Math.min(500,Math.round(Number(detail.accuracyMeters)||0))),speedKmh:Math.max(0,Math.min(160,Math.round(Number(detail.speedKmh)||0))),headingReliable:Boolean(detail.headingReliable),candidates};
}

function localResumeRecommendation(input){
  const directed=input.headingReliable?input.candidates.filter(item=>item.headingDifference!==null&&item.headingDifference<=95):[];
  const best=(directed.length?directed:input.candidates).slice().sort((a,b)=>a.distanceMeters-b.distanceMeters||a.index-b.index)[0];
  const confidence=best?.index>input.currentIndex&&input.accuracyMeters<=70&&(best.headingDifference===null||best.headingDifference<=70)?72:45;
  return{resumeId:input.resumeId,targetIndex:best?.index??input.currentIndex,confidence,source:'heuristic',rationale:'Wybór awaryjny oparty na odległości i kierunku.'};
}

async function evaluateResumeRecommendation(env,events){
  const input=resumeCandidate(events);if(!input)return null;
  const fallback=localResumeRecommendation(input);
  if(!env?.AI?.run)return fallback;
  try{
    // Model dostaje wyłącznie względne miary kandydatów, nigdy GPS ani nazw przystanków.
    const prompt=`Jesteś asystentem wyboru następnego przystanku po wznowieniu nawigacji. Zwróć WYŁĄCZNIE JSON {"targetIndex":number,"confidence":0-100,"rationale":string}. Wybieraj wyłącznie indeks z candidates. Nie cofaj poniżej currentIndex. Wysoką pewność (>=85) dawaj wyłącznie gdy kierunek, odległość i czas nieaktywności jednoznacznie wskazują, że minął co najmniej jeden przystanek. Dane: ${JSON.stringify(input)}`;
    const response=await env.AI.run(AI_MODEL,{prompt});
    const parsed=JSON.parse(String(response?.response||response?.result?.response||'').replace(/^```json\s*|```$/g,'').trim());
    const targetIndex=Math.trunc(Number(parsed?.targetIndex));
    if(!input.candidates.some(item=>item.index===targetIndex)||targetIndex<input.currentIndex)throw new Error('AI_INVALID_TARGET');
    return{resumeId:input.resumeId,targetIndex,confidence:Math.max(0,Math.min(100,Math.round(Number(parsed.confidence)||0))),source:'workers-ai',rationale:text(parsed.rationale,240)||'AI wskazało kandydata na podstawie ruchu i czasu przerwy.'};
  }catch(error){
    console.warn(JSON.stringify({event:'resume-stop-ai-failed',message:String(error?.message||error).slice(0,180)}));
    return fallback;
  }
}

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
  if(!ALLOWED_ORIGINS.has(origin)&&!PREVIEW_ORIGIN.test(origin))return json({status:'error',message:'ORIGIN_NOT_ALLOWED'},403);
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
    const deviceLabel=text(input.deviceLabel,80);
    const appVersion=text(input.appVersion,24);
    const sessionId=text(input.sessionId,180);
    const uploadErrors=Array.isArray(input.uploadErrors)?input.uploadErrors.slice(0,20):[];
    if(!validId(batchId)||!validId(installationId,100)||/[\u0000-\u001F\u007F]/.test(deviceLabel)||!/^2\.0\.\d+$/.test(appVersion)||!validId(sessionId))return json({status:'error',message:'INVALID_METADATA'},400);
    if(!Array.isArray(input.events)||!input.events.length||input.events.length>MAX_EVENTS)return json({status:'error',message:'INVALID_EVENT_COUNT'},400);
    const events=input.events.map(sanitizeEvent);
    if(events.some(event=>!event))return json({status:'error',message:'INVALID_EVENT'},400);
    if(events.some(event=>event.sessionId!==sessionId))return json({status:'error',message:'MIXED_SESSION'},400);
    if(events.some((event,index)=>index>0&&event.id<=events[index-1].id))return json({status:'error',message:'EVENT_IDS_NOT_INCREASING'},400);

    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),25000);
    try{
      const upstream=await fetch(env.DIAGNOSTICS_SHEETS_URL||DEFAULT_SHEETS_URL,{
        method:'POST',
        headers:{'Content-Type':'application/json','Accept':'application/json'},
        body:JSON.stringify({
          action:'appendTestDiagnostics',
          secret:env.DIAGNOSTICS_SHARED_SECRET,
          batchId,installationId,deviceLabel,appVersion,sessionId,uploadErrors,events
        }),
        redirect:'follow',signal:controller.signal
      });
      if(!upstream.ok)return json({status:'error',message:'SHEETS_UPSTREAM_ERROR'},502);
      const result=await readJsonLimited(upstream);
      if(result?.status!=='success')return json({status:'error',message:'SHEETS_REJECTED'},502);
      const diagnosticsQuality=await evaluateQuality(env,events);
      const resumeRecommendation=await evaluateResumeRecommendation(env,events);
      return json({
        status:'success',batchId,duplicate:Boolean(result.duplicate),
        acceptedEvents:Number(result.acceptedEvents)||0,
        duplicateEvents:Number(result.duplicateEvents)||0,
        diagnosticsQuality,resumeRecommendation
      });
    }finally{clearTimeout(timeout)}
  }catch(error){
    const code=error?.name==='AbortError'?'SHEETS_TIMEOUT':'DIAGNOSTICS_UPLOAD_FAILED';
    console.error(JSON.stringify({event:'test-diagnostics-error',code,message:String(error?.message||error).slice(0,300)}));
    return json({status:'error',message:code},502);
  }
}
