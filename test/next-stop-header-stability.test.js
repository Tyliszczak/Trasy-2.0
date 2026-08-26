import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=path=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('planowa godzina ma własną stałą linię w górnej belce',()=>{
  const source=read('next-stop-header.js'),css=read('navigation.css');
  assert.match(source,/nextStopPlan/);
  assert.match(source,/planEl\.textContent!==plan/);
  assert.match(css,/nextStopPlan\{display:block;min-height:14px/);
  assert.match(css,/nextStopPlan:empty\{visibility:hidden\}/);
});

test('chwilowo pusty odczyt nie kasuje godziny bieżącego przystanku',()=>{
  const source=read('next-stop-header.js');
  assert.match(source,/let cachedPlanRow=null/);
  assert.match(source,/function stablePlanText\(row\)/);
  assert.match(source,/else if\(fresh\)\{\s*cachedPlan=fresh/);
  assert.match(source,/return\{name,plan:stablePlanText\(row\)\}/);
});

test('zmiana kierunku lub harmonogramu resetuje cache planowej godziny',()=>{
  const source=read('next-stop-header.js');
  assert.match(source,/function resetPlanCache/);
  assert.match(source,/route-direction-change[^\n]+resetPlanCache/);
  assert.match(source,/route-mode-change[^\n]+resetPlanCache/);
  assert.match(source,/schedule-rendered[^\n]+resetPlanCache/);
});

test('ETA powrotu nie usuwa planowej godziny z komórki harmonogramu',()=>{
  const source=read('eta-status.js');
  assert.match(source,/appendChild\(infoEl\)/);
  assert.doesNotMatch(source,/replaceChildren\(info\)/);
});

test('START powrotu jest renderowany przez ten sam nagłówek',()=>{
  const source=read('next-stop-header.js');
  assert.match(source,/function renderReturnStart/);
  assert.match(source,/START TRASY POWROTNEJ/);
  assert.match(source,/planEl\.textContent=start\?`Start \$\{start\}`:''/);
});
