import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
const read=name=>readFile(new URL(`../${name}`,import.meta.url),'utf8');

test('app.js jest jedynym właścicielem sprawdzania aktualizacji PWA',async()=>{
  const [app,index,sw]=await Promise.all([read('app.js'),read('index.html'),read('sw.js')]);
  assert.match(app,/CHECK_INTERVAL_MS=10\*60\*1000/);
  assert.match(app,/setInterval\(checkForUpdate,CHECK_INTERVAL_MS\)/);
  assert.match(app,/getElementById\('showSchedule'\)\?\.addEventListener\('click'/);
  assert.match(app,/await reg\.update\(\)/);
  assert.doesNotMatch(index,/app-update-check\.js/);
  assert.doesNotMatch(sw,/app-update-check\.js/);
});
