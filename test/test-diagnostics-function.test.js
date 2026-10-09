import test from'node:test';
import assert from'node:assert/strict';
import{onRequest}from'../functions/test-diagnostics.js';

const origin='https://trasy.tyli.pl';
const event={id:1,sessionId:'session-1',at:'2026-09-02T10:00:00.000Z',type:'gps-fix',elapsedMs:10,snapshot:{route:'TopPoint'},detail:{latitude:51.9,longitude:15.5}};
const payload={batchId:'install-1:1-1',installationId:'installation-123456',deviceLabel:'Android Chrome 360x800',appVersion:'2.0.194',sessionId:'session-1',events:[event]};
const request=(body=payload,headers={})=>new Request('https://trasy.tyli.pl/test-diagnostics',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',...headers},body:JSON.stringify(body)});

test('endpoint diagnostyki odrzuca obce źródło i brak sekretu serwera',async()=>{
  const foreign=new Request('https://trasy.tyli.pl/test-diagnostics',{method:'POST',headers:{Origin:'https://evil.example','Content-Type':'application/json'},body:'{}'});
  assert.equal((await onRequest({request:foreign,env:{}})).status,403);
  assert.equal((await onRequest({request:request(),env:{}})).status,503);
});

test('endpoint dopuszcza adresy Preview i stały adres testowy',async()=>{
  const originalFetch=globalThis.fetch;
  globalThis.fetch=async()=>new Response(JSON.stringify({status:'success'}),{status:200});
  try{
    for(const source of ['https://agent-auto-diagnostics-2-0-2.trasy-2-0.pages.dev','https://test.trasy-2-0.pages.dev','https://13220385.trasy-2-0.pages.dev']){
      const previewRequest=request(payload,{Origin:source});
      assert.equal((await onRequest({request:previewRequest,env:{DIAGNOSTICS_SHARED_SECRET:'x'}})).status,200);
    }
  }finally{globalThis.fetch=originalFetch}
});

test('endpoint waliduje paczkę i przekazuje sekret wyłącznie do Apps Script',async()=>{
  const originalFetch=globalThis.fetch;
  let forwarded=null;
  globalThis.fetch=async(_url,options)=>{
    forwarded=JSON.parse(options.body);
    return new Response(JSON.stringify({status:'success',duplicate:false,acceptedEvents:1,duplicateEvents:0}),{status:200,headers:{'Content-Type':'application/json'}});
  };
  try{
    const response=await onRequest({request:request(),env:{DIAGNOSTICS_SHARED_SECRET:'server-only-secret',DIAGNOSTICS_SHEETS_URL:'https://script.google.test/exec'}});
    assert.equal(response.status,200);
    const body=await response.json();
    assert.equal(body.status,'success');
    assert.equal(body.diagnosticsQuality.source,'heuristic');
    assert.equal(body.diagnosticsQuality.aiAvailable,false);
    assert.equal(forwarded.secret,'server-only-secret');
    assert.equal(forwarded.action,'appendTestDiagnostics');
    assert.equal(forwarded.deviceLabel,'Android Chrome 360x800');
    assert.deepEqual(forwarded.uploadErrors,[]);
    assert.equal(forwarded.events.length,1);
  }finally{globalThis.fetch=originalFetch}
});

test('AI dostaje wyłącznie podsumowanie techniczne, bez współrzędnych GPS',async()=>{
  const originalFetch=globalThis.fetch;
  let prompt='';
  globalThis.fetch=async()=>new Response(JSON.stringify({status:'success'}),{status:200});
  const AI={run:async(_model,input)=>{prompt=input.prompt;return{response:'{"useful":true,"score":91,"reasons":["GPS i wznowienie są obecne"],"recommendation":"Można analizować sesję."}'}}};
  try{
    const response=await onRequest({request:request(),env:{DIAGNOSTICS_SHARED_SECRET:'x',AI}});
    const body=await response.json();
    assert.equal(body.diagnosticsQuality.source,'workers-ai');
    assert.equal(body.diagnosticsQuality.useful,true);
    assert.equal(body.diagnosticsQuality.score,91);
    assert.doesNotMatch(prompt,/51\.9|15\.5|TopPoint/);
    assert.match(prompt,/gpsFixCount/);
  }finally{globalThis.fetch=originalFetch}
});

test('endpoint nie przyjmuje mieszanych sesji ani zbyt wielu zdarzeń',async()=>{
  const mixed={...payload,events:[event,{...event,id:2,sessionId:'other'}]};
  assert.equal((await onRequest({request:request(mixed),env:{DIAGNOSTICS_SHARED_SECRET:'x'}})).status,400);
  const tooMany={...payload,events:Array.from({length:501},(_,index)=>({...event,id:index+1}))};
  assert.equal((await onRequest({request:request(tooMany),env:{DIAGNOSTICS_SHARED_SECRET:'x'}})).status,400);
  const invalidDevice={...payload,deviceLabel:'Android\u0000telefon'};
  assert.equal((await onRequest({request:request(invalidDevice),env:{DIAGNOSTICS_SHARED_SECRET:'x'}})).status,400);
  const unordered={...payload,events:[{...event,id:2},{...event,id:1}]};
  assert.equal((await onRequest({request:request(unordered),env:{DIAGNOSTICS_SHARED_SECRET:'x'}})).status,400);
});

test('endpoint przekazuje zapisane błędy wysyłki do Apps Script',async()=>{
  const originalFetch=globalThis.fetch;
  let forwarded=null;
  globalThis.fetch=async(_url,options)=>{forwarded=JSON.parse(options.body);return new Response(JSON.stringify({status:'success'}),{status:200})};
  try{
    const errors=[{batchId:'b1',message:'timeout',attempts:3}];
    const response=await onRequest({request:request({...payload,uploadErrors:errors}),env:{DIAGNOSTICS_SHARED_SECRET:'x',DIAGNOSTICS_SHEETS_URL:'https://script.google.test/exec'}});
    assert.equal(response.status,200);
    assert.deepEqual(forwarded.uploadErrors,errors);
  }finally{globalThis.fetch=originalFetch}
});
