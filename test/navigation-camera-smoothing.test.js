import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=path=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('kamera dopasowuje czas animacji do odstępu między kolejnymi GPS',()=>{
  const source=read('navigation-ui-controls.js');
  assert.match(source,/CAMERA_MIN_DURATION_MS=550/);
  assert.match(source,/CAMERA_MAX_DURATION_MS=1350/);
  assert.match(source,/CAMERA_INTERVAL_FACTOR=1\.12/);
  assert.match(source,/this\.lastFollowAt/);
  assert.match(source,/interval\*CAMERA_INTERVAL_FACTOR/);
});

test('normalne prowadzenie używa ruchu ciągłego zamiast krótkiego ease-out',()=>{
  const source=read('navigation-ui-controls.js');
  assert.match(source,/this\.moveToTarget\(this\.latestTarget,duration,true\)/);
  assert.match(source,/easing:continuous\?\(t=>t\):\(t=>1-Math\.pow\(1-t,3\)\)/);
  assert.match(source,/this\.moveToTarget\(target,650,false\)/);
});
