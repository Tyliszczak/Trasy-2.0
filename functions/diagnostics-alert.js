const ALLOWED_ORIGINS=new Set(['https://trasy.tyli.pl','https://trasy-2-0.pages.dev']);

function json(body,status=200){
  return new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store, max-age=0','X-Content-Type-Options':'nosniff'}});
}
function text(value,max=180){return String(value??'').replace(/[\u0000-\u001F\u007F]/g,' ').trim().slice(0,max)}
function validId(value,max=180){return /^[A-Za-z0-9:._-]+$/.test(value)&&value.length<=max}

export async function onRequest({request,env}){
  if(request.method!=='POST')return json({status:'error',message:'METHOD_NOT_ALLOWED'},405);
  if(!ALLOWED_ORIGINS.has(request.headers.get('Origin')||''))return json({status:'error',message:'ORIGIN_NOT_ALLOWED'},403);
  if(!String(request.headers.get('Content-Type')||'').toLowerCase().startsWith('application/json'))return json({status:'error',message:'CONTENT_TYPE_REQUIRED'},415);
  if(!env?.CLOUDFLARE_API_TOKEN||!env?.CLOUDFLARE_ACCOUNT_ID||!env?.DIAGNOSTICS_ALERT_EMAIL||!env?.DIAGNOSTICS_ALERT_FROM)return json({status:'error',message:'ALERT_NOT_CONFIGURED'},503);
  try{
    const input=await request.json();
    const alertId=text(input.alertId,180),installationId=text(input.installationId,100),deviceLabel=text(input.deviceLabel,80),appVersion=text(input.appVersion,24),sessionId=text(input.sessionId,180),latestError=text(input.latestError,240),failedReports=Math.max(3,Math.min(99,Number(input.failedReports)||0));
    if(!validId(alertId)||!validId(installationId,100)||!validId(sessionId)||!/^[\w .-]+$/.test(deviceLabel)||!/^2\.0\.\d+$/.test(appVersion))return json({status:'error',message:'INVALID_PAYLOAD'},400);
    const body=`Urządzenie: ${deviceLabel}\nWersja: ${appVersion}\nSesja: ${sessionId}\nNieudane raporty z rzędu: ${failedReports}\nOstatni błąd: ${latestError||'nieznany'}`;
    const response=await fetch(`https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(env.CLOUDFLARE_ACCOUNT_ID)}/email/sending/send`,{method:'POST',headers:{Authorization:`Bearer ${env.CLOUDFLARE_API_TOKEN}`,'Content-Type':'application/json'},body:JSON.stringify({from:env.DIAGNOSTICS_ALERT_FROM,to:[env.DIAGNOSTICS_ALERT_EMAIL],subject:'TRASY 2.0 — awaria wysyłki diagnostyki',text:body})});
    let result=null;
    try{result=await response.json()}catch(error){}
    if(!response.ok||result?.success!==true)return json({status:'error',message:'ALERT_PROVIDER_FAILED'},502);
    return json({status:'success',alertId});
  }catch(error){return json({status:'error',message:'ALERT_FAILED'},502)}
}
