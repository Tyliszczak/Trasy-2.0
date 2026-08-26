import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizePtvSpeedLimit,distanceMeters,bearingDegrees} from '../road-speed-limit-core.js';

test('PTV speedLimit jest jedyną wartością SpeedMax',()=>{
  const result=normalizePtvSpeedLimit({
    latitude:52.1,
    longitude:15.2,
    matchDistance:12,
    angleDifference:4,
    segmentAttributes:{speedLimit:70,builtUpArea:false}
  });
  assert.equal(result.maxspeed,70);
  assert.equal(result.matchDistance,12);
  assert.equal(result.angleDifference,4);
  assert.equal(result.builtUpArea,false);
});

test('brak speedLimit nie jest zgadywany',()=>{
  assert.equal(normalizePtvSpeedLimit({matchDistance:3,segmentAttributes:{builtUpArea:true}}),null);
  assert.equal(normalizePtvSpeedLimit({matchDistance:3,segmentAttributes:{speedLimit:0}}),null);
});

test('zbyt odległe dopasowanie drogi jest odrzucane',()=>{
  assert.equal(normalizePtvSpeedLimit({matchDistance:81,segmentAttributes:{speedLimit:50}},{maxMatchDistance:80}),null);
  assert.equal(normalizePtvSpeedLimit({matchDistance:80,segmentAttributes:{speedLimit:50}},{maxMatchDistance:80})?.maxspeed,50);
});

test('pomocnicze obliczenia ruchu rozpoznają dystans i kierunek',()=>{
  const a={lat:52,lon:15};
  const north={lat:52.001,lon:15};
  assert.ok(distanceMeters(a,north)>100);
  assert.ok(distanceMeters(a,north)<120);
  assert.ok(Math.abs(bearingDegrees(a,north))<1);
});
