import assert from'node:assert/strict';
import{readFile}from'node:fs/promises';
import test from'node:test';

const readSource=name=>readFile(new URL(`../${name}`,import.meta.url),'utf8');

test('status ETA pozostaje widoczny przy przejściowym braku danych',async()=>{
  const source=await readSource('eta-status.js');
  assert.doesNotMatch(source,/ETA_HIDE_GRACE_MS|hideInfoTimer/);
  assert.match(source,/etaSecondsLive===null\)return/);
  assert.match(source,/plan===null\)return/);
  assert.doesNotMatch(source,/etaSecondsLive===null\)[^{;]*\{?hideInfo/);
  assert.match(source,/if\(guardIsShowing\(\)\)return/);
});

test('powtórne zdarzenie tego samego celu nie usuwa widocznego ETA',async()=>{
  const source=await readSource('eta-status.js');
  assert.match(source,/sameVisibleTarget/);
  assert.match(source,/if\(sameVisibleTarget\)\{refreshEta\(true\)\.then\(render\);return\}/);
});

test('wynik ETA jest przypisany do konkretnego przystanku',async()=>{
  const source=await readSource('eta-status.js');
  assert.match(source,/let etaSeconds=null,etaMeasuredAt=0,etaTargetKey=''/);
  assert.match(source,/etaTargetKey!==rowKey\(row\)/);
  assert.match(source,/rowKey\(activeRow\(\)\)===requestedTargetKey/);
  assert.match(source,/etaTargetKey=requestedTargetKey/);
});
