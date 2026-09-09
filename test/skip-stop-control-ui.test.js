import test from'node:test';
import assert from'node:assert/strict';
import fs from'node:fs';

const source=fs.readFileSync(new URL('../skip-stop-control.js',import.meta.url),'utf8');

test('po kliknięciu POMIŃ ekran potwierdzenia ma tylko POTWIERDŹ i ANULUJ',()=>{
  const start=source.indexOf('if(confirmingSkip){');
  const end=source.indexOf('}else{',start);
  const block=source.slice(start,end);
  assert.match(block,/title\.hidden=true/);
  assert.match(block,/meta\.hidden=true/);
  assert.match(block,/showSegment\.hidden=true/);
  assert.match(block,/previous\.hidden=true/);
  assert.match(block,/skip\.textContent='POTWIERDŹ'/);
  assert.match(block,/cancel\.textContent='ANULUJ'/);
});

test('zwykłe menu zachowuje powrót do poprzedniego przystanku',()=>{
  assert.match(source,/>WRÓĆ DO POPRZEDNIEGO<\/button>/);
  assert.match(source,/source:'manual-previous'/);
});

test('harmonogram pokazuje PRZYWRÓĆ tylko przy wierszu poprzedzającym aktywny cel',()=>{
  assert.match(source,/scheduleRestoreStopButton/);
  assert.match(source,/button\.textContent='PRZYWRÓĆ'/);
  assert.match(source,/const previousRow=s\.rs\[s\.idx-1\]/);
  assert.match(source,/detail:\{index:s\.idx-1,source:'schedule-restore'\}/);
});
