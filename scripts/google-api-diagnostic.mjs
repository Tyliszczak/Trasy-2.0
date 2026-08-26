import assert from 'node:assert/strict';

const GAS_URL=process.env.GAS_URL||'https://script.google.com/macros/s/AKfycbyQcnU6xvvrUZNVUJRhQ293L47hZwlvsc6i3n9s9hiYqhLUAoKSqGbPohe_lSB0apfUcw/exec';
const APP_URL=(process.env.APP_URL||'https://trasy-2-0.pages.dev').replace(/\/$/,'');

function safeText(value,max=800){
  return String(value||'')
    .replace(/AIza[0-9A-Za-z_-]{20,}/g,'[REDACTED_GOOGLE_KEY]')
    .replace(/[0-9A-Za-z_-]{32,}/g,m=>m.startsWith('AKfy')?'[REDACTED_DEPLOYMENT_ID]':m)
    .slice(0,max);
}

async function readBody(response){
  const text=await response.text();
  try{return {text,json:JSON.parse(text)}}catch{return {text,json:null}}
}

const results=[];
async function check(name,fn){
  const started=Date.now();
  try{
    const detail=await fn();
    results.push({name,ok:true,detail,ms:Date.now()-started});
    console.log(`✅ ${name} — ${detail}`);
  }catch(error){
    results.push({name,ok:false,detail:String(error?.message||error),ms:Date.now()-started});
    console.log(`❌ ${name} — ${safeText(error?.message||error)}`);
  }
}

await check('Google Routes: publiczny backend Apps Script przyjmuje computeGoogleRoute',async()=>{
  const payload={
    action:'computeGoogleRoute',
    coordinates:[
      {latitude:51.961460,longitude:15.499002},
      {latitude:51.94899459715549,longitude:15.501168258220444}
    ]
  };
  const response=await fetch(GAS_URL,{
    method:'POST',
    redirect:'follow',
    headers:{'Content-Type':'application/json','Accept':'application/json,text/plain;q=0.9,*/*;q=0.8'},
    body:JSON.stringify(payload)
  });
  const body=await readBody(response);
  if(!response.ok)throw new Error(`HTTP ${response.status}: ${safeText(body.text)}`);
  if(!body.json)throw new Error(`Brak JSON: ${safeText(body.text)}`);

  const data=body.json;
  const ok=data.status==='success'||data.ok===true;
  if(!ok){
    const message=data.message||data?.error?.message||data?.error?.code||JSON.stringify(data);
    throw new Error(`Backend odpowiedział błędem: ${safeText(message)}`);
  }
  const google=data.google??data.data?.google??data.osrmLike??data.data;
  assert.ok(Array.isArray(google?.routes)&&google.routes.length,'Odpowiedź sukces bez routes[]');
  const route=google.routes[0];
  return `działa; duration=${route.duration||'?'}, distance=${route.distanceMeters||route.distance||'?'}`;
});

await check('Frontend produkcyjny: ma bezpieczny kontrakt Google driverComputeRoute',async()=>{
  const htmlResponse=await fetch(`${APP_URL}/`,{cache:'no-store'});
  assert.ok(htmlResponse.ok,`index HTTP ${htmlResponse.status}`);
  const html=await htmlResponse.text();
  const match=[...html.matchAll(/<script[^>]+src=["']([^"']+)["']/g)].map(m=>m[1]);
  const sources=[];
  for(const src of match){
    if(/^https?:\/\//.test(src))continue;
    try{
      const url=new URL(src,`${APP_URL}/`);
      const response=await fetch(url,{cache:'no-store'});
      if(response.ok)sources.push(await response.text());
    }catch{}
  }
  const joined=sources.join('\n');
  const callsDriver=/KURSY_DRIVER_API[\s\S]{0,250}driverComputeRoute|driverComputeRoute[\s\S]{0,250}KURSY_DRIVER_API/.test(joined);
  assert.ok(callsDriver,'Kod produkcyjny nie zawiera wywołania KURSY_DRIVER_API.driverComputeRoute');
  const definesDriver=/KURSY_DRIVER_API\s*=|defineProperty\([^)]*KURSY_DRIVER_API|window\.KURSY_DRIVER_API\s*=/.test(joined);
  if(!definesDriver)throw new Error('Wywołanie istnieje, ale w samodzielnym pakiecie produkcyjnym nie znaleziono definicji window.KURSY_DRIVER_API');
  return 'wywołanie i definicja kontraktu są w pakiecie';
});

console.log('\n--- PODSUMOWANIE GOOGLE API ---');
for(const r of results)console.log(`${r.ok?'PASS':'FAIL'} | ${r.name} | ${safeText(r.detail)} | ${r.ms}ms`);

const failed=results.filter(r=>!r.ok);
if(failed.length){
  console.log(`\nWynik diagnostyczny: ${results.length-failed.length}/${results.length} PASS. Nie zmieniamy SpeedMax przed ustaleniem przyczyny.`);
  process.exitCode=1;
}else{
  console.log(`\nWynik diagnostyczny: ${results.length}/${results.length} PASS.`);
}
