import test from'node:test';
import assert from'node:assert/strict';
import{canAutoAdvanceBySchedule}from'../stop-target-policy.js';

const at=value=>new Date(`2026-08-25T${value}:00`);

test('bieżący przystanek ma priorytet aż do godziny następnego',()=>{
  assert.equal(canAutoAdvanceBySchedule({
    currentPlan:at('06:15'),
    nextPlan:at('06:40'),
    now:at('06:31')
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

test('późniejszy przystanek daleko w harmonogramie nie przejmuje celu przez samą bliskość GPS',()=>{
  assert.equal(canAutoAdvanceBySchedule({
    currentPlan:at('06:15'),
    nextPlan:at('08:00'),
    now:at('06:45')
  }),false);
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
