import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const readSource=name=>readFile(new URL(`../${name}`,import.meta.url),'utf8');

// Te testy opisują kolejne etapy audytu. TODO jest zdejmowane dopiero po
// wdrożeniu poprawki i zastąpieniu go testem zachowania w odpowiednim etapie.

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

test('TODO etap 7: nav-map nie aktualizuje starego odłączonego nagłówka następnego przystanku ani starej punktualności UI',{todo:true},async()=>{
  const source=await readSource('nav-map.js');
  assert.doesNotMatch(source,/nextStopEl\.textContent/);
  assert.doesNotMatch(source,/offscreenText/);
  assert.doesNotMatch(source,/function deltaText|function activeEtaData/);
});

test('TODO etap 8: aktywne moduły nie używają krótkiego pollingu do odnajdywania DOM',{todo:true},async()=>{
  const names=['return-start-navigation.js','etoll-overlay.js','android-back-navigation.js'];
  const sources=await Promise.all(names.map(readSource));
  for(const source of sources)assert.doesNotMatch(source,/setInterval\([^,]+,\s*(?:200|250)\s*\)/s);
});
