(()=>{
  if(window.__trasyRouteRenderer?.setRoute)return;

  let pendingRoute=null;
  let pendingClear=false;
  let timer=0;

  const bridge={
    __routeRendererBridge:true,
    setRoute(data){
      pendingRoute=data||null;
      pendingClear=false;
      window.__trasyPendingRouteGeometry=pendingRoute;
      return true;
    },
    clear(){
      pendingRoute=null;
      pendingClear=true;
      window.__trasyPendingRouteGeometry=null;
    },
    install(){},
    state(){return{pending:Boolean(pendingRoute),bridge:true}}
  };

  window.__trasyRouteRenderer=bridge;

  function flush(){
    const renderer=window.__trasyRouteRenderer;
    if(!renderer||renderer===bridge||typeof renderer.setRoute!=='function')return false;
    try{
      if(pendingRoute)renderer.setRoute(pendingRoute);
      else if(pendingClear)renderer.clear?.();
      pendingRoute=null;
      pendingClear=false;
      window.__trasyPendingRouteGeometry=null;
      if(timer){clearInterval(timer);timer=0}
      return true;
    }catch(error){
      console.warn('Przekazanie geometrii trasy do renderera:',error);
      return false;
    }
  }

  timer=setInterval(flush,50);
  setTimeout(()=>{if(timer){clearInterval(timer);timer=0}},30000);
  document.addEventListener('trasy:route-map-ready',()=>setTimeout(flush,0));
})();