import test from 'node:test';
import assert from 'node:assert/strict';
import {onRequest} from '../functions/diagnostics-alert.js';

const request=(body,origin='https://trasy.tyli.pl')=>new Request('https://trasy.tyli.pl/diagnostics-alert',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(body)});
const payload={alertId:'alert-1',installationId:'installation-1',deviceLabel:'Telefon',appVersion:'2.0.217',sessionId:'session-1',failedReports:3,latestError:'timeout'};

test('niezależny alert odrzuca obce źródło i brak konfiguracji',async()=>{
  assert.equal((await onRequest({request:request(payload,'https://evil.example'),env:{}})).status,403);
  assert.equal((await onRequest({request:request(payload),env:{}})).status,503);
});

test('niezależny alert wysyła małą wiadomość przez Cloudflare REST API',async()=>{
  const originalFetch=globalThis.fetch;let sent=null;
  globalThis.fetch=async(url,options)=>{sent={url,options};return new Response(JSON.stringify({success:true,result:{message_id:'email-1'}}),{status:200,headers:{'Content-Type':'application/json'}})};
  try{
    const response=await onRequest({request:request(payload),env:{CLOUDFLARE_API_TOKEN:'token',CLOUDFLARE_ACCOUNT_ID:'account-1',DIAGNOSTICS_ALERT_EMAIL:'owner@example.com',DIAGNOSTICS_ALERT_FROM:'alerts@example.com'}});
    assert.equal(response.status,200);
    assert.equal(sent.url,'https://api.cloudflare.com/client/v4/accounts/account-1/email/sending/send');
    assert.equal(sent.options.headers.Authorization,'Bearer token');
    const body=JSON.parse(sent.options.body);assert.deepEqual(body.to,['owner@example.com']);assert.equal(body.from,'alerts@example.com');assert.match(body.text,/timeout/);
  }finally{globalThis.fetch=originalFetch}
});
