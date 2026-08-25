import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read=name=>readFile(new URL(`../${name}`,import.meta.url),'utf8');

test('kompas jest stale widoczny i niezależny od trybu ręcznego',async()=>{
  const source=await read('navigation-compass.js');
  assert.match(source,/#routeNorthIndicator\[hidden\]\{display:flex!important\}/);
  assert.match(source,/indicator\.hidden=false/);
  assert.doesNotMatch(source,/__routeManualView|state===['"]manual['"]/);
});

test('kompas ma pełną tarczę nawigacyjną zamiast zwykłej strzałki',async()=>{
  const source=await read('navigation-compass.js');
  assert.match(source,/compassCard/);
  assert.match(source,/compassSvg/);
  assert.match(source,/compassLabelNorth/);
  assert.match(source,/fill="#ff3b30"/);
  assert.match(source,/>N<\/text>/);
  assert.match(source,/>E<\/text>/);
  assert.match(source,/>S<\/text>/);
  assert.match(source,/>W<\/text>/);
  assert.match(source,/radial-gradient/);
});

test('kompas wskazuje północ i lekko pochyla się razem z mapą 3D',async()=>{
  const source=await read('navigation-compass.js');
  assert.match(source,/const TILT_RATIO=\.5/);
  assert.match(source,/const MAX_TILT_DEG=30/);
  assert.match(source,/pitch\*TILT_RATIO/);
  assert.match(source,/perspective\(110px\) rotateX\(\$\{tilt\}deg\)/);
  assert.match(source,/rotate\(\$\{-bearing\}deg\)/);
  assert.match(source,/['"]pitch['"]/);
  assert.match(source,/['"]rotate['"]/);
});

test('PWA ładuje i cacheuje kontroler kompasu',async()=>{
  const [html,worker]=await Promise.all([read('index.html'),read('sw.js')]);
  assert.match(html,/navigation-compass\.js\?v=2/);
  assert.match(worker,/\.\/navigation-compass\.js/);
});
