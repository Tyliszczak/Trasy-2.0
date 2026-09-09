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

test('górna belka nawigacji pokazuje ETA gdy aktywny przystanek nie ma godziny',()=>{
  const source=read('untimed-stop-eta-ui.js');
  assert.match(source,/if\(planText\(row\)\)/);
  assert.match(source,/plan\.textContent=`ETA \$\{arrivalClock\(seconds\)\}`/);
  assert.match(source,/addEventListener\('nav-eta-update'/);
  assert.match(source,/addEventListener\('eta-status-change'/);
});

test('moduł ETA bez godziny jest ładowany i dostępny offline w 2.0.213',()=>{
  const html=read('index.html');
  const sw=read('sw.js');
  assert.match(html,/data-version="2\.0\.213"/);
  assert.match(html,/untimed-stop-eta-ui\.js\?v=1/);
  assert.match(sw,/APP_VERSION='2\.0\.213'/);
  assert.match(sw,/'\.\/untimed-stop-eta-ui\.js'/);
});
