import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=path=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('planowa godzina ma własną stałą linię w górnej belce',()=>{
  const source=read('next-stop-header.js');
  assert.match(source,/nextStopPlan/);
  assert.match(source,/min-height:14px/);
  assert.match(source,/planEl\.textContent=data\?\.plan\|\|''/);
  assert.match(source,/nextStopPlan:empty\{visibility:hidden\}/);
});

test('ETA powrotu nie usuwa planowej godziny z komórki harmonogramu',()=>{
  const source=read('eta-status.js');
  assert.match(source,/appendChild\(infoEl\)/);
  assert.doesNotMatch(source,/replaceChildren\(info\)/);
});

test('start powrotu używa tej samej stałej linii godziny',()=>{
  const source=read('return-start-header-fix.js');
  assert.match(source,/nextStopPlan/);
  assert.match(source,/plan\.textContent=start\?`Start \$\{start\}`:''/);
});
