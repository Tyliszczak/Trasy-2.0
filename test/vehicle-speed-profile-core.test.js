import test from 'node:test';
import assert from 'node:assert/strict';
import {effectiveVehicleSpeedLimit,normalizeVehicleSpeedProfile} from '../vehicle-speed-profile-core.js';

test('missing vehicle data preserves the known general road limit',()=>{
  assert.deepEqual(effectiveVehicleSpeedLimit({roadLimit:90}),{
    limit:90,generalLimit:90,status:'vehicle-missing',statusText:'BRAK DANYCH POJAZDU',personalized:false
  });
});

test('missing road data is not replaced with a guessed number',()=>{
  assert.deepEqual(effectiveVehicleSpeedLimit({vehicle:{type:'autobus'}}),{
    limit:null,generalLimit:null,status:'road-missing',statusText:'BRAK DANYCH DROGI',personalized:false
  });
});

test('standard bus uses a conservative vehicle limit',()=>{
  const result=effectiveVehicleSpeedLimit({roadLimit:140,roadClass:'motorway',highSpeedRoad:true,vehicle:{type:'autobus',bus100Approved:false}});
  assert.equal(result.limit,80);
  assert.equal(result.statusText,'BUS');
});

test('BUS 100 approval applies only on a high-speed road',()=>{
  const vehicle={type:'autobus',bus100Approved:true,standingPassengers:false};
  assert.equal(effectiveVehicleSpeedLimit({roadLimit:140,roadClass:'motorway',vehicle}).limit,100);
  assert.equal(effectiveVehicleSpeedLimit({roadLimit:90,roadClass:'primary',vehicle}).limit,70);
});

test('BUS 100 without seat-only confirmation stays at the standard bus limit',()=>{
  const result=effectiveVehicleSpeedLimit({roadLimit:140,roadClass:'motorway',vehicle:{type:'autobus',bus100Approved:true}});
  assert.equal(result.limit,80);
  assert.equal(result.statusText,'BUS • BRAK DANYCH MIEJSC');
});

test('unconfirmed BUS 100 never raises the standard bus limit',()=>{
  const result=effectiveVehicleSpeedLimit({roadLimit:140,roadClass:'motorway',vehicle:{type:'BUS'}});
  assert.equal(result.limit,80);
  assert.equal(result.status,'bus100-unconfirmed');
});

test('vehicle profile parser understands Polish bus data and explicit limits',()=>{
  assert.deepEqual(normalizeVehicleSpeedProfile({type:'Autokar',bus100:'tak',limiterKmh:'92 km/h'}),{
    category:'bus',missing:false,bus100Approved:true,standingPassengers:null,individualLimitKmh:null,limiterKmh:92
  });
});
