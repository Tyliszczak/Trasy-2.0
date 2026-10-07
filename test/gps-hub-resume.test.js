import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

test('GPS hub restarts the native watch and publishes a fresh position after resume',async()=>{
  const source=await readFile(new URL('../gps-hub.js',import.meta.url),'utf8');
  let watchStarts=0,watchClears=0,watchSuccess=null;
  const fresh={timestamp:Date.now(),coords:{latitude:52.1,longitude:15.2,accuracy:6}};
  const documentListeners={};
  const windowListeners={};
  const context={
    console,
    Date,
    Promise,
    Map,
    TypeError,
    queueMicrotask,
    navigator:{geolocation:{
      watchPosition(success){watchStarts+=1;watchSuccess=success;return watchStarts},
      clearWatch(){watchClears+=1},
      getCurrentPosition(success){success(fresh)}
    }},
    document:{visibilityState:'visible',addEventListener(name,fn){documentListeners[name]=fn}},
    window:{addEventListener(name,fn){windowListeners[name]=fn}}
  };
  context.window.window=context.window;
  context.window.navigator=context.navigator;
  context.window.document=context.document;
  vm.runInNewContext(source,context);

  const received=[];
  context.window.__trasyGps.subscribe(position=>received.push(position));
  assert.equal(watchStarts,1);
  await context.window.__trasyGps.refresh();
  assert.equal(watchClears,1);
  assert.equal(watchStarts,2);
  assert.equal(received.at(-1),fresh);
  assert.equal(typeof watchSuccess,'function');
  assert.equal(typeof documentListeners.visibilitychange,'function');
  assert.equal(typeof windowListeners.pageshow,'function');
});

test('GPS hub restarts a stale watch and exposes the stale event',async()=>{
  const source=await readFile(new URL('../gps-hub.js',import.meta.url),'utf8');
  let watchStarts=0,watchSuccess=null,watchdog=null;
  const events=[];
  const fresh={timestamp:Date.now(),coords:{latitude:52.1,longitude:15.2,accuracy:6}};
  const context={
    console,Date,Promise,Map,TypeError,queueMicrotask,
    setInterval(fn){watchdog=fn;return 1},clearInterval(){},
    CustomEvent:class{constructor(type,init){this.type=type;this.detail=init.detail}},
    navigator:{geolocation:{
      watchPosition(success){watchStarts+=1;watchSuccess=success;return watchStarts},
      clearWatch(){},getCurrentPosition(success){success(fresh)}
    }},
    document:{visibilityState:'visible',addEventListener(){},dispatchEvent(event){events.push(event)}},
    window:{addEventListener(){}}
  };
  context.window.window=context.window;context.window.navigator=context.navigator;context.window.document=context.document;
  vm.runInNewContext(source,context);
  context.window.__trasyGps.subscribe(()=>{});
  watchSuccess({timestamp:Date.now()-20000,coords:{latitude:52.1,longitude:15.2,accuracy:6}});
  watchdog();
  await Promise.resolve();
  assert.equal(watchStarts,2);
  assert.ok(events.some(event=>event.type==='trasy:gps-stale'));
});
