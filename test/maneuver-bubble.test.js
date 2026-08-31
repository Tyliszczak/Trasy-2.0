import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const bubble=fs.readFileSync(new URL('../maneuver-bubble.js',import.meta.url),'utf8');
const css=fs.readFileSync(new URL('../navigation.css',import.meta.url),'utf8');
const bootstrap=fs.readFileSync(new URL('../driver-access-bootstrap.js',import.meta.url),'utf8');

test('manewr jest stałym elementem okna, nie markerem mapy',()=>{
  assert.match(bubble,/document\.body\.appendChild\(bubble\)/);
  assert.doesNotMatch(bubble,/maplibregl|setLngLat|__trasyGps|requestAnimationFrame/);
  assert.match(css,/#routeManeuverBubble\{position:fixed;left:50%;top:73dvh/);
});

test('dymek jest ładowany jawnie raz i cacheowany przez PWA',()=>{
  const sw=fs.readFileSync(new URL('../sw.js',import.meta.url),'utf8');
  assert.equal((bootstrap.match(/maneuver-bubble\.js/g)||[]).length,1);
  assert.match(sw,/\.\/maneuver-bubble\.js/);
});
