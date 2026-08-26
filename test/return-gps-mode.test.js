import test from'node:test';
import assert from'node:assert/strict';
import fs from'node:fs';

const source=fs.readFileSync(new URL('../return-gps-mode.js',import.meta.url),'utf8');

test('punkt START na powrocie nigdy nie jest celem GPS',()=>{
  assert.match(source,/current>0/);
  assert.match(source,/for\(let index=1;index<rows\.length;index\+=1\)/);
  assert.match(source,/source:'return-start-excluded'/);
  assert.match(source,/gps-skip-stop/);
});

test('po restarcie podczas postoju wybierany jest najbliższy rzeczywisty przystanek bez limitu 600 m',()=>{
  assert.match(source,/bestDistance=Infinity/);
  assert.match(source,/geo\.distanceMeters\(here,target\)/);
  assert.doesNotMatch(source,/600/);
  assert.match(source,/gps\?\.current\?\.\(\)/);
  assert.match(source,/gps\?\.subscribe/);
});
