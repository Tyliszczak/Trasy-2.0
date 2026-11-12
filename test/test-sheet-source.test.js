import test from 'node:test';
import assert from 'node:assert/strict';
import {onRequest} from '../functions/trasy-data.js';

const env={
  TRASY_TEST_API_URL:'https://script.google.com/macros/s/test/exec',
  TRASY_TEST_BRIDGE_SECRET:'test-secret'
};
const request=new Request('https://test.trasy-2-0.pages.dev/trasy-data');

test('podgląd pobiera trasy i parking wyłącznie z testowego mostu',async t=>{
  const previous=globalThis.fetch;
  const actions=[];
  t.after(()=>{globalThis.fetch=previous});
  globalThis.fetch=async (url,options)=>{
    assert.equal(url,env.TRASY_TEST_API_URL);
    const body=JSON.parse(options.body);
    assert.equal(body.bridgeSecret,env.TRASY_TEST_BRIDGE_SECRET);
    actions.push(body.action);
    const payload=body.action==='loadDriverData'
      ?{ok:true,data:{
        'SAS Sulechów':[['PRZYSTANEK'],['Przystanek']],
        'APT - Krężoły':[['PRZYSTANEK']],
        'SAS Świebodzin':[['PRZYSTANEK']],
        TopPoint:[['PRZYSTANEK']],
        POJAZDY:[['NAZWA']],
        KIEROWCY:[['DANE PRYWATNE']]
      }}
      :{ok:true,modules:{parkings:{rows:[{
        id:'test',name:'Parking testowy',coordinates:'52.0, 19.0',notes:''
      }]}}};
    return new Response(JSON.stringify(payload),{status:200});
  };
  const response=await onRequest({request,env});
  const body=await response.json();
  assert.equal(response.status,200);
  assert.equal(response.headers.get('X-Trasy-Data-Source'),'test-sheet');
  assert.equal(body.data.PARKINGI[1][1],'Parking testowy');
  assert.equal(body.data.PARKINGI[1][2],'52.0, 19.0');
  assert.equal(body.data.KIEROWCY,undefined);
  assert.equal(JSON.stringify(body).includes(env.TRASY_TEST_BRIDGE_SECRET),false);
  assert.deepEqual(actions.sort(),['loadDriverData','loadOperationalData'].sort());
});

test('brak konfiguracji nie uruchamia produkcyjnego źródła',async()=>{
  const response=await onRequest({request,env:{}});
  assert.equal(response.status,503);
  assert.deepEqual(await response.json(),{status:'error',message:'TEST_SHEET_NOT_CONFIGURED'});
});
