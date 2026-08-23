import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

import { ROUTES } from '../routes.js';
import { getParkingOptions,normalizeCoordinate } from '../parking-data.js';
import { getRoute, getSchedule, mapUrl } from '../schedule.js';

const readSource=(name)=>readFile(new URL(`../${name}`,import.meta.url),'utf8');

test('główny ekran nie ładuje nieużywanego Leafleta',async()=>{
  const html=await readSource('index.html');
  assert.doesNotMatch(html,/leaflet/i);
  assert.match(html,/maplibre-gl@5\.12\.0/);
});

test('stara lekka nawigacja została usunięta',async()=>{
  const source=await readSource('wake-style.js');
  assert.doesNotMatch(source,/lightNav/);
  assert.doesNotMatch(source,/watchPosition/);
  assert.doesNotMatch(source,/router\.project-osrm\.org/);
});

test('blokadą ekranu zarządza tylko jeden moduł',async()=>{
  const [app,wake]=await Promise.all([readSource('app.js'),readSource('wake-style.js')]);
  assert.doesNotMatch(app,/wakeLock\.request/);
  assert.match(wake,/wakeLock\.request\('screen'\)/);
});

test('service worker nie przeładowuje aplikacji natychmiast po instalacji',async()=>{
  const source=await readSource('sw.js');
  const installHandler=source.split('\n').find(line=>line.includes("addEventListener('install'"))||'';
  assert.doesNotMatch(installHandler,/skipWaiting/);
  assert.match(source,/type==='SKIP_WAITING'/);
});

test('pełna lokalna powłoka mapy znajduje się w cache PWA',async()=>{
  const source=await readSource('sw.js');
  assert.match(source,/\.\/maplibre-route-hook\.js/);
  assert.match(source,/trasy-2\.0-v99/);
  assert.match(source,/\.\/gps-hub\.js/);
  assert.match(source,/\.\/route-data-service\.js/);
  assert.match(source,/\.\/parking-data\.js/);
});

test('odświeżenie PWA wymaga działania kierowcy',async()=>{
  const source=await readSource('app.js');
  assert.match(source,/if\(!reg\.waiting\)return/);
  assert.match(source,/updateRequested=true/);
  assert.match(source,/if\(updateRequested\)location\.reload\(\)/);
});

test('nagłówek następnego przystanku nie odpytuje DOM co pół sekundy',async()=>{
  const source=await readSource('next-stop-header.js');
  assert.doesNotMatch(source,/setInterval/);
});

test('jeden moduł utrzymuje fizyczny nasłuch GPS',async()=>{
  const names=['gps-hub.js','gps-stop-tracker.js','eta-status.js','return-start-guard.js','skip-detection.js','nav-map.js'];
  const sources=await Promise.all(names.map(readSource));
  assert.equal(sources.filter(source=>/watchPosition/.test(source)).length,1);
  assert.match(sources[0],/subscriberCount/);
  sources.slice(1).forEach(source=>assert.match(source,/__trasyGps/));
});

test('kierunki korzystają ze wspólnego źródła danych tras',async()=>{
  const [service,app,returnRoute]=await Promise.all([
    readSource('route-data-service.js'),readSource('app.js'),readSource('return-route.js')
  ]);
  assert.match(service,/script\.google\.com/);
  assert.doesNotMatch(app,/script\.google\.com/);
  assert.doesNotMatch(returnRoute,/script\.google\.com/);
  assert.match(app,/__trasyRouteDataService/);
  assert.match(returnRoute,/__trasyRouteDataService/);
});

test('Na pusto jest niezależne od Powrotu i prowadzi do ostatniego punktu kierunku',async()=>{
  const [returnRoute,nav]=await Promise.all([readSource('return-route.js'),readSource('nav-map.js')]);
  assert.match(returnRoute,/id="emptyRouteSwitch"/);
  assert.match(returnRoute,/id="returnRouteSwitch"/);
  assert.match(returnRoute,/body\.dataset\.emptyRun/);
  assert.match(nav,/remaining\[remaining\.length-1\]/);
});

test('parking wspólny i parking przypisany do trasy są poprawnie wybierane',()=>{
  const data={PARKINGI:[
    ['NAZWA','LOKALIZACJA','TRASA'],
    ['Baza','51.10, 15.20','*'],
    ['Sulechów','51.20;15.30','SAS Sulechów'],
    ['Inna trasa','51.30, 15.40','TopPoint'],
    ['Duplikat','51.10, 15.20','']
  ]};
  assert.deepEqual(getParkingOptions(data,'SAS Sulechów'),[
    {name:'Baza',coordinates:'51.1, 15.2'},
    {name:'Sulechów',coordinates:'51.2, 15.3'}
  ]);
  assert.equal(normalizeCoordinate('91, 15'),'');
});

test('przycisk kompasu jest usunięty, a nawigacja pojawia się poza prowadzeniem',async()=>{
  const source=await readSource('navigation-ui-controls.js');
  assert.doesNotMatch(source,/compassIcon|Kompas \/ widok prowadzenia/);
  assert.match(source,/center\.hidden=this\.state!==['"]manual['"]/);
  assert.match(source,/center\.title='Wróć do nawigacji'/);
});

test('kamera ma jeden kontroler i wraca do prowadzenia po 15 sekundach',async()=>{
  const [html,nav,controls,worker]=await Promise.all([
    readSource('index.html'),readSource('nav-map.js'),readSource('navigation-ui-controls.js'),readSource('sw.js')
  ]);
  assert.doesNotMatch(html,/navigation-smoothing\.js/);
  assert.doesNotMatch(worker,/navigation-smoothing\.js/);
  assert.match(controls,/AUTO_RESUME_MS=15000/);
  assert.match(controls,/this\.resumeTimer=setTimeout\(\(\)=>this\.resume\(\),AUTO_RESUME_MS\)/);
  assert.match(controls,/if\(this\.state===['"]manual['"]\)return/);
  assert.match(nav,/trasy:route-map-ready/);
  assert.doesNotMatch(controls,/setInterval|INSTALL_TIMEOUT_MS/);
});

test('przełącznik 2D i 3D jest od razu kontrolką MapLibre na dole mapy',async()=>{
  const source=await readSource('navigation-ui-controls.js');
  assert.match(source,/this\.map\.addControl\(control,['"]bottom-right['"]\)/);
  assert.doesNotMatch(source,/routePitchFallback|attachPitch/);
});

test('ręczne oddalenie zatrzymuje śledzenie i po 15 sekundach je przywraca',async()=>{
  const source=await readSource('navigation-ui-controls.js');
  const listeners={};
  const timers=new Map();
  let timerId=0;
  const element=()=>({
    style:{},dataset:{},children:[],hidden:false,
    appendChild(child){this.children.push(child);child.parentElement=this;return child},
    remove(){},setAttribute(){},querySelector(){return null}
  });
  const root=element(),close=element(),center=element(),maneuver=element(),top=element(),title=element();
  close.parentElement=top;
  top.querySelector=selector=>selector==='strong'?title:null;
  const nodes={routeNavRoot:root,routeMapClose:close,routeMapCenter:center,routeManeuver:maneuver};
  const document={
    head:element(),
    getElementById:id=>nodes[id]||null,
    createElement:()=>element(),
    addEventListener:(name,handler)=>{listeners[name]=handler}
  };
  const window={speechSynthesis:{speak(){},cancel(){}}};
  const mapEvents={};
  const moves=[];
  let pitch=58;
  const map={
    addControl(control,position){assert.equal(position,'bottom-right');control.onAdd()},
    on(name,handler){(mapEvents[name]??=[]).push(handler)},
    easeTo(options,eventData){moves.push({options,eventData});pitch=options.pitch??pitch},
    getPitch:()=>pitch,
    getBearing:()=>0,
    getCenter:()=>({toArray:()=>[15,51]})
  };
  const context={
    window,document,console,
    setTimeout(fn,delay){const id=++timerId;timers.set(id,{fn,delay});return id},
    clearTimeout(id){timers.delete(id)},
    speechSynthesis:window.speechSynthesis
  };
  vm.runInNewContext(source,context);
  listeners['trasy:route-map-ready']({detail:{map}});
  const controller=window.__routeCameraController;
  controller.follow({center:[15,51],bearing:0,offset:[0,100],instant:true});
  const moveCount=moves.length;
  mapEvents.zoomstart[0]({originalEvent:{}});
  assert.equal(center.hidden,false);
  assert.equal([...timers.values()][0].delay,15000);
  controller.follow({center:[15.1,51.1],bearing:20,offset:[0,100],instant:false});
  assert.equal(moves.length,moveCount);
  [...timers.values()][0].fn();
  assert.equal(moves.at(-1).options.pitch,58);
  assert.equal(moves.at(-1).eventData.trasyCamera,true);
  mapEvents.moveend[0]({trasyCamera:true});
  assert.equal(center.hidden,true);
});

test('dymek uwag działa na każdym ekranie i nie zapisuje nagrań głosowych',async()=>{
  const [html,feedback,worker]=await Promise.all([
    readSource('index.html'),readSource('navigation-feedback.js'),readSource('sw.js')
  ]);
  assert.match(html,/navigation-feedback\.js/);
  assert.match(worker,/navigation-feedback\.js/);
  assert.match(feedback,/routeFeedbackButton/);
  assert.match(feedback,/routeFeedbackNavigation/);
  assert.match(feedback,/SpeechRecognition\|\|window\.webkitSpeechRecognition/);
  assert.match(feedback,/localStorage\.setItem\(STORAGE_KEY/);
  assert.doesNotMatch(feedback,/MediaRecorder|getUserMedia|audio\/webm/);
});

test('uwagę można przekazać przez WhatsApp lub SMS z wymaganym początkiem wiadomości',async()=>{
  const feedback=await readSource('navigation-feedback.js');
  assert.match(feedback,/FEEDBACK_PHONE='\+48603666921'/);
  assert.match(feedback,/return `Trasy 2\.0\\n\\n/);
  assert.match(feedback,/https:\/\/wa\.me\//);
  assert.match(feedback,/sms:\$\{FEEDBACK_PHONE\}\?body=/);
});

test('dane zapasowe tworzą kompletny harmonogram każdej zmiany',()=>{
  assert.ok(ROUTES.length>0);
  for(const route of ROUTES){
    assert.equal(getRoute(ROUTES,route.name),route);
    assert.ok(route.times.length>0,`${route.name}: brak oznaczeń zmian`);
    assert.ok(route.stops.length>0,`${route.name}: brak przystanków`);
    for(const time of route.times){
      const schedule=getSchedule(route,time);
      assert.equal(schedule.length,route.stops.length,`${route.name} ${time}: niepełny harmonogram`);
    }
  }
});

test('link mapy koduje współrzędne bez zmiany wartości',()=>{
  const coordinates='51.123, 15.456';
  const url=mapUrl(coordinates);
  assert.equal(new URL(url).searchParams.get('query'),coordinates);
});
