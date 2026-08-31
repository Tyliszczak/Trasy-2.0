import test from 'node:test';
import assert from 'node:assert/strict';
import {onRequest} from '../functions/ptv-map/[[path]].js';

test('proxy PTV odrzuca Map Matching używany wcześniej dla VMAX',async t=>{
  const originalFetch=globalThis.fetch;
  let called=false;
  globalThis.fetch=async()=>{
    called=true;
    throw Error('PTV nie powinno zostać wywołane');
  };
  t.after(()=>{globalThis.fetch=originalFetch;});

  const response=await onRequest({
    request:new Request('https://trasy.tyli.pl/ptv-map/mapmatch/v1/positions/52/15',{headers:{'Sec-Fetch-Site':'same-origin'}}),
    params:{path:['mapmatch','v1','positions','52','15']},
    env:{PTV_API_KEY:'test-key'}
  });

  assert.equal(response.status,404);
  assert.equal((await response.json()).code,'PTV_MAP_PATH_REJECTED');
  assert.equal(called,false);
});
