import assert from'node:assert/strict';
import{readFile}from'node:fs/promises';
import test from'node:test';

const source=await readFile(new URL('../return-start-guard.js',import.meta.url),'utf8');

test('wczesny wyjazd na powrocie pokazuje zamykany alert przez 20 sekund',()=>{
  assert.match(source,/const WARNING_MS=20000/);
  assert.match(source,/ODJECHAŁEŚ PRZED CZASEM/);
  assert.match(source,/Planowany start:/);
  assert.match(source,/returnEarlyDeparturePulse/);
  assert.match(source,/returnEarlyDepartureWarning/);
  assert.match(source,/<button type="button">OK<\/button>/);
  assert.match(source,/querySelector\('button'\)\.onclick=hideWarning/);
  assert.match(source,/warningTimer=setTimeout\(hideWarning,WARNING_MS\)/);
});
