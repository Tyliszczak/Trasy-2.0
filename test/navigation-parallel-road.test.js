import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=path=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('prowadzenie nie skanuje całej przyszłej trasy przy każdym GPS',()=>{
  const nav=read('nav-map.js');
  const live=read('navigation-live-engine.js');
  assert.match(nav,/ROUTE_PROGRESS_LOOKAHEAD_M=1200/);
  assert.match(nav,/function routeWindow/);
  assert.doesNotMatch(live,/snap=nearestRouteIndex\(routeModel\.points,here\);/);
});

test('zielona trasa pozostaje pod symbolami i numerami dróg',()=>{
  const nav=read('nav-map.js');
  const progress=read('route-progress-style.js');
  const ptv=read('ptv-basemap.js');
  assert.match(nav,/layer=>layer\.type==='symbol'/);
  assert.match(progress,/keepRouteBelowMapLabels/);
  assert.match(progress,/map\.moveLayer\(id,beforeId\)/);
  assert.match(ptv,/layer=>layer\.type==='symbol'/);
});

test('PTV nie przełącza się na fallback po samych pojedynczych błędach kafelków',()=>{
  const ptv=read('ptv-basemap.js');
  assert.match(ptv,/currentHealthTile/);
  assert.match(ptv,/verifyPtvBeforeFallback/);
  assert.match(ptv,/scheduleFallback\('ptv-health-failed'\)/);
  assert.match(ptv,/FALLBACK_CONFIRM_ATTEMPTS=3/);
});
