(()=>{
  if(window.__trasyRouteRenderer?.setRoute)return;

  const SOURCE='route-bridge-fallback';
  const OUTLINE='route-bridge-fallback-outline';
  const LINE='route-bridge-fallback-line';

  let pendingRoute=null;
  let pendingClear=false;
  let timer=0;
  let map=null;
  let verifyTimer=0;

  function validGeo(data){
    return data?.type==='Feature'&&data?.geometry?.type==='LineString'&&Array.isArray(data.geometry.coordinates)&&data.geometry.coordinates.length>=2;
  }

  function emptyGeo(){
    return{type:'Feature',properties:{},geometry:{type:'LineString',coordinates:[]}};
  }

  function keepFallbackOnTop(){
    if(!map)return;
    for(const id of[OUTLINE,LINE]){
      try{if(map.getLayer?.(id))map.moveLayer(id)}catch{}
    }
  }

  function ensureFallbackLayers(){
    if(!map?.isStyleLoaded?.())return false;
    try{
      if(!map.getSource(SOURCE))map.addSource(SOURCE,{type:'geojson',data:emptyGeo()});
      if(!map.getLayer(OUTLINE))map.addLayer({
        id:OUTLINE,type:'line',source:SOURCE,
        layout:{'line-cap':'round','line-join':'round'},
        paint:{'line-color':'#173000','line-width':11,'line-opacity':.88}
      });
      if(!map.getLayer(LINE))map.addLayer({
        id:LINE,type:'line',source:SOURCE,
        layout:{'line-cap':'round','line-join':'round'},
        paint:{'line-color':'#8bd000','line-width':7,'line-opacity':1}
      });
      keepFallbackOnTop();
      return true;
    }catch(error){
      console.warn('Awaryjna linia trasy:',error);
      return false;
    }
  }

  function drawFallback(data){
    if(!validGeo(data))return false;
    window.__trasyLastRouteGeometry=data;
    if(!ensureFallbackLayers())return false;
    try{
      map.getSource(SOURCE)?.setData(data);
      keepFallbackOnTop();
      return true;
    }catch(error){
      console.warn('Awaryjna geometria trasy:',error);
      return false;
    }
  }

  function clearFallbackData(){
    if(!map||!ensureFallbackLayers())return;
    try{map.getSource(SOURCE)?.setData(emptyGeo())}catch{}
  }

  function removeFallback(){
    if(!map)return;
    try{if(map.getLayer(LINE))map.removeLayer(LINE)}catch{}
    try{if(map.getLayer(OUTLINE))map.removeLayer(OUTLINE)}catch{}
    try{if(map.getSource(SOURCE))map.removeSource(SOURCE)}catch{}
  }

  function rendererIsVisiblyReady(renderer){
    const state=renderer?.state?.()||window.__routeProgressState||{};
    const points=Number(state.activePoints||0)+Number(state.futurePoints||0);
    return Boolean(
      map?.getLayer?.('route-line')&&
      map?.getSource?.('route')&&
      (points>=2||Number(state.fullPoints||0)>=2)
    );
  }

  function verifyRealRenderer(renderer){
    if(verifyTimer)clearInterval(verifyTimer);
    let attempts=0;
    verifyTimer=setInterval(()=>{
      attempts+=1;
      if(rendererIsVisiblyReady(renderer)){
        clearInterval(verifyTimer);verifyTimer=0;
        removeFallback();
      }else if(attempts>=30){
        clearInterval(verifyTimer);verifyTimer=0;
        const geo=window.__trasyLastRouteGeometry;
        if(validGeo(geo))drawFallback(geo);
      }
    },100);
  }

  const bridge={
    __routeRendererBridge:true,
    setRoute(data){
      pendingRoute=data||null;
      pendingClear=false;
      window.__trasyPendingRouteGeometry=pendingRoute;
      if(validGeo(data))drawFallback(data);
      return true;
    },
    clear(){
      pendingRoute=null;
      pendingClear=true;
      window.__trasyPendingRouteGeometry=null;
      window.__trasyLastRouteGeometry=null;
      clearFallbackData();
    },
    install(nextMap){
      map=nextMap||window.__routeMap||map;
      if(map&& !map.__routeBridgeStyleListener){
        map.__routeBridgeStyleListener=true;
        map.on('style.load',()=>{
          const geo=pendingRoute||window.__trasyLastRouteGeometry;
          if(validGeo(geo))setTimeout(()=>drawFallback(geo),0);
        });
      }
      const geo=pendingRoute||window.__trasyLastRouteGeometry;
      if(validGeo(geo))drawFallback(geo);
    },
    state(){return{pending:Boolean(pendingRoute),bridge:true,fallback:Boolean(map?.getLayer?.(LINE))}}
  };

  window.__trasyRouteRenderer=bridge;

  function flush(){
    const renderer=window.__trasyRouteRenderer;
    if(!renderer||renderer===bridge||typeof renderer.setRoute!=='function')return false;
    try{
      const geo=pendingRoute||window.__trasyLastRouteGeometry;
      if(validGeo(geo))renderer.setRoute(geo);
      else if(pendingClear)renderer.clear?.();
      pendingRoute=null;
      pendingClear=false;
      window.__trasyPendingRouteGeometry=null;
      verifyRealRenderer(renderer);
      if(timer){clearInterval(timer);timer=0}
      return true;
    }catch(error){
      console.warn('Przekazanie geometrii trasy do renderera:',error);
      const geo=pendingRoute||window.__trasyLastRouteGeometry;
      if(validGeo(geo))drawFallback(geo);
      return false;
    }
  }

  timer=setInterval(flush,50);
  setTimeout(()=>{if(timer){clearInterval(timer);timer=0}},30000);
  document.addEventListener('trasy:route-map-ready',event=>{
    bridge.install(event.detail?.map||window.__routeMap);
    setTimeout(flush,0);
  });
  if(window.__routeMap)bridge.install(window.__routeMap);
})();