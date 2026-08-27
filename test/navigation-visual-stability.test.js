import test from'node:test';
import assert from'node:assert/strict';
import fs from'node:fs';
const read=path=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('zanikanie przejechanej trasy jest dopasowane do odstępu GPS i liniowe',()=>{
  const source=read('route-progress-style.js');
  assert.match(source,/ERASE_MIN_MS=550/);
  assert.match(source,/ERASE_MAX_MS=1400/);
  assert.match(source,/interval\*ERASE_INTERVAL_FACTOR/);
  assert.match(source,/displayRoutePosition=animationFromPosition\+\(targetRoutePosition-animationFromPosition\)\*linear/);
  assert.doesNotMatch(source,/1-Math\.pow\(1-linear,3\)/);
});

test('aktywny przystanek nie jest przełączany klasami przy każdym odczycie GPS',()=>{
  const source=read('gps-stop-tracker.js');
  assert.match(source,/if\(changed\)\{\s*body\.querySelectorAll\('tr'\)/s);
});

test('podświetlenie aktywnego przystanku ma spokojny pasek zamiast pełnej kolorowej ramki',()=>{
  const source=read('index.html');
  assert.match(source,/#scheduleBody tr\.gpsNextStop\{background:rgba\(255,255,255,\.045\)!important;box-shadow:inset 5px 0 0 var/);
  assert.doesNotMatch(source,/inset 0 1\.5px 0 var\(--gps-status-color/);
});
