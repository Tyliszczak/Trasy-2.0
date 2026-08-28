import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=path=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');
const limitSource=read('road-speed-limit.js');
const display=read('speed-display.js');
const ptvProxy=read('functions/ptv-map/[[path]].js');
const osmProxy=read('functions/osm-vmax/[[path]].js');
const serviceWorker=read('sw.js');

test('SpeedMax używa wyłącznie OSM i nie ma płatnego fallbacku',()=>{
  assert.match(limitSource,/OSM_PROXY='\/osm-vmax'/);
  assert.match(limitSource,/nearestRoadLimit/);
  assert.match(limitSource,/source:'openstreetmap'/);
  assert.doesNotMatch(limitSource,/PTV_PROXY|normalizePtvSpeedLimit|ptvFallback|ptv-map-matching/i);
  assert.doesNotMatch(limitSource,/overpass-api\.de|overpass\.kumi/);
  assert.doesNotMatch(ptvProxy,/MAPMATCH_PATH|mapmatch|SEGMENT_ATTRIBUTES|X-Trasy-Speed-Provider/i);
  assert.match(ptvProxy,/PTV_API_KEY/);
  assert.doesNotMatch(limitSource,/PTV_API_KEY/);
  assert.match(serviceWorker,/url\.pathname\.startsWith\('\/ptv-map\/'\)/);
  assert.match(serviceWorker,/url\.pathname\.startsWith\('\/osm-vmax\/'\)/);
  assert.match(osmProxy,/OVERPASS_ENDPOINTS/);
  assert.match(osmProxy,/caches\?\.default/);
  assert.match(osmProxy,/sanitizeElements/);
});

test('OSM jest buforowane i ogranicza częstotliwość zapytań',()=>{
  assert.match(limitSource,/OSM_CACHE_TTL_MS=90000/);
  assert.match(limitSource,/OSM_MIN_QUERY_INTERVAL_MS=15000/);
  assert.match(limitSource,/OSM_STATIONARY_QUERY_INTERVAL_MS=60000/);
  assert.doesNotMatch(limitSource,/if\([^\n]*speed[^\n]*return/);
});

test('heading pomaga OSM rozpoznać właściwą jezdnię, ale nie narzuca przebiegu trasy',()=>{
  assert.match(limitSource,/HEADING_MAX_AGE_MS=45000/);
  assert.match(limitSource,/nearestRoadLimit\(osmElements,point,\{maxDistance:MAX_ROAD_DISTANCE_M,heading,previousWayId\}\)/);
  assert.doesNotMatch(limitSource,/continue_straight|bearings/);
});

test('brak limitu ukrywa znak, ale prędkościomierz zostaje',()=>{
  assert.match(display,/routeSpeedLimitWrap" hidden/);
  assert.match(display,/wrap\.hidden=!limit/);
  assert.match(display,/routeCurrentSpeed/);
  assert.doesNotMatch(display,/effectiveVehicleSpeedLimit|vehicle-speed-profile-core/);
});

