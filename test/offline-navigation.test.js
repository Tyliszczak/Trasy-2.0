import assert from'node:assert/strict';
import{readFileSync}from'node:fs';
import test from'node:test';

const read=name=>readFileSync(new URL(`../${name}`,import.meta.url),'utf8');

test('PWA zachowuje trwały cache map offline pomiędzy wersjami aplikacji',()=>{
  const source=read('sw.js');
  assert.match(source,/OFFLINE_MAP_CACHE='trasy-offline-map-v1'/);
  assert.match(source,/OFFLINE_ROUTE_CACHE='trasy-offline-routes-v1'/);
  assert.match(source,/KEEP_CACHES=new Set\(\[CACHE_NAME,OFFLINE_MAP_CACHE,OFFLINE_ROUTE_CACHE\]\)/);
  assert.match(source,/tiles\.openfreemap\.org/);
  assert.match(source,/router\.project-osrm\.org/);
});

test('pakiet offline pobiera korytarz wszystkich tras, a nie prostokąt całego regionu',()=>{
  const source=read('offline-map-cache.js');
  assert.match(source,/routeCorridorTiles/);
  assert.match(source,/tileNeighborhood/);
  assert.doesNotMatch(source,/for\(let x=minX;x<=maxX/);
});

test('pakiet offline przechowuje styl, TileJSON, symbole i polskie zakresy fontów',()=>{
  const source=read('offline-map-cache.js');
  assert.match(source,/style\.json/);
  assert.match(source,/tilejson/);
  assert.match(source,/sprite/);
  assert.match(source,/glyph/);
  assert.match(source,/Latin/);
});

test('stałe geometrie tras są pobierane w tle i używane jako fallback OSRM',()=>{
  const source=read('offline-route-cache.js');
  const nav=read('nav-map.js');
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
