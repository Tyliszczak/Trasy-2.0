(()=>{
  function attach(){
    const map=window.__routeMap;
    if(!map||map.__manualInteractionFix)return false;
    map.__manualInteractionFix=true;
    const manual=()=>{
      try{window.__routeManualView=true}catch{}
    };
    map.on('dragstart',manual);
    map.on('zoomstart',manual);
    map.on('rotatestart',manual);
    map.on('pitchstart',manual);
    return true;
  }
  const timer=setInterval(()=>{if(attach())clearInterval(timer)},500);
  setTimeout(()=>clearInterval(timer),30000);
})();