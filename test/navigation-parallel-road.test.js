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
  const renderer=read('route-progress-style.js');
  assert.match(renderer,/function firstSymbolLayer/);
  assert.match(renderer,/function keepBelowLabels/);
  assert.match(renderer,/map\.moveLayer\(id,beforeId\)/);
  assert.match(renderer,/ACTIVE_OUTLINE/);
  assert.match(renderer,/ACTIVE_LINE/);
});

test('PTV przełącza się na fallback dopiero po potwierdzonej awarii',()=>{
  const runtime=read('map-runtime.js');
  assert.match(runtime,/FALLBACK_GRACE_MS=8000/);
  assert.match(runtime,/FALLBACK_CONFIRM_ATTEMPTS=3/);
  assert.match(runtime,/confirmPtvUnavailable/);
  assert.match(runtime,/scheduleFallback\('ptv-tile-errors'\)/);
  assert.match(runtime,/PTV_RETRY_MS=15000/);
});
