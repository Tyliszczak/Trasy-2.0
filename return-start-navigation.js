(()=>{
  const body=document.getElementById('scheduleBody');
  if(!body)return;

  let guardMessage='';
  let startActive=false;

  function applyCountdown(){
    if(!startActive||Number(body.dataset.gpsNextStop||0)!==0||!guardMessage)return;
    const nav=document.getElementById('routeMapNav');
    if(!nav||nav.hidden)return;
    const maneuver=document.getElementById('routeManeuver');
    const distance=document.getElementById('routeManeuverDistance');
    if(maneuver&&maneuver.textContent!==guardMessage)maneuver.textContent=guardMessage;
    if(distance)distance.textContent='';
  }

  body.addEventListener('route-direction-change',event=>{
    startActive=event.detail?.direction==='return'&&!event.detail?.emptyRun;
    guardMessage='';
    applyCountdown();
  });

  body.addEventListener('route-mode-change',event=>{
    if(event.detail?.emptyRun){startActive=false;guardMessage=''}
    applyCountdown();
  });

  body.addEventListener('stop-guard-change',event=>{
    guardMessage=String(event.detail?.message||'');
    applyCountdown();
  });

  body.addEventListener('gps-next-stop-change',event=>{
    if(Number(event.detail?.index)>0){startActive=false;guardMessage=''}
    applyCountdown();
  });

  document.addEventListener('trasy:route-map-ready',applyCountdown);
})();
