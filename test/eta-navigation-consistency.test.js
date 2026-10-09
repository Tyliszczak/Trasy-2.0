import test from'node:test';
import assert from'node:assert/strict';
import fs from'node:fs';
const read=path=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('stary licznik ETA z nav-map jest oznaczany jako fallback, a live GPS jako wiarygodny',()=>{
  const source=read('navigation-live-engine.js');
  assert.match(source,/event\.detail\.source='nav-map-fallback'/);
  assert.match(source,/event\.detail\.source='navigation-live-engine'/);
  assert.match(source,/event\.detail\.source==='eta-status'/);
});

test('eta-status nie wyłącza własnego odświeżania podczas otwartej nawigacji',()=>{
  const source=read('eta-status.js');
  assert.match(source,/const NAV_ROUTE_REFRESH_MS=30000/);
  assert.match(source,/const refreshMs=navigationOpen\(\)\?NAV_ROUTE_REFRESH_MS:ROUTE_REFRESH_MS/);
  assert.doesNotMatch(source,/if\(navigationOpen\(\)\)return/);
});

test('podczas nawigacji eta-status przyjmuje tylko ETA policzone z aktualnego postępu GPS',()=>{
  const source=read('eta-status.js');
  assert.match(source,/if\(navigationOpen\(\)&&source!=='navigation-live-engine'\)return/);
});

test('wersja aplikacji i service workera jest spójna, a moduły ETA mają nowy klucz cache',()=>{
  const html=read('index.html');
  const sw=read('sw.js');
  assert.match(html,/navigation-live-engine\.js\?v=8/);
  assert.match(html,/eta-status\.js\?v=eta-stable-1/);
  assert.match(html,/time-core\.js\?v=4/);
  assert.match(html,/untimed-stop-eta-ui\.js\?v=4/);
  assert.match(html,/navigation-stop-ui-fix\.js\?v=2/);
  const version=sw.match(/APP_VERSION='([^']+)'/)?.[1];
  assert.ok(version);
  assert.ok(html.includes(`data-version="${version}"`));
});
