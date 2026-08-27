import test from 'node:test';
import assert from 'node:assert/strict';
import {onRequest} from '../functions/osm-vmax/[[path]].js';

function context({method='GET',path=['52','15'],headers}={}){
  return{
    request:new Request(`https://trasy.tyli.pl/osm-vmax/${path.join('/')}`,{method,headers}),
    params:{path}
  };
}

test('proxy OSM odrzuca metodę i nieprawidłową pozycję',async()=>{
  assert.equal((await onRequest(context({method:'POST'}))).status,405);
  assert.equal((await onRequest(context({path:['999','15']}))).status,400);
  assert.equal((await onRequest(context({headers:{Origin:'https://obca.example'}}))).status,403);
});

test('proxy OSM ogranicza odpowiedź do bezpiecznych tagów i zapisuje cache',async t=>{
  const originalFetch=globalThis.fetch;
  const originalCaches=globalThis.caches;
  let stored=null;
  globalThis.caches={default:{
    match:async()=>undefined,
    put:async(key,response)=>{stored={key,response};}
  }};
  globalThis.fetch=async()=>new Response(JSON.stringify({elements:[{
    type:'way',id:7,
    tags:{highway:'primary',maxspeed:'70',operator:'prywatne dane'},
    geometry:[{lat:52,lon:15},{lat:52.001,lon:15}]
  }]}),{status:200,headers:{'Content-Type':'application/json'}});
  t.after(()=>{globalThis.fetch=originalFetch;globalThis.caches=originalCaches;});

  const response=await onRequest(context());
  const data=await response.json();
  assert.equal(response.status,200);
  assert.equal(response.headers.get('X-Trasy-OSM-Cache'),'MISS');
  assert.equal(data.elements[0].tags.maxspeed,'70');
  assert.equal('operator' in data.elements[0].tags,false);
  assert.ok(stored);
});

test('proxy OSM próbuje drugi serwer po błędzie pierwszego',async t=>{
  const originalFetch=globalThis.fetch;
  const originalCaches=globalThis.caches;
  let calls=0;
  globalThis.caches={default:{match:async()=>undefined,put:async()=>{}}};
  globalThis.fetch=async()=>{
    calls+=1;
    if(calls===1)return new Response('{}',{status:503});
    return new Response(JSON.stringify({elements:[]}),{status:200});
  };
  t.after(()=>{globalThis.fetch=originalFetch;globalThis.caches=originalCaches;});

  const response=await onRequest(context());
  assert.equal(response.status,200);
  assert.equal(calls,2);
});

