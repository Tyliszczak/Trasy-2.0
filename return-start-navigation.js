(()=>{
  const body=document.getElementById('scheduleBody');
  if(!body)return;

  let guardMessage='';

  function isReturnStart(){
    return body.dataset.returnOriginActive==='1' &&
      Number(body.dataset.gpsNextStop||0)===0;
  }

  // Tylko na moment otwierania nawigacji podajemy drugi punkt jako cel trasy.
  // Harmonogram i tracker pozostają na pierwszym punkcie, aby odliczać postój.
  document.addEventListener('click',e=>{
    const link=e.target.closest?.('.routeLink');
    if(!link||!body.contains(link)||!isReturnStart())return;

    body.dataset.gpsNextStop='1';
    setTimeout(()=>{
      if(body.dataset.returnOriginActive==='1'){
        body.dataset.gpsNextStop='0';
      }
    },0);
  },true);

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