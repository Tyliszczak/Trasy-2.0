import test from'node:test';
import assert from'node:assert/strict';
import fs from'node:fs';
import{canAutoAdvanceBySchedule,shouldApplySchedulePriority}from'../stop-target-policy.js';

const at=value=>new Date(`2026-08-25T${value}:00`);

test('bieżący przystanek zachowuje priorytet przed upływem 10 minut od planu',()=>{
  assert.equal(canAutoAdvanceBySchedule({
    currentPlan:at('06:15'),
    nextPlan:at('06:40'),
    now:at('06:24')
  }),false);
});

test('krótki odstęp nie wymusza sztucznego czekania 15 minut',()=>{
  assert.equal(canAutoAdvanceBySchedule({
    currentPlan:at('06:15'),
    nextPlan:at('06:25'),
    now:at('06:25')
  }),true);
});

test('tuż przed godziną następnego przystanku cel jeszcze się nie zmienia',()=>{
  assert.equal(canAutoAdvanceBySchedule({
    currentPlan:at('06:15'),
    nextPlan:at('06:25'),
    now:new Date('2026-08-25T06:24:59')
  }),false);
});

test('po 10 minutach od planu pierwszego przystanku ochrona wygasa całkowicie',()=>{
  assert.equal(canAutoAdvanceBySchedule({
    currentPlan:at('06:15'),
    nextPlan:at('06:40'),
    now:at('06:25')
  }),true);
});

test('potwierdzone przez GPS minięcie po planie od razu przełącza na następny przystanek',()=>{
  assert.equal(canAutoAdvanceBySchedule({
    currentPlan:at('06:15'),
    nextPlan:at('06:40'),
    now:at('06:16'),
    transitionReason:'passed-stop'
  }),true);
});

test('GPS nie pomija przystanku przejechanego przed jego planową godziną',()=>{
  assert.equal(canAutoAdvanceBySchedule({
    currentPlan:at('06:15'),
    nextPlan:at('06:40'),
    now:at('06:14'),
    transitionReason:'passed-stop'
  }),false);
});

test('dawno minięty przystanek nie blokuje celu nawet przy dużej luce w harmonogramie',()=>{
  assert.equal(canAutoAdvanceBySchedule({
    currentPlan:at('06:15'),
    nextPlan:at('08:00'),
    now:at('06:45')
  }),true);
});

test('brak czasu bieżącego lub następnego przystanku blokuje automatyczne pominięcie',()=>{
  assert.equal(canAutoAdvanceBySchedule({
    currentPlan:null,
    nextPlan:at('06:40'),
    now:at('06:40')
  }),false);
  assert.equal(canAutoAdvanceBySchedule({
    currentPlan:at('06:15'),
    nextPlan:null,
    now:at('06:40')
  }),false);
});

test('ochrona harmonogramu działa tylko na kursie z godzinami, nigdy na powrocie',()=>{
  assert.equal(shouldApplySchedulePriority({direction:'forward',emptyRun:false}),true);
  assert.equal(shouldApplySchedulePriority({direction:'return',emptyRun:false}),false);
  assert.equal(shouldApplySchedulePriority({direction:'return',emptyRun:true}),false);
  assert.equal(shouldApplySchedulePriority({direction:'forward',emptyRun:true}),false);
});

test('samonaprawa GPS nie może ominąć aktywnego przystanku przed czasem',()=>{
  const source=fs.readFileSync(new URL('../gps-stop-tracker.js',import.meta.url),'utf8');
  assert.match(source,/result\.reason==='reacquired-target'/);
  assert.match(source,/scheduleAllowsAutoAdvance\(fromIndex,currentIndex,result\.reason\)/);
  assert.match(source,/engine\.setIndex\(currentIndex\)/);
});

test('oba kierunki używają jednego automatycznego komunikatu o minięciu przystanku',()=>{
  const index=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
  const sw=fs.readFileSync(new URL('../sw.js',import.meta.url),'utf8');
  const tracker=fs.readFileSync(new URL('../gps-stop-tracker.js',import.meta.url),'utf8');
  assert.doesNotMatch(index,/skip-detection\.js/);
  assert.doesNotMatch(sw,/skip-detection\.js/);
  assert.match(tracker,/POMINĄŁEŚ PRZYSTANEK/);
  assert.doesNotMatch(tracker,/POMIŃ WSZYSTKIE/);
});
