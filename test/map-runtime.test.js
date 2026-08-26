import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=path=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('PTV jest główną mapą, OpenFreeMap nocą i jako fallback',()=>{
  const source=read('map-runtime.js');
  assert.match(source,/vectormaps-resources\.myptv\.com\/styles\/latest\/standard\.json/);
  assert.match(source,/tiles\.openfreemap\.org\/styles\/liberty/);
  assert.match(source,/tiles\.openfreemap\.org\/styles\/dark/);
  assert.match(source,/FALLBACK_GRACE_MS=8000/);
  assert.match(source,/FALLBACK_CONFIRM_ATTEMPTS=3/);
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
