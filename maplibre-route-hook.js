(()=>{
  if(!window.maplibregl?.Map||window.__routeMapHooked)return;
  window.__routeMapHooked=true;
  const Original=window.maplibregl.Map;
  window.maplibregl.Map=new Proxy(Original,{
    construct(Target,args,newTarget){
      const instance=Reflect.construct(Target,args,newTarget);
      if(args?.[0]?.container==='routeMapCanvas')window.__routeMap=instance;
      return instance;
    }
  });
  window.maplibregl.Map.prototype=Original.prototype;
})();