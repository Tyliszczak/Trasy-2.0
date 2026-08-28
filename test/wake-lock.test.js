import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const source=await readFile(new URL('../wake-style.js',import.meta.url),'utf8');
const flush=async()=>{for(let i=0;i<8;i++)await Promise.resolve()};
function deferred(){let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no});return {promise,resolve,reject}}
class Element{
  listeners=new Map();attributes={};dataset={};hidden=false;textContent='';children=[];
  classList={toggle:()=>{}};
  addEventListener(name,fn){const list=this.listeners.get(name)||[];list.push(fn);this.listeners.set(name,list)}
  async emit(name,event={}){await Promise.all((this.listeners.get(name)||[]).map(fn=>fn(event)))}
  setAttribute(name,value){this.attributes[name]=value}
  append(...nodes){this.children.push(...nodes)}
  replaceChildren(...nodes){this.children=nodes}
  querySelector(){return null}
}
function sentinel(){
  const lock=new Element();lock.released=false;lock.releases=0;
  lock.release=async()=>{lock.released=true;lock.releases++;await lock.emit('release')};
  return lock;
}
function setup({request=async()=>sentinel(),saved=null,storageFails=false,supported=true}={}){
  const button=new Element(),label=new Element(),document=new Element(),window=new Element();
  const values=new Map(saved===null?[]:[['trasy2.keepScreenOn',saved]]),timers=new Map();let timerId=0,calls=0;
  document.visibilityState='visible';document.head=new Element();document.body=new Element();
  document.getElementById=id=>({wakeLockButton:button,wakeLockLabel:label})[id]||null;
  document.createElement=()=>new Element();
  const context={document,window,navigator:supported?{wakeLock:{request:type=>{assert.equal(type,'screen');calls++;return request()}}}:{},
    localStorage:{getItem:key=>{if(storageFails)throw Error('blocked');return values.get(key)??null},setItem:(key,value)=>{if(storageFails)throw Error('blocked');values.set(key,value)}},
    setTimeout:(fn,delay)=>{timers.set(++timerId,{fn,delay});return timerId},clearTimeout:id=>timers.delete(id)};
  vm.runInNewContext(source,context,{filename:'wake-style.js'});
  return {button,label,document,window,timers,values,api:window.__trasyWakeLock,get calls(){return calls},
    get notice(){return document.body.children[0]},
    click:()=>button.emit('click',{preventDefault(){},stopImmediatePropagation(){}}),
    hide:async()=>{document.visibilityState='hidden';await document.emit('visibilitychange')},
    show:async()=>{document.visibilityState='visible';await document.emit('visibilitychange')},
    retry:async()=>{const entry=[...timers].find(([,value])=>value.delay!==10000);assert.ok(entry,'expected retry');timers.delete(entry[0]);entry[1].fn();await flush()}
  };
}

test('button acquires a real lock, saves choice and releases it on OFF',async()=>{
  const lock=sentinel(),app=setup({request:async()=>lock});
  assert.equal(app.calls,0);await app.click();
  assert.equal(app.api.isActive(),true);assert.equal(app.label.textContent,'ON');
  assert.equal(app.values.get('trasy2.keepScreenOn'),'on');
  await app.click();assert.equal(app.api.isActive(),false);assert.equal(lock.releases,1);
  assert.equal(app.label.textContent,'OFF');assert.equal(app.values.get('trasy2.keepScreenOn'),'off');
  assert.equal(app.timers.size,0);
});
test('saved ON is restored after app reload',async()=>{
  const app=setup({saved:'on'});await flush();assert.equal(app.calls,1);assert.equal(app.api.isActive(),true);
});
test('navigation is automatic by default but never overrides explicit OFF',async()=>{
  const app=setup();await app.api.setNavigation(true);assert.equal(app.api.isActive(),true);
  await app.click();assert.equal(app.api.isActive(),false);
  await app.api.setNavigation(true);assert.equal(app.api.isActive(),false);assert.equal(app.calls,1);
  const restored=setup({saved:'off'});await restored.api.setNavigation(true);assert.equal(restored.calls,0);
});
test('manual ON remains active when leaving navigation',async()=>{
  const app=setup();await app.click();await app.api.setNavigation(true);await app.api.setNavigation(false);
  assert.equal(app.api.isActive(),true);assert.equal(app.calls,1);
});
test('simultaneous focus and pageshow use one in-flight request',async()=>{
  const task=deferred(),app=setup({saved:'on',request:()=>task.promise});
  await app.window.emit('focus');await app.window.emit('pageshow');await app.show();
  assert.equal(app.calls,1);assert.equal(app.label.textContent,'…');assert.equal(app.api.isActive(),false);
  task.resolve(sentinel());await flush();assert.equal(app.api.isActive(),true);
});
test('OFF during pending permission releases the late result instead of enabling',async()=>{
  const task=deferred(),lock=sentinel(),app=setup({saved:'on',request:()=>task.promise});
  await app.click();task.resolve(lock);await flush();
  assert.equal(app.api.isActive(),false);assert.equal(lock.releases,1);assert.equal(app.label.textContent,'OFF');
});
test('hiding app releases lock and returning reacquires it',async()=>{
  const locks=[],app=setup({request:async()=>{const lock=sentinel();locks.push(lock);return lock}});
  await app.click();await app.hide();assert.equal(locks[0].released,true);assert.equal(app.api.isActive(),false);
  await app.show();assert.equal(app.calls,2);assert.equal(app.api.isActive(),true);
  await locks[0].emit('release');assert.equal(app.api.isActive(),true);assert.equal(app.label.textContent,'ON');
});
test('hide/show while acquisition is pending discards stale lock and reacquires',async()=>{
  const task=deferred(),old=sentinel();let first=true;
  const app=setup({saved:'on',request:()=>{if(first){first=false;return task.promise}return Promise.resolve(sentinel())}});
  await app.hide();await app.show();task.resolve(old);await flush();
  assert.equal(old.released,true);assert.equal(app.api.isActive(),false);
  await app.retry();assert.equal(app.api.isActive(),true);assert.equal(app.calls,2);
});
test('system release shows OFF and reacquires while app remains visible',async()=>{
  const old=sentinel();let first=true;
  const app=setup({request:async()=>{if(first){first=false;return old}return sentinel()}});
  await app.click();await old.release();assert.equal(app.label.textContent,'OFF');assert.equal(app.notice.hidden,false);
  await app.retry();assert.equal(app.api.isActive(),true);assert.equal(app.notice.hidden,true);
});
test('browser refusal is visible, never reports ON and stops after bounded retries',async()=>{
  const app=setup({request:async()=>{throw Error('NotAllowedError')}});await app.click();
  assert.equal(app.label.textContent,'OFF');assert.equal(app.button.dataset.wakeState,'error');
  assert.match(app.notice.textContent,/Nie udało się/);assert.equal(app.notice.hidden,false);
  for(let i=0;i<3;i++)await app.retry();
  assert.equal(app.calls,4);assert.equal(app.api.isActive(),false);
  assert.equal([...app.timers.values()].filter(timer=>timer.delay!==10000).length,0);
});
test('unsupported API and unavailable storage do not crash the app',async()=>{
  const unsupported=setup({supported:false});await unsupported.click();
  assert.equal(unsupported.button.dataset.wakeState,'unsupported');assert.match(unsupported.notice.textContent,/nie obsługuje/);
  const app=setup({storageFails:true});await app.click();assert.equal(app.api.isActive(),true);
});
