import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=path=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');
const bubble=read('maneuver-bubble.js');
const mapUi=read('map-night-ui.js');
const sw=read('sw.js');

test('manewr i odległość są przenoszone z górnej belki do dymka pod wskaźnikiem',()=>{
  assert.match(bubble,/getElementById\('routeManeuver'\)/);
  assert.match(bubble,/getElementById\('routeManeuverDistance'\)/);
  assert.match(bubble,/bubble\.append\(maneuver,distance\)/);
  assert.match(bubble,/anchor:'top'/);
  assert.match(bubble,/offset:\[0,27\]/);
  assert.match(bubble,/gps\.subscribe\(updatePosition/);
});

test('górna belka nie trzyma już marginesu po manewrze, a nazwa przystanku jest lekko mniejsza',()=>{
  assert.match(bubble,/infoRow\.style\.marginTop='0'/);
  assert.match(mapUi,/#routeNextStop \.nextStopMain\{font-size:13px!important/);
});

test('dymek manewrów jest dostępny także z cache PWA',()=>{
  assert.match(mapUi,/maneuver-bubble\.js\?v=1/);
  assert.match(sw,/\.\/maneuver-bubble\.js/);
});
