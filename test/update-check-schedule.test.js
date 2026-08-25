import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const readSource=name=>readFile(new URL(`../${name}`,import.meta.url),'utf8');

test('aktualizacje są sprawdzane przy starcie, co 10 minut i przy harmonogramie',async()=>{
  const [app,checker,index,sw]=await Promise.all([
    readSource('app.js'),
    readSource('app-update-check.js'),
    readSource('index.html'),
    readSource('sw.js')
  ]);

  assert.match(app,/reg\.update\(\)/,'brak sprawdzenia przy uruchomieniu aplikacji');
  assert.match(checker,/CHECK_INTERVAL_MS=10\*60\*1000/);
  assert.match(checker,/setInterval\(checkForUpdate,CHECK_INTERVAL_MS\)/);
  assert.match(checker,/getElementById\('showSchedule'\)/);
  assert.match(checker,/addEventListener\('click',\(\)=>\{checkForUpdate\(\)\}\)/);
  assert.match(checker,/await reg\.update\(\)/);
  assert.doesNotMatch(checker,/location\.reload/,'sprawdzenie nie może samo przeładowywać aplikacji');
  assert.match(index,/app-update-check\.js\?v=1/);
  assert.match(sw,/\.\/app-update-check\.js/);
});
