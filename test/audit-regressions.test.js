import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const readSource=name=>readFile(new URL(`../${name}`,import.meta.url),'utf8');

test('żaden moduł aplikacji nie nadpisuje globalnego window.fetch',async()=>{
  const names=['google-routes-provider.js','navigation-guidance-fix.js','navigation-live-engine.js'];
  const sources=await Promise.all(names.map(readSource));
  for(const source of sources)assert.doesNotMatch(source,/window\.fetch\s*=/);
});

test('żaden moduł nie nadpisuje globalnego speechSynthesis.speak',async()=>{
  const names=['navigation-guidance-fix.js','navigation-ui-controls.js'];
  const sources=await Promise.all(names.map(readSource));
  for(const source of sources)assert.doesNotMatch(source,/\.speak\s*=|speech\.speak\s*=/);
});

test('stare wyznaczanie trasy jest anulowane po zmianie celu',async()=>{
  const [source,provider]=await Promise.all([
    readSource('nav-map.js'),
    readSource('google-routes-provider.js')
  ]);
  assert.match(source,/AbortController/);
  assert.match(source,/requestId|generation|routeRequest/i);
  assert.match(source,/routeAbortController\?\.abort\(\)/);
  assert.match(source,/signal:controller\.signal/);
  assert.match(provider,/externalSignal/);
  assert.match(provider,/googleTrafficData\(coords,init\?\.signal\)/);
  assert.match(provider,/driverComputeRoute\(coords,\{signal:controller\.signal\}\)/);
});

test('e-TOLL instaluje się na zdarzenie gotowości mapy bez 30-sekundowego pollingu',async()=>{
  const source=await readSource('etoll-overlay.js');
  assert.match(source,/trasy:route-map-ready/);
  assert.match(source,/install\(event\.detail\?\.map\|\|window\.__routeMap\)/);
  assert.doesNotMatch(source,/setInterval/);
  assert.doesNotMatch(source,/30000/);
});

test('nieaktualny limit prędkości wygasa po błędzie lub upływie TTL',async()=>{
  const source=await readSource('road-speed-limit.js');
  assert.match(source,/LIMIT_TTL_MS\s*=\s*45000/);
  assert.match(source,/validUntil/);
  assert.match(source,/staleReason:'ttl'/);
  assert.match(source,/staleReason:'error'/);
  assert.match(source,/setTimeout/);
});

test('logika startu POWROTU ma jednego właściciela',async()=>{
  const [route,gps,startNav,eta]=await Promise.all([
    readSource('return-route.js'),
    readSource('return-gps-mode.js'),
    readSource('return-start-navigation.js'),
    readSource('eta-status.js')
  ]);
  const writers=[route,gps,startNav,eta].filter(source=>/dataset\.returnOriginActive\s*=(?!=)/.test(source));
  assert.equal(writers.length,1);
  assert.match(route,/returnOriginActive/);
  assert.doesNotMatch(gps,/dataset\.returnOriginActive\s*=(?!=)/);
  assert.doesNotMatch(startNav,/dataset\.returnOriginActive\s*=(?!=)/);
  assert.doesNotMatch(startNav,/setInterval/);
});

test('główny index nie ładuje modułów typu fix/guard/lock będących wyłącznie łatkami UI',async()=>{
  const html=await readSource('index.html');
  for(const name of[
    'punctuality-text-color-fix.js',
    'return-layout-fix.js',
    'return-active-visual-lock.js',
    'route-status-guard.js',
    'nav-control-position-fix.js'
  ])assert.doesNotMatch(html,new RegExp(name.replaceAll('.','\\.')));
});

test('nav-map nie aktualizuje starego odłączonego nagłówka następnego przystanku ani starej punktualności UI',async()=>{
  const source=await readSource('nav-map.js');
  assert.doesNotMatch(source,/nextStopEl\.textContent/);
  assert.doesNotMatch(source,/offscreenText/);
  assert.doesNotMatch(source,/function deltaText|function activeEtaData/);
  assert.doesNotMatch(source,/offscreenPanel|activeStopEtaBubble/);
});

test('aktywne moduły nie używają krótkiego pollingu do odnajdywania DOM',async()=>{
  const names=['return-start-navigation.js','etoll-overlay.js','android-back-navigation.js'];
  const sources=await Promise.all(names.map(readSource));
  for(const source of sources)assert.doesNotMatch(source,/setInterval\([^,]+,\s*(?:200|250)\s*\)/s);
  const android=sources[2];
  assert.match(android,/observeNavigationPanel\(document\.getElementById\('routeMapNav'\)\)/);
});

test('historyczne prototypy i obejścia nie pozostają w repozytorium',async()=>{
  for(const name of[
    'active-stop-bubble-guard.js',
    'map-gesture-unlock.js',
    'offline-map.js',
    'schedule-scroll-fix.js'
  ]){
    await assert.rejects(()=>readSource(name),error=>error?.code==='ENOENT');
  }
});
