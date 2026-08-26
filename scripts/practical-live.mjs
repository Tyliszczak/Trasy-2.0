import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const BASE=(process.env.TARGET_URL||'https://trasy-2-0.pages.dev').replace(/\/$/,'');
const PINNED=(process.env.PINNED_URL||'https://89a21315.trasy-2-0.pages.dev').replace(/\/$/,'');
const EXPECTED_VERSION=process.env.EXPECTED_VERSION||'2.0.163';
const results=[];
const timings={};

function logResult(name,status,detail=''){
  results.push({name,status,detail});
  console.log(`${status==='ok'?'✅':'❌'} ${name}${detail?` — ${detail}`:''}`);
}

async function step(name,fn){
  const started=Date.now();
  try{
    const detail=await fn();
    timings[name]=Date.now()-started;
    logResult(name,'ok',detail||`${timings[name]} ms`);
    return true;
  }catch(error){
    timings[name]=Date.now()-started;
    logResult(name,'fail',String(error?.stack||error));
    return false;
  }
}

function appUrl(path='',base=BASE){return new URL(path,`${base}/`).href}

async function fetchText(url,init={}){
  const response=await fetch(url,{redirect:'follow',...init});
  assert.ok(response.ok,`${url} -> HTTP ${response.status}`);
  return {response,text:await response.text()};
}

async function responseFailureDetail(response){
  try{return JSON.stringify(await response.clone().json())}catch{}
  try{return (await response.clone().text()).slice(0,300)}catch{}
  return '';
}

function tileAt(lat,lng,z){
  const n=2**z;
  const safeLat=Math.max(-85.05112878,Math.min(85.05112878,lat));
  const x=Math.floor((lng+180)/360*n);
  const rad=safeLat*Math.PI/180;
  const y=Math.floor((1-Math.asinh(Math.tan(rad))/Math.PI)/2*n);
  return{x,y,z};
}

await step('Cloudflare: produkcja odpowiada i pokazuje właściwą wersję',async()=>{
  const {text}=await fetchText(appUrl(''));
  assert.match(text,new RegExp(`data-version=["']${EXPECTED_VERSION.replaceAll('.','\\.')}["']`));
  return `TEST ${EXPECTED_VERSION}`;
});

await step('Cloudflare: przypięte wdrożenie commita odpowiada',async()=>{
  const {text}=await fetchText(appUrl('',PINNED));
  assert.match(text,new RegExp(`data-version=["']${EXPECTED_VERSION.replaceAll('.','\\.')}["']`));
  return PINNED;
});

let swText='';
await step('PWA: wersja service workera zgadza się z aplikacją',async()=>{
  swText=(await fetchText(appUrl('sw.js'),{cache:'no-store'})).text;
  assert.match(swText,new RegExp(`APP_VERSION=['"]${EXPECTED_VERSION.replaceAll('.','\\.')}['"]`));
  return EXPECTED_VERSION;
});

await step('PWA: każdy plik APP_SHELL istnieje na produkcji',async()=>{
  const block=swText.match(/const APP_SHELL=\[(.*?)\];/s)?.[1]||'';
  const files=[...block.matchAll(/['"](\.\/[^'"]+)['"]/g)].map(match=>match[1]);
  assert.ok(files.length>=35,`Podejrzanie mały APP_SHELL: ${files.length}`);
  const failures=[];
  for(const file of files){
    try{
      const response=await fetch(appUrl(file),{cache:'no-store',redirect:'follow'});
      if(!response.ok)failures.push(`${file}:${response.status}`);
    }catch(error){failures.push(`${file}:${error.message}`)}
  }
  assert.deepEqual(failures,[]);
  return `${files.length} zasobów`;
});

await step('Dane tras: /trasy-data zwraca wszystkie wymagane arkusze',async()=>{
  const response=await fetch(`${appUrl('trasy-data')}?e2e=${Date.now()}`,{cache:'no-store'});
  assert.ok(response.ok,`/trasy-data HTTP ${response.status}: ${await responseFailureDetail(response)}`);
  const payload=await response.json();
  assert.notEqual(payload?.status,'error',payload?.message||'Backend zwrócił status error');
  const data=payload?.data??payload;
  for(const name of ['SAS Sulechów','APT - Krężoły','SAS Świebodzin','TopPoint','POJAZDY']){
    assert.ok(Array.isArray(data?.[name]),`Brak arkusza ${name}`);
  }
  return '5/5 wymaganych arkuszy';
});

await step('PTV: kafelki wektorowe przechodzą przez produkcję i przypięte wdrożenie',async()=>{
  const tile=tileAt(51.943,15.508,13);
  const details=[];
  for(const base of [BASE,PINNED]){
    const response=await fetch(appUrl(`ptv-map/maps/v1/vector-tiles/${tile.z}/${tile.x}/${tile.y}`,base),{cache:'no-store'});
    if(!response.ok)throw new Error(`${base}: PTV tile HTTP ${response.status}: ${await responseFailureDetail(response)}`);
    const bytes=(await response.arrayBuffer()).byteLength;
    assert.ok(bytes>20,`${base}: PTV tile ma tylko ${bytes} B`);
    details.push(`${new URL(base).hostname}:${bytes}B`);
  }
  return details.join(', ');
});

await step('PTV SpeedMax: Map Matching działa w produkcji i przypiętym wdrożeniu',async()=>{
  const details=[];
  for(const base of [BASE,PINNED]){
    const response=await fetch(appUrl('ptv-map/mapmatch/v1/positions/51.9429132/15.5077919?heading=90',base),{cache:'no-store'});
    if(!response.ok)throw new Error(`${base}: PTV mapmatch HTTP ${response.status}: ${await responseFailureDetail(response)}`);
    const data=await response.json();
    assert.ok(data&&typeof data==='object','Brak JSON z PTV Map Matching');
    details.push(new URL(base).hostname);
  }
  return details.join(' + ');
});

await step('OSRM: zewnętrzny silnik wyznacza realną trasę',async()=>{
  const url='https://router.project-osrm.org/route/v1/driving/15.49907695,51.96162552;15.50779186,51.94291322?overview=full&geometries=geojson&steps=true';
  const response=await fetch(url,{cache:'no-store'});
  assert.ok(response.ok,`OSRM HTTP ${response.status}`);
  const data=await response.json();
  assert.equal(data.code,'Ok');
  assert.ok(data.routes?.[0]?.geometry?.coordinates?.length>2,'OSRM bez geometrii');
  return `${Math.round(data.routes[0].distance)} m`;
});

await step('OpenFreeMap: oba style awaryjne są dostępne',async()=>{
  for(const style of ['liberty','dark']){
    const response=await fetch(`https://tiles.openfreemap.org/styles/${style}`,{cache:'no-store'});
    assert.ok(response.ok,`${style} HTTP ${response.status}`);
    const json=await response.json();
    assert.equal(json.version,8,`${style}: niepoprawny styl MapLibre`);
  }
  return 'Liberty + Dark';
});

const browser=await chromium.launch({headless:true});

async function fallbackPage({viewport={width:412,height:915},serviceWorkers='allow',geolocation={latitude:51.96162552,longitude:15.49907695,accuracy:8}}={}){
  const context=await browser.newContext({
    viewport,
    locale:'pl-PL',
    timezoneId:'Europe/Warsaw',
    geolocation,
    permissions:['geolocation'],
    serviceWorkers
  });
  const page=await context.newPage();
  await page.route('**/trasy-data**',route=>route.abort('failed'));
  return{context,page};
}

async function openFallbackSchedule(page,routeName='SAS Sulechów'){
  await page.goto(BASE,{waitUntil:'domcontentloaded',timeout:45000});
  await page.waitForFunction(()=>document.querySelectorAll('#routeSelect option').length>1,{timeout:15000});
  const options=await page.locator('#routeSelect option').allTextContents();
  const wanted=options.includes(routeName)?routeName:options.find(text=>text.trim()&&text!=='Wybierz trasę');
  assert.ok(wanted,'Brak tras na liście');
  await page.selectOption('#routeSelect',{label:wanted});
  await page.click('#showSchedule');
  await page.locator('#scheduleView').waitFor({state:'visible'});
  await page.waitForTimeout(150);
  return wanted;
}

await step('UI: wybór trasy, harmonogram i układ telefonu 412×915',async()=>{
  const {context,page}=await fallbackPage();
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  try{
    const route=await openFallbackSchedule(page);
    const count=await page.locator('#scheduleBody tr').count();
    assert.ok(count>=5,`Tylko ${count} wierszy harmonogramu`);
    const layout=await page.evaluate(()=>{
      const header=document.querySelector('.header')?.getBoundingClientRect();
      const schedule=document.querySelector('#scheduleView .scheduleHeading')?.getBoundingClientRect();
      const back=document.querySelector('#backFromSchedule')?.getBoundingClientRect();
      return{
        headerBottom:header?.bottom||0,
        scheduleTop:schedule?.top||0,
        backW:back?.width||0,
        backH:back?.height||0,
        scrollWidth:document.documentElement.scrollWidth,
        width:innerWidth
      };
    });
    assert.ok(layout.scheduleTop>=layout.headerBottom-1,`Belka harmonogramu nachodzi na pasek: ${JSON.stringify(layout)}`);
    assert.ok(layout.scrollWidth<=layout.width+1,`Poziomy overflow ${layout.scrollWidth}/${layout.width}`);
    assert.ok(Math.abs(layout.backW-38)<2&&Math.abs(layout.backH-38)<2,`Przycisk powrotu ${layout.backW}x${layout.backH}`);
    assert.deepEqual(errors,[]);
    return `${route}, ${count} przystanków`;
  }finally{await context.close()}
});

await step('POWRÓT: pierwszy punkt jest START-em i nigdy nie pokazuje Dojazd',async()=>{
  const {context,page}=await fallbackPage();
  try{
    await openFallbackSchedule(page);
    await page.check('#returnRouteSwitch');
    await page.waitForFunction(()=>document.getElementById('scheduleBody')?.dataset.direction==='return');
    const state=await page.evaluate(()=>{
      const body=document.getElementById('scheduleBody');
      const first=body.querySelector('tr');
      return{
        direction:body.dataset.direction,
        returnOriginActive:body.dataset.returnOriginActive,
        returnStart:body.dataset.returnStart,
        label:document.getElementById('returnStartLabel')?.textContent||'',
        role:first?.querySelector('.routeRoleLabel')?.textContent||'',
        firstText:first?.innerText||''
      };
    });
    assert.equal(state.direction,'return');
    assert.equal(state.returnOriginActive,'1');
    assert.match(state.label,/^START\s+\d{1,2}:\d{2}$/);
    assert.equal(state.role,'START');
    assert.doesNotMatch(state.firstText,/Dojazd/i);
    await page.evaluate(()=>{
      const body=document.getElementById('scheduleBody');
      body.dispatchEvent(new CustomEvent('nav-eta-update',{bubbles:true,detail:{etaSeconds:600,kind:'late',diffSeconds:120}}));
    });
    await page.waitForTimeout(100);
    const after=await page.locator('#scheduleBody tr').first().innerText();
    assert.doesNotMatch(after,/Dojazd/i);
    return state.label;
  }finally{await context.close()}
});

await step('Koniec trasy: praktyczne menu ma trzy wymagane działania',async()=>{
  const {context,page}=await fallbackPage();
  try{
    await openFallbackSchedule(page);
    await page.evaluate(()=>{
      const body=document.getElementById('scheduleBody');
      const rows=[...body.querySelectorAll('tr')];
      body.dispatchEvent(new CustomEvent('gps-stop-arrival',{bubbles:true,detail:{
        final:true,direction:'forward',emptyRun:false,index:rows.length-1,key:'e2e-final',coordinate:rows.at(-1)?.dataset.coordinate||''
      }}));
    });
    await page.locator('#finalCourseDialog').waitFor({state:'visible'});
    const texts=await page.locator('#finalCourseDialog button').allTextContents();
    assert.deepEqual(texts,['USTAW TRASĘ POWROTNĄ','POWRÓT NA PUSTO','ZAMKNIJ APLIKACJĘ']);
    await page.click('#finalCourseDialog .returnAction');
    await page.waitForFunction(()=>document.getElementById('scheduleBody')?.dataset.direction==='return');
    return texts.join(' | ');
  }finally{await context.close()}
});

await step('Nawigacja: PTV startuje, trasa OSRM się rysuje i nie ma surowego OSM',async()=>{
  const {context,page}=await fallbackPage();
  const rawOsm=[];
  page.on('request',request=>{if(request.url().includes('tile.openstreetmap.org'))rawOsm.push(request.url())});
  try{
    await openFallbackSchedule(page);
    const started=Date.now();
    await page.locator('#scheduleBody .routeLink').first().click();
    await page.locator('#routeMapNav').waitFor({state:'visible'});
    await page.locator('#routeMapCanvas canvas').first().waitFor({state:'visible',timeout:30000});
    timings.mapCanvasVisibleMs=Date.now()-started;
    await page.waitForFunction(()=>document.documentElement.dataset.mapProvider==='ptv',{timeout:30000});
    timings.ptvProviderMs=Date.now()-started;
    await page.waitForFunction(()=>/^Trasa\s/.test(document.getElementById('routeMapStatus')?.textContent||''),{timeout:30000});
    timings.routeReadyMs=Date.now()-started;
    assert.deepEqual(rawOsm,[],'Wykryto tile.openstreetmap.org');

    const mapState=await page.evaluate(()=>({
      provider:document.documentElement.dataset.mapProvider,
      theme:document.documentElement.dataset.mapTheme,
      status:document.getElementById('routeMapStatus')?.textContent||'',
      layers:window.__routeMap?.getStyle?.()?.layers?.map(layer=>({id:layer.id,type:layer.type}))||[]
    }));
    assert.equal(mapState.provider,'ptv');
    const routeIndex=mapState.layers.findIndex(layer=>layer.id==='route-line');
    const firstSymbol=mapState.layers.findIndex(layer=>layer.type==='symbol');
    assert.ok(routeIndex>=0,'Brak route-line');
    assert.ok(firstSymbol<0||routeIndex<firstSymbol,`route-line ${routeIndex}, symbol ${firstSymbol}`);

    const bubbleBefore=await page.evaluate(()=>{
      const bubble=document.getElementById('routeManeuverBubble');
      const b=bubble.getBoundingClientRect();
      const vehicle=[...document.querySelectorAll('.maplibregl-marker')].map(marker=>{
        const child=marker.firstElementChild;
        return{marker,child,clip:child?getComputedStyle(child).clipPath:''};
      }).find(item=>item.clip&&item.clip!=='none');
      const v=(vehicle?.child||vehicle?.marker)?.getBoundingClientRect?.();
      return{
        position:getComputedStyle(bubble).position,
        visibility:getComputedStyle(bubble).visibility,
        left:b.left,top:b.top,width:b.width,height:b.height,
        vehicleBottom:v?.bottom??null,
        viewportHeight:innerHeight
      };
    });
    assert.equal(bubbleBefore.position,'fixed');
    assert.equal(bubbleBefore.visibility,'visible');
    assert.ok(bubbleBefore.top>0&&bubbleBefore.top+bubbleBefore.height<=bubbleBefore.viewportHeight+2,'Dymek poza ekranem');
    if(Number.isFinite(bubbleBefore.vehicleBottom))assert.ok(bubbleBefore.top>=bubbleBefore.vehicleBottom+2,`Dymek nachodzi na wskaźnik: ${JSON.stringify(bubbleBefore)}`);

    await page.evaluate(()=>window.__routeMap?.jumpTo({bearing:137,pitch:42,zoom:16.4}));
    await page.waitForTimeout(250);
    const bubbleAfter=await page.evaluate(()=>{
      const b=document.getElementById('routeManeuverBubble').getBoundingClientRect();
      return{left:b.left,top:b.top,width:b.width,height:b.height};
    });
    assert.ok(Math.abs(bubbleAfter.left-bubbleBefore.left)<1&&Math.abs(bubbleAfter.top-bubbleBefore.top)<1,'Dymek przesunął się razem z mapą');

    const controls=await page.evaluate(()=>{
      const pitch=document.getElementById('routePitchToggle');
      const zoom=document.querySelector('#routeMapCanvas .maplibregl-ctrl-zoom-in');
      const p=pitch?.getBoundingClientRect(),z=zoom?.getBoundingClientRect();
      return{pitch:{w:p?.width||0,h:p?.height||0},zoom:{w:z?.width||0,h:z?.height||0},pitchText:pitch?.innerText||''};
    });
    assert.ok(Math.abs(controls.pitch.w-34)<2&&Math.abs(controls.pitch.h-40)<2,`2D/3D ${JSON.stringify(controls.pitch)}`);
    assert.ok(Math.abs(controls.zoom.w-34)<2&&Math.abs(controls.zoom.h-40)<2,`zoom ${JSON.stringify(controls.zoom)}`);
    return `mapa ${timings.mapCanvasVisibleMs} ms, PTV ${timings.ptvProviderMs} ms, trasa ${timings.routeReadyMs} ms`;
  }finally{await context.close()}
});

function syntheticParallelRoute(){
  const latA=51.96162552,lngStart=15.49907695,lngEnd=15.55907695,parallelLat=latA+0.00010;
  const forward=[];
  for(let i=0;i<=30;i++)forward.push([lngStart+(lngEnd-lngStart)*(i/30),latA]);
  const backward=[];
  for(let i=0;i<=30;i++)backward.push([lngEnd-(lngEnd-lngStart)*(i/30),parallelLat]);
  const coords=[...forward,[lngEnd,parallelLat],...backward];
  return{
    code:'Ok',
    routes:[{
      distance:8600,
      duration:600,
      geometry:{type:'LineString',coordinates:coords},
      legs:[{
        distance:8600,duration:600,
        steps:[
          {distance:0,duration:0,name:'Start',maneuver:{type:'depart',bearing_after:90,location:[lngStart,latA]}},
          {distance:4200,duration:280,name:'Pierwszy zjazd',maneuver:{type:'turn',modifier:'right',bearing_after:180,location:[lngEnd,latA]}},
          {distance:4200,duration:280,name:'Późniejszy zjazd',maneuver:{type:'turn',modifier:'right',bearing_after:270,location:[lngStart,parallelLat]}},
          {distance:0,duration:0,name:'Cel',maneuver:{type:'arrive',bearing_after:270,location:[lngStart,parallelLat]}}
        ]
      }]
    }]
  };
}

await step('GPS praktyczny: równoległa jezdnia nie teleportuje postępu do późniejszego odcinka',async()=>{
  const {context,page}=await fallbackPage({serviceWorkers:'block'});
  const synthetic=syntheticParallelRoute();
  await context.route('https://router.project-osrm.org/route/v1/driving/**',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(synthetic)}));
  try{
    await openFallbackSchedule(page);
    await page.locator('#scheduleBody .routeLink').first().click();
    await page.waitForFunction(()=>/^Trasa\s/.test(document.getElementById('routeMapStatus')?.textContent||''),{timeout:30000});
    const before=await page.locator('#routeManeuverDistance').textContent();
    assert.match(before||'',/km/,'Przed ruchem pierwszy manewr powinien być daleko');

    await context.setGeolocation({latitude:51.96162552+0.00002,longitude:15.50007695,accuracy:6});
    await page.waitForTimeout(900);
    await context.setGeolocation({latitude:51.96162552+0.00003,longitude:15.50107695,accuracy:6});
    await page.waitForTimeout(900);
    const after=await page.locator('#routeManeuverDistance').textContent();
    assert.match(after||'',/km/,`Postęp przeskoczył na późniejszą jezdnię: ${after}`);
    const value=Number(String(after).replace(',','.').match(/[0-9.]+/)?.[0]);
    assert.ok(Number.isFinite(value)&&value>=2,`Podejrzanie bliski manewr po równoległej jezdni: ${after}`);
    return `${before?.trim()} -> ${after?.trim()}`;
  }finally{await context.close()}
});

await step('Offline praktyczny: CacheStorage mapy + OSRM działa po fizycznym odcięciu sieci',async()=>{
  const context=await browser.newContext({
    viewport:{width:412,height:915},
    locale:'pl-PL',timezoneId:'Europe/Warsaw',
    geolocation:{latitude:51.943,longitude:15.508,accuracy:8},
    permissions:['geolocation'],serviceWorkers:'allow'
  });
  const page=await context.newPage();
  try{
    await page.goto(BASE,{waitUntil:'domcontentloaded',timeout:45000});
    await page.evaluate(()=>navigator.serviceWorker.ready);
    if(!(await page.evaluate(()=>Boolean(navigator.serviceWorker.controller)))){
      await page.reload({waitUntil:'domcontentloaded'});
      await page.waitForFunction(()=>Boolean(navigator.serviceWorker.controller),{timeout:10000});
    }

    const workerVersion=await page.evaluate(()=>new Promise(resolve=>{
      const worker=navigator.serviceWorker.controller;
      if(!worker){resolve('');return}
      const channel=new MessageChannel();
      const timer=setTimeout(()=>resolve(''),2000);
      channel.port1.onmessage=event=>{clearTimeout(timer);resolve(event.data?.version||'')};
      worker.postMessage({type:'GET_VERSION'},[channel.port2]);
    }));
    assert.equal(workerVersion,EXPECTED_VERSION);

    await page.evaluate(async()=>{
      localStorage.setItem('trasy2.routes',JSON.stringify([{name:'E2E offline',times:['12:00'],stops:[{
        id:'1',name:'Punkt',coordinates:'51.943, 15.508',returnCoordinates:'51.943, 15.508',times:{'12:00':'12:00'}
      }]}]));
      await window.__trasyOfflineMap.clear();
    });
    const offlineState=await page.evaluate(()=>window.__trasyOfflineMap.prefetch({force:true}));
    assert.equal(offlineState.status,'ready',JSON.stringify(offlineState));
    assert.ok(offlineState.cached>0,JSON.stringify(offlineState));

    const cachedMapUrl=await page.evaluate(async()=>{
      const cache=await caches.open('trasy-offline-map-v1');
      const keys=await cache.keys();
      return keys.map(request=>request.url).find(url=>url.includes('tiles.openfreemap.org'))||'';
    });
    assert.ok(cachedMapUrl,'Brak OpenFreeMap w CacheStorage');

    const osrm='https://router.project-osrm.org/route/v1/driving/15.49907695,51.96162552;15.50779186,51.94291322?overview=full&geometries=geojson&steps=true';
    const onlineRoute=await page.evaluate(async url=>({ok:(await fetch(url)).ok}),osrm);
    assert.equal(onlineRoute.ok,true);

    await context.setOffline(true);
    const offlineChecks=await page.evaluate(async({mapUrl,osrmUrl})=>{
      const map=await fetch(mapUrl);
      const route=await fetch(osrmUrl);
      return{map:map.ok,route:route.ok};
    },{mapUrl:cachedMapUrl,osrmUrl:osrm});
    assert.equal(offlineChecks.map,true,'OpenFreeMap nie wrócił z cache offline');
    assert.equal(offlineChecks.route,true,'OSRM nie wrócił z cache offline');

    await page.reload({waitUntil:'domcontentloaded',timeout:15000});
    await page.locator('#globalTestVersion').waitFor({state:'visible'});
    assert.equal((await page.locator('#globalTestVersion').textContent())?.trim(),`TEST ${EXPECTED_VERSION}`);
    await context.setOffline(false);
    return `map tiles ${offlineState.cached}/${offlineState.total}, SW ${workerVersion}`;
  }finally{await context.close()}
});

await step('UI landscape 915×412: brak poziomego rozjechania harmonogramu',async()=>{
  const {context,page}=await fallbackPage({viewport:{width:915,height:412}});
  try{
    await openFallbackSchedule(page);
    const metrics=await page.evaluate(()=>({scrollWidth:document.documentElement.scrollWidth,width:innerWidth,headingTop:document.querySelector('.scheduleHeading')?.getBoundingClientRect().top||0}));
    assert.ok(metrics.scrollWidth<=metrics.width+1,JSON.stringify(metrics));
    assert.ok(metrics.headingTop>=27,JSON.stringify(metrics));
    return `${metrics.scrollWidth}/${metrics.width}px`;
  }finally{await context.close()}
});

await browser.close();

const report={
  target:BASE,
  pinned:PINNED,
  version:EXPECTED_VERSION,
  createdAt:new Date().toISOString(),
  passed:results.filter(result=>result.status==='ok').length,
  failed:results.filter(result=>result.status==='fail').length,
  results,
  timings
};
await writeFile('practical-results.json',JSON.stringify(report,null,2));
console.log('\n=== PODSUMOWANIE PRAKTYCZNE ===');
console.log(JSON.stringify(report,null,2));
if(report.failed)process.exitCode=1;
