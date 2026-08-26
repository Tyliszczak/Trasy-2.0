import test from 'node:test';
import assert from 'node:assert/strict';
import {
  advanceRouteProgress,
  projectRoutePosition,
  splitRemainingRoute,
  splitRemainingRouteAtPosition
} from '../route-progress-core.js';

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

test('pozycja wymazywania jest liczona płynnie wewnątrz odcinka trasy',()=>{
  const projected=projectRoutePosition(route,[15.0025,52.0000],2,2,20);
  assert.ok(Math.abs(projected.position-2.5)<0.001);
  assert.ok(Math.abs(projected.point[0]-15.0025)<0.000001);
  assert.ok(projected.distance<1);
});

test('zielona linia może zaczynać się dokładnie pod znacznikiem zamiast od kolejnego węzła geometrii',()=>{
  const split=splitRemainingRouteAtPosition(route,2.5,[15.0040,52.0000]);
  assert.ok(Math.abs(split.active[0][0]-15.0025)<0.000001);
  assert.deepEqual(split.active.slice(1),[
    [15.0030,52.0000],
    [15.0040,52.0000]
  ]);
  assert.deepEqual(split.future,[
    [15.0040,52.0000],
    [15.0050,52.0000]
  ]);
});


test('równoległa jezdnia używana dużo później nie może przeskoczyć postępu o kilometry',()=>{
  const outbound=[];
  for(let i=0;i<=120;i+=1)outbound.push([15.0000,52.0000+i*0.0001]);
  const connector=[[15.0001,52.0120]];
  const returning=[];
  for(let i=120;i>=0;i-=1)returning.push([15.0001,52.0000+i*0.0001]);
  const loop=[...outbound,...connector,...returning];
  const previous=40;
  const point=[15.00007,52.0045];
  const progress=advanceRouteProgress(loop,point,previous,8);
  assert.ok(progress.index<80,`nieoczekiwany skok do indeksu ${progress.index}`);
  assert.ok(progress.index>=previous);
});
