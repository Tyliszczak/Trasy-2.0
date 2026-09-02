import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { nearestClockTime,nearestFutureTime } from '../schedule-time.js';

const readSource=name=>readFile(new URL(`../${name}`,import.meta.url),'utf8');

test('TAM wybiera najbliższy przyszły kurs, a POWRÓT najbliższy kurs w obie strony czasu',async()=>{
  const now=new Date('2026-08-25T06:20:00');
  const courses=['06:15','14:15'];

  assert.equal(nearestFutureTime(courses,now),'14:15');
  assert.equal(nearestClockTime(courses,now),'06:15');

  const [app,returnRoute]=await Promise.all([
    readSource('app.js'),
    readSource('return-route.js')
  ]);

  assert.match(app,/function nextCourseTime\(r\)\{return nearestFutureTime\(/);
  assert.match(app,/rememberedCourseTime\(r\)\|\|nextCourseTime\(r\)/);
  assert.match(app,/ACTIVE_COURSE_MAX_AGE=18\*60\*60\*1000/);
  assert.match(app,/body\.dataset\.activeCourse=t/);
  assert.doesNotMatch(app,/function nextCourseTime\(r\)\{return nearestClockTime\(/);
  assert.match(returnRoute,/return time\.nearestClockTime\?\.\(values,new Date\(\)\)\|\|time\.nearestFutureTime/);
  assert.match(returnRoute,/forwardCourseTime\|\|body\.dataset\.activeCourse\|\|forwardTimeSelect\.value/);
  assert.match(returnRoute,/forwardCourseTime=resolveOutboundCourse\(\)/);
});
