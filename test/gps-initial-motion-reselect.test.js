import test from'node:test';
import assert from'node:assert/strict';
import{
  bearingDegrees,
  createStopProgressEngine
}from'../gps-stop-engine.js';

const base=[52,15];
const metersNorth=meters=>[base[0]+meters/111320,base[1]];

test('cel wybrany na postoju jest ponownie ustalany po ruszeniu z wiarygodnym kierunkiem GPS',()=>{
  const stops=[0,1000,2000,3000].map((meters,index)=>({
    key:String(index),
    coord:metersNorth(meters)
  }));
  const engine=createStopProgressEngine();

  const initial=engine.update({
    stops,
    position:metersNorth(40),
    accuracy:10,
    speedMps:0,
    heading:null,
    headingReliable:false
  });

  assert.equal(initial.index,0);
  assert.equal(initial.reason,'initial-target');

  const position=metersNorth(2350);
  const heading=bearingDegrees(position,stops[3].coord);
  const corrected=engine.update({
    stops,
    position,
    accuracy:10,
    speedMps:12,
    heading,
    headingReliable:true
  });

  assert.equal(corrected.index,3);
  assert.equal(corrected.fromIndex,0);
  assert.equal(corrected.reason,'initial-motion-target');
});

test('ręcznie ustawiony cel nie jest przeliczany jak tymczasowy cel startowy',()=>{
  const stops=[0,1000,2000,3000].map((meters,index)=>({
    key:String(index),
    coord:metersNorth(meters)
  }));
  const engine=createStopProgressEngine();
  engine.setIndex(0);

  const position=metersNorth(2350);
  const heading=bearingDegrees(position,stops[3].coord);
  const result=engine.update({
    stops,
    position,
    accuracy:10,
    speedMps:12,
    heading,
    headingReliable:true
  });

  assert.equal(result.index,0);
  assert.notEqual(result.reason,'initial-motion-target');
});
