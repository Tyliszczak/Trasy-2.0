import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { isNightAt,solarElevationDeg } from '../map-theme-core.js';

const readSource=name=>readFile(new URL(`../${name}`,import.meta.url),'utf8');

test('astronomiczny motyw mapy rozpoznaje dzień i noc',()=>{
  const latitude=52.2297,longitude=21.0122;
  const summerNoon=new Date('2026-06-21T10:00:00Z');
  const summerNight=new Date('2026-06-21T23:00:00Z');
  assert.ok(solarElevationDeg(summerNoon,latitude,longitude)>0);
  assert.equal(isNightAt(summerNoon,latitude,longitude),false);
  assert.equal(isNightAt(summerNight,latitude,longitude),true);
});

test('nocna mapa używa oficjalnego ciemnego stylu i przełącza się automatycznie',async()=>{
  const source=await readSource('map-day-night.js');
  assert.match(source,/https:\/\/tiles\.openfreemap\.org\/styles\/dark/);
  assert.match(source,/isNightAt\(new Date\(\),point\.lat,point\.lon\)/);
  assert.match(source,/CHECK_MS=60000/);
  assert.match(source,/map\.setStyle\(target,\{diff:false\}\)/);
  assert.match(source,/map\.once\('style\.load'/);
});

test('zmiana motywu odtwarza trasę i zachowuje e-TOLL nad linią trasy',async()=>{
  const source=await readSource('map-day-night.js');
  assert.match(source,/snapshotRoute/);
  assert.match(source,/restoreRoute/);
  assert.match(source,/route-outline/);
  assert.match(source,/route-line/);
  assert.match(source,/etoll-lubuskie-line/);
});

test('PWA ładuje i cacheuje moduły automatycznego dnia i nocy',async()=>{
  const [html,worker]=await Promise.all([readSource('index.html'),readSource('sw.js')]);
  assert.match(html,/map-day-night\.js\?v=1/);
  assert.match(worker,/\.\/map-theme-core\.js/);
  assert.match(worker,/\.\/map-day-night\.js/);
  assert.match(html,/TEST 2\.0\.121/);
  assert.match(worker,/APP_VERSION='2\.0\.121'/);
});
