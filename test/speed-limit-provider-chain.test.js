import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=path=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');
const limitSource=read('road-speed-limit.js');
const display=read('speed-display.js');

test('aplikacja pyta bezpieczny backend przed OSM',()=>{
  assert.match(limitSource,/driverRoadSpeedLimit/);
  const backendCall=limitSource.indexOf('await requestBackendLimit');
  const osmCall=limitSource.indexOf('await osmFallback',backendCall);
  assert.ok(backendCall>=0);
  assert.ok(osmCall>backendCall);
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
