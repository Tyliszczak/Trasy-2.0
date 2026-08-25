import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';

const readSource=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('godzina ETA jest dokładana do harmonogramu i nagłówka mapy z tego samego stanu ETA',async()=>{
  const [ui,html,worker]=await Promise.all([
    readSource('eta-clock-ui.js'),
    readSource('index.html'),
    readSource('sw.js')
  ]);

  assert.match(ui,/nav-eta-update/);
  assert.match(ui,/eta-status-change/);
  assert.match(ui,/\.etaPunctuality/);
  assert.match(ui,/#routeNextStop \.nextStopStatus/);
  assert.match(ui,/`ETA \$\{formatClock\(seconds\)\} • \$\{base\}`/);
  assert.match(html,/eta-clock-ui\.js\?v=1/);
  assert.match(worker,/'\.\/eta-clock-ui\.js'/);
});
