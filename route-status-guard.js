(()=>{
  const status=document.getElementById('routeMapStatus');
  if(!status)return;

  let lastRouteStatus='';
  let restoring=false;

  const remember=()=>{
    const text=String(status.textContent||'').trim();

    if(/^Trasa\s+/i.test(text)){
      lastRouteStatus=text;
    }
  };

  remember();

  const observer=new MutationObserver(()=>{
    if(restoring)return;

    const text=String(status.textContent||'').trim();

    if(/^Trasa\s+/i.test(text)){
      lastRouteStatus=text;
      return;
    }

    if(
      lastRouteStatus&&
      text==='Pobieranie przebiegu trasy…'
    ){
      restoring=true;
      status.textContent=lastRouteStatus;
      restoring=false;
    }
  });

  observer.observe(status,{
    childList:true,
    characterData:true,
    subtree:true
  });
})();
