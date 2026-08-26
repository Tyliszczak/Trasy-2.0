import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';

const readSource=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('górna belka pokazuje planową godzinę w stałej linii, a punktualność osobno',async()=>{
  const [clockUi,statusUi,headerUi]=await Promise.all([
    readSource('eta-clock-ui.js'),
    readSource('eta-status.js'),
    readSource('next-stop-header.js')
  ]);

  assert.doesNotMatch(clockUi,/formatClock|ETA\s+\$\{/);
  assert.match(statusUi,/td:nth-child\(2\)/);
  assert.match(statusUi,/info\.textContent=punctuality\.text/);
  assert.doesNotMatch(statusUi,/dojazd za/);
  assert.match(statusUi,/#scheduleBody tr\.gpsNextStop td:nth-child\(2\)\{font-size:22px/);
  assert.doesNotMatch(statusUi,/#routeNextStop \.nextStopMain/);
  assert.match(headerUi,/nextStopPlan/);
  assert.match(headerUi,/planEl\.textContent=data\?\.plan\|\|''/);
  assert.match(headerUi,/nextStopMain\{display:block;color:#fff;font-size:13px!important/);
  assert.match(headerUi,/statusEl\.textContent=status\.text/);
});
