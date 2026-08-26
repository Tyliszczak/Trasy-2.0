(()=>{
  if(!window.maplibregl?.Map||window.__routeMapHooked)return;
  window.__routeMapHooked=true;

  const Original=window.maplibregl.Map;
  const PTV_STYLE='https://vectormaps-resources.myptv.com/styles/latest/standard.json';
  const DARK_STYLE='https://tiles.openfreemap.org/styles/dark';
  const PTV_API_ORIGIN='https://api.myptv.com';
  const PROXY_PREFIX='/ptv-map';

  function wrapTransformRequest(options){
    const previous=typeof options.transformRequest==='function'?options.transformRequest:null;
    options.transformRequest=(url,type)=>{
      const prior=previous?.(url,type)||null;
      let target=prior?.url||url;
      try{
        const parsed=new URL(target,location.href);
        if(parsed.origin===PTV_API_ORIGIN){
          target=`${location.origin}${PROXY_PREFIX}${parsed.pathname}${parsed.search}`;
        }
      }catch{}
      return prior?{...prior,url:target}:{url:target};
    };
  }

  function initialTheme(options){
    const center=Array.isArray(options?.center)?options.center:null;
    const lng=Number(center?.[0]),lat=Number(center?.[1]);
    if(Number.isFinite(lat)&&Number.isFinite(lng)&&typeof window.__trasyResolveMapTheme==='function'){
      return window.__trasyResolveMapTheme(lat,lng)==='night'?'night':'day';
    }
    return document.documentElement.dataset.mapTheme==='night'?'night':'day';
  }

  window.maplibregl.Map=new Proxy(Original,{
    construct(Target,args,newTarget){
      const originalOptions=args?.[0]||{};
      const options={...originalOptions};
      let provider='';
      let theme='';

      if(options.container==='routeMapCanvas'){
        theme=initialTheme(options);
        provider=theme==='night'?'openfreemap-dark':'ptv';
        options.style=theme==='night'?DARK_STYLE:PTV_STYLE;
        wrapTransformRequest(options);
        args=[options,...(args||[]).slice(1)];
      }

      const instance=Reflect.construct(Target,args,newTarget);
      if(options.container==='routeMapCanvas'){
        window.__routeMap=instance;
        const container=instance.getContainer?.();
        if(container){
          container.dataset.mapProvider=provider;
          container.dataset.mapTheme=theme;
        }
        document.documentElement.dataset.mapProvider=provider;
        document.documentElement.dataset.mapTheme=theme;
      }
      return instance;
    }
  });
  window.maplibregl.Map.prototype=Original.prototype;
})();
