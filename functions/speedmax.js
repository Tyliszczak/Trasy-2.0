const PTV_ORIGIN='https://api.myptv.com';

function json(body,status=200){
  return new Response(JSON.stringify(body),{
    status,
    headers:{
      'Content-Type':'application/json; charset=utf-8',
      'Cache-Control':'no-store, max-age=0',
      'X-Content-Type-Options':'nosniff',
      'X-Trasy-Speed-Provider':'ptv'
    }
  });
}

function numberParam(value,min,max){
  const number=Number(value);
  return Number.isFinite(number)&&number>=min&&number<=max?number:null;
}

export async function onRequest({request,env}){
  if(request.method!=='GET')return json({ok:false,code:'METHOD_NOT_ALLOWED'},405);

  const apiKey=String(env?.PTV_API_KEY||'').trim();
  if(!apiKey)return json({ok:false,code:'PTV_SPEEDMAX_NOT_CONFIGURED'},503);

  const incoming=new URL(request.url);
  const lat=numberParam(incoming.searchParams.get('lat'),-90,90);
  const lon=numberParam(incoming.searchParams.get('lon'),-180,180);
  const headingRaw=incoming.searchParams.get('heading');
  const heading=headingRaw===null||headingRaw===''?null:numberParam(headingRaw,0,360);
  if(lat===null||lon===null||(headingRaw!==null&&headingRaw!==''&&heading===null)){
    return json({ok:false,code:'INVALID_POSITION'},400);
  }

  const target=new URL(`${PTV_ORIGIN}/mapmatch/v1/positions/${lat.toFixed(7)}/${lon.toFixed(7)}`);
  target.searchParams.set('results','SEGMENT_ATTRIBUTES');
  target.searchParams.set('calculationMode','QUALITY');
  if(heading!==null)target.searchParams.set('heading',String(heading));

  try{
    const upstream=await fetch(target.toString(),{
      method:'GET',
      headers:{ApiKey:apiKey,Accept:'application/json'},
      redirect:'follow'
    });
    if(!upstream.ok){
      return json({ok:false,code:'PTV_SPEEDMAX_UPSTREAM_ERROR',status:upstream.status},upstream.status>=500?502:upstream.status);
    }

    const data=await upstream.json();
    const attributes=data?.segmentAttributes||{};
    const speed=Number(attributes.speedLimit);
    const roadCategory=Number(attributes.roadCategory);
    return json({
      ok:true,
      provider:'ptv',
      maxspeed:Number.isFinite(speed)&&speed>0?speed:null,
      roadClass:Number.isFinite(roadCategory)?`ptv-${roadCategory}`:'',
      roadCategory:Number.isFinite(roadCategory)?roadCategory:null,
      highSpeedRoad:Number.isFinite(roadCategory)&&roadCategory>=1&&roadCategory<=3,
      builtUpArea:attributes.builtUpArea===true,
      matchDistance:Number.isFinite(Number(data?.matchDistance))?Number(data.matchDistance):null,
      angleDifference:Number.isFinite(Number(data?.angleDifference))?Number(data.angleDifference):null
    });
  }catch{
    return json({ok:false,code:'PTV_SPEEDMAX_UNAVAILABLE'},502);
  }
}
