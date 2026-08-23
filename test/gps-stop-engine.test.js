import test from'node:test';
import assert from'node:assert/strict';
import{
  bearingDegrees,
  createStopProgressEngine
}from'../gps-stop-engine.js';
import{planDateForRow}from'../schedule-time.js';

const base=[52,15];
const metersNorth=meters=>[base[0]+meters/111320,base[1]];
const stops=[0,500,1000].map((meters,index)=>({
  key:String(index),
  coord:metersNorth(meters)
}));

function fix(engine,meters,options={}){
  const position=metersNorth(meters);
  const next=stops[Math.min((engine.snapshot().index??0)+1,stops.length-1)].coord;
  return engine.update({
    stops,
    position,
    accuracy:options.accuracy??10,
    speedMps:options.speedMps??0,
    heading:options.heading??bearingDegrees(position,next),
    headingReliable:options.headingReliable??false,
    emptyRun:options.emptyRun??false
  });
}

test('czas nie uczestniczy w wyborze następnego przystanku',()=>{
  const engine=createStopProgressEngine();
  const result=fix(engine,510);
  assert.equal(result.index,1);
  assert.equal(result.reason,'initial-target');
});

test('jeden odczyt GPS nie może jednocześnie zaliczyć i opuścić przystanku',()=>{
  const engine=createStopProgressEngine();
  fix(engine,0);
  fix(engine,20,{speedMps:8,headingReliable:true});
  fix(engine,20,{speedMps:8,headingReliable:true});
  const arrived=fix(engine,20,{speedMps:8,headingReliable:true});
  assert.equal(arrived.index,0);
  assert.equal(arrived.reason,'arrival-confirmed');
  assert.equal(arrived.arrived,true);
});

test('zmiana celu wymaga potwierdzonego przyjazdu i dwóch odczytów odjazdu',()=>{
  const engine=createStopProgressEngine();
  fix(engine,0);
  fix(engine,0);
  fix(engine,0);
  fix(engine,0);

  const firstDeparture=fix(engine,90,{speedMps:8,headingReliable:true});
  assert.equal(firstDeparture.index,0);
  const confirmed=fix(engine,105,{speedMps:8,headingReliable:true});
  assert.equal(confirmed.index,1);
  assert.equal(confirmed.reason,'confirmed-departure');
});

test('po potwierdzonym postoju zakręt nie blokuje przejścia do następnego celu',()=>{
  const engine=createStopProgressEngine();
  fix(engine,0);
  fix(engine,0);
  fix(engine,0);
  fix(engine,0);

  fix(engine,90,{speedMps:8,heading:180,headingReliable:true});
  fix(engine,105,{speedMps:8,heading:180,headingReliable:true});
  const confirmed=fix(engine,120,{speedMps:8,heading:180,headingReliable:true});
  assert.equal(confirmed.index,1);
  assert.equal(confirmed.reason,'confirmed-departure');
});

test('przejazd obok nie powoduje cichego automatycznego pominięcia',()=>{
  const engine=createStopProgressEngine();
  engine.setIndex(0);
  for(const meters of[80,120,180,250]){
    const result=fix(engine,meters,{speedMps:12,headingReliable:true});
    assert.equal(result.index,0);
  }
});

test('postój i niedokładny GPS nie zmieniają celu',()=>{
  const engine=createStopProgressEngine();
  engine.setIndex(0);
  for(const meters of[30,55,25,70,20]){
    fix(engine,meters,{accuracy:120,speedMps:0,headingReliable:false});
  }
  assert.deepEqual(engine.snapshot(),{index:0,phase:'approaching',arrived:false});
});

test('ręczna korekta może cofnąć cel',()=>{
  const engine=createStopProgressEngine();
  engine.setIndex(2);
  const corrected=engine.setIndex(1);
  assert.equal(corrected.index,1);
  assert.equal(corrected.phase,'approaching');
});

test('Na pusto zawsze wybiera ostatni punkt kierunku',()=>{
  const engine=createStopProgressEngine();
  const result=fix(engine,0,{emptyRun:true});
  assert.equal(result.index,2);
  assert.equal(result.reason,'empty-run-target');
});

function row(time){
  const text={textContent:time};
  return{children:[{}, {firstChild:text,textContent:time}]};
}

test('godziny po północy należą do tego samego kursu',()=>{
  const rows=[row('23:50'),row('00:10'),row('00:35')];
  const beforeMidnight=new Date('2026-08-23T23:55:00');
  const afterMidnight=planDateForRow(rows,rows[1],beforeMidnight);
  assert.equal(afterMidnight.getDate(),24);
  assert.equal(afterMidnight.getHours(),0);
  assert.equal(afterMidnight.getMinutes(),10);

  const shortlyAfterMidnight=new Date('2026-08-24T00:05:00');
  const sameService=planDateForRow(rows,rows[1],shortlyAfterMidnight);
  assert.equal(sameService.getDate(),24);
  assert.equal(sameService.getHours(),0);
  assert.equal(sameService.getMinutes(),10);
});
