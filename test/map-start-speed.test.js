import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=path=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('nawigacja używa świeżej pozycji GPS-hub bez czekania na kolejny fix',()=>{
  const nav=read('nav-map.js');
  assert.match(nav,/function cachedPosition\(maxAgeMs=15000\)/);
  assert.match(nav,/__trasyGps\?\.current/);
  assert.match(nav,/Promise\.resolve\(cached\)/);
});

test('styl PTV jest rozgrzewany przed otwarciem mapy',()=>{
  const runtime=read('map-runtime.js');
  const html=read('index.html');
  assert.match(runtime,/__trasyPtvStyleWarmup=fetch\(PTV_STYLE/);
  assert.match(runtime,/cache:'force-cache'/);
  assert.ok(html.includes('rel="preconnect" href="https://vectormaps-resources.myptv.com"'));
});

test('gotowy pakiet offline jest wybierany od razu przy starcie mapy dziennej',()=>{
  const runtime=read('map-runtime.js');
  assert.match(runtime,/function offlinePackageReady\(\)/);
  assert.match(runtime,/if\(!navigator\.onLine\|\|offlinePackageReady\(\)\)return'openfreemap-liberty'/);
  assert.match(runtime,/const nextProvider=initialProviderFor\(nextTheme\)/);
});

test('awaria PTV nie uruchamia wielokrotnych długich prób przed fallbackiem',()=>{
  const runtime=read('map-runtime.js');
  assert.match(runtime,/const REQUEST_TIMEOUT_MS=3000/);
  assert.match(runtime,/const FALLBACK_GRACE_MS=1200/);
  assert.match(runtime,/const FALLBACK_CONFIRM_ATTEMPTS=1/);
  assert.match(runtime,/const STYLE_TIMEOUT_MS=5000/);
});
