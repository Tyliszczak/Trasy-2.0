import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=path=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('PWA zachowuje trwały cache map offline pomiędzy wersjami aplikacji',()=>{
  const worker=read('sw.js');
  assert.match(worker,/const OFFLINE_MAP_CACHE='trasy-offline-map-v1'/);
  assert.match(worker,/const OFFLINE_ROUTE_CACHE='trasy-offline-routes-v1'/);
  assert.match(worker,/KEEP_CACHES=new Set\(\[CACHE_NAME,OFFLINE_MAP_CACHE,OFFLINE_ROUTE_CACHE\]\)/);
  assert.match(worker,/url\.origin==='https:\/\/tiles\.openfreemap\.org'/);
  assert.match(worker,/url\.origin==='https:\/\/router\.project-osrm\.org'/);
});

test('pakiet offline pobiera korytarz wszystkich tras, a nie prostokąt całego regionu',()=>{
  const source=read('offline-map-cache.js');
  assert.match(source,/const MIN_ZOOM=8/);
  assert.match(source,/const MAX_ZOOM=14/);
  assert.match(source,/function coverSequence/);
  assert.match(source,/tileWidthMeters/);
  assert.match(source,/const radius=z>=13\?1:0/);
  assert.match(source,/MAX_TILES=3200/);
  assert.match(source,/returnCoordinates/);
});

test('pakiet offline przechowuje styl, TileJSON, symbole i polskie zakresy fontów',()=>{
  const source=read('offline-map-cache.js');
  assert.match(source,/styles\/liberty/);
  assert.match(source,/styles\/dark/);
  assert.match(source,/tiles\.openfreemap\.org\/planet/);
  assert.match(source,/sprites\/ofm_f384\/ofm/);
  assert.match(source,/Noto%20Sans%20Regular\/256-511\.pbf/);
});

test('stałe geometrie tras są pobierane w tle i używane jako fallback OSRM',()=>{
  const source=read('offline-route-cache.js');
  const nav=read('nav-map.js');
  assert.match(source,/window\.__trasyRouteFetch=routeFetch/);
  assert.match(source,/trasy-offline-routes-v1/);
  assert.match(source,/syntheticRequest/);
  assert.match(source,/cachedFallback/);
  assert.match(source,/prefetchSequence/);
  assert.match(source,/router\.project-osrm\.org/);
  assert.match(nav,/window\.__trasyRouteFetch\|\|window\.fetch/);
});

test('bieżąca wersja TEST ładuje moduły offline i service worker ma tę samą wersję',()=>{
  const html=read('index.html');
  const worker=read('sw.js');
  const pageVersion=html.match(/data-version="([^"]+)"/)?.[1];
  const workerVersion=worker.match(/const APP_VERSION='([^']+)'/)?.[1];
  assert.ok(pageVersion,'Brak numeru wersji TEST w index.html');
  assert.equal(workerVersion,pageVersion);
  assert.match(html,/offline-map-cache\.js\?v=1/);
  assert.match(html,/offline-route-cache\.js\?v=1/);
  assert.match(worker,/\.\/offline-map-cache\.js/);
  assert.match(worker,/\.\/offline-route-cache\.js/);
});
