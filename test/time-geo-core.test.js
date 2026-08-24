import assert from 'node:assert/strict';
import test from 'node:test';

import {
  addMinutesToTime,
  nearestFutureTime,
  normalizeClockTime,
  planDateForRow,
  rowPlanText
} from '../schedule-time.js';
import {
  angleDifference,
  bearingDegrees,
  distanceMeters
} from '../gps-stop-engine.js';
import '../geo-core.js';

function cell(text='',dataset={}){
  return{
    textContent:text,
    dataset,
    querySelector(){return null}
  };
}
function row(text='',dataset={}){
  return{children:[{},cell(text,dataset)]};
}

test('normalizacja czasu akceptuje zapis z jedną cyfrą godziny i ISO',()=>{
  assert.equal(normalizeClockTime('6:05'),'06:05');
  assert.equal(normalizeClockTime('2026-08-24T23:15:00'),'23:15');
  assert.equal(normalizeClockTime('KONIEC TRASY'),'');
  assert.equal(normalizeClockTime('25:10'),'');
});

test('najbliższy kurs jest zawsze najbliższym przyszłym wystąpieniem w ciągu 24 godzin',()=>{
  const beforeMidnight=new Date('2026-08-23T23:36:00');
  assert.equal(nearestFutureTime(['23:50','00:10','05:00'],beforeMidnight),'23:50');

  const afterFirstCourse=new Date('2026-08-23T23:50:30');
  assert.equal(nearestFutureTime(['23:50','00:10','05:00'],afterFirstCourse),'00:10');

  const afterMidnight=new Date('2026-08-24T00:11:00');
  assert.equal(nearestFutureTime(['23:50','00:10','05:00'],afterMidnight),'05:00');
});

test('czytnik planu zachowuje prawdziwą godzinę ukrytą pod etykietą KONIEC TRASY',()=>{
  const final=row('KONIEC TRASY',{routeRolePlan:'05:46'});
  assert.equal(rowPlanText(final),'05:46');

  const start=row('START',{routeRolePlan:'23:55'});
  assert.equal(rowPlanText(start),'23:55');
});

test('dodawanie minut przechodzi przez północ bez traktowania jej jako granicy',()=>{
  assert.equal(addMinutesToTime('23:50',15),'00:05');
  assert.equal(addMinutesToTime('00:05',-15),'23:50');
});

test('plan kolejnych przystanków zachowuje ciąg kursu po północy',()=>{
  const rows=[row('23:50'),row('00:10'),row('00:35')];
  const beforeMidnight=new Date('2026-08-23T23:55:00');
  const target=planDateForRow(rows,rows[1],beforeMidnight);
  assert.equal(target.getDate(),24);
  assert.equal(target.getHours(),0);
  assert.equal(target.getMinutes(),10);
});

test('wspólna geometria poprawnie liczy odległość, kierunek i różnicę kątów',()=>{
  const geo=globalThis.__trasyGeo;
  assert.deepEqual(geo.parseCoordinate('51.123, 15.456'),[51.123,15.456]);
  assert.equal(geo.parseCoordinate('91,15'),null);

  const north=[52.001,15];
  const south=[52,15];
  const distance=distanceMeters(south,north);
  assert.ok(distance>110&&distance<112);
  assert.ok(bearingDegrees(south,north)<1||bearingDegrees(south,north)>359);
  assert.equal(angleDifference(350,10),20);
});
