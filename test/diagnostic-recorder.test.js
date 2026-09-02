import test from'node:test';
import assert from'node:assert/strict';
import fs from'node:fs';
import vm from'node:vm';

const read=name=>fs.readFileSync(new URL(`../${name}`,import.meta.url),'utf8');

test('rejestrator diagnostyczny jest ograniczony do oznaczonej wersji testowej',()=>{
  const source=read('diagnostic-recorder.js');
  const html=read('index.html');
  assert.doesNotThrow(()=>new vm.Script(source));
  assert.match(html,/<body data-test-diagnostics="enabled">/);
  assert.match(source,/dataset\.testDiagnostics!=='enabled'/);
  assert.match(source,/\/\^TEST\\b\/i/);
});

test('diagnostyka zapisuje lokalnie GPS i zdarzenia wyboru przystanku',()=>{
  const source=read('diagnostic-recorder.js');
  assert.match(source,/indexedDB\.open/);
  assert.match(source,/gps-fix/);
  assert.match(source,/trasy:stop-transition/);
  assert.match(source,/trasy:route-build/);
  assert.match(source,/visibility-change/);
});

test('eksport wskazuje uzgodniony email i numer WhatsApp',()=>{
  const source=read('diagnostic-recorder.js');
  assert.match(source,/kswiderski\.de@gmail\.com/);
  assert.match(source,/WHATSAPP_NUMBER='48603666921'/);
  assert.match(source,/exportDiagnostics\('email'\)/);
  assert.match(source,/mailto:\$\{EMAIL\}/);
  assert.match(source,/https:\/\/wa\.me\/\$\{WHATSAPP_NUMBER\}/);
  assert.match(source,/locationDataIncluded:true/);
});

test('skrypt diagnostyczny jest częścią powłoki offline PWA',()=>{
  const html=read('index.html');
  const sw=read('sw.js');
  assert.match(html,/src="\.\/diagnostic-recorder\.js\?v=1"/);
  assert.match(sw,/'\.\/diagnostic-recorder\.js'/);
});
