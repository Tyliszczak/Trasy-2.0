(()=>{
  function attach(){
    const map=window.__routeMap;
    if(!map||map.__manualInteractionFix)return false;
    map.__manualInteractionFix=true;

    const originalEaseTo=map.easeTo.bind(map);
    map.easeTo=function(options,eventData){
      const o=options||{};
      const looksLikeFollow=
        Number(o.zoom)===17.2&&
        Number(o.pitch)===58&&
        (Number(o.duration)===420||Number(o.duration)===0);

      if(window.__routeManualView&&looksLikeFollow){
        return map;
      }
      return originalEaseTo(options,eventData);
    };

    const manual=()=>{window.__routeManualView=true;};
    map.on('dragstart',manual);
    map.on('zoomstart',manual);
    map.on('rotatestart',manual);
    map.on('pitchstart',manual);
    return true;
  }

  const timer=setInterval(()=>{if(attach())clearInterval(timer)},200);
  setTimeout(()=>clearInterval(timer),30000);
})();