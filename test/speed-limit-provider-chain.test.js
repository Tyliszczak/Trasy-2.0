import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=path=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');
const limitSource=read('road-speed-limit.js');
const display=read('speed-display.js');
const ptvProxy=read('functions/ptv-map/[[path]].js');
const serviceWorker=read('sw.js');

test('aplikacja pyta bezpieczny backend przed OSM',()=>{
  assert.match(limitSource,/driverRoadSpeedLimit/);
  const backendCall=limitSource.indexOf('await requestBackendLimit');
  const osmCall=limitSource.indexOf('await osmFallback',backendCall);
  assert.ok(backendCall>=0);
  assert.ok(osmCall>backendCall);
});

test('SpeedMax używa działającego proxy PTV Map Matching i nie ujawnia klucza',()=>{
  assert.match(limitSource,/PTV_PROXY='\/ptv-map\/mapmatch\/v1\/positions'/);
  assert.match(limitSource,/segmentAttributes/);
  assert.match(limitSource,/attributes\.speedLimit/);
  assert.match(ptvProxy,/MAPMATCH_PATH/);
  assert.match(ptvProxy,/SEGMENT_ATTRIBUTES/);
  assert.match(ptvProxy,/PTV_API_KEY/);
  assert.doesNotMatch(limitSource,/PTV_API_KEY/);
  assert.match(serviceWorker,/url\.pathname\.startsWith\('\/ptv-map\/'\)/);
});

test('OSM pozostaje fallbackiem po braku limitu z backendu',()=>{
  assert.match(limitSource,/openstreetmap/);
  assert.match(limitSource,/requestElements/);
  assert.match(limitSource,/backend\?\.limit/);
});

test('brak limitu całkowicie ukrywa znak, ale nie prędkościomierz',()=>{
  assert.match(display,/routeSpeedLimitWrap" hidden/);
  assert.match(display,/wrap\.hidden=!limit/);
  assert.match(display,/routeCurrentSpeed/);
  assert.doesNotMatch(display,/>—<\/span>/);
});
