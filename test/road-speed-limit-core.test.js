import test from 'node:test';
import assert from 'node:assert/strict';
import {parseMaxspeed,parseContextMaxspeed,nearestRoadLimit} from '../road-speed-limit-core.js';

test('parseMaxspeed reads km/h and mph values',()=>{
  assert.equal(parseMaxspeed('50'),50);
  assert.equal(parseMaxspeed('90 km/h'),90);
  assert.equal(Math.round(parseMaxspeed('30 mph')),48);
  assert.equal(parseMaxspeed('signals'),null);
  assert.equal(parseMaxspeed('50;70'),null);
});

test('parseContextMaxspeed reads supported country contexts and zones',()=>{
  assert.equal(parseContextMaxspeed('PL:urban'),50);
  assert.equal(parseContextMaxspeed('PL:rural'),90);
  assert.equal(parseContextMaxspeed('PL:motorway'),140);
  assert.equal(parseContextMaxspeed('CZ:motorway'),130);
  assert.equal(parseContextMaxspeed('PL:zone30'),30);
  assert.equal(parseContextMaxspeed('PL:30'),30);
  assert.equal(parseContextMaxspeed('sign'),null);
});

test('nearestRoadLimit uses the nearest road instead of a farther tagged road',()=>{
  const elements=[
    {type:'way',id:1,tags:{highway:'residential'},geometry:[{lat:52,lon:15},{lat:52.001,lon:15}]},
    {type:'way',id:2,tags:{highway:'primary',maxspeed:'70'},geometry:[{lat:52,lon:15.0005},{lat:52.001,lon:15.0005}]}
  ];
  const result=nearestRoadLimit(elements,{lat:52.0005,lon:15.00002},{maxDistance:55,heading:0});
  assert.equal(result?.osmWayId,1);
  assert.equal(result?.maxspeed,null);
});

test('nearestRoadLimit reads implicit OSM maxspeed context for the current road',()=>{
  const elements=[{
    type:'way',id:2,
    tags:{highway:'primary','source:maxspeed':'PL:urban'},
    geometry:[{lat:52,lon:15},{lat:52.001,lon:15}]
  }];
  assert.equal(nearestRoadLimit(elements,{lat:52.0005,lon:15},{heading:0})?.maxspeed,50);
});

test('nearestRoadLimit respects directional maxspeed',()=>{
  const elements=[{
    type:'way',id:3,
    tags:{highway:'primary',maxspeed:'70','maxspeed:forward':'50','maxspeed:backward':'90'},
    geometry:[{lat:52,lon:15},{lat:52.001,lon:15}]
  }];
  assert.equal(nearestRoadLimit(elements,{lat:52.0005,lon:15},{heading:0})?.maxspeed,50);
  assert.equal(nearestRoadLimit(elements,{lat:52.0005,lon:15},{heading:180})?.maxspeed,90);
  assert.equal(nearestRoadLimit(elements,{lat:52.0005,lon:15})?.maxspeed,70);
});

test('nearestRoadLimit rejects a closer perpendicular road while the vehicle is moving',()=>{
  const elements=[
    {type:'way',id:10,tags:{highway:'service',maxspeed:'20'},geometry:[{lat:52.0005,lon:14.999},{lat:52.0005,lon:15.001}]},
    {type:'way',id:11,tags:{highway:'primary',maxspeed:'70'},geometry:[{lat:52,lon:15.00008},{lat:52.001,lon:15.00008}]}
  ];
  const result=nearestRoadLimit(elements,{lat:52.0005,lon:15},{heading:0});
  assert.equal(result?.osmWayId,11);
  assert.equal(result?.maxspeed,70);
});

test('nearestRoadLimit keeps the previous parallel way when GPS drifts between roads',()=>{
  const elements=[
    {type:'way',id:20,tags:{highway:'primary',maxspeed:'70'},geometry:[{lat:52,lon:15},{lat:52.001,lon:15}]},
    {type:'way',id:21,tags:{highway:'service',maxspeed:'20'},geometry:[{lat:52,lon:15.00008},{lat:52.001,lon:15.00008}]}
  ];
  const result=nearestRoadLimit(elements,{lat:52.0005,lon:15.00006},{heading:0,previousWayId:20});
  assert.equal(result?.osmWayId,20);
});
