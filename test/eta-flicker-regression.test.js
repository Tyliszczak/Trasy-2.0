import assert from'node:assert/strict';
import{readFile}from'node:fs/promises';
import test from'node:test';

const readSource=name=>readFile(new URL(`../${name}`,import.meta.url),'utf8');

test('status ETA nie jest czyszczony natychmiast przy przejściowym braku danych',async()=>{
  const source=await readSource('eta-status.js');
  assert.match(source,/const ETA_HIDE_GRACE_MS=450/);
  assert.match(source,/hideInfo\(row,\{defer:true\}\)/);
  assert.match(source,/etaSecondsLive===null\)\{hideInfo\(row,\{defer:true\}\);return\}/);
  assert.match(source,/plan===null\)\{hideInfo\(row,\{defer:true\}\);return\}/);
  assert.doesNotMatch(source,/etaSecondsLive===null\)\{hideInfo\(row\);return\}/);
});

test('powtórne zdarzenie tego samego celu nie usuwa widocznego ETA',async()=>{
  const source=await readSource('eta-status.js');
  assert.match(source,/sameVisibleTarget/);
  assert.match(source,/if\(sameVisibleTarget\)\{refreshEta\(true\)\.then\(render\);return\}/);
});
