(()=>{
  const EARTH_RADIUS=6371000;
  const OFF_ROUTE_BASE_METERS=55;
  const OFF_ROUTE_FIXES=2;
  const MIN_DIRECTION_SPEED_MPS=1.8;
  const BEARING_TOLERANCE_DEGREES=75;

  let latestHeading=null;
  let latestSpeed=0;
  let lastGpsPoint=null;
  let lastGpsAt=0;
  let routeCoords=[];
  let offRouteFixes=0;
  let staleGuidanceGuard=false;

  function angleDiff(a,b){
    if(!Number.isFinite(a)||!Number.isFinite(b))return null;
    return Math.abs(((b-a+540)%360)-180);
  }

  function hav(a,b){
    if(!a||!b)return Infinity;
    const p=Math.PI/180;
    const dLat=(b[0]-a[0])*p;
    const dLon=(b[1]-a[1])*p;
    const x=Math.sin(dLat/2)**2+Math.cos(a[0]*p)*Math.cos(b[0]*p)*Math.sin(dLon/2)**2;
    return 2*EARTH_RADIUS*Math.asin(Math.sqrt(x));
  }

  function bearing(a,b){
    if(!a||!b)return null;
    const p=Math.PI/180;
    const lat1=a[0]*p,lat2=b[0]*p,dLon=(b[1]-a[1])*p;
    const y=Math.sin(dLon)*Math.cos(lat2);
    const x=Math.cos(lat1)*Math.sin(lat2)-Math.sin(lat1)*Math.cos(lat2)*Math.cos(dLon);
    return(Math.atan2(y,x)*180/Math.PI+360)%360;
  }

  function cleanGuidanceText(value){
    let text=String(value||'').trim();
    if(!text)return text;

    text=text.replace(/^Skręć\s+(?:lekko\s+)?prosto\s+w\s+(.+)$/i,'Jedź prosto — $1');
    text=text.replace(/^Skręć\s+(?:lekko\s+)?prosto\s*$/i,'Jedź prosto');
    text=text.replace(/^Skręć\s+prosto\s+na\s+(.+)$/i,'Jedź prosto — $1');
    text=text.replace(/\bprosto\s+prosto\b/gi,'prosto');
    text=text.replace(/\bskręć\s+skręć\b/gi,'skręć');
    text=text.replace(/\s{2,}/g,' ').trim();
    return text;
  }

  function normalizeRouteResponse(data){
    try{
      const routes=data?.routes;
      if(!Array.isArray(routes))return data;

      routes.forEach(route=>{
        (route.legs||[]).forEach(leg=>{
          (leg.steps||[]).forEach(step=>{
            const m=step?.maneuver;
            if(!m)return;

            const type=String(m.type||'');
            const mod=String(m.modifier||'');
            const before=Number(m.bearing_before);
            const after=Number(m.bearing_after);
            const realTurn=angleDiff(before,after);

            if((type==='turn'||type==='fork'||type==='new name')&&/left|right/i.test(mod)&&realTurn!==null&&realTurn<25){
              m.type='continue';
              m.modifier='straight';
            }
            if(/straight/i.test(mod)&&type==='turn'){
              m.type='continue';
              m.modifier='straight';
            }
            if(type==='roundabout'||type==='rotary'){
              m.type=type;
              if(!m.exit)m.modifier='';
            }
          });
        });
      });
    }catch{}

    return data;
  }

  function isOsrmRouteUrl(value){
    try{
      const url=new URL(String(value),location.href);
      return url.hostname==='router.project-osrm.org'&&url.pathname.includes('/route/v1/driving/');
    }catch{return false}
  }

  function routeCoordinateCount(url){
    try{
      const marker='/route/v1/driving/';
      const path=new URL(url,location.href).pathname;
      const index=path.indexOf(marker);
      if(index<0)return 0;
      return decodeURIComponent(path.slice(index+marker.length)).split(';').filter(Boolean).length;
    }catch{return 0}
  }

  function directionAwareUrl(value,{withBearing=true}={}){
    const url=new URL(String(value),location.href);
    if(!isOsrmRouteUrl(url.href))return url.href;
    url.searchParams.set('continue_straight','true');
    const count=routeCoordinateCount(url.href);
    if(withBearing&&count>0&&Number.isFinite(latestHeading)&&latestSpeed>=MIN_DIRECTION_SPEED_MPS){
      const first=`${Math.round((latestHeading+360)%360)},${BEARING_TOLERANCE_DEGREES}`;
      url.searchParams.set('bearings',first+';'.repeat(Math.max(0,count-1)));
    }else{
      url.searchParams.delete('bearings');
    }
    return url.href;
  }

  function captureRoute(data){
    const coords=data?.routes?.[0]?.geometry?.coordinates;
    if(!Array.isArray(coords)||coords.length<2)return;
    routeCoords=coords.map(([lng,lat])=>[Number(lat),Number(lng)]).filter(([lat,lng])=>Number.isFinite(lat)&&Number.isFinite(lng));
    offRouteFixes=0;
    staleGuidanceGuard=false;
  }

  function nearestRouteDistance(point){
    let best=Infinity;
    for(const candidate of routeCoords){
      const distance=hav(point,candidate);
      if(distance<best)best=distance;
    }
    return best;
  }

  function setGuard(active){
    staleGuidanceGuard=Boolean(active);
    if(!staleGuidanceGuard)return;
    const maneuver=document.getElementById('routeManeuver');
    const distance=document.getElementById('routeManeuverDistance');
    if(maneuver)maneuver.textContent='Przeliczam trasę zgodnie z kierunkiem jazdy…';
    if(distance)distance.textContent='';
    try{speechSynthesis?.cancel?.()}catch{}
  }

  function updateGps(position){
    const lat=Number(position?.coords?.latitude),lng=Number(position?.coords?.longitude);
    if(!Number.isFinite(lat)||!Number.isFinite(lng))return;
    const here=[lat,lng];
    const now=Number(position.timestamp)||Date.now();
    let speed=Number(position.coords.speed);
    if(!Number.isFinite(speed)||speed<0){
      speed=lastGpsPoint&&lastGpsAt&&now>lastGpsAt?hav(lastGpsPoint,here)/((now-lastGpsAt)/1000):0;
    }
    latestSpeed=Math.max(0,speed);

    let heading=Number(position.coords.heading);
    if((!Number.isFinite(heading)||heading<0)&&lastGpsPoint&&hav(lastGpsPoint,here)>=4){
      heading=bearing(lastGpsPoint,here);
    }
    if(Number.isFinite(heading)&&heading>=0&&latestSpeed>=MIN_DIRECTION_SPEED_MPS)latestHeading=heading;
    lastGpsPoint=here;
    lastGpsAt=now;

    const nav=document.getElementById('routeMapNav');
    if(!nav||nav.hidden||routeCoords.length<2)return;
    const accuracy=Math.max(0,Number(position.coords.accuracy)||0);
    const threshold=Math.max(OFF_ROUTE_BASE_METERS,accuracy*1.6);
    const off=nearestRouteDistance(here);
    if(latestSpeed>=MIN_DIRECTION_SPEED_MPS&&off>threshold)offRouteFixes+=1;
    else offRouteFixes=0;
    if(offRouteFixes>=OFF_ROUTE_FIXES)setGuard(true);
  }

  window.__trasyNormalizeRouteResponse=normalizeRouteResponse;
  window.__trasyCleanGuidanceText=cleanGuidanceText;

  const baseRouteFetch=window.__trasyRouteFetch||window.fetch.bind(window);
  window.__trasyRouteFetch=async(url,options={})=>{
    if(!isOsrmRouteUrl(url))return baseRouteFetch(url,options);
    const strictUrl=directionAwareUrl(url,{withBearing:true});
    let response=await baseRouteFetch(strictUrl,options);
    if(!response.ok&&strictUrl!==directionAwareUrl(url,{withBearing:false})&&!options?.signal?.aborted){
      response=await baseRouteFetch(directionAwareUrl(url,{withBearing:false}),options);
    }
    if(response.ok){
      response.clone().json().then(captureRoute).catch(()=>{});
    }
    return response;
  };

  if(window.__trasyGps){
    try{window.__trasyGps.subscribe(updateGps,()=>{})}catch{}
  }

  function cleanVisibleGuidance(){
    const el=document.getElementById('routeManeuver');
    if(!el)return;
    if(staleGuidanceGuard){
      if(el.textContent!=='Przeliczam trasę zgodnie z kierunkiem jazdy…')el.textContent='Przeliczam trasę zgodnie z kierunkiem jazdy…';
      const distance=document.getElementById('routeManeuverDistance');
      if(distance)distance.textContent='';
      try{speechSynthesis?.cancel?.()}catch{}
      return;
    }
    const clean=cleanGuidanceText(el.textContent);
    if(clean&&clean!==el.textContent)el.textContent=clean;
  }

  const uiTimer=setInterval(()=>{
    const el=document.getElementById('routeManeuver');
    if(!el)return;
    clearInterval(uiTimer);
    cleanVisibleGuidance();
    new MutationObserver(cleanVisibleGuidance).observe(el,{childList:true,characterData:true,subtree:true});
  },200);
  setTimeout(()=>clearInterval(uiTimer),30000);
})();
