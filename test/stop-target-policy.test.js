import test from'node:test';
import assert from'node:assert/strict';
import{canAutoAdvanceBySchedule}from'../stop-target-policy.js';

const at=value=>new Date(`2026-08-25T${value}:00`);

test('bieżący przystanek ma priorytet przez 15 minut po planie',()=>{
  assert.equal(canAutoAdvanceBySchedule({
    currentPlan:at('06:15'),
    nextPlan:at('06:40'),
    now:at('06:20')
  }),false);
});

test('późniejszy przystanek daleko w harmonogramie nie przejmuje celu nawet po 15 minutach',()=>{
  assert.equal(canAutoAdvanceBySchedule({
    currentPlan:at('06:15'),
    nextPlan:at('08:00'),
    now:at('06:31')
  }),false);
});

test('po 15 minutach można przejść dalej, jeśli następny przystanek jest już blisko czasowo',()=>{
  assert.equal(canAutoAdvanceBySchedule({
    currentPlan:at('06:15'),
    nextPlan:at('06:40'),
    now:at('06:31')
  }),true);
});

test('brak czasu bieżącego przystanku blokuje automatyczne pominięcie',()=>{
  assert.equal(canAutoAdvanceBySchedule({
    currentPlan:null,
    nextPlan:at('06:40'),
    now:at('06:31')
  }),false);
});
