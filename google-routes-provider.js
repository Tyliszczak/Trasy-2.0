(()=>{
  const nativeFetch=window.fetch.bind(window);
  const GOOGLE_ROUTE_TIMEOUT_MS=6500;

  // Domyślnie prowadzimy po OSRM. Google dostarcza tylko ETA/ruch.
  window.__routeMode='osrm';
  window.__routeTrafficDelaySeconds=0;
  window.__routeTrafficAvailable=false;
  let trafficFallbackWarningShown=false;

  function useTrafficFallback(error){
    window.__routeProvider='osrm-traffic-fallback';
    window.__routeTrafficAvailable=false;
    window.__routeTrafficDelaySeconds=0;
    if(!trafficFallbackWarningShown){
      trafficFallbackWarningShown=true;
      console.info('Google Traffic niedostępne — ETA z OSRM.',error?.message||error||'');
    }
  }

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
    const routeStatic=numberDuration(route?.staticDuration);
    if(routeStatic>0)return routeStatic;
    return (route?.legs||[]).reduce((total,leg)=>{
      const legStatic=numberDuration(leg?.staticDuration);
      if(legStatic>0)return total+legStatic;
      return total+(leg.steps||[]).reduce(
        (sum,step)=>sum+numberDuration(step.staticDuration),
        0
      );
    },0);
  }

  async function googleTrafficData(coords,externalSignal){
    const controller=new AbortController();
    const abortFromExternal=()=>controller.abort();
    if(externalSignal?.aborted)controller.abort();
    else externalSignal?.addEventListener('abort',abortFromExternal,{once:true});
    const timeout=setTimeout(()=>controller.abort(),GOOGLE_ROUTE_TIMEOUT_MS);

    try{
      const api=window.KURSY_DRIVER_API;
      if(!api||typeof api.driverComputeRoute!=='function')throw Error('Bezpieczne Google Traffic nie jest jeszcze podłączone.');
      const data=await api.driverComputeRoute(coords,{signal:controller.signal});
      const google=data?.google??data?.osrmLike??data;
      if(!Array.isArray(google?.routes)||!google.routes.length)throw Error(data?.message||'Brak danych Google Traffic');
      return google;
    }catch(err){
      if(err?.name==='AbortError'){
        if(externalSignal?.aborted)throw err;
        throw Error('Google Traffic timeout');
      }
      throw err;
    }finally{
      clearTimeout(timeout);
      externalSignal?.removeEventListener?.('abort',abortFromExternal);
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

  window.__trasyRouteFetch=async function(input,init){
    const url=typeof input==='string'?input:input?.url||'';

    if(!url.includes('router.project-osrm.org/route/v1/driving/')){
      return nativeFetch(input,init);
    }

    const coords=parseOsrmCoordinates(url);

    // Zachowujemy możliwość ręcznego przełączenia na pełną trasę Google.
    if(window.__routeMode==='google'&&coords?.length>=2){
      try{
        const googleData=await googleTrafficData(coords,init?.signal);
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
    let trafficError=null;
    const trafficPromise=coords?.length>=2
      ?googleTrafficData(coords,init?.signal).catch(error=>{trafficError=error;return null})
      :Promise.resolve(null);

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

      if(!googleData){
        useTrafficFallback(trafficError);
        return osrmResponse;
      }

      return jsonResponse(
        mergeTraffic(osrmData,googleData),
        osrmResponse
      );
    }catch(err){
      useTrafficFallback(err);
      return osrmResponse;
    }
  };
})();
