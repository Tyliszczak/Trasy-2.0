import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { ROUTES } from '../routes.js';
import { getRoute, getSchedule, mapUrl } from '../schedule.js';

const readSource=(name)=>readFile(new URL(`../${name}`,import.meta.url),'utf8');

test('główny ekran nie ładuje nieużywanego Leafleta',async()=>{
  const html=await readSource('index.html');
  assert.doesNotMatch(html,/leaflet/i);
  assert.match(html,/maplibre-gl@5\.12\.0/);
});

test('stara lekka nawigacja została usunięta',async()=>{
  const source=await readSource('wake-style.js');
  assert.doesNotMatch(source,/lightNav/);
  assert.doesNotMatch(source,/watchPosition/);
  assert.doesNotMatch(source,/router\.project-osrm\.org/);
});

test('blokadą ekranu zarządza tylko jeden moduł',async()=>{
  const [app,wake]=await Promise.all([readSource('app.js'),readSource('wake-style.js')]);
  assert.doesNotMatch(app,/wakeLock\.request/);
  assert.match(wake,/wakeLock\.request\('screen'\)/);
});

test('service worker nie przeładowuje aplikacji natychmiast po instalacji',async()=>{
  const source=await readSource('sw.js');
  const installHandler=source.split('\n').find(line=>line.includes("addEventListener('install'"))||'';
  assert.doesNotMatch(installHandler,/skipWaiting/);
  assert.match(source,/type==='SKIP_WAITING'/);
});

test('pełna lokalna powłoka mapy znajduje się w cache PWA',async()=>{
  const source=await readSource('sw.js');
  assert.match(source,/\.\/maplibre-route-hook\.js/);
  assert.match(source,/trasy-2\.0-v94/);
});

test('odświeżenie PWA wymaga działania kierowcy',async()=>{
  const source=await readSource('app.js');
  assert.match(source,/if\(!reg\.waiting\)return/);
  assert.match(source,/updateRequested=true/);
  assert.match(source,/if\(updateRequested\)location\.reload\(\)/);
});

test('nagłówek następnego przystanku nie odpytuje DOM co pół sekundy',async()=>{
  const source=await readSource('next-stop-header.js');
  assert.doesNotMatch(source,/setInterval/);
});

test('dane zapasowe tworzą kompletny harmonogram każdej zmiany',()=>{
  assert.ok(ROUTES.length>0);
  for(const route of ROUTES){
    assert.equal(getRoute(ROUTES,route.name),route);
    assert.ok(route.times.length>0,`${route.name}: brak oznaczeń zmian`);
    assert.ok(route.stops.length>0,`${route.name}: brak przystanków`);
    for(const time of route.times){
      const schedule=getSchedule(route,time);
      assert.equal(schedule.length,route.stops.length,`${route.name} ${time}: niepełny harmonogram`);
    }
  }
});

test('link mapy koduje współrzędne bez zmiany wartości',()=>{
  const coordinates='51.123, 15.456';
  const url=mapUrl(coordinates);
  assert.equal(new URL(url).searchParams.get('query'),coordinates);
});
