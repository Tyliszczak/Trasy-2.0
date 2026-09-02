import test from'node:test';
import assert from'node:assert/strict';
import{readFileSync}from'node:fs';
import{join}from'node:path';

const root=join(import.meta.dirname,'..');
const read=file=>readFileSync(join(root,file),'utf8');

test('trasa nie jest przeliczana z pozycji GPS sprzed wybudzenia',()=>{
  const source=read('nav-map.js');
  assert.match(source,/MAX_ROUTE_GPS_AGE_MS=5000/);
  assert.match(source,/document\.visibilityState!=='visible'\|\|!lastGpsAt\|\|gpsAge<0\|\|gpsAge>MAX_ROUTE_GPS_AGE_MS/);
  assert.match(source,/cachedPosition\(MAX_ROUTE_GPS_AGE_MS\)/);
  assert.match(source,/Date\.now\(\)-lastGpsAt>MAX_ROUTE_GPS_AGE_MS/);
});

test('brak Google Traffic jest obsłużonym fallbackiem, a nie odrzuconą obietnicą',()=>{
  const source=read('google-routes-provider.js');
  assert.match(source,/googleTrafficData\(coords,init\?\.signal\)\.catch\(error=>\{trafficError=error;return null\}\)/);
  assert.match(source,/Promise\.resolve\(null\)/);
  assert.match(source,/if\(!googleData\)\{/);
  assert.doesNotMatch(source,/Promise\.reject\(Error\('Brak punktów do Google Traffic'\)\)/);
});

test('wersja testowa ładuje jawnie poprawki z analizy przejazdu',()=>{
  const html=read('index.html');
  assert.match(html,/TEST 2\.0\.195/);
  assert.match(html,/app\.js\?v=active-course-1/);
  assert.match(html,/return-route\.js\?v=pinned-course-1/);
  assert.match(html,/google-routes-provider\.js\?v=handled-fallback-1/);
  assert.match(html,/nav-map\.js\?v=fresh-resume-1/);
});
