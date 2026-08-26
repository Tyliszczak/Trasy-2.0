from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def read(name): return (ROOT/name).read_text(encoding='utf-8')
def write(name,text): (ROOT/name).write_text(text,encoding='utf-8')

shell=read('test/app-shell.test.js')
shell=shell.replace("assert.match(limit,/source: hasLimit \\? 'ptv-map-matching' : ''/);","assert.match(limit,/source:hasLimit\\?'ptv-map-matching':''/);")
write('test/app-shell.test.js',shell)

write('test/navigation-parallel-road.test.js',r'''import test from 'node:test';
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
''')

write('test/routing-defaults.test.js',r'''import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=path=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('aktywna nawigacja używa standardowego OSRM driving bez własnego wymuszania kierunku',()=>{
  const index=read('index.html');
  const sw=read('sw.js');
  const nav=read('nav-map.js');
  const provider=read('google-routes-provider.js');
  assert.match(nav,/router\.project-osrm\.org\/route\/v1\/driving/);
  assert.match(nav,/overview=full&geometries=geojson&steps=true&annotations=duration,distance/);
  assert.doesNotMatch(nav,/continue_straight|bearings=/);
  assert.doesNotMatch(provider,/continue_straight|bearings=/);
  assert.doesNotMatch(index,/navigation-guidance-fix\.js/);
  assert.doesNotMatch(sw,/navigation-guidance-fix\.js/);
});
''')

Path(__file__).unlink()
