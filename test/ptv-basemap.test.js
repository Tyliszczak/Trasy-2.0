import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read=name=>readFile(new URL(`../${name}`,import.meta.url),'utf8');

test('PTV jest główną mapą dzienną przez bezpieczny proxy, a OpenFreeMap pozostaje fallbackiem',async()=>{
  const source=await read('ptv-basemap.js');
  assert.match(source,/vectormaps-resources\.myptv\.com\/styles\/latest\/standard\.json/);
  assert.match(source,/const PROXY_PREFIX='\/ptv-map'/);
  assert.match(source,/tiles\.openfreemap\.org\/styles\/liberty/);
  assert.match(source,/trasy:basemap-provider-change/);
  assert.match(source,/provider:'ptv'|,'ptv','secure-proxy'/);
  assert.doesNotMatch(source,/apiKey\s*[:=]\s*['"][^'"]+/i);
});

test('zmiana bazowej mapy czeka aż trasa nawigacji zostanie narysowana',async()=>{
  const [ptv,theme]=await Promise.all([read('ptv-basemap.js'),read('map-day-night.js')]);
  assert.match(ptv,/let routeReady=false/);
  assert.match(ptv,/trasy:route-progress-rendered/);
  assert.match(ptv,/if\(!map\|\|switching\|\|!ensureRouteReady\(\)\)return/);
  assert.doesNotMatch(ptv,/setTimeout\(\(\)=>applyDay\(true\),0\);\s*\n\s*}\s*\n\s*document\.addEventListener\('trasy:map-theme-change'/);
  assert.match(theme,/let routeReady=false/);
  assert.match(theme,/trasy:route-progress-rendered/);
  assert.match(theme,/theme===currentTheme\|\|!ensureRouteReady\(\)/);
  assert.match(ptv,/trasy:map-style-switch-start/);
  assert.match(theme,/trasy:map-style-switch-start/);
});

test('proxy Cloudflare przekazuje klucz PTV wyłącznie z sekretu i nie jest otwartym proxy',async()=>{
  const source=await read('functions/ptv-map/[[path]].js');
  assert.match(source,/env\?\.PTV_API_KEY/);
  assert.match(source,/ApiKey:apiKey/);
  assert.match(source,/const PTV_ORIGIN='https:\/\/api\.myptv\.com'/);
  assert.match(source,/maps\\\/v1\\\/vector-tiles/);
  assert.match(source,/maps\\\/overlays\\\/v1\\\/vector-tiles/);
  assert.match(source,/PTV_MAP_PATH_REJECTED/);
  assert.match(source,/key\.toLowerCase\(\)===['"]apikey['"]/);
});

test('PWA cacheuje logikę mapy, ale nie przechwytuje kafelków PTV',async()=>{
  const [theme,worker]=await Promise.all([read('map-day-night.js'),read('sw.js')]);
  assert.match(theme,/import ['"]\.\/ptv-basemap\.js\?v=1['"]/);
  assert.match(worker,/\.\/ptv-basemap\.js/);
  assert.match(worker,/url\.pathname\.startsWith\(['"]\/ptv-map\/['"]\)\)return/);
});
