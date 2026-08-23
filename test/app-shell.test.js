import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { ROUTES } from '../routes.js';
import { getParkingOptions,normalizeCoordinate } from '../parking-data.js';
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
  assert.match(source,/trasy-2\.0-v96/);
  assert.match(source,/\.\/gps-hub\.js/);
  assert.match(source,/\.\/route-data-service\.js/);
  assert.match(source,/\.\/parking-data\.js/);
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

test('jeden moduł utrzymuje fizyczny nasłuch GPS',async()=>{
  const names=['gps-hub.js','gps-stop-tracker.js','eta-status.js','return-start-guard.js','skip-detection.js','nav-map.js'];
  const sources=await Promise.all(names.map(readSource));
  assert.equal(sources.filter(source=>/watchPosition/.test(source)).length,1);
  assert.match(sources[0],/subscriberCount/);
  sources.slice(1).forEach(source=>assert.match(source,/__trasyGps/));
});

test('kierunki korzystają ze wspólnego źródła danych tras',async()=>{
  const [service,app,returnRoute]=await Promise.all([
    readSource('route-data-service.js'),readSource('app.js'),readSource('return-route.js')
  ]);
  assert.match(service,/script\.google\.com/);
  assert.doesNotMatch(app,/script\.google\.com/);
  assert.doesNotMatch(returnRoute,/script\.google\.com/);
  assert.match(app,/__trasyRouteDataService/);
  assert.match(returnRoute,/__trasyRouteDataService/);
});

test('Na pusto jest niezależne od Powrotu i prowadzi do ostatniego punktu kierunku',async()=>{
  const [returnRoute,nav]=await Promise.all([readSource('return-route.js'),readSource('nav-map.js')]);
  assert.match(returnRoute,/id="emptyRouteSwitch"/);
  assert.match(returnRoute,/id="returnRouteSwitch"/);
  assert.match(returnRoute,/body\.dataset\.emptyRun/);
  assert.match(nav,/remaining\[remaining\.length-1\]/);
});

test('parking wspólny i parking przypisany do trasy są poprawnie wybierane',()=>{
  const data={PARKINGI:[
    ['NAZWA','LOKALIZACJA','TRASA'],
    ['Baza','51.10, 15.20','*'],
    ['Sulechów','51.20;15.30','SAS Sulechów'],
    ['Inna trasa','51.30, 15.40','TopPoint'],
    ['Duplikat','51.10, 15.20','']
  ]};
  assert.deepEqual(getParkingOptions(data,'SAS Sulechów'),[
    {name:'Baza',coordinates:'51.1, 15.2'},
    {name:'Sulechów',coordinates:'51.2, 15.3'}
  ]);
  assert.equal(normalizeCoordinate('91, 15'),'');
});

test('przycisk kompasu jest usunięty, a nawigacja pojawia się poza prowadzeniem',async()=>{
  const source=await readSource('navigation-ui-controls.js');
  assert.doesNotMatch(source,/compassIcon|Kompas \/ widok prowadzenia/);
  assert.match(source,/center\.hidden=guidance/);
  assert.match(source,/center\.title='Wróć do nawigacji'/);
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
