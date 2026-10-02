import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const sources=['gps-quality.js','gps-hub.js'].map(file=>readFileSync(new URL('../'+file,import.meta.url),'utf8'));
function setup(){
  let now=1790679000000,id=0;
  const watches=[],requests=[],cleared=[],timers=new Map(),events=[];
  const docEvents={},winEvents={};
  const permission={state:'prompt',addEventListener(type,callback){this.change=callback}};
  const document={visibilityState:'visible',addEventListener(type,fn){(docEvents[type]||=[]).push(fn)}};
  const context={console,Date:{now:()=>now},Promise,Map,TypeError,queueMicrotask,
    CustomEvent:class{constructor(type,{detail}={}){this.type=type;this.detail=detail}},
    setTimeout(fn,ms){const key=++id;timers.set(key,{fn,at:now+ms});return key},clearTimeout(key){timers.delete(key)},
    navigator:{permissions:{query:async()=>permission},geolocation:{
      watchPosition(success,error){watches.push({success,error,id:++id});return id},
      clearWatch(key){cleared.push(key)},getCurrentPosition(success,error){requests.push({success,error})}
    }},document,
    addEventListener(type,fn){(winEvents[type]||=[]).push(fn)},
    dispatchEvent(event){events.push(event);for(const fn of winEvents[event.type]||[])fn(event)}
  };
  context.window=context;vm.createContext(context);sources.forEach(source=>vm.runInContext(source,context));
  const fix=(extra={})=>({timestamp:now,coords:{latitude:52.1,longitude:15.2,accuracy:6},...extra});
  return{context,hub:context.__trasyGps,quality:context.__trasyGpsQuality,watches,requests,cleared,events,permission,fix,
    advance(ms){now+=ms;for(const [key,timer]of [...timers])if(timer.at<=now){timers.delete(key);timer.fn()}},
    visibility(state){document.visibilityState=state;(docEvents.visibilitychange||[]).forEach(fn=>fn())}
  };
}
test('GPS quality rejects invalid, stale and inaccurate observations from the reports',()=>{
  const s=setup();assert.equal(s.quality.evaluate(s.fix()).usable,true);
  assert.equal(s.quality.evaluate(s.fix({coords:{latitude:52,longitude:15,accuracy:831}})).reason,'poor-accuracy');
  assert.equal(s.quality.evaluate(s.fix({timestamp:Date.now()+1e12})).reason,'future-timestamp');
  const old=s.fix();s.advance(40750);assert.equal(s.quality.evaluate(old).reason,'stale');
  for(const p of [null,{coords:{latitude:52,longitude:15,accuracy:6}},s.fix({coords:{latitude:NaN,longitude:15,accuracy:6}}),s.fix({coords:{latitude:52,longitude:15}})])assert.equal(s.quality.evaluate(p).usable,false);
});
test('one watch serves consumers while diagnostics still receives rejected observations',()=>{
  const s=setup(),accepted=[],raw=[];
  s.hub.subscribe(p=>accepted.push(p));s.hub.subscribe(p=>raw.push(p),null,{includeUnreliable:true});assert.equal(s.watches.length,1);
  s.watches[0].success(s.fix({coords:{latitude:52,longitude:15,accuracy:831}}));
  assert.equal(accepted.length,0);assert.equal(raw.length,1);assert.equal(s.hub.current(),null);assert.equal(s.hub.getStatus().state,'poor');
  s.watches[0].success(s.fix());assert.equal(accepted.length,1);assert.equal(s.hub.getStatus().state,'ready');
  s.advance(15001);assert.equal(s.hub.current(),null);assert.equal(s.hub.getStatus().state,'stale');
});
test('resume rejects cached pre-resume positions and callbacks from a retired watch',async()=>{
  const s=setup(),received=[];s.hub.subscribe(p=>received.push(p));const old=s.fix();s.watches[0].success(old);
  s.visibility('hidden');assert.equal(s.hub.current(),null);s.advance(1000);s.visibility('visible');
  assert.equal(s.watches.length,2);assert.equal(s.requests.length,1);
  s.watches[0].success(s.fix());s.watches[1].success(old);assert.equal(received.length,1);assert.equal(s.hub.current(),null);
  const fresh=s.fix();s.requests[0].success(fresh);await Promise.resolve();assert.equal(received.at(-1),fresh);assert.equal(s.hub.getStatus().state,'ready');
});
test('simultaneous refresh calls share one request and watch restart',async()=>{
  const s=setup();s.hub.subscribe(()=>{});const first=s.hub.refresh(),second=s.hub.refresh();
  assert.equal(first,second);assert.equal(s.requests.length,1);assert.equal(s.watches.length,2);
  const fresh=s.fix();s.requests[0].success(fresh);assert.equal(await first,fresh);
});
test('permission denial stops retries and permission restoration starts fresh GPS',async()=>{
  const s=setup();await Promise.resolve();s.hub.subscribe(()=>{});s.watches[0].error({code:1});assert.equal(s.hub.getStatus().state,'denied');
  s.visibility('hidden');s.advance(1000);s.visibility('visible');assert.equal(s.watches.length,1);assert.equal(s.requests.length,0);
  s.permission.state='granted';s.permission.change();assert.equal(s.watches.length,2);assert.equal(s.requests.length,1);
  s.requests[0].success(s.fix());await Promise.resolve();assert.equal(s.hub.getStatus().state,'ready');
});
test('manual refresh recovers denied permission without a permissions change event',async()=>{
  const s=setup();s.hub.subscribe(()=>{});s.watches[0].error({code:1});const recovery=s.hub.refresh();
  s.requests[0].success(s.fix());await recovery;assert.equal(s.hub.getStatus().state,'ready');
});
test('unsubscribe cancels pending refresh and old callbacks cannot resurrect GPS',async()=>{
  const s=setup();const subscription=s.hub.subscribe(()=>{});const pending=s.hub.refresh();
  const rejected=assert.rejects(pending,{name:'AbortError'});s.hub.unsubscribe(subscription);await rejected;
  s.requests[0].success(s.fix());s.watches.at(-1).success(s.fix());assert.equal(s.hub.current(),null);assert.equal(s.hub.subscriberCount(),0);
});
