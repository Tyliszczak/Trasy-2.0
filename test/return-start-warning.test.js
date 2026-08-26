import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const source=fs.readFileSync(new URL('../return-route.js',import.meta.url),'utf8');
const css=fs.readFileSync(new URL('../navigation.css',import.meta.url),'utf8');

test('wczesny wyjazd z punktu START jest częścią return-route',()=>{
  assert.match(source,/RETURN_WARNING_MS=20000/);
  assert.match(source,/ODJECHAŁEŚ PRZED CZASEM/);
  assert.match(source,/confirmed-departure/);
  assert.match(source,/return-origin-change/);
  assert.match(css,/#returnEarlyDepartureWarning/);
});
