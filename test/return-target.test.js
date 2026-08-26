import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const tracker=fs.readFileSync(new URL('../gps-stop-tracker.js',import.meta.url),'utf8');
const engine=fs.readFileSync(new URL('../gps-stop-engine.js',import.meta.url),'utf8');

test('punkt START na powrocie nigdy nie jest celem GPS',()=>{
  assert.match(tracker,/direction==='return'&&body\.dataset\.emptyRun!=='1'\?1:0/);
  assert.match(tracker,/minimumIndex:minimumTargetIndex\(\)/);
  assert.match(engine,/firstIndex/);
});
