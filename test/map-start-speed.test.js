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
  const hook=read('maplibre-route-hook.js');
  const html=read('index.html');
  assert.match(hook,/__trasyPtvStyleWarmup=fetch\(PTV_STYLE/);
  assert.match(hook,/cache:'force-cache'/);
  assert.match(html,/rel="preconnect" href="https:\\/\\/vectormaps-resources\.myptv\.com"/);
});
