import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import * as liveCore from '../navigation-live-core.js';

const source=name=>readFile(new URL(`../${name}`,import.meta.url),'utf8');
const settle=async()=>{for(let i=0;i<8;i++)await Promise.resolve()};

class Surface{
  constructor(){this.listeners=new Map();this.dataset={};this.children=[];this.hidden=false;this.isConnected=true;this.style={setProperty(){}};this.className='';this.textContent='';}
  addEventListener(type,fn,capture=false){const list=this.listeners.get(type)||[];list.push({fn,capture});this.listeners.set(type,list);}
  dispatchEvent(event){for(const {fn}of [...(this.listeners.get(event.type)||[])].sort((a,b)=>Number(b.capture)-Number(a.capture)))fn(event);return true;}
  appendChild(child){this.children.push(child);return child;}
  append(...children){this.children.push(...children);}
  replaceChildren(...children){this.children=children;}
  remove(){this.isConnected=false;}
}

async function fixture({navigation=false,live=false}={}){
  let now=Date.parse('2026-09-29T10:09:44Z');
  class ClockDate extends Date{constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}}
  const document=new Surface(),window=new Surface(),body=new Surface(),view=new Surface(),nav=new Surface();
  document.visibilityState='visible';document.documentElement=new Surface();nav.hidden=!navigation;
  body.dataset={direction:'forward',emptyRun:'0',gpsNextStop:'0'};
  const rows=['51.96146,15.499002','51.98146,15.509002'].map((coordinate,index)=>{
    const row=new Surface(),cell=new Surface();row.dataset={coordinate,stopId:String(index)};row.children=[new Surface(),cell];
    row.querySelector=()=>cell;row.classList={contains:()=>row===rows[Number(body.dataset.gpsNextStop)]};return row;
  });
  body.querySelector=()=>rows[Number(body.dataset.gpsNextStop)]||null;
  body.querySelectorAll=()=>rows;
  document.getElementById=id=>({scheduleBody:body,scheduleView:view,routeMapNav:nav}[id]||null);
  document.createElement=()=>new Surface();
  const subscribers=[],requests=[],intervals=[],emitted=[];
  body.addEventListener('eta-status-change',event=>emitted.push({...event.detail}));
  window.__trasyGps={subscribe(success,error){subscribers.push({success,error});return subscribers.length;}};
  const context=vm.createContext({console,Date:ClockDate,document,window,navigator:{geolocation:{}},AbortController,Promise,Math,Number,
    CustomEvent:class{constructor(type,options={}){this.type=type;Object.assign(this,options)}},
    performance:{now:()=>now},setInterval:fn=>intervals.push(fn),setTimeout:fn=>queueMicrotask(fn),
    fetch:(url,options)=>new Promise((resolve,reject)=>requests.push({url,options,resolve,reject})),
    planDateForRow:()=>new ClockDate(now+300000),...liveCore});
  for(const name of ['gps-quality.js','geo-core.js','eta-core.js'])vm.runInContext(await source(name),context,{filename:name});
  if(live)vm.runInContext((await source('navigation-live-engine.js')).replace(/^import[\s\S]*?from'[^']+';\s*/,'').replace(/^import'[^']+';\s*/gm,''),context,{filename:'navigation-live-engine.js'});
  vm.runInContext((await source('eta-status.js')).replace(/^import[^\n]*\n/gm,''),context,{filename:'eta-status.js'});
  const emit=(surface,type,detail)=>surface.dispatchEvent({type,detail});
  return {body,rows,window,document,requests,emitted,
    now:()=>now,
    advance:async ms=>{now+=ms;for(const fn of intervals)fn();await settle()},
    position:async(options={})=>{const p={timestamp:options.timestamp??now,coords:{latitude:51.942,longitude:15.499002,accuracy:5,speed:0,...options.coords}};for(const s of subscribers)s.success(p);await settle();return p;},
    resolve:async(index,duration)=>{requests[index].resolve({ok:true,json:async()=>({routes:[{duration}]})});await settle()},
    visibility:async state=>{document.visibilityState=state;emit(document,'visibilitychange');await settle()},
    status:async state=>{emit(window,'trasy:gps-status',{state});await settle()},
    routeEvent:async(type,detail={})=>{emit(body,type,detail);await settle()},
    etaEvent:detail=>{const event={type:'nav-eta-update',detail};body.dispatchEvent(event);return event.detail},
    info:()=>rows[Number(body.dataset.gpsNextStop)].children[1].children.findLast(e=>e.isConnected),
  };
}

test('ETA becomes neutral when a position 2 km from the stop expires, instead of counting down to arrival',async()=>{
  const f=await fixture();await f.position();await f.resolve(0,201.098);
  assert.equal(Number(f.body.dataset.etaSeconds),201.098);
  await f.advance(16000);
  assert.equal(f.body.dataset.etaSeconds,'');assert.equal(f.body.dataset.etaKind,'neutral');
  assert.equal(f.info().textContent,'Aktualizuję pozycję');
  await f.advance(40*60000);
  f.etaEvent({source:'nav-map-fallback',etaSeconds:0,kind:'arrived'});
  assert.equal(f.body.dataset.etaSeconds,'');
  assert.equal(f.emitted.some(e=>e.kind==='arrived'||e.etaSeconds===0),false);
});

test('resume rejects the previous request and delayed GPS, then waits for a fresh route result',async()=>{
  const f=await fixture();await f.position();const beforeResume=f.now();
  await f.visibility('hidden');await f.advance(2000);await f.visibility('visible');
  assert.equal(f.requests[0].options.signal.aborted,true);
  await f.position({timestamp:beforeResume});assert.equal(f.requests.length,1);
  await f.position();assert.equal(f.requests.length,2);
  await f.resolve(0,0);assert.equal(f.body.dataset.etaSeconds,'');
  await f.resolve(1,180);assert.equal(Number(f.body.dataset.etaSeconds),180);
});

test('a reset of the route rejects an older response even when the target id is reused',async()=>{
  const f=await fixture();await f.position();
  await f.routeEvent('schedule-rendered');assert.equal(f.requests.length,2);
  await f.resolve(0,0);assert.equal(f.body.dataset.etaSeconds,'');
  await f.resolve(1,120);assert.equal(Number(f.body.dataset.etaSeconds),120);
});

test('poor GPS clears punctuality and fresh stationary fixes cannot count a route estimate down to zero',async()=>{
  const f=await fixture();await f.position();await f.resolve(0,10);
  await f.advance(10000);await f.position();await f.advance(1000);
  assert.equal(Number(f.body.dataset.etaSeconds),10);
  await f.status('poor');assert.equal(f.body.dataset.etaSeconds,'');
  assert.equal(f.info().textContent,'Słaby sygnał GPS');
});

test('a repeated notification for the visible target preserves the valid ETA while refreshing',async()=>{
  const f=await fixture();await f.position();await f.resolve(0,120);
  const info=f.info();await f.routeEvent('gps-next-stop-change',{key:'0'});
  assert.equal(f.info(),info);assert.equal(Number(f.body.dataset.etaSeconds),120);
  await f.resolve(1,115);assert.equal(Number(f.body.dataset.etaSeconds),115);
});

test('live navigation never accepts a stale fix or exposes stale map fallback after resume',async()=>{
  const f=await fixture({navigation:true,live:true});await f.position();
  const url='https://router.project-osrm.org/route/v1/driving/15.499002,51.942;15.499002,51.96146?overview=full';
  const data={routes:[{geometry:{coordinates:[[15.499002,51.942],[15.499002,51.952],[15.499002,51.96146]]},legs:[{distance:2164,duration:200}]}]};
  f.window.__trasyCaptureRoute(url,data);
  const fresh=f.etaEvent({etaSeconds:0,kind:'arrived'});
  assert.equal(fresh.source,'navigation-live-engine');assert.ok(fresh.etaSeconds>100);
  await f.visibility('hidden');await f.advance(2000);await f.visibility('visible');
  const stale=f.etaEvent({etaSeconds:0,kind:'arrived'});
  assert.equal(stale.source,'nav-map-fallback');assert.equal(stale.etaSeconds,null);assert.equal(stale.kind,'neutral');
  await f.position({timestamp:f.now()-20000});
  assert.equal(f.window.__routeLiveEtaSeconds,null);
  await f.position();assert.ok(f.window.__routeLiveEtaSeconds>100);
});
