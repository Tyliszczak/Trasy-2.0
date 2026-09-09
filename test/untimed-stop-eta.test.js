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

test('górna belka dla przystanku bez godziny ma wyłącznie ETA i tłumi status punktualności',()=>{
  const source=read('untimed-stop-eta-ui.js');
  assert.match(source,/const isUntimed=/);
  assert.match(source,/status\.hidden=true/);
  assert.match(source,/guard\.hidden=true/);
  assert.match(source,/const value=`ETA \$\{arrivalClock\(latestEtaSeconds\)\}`/);
  assert.match(source,/new MutationObserver/);
});

test('wersja z poprawką ETA ładuje świeży parser i stabilizator nagłówka',()=>{
  const html=read('index.html');
  const sw=read('sw.js');
  assert.match(html,/data-version="2\.0\.214"/);
  assert.match(html,/time-core\.js\?v=4/);
  assert.match(html,/untimed-stop-eta-ui\.js\?v=2/);
  assert.match(sw,/APP_VERSION='2\.0\.214'/);
  assert.match(sw,/CACHE_NAME='trasy-2\.0-v247'/);
  assert.match(sw,/'\.\/untimed-stop-eta-ui\.js'/);
});
