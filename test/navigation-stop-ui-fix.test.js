import test from'node:test';
import assert from'node:assert/strict';
import fs from'node:fs';
const read=path=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('Pomiń jest grupowane bezpośrednio z nazwą aktualnego przystanku',()=>{
  const source=read('navigation-stop-ui-fix.js');
  assert.match(source,/row\.className='nextStopMainRow'/);
  assert.match(source,/row\.appendChild\(main\)/);
  assert.match(source,/row\.appendChild\(skip\)/);
  assert.match(source,/#routeNextStop \.nextStopMainRow\{[\s\S]*display:flex!important/);
});

test('lewy stos funkcji należy do obszaru mapy, a nie górnej belki',()=>{
  const source=read('navigation-stop-ui-fix.js');
  assert.match(source,/if\(stack\.parentElement!==canvas\)canvas\.appendChild\(stack\)/);
  assert.match(source,/#routeMapCanvas>#routeFunctionStack\{[\s\S]*position:absolute!important/);
  assert.match(source,/top:12px!important/);
});

test('wskaźnik pojazdu ma wspólne kolory statusu czasu',()=>{
  const source=read('navigation-stop-ui-fix.js');
  assert.match(source,/if\(kind==='early'\)return'#ff3b30'/);
  assert.match(source,/if\(kind==='late'\)return'#ff9500'/);
  assert.match(source,/if\(kind==='onTime'\|\|kind==='arrived'\)return'#34c759'/);
  assert.match(source,/addEventListener\('nav-eta-update',event=>applyVehicleStatus/);
});

test('nowa poprawka UI jest ładowana jako ostatnia i jest w shellu PWA',()=>{
  const html=read('index.html');
  const sw=read('sw.js');
  assert.match(html,/navigation-layout-fix\.js\?v=5<\/script>\s*<script src="\.\/navigation-stop-ui-fix\.js\?v=1"><\/script>/);
  assert.match(sw,/APP_VERSION='2\.0\.211'/);
  assert.match(sw,/'\.\/navigation-stop-ui-fix\.js'/);
});
