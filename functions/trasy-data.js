const SOURCE_URL='https://script.google.com/macros/s/AKfycbyQcnU6xvvrUZNVUJRhQ293L47hZwlvsc6i3n9s9hiYqhLUAoKSqGbPohe_lSB0apfUcw/exec';
const REQUIRED_SHEETS=['SAS Sulechów','APT - Krężoły','SAS Świebodzin','TopPoint','POJAZDY'];

function json(body,status=200){
  return new Response(JSON.stringify(body),{
    status,
    headers:{
      'Content-Type':'application/json; charset=utf-8',
      'Cache-Control':'no-store, max-age=0',
      'X-Content-Type-Options':'nosniff',
      'X-Trasy-Data-Source':'main-sheet'
    }
  });
}

export async function onRequest({request}){
  if(request.method!=='GET')return json({status:'error',message:'METHOD_NOT_ALLOWED'},405);
  try{
    const url=new URL(SOURCE_URL);
    url.searchParams.set('_',String(Date.now()));
    const upstream=await fetch(url.toString(),{
      method:'GET',
      headers:{Accept:'application/json,text/plain;q=0.9,*/*;q=0.8'},
      redirect:'follow',
      cf:{cacheTtl:0,cacheEverything:false}
    });
    if(!upstream.ok)return json({status:'error',message:`UPSTREAM_${upstream.status}`},502);
    const payload=await upstream.json();
    const data=payload?.data??payload;
    if(!data||Array.isArray(data)||typeof data!=='object')return json({status:'error',message:'INVALID_SHEET_PAYLOAD'},502);
    const missing=REQUIRED_SHEETS.filter(name=>!Array.isArray(data[name]));
    if(missing.length)return json({status:'error',message:`MISSING_SHEETS:${missing.join(',')}`},502);
    return json({status:'success',data});
  }catch(error){
    return json({status:'error',message:String(error?.message||error||'TRASY_DATA_UNAVAILABLE')},502);
  }
}
