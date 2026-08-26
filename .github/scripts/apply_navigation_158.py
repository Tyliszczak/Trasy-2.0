from pathlib import Path


def replace_once(path, old, new):
    p = Path(path)
    text = p.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected one match, got {count}")
    p.write_text(text.replace(old, new, 1))


# 1) Navigation progress: never search the whole future route on every GPS fix.
p = Path("nav-map.js")
text = p.read_text()
text = text.replace(
    "  const REROUTE_COOLDOWN_MS=30000;\n",
    "  const REROUTE_COOLDOWN_MS=30000;\n  const ROUTE_PROGRESS_LOOKAHEAD_M=1200;\n  const ROUTE_PROGRESS_BACKTRACK_M=250;\n",
    1,
)
old = """  function nearestRoutePoint(ll,start=0){
    if(!routeCoords.length){
      return{
        index:0,
        distance:Infinity
      };
    }

    let best=Math.max(
      0,
      Math.min(start,routeCoords.length-1)
    );

    let bestD=Infinity;

    const from=Math.max(0,best-80);

    for(
      let i=from;
      i<routeCoords.length;
      i++
    ){
      const d=hav(ll,routeCoords[i]);

      if(d<bestD){
        bestD=d;
        best=i;
      }

      if(i>best+500&&bestD<25){
        break;
      }
    }

    return{
      index:best,
      distance:bestD
    };
  }

  function mapStepsToProgress(){
    stepProgress=steps.map(s=>{
      const loc=s.maneuver?.location;
      if(!loc)return 0;

      const ll=[loc[1],loc[0]];

      let best=0,bestD=Infinity;

      for(
        let i=0;
        i<routeCoords.length;
        i++
      ){
        const d=hav(ll,routeCoords[i]);

        if(d<bestD){
          bestD=d;
          best=i;
        }
      }

      return best;
    });
  }
"""
new = """  function routeWindow(start,backMeters=ROUTE_PROGRESS_BACKTRACK_M,forwardMeters=ROUTE_PROGRESS_LOOKAHEAD_M){
    const safe=Math.max(0,Math.min(Math.trunc(Number(start)||0),Math.max(0,routeCoords.length-1)));
    let from=safe,to=safe,walked=0;
    while(from>0&&walked<backMeters){
      walked+=hav(routeCoords[from],routeCoords[from-1]);
      from-=1;
    }
    walked=0;
    while(to<routeCoords.length-1&&walked<forwardMeters){
      walked+=hav(routeCoords[to],routeCoords[to+1]);
      to+=1;
    }
    return{from,to};
  }

  function nearestRoutePoint(ll,start=0){
    if(!routeCoords.length){
      return{index:0,distance:Infinity};
    }

    const safe=Math.max(0,Math.min(Math.trunc(Number(start)||0),routeCoords.length-1));
    const window=routeWindow(safe);
    let best=safe,bestD=Infinity;

    for(let i=window.from;i<=window.to;i+=1){
      const d=hav(ll,routeCoords[i]);
      if(d<bestD){bestD=d;best=i}
    }

    return{index:best,distance:bestD};
  }

  function mapStepsToProgress(){
    let cursor=0;
    stepProgress=steps.map(s=>{
      const loc=s.maneuver?.location;
      if(!loc)return cursor;

      const ll=[loc[1],loc[0]];
      let best=cursor,bestD=Infinity;

      // Kroki OSRM sa uporzadkowane. Szukamy pierwszego pasujacego miejsca
      // po poprzednim kroku, zamiast ponownie skanowac cala trase od zera.
      for(let i=Math.max(0,cursor-3);i<routeCoords.length;i+=1){
        const d=hav(ll,routeCoords[i]);
        if(d<bestD){bestD=d;best=i}
        if(bestD<3&&i>=best+8)break;
      }

      cursor=Math.max(cursor,best);
      return cursor;
    });
  }
"""
if old not in text:
    raise SystemExit("nav-map progress block not found")
text = text.replace(old, new, 1)

old_layers = """        map.addLayer({
          id:'route-outline',
          type:'line',
          source:'route',
          layout:{
            'line-cap':'round',
            'line-join':'round'
          },
          paint:{
            'line-color':'#202020',
            'line-width':11,
            'line-opacity':.7
          }
        });

        map.addLayer({
          id:'route-line',
          type:'line',
          source:'route',
          layout:{
            'line-cap':'round',
            'line-join':'round'
          },
          paint:{
            'line-color':'#ccff33',
            'line-width':7,
            'line-opacity':.95
          }
        });
"""
new_layers = """        const routeBeforeId=map.getStyle?.()?.layers?.find(layer=>layer.type==='symbol')?.id;

        map.addLayer({
          id:'route-outline',
          type:'line',
          source:'route',
          layout:{
            'line-cap':'round',
            'line-join':'round'
          },
          paint:{
            'line-color':'#202020',
            'line-width':11,
            'line-opacity':.7
          }
        },routeBeforeId);

        map.addLayer({
          id:'route-line',
          type:'line',
          source:'route',
          layout:{
            'line-cap':'round',
            'line-join':'round'
          },
          paint:{
            'line-color':'#ccff33',
            'line-width':7,
            'line-opacity':.95
          }
        },routeBeforeId);
"""
if old_layers not in text:
    raise SystemExit("nav-map route layer block not found")
text = text.replace(old_layers, new_layers, 1)
p.write_text(text)

# 2) The visual progress eraser uses the same local continuity rule.
p = Path("route-progress-core.js")
text = p.read_text()
marker = """export function advanceRouteProgress(coords,point,previousIndex=0,accuracy=0){
  const list=Array.isArray(coords)?coords:[];
  if(list.length<2)return {index:0,distance:Infinity,advanced:false};
  const previous=Math.max(0,Math.min(Math.trunc(Number(previousIndex)||0),list.length-1));
  const snap=nearestRoutePointIndex(list,point,previous,55);
  const tolerance=Math.max(70,Math.max(0,Number(accuracy)||0)*2.2);
  if(!Number.isFinite(snap.distance)||snap.distance>tolerance){
    return {index:previous,distance:snap.distance,advanced:false};
  }
  const next=Math.max(previous,snap.index);
  return {index:next,distance:snap.distance,advanced:next>previous};
}
"""
replacement = """function progressSearchWindow(coords,start,backMeters=250,forwardMeters=1200){
  const list=Array.isArray(coords)?coords:[];
  const safe=Math.max(0,Math.min(Math.trunc(Number(start)||0),Math.max(0,list.length-1)));
  let from=safe,to=safe,walked=0;
  while(from>0&&walked<backMeters){
    walked+=haversineMeters(list[from],list[from-1]);
    from-=1;
  }
  walked=0;
  while(to<list.length-1&&walked<forwardMeters){
    walked+=haversineMeters(list[to],list[to+1]);
    to+=1;
  }
  return{from,to};
}

function nearestProgressPointIndex(coords,point,start=0){
  const list=Array.isArray(coords)?coords:[];
  if(!list.length)return{index:0,distance:Infinity};
  const safe=Math.max(0,Math.min(Math.trunc(Number(start)||0),list.length-1));
  const {from,to}=progressSearchWindow(list,safe);
  let best=safe,bestDistance=Infinity;
  for(let i=from;i<=to;i+=1){
    const distance=haversineMeters(list[i],point);
    if(distance<bestDistance){bestDistance=distance;best=i}
  }
  return{index:best,distance:bestDistance};
}

export function advanceRouteProgress(coords,point,previousIndex=0,accuracy=0){
  const list=Array.isArray(coords)?coords:[];
  if(list.length<2)return {index:0,distance:Infinity,advanced:false};
  const previous=Math.max(0,Math.min(Math.trunc(Number(previousIndex)||0),list.length-1));
  const snap=nearestProgressPointIndex(list,point,previous);
  const tolerance=Math.max(70,Math.max(0,Number(accuracy)||0)*2.2);
  if(!Number.isFinite(snap.distance)||snap.distance>tolerance){
    return {index:previous,distance:snap.distance,advanced:false};
  }
  const next=Math.max(previous,snap.index);
  return {index:next,distance:snap.distance,advanced:next>previous};
}
"""
if marker not in text:
    raise SystemExit("route-progress-core advance block not found")
p.write_text(text.replace(marker, replacement, 1))

# 3) Keep all route graphics below map labels / road shields.
p = Path("route-progress-style.js")
text = p.read_text()
needle = """  function startEraseAnimation(nextPosition){
"""
helper = """  function keepRouteBelowMapLabels(){
    if(!map)return;
    const beforeId=map.getStyle?.()?.layers?.find(layer=>layer.type==='symbol')?.id;
    if(!beforeId)return;
    for(const id of [FUTURE_OUTLINE,FUTURE_LINE,'route-outline','route-line']){
      try{if(map.getLayer?.(id))map.moveLayer(id,beforeId)}catch{}
    }
  }

  function startEraseAnimation(nextPosition){
"""
if needle not in text:
    raise SystemExit("route-progress-style insertion point not found")
text = text.replace(needle, helper, 1)
needle2 = """    paintActiveRoute();
    if(!ensureFutureLayers()){
      setTimeout(queueRender,80);
      return;
    }

    const split=splitRemainingRouteAtPosition"""
repl2 = """    paintActiveRoute();
    if(!ensureFutureLayers()){
      setTimeout(queueRender,80);
      return;
    }
    keepRouteBelowMapLabels();

    const split=splitRemainingRouteAtPosition"""
if needle2 not in text:
    raise SystemExit("route-progress-style render point not found")
p.write_text(
    text.replace(needle2, repl2, 1).replace(
        "./route-progress-core.js?v=3", "./route-progress-core.js?v=4", 1
    )
)

# 4) Live ETA must not globally snap to a later pass on a parallel carriageway.
p = Path("navigation-live-engine.js")
text = p.read_text()
old = """  const searchStart=Math.max(0,lastSnapIndex-120);
  const searchEnd=Math.min(routeModel.points.length-1,lastSnapIndex+1200);
  let snap=nearestRouteIndex(routeModel.points,here,{start:searchStart,end:searchEnd});
  if(snap.distance>Math.max(MAX_ROUTE_SNAP_M,accuracy*2)){
    snap=nearestRouteIndex(routeModel.points,here);
  }
  if(snap.distance>Math.max(MAX_ROUTE_SNAP_M,accuracy*2))return;
"""
new = """  const hereDistance=routeModel.cumulative[lastSnapIndex]||0;
  let searchStart=lastSnapIndex;
  while(searchStart>0&&hereDistance-routeModel.cumulative[searchStart-1]<250)searchStart-=1;
  let searchEnd=lastSnapIndex;
  while(searchEnd<routeModel.points.length-1&&routeModel.cumulative[searchEnd+1]-hereDistance<1200)searchEnd+=1;
  const snap=nearestRouteIndex(routeModel.points,here,{start:searchStart,end:searchEnd});
  if(snap.distance>Math.max(MAX_ROUTE_SNAP_M,accuracy*2))return;
"""
if old not in text:
    raise SystemExit("navigation-live-engine snap block not found")
p.write_text(text.replace(old, new, 1))

# 5) PTV: several tile errors trigger a real local-area health check first.
p = Path("ptv-basemap.js")
text = p.read_text()
text = text.replace(
    "  let routeReady=false;\n", "  let routeReady=false;\n  let errorCheckPending=false;\n", 1
)
old_probe = """  async function probePtv(){
    if(Date.now()<disabledUntil)throw Error('PTV map temporarily disabled');
    const response=await fetchWithTimeout(HEALTH_TILE,{cache:'no-store',credentials:'same-origin'});
    if(!response.ok)throw Error(`PTV map proxy ${response.status}`);
  }
"""
new_probe = """  function currentHealthTile(){
    const center=map?.getCenter?.();
    const lat=Number(center?.lat),lon=Number(center?.lng);
    if(!Number.isFinite(lat)||!Number.isFinite(lon))return HEALTH_TILE;
    const z=Math.max(0,Math.min(17,Math.floor(Number(map?.getZoom?.())||0)));
    const n=2**z;
    const x=Math.max(0,Math.min(n-1,Math.floor((lon+180)/360*n)));
    const rad=Math.max(-85.0511,Math.min(85.0511,lat))*Math.PI/180;
    const y=Math.max(0,Math.min(n-1,Math.floor((1-Math.asinh(Math.tan(rad))/Math.PI)/2*n)));
    return `${PROXY_PREFIX}/maps/v1/vector-tiles/${z}/${x}/${y}`;
  }

  async function probePtv(){
    if(Date.now()<disabledUntil)throw Error('PTV map temporarily disabled');
    const response=await fetchWithTimeout(currentHealthTile(),{cache:'no-store',credentials:'same-origin'});
    if(!response.ok)throw Error(`PTV map proxy ${response.status}`);
  }
"""
if old_probe not in text:
    raise SystemExit("PTV probe block not found")
text = text.replace(old_probe, new_probe, 1)
old_error = """  function onMapError(event){
    if(provider==='osm'||provider==='initial')return;
    const message=String(event?.error?.message||event?.message||'').toLowerCase();
    const ptvError=provider==='ptv'&&(message.includes('ptv-map')||message.includes('myptv')||message.includes('vectormaps-resources'));
    const nightError=provider==='openfreemap-dark'&&(message.includes('openfreemap')||message.includes('tiles.openfreemap'));
    if(!ptvError&&!nightError)return;
    const now=Date.now();
    errorTimes=errorTimes.filter(time=>now-time<=ERROR_WINDOW_MS);
    errorTimes.push(now);
    if(errorTimes.length<ERROR_LIMIT)return;
    errorTimes=[];
    if(provider==='ptv'){
      disabledUntil=now+PTV_RETRY_MS;
      ptvStylePromise=null;
    }
    applyFallback(provider==='ptv'?'ptv-tile-errors':'night-style-errors');
  }
"""
new_error = """  async function verifyPtvBeforeFallback(){
    if(errorCheckPending||provider!=='ptv')return;
    errorCheckPending=true;
    try{
      await probePtv();
      errorTimes=[];
    }catch(error){
      console.warn('PTV nie odpowiada dla aktualnego obszaru — awaryjnie OSM:',error);
      disabledUntil=Date.now()+PTV_RETRY_MS;
      ptvStylePromise=null;
      applyFallback('ptv-health-failed');
    }finally{
      errorCheckPending=false;
    }
  }

  function onMapError(event){
    if(provider==='osm'||provider==='initial')return;
    const message=String(event?.error?.message||event?.message||'').toLowerCase();
    const ptvError=provider==='ptv'&&(message.includes('ptv-map')||message.includes('myptv')||message.includes('vectormaps-resources'));
    const nightError=provider==='openfreemap-dark'&&(message.includes('openfreemap')||message.includes('tiles.openfreemap'));
    if(!ptvError&&!nightError)return;
    const now=Date.now();
    errorTimes=errorTimes.filter(time=>now-time<=ERROR_WINDOW_MS);
    errorTimes.push(now);
    if(errorTimes.length<ERROR_LIMIT)return;
    errorTimes=[];
    if(provider==='ptv'){
      verifyPtvBeforeFallback();
      return;
    }
    applyFallback('night-style-errors');
  }
"""
if old_error not in text:
    raise SystemExit("PTV error block not found")
text = text.replace(old_error, new_error, 1)
old_before = "const beforeId=map.getLayer?.('etoll-lubuskie-line')?'etoll-lubuskie-line':undefined;"
new_before = "const beforeId=map.getStyle?.()?.layers?.find(layer=>layer.type==='symbol')?.id||(map.getLayer?.('etoll-lubuskie-line')?'etoll-lubuskie-line':undefined);"
if old_before not in text:
    raise SystemExit("PTV restore order not found")
p.write_text(text.replace(old_before, new_before, 1))

# 6) Same route-label ordering after day/night style changes.
p = Path("map-day-night.js")
text = p.read_text()
old = "const beforeId=map.getLayer?.('etoll-lubuskie-line')?'etoll-lubuskie-line':undefined;"
new = "const beforeId=map.getStyle?.()?.layers?.find(layer=>layer.type==='symbol')?.id||(map.getLayer?.('etoll-lubuskie-line')?'etoll-lubuskie-line':undefined);"
if old not in text:
    raise SystemExit("theme restore order not found")
text = text.replace(old, new, 1).replace(
    "./ptv-basemap.js?v=2", "./ptv-basemap.js?v=3", 1
)
p.write_text(text)

# 7) Regression tests reproducing the dual-carriageway jump from the video.
p = Path("test/route-progress-core.test.js")
text = p.read_text()
text += """

test('równoległa jezdnia używana dużo później nie może przeskoczyć postępu o kilometry',()=>{
  const outbound=[];
  for(let i=0;i<=120;i+=1)outbound.push([15.0000,52.0000+i*0.0001]);
  const connector=[[15.0001,52.0120]];
  const returning=[];
  for(let i=120;i>=0;i-=1)returning.push([15.0001,52.0000+i*0.0001]);
  const loop=[...outbound,...connector,...returning];
  const previous=40;
  const point=[15.00007,52.0045];
  const progress=advanceRouteProgress(loop,point,previous,8);
  assert.ok(progress.index<80,`nieoczekiwany skok do indeksu ${progress.index}`);
  assert.ok(progress.index>=previous);
});
"""
p.write_text(text)

Path("test/navigation-parallel-road.test.js").write_text(
    """import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=path=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('prowadzenie nie skanuje całej przyszłej trasy przy każdym GPS',()=>{
  const nav=read('nav-map.js');
  const live=read('navigation-live-engine.js');
  assert.match(nav,/ROUTE_PROGRESS_LOOKAHEAD_M=1200/);
  assert.match(nav,/function routeWindow/);
  assert.doesNotMatch(live,/snap=nearestRouteIndex\\(routeModel\\.points,here\\);/);
});

test('zielona trasa pozostaje pod symbolami i numerami dróg',()=>{
  const nav=read('nav-map.js');
  const progress=read('route-progress-style.js');
  const ptv=read('ptv-basemap.js');
  assert.match(nav,/layer=>layer\\.type==='symbol'/);
  assert.match(progress,/keepRouteBelowMapLabels/);
  assert.match(progress,/map\\.moveLayer\\(id,beforeId\\)/);
  assert.match(ptv,/layer=>layer\\.type==='symbol'/);
});

test('PTV nie przełącza się na OSM po samych pojedynczych błędach kafelków',()=>{
  const ptv=read('ptv-basemap.js');
  assert.match(ptv,/currentHealthTile/);
  assert.match(ptv,/verifyPtvBeforeFallback/);
  assert.match(ptv,/applyFallback\\('ptv-health-failed'\\)/);
});
"""
)

# 8) Cache-busting and PWA version.
p = Path("index.html")
text = p.read_text()
text = text.replace("2.0.157", "2.0.158")
text = text.replace("./nav-map.js?v=resume-2", "./nav-map.js?v=resume-3")
text = text.replace("./route-progress-style.js?v=3", "./route-progress-style.js?v=4")
text = text.replace("./map-day-night.js?v=2", "./map-day-night.js?v=3")
text = text.replace("./navigation-live-engine.js?v=4", "./navigation-live-engine.js?v=5")
p.write_text(text)

p = Path("sw.js")
text = p.read_text().replace(
    "APP_VERSION='2.0.157'", "APP_VERSION='2.0.158'", 1
).replace("CACHE_NAME='trasy-2.0-v191'", "CACHE_NAME='trasy-2.0-v192'", 1)
p.write_text(text)

# Existing tests that intentionally pin module query versions.
for path in ["test/map-day-night.test.js", "test/ptv-basemap.test.js"]:
    p = Path(path)
    text = p.read_text()
    text = text.replace("map-day-night\\.js\\?v=2", "map-day-night\\.js\\?v=3")
    text = text.replace("ptv-basemap\\.js\\?v=2", "ptv-basemap\\.js\\?v=3")
    p.write_text(text)
