import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=path=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('aktywna nawigacja przekazuje OSRM świeży kierunek jazdy bez dodatkowej łatki',()=>{
  const index=read('index.html');
  const sw=read('sw.js');
  const nav=read('nav-map.js');
  const provider=read('google-routes-provider.js');
  assert.match(nav,/router\.project-osrm\.org\/route\/v1\/driving/);
  assert.match(nav,/overview=full&geometries=geojson&steps=true&annotations=duration,distance/);
  assert.match(nav,/startDirectionQuery\(stops\)/);
  assert.match(nav,/updateNavigationMotion\(position,ll\)/);
  assert.match(nav,/routeUsesStartDirection/);
  assert.match(nav,/Korekta kierunku trasy/);
  assert.match(nav,/if\(!res\.ok&&usedStartDirection\)/);
  assert.doesNotMatch(provider,/continue_straight|bearings=/);
  assert.doesNotMatch(index,/navigation-guidance-fix\.js/);
  assert.doesNotMatch(sw,/navigation-guidance-fix\.js/);
});
