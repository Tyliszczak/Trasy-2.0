import test from'node:test';
import assert from'node:assert/strict';
import fs from'node:fs';
import{canAutoAdvanceBySchedule,manualSkipTargetIndex,shouldApplySchedulePriority}from'../stop-target-policy.js';

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

test('brak czasu blokuje wybór heurystyczny, ale nie potwierdzone fizyczne minięcie',()=>{
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
  assert.equal(canAutoAdvanceBySchedule({
    currentPlan:at('06:15'),
    nextPlan:null,
    now:at('06:16'),
    transitionReason:'passed-stop'
  }),true);
  assert.equal(canAutoAdvanceBySchedule({
    currentPlan:null,
    nextPlan:null,
    now:at('06:16'),
    transitionReason:'passed-stop'
  }),true);
});

test('potwierdzone odzyskanie celu po planie nie czeka do godziny następnego przystanku',()=>{
  assert.equal(canAutoAdvanceBySchedule({
    currentPlan:at('05:23'),
    nextPlan:at('05:39'),
    now:at('05:26'),
    transitionReason:'reacquired-target'
  }),true);
});

test('odzyskanie celu przed planem nadal jest chronione przez harmonogram',()=>{
  assert.equal(canAutoAdvanceBySchedule({
    currentPlan:at('05:23'),
    nextPlan:at('05:39'),
    now:at('05:22'),
    transitionReason:'reacquired-target'
  }),false);
});

test('ochrona harmonogramu działa tylko na kursie z godzinami, nigdy na powrocie',()=>{
  assert.equal(shouldApplySchedulePriority({direction:'forward',emptyRun:false}),true);
  assert.equal(shouldApplySchedulePriority({direction:'return',emptyRun:false}),false);
  assert.equal(shouldApplySchedulePriority({direction:'return',emptyRun:true}),false);
  assert.equal(shouldApplySchedulePriority({direction:'forward',emptyRun:true}),false);
});

test('kierowca może ręcznie pomijać przystanki pojedynczo niezależnie od GPS i planu',()=>{
  assert.equal(manualSkipTargetIndex({currentIndex:2,stopCount:7}),3);
  assert.equal(manualSkipTargetIndex({currentIndex:3,stopCount:7}),4);
  assert.equal(manualSkipTargetIndex({currentIndex:5,stopCount:7}),6);
});

test('ręczne pomijanie nie wychodzi poza ostatni przystanek ani początek kierunku',()=>{
  assert.equal(manualSkipTargetIndex({currentIndex:6,stopCount:7}),null);
  assert.equal(manualSkipTargetIndex({currentIndex:0,stopCount:7,minimumIndex:1}),null);
  assert.equal(manualSkipTargetIndex({currentIndex:1,stopCount:7,minimumIndex:1}),2);
  assert.equal(manualSkipTargetIndex({currentIndex:null,stopCount:7}),null);
});

test('ręczne pominięcie ma osobne zdarzenie i omija ochronę harmonogramu',()=>{
  const tracker=fs.readFileSync(new URL('../gps-stop-tracker.js',import.meta.url),'utf8');
  const control=fs.readFileSync(new URL('../skip-stop-control.js',import.meta.url),'utf8');
  assert.match(control,/POMIŃ/);
  assert.match(control,/ANULUJ/);
  assert.doesNotMatch(control,/POTWIERDŹ POMINIĘCIE/);
  assert.match(control,/scheduleSkipStopButton/);
  assert.match(control,/scheduleView/);
  assert.match(control,/gps-skip-current-stop/);
  assert.match(tracker,/manualSkipTargetIndex/);
  assert.match(tracker,/reason:'manual-skip'/);
  const manualHandler=tracker.slice(tracker.indexOf('function skipCurrentStopManually'),tracker.indexOf('function onReturnOriginChange'));
  assert.doesNotMatch(manualHandler,/scheduleAllowsAutoAdvance/);
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
