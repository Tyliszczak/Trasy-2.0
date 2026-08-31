import assert from 'node:assert/strict';

const APP_URL=(process.env.APP_URL||'https://trasy.tyli.pl').replace(/\/$/,'');

function safeText(value,max=800){
  return String(value||'')
    .replace(/AIza[0-9A-Za-z_-]{20,}/g,'[REDACTED_GOOGLE_KEY]')
    .replace(/[0-9A-Za-z_-]{32,}/g,m=>m.startsWith('AKfy')?'[REDACTED_DEPLOYMENT_ID]':m)
    .slice(0,max);
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
  assert.match(joined,/KURSY_DRIVER_API/,'Brak wejściowego kontraktu panelu kierowcy');
  assert.match(joined,/driverComputeRoute/,'Brak możliwości driverComputeRoute');
  assert.match(joined,/platform\.computeRoute/,'Dostawca tras omija DriverPlatformBridge');
  assert.match(joined,/contractVersion[^\n]*1\.0|CONTRACT_VERSION='1\.0'/,'Brak wersji kontraktu integracyjnego');
  assert.doesNotMatch(joined,/driverSessionToken\s*[:=]|refreshToken\s*[:=]|activationToken\s*[:=]/,'Frontend Tras 2.0 nie może przechowywać tokenów panelu');
  return 'wersjonowany kontrakt działa przez DriverPlatformBridge; uwierzytelnienie pozostaje po stronie panelu';
});

console.log('\n--- PODSUMOWANIE GOOGLE API ---');
for(const r of results)console.log(`${r.ok?'PASS':'FAIL'} | ${r.name} | ${safeText(r.detail)} | ${r.ms}ms`);

const failed=results.filter(r=>!r.ok);
if(failed.length){
  console.log(`\nWynik diagnostyczny: ${results.length-failed.length}/${results.length} PASS.`);
  process.exitCode=1;
}else{
  console.log(`\nWynik diagnostyczny: ${results.length}/${results.length} PASS.`);
}
