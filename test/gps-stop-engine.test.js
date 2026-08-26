import test from'node:test';
import assert from'node:assert/strict';
import{
  bearingDegrees,
  createStopProgressEngine
}from'../gps-stop-engine.js';
import{planDateForRow}from'../schedule-time.js';
import{stopGuardState}from'../stop-alert-core.js';

const base=[52,15];
const metersNorth=meters=>[base[0]+meters/111320,base[1]];
const stops=[0,500,1000].map((meters,index)=>({key:String(index),coord:metersNorth(meters)}));

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

function confirmStop(engine,meters=0){
  if(engine.snapshot().index===null)fix(engine,meters,{speedMps:0});
  fix(engine,meters,{speedMps:0});
  fix(engine,meters,{speedMps:0});
  return fix(engine,meters,{speedMps:0});
}

test('czas nie uczestniczy w wyborze następnego przystanku',()=>{
  const engine=createStopProgressEngine();
  const result=fix(engine,510);
  assert.equal(result.index,1);
  assert.equal(result.reason,'initial-target');
});

test('podczas jazdy startowy cel wybierany jest przed autem nawet gdy następny punkt jest dalej niż 600 m',()=>{
  const engine=createStopProgressEngine();
  const distantStops=[0,1600,3200].map((meters,index)=>({key:String(index),coord:metersNorth(meters)}));
  const position=metersNorth(250);
  const heading=bearingDegrees(position,distantStops[1].coord);
  const result=engine.update({
    stops:distantStops,
    position,
    accuracy:10,
    speedMps:10,
    heading,
    headingReliable:true
  });
  assert.equal(result.index,1);
  assert.equal(result.reason,'initial-target');
});

test('po ponownym uruchomieniu w środku trasy silnik pomija punkty pozostawione za autem',()=>{
  const engine=createStopProgressEngine();
  const longStops=[0,1000,2000,3000].map((meters,index)=>({key:String(index),coord:metersNorth(meters)}));
  const position=metersNorth(2350);
  const heading=bearingDegrees(position,longStops[3].coord);
  const result=engine.update({
    stops:longStops,
    position,
    accuracy:10,
    speedMps:12,
    heading,
    headingReliable:true
  });
  assert.equal(result.index,3);
  assert.equal(result.reason,'initial-target');
});

test('podczas jazdy bez wiarygodnego kierunku silnik nie wraca odruchowo do pierwszego przystanku',()=>{
  const engine=createStopProgressEngine();
  const result=fix(engine,700,{speedMps:10,headingReliable:false});
  assert.equal(result.index,null);
  assert.equal(result.reason,'awaiting-heading');
});

test('tracker odzyskuje właściwy cel gdy aktywny przystanek został daleko za autem',()=>{
  const engine=createStopProgressEngine();
  engine.setIndex(0);
  const position=metersNorth(700);
  const heading=bearingDegrees(position,stops[2].coord);
  const first=engine.update({stops,position,accuracy:10,speedMps:10,heading,headingReliable:true});
  assert.equal(first.index,0);
  assert.equal(first.reason,'approaching');
  const recovered=engine.update({stops,position:metersNorth(720),accuracy:10,speedMps:10,heading,headingReliable:true});
  assert.equal(recovered.index,2);
  assert.equal(recovered.reason,'reacquired-target');
});

test('przyjazd wymaga potwierdzonego postoju w promieniu przystanku',()=>{
  const engine=createStopProgressEngine();
  fix(engine,0);
  fix(engine,20,{speedMps:0.5});
  fix(engine,20,{speedMps:0.5});
  const arrived=fix(engine,20,{speedMps:0.5});
  assert.equal(arrived.index,0);
  assert.equal(arrived.reason,'arrival-confirmed');
  assert.equal(arrived.arrived,true);
});

test('przejazd przez środek bez postoju nie udaje przyjazdu',()=>{
  const engine=createStopProgressEngine();
  engine.setIndex(0);
  for(const meters of[35,20,10,20,35]){
    const result=fix(engine,meters,{speedMps:8,headingReliable:true});
    assert.equal(result.arrived,false);
    assert.equal(result.phase,'approaching');
  }
});

test('minięcie przystanku w ruchu przełącza cel po kilku pewnych odczytach',()=>{
  const engine=createStopProgressEngine();
  engine.setIndex(0);
  let result;
  for(const meters of[80,50,20,45,65,90]){
    result=fix(engine,meters,{speedMps:8,headingReliable:true});
  }
  assert.equal(result.index,1);
  assert.equal(result.reason,'passed-stop');
  assert.equal(result.justSkipped,true);
  assert.equal(result.skippedIndex,0);
});

test('bez wiarygodnego kierunku GPS przystanek nie jest automatycznie pomijany',()=>{
  const engine=createStopProgressEngine();
  engine.setIndex(0);
  for(const meters of[80,50,20,45,65,90,120]){
    fix(engine,meters,{speedMps:8,headingReliable:false});
  }
  assert.equal(engine.snapshot().index,0);
});

test('zmiana celu po postoju wymaga potwierdzonego odjazdu',()=>{
  const engine=createStopProgressEngine();
  confirmStop(engine,0);
  const firstDeparture=fix(engine,90,{speedMps:8,headingReliable:true});
  assert.equal(firstDeparture.index,0);
  const confirmed=fix(engine,105,{speedMps:8,headingReliable:true});
  assert.equal(confirmed.index,1);
  assert.equal(confirmed.reason,'confirmed-departure');
});

test('po potwierdzonym postoju zakręt nie blokuje przejścia do następnego celu',()=>{
  const engine=createStopProgressEngine();
  confirmStop(engine,0);
  fix(engine,90,{speedMps:8,heading:180,headingReliable:true});
  fix(engine,105,{speedMps:8,heading:180,headingReliable:true});
  const confirmed=fix(engine,120,{speedMps:8,heading:180,headingReliable:true});
  assert.equal(confirmed.index,1);
  assert.equal(confirmed.reason,'confirmed-departure');
});

test('HOLD pozostaje stabilny przy jitterze 65-74-68 m po potwierdzonym postoju',()=>{
  const engine=createStopProgressEngine();
  confirmStop(engine,0);
  for(const meters of[65,74,68]){
    const result=fix(engine,meters,{speedMps:0});
    assert.equal(result.arrived,true);
    const guard=stopGuardState({eligible:true,arrived:result.arrived,seconds:90,planText:'10:00'});
    assert.equal(guard.state,'hold');
    assert.match(guard.message,/NIE ODJEDŻAJ/);
  }
});

test('READY nie pojawia się podczas przejazdu bez wcześniejszego postoju',()=>{
  const engine=createStopProgressEngine();
  engine.setIndex(0);
  for(const meters of[30,20,15,25])fix(engine,meters,{speedMps:8,headingReliable:true});
  assert.equal(engine.snapshot().arrived,false);
  const guard=stopGuardState({eligible:true,arrived:engine.snapshot().arrived,seconds:-30,planText:'10:00'});
  assert.equal(guard.state,'');
});

test('po potwierdzonym postoju czas planu przełącza HOLD na READY',()=>{
  const engine=createStopProgressEngine();
  confirmStop(engine,0);
  const hold=stopGuardState({eligible:true,arrived:true,seconds:1,planText:'10:00'});
  const ready=stopGuardState({eligible:true,arrived:true,seconds:0,planText:'10:00'});
  assert.equal(hold.state,'hold');
  assert.equal(ready.state,'ready');
  assert.equal(ready.message,'MOŻESZ JECHAĆ');
});

test('postój i niedokładny GPS nie zmieniają celu',()=>{
  const engine=createStopProgressEngine();
  engine.setIndex(0);
  for(const meters of[30,55,25,70,20])fix(engine,meters,{accuracy:120,speedMps:0,headingReliable:false});
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
  return{children:[{}, {firstChild:text,textContent:time,dataset:{},querySelector(){return null}}]};
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
