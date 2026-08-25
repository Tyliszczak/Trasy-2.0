import assert from'node:assert/strict';
import{readFile}from'node:fs/promises';
import test from'node:test';

const read=name=>readFile(new URL(`../${name}`,import.meta.url),'utf8');

test('baner aktualizacji nie pojawia się gdy strona już ma wersję oczekującego workera',async()=>{
  const[html,app,sw]=await Promise.all([read('index.html'),read('app.js'),read('sw.js')]);
  const pageVersion=html.match(/id="globalTestVersion"\s+data-version="([^"]+)"/)?.[1];
  const workerVersion=sw.match(/const APP_VERSION='([^']+)'/)?.[1];
  assert.ok(pageVersion);
  assert.equal(workerVersion,pageVersion);
  assert.match(app,/waitingVersion===currentVersion/);
  assert.match(app,/reason:'already-loaded'/);
  assert.match(sw,/type==='GET_VERSION'/);
});

test('ręczne ODŚWIEŻ nadal aktywuje naprawdę nowszy worker i przeładowuje stronę',async()=>{
  const app=await read('app.js');
  assert.match(app,/updateRequested=true/);
  assert.match(app,/reason:'user-request'/);
  assert.match(app,/if\(updateRequested\)location\.reload\(\)/);
});
