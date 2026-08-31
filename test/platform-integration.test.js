import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import {requestAllowed} from '../functions/_shared/security.js';

const read=name=>readFile(new URL(`../${name}`,import.meta.url),'utf8');

function bridgeRuntime({context={},api={},profile={mode:'production',requirePlatform:true}}={}){
  const events=[];
  const storage=new Map();
  const window={
    KURSY_DRIVER_CONTEXT:context,KURSY_DRIVER_API:api,__trasyDeploymentProfile:profile,
    addEventListener:()=>{}
  };
  const sandbox={
    window,document:{dispatchEvent:event=>events.push(event),addEventListener:()=>{}},
    navigator:{serviceWorker:null},localStorage:{
      get length(){return storage.size},key:index=>[...storage.keys()][index]??null,
      getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,String(value)),removeItem:key=>storage.delete(key)
    },
    CustomEvent:class{constructor(type,options={}){this.type=type;this.detail=options.detail}},
    console,URL,setTimeout,clearTimeout,caches:{keys:async()=>[],delete:async()=>true}
  };
  sandbox.globalThis=sandbox;
  return{sandbox,window,events,storage};
}

test('DriverPlatformBridge v1 izoluje pamięć firmy, kierowcy i urządzenia',async()=>{
  const source=await read('platform-bridge.js');
  const first=bridgeRuntime({context:{companyId:'Firma A',driverId:'Kierowca 1',deviceId:'Telefon 1'},api:{driverRoutes(){},driverVehicles(){}}});
  vm.runInNewContext(source,first.sandbox);
  const second=bridgeRuntime({context:{companyId:'Firma B',driverId:'Kierowca 1',deviceId:'Telefon 1'},api:{driverRoutes(){},driverVehicles(){}}});
  vm.runInNewContext(source,second.sandbox);
  assert.equal(first.window.__trasyPlatform.contractVersion,'1.0');
  assert.notEqual(first.window.__trasyPlatform.storageKey('trasy2.routes.v3'),second.window.__trasyPlatform.storageKey('trasy2.routes.v3'));
  assert.equal(first.window.__trasyPlatform.scope(),'firma-a.kierowca-1.telefon-1');
});

test('profil produkcyjny nie uruchamia danych bez panelu',async()=>{
  const source=await read('platform-bridge.js');
  const runtime=bridgeRuntime();
  vm.runInNewContext(source,runtime.sandbox);
  assert.equal(runtime.window.__trasyPlatform.connected(),false);
  assert.throws(()=>runtime.window.__trasyPlatform.assertReady(),error=>error.code==='PLATFORM_REQUIRED');
});

test('kontrakt nie przechowuje tokenów, a błędy sesji są zdarzeniem hosta',async()=>{
  const source=await read('platform-bridge.js');
  assert.doesNotMatch(source,/activationToken|driverSessionToken|refreshToken/);
  const api={driverRoutes:async()=>{const error=Error('wygasła');error.code='DRIVER_SESSION_EXPIRED';throw error},driverVehicles(){}};
  const runtime=bridgeRuntime({context:{companyId:'a',driverId:'b',deviceId:'c'},api});
  vm.runInNewContext(source,runtime.sandbox);
  await assert.rejects(()=>runtime.window.__trasyPlatform.routes());
  assert.ok(runtime.events.some(event=>event.type==='trasy:platform-session-expired'&&event.detail.code==='DRIVER_SESSION_EXPIRED'));
});

test('trzy profile wdrożenia rozdzielają test od pilota i produkcji',async()=>{
  const [profile,testManifest,pilotManifest,productionManifest]=await Promise.all([
    read('deployment-profile.js'),read('manifest-test.json'),read('manifest-pilot.json'),read('manifest-production.json')
  ]);
  assert.match(profile,/test:\{/);
  assert.match(profile,/pilot:\{/);
  assert.match(profile,/production:\{/);
  assert.equal(JSON.parse(testManifest).name,'Trasy 2.0 TEST');
  assert.equal(JSON.parse(pilotManifest).name,'Trasy 2.0 PILOT');
  assert.equal(JSON.parse(productionManifest).name,'Trasy 2.0');
  assert.notEqual(JSON.parse(testManifest).id,JSON.parse(productionManifest).id);
});

test('produkcja ma nagłówki bezpieczeństwa i lokalny MapLibre',async()=>{
  const [headers,html,security]=await Promise.all([read('_headers'),read('index.html'),read('functions/_shared/security.js')]);
  for(const name of ['Strict-Transport-Security','Content-Security-Policy','Permissions-Policy','X-Frame-Options'])assert.match(headers,new RegExp(name));
  assert.match(html,/vendor\/maplibre-gl\/5\.12\.0/);
  assert.doesNotMatch(html,/unpkg\.com/);
  assert.match(security,/requestAllowed/);
  assert.match(security,/Sec-Fetch-Site/);
});

test('funkcje akceptują własną domenę i podgląd Pages, ale odrzucają obce źródło',()=>{
  const sameOrigin={'Sec-Fetch-Site':'same-origin'};
  assert.equal(requestAllowed(new Request('https://trasy.tyli.pl/osm-vmax/52/15',{headers:sameOrigin}),{},{}),true);
  assert.equal(requestAllowed(new Request('https://abc123.trasy-2-0.pages.dev/osm-vmax/52/15',{headers:sameOrigin}),{},{}),true);
  assert.equal(requestAllowed(new Request('https://obca.example/osm-vmax/52/15',{headers:sameOrigin}),{},{}),false);
});

test('publiczny ekran kierowcy nie przyjmuje hasła administratora',async()=>{
  const [html,mapEditor]=await Promise.all([read('parking-admin.html'),read('map-editor.html')]);
  assert.doesNotMatch(html,/type="password"|adminPassword|upsertParking/);
  assert.match(html,/https:\/\/app\.tyli\.pl\//);
  assert.match(mapEditor,/https:\/\/app\.tyli\.pl\//);
});
