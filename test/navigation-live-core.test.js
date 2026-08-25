import test from 'node:test';
import assert from 'node:assert/strict';
import{
  cumulativeDistances,
  nearestRouteIndex,
  legRemainingSeconds,
  interpolateLngLat,
  cameraProfileForSpeed
}from'../navigation-live-core.js';

test('remaining ETA follows actual route progress',()=>{
  const geometry=[[15,52],[15.01,52],[15.02,52]];
  const route=cumulativeDistances(geometry);
  const fullDistance=route.cumulative[2];
  const halfway=legRemainingSeconds({
    cumulative:route.cumulative,
    startIndex:1,
    endIndex:2,
    legDistance:fullDistance,
    legDuration:600
  });
  assert.ok(halfway>250&&halfway<350);
});

test('nearest route index follows GPS position',()=>{
  const route=cumulativeDistances([[15,52],[15.01,52],[15.02,52]]);
  const result=nearestRouteIndex(route.points,[52,15.0101]);
  assert.equal(result.index,1);
});

test('marker interpolation is linear',()=>{
  assert.deepEqual(interpolateLngLat([15,52],[16,54],.5),[15.5,53]);
});

test('kamera osiąga maksymalne oddalenie i pochylenie już przy 70 km/h',()=>{
  const slow=cameraProfileForSpeed(0);
  const city=cameraProfileForSpeed(40);
  const fast=cameraProfileForSpeed(70);
  const faster=cameraProfileForSpeed(110);
  assert.equal(slow.zoom,17.45);
  assert.equal(slow.pitch,52);
  assert.equal(fast.zoom,16.75);
  assert.equal(fast.pitch,65);
  assert.deepEqual(faster,fast);
  assert.ok(slow.zoom>city.zoom&&city.zoom>fast.zoom);
  assert.ok(slow.pitch<city.pitch&&city.pitch<fast.pitch);
});
