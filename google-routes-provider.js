(()=>{
  const API_URL='https://script.google.com/macros/s/AKfycbzdG_ARbbPgMdlPteqFLakZHR5EEkT4Lb3YFDbXW_I_OyrDKo8l0_KrQLjnncxj_M9q/exec';
  const nativeFetch=window.fetch.bind(window);
  const GOOGLE_ROUTE_TIMEOUT_MS=6500;

  // Domyślnie prowadzimy po OSRM. Google dostarcza tylko ETA/ruch.
  window.__routeMode='osrm';
  window.__routeTrafficDelaySeconds=0;
  window.__routeTrafficAvailable=false;

  function parseOsrmCoordinates(url){
    try{
      const m=String(url).match(/\/route\/v1\/driving\/([^?]+)/);
      if(!m)return null;
      return decodeURIComponent(m[1]).split(';').map(p=>{
        const [lng,lat]=p.split(',').map(Number);
        return Number.isFinite(lat)&&Number.isFinite(lng)
          ?{latitude:lat,longitude:lng}
          :null;
      }).filter(Boolean);
    }catch{return null}
  }

  function numberDuration(v){
    if(Number.isFinite(Number(v)))return Number(v);
    const m=String(v||'').match(/^([0-9.]+)s$/);
    return m?Number(m[1]):0;
  }

  function staticGoogleDuration(route){
    return (route?.legs||[]).reduce((total,leg)=>{
      return total+(leg.steps||[]).reduce(
        (sum,step)=>sum+numberDuration(step.duration),
        0
      );
    },0);
  }

  async function googleTrafficData(coords){
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),GOOGLE_ROUTE_TIMEOUT_MS);

    try{
      const res=await nativeFetch(API_URL,{
        method:'POST',
        headers:{'Content-Type':'text/plain;charset=utf-8'},
        body:JSON.stringify({
          action:'computeGoogleRoute',
          coordinates:coords,
          trafficAware:true
        }),
        cache:'no-store',
        redirect:'follow',
        signal:controller.signal
      });

      if(!res.ok)throw Error(`Google proxy HTTP ${res.status}`);

      const data=await res.json();
      const route=data?.osrmLike?.routes?.[0];

      if(data?.status!=='success'||!route){
        throw Error(data?.message||'Brak danych Google Traffic');
      }

      return data.osrmLike;
    }catch(err){
      if(err?.name==='AbortError')throw Error('Google Traffic timeout');
      throw err;
    }finally{
      clearTimeout(timeout);
    }
  }

  function mergeTraffic(osrmData,googleData){
    const osrmRoute=osrmData?.routes?.[0];
    const googleRoute=googleData?.routes?.[0];
    if(!osrmRoute||!googleRoute)return osrmData;

    const trafficDuration=numberDuration(googleRoute.duration);
    const staticDuration=staticGoogleDuration(googleRoute);

    if(trafficDuration>0){
      osrmRoute.duration=trafficDuration;
    }

    const osrmLegs=osrmRoute.legs||[];
    const googleLegs=googleRoute.legs||[];

    osrmLegs.forEach((leg,i)=>{
      const trafficLeg=numberDuration(googleLegs[i]?.duration);
      if(trafficLeg>0)leg.duration=trafficLeg;
    });

    const delay=(trafficDuration>0&&staticDuration>0)
      ?Math.max(0,trafficDuration-staticDuration)
      :0;

    osrmRoute.trafficDelaySeconds=delay;
    osrmRoute.trafficSource='google';

    window.__routeTrafficDelaySeconds=delay;
    window.__routeTrafficAvailable=true;
    window.__routeProvider='osrm-google-traffic';

    document.dispatchEvent(new CustomEvent('route-traffic-update',{
      detail:{
        delaySeconds:delay,
        durationSeconds:trafficDuration,
        source:'google'
      }
    }));

    return osrmData;
  }

  function jsonResponse(data,sourceResponse){
    return new Response(JSON.stringify(data),{
      status:sourceResponse?.status||200,
      statusText:sourceResponse?.statusText||'OK',
      headers:{'Content-Type':'application/json'}
    });
  }

  window.fetch=async function(input,init){
    const url=typeof input==='string'?input:input?.url||'';

    if(!url.includes('router.project-osrm.org/route/v1/driving/')){
      return nativeFetch(input,init);
    }

    const coords=parseOsrmCoordinates(url);

    // Zachowujemy możliwość ręcznego przełączenia na pełną trasę Google.
    if(window.__routeMode==='google'&&coords?.length>=2){
      try{
        const googleData=await googleTrafficData(coords);
        window.__routeProvider='google-routes-traffic';
        window.__routeTrafficAvailable=true;
        return jsonResponse(googleData);
      }catch(err){
        console.warn('Google Routes niedostępne, wracam do OSRM:',err);
      }
    }

    // Tryb OSRM: geometria, manewry i komunikaty zawsze z OSRM.
    // Google uruchamiamy równolegle wyłącznie po czasy z ruchem.
    const osrmPromise=nativeFetch(input,init);
    const trafficPromise=coords?.length>=2
      ?googleTrafficData(coords)
      :Promise.reject(Error('Brak punktów do Google Traffic'));

    const osrmResponse=await osrmPromise;
    if(!osrmResponse.ok){
      window.__routeProvider='osrm';
      return osrmResponse;
    }

    try{
      const [osrmData,googleData]=await Promise.all([
        osrmResponse.clone().json(),
        trafficPromise
      ]);

      return jsonResponse(
        mergeTraffic(osrmData,googleData),
        osrmResponse
      );
    }catch(err){
      console.warn('Google Traffic niedostępne — ETA z OSRM:',err);
      window.__routeProvider='osrm-traffic-fallback';
      window.__routeTrafficAvailable=false;
      window.__routeTrafficDelaySeconds=0;
      return osrmResponse;
    }
  };
})();
