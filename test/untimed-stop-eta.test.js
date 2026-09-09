import test from'node:test';
import assert from'node:assert/strict';
import fs from'node:fs';
const read=path=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('aktywny przystanek bez planu pokazuje ETA zamiast statusu punktualności',()=>{
  const source=read('eta-status.js');
  assert.match(source,/if\(plan===null\)\{/);
  assert.match(source,/setInfo\(info,'etaPunctuality etaOnly',`ETA \$\{arrivalClock\(etaSecondsLive\)\}`\)/);
  assert.match(source,/broadcastStatus\('neutral',null,etaSecondsLive\)/);
  assert.match(source,/--gps-status-color','#078df0'/);
});

test('dynamiczne ETA w komórce nie może zostać odczytane jako godzina planowa',()=>{
  const source=read('time-core.js');
  assert.match(source,/function staticCellText\(cell\)/);
  assert.match(source,/node\?\.nodeType===3/);
  assert.doesNotMatch(source,/cell\.textContent\s*\n\s*\]/);
});

test('górna belka dla przystanku bez godziny ma wyłącznie Dojazd i tłumi status punktualności',()=>{
  const source=read('untimed-stop-eta-ui.js');
  assert.match(source,/const isUntimed=/);
  assert.match(source,/status\.hidden=true/);
  assert.match(source,/guard\.hidden=true/);
  assert.match(source,/const value=`Dojazd \$\{arrivalClock\(latestEtaSeconds\)\}`/);
  assert.match(source,/scheduleInfo&&scheduleInfo\.textContent!==value/);
});

test('moduł ETA nie używa MutationObservera, który może zapętlić render nagłówka',()=>{
  const source=read('untimed-stop-eta-ui.js');
  assert.doesNotMatch(source,/MutationObserver/);
  assert.match(source,/function queueRender\(\)\{if\(queued\)return;queued=true;queueMicrotask\(render\)\}/);
});

test('wersja z poprawką zamrożenia ładuje świeży moduł ETA',()=>{
  const html=read('index.html');
  const sw=read('sw.js');
  assert.match(html,/data-version="2\.0\.217"/);
  assert.match(html,/time-core\.js\?v=4/);
  assert.match(html,/untimed-stop-eta-ui\.js\?v=3/);
  assert.match(sw,/APP_VERSION='2\.0\.217'/);
  assert.match(sw,/CACHE_NAME='trasy-2\.0-v250'/);
  assert.match(sw,/'\.\/untimed-stop-eta-ui\.js'/);
});
