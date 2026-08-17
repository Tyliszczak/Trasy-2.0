(()=>{
  const API_URL='https://script.google.com/macros/s/AKfycbzdG_ARbbPgMdlPteqFLakZHR5EEkT4Lb3YFDbXW_I_OyrDKo8l0_KrQLjnncxj_M9q/exec';
  const nativeFetch=window.fetch.bind(window);

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

  async function googleRoute(coords){
    const res=await nativeFetch(API_URL,{
      method:'POST',
      headers:{'Content-Type':'text/plain;charset=utf-8'},
      body:JSON.stringify({action:'computeGoogleRoute',coordinates:coords,trafficAware:true}),
      cache:'no-store',redirect:'follow'
    });
    if(!res.ok)throw Error(`Google proxy HTTP ${res.status}`);
    const data=await res.json();
    if(data?.status!=='success'||!data?.osrmLike?.routes?.[0])throw Error(data?.message||'Brak trasy Google');
    window.__routeProvider='google-traffic';
    return new Response(JSON.stringify(data.osrmLike),{status:200,headers:{'Content-Type':'application/json'}});
  }

  window.fetch=async function(input,init){
    const url=typeof input==='string'?input:input?.url||'';
    if(url.includes('router.project-osrm.org/route/v1/driving/')){
      const coords=parseOsrmCoordinates(url);
      if(coords?.length>=2){
        try{return await googleRoute(coords)}
        catch(err){console.warn('Google Routes niedostępne, używam OSRM:',err);window.__routeProvider='osrm-fallback'}
      }
    }
    return nativeFetch(input,init);
  };
})();