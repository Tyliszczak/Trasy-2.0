import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { ROUTES } from '../routes.js';
import { getParkingOptions,normalizeCoordinate } from '../parking-data.js';
import { getRoute,getSchedule,mapUrl } from '../schedule.js';

const readSource=name=>readFile(new URL(`../${name}`,import.meta.url),'utf8');

function localScripts(html){
  return [...html.matchAll(/<script\b[^>]*\bsrc=["']\.\/([^"']+)["'][^>]*><\/script>/gi)]
    .map(match=>`./${match[1].split('?')[0]}`);
}

function shellEntries(sw){
  const match=sw.match(/const APP_SHELL=\[(.*?)\];/s);
  assert.ok(match,'Brak APP_SHELL w sw.js');
  return [...match[1].matchAll(/["'](\.\/[^"']+)["']/g)].map(item=>item[1]);
}

test('główny ekran używa MapLibre i nie ładuje Leafleta',async()=>{
  const html=await readSource('index.html');
  assert.doesNotMatch(html,/leaflet/i);
  assert.match(html,/maplibre-gl@5\.12\.0/);
});

test('każdy lokalny skrypt głównej aplikacji jest ładowany tylko raz',async()=>{
  const html=await readSource('index.html');
  const scripts=localScripts(html);
  assert.equal(new Set(scripts).size,scripts.length,`Powtórzone skrypty: ${scripts.filter((item,index)=>scripts.indexOf(item)!==index).join(', ')}`);
});

test('każdy lokalny skrypt uruchamiany przez index znajduje się w cache PWA',async()=>{
  const [html,sw]=await Promise.all([readSource('index.html'),readSource('sw.js')]);
  const shell=new Set(shellEntries(sw));
  const missing=localScripts(html).filter(script=>!shell.has(script));
  assert.deepEqual(missing,[],'Skrypt z index.html nie jest objęty APP_SHELL');
  assert.match(sw,/const CACHE_NAME='trasy-2\.0-v\d+'/);
});

test('service worker przełącza wersję dopiero po działaniu kierowcy',async()=>{
  const [app,sw]=await Promise.all([readSource('app.js'),readSource('sw.js')]);
  const installHandler=sw.split('\n').find(line=>line.includes("addEventListener('install'"))||'';
  assert.doesNotMatch(installHandler,/skipWaiting/);
  assert.match(sw,/type==='SKIP_WAITING'/);
  assert.match(app,/if\(!reg\.waiting\)return/);
  assert.match(app,/updateRequested=true/);
  assert.match(app,/if\(updateRequested\)location\.reload\(\)/);
});

test('tylko gps-hub utrzymuje fizyczny watchPosition dla głównej aplikacji',async()=>{
  const html=await readSource('index.html');
  const scripts=localScripts(html).map(path=>path.slice(2)).filter(name=>name.endsWith('.js'));
  const sources=await Promise.all(scripts.map(async name=>[name,await readSource(name)]));
  const owners=sources.filter(([,source])=>/\bwatchPosition\s*\(/.test(source)).map(([name])=>name);
  assert.deepEqual(owners,['gps-hub.js']);
});

test('blokadą wygaszania zarządza tylko wake-style',async()=>{
  const [app,wake]=await Promise.all([readSource('app.js'),readSource('wake-style.js')]);
  assert.doesNotMatch(app,/wakeLock\.request/);
  assert.match(wake,/wakeLock\.request\('screen'\)/);
});

test('dane tras są pobierane przez wspólny route-data-service',async()=>{
  const [service,app,returnRoute]=await Promise.all([
    readSource('route-data-service.js'),readSource('app.js'),readSource('return-route.js')
  ]);
  assert.match(service,/script\.google\.com/);
  assert.doesNotMatch(app,/script\.google\.com/);
  assert.doesNotMatch(returnRoute,/script\.google\.com/);
  assert.match(app,/__trasyRouteDataService/);
  assert.match(returnRoute,/__trasyRouteDataService/);
});

test('wybór najbliższego przyszłego kursu ma jedno źródło w time-core',async()=>{
  const [app,returnRoute,timeCore]=await Promise.all([
    readSource('app.js'),readSource('return-route.js'),readSource('time-core.js')
  ]);
  assert.match(app,/nearestFutureTime/);
  assert.match(returnRoute,/time\.nearestFutureTime/);
  assert.match(timeCore,/waitSeconds=\(courseSeconds-nowSeconds\+DAY_SECONDS\)%DAY_SECONDS/);
  assert.doesNotMatch(returnRoute,/Math\.abs\(a\.m-current\)/);
});

test('status punktualności ma zielony tekst w mapie i harmonogramie, a kolor niesie kropka',async()=>{
  const [html,fix,eta]=await Promise.all([
    readSource('index.html'),readSource('punctuality-text-color-fix.js'),readSource('eta-status.js')
  ]);
  assert.match(html,/punctuality-text-color-fix\.js/);
  assert.match(fix,/#routeNextStop \.nextStopStatus\.early/);
  assert.match(fix,/#scheduleBody \.etaPunctuality\.late/);
  assert.match(fix,/color:#39ff69!important/);
  assert.match(eta,/\.etaPunctuality\.early:before\{background:#ffd60a\}/);
  assert.match(eta,/\.etaPunctuality\.late:before\{background:#ff3b30\}/);
  assert.match(eta,/\.etaPunctuality\.onTime:before\{background:#34c759\}/);
});

test('kamera ma jeden jawny kontroler i wraca do prowadzenia po 15 sekundach',async()=>{
  const [html,controls,worker]=await Promise.all([
    readSource('index.html'),readSource('navigation-ui-controls.js'),readSource('sw.js')
  ]);
  assert.doesNotMatch(html,/navigation-smoothing\.js/);
  assert.doesNotMatch(worker,/navigation-smoothing\.js/);
  assert.match(controls,/AUTO_RESUME_MS=15000/);
  assert.match(controls,/this\.resumeTimer=setTimeout\(\(\)=>this\.resume\(\),AUTO_RESUME_MS\)/);
  assert.match(controls,/if\(this\.state===['"]manual['"]\)return/);
});

test('przycisk 2D/3D jest kontrolką MapLibre i nie ma starego kompasu',async()=>{
  const controls=await readSource('navigation-ui-controls.js');
  assert.match(controls,/this\.map\.addControl\(control,['"]bottom-right['"]\)/);
  assert.doesNotMatch(controls,/compassIcon|Kompas \/ widok prowadzenia|routePitchFallback/);
});

test('informacje o prędkości używają jednego zdarzenia limitu drogi',async()=>{
  const [speed,limit]=await Promise.all([readSource('speed-display.js'),readSource('road-speed-limit.js')]);
  assert.match(speed,/trasy:road-speed-limit/);
  assert.match(speed,/Brak danych o ograniczeniu prędkości/);
  assert.match(limit,/trasy:road-speed-limit/);
  assert.match(limit,/source:'openstreetmap'/);
});

test('uwagi nawigacyjne nie zapisują nagrań głosowych',async()=>{
  const feedback=await readSource('navigation-feedback.js');
  assert.match(feedback,/SpeechRecognition\|\|window\.webkitSpeechRecognition/);
  assert.match(feedback,/localStorage\.setItem\(STORAGE_KEY/);
  assert.doesNotMatch(feedback,/MediaRecorder|getUserMedia|audio\/webm/);
});

test('dane zapasowe tworzą kompletny harmonogram każdej zmiany',()=>{
  assert.ok(ROUTES.length>0);
  for(const route of ROUTES){
    assert.equal(getRoute(ROUTES,route.name),route);
    assert.ok(route.times.length>0,`${route.name}: brak oznaczeń zmian`);
    assert.ok(route.stops.length>0,`${route.name}: brak przystanków`);
    for(const time of route.times){
      const schedule=getSchedule(route,time);
      assert.equal(schedule.length,route.stops.length,`${route.name} ${time}: niepełny harmonogram`);
    }
  }
});

test('parkingi wspólne i przypisane do trasy są poprawnie wybierane',()=>{
  const data={PARKINGI:[
    ['NAZWA','LOKALIZACJA','TRASA'],
    ['Baza','51.10, 15.20','*'],
    ['Sulechów','51.20;15.30','SAS Sulechów'],
    ['Inna trasa','51.30, 15.40','TopPoint'],
    ['Duplikat','51.10, 15.20','']
  ]};
  assert.deepEqual(getParkingOptions(data,'SAS Sulechów'),[
    {name:'Baza',coordinates:'51.1, 15.2'},
    {name:'Sulechów',coordinates:'51.2, 15.3'}
  ]);
  assert.equal(normalizeCoordinate('91, 15'),'');
});

test('link mapy zachowuje współrzędne',()=>{
  const coordinates='51.123, 15.456';
  assert.equal(new URL(mapUrl(coordinates)).searchParams.get('query'),coordinates);
});
