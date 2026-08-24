import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const readSource=name=>readFile(new URL(`../${name}`,import.meta.url),'utf8');

// Te testy opisują stan docelowy po audycie. Są oznaczone TODO celowo:
// etap 1 ma zabezpieczyć obecną aplikację bez zmiany jej działania.
// W kolejnych etapach TODO jest zdejmowane dopiero po wdrożeniu poprawki.

test('TODO etap 2: POWRÓT wybiera najbliższy przyszły kurs zamiast najbliższej godziny bezwzględnej',{todo:true},async()=>{
  const source=await readSource('return-route.js');
  assert.doesNotMatch(source,/Math\.abs\(a\.m-current\)/);
  assert.match(source,/%\s*\(?24\s*\*\s*60\)?|%\s*1440/);
});

test('TODO etap 2: return-route zachowuje prawdziwy plan końcowego przystanku',{todo:true},async()=>{
  const source=await readSource('return-route.js');
  assert.match(source,/routeRolePlan|finalStopPlan/);
});

test('TODO etap 2: wszystkie główne moduły używają jednego wspólnego czytnika czasu planowego',{todo:true},async()=>{
  const names=['return-route.js','gps-stop-tracker.js','next-stop-header.js','eta-status.js','nav-map.js'];
  const sources=await Promise.all(names.map(readSource));
  const localPlanParsers=sources.filter(source=>/match\(\/\\b\\d\{1,2\}:\\d\{2\}\\b\//.test(source));
  assert.equal(localPlanParsers.length,0);
});

test('TODO etap 3: przejazd przez promień przystanku bez zatrzymania nie potwierdza przyjazdu',{todo:true},async()=>{
  const source=await readSource('gps-stop-engine.js');
  assert.match(source,/minimumArrivalSpeed|stopped|dwell|stopFixes/i);
});

test('TODO etap 3: READY jest możliwe dopiero po potwierdzonym postoju',{todo:true},async()=>{
  const source=await readSource('gps-stop-tracker.js');
  const ready=source.match(/if\(seconds<=0[\s\S]{0,220}?state='ready'/)?.[0]||'';
  assert.match(ready,/stopped|dwell|arrivedAndStopped|hold/i);
});

test('TODO etap 3: HOLD jest zatrzaskiwany dla przystanku i nie znika od drobnego jitteru GPS',{todo:true},async()=>{
  const source=await readSource('gps-stop-tracker.js');
  assert.match(source,/latchedHold|holdKey|holdState/i);
});

test('TODO etap 4: ostrzeżenie 100 m korzysta z przewidywanego ETA, a nie tylko z zegara',{todo:true},async()=>{
  const source=await readSource('next-stop-header.js');
  const approach=source.match(/function updateApproach[\s\S]*?\n  }/i)?.[0]||'';
  assert.match(approach,/eta|diffSeconds|predicted/i);
  assert.doesNotMatch(approach,/seconds>0&&distance<=APPROACH_RADIUS_M/);
});

test('TODO etap 4: mapa i harmonogram nie liczą niezależnie statusu punktualności',{todo:true},async()=>{
  const names=['eta-status.js','next-stop-header.js','nav-map.js'];
  const sources=await Promise.all(names.map(readSource));
  const calculators=sources.filter(source=>/min za wcześnie|min opóźnienia/.test(source));
  assert.equal(calculators.length,1);
});

test('TODO etap 5: żaden moduł aplikacji nie nadpisuje globalnego window.fetch',{todo:true},async()=>{
  const names=['google-routes-provider.js','navigation-guidance-fix.js','navigation-live-engine.js'];
  const sources=await Promise.all(names.map(readSource));
  for(const source of sources)assert.doesNotMatch(source,/window\.fetch\s*=/);
});

test('TODO etap 5: żaden moduł nie nadpisuje globalnego speechSynthesis.speak',{todo:true},async()=>{
  const names=['navigation-guidance-fix.js','navigation-ui-controls.js'];
  const sources=await Promise.all(names.map(readSource));
  for(const source of sources)assert.doesNotMatch(source,/\.speak\s*=|speech\.speak\s*=/);
});

test('TODO etap 5: stare wyznaczanie trasy jest anulowane po zmianie celu',{todo:true},async()=>{
  const source=await readSource('nav-map.js');
  assert.match(source,/AbortController/);
  assert.match(source,/requestId|generation|routeRequest/i);
});

test('TODO etap 6: e-TOLL instaluje się na zdarzenie gotowości mapy bez 30-sekundowego pollingu',{todo:true},async()=>{
  const source=await readSource('etoll-overlay.js');
  assert.match(source,/trasy:route-map-ready/);
  assert.doesNotMatch(source,/setInterval\(\(\)=>\{if\(install\(\)\)/);
  assert.doesNotMatch(source,/30000/);
});

test('TODO etap 6: nieaktualny limit prędkości wygasa po błędzie lub upływie TTL',{todo:true},async()=>{
  const source=await readSource('road-speed-limit.js');
  assert.match(source,/TTL|expires|validUntil|stale/i);
});

test('TODO etap 6: logika startu POWROTU ma jednego właściciela',{todo:true},async()=>{
  const [route,gps,startNav]=await Promise.all([
    readSource('return-route.js'),readSource('return-gps-mode.js'),readSource('return-start-navigation.js')
  ]);
  const owners=[route,gps,startNav].filter(source=>/returnOriginActive/.test(source));
  assert.equal(owners.length,1);
});

test('TODO etap 7: główny index nie ładuje modułów typu fix/guard/lock będących wyłącznie łatkami UI',{todo:true},async()=>{
  const html=await readSource('index.html');
  for(const name of[
    'punctuality-text-color-fix.js',
    'return-layout-fix.js',
    'return-active-visual-lock.js',
    'route-status-guard.js',
    'nav-control-position-fix.js'
  ])assert.doesNotMatch(html,new RegExp(name.replaceAll('.','\\.')));
});

test('TODO etap 7: nav-map nie aktualizuje starego odłączonego nagłówka następnego przystanku',{todo:true},async()=>{
  const source=await readSource('nav-map.js');
  assert.doesNotMatch(source,/nextStopEl\.textContent/);
  assert.doesNotMatch(source,/offscreenText/);
});

test('TODO etap 8: aktywne moduły nie używają krótkiego pollingu do odnajdywania DOM',{todo:true},async()=>{
  const names=['return-start-navigation.js','etoll-overlay.js','android-back-navigation.js'];
  const sources=await Promise.all(names.map(readSource));
  for(const source of sources)assert.doesNotMatch(source,/setInterval\([^,]+,\s*(?:200|250)\s*\)/s);
});
