const REQUIRED_SHEETS=['SAS Sulechów','APT - Krężoły','SAS Świebodzin','TopPoint','POJAZDY'];

function json(body,status=200){
  return new Response(JSON.stringify(body),{
    status,
    headers:{
      'Content-Type':'application/json; charset=utf-8',
      'Cache-Control':'no-store, max-age=0',
      'X-Content-Type-Options':'nosniff',
      'X-Trasy-Data-Source':'test-sheet'
    }
  });
}

async function bridge(env,action){
  const upstream=await fetch(env.TRASY_TEST_API_URL,{
    method:'POST',
    headers:{'Content-Type':'text/plain;charset=utf-8'},
    body:JSON.stringify({action,bridgeSecret:env.TRASY_TEST_BRIDGE_SECRET}),
    redirect:'follow',
    cache:'no-store'
  });
  if(!upstream.ok)throw new Error('TEST_BRIDGE_HTTP_ERROR');
  const payload=await upstream.json();
  if(payload?.ok!==true)throw new Error('TEST_BRIDGE_REJECTED');
  return payload;
}

export async function onRequest({request,env}){
  if(request.method!=='GET')return json({status:'error',message:'METHOD_NOT_ALLOWED'},405);
  if(!env?.TRASY_TEST_API_URL||!env?.TRASY_TEST_BRIDGE_SECRET){
    return json({status:'error',message:'TEST_SHEET_NOT_CONFIGURED'},503);
  }
  try{
    if(new URL(env.TRASY_TEST_API_URL).protocol!=='https:')throw new Error('INVALID_TEST_API_URL');
    const [driver,operational]=await Promise.all([
      bridge(env,'loadDriverData'),
      bridge(env,'loadOperationalData')
    ]);
    const source=driver.data;
    if(!source||Array.isArray(source)||typeof source!=='object')throw new Error('INVALID_TEST_ROUTES');
    const missing=REQUIRED_SHEETS.filter(name=>!Array.isArray(source[name]));
    if(missing.length)throw new Error('MISSING_TEST_SHEETS');
    const parkings=operational.modules?.parkings?.rows;
    if(!Array.isArray(parkings))throw new Error('MISSING_TEST_PARKINGS');
    const data={};
    for(const [name,rows] of Object.entries(source)){
      if(Array.isArray(rows)&&!['PARKINGI','KIEROWCY','HARMONOGRAM','DIAGNOSTYKA TESTÓW'].includes(name.toUpperCase())){
        data[name]=rows;
      }
    }
    data.PARKINGI=[
      ['ID','NAZWA','LOKALIZACJA','UWAGI'],
      ...parkings.map(parking=>[
        String(parking.id||''),
        String(parking.name||''),
        String(parking.coordinates||''),
        String(parking.notes||'')
      ])
    ];
    return json({status:'success',data});
  }catch{
    return json({status:'error',message:'TEST_SHEET_UNAVAILABLE'},502);
  }
}
