import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizePtvSpeedLimit,parseMaxspeed,parseContextMaxspeed,nearestRoadLimit,
  distanceMeters,bearingDegrees
} from '../road-speed-limit-core.js';

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

test('OSM rozpoznaje wartości liczbowe, mph oraz polskie konteksty prawne',()=>{
  assert.equal(parseMaxspeed('50'),50);
  assert.equal(parseMaxspeed('90 km/h'),90);
  assert.equal(parseMaxspeed('30 mph'),48);
  assert.equal(parseMaxspeed('50;70'),null);
  assert.equal(parseContextMaxspeed('PL:urban'),50);
  assert.equal(parseContextMaxspeed('PL:rural'),90);
  assert.equal(parseContextMaxspeed('PL:motorway'),140);
  assert.equal(parseContextMaxspeed('PL:zone30'),30);
});

test('OSM nie bierze limitu z dalszej drogi, kiedy najbliższa nie ma maxspeed',()=>{
  const elements=[
    {type:'way',id:1,tags:{highway:'residential'},geometry:[{lat:52,lon:15},{lat:52.001,lon:15}]},
    {type:'way',id:2,tags:{highway:'primary',maxspeed:'70'},geometry:[{lat:52,lon:15.0005},{lat:52.001,lon:15.0005}]}
  ];
  const result=nearestRoadLimit(elements,{lat:52.0005,lon:15.00002},{heading:0});
  assert.equal(result?.osmWayId,1);
  assert.equal(result?.maxspeed,null);
  assert.equal(result?.hasRoadMatch,true);
});

test('OSM respektuje limit kierunkowy i odrzuca drogę poprzeczną',()=>{
  const elements=[
    {type:'way',id:10,tags:{highway:'service',maxspeed:'20'},geometry:[{lat:52.0005,lon:14.999},{lat:52.0005,lon:15.001}]},
    {type:'way',id:11,tags:{highway:'primary',maxspeed:'70','maxspeed:forward':'50','maxspeed:backward':'90'},geometry:[{lat:52,lon:15.00008},{lat:52.001,lon:15.00008}]}
  ];
  assert.equal(nearestRoadLimit(elements,{lat:52.0005,lon:15},{heading:0})?.maxspeed,50);
  assert.equal(nearestRoadLimit(elements,{lat:52.0005,lon:15},{heading:180})?.maxspeed,90);
});

test('OSM odczytuje source:maxspeed, gdy nie ma prostego maxspeed',()=>{
  const elements=[{
    type:'way',id:20,tags:{highway:'primary','source:maxspeed':'PL:urban'},
    geometry:[{lat:52,lon:15},{lat:52.001,lon:15}]
  }];
  assert.equal(nearestRoadLimit(elements,{lat:52.0005,lon:15},{heading:0})?.maxspeed,50);
});

