import test from 'node:test';
import assert from 'node:assert/strict';
import { advanceRouteProgress, splitRemainingRoute } from '../route-progress-core.js';

const route=[
  [15.0000,52.0000],
  [15.0010,52.0000],
  [15.0020,52.0000],
  [15.0030,52.0000],
  [15.0040,52.0000],
  [15.0050,52.0000]
];

test('postęp trasy rośnie i nie cofa się przy kolejnych odczytach GPS',()=>{
  const first=advanceRouteProgress(route,[15.00205,52.0000],0,8);
  assert.equal(first.index,2);
  const noisyBack=advanceRouteProgress(route,[15.00195,52.0000],first.index,8);
  assert.equal(noisyBack.index,2);
  const forward=advanceRouteProgress(route,[15.00402,52.0000],noisyBack.index,8);
  assert.equal(forward.index,4);
});

test('odcinek przejechany znika, aktywny kończy się na najbliższym przystanku, a dalszy pozostaje osobno',()=>{
  const split=splitRemainingRoute(route,2,[15.0040,52.0000]);
  assert.deepEqual(split.active,[
    [15.0020,52.0000],
    [15.0030,52.0000],
    [15.0040,52.0000]
  ]);
  assert.deepEqual(split.future,[
    [15.0040,52.0000],
    [15.0050,52.0000]
  ]);
});

test('przy ostatnim przystanku nie powstaje blady dalszy odcinek',()=>{
  const split=splitRemainingRoute(route,3,[15.0050,52.0000]);
  assert.equal(split.future.length,0);
  assert.deepEqual(split.active,[
    [15.0030,52.0000],
    [15.0040,52.0000],
    [15.0050,52.0000]
  ]);
});
