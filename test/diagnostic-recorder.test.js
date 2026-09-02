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

test('aktywna diagnostyka automatycznie wysyła kolejkowane paczki przez Cloudflare',()=>{
  const source=read('diagnostic-recorder.js');
  assert.match(source,/UPLOAD_ENDPOINT='\/test-diagnostics'/);
  assert.match(source,/LAST_UPLOADED_KEY/);
  assert.match(source,/keepalive:true/);
  assert.match(source,/visibilityState==='hidden'/);
  assert.match(source,/window\.addEventListener\('pagehide'/);
  assert.match(source,/setInterval\(\(\)=>\{if\(active\)flush\(\)\.then\(\(\)=>uploadPending\(\)\)/);
  assert.doesNotMatch(source,/DIAGNOSTICS_SHARED_SECRET/);
});

test('eksport wskazuje uzgodniony email i nie udostępnia WhatsApp',()=>{
  const source=read('diagnostic-recorder.js');
  assert.match(source,/kswiderski\.de@gmail\.com/);
  assert.match(source,/exportDiagnostics\('email'\)/);
  assert.match(source,/mailto:\$\{EMAIL\}/);
  assert.doesNotMatch(source,/WhatsApp|WHATSAPP|whatsapp|wa\.me|48603666921/);
  assert.match(source,/locationDataIncluded:true/);
});

test('skrypt diagnostyczny jest częścią powłoki offline PWA',()=>{
  const html=read('index.html');
  const sw=read('sw.js');
  assert.match(html,/src="\.\/diagnostic-recorder\.js\?v=3"/);
  assert.match(sw,/'\.\/diagnostic-recorder\.js'/);
});
