import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=path=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('PTV pozostaje mapą sieciową, a gotowy pakiet OpenFreeMap daje szybki start offline',()=>{
  const source=read('map-runtime.js');
  assert.match(source,/vectormaps-resources\.myptv\.com\/styles\/latest\/standard\.json/);
  assert.match(source,/tiles\.openfreemap\.org\/styles\/liberty/);
  assert.match(source,/tiles\.openfreemap\.org\/styles\/dark/);
  assert.match(source,/function offlinePackageReady\(\)/);
  assert.match(source,/if\(!navigator\.onLine\|\|offlinePackageReady\(\)\)return'openfreemap-liberty'/);
  assert.match(source,/FALLBACK_GRACE_MS=1200/);
  assert.match(source,/FALLBACK_CONFIRM_ATTEMPTS=1/);
  assert.match(source,/REQUEST_TIMEOUT_MS=3000/);
  assert.match(source,/STYLE_TIMEOUT_MS=5000/);
  assert.match(source,/PTV_RETRY_MS=15000/);
  assert.match(source,/PTV_PROXY='\/ptv-map'/);
});

test('właściwy styl trafia bezpośrednio do konstruktora MapLibre',()=>{
  const source=read('map-runtime.js');
  assert.match(source,/const instance=new window\.maplibregl\.Map\(mapOptions\)/);
  assert.match(source,/style:styleFor\(nextTheme,nextProvider\)/);
  assert.doesNotMatch(source,/new Proxy/);
});

test('nocne barwy są częścią jednego runtime mapy',()=>{
  const source=read('map-runtime.js');
  assert.match(source,/function softenNightMap/);
  assert.match(source,/#20252a/);
  assert.match(source,/#193648/);
  assert.match(source,/#d5d9dd/);
});
