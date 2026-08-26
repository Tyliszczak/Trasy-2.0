import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read=name=>readFile(new URL(`../${name}`,import.meta.url),'utf8');

test('PTV jest główną mapą dzienną, a OSM wyłącznie awaryjnym fallbackiem',async()=>{
  const [source,hook]=await Promise.all([read('ptv-basemap.js'),read('maplibre-route-hook.js')]);
  assert.match(source,/vectormaps-resources\.myptv\.com\/styles\/latest\/standard\.json/);
  assert.match(source,/const PROXY_PREFIX='\/ptv-map'/);
  assert.match(source,/tile\.openstreetmap\.org\/\{z\}\/\{x\}\/\{y\}\.png/);
  assert.match(source,/applyFallback/);
  assert.match(source,/provider==='osm'/);
  assert.doesNotMatch(source,/styles\/liberty/);
  assert.match(hook,/options\.style=theme==='night'\?DARK_STYLE:PTV_STYLE/);
  assert.match(hook,/container==='routeMapCanvas'/);
  assert.match(hook,/PTV_API_ORIGIN/);
  assert.doesNotMatch(hook,/tile\.openstreetmap\.org/);
  assert.doesNotMatch(source,/apiKey\s*[:=]\s*['"][^'"]+/i);
});

test('właściwa mapa jest wybierana przed utworzeniem MapLibre bez startowego OSM',async()=>{
  const [hook,theme]=await Promise.all([read('maplibre-route-hook.js'),read('map-day-night.js')]);
  assert.match(hook,/construct\(Target,args,newTarget\)/);
  assert.match(hook,/function initialTheme\(options\)/);
  assert.match(hook,/__trasyResolveMapTheme/);
  assert.match(hook,/theme=initialTheme\(options\)/);
  assert.match(hook,/provider=theme==='night'\?'openfreemap-dark':'ptv'/);
  assert.match(theme,/window\.__trasyResolveMapTheme=/);
  assert.match(theme,/isNightAt\(new Date\(\),latitude,longitude\)/);
  assert.match(theme,/const markedTheme=map\.getContainer/);
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
  assert.match(theme,/import ['"]\.\/ptv-basemap\.js\?v=2['"]/);
  assert.match(worker,/\.\/ptv-basemap\.js/);
  assert.match(worker,/url\.pathname\.startsWith\(['"]\/ptv-map\/['"]\)\)return/);
});
