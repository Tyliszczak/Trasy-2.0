import assert from 'node:assert/strict';
import { access,readFile } from 'node:fs/promises';
import test from 'node:test';
const read=name=>readFile(new URL(`../${name}`,import.meta.url),'utf8');

const gone=[
  'app-update-check.js','maplibre-route-hook.js','ptv-basemap.js','map-day-night.js','map-night-ui.js',
  'return-gps-mode.js','return-start-navigation.js','return-start-header-fix.js','return-start-guard.js',
  'eta-clock-ui.js','navigation-guidance-fix.js','vehicle-speed-profile-core.js'
];

test('historyczne łatki i proxy zostały fizycznie usunięte',async()=>{
  for(const name of gone)await assert.rejects(()=>access(new URL(`../${name}`,import.meta.url)));
  const html=await read('index.html');
  for(const name of gone)assert.doesNotMatch(html,new RegExp(name.replaceAll('.','\\.')));
});

test('mapa ma jednego właściciela bez Proxy konstruktora MapLibre',async()=>{
  const [runtime,nav,renderer]=await Promise.all([read('map-runtime.js'),read('nav-map.js'),read('route-progress-style.js')]);
  assert.match(runtime,/window\.__trasyMapRuntime=/);
  assert.match(runtime,/createMap/);
  assert.doesNotMatch(runtime,/new Proxy/);
  assert.match(nav,/__trasyMapRuntime\?\.createMap/);
  assert.doesNotMatch(nav,/tile\.openstreetmap\.org/);
  assert.match(nav,/__trasyRouteRenderer/);
  assert.match(renderer,/window\.__trasyRouteRenderer=/);
  assert.doesNotMatch(renderer,/map\.addSource=function|source\.setData=function|__trasyProgressRawSetData/);
});

test('kamera i marker nie są monkey-patchowane globalnie',async()=>{
  const [live,controls,nav]=await Promise.all([read('navigation-live-engine.js'),read('navigation-ui-controls.js'),read('nav-map.js')]);
  assert.doesNotMatch(live,/Marker\.prototype|proto\.setLngLat\s*=|controller\.follow\s*=|controller\.moveToTarget\s*=/);
  assert.match(live,/__routeCameraProfile/);
  assert.match(controls,/class RouteCameraController/);
  assert.match(controls,/const profile=window\.__routeCameraProfile/);
  assert.match(nav,/function setVehiclePosition/);
});

test('START powrotu ma jednego właściciela, a GPS pomija indeks zero',async()=>{
  const [route,tracker,engine,header]=await Promise.all([read('return-route.js'),read('gps-stop-tracker.js'),read('gps-stop-engine.js'),read('next-stop-header.js')]);
  assert.match(route,/returnOriginActive/);
  assert.match(route,/onReturnPosition/);
  assert.match(route,/return-origin-change/);
  assert.match(tracker,/function minimumTargetIndex/);
  assert.match(tracker,/minimumIndex:minimumTargetIndex\(\)/);
  assert.match(engine,/minimumIndex=0/);
  assert.match(header,/START TRASY POWROTNEJ/);
  assert.match(header,/returnOriginActive==='1'/);
});

test('core UI nie wstrzykuje już kolejnych arkuszy stylów w runtime',async()=>{
  for(const name of['next-stop-header.js','eta-status.js','gps-stop-tracker.js','return-route.js','navigation-ui-controls.js']){
    assert.doesNotMatch(await read(name),/createElement\(['"]style['"]\)/,name);
  }
  const html=await read('index.html');
  assert.match(html,/navigation\.css\?v=\d+/);
});

test('stare wyznaczanie trasy jest anulowane po zmianie celu',async()=>{
  const source=await read('nav-map.js');
  assert.match(source,/routeAbortController\?\.abort\(\)/);
  assert.match(source,/signal:controller\.signal/);
});

test('e-TOLL instaluje się zdarzeniowo bez 30-sekundowego pollingu',async()=>{
  const source=await read('etoll-overlay.js');
  assert.match(source,/trasy:route-map-ready/);
  assert.doesNotMatch(source,/setInterval/);
});

test('nawigacja odzyskuje świeżą pozycję po wybudzeniu',async()=>{
  const [gps,nav,wake]=await Promise.all([read('gps-hub.js'),read('nav-map.js'),read('wake-style.js')]);
  assert.match(gps,/function refresh/);
  assert.match(nav,/recoverNavigation/);
  assert.match(nav,/trasy:navigation-resumed/);
  assert.match(wake,/setNavigationWake/);
});
