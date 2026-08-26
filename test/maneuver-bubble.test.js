import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=path=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');
const bubble=read('maneuver-bubble.js');
const mapUi=read('map-night-ui.js');
const sw=read('sw.js');

test('manewr i odległość są przenoszone z górnej belki do stałego dymka okna',()=>{
  assert.match(bubble,/getElementById\('routeManeuver'\)/);
  assert.match(bubble,/getElementById\('routeManeuverDistance'\)/);
  assert.match(bubble,/bubble\.append\(maneuver,distance\)/);
  assert.match(bubble,/position:fixed/);
  assert.match(bubble,/left:50%/);
  assert.match(bubble,/top:73dvh/);
  assert.match(bubble,/document\.body\.appendChild\(bubble\)/);
});

test('dymek nie jest powiązany z mapą, GPS ani wskaźnikiem pojazdu',()=>{
  assert.doesNotMatch(bubble,/new maplibregl\.Marker/);
  assert.doesNotMatch(bubble,/gps\.subscribe/);
  assert.doesNotMatch(bubble,/getBoundingClientRect/);
  assert.doesNotMatch(bubble,/requestAnimationFrame/);
  assert.doesNotMatch(bubble,/findVehicleElement/);
});

test('górna belka nie trzyma już marginesu po manewrze, a nazwa przystanku jest lekko mniejsza',()=>{
  assert.match(bubble,/infoRow\.style\.marginTop='0'/);
  assert.match(mapUi,/#routeNextStop \.nextStopMain\{font-size:13px!important/);
});

test('dymek manewrów jest dostępny także z cache PWA',()=>{
  assert.match(mapUi,/maneuver-bubble\.js\?v=2/);
  assert.match(sw,/\.\/maneuver-bubble\.js/);
});
