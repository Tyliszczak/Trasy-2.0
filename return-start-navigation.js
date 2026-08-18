(()=>{
  const body=document.getElementById('scheduleBody');
  if(!body)return;

  let guardMessage='';

  function isReturnStart(){
    return body.dataset.returnOriginActive==='1' &&
      Number(body.dataset.gpsNextStop||0)===0;
  }

  // Punkt startowy powrotu pozostaje stabilnie aktywny w harmonogramie.
  // Nie zmieniamy już tymczasowo gpsNextStop na drugi punkt przy otwieraniu mapy,
  // bo powodowało to miganie podświetlenia między startem a najbliższym przystankiem.
  function applyCountdown(){
    if(!isReturnStart()||!guardMessage)return;
    const nav=document.getElementById('routeMapNav');
    if(!nav||nav.hidden)return;
    const maneuver=document.getElementById('routeManeuver');
    const distance=document.getElementById('routeManeuverDistance');
    if(maneuver&&maneuver.textContent!==guardMessage){
      maneuver.textContent=guardMessage;
    }
    if(distance)distance.textContent='';
  }

  body.addEventListener('stop-guard-change',e=>{
    guardMessage=String(e.detail?.message||'');
    applyCountdown();
  });

  body.addEventListener('gps-next-stop-change',e=>{
    if(Number(e.detail?.index)>0){
      body.dataset.returnOriginActive='';
      guardMessage='';
    }
  });

  setInterval(applyCountdown,250);
})();