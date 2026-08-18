(()=>{
  function init(){
    const root=document.getElementById('routeNavRoot');
    const close=document.getElementById('routeMapClose');
    const center=document.getElementById('routeMapCenter');
    if(!root||!close||!center)return false;
    if(root.dataset.compactNavUi==='1')return true;
    root.dataset.compactNavUi='1';

    const top=close.parentElement;
    const title=top?.querySelector('strong');
    if(title)title.style.display='none';
    if(top){
      top.style.height='0';
      top.style.minHeight='0';
      top.style.padding='0';
      top.style.border='0';
      top.style.background='transparent';
      top.style.overflow='visible';
      top.style.position='relative';
      top.style.zIndex='50040';
    }

    close.textContent='←';
    close.setAttribute('aria-label','Zamknij nawigację');
    close.title='Wróć do harmonogramu';
    close.style.cssText='position:fixed;top:10px;left:10px;z-index:50100;width:42px;height:42px;min-width:42px;min-height:42px;padding:0;border:1px solid #fff8;border-radius:50%;background:#111d;color:#fff;font-size:25px;line-height:42px;box-shadow:0 2px 9px #000a';

    const originalCenter=center.onclick;
    center.textContent='⌖';
    center.setAttribute('aria-label','Pokaż mapę z góry');
    center.title='Pokaż mapę z góry';
    center.style.cssText='position:fixed;right:14px;bottom:74px;z-index:50100;width:48px;height:48px;min-width:48px;min-height:48px;padding:0;border:1px solid #fff8;border-radius:50%;background:#111d;color:#fff;font-size:24px;line-height:48px;box-shadow:0 3px 10px #000a';

    let overview=false;
    function setOverview(on){
      overview=!!on;
      if(overview){
        center.textContent='➤';
        center.setAttribute('aria-label','Wróć do prowadzenia');
        center.title='Wróć do prowadzenia';
      }else{
        center.textContent='⌖';
        center.setAttribute('aria-label','Pokaż mapę z góry');
        center.title='Pokaż mapę z góry';
      }
    }

    center.onclick=()=>{
      const map=window.__routeMap;
      if(!map)return;
      if(!overview){
        window.__routeManualView=true;
        setOverview(true);
        try{
          map.easeTo({bearing:0,pitch:0,zoom:Math.min(map.getZoom(),14.8),duration:500,essential:true});
        }catch{}
      }else{
        window.__routeManualView=false;
        setOverview(false);
        if(typeof originalCenter==='function')originalCenter.call(center);
      }
    };

    const markManual=()=>{
      window.__routeManualView=true;
      setOverview(true);
    };
    const mapTimer=setInterval(()=>{
      const map=window.__routeMap;
      if(!map||map.__compactUiGestures)return;
      map.__compactUiGestures=true;
      map.on('dragstart',markManual);
      map.on('zoomstart',markManual);
      map.on('rotatestart',markManual);
      map.on('pitchstart',markManual);
      clearInterval(mapTimer);
    },250);
    setTimeout(()=>clearInterval(mapTimer),30000);

    return true;
  }

  const timer=setInterval(()=>{if(init())clearInterval(timer)},150);
  setTimeout(()=>clearInterval(timer),30000);
})();