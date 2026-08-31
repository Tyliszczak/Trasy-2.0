import assert from 'node:assert/strict';
import test from 'node:test';
import {onRequestPost} from '../functions/api.js';

const env={UPSTREAM_API_URL:'https://backend.example/exec',APP_ORIGIN:'https://trasy.tyli.pl',GATEWAY_SHARED_SECRET:'a'.repeat(48)};
const request=body=>new Request('https://trasy.tyli.pl/api',{method:'POST',headers:{Origin:env.APP_ORIGIN,'Sec-Fetch-Site':'same-origin','Content-Type':'application/json'},body:JSON.stringify(body)});

test('brama kierowcy odrzuca operacje administratora i właściciela',async()=>{
  for(const action of ['ownerSnapshot','saveRoutes','companySnapshot']){
    const response=await onRequestPost({request:request({action,payload:{}}),env});
    assert.equal(response.status,403);
    assert.equal((await response.json()).code,'ACTION_NOT_ALLOWED');
  }
});

test('token aktywacyjny nie wraca do JavaScriptu, a sesja trafia do ciasteczek HttpOnly',async()=>{
  const previous=globalThis.fetch;
  globalThis.fetch=async()=>new Response(JSON.stringify({ok:true,driver:{id:'driver-a'},company:{id:'company-a',name:'Firma A'},mayUse:true,driverSession:{token:'secret-session',refreshToken:'secret-refresh',companyId:'company-a',driverId:'driver-a',deviceId:'device-a',expiresAt:new Date(Date.now()+3600000).toISOString(),refreshExpiresAt:new Date(Date.now()+86400000).toISOString(),absoluteExpiresAt:new Date(Date.now()+86400000).toISOString()}}),{status:200,headers:{'Content-Type':'application/json'}});
  try{
    const response=await onRequestPost({request:request({action:'activateDriverDevice',payload:{activationToken:'one-time',deviceId:'device-a',fingerprint:'fp-a'}}),env});
    const data=await response.json(),cookies=response.headers.get('set-cookie')||'';
    assert.equal(data.driverSession.token,undefined);
    assert.equal(data.driverSession.refreshToken,undefined);
    assert.match(cookies,/__Host-kursy_driver=/);
    assert.match(cookies,/__Host-kursy_driver_refresh=/);
    assert.match(cookies,/HttpOnly/);
  }finally{globalThis.fetch=previous}
});

test('brama nie przyjmuje żądania z obcej domeny',async()=>{
  const foreign=new Request('https://trasy.tyli.pl/api',{method:'POST',headers:{Origin:'https://evil.example','Sec-Fetch-Site':'cross-site','Content-Type':'application/json'},body:'{}'});
  const response=await onRequestPost({request:foreign,env});
  assert.equal(response.status,403);
  assert.equal((await response.json()).code,'ORIGIN_REJECTED');
});
