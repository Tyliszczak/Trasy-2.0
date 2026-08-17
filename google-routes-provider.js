(()=>{
  const API_URL='https://script.google.com/macros/s/AKfycbzdG_ARbbPgMdlPteqFLakZHR5EEkT4Lb3YFDbXW_I_OyrDKo8l0_KrQLjnncxj_M9q/exec';
  const nativeFetch=window.fetch.bind(window);
window.__routeMode='google';
  
  function parseOsrmCoordinates(url){
    try{
      const m=String(url).match(/\/route\/v1\/driving\/([^?]+)/);
      if(!m)return null;
      return decodeURIComponent(m[1]).split(';').map(p=>{
        const [lng,lat]=p.split(',').map(Number);
        return Number.isFinite(lat)&&Number.isFinite(lng)?{latitude:lat,longitude:lng}:null;
      }).filter(Boolean);
    }catch{return null}
  }

  function seconds(v){
    const m=String(v||'').match(/^([0-9.]+)s$/);
    return m?Number(m[1]):0;
  }

  function decodePolyline(str){
    let index=0,lat=0,lng=0,out=[];
    while(index<str.length){
      let b,shift=0,result=0;
      do{b=str.charCodeAt(index++)-63;result|=(b&31)<<shift;shift+=5}while(b>=32);
      lat+=(result&1)?~(result>>1):(result>>1);
      shift=0;result=0;
      do{b=str.charCodeAt(index++)-63;result|=(b&31)<<shift;shift+=5}while(b>=32);
      lng+=(result&1)?~(result>>1):(result>>1);
      out.push([lng/1e5,lat/1e5]);
    }
    return out;
  }

  function maneuver(m){
    const x=String(m||'').toUpperCase();
    const map={
      'TURN_LEFT':['turn','left'],'TURN_RIGHT':['turn','right'],
      'TURN_SLIGHT_LEFT':['turn','slight left'],'TURN_SLIGHT_RIGHT':['turn','slight right'],
      'TURN_SHARP_LEFT':['turn','sharp left'],'TURN_SHARP_RIGHT':['turn','sharp right'],
      'STRAIGHT':['continue','straight'],'UTURN_LEFT':['turn','uturn'],'UTURN_RIGHT':['turn','uturn'],
      'ROUNDABOUT_LEFT':['roundabout','left'],'ROUNDABOUT_RIGHT':['roundabout','right'],
      'RAMP_LEFT':['on ramp','left'],'RAMP_RIGHT':['on ramp','right'],
      'MERGE':['merge','straight'],'FORK_LEFT':['fork','left'],'FORK_RIGHT':['fork','right'],
      'NAME_CHANGE':['new name','straight'],'DESTINATION':['arrive','straight']
    };
    return map[x]||['continue','straight'];
  }

  function latLng(loc){
    const p=loc?.latLng;
    return p&&Number.isFinite(Number(p.latitude))&&Number.isFinite(Number(p.longitude))
      ?[Number(p.longitude),Number(p.latitude)]:null;
  }

  function toOsrmLike(data){
    const r=data?.routes?.[0];
    if(!r)return null;
    const geometry=decodePolyline(r.polyline?.encodedPolyline||'');
    const legs=(r.legs||[]).map(leg=>{
      const steps=(leg.steps||[]).map(s=>{
        const mm=maneuver(s.navigationInstruction?.maneuver);
        const loc=latLng(s.startLocation)||latLng(s.endLocation)||geometry[0]||[0,0];
        return {
          distance:Number(s.distanceMeters||0),duration:seconds(s.staticDuration),name:'',
          maneuver:{type:mm[0],modifier:mm[1],location:loc},
          geometry:{coordinates:decodePolyline(s.polyline?.encodedPolyline||'')}
        };
      });
      const end=latLng(leg.endLocation);
      if(end)steps.push({distance:0,duration:0,name:'',maneuver:{type:'arrive',modifier:'straight',location:end}});
      return {distance:Number(leg.distanceMeters||0),duration:seconds(leg.duration),steps};
    });
    return {routes:[{distance:Number(r.distanceMeters||0),duration:seconds(r.duration),geometry:{coordinates:geometry},legs}]};
  }

  async function googleRoute(coords){
  const res=await nativeFetch(API_URL,{
    method:'POST',
    headers:{'Content-Type':'text/plain;charset=utf-8'},
    body:JSON.stringify({
      action:'computeGoogleRoute',
      coordinates:coords,
      trafficAware:true
    }),
    cache:'no-store',
    redirect:'follow'
  });

  if(!res.ok)throw Error(`Google proxy HTTP ${res.status}`);

  const data=await res.json();

  if(data?.status!=='success'||!data?.osrmLike?.routes?.[0]){
    throw Error(data?.message||'Brak trasy Google');
  }

  window.__routeProvider=data.provider||'google-routes-traffic';

  return new Response(
    JSON.stringify(data.osrmLike),
    {
      status:200,
      headers:{'Content-Type':'application/json'}
    }
  );
}

  window.fetch=async function(input,init){
  const url=typeof input==='string'?input:input?.url||'';

  if(url.includes('router.project-osrm.org/route/v1/driving/')){

    const coords=parseOsrmCoordinates(url);

    if(
      window.__routeMode!=='osrm' &&
      coords?.length>=2
    ){
      try{
        return await googleRoute(coords);
      }catch(err){
        console.warn(
          'Google Routes niedostępne, używam OSRM:',
          err
        );

        window.__routeProvider='osrm-fallback';
      }
    }

    window.__routeProvider='osrm';
  }

  return nativeFetch(input,init);
};
})();
