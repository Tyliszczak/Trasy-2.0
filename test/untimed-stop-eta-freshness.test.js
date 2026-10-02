import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

async function fixture(initial=''){
  const source=await readFile(new URL('../untimed-stop-eta-ui.js',import.meta.url),'utf8');
  const surface=()=>({listeners:new Map(),dataset:{},textContent:'',hidden:false,className:'',
    classList:{remove(){}},appendChild(){},
    addEventListener(type,fn){const list=this.listeners.get(type)||[];list.push(fn);this.listeners.set(type,list)},
    dispatch(type,detail){for(const fn of this.listeners.get(type)||[])fn({type,detail})}});
  const body=surface(),header=surface(),plan=surface(),status=surface(),guard=surface(),window=surface(),document=surface();
  const row=surface();row.dataset.coordinate='51.96,15.49';row.children=[{}, {childNodes:[]}];row.querySelector=()=>null;
  body.dataset={gpsNextStop:'0',etaSeconds:initial};body.querySelectorAll=()=>[row];
  header.querySelector=selector=>({'.nextStopPlan':plan,'.nextStopStatus':status,'.nextStopGuard':guard}[selector]);
  document.getElementById=id=>({scheduleBody:body,routeNextStop:header}[id]);document.createElement=surface;document.head=surface();
  vm.runInNewContext(source,{document,window,Date,Number,queueMicrotask,__trasyTime:{rowPlanText:()=>''}});
  return {plan,
    eta:async value=>{body.dispatch('eta-status-change',{etaSeconds:value});await Promise.resolve()},
    gps:async state=>{window.dispatch('trasy:gps-status',{state});await Promise.resolve()},
    visibility:async()=>{document.dispatch('visibilitychange');await Promise.resolve()},
  };
}

test('missing untimed ETA starts blank instead of becoming an arrival at the current time',async()=>{
  for(const value of ['',undefined,null]){
    const f=await fixture(value);assert.equal(f.plan.textContent,'');
  }
});

test('null, missing, empty and invalid ETA clear an existing untimed arrival clock',async()=>{
  const f=await fixture();
  for(const value of [null,undefined,'',NaN,-1,'not-a-number']){
    await f.eta(120);assert.match(f.plan.textContent,/^Dojazd \d{2}:\d{2}$/);
    await f.eta(value);assert.equal(f.plan.textContent,'');
  }
  await f.eta(0);assert.match(f.plan.textContent,/^Dojazd \d{2}:\d{2}$/);
});

test('GPS loss and lifecycle changes clear the untimed arrival until a new estimate arrives',async()=>{
  const f=await fixture('120');assert.match(f.plan.textContent,/^Dojazd /);
  await f.gps('poor');assert.equal(f.plan.textContent,'');
  await f.gps('ready');assert.equal(f.plan.textContent,'');
  await f.eta(90);assert.match(f.plan.textContent,/^Dojazd /);
  await f.visibility();assert.equal(f.plan.textContent,'');
});
