import test from'node:test';
import assert from'node:assert/strict';
import{onRequest}from'../functions/test-diagnostics.js';

const origin='https://trasy.tyli.pl';
const event={id:1,sessionId:'session-1',at:'2026-09-02T10:00:00.000Z',type:'gps-fix',elapsedMs:10,snapshot:{route:'TopPoint'},detail:{latitude:51.9,longitude:15.5}};
const payload={batchId:'install-1:1-1',installationId:'installation-123456',appVersion:'2.0.194',sessionId:'session-1',events:[event]};
const request=(body=payload,headers={})=>new Request('https://trasy.tyli.pl/test-diagnostics',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',...headers},body:JSON.stringify(body)});

test('endpoint diagnostyki odrzuca obce źródło i brak sekretu serwera',async()=>{
  const foreign=new Request('https://trasy.tyli.pl/test-diagnostics',{method:'POST',headers:{Origin:'https://evil.example','Content-Type':'application/json'},body:'{}'});
  assert.equal((await onRequest({request:foreign,env:{}})).status,403);
  assert.equal((await onRequest({request:request(),env:{}})).status,503);
});

test('endpoint waliduje paczkę i przekazuje sekret wyłącznie do Apps Script',async()=>{
  const originalFetch=globalThis.fetch;
  let forwarded=null;
  globalThis.fetch=async(_url,options)=>{
    forwarded=JSON.parse(options.body);
    return new Response(JSON.stringify({status:'success',duplicate:false}),{status:200,headers:{'Content-Type':'application/json'}});
  };
  try{
    const response=await onRequest({request:request(),env:{DIAGNOSTICS_SHARED_SECRET:'server-only-secret',DIAGNOSTICS_SHEETS_URL:'https://script.google.test/exec'}});
    assert.equal(response.status,200);
    assert.equal((await response.json()).status,'success');
    assert.equal(forwarded.secret,'server-only-secret');
    assert.equal(forwarded.action,'appendTestDiagnostics');
    assert.equal(forwarded.events.length,1);
  }finally{globalThis.fetch=originalFetch}
});

test('endpoint nie przyjmuje mieszanych sesji ani zbyt wielu zdarzeń',async()=>{
  const mixed={...payload,events:[event,{...event,id:2,sessionId:'other'}]};
  assert.equal((await onRequest({request:request(mixed),env:{DIAGNOSTICS_SHARED_SECRET:'x'}})).status,400);
  const tooMany={...payload,events:Array.from({length:41},(_,index)=>({...event,id:index+1}))};
  assert.equal((await onRequest({request:request(tooMany),env:{DIAGNOSTICS_SHARED_SECRET:'x'}})).status,400);
});
