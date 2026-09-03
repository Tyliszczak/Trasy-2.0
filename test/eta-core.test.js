import assert from 'node:assert/strict';
import test from 'node:test';
import '../eta-core.js';

const eta=globalThis.__trasyEta;

test('tolerancja punktualności wynosi plus minus 30 sekund',()=>{
  assert.deepEqual(eta.statusFromDiff(-30),{kind:'onTime',text:'OK',diffSeconds:-30});
  assert.deepEqual(eta.statusFromDiff(30),{kind:'onTime',text:'OK',diffSeconds:30});
  assert.equal(eta.statusFromDiff(-31).kind,'early');
  assert.equal(eta.statusFromDiff(31).kind,'late');
});

test('tekst za wcześnie i opóźnienia powstaje w jednym rdzeniu',()=>{
  assert.equal(eta.statusFromDiff(-61).text,'1 min\nZA SZYBKO');
  assert.equal(eta.statusFromDiff(121).text,'2 min\nZA PÓŹNO');
  assert.equal(eta.statusFromDiff(-97*60).text,'1 godz. 37 min\nZA SZYBKO');
  assert.equal(eta.statusFromDiff(120*60).text,'2 godz.\nZA PÓŹNO');
  assert.equal(eta.formatMinutes(60),'60 min');
  assert.equal(eta.formatMinutes(61),'1 godz. 1 min');
});

test('ostrzeżenie 100 m nie powinno uznać za wczesny dojazdu, który według ETA wypada po planie',()=>{
  // Jest 09:59:52, plan za 8 s, dojazd przewidywany za 15 s.
  const status=eta.statusFromEta(15,8);
  assert.equal(status.kind,'onTime');
  assert.notEqual(status.kind,'early');
});

test('przewidywany dojazd wyraźnie przed planem jest klasyfikowany jako wczesny',()=>{
  const status=eta.statusFromEta(5,60);
  assert.equal(status.kind,'early');
  assert.equal(status.diffSeconds,-55);
});

test('brak wiarygodnego ETA lub planu daje status neutralny',()=>{
  assert.equal(eta.statusFromEta(null,60).kind,'neutral');
  assert.equal(eta.statusFromEta(60,null).kind,'neutral');
  assert.equal(eta.statusFromDiff(undefined).kind,'neutral');
});
