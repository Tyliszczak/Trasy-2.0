import test from 'node:test';
import assert from 'node:assert/strict';
import{
  cumulativeDistances,
  nearestRouteIndex,
  legRemainingSeconds,
  interpolateLngLat
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
