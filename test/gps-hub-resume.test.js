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
