(()=>{
  const body=document.getElementById('scheduleBody');
  const gps=window.__trasyGps;
  const geo=window.__trasyGeo;
  if(!body)return;

  let lastForcedKey='';

  const routeRows=()=>[...body.querySelectorAll('tr')].filter(row=>geo?.parseCoordinate?.(row.dataset.coordinate));

  function nearestRealStop(position){
    if(!geo?.parseCoordinate||!geo?.distanceMeters)return null;
    const rows=routeRows();
    if(rows.length<2)return null;
    const here=[Number(position?.coords?.latitude),Number(position?.coords?.longitude)];
    if(!Number.isFinite(here[0])||!Number.isFinite(here[1]))return null;

    let bestIndex=1;
    let bestDistance=Infinity;
    for(let index=1;index<rows.length;index+=1){
      const target=geo.parseCoordinate(rows[index].dataset.coordinate);
      if(!target)continue;
      const distance=geo.distanceMeters(here,target);
      if(Number.isFinite(distance)&&distance<bestDistance){
        bestIndex=index;
        bestDistance=distance;
      }
    }
    return Number.isFinite(bestDistance)?{index:bestIndex,distance:bestDistance,row:rows[bestIndex]}:null;
  }

  function forceRealReturnTarget(position){
    if(body.dataset.direction!=='return'||body.dataset.emptyRun==='1')return;
    const current=Number(body.dataset.gpsNextStop);
    if(Number.isInteger(current)&&current>0)return;

    const target=nearestRealStop(position);
    if(!target)return;
    const key=target.row?.dataset.stopId||`${target.index}:${target.row?.dataset.coordinate||''}`;
    if(lastForcedKey===key&&Number(body.dataset.gpsNextStop)===target.index)return;
    lastForcedKey=key;

    // Tracker obsługuje ten sam event dla ręcznego przestawienia celu.
    // setTimeout gwarantuje, że gps-stop-tracker.js zdąży podpiąć listener
    // nawet gdy hub GPS odtworzy świeżą pozycję natychmiast po starcie.
    setTimeout(()=>{
      if(body.dataset.direction!=='return'||body.dataset.emptyRun==='1')return;
      const active=Number(body.dataset.gpsNextStop);
      if(Number.isInteger(active)&&active>0)return;
      body.dispatchEvent(new CustomEvent('gps-skip-stop',{
        bubbles:true,
        detail:{index:target.index,source:'return-start-excluded',distance:target.distance}
      }));
    },0);
  }

  function resetTarget(){
    lastForcedKey='';
    delete body.dataset.gpsNextStop;
    delete body.dataset.gpsNextStopKey;
    body.querySelectorAll('tr').forEach(row=>row.classList.remove('gpsNextStop','isActiveStop'));
  }

  body.addEventListener('route-direction-change',e=>{
    if(e.detail?.direction!=='return'||e.detail?.emptyRun)return;

    // Pierwszy wiersz POWROTU jest punktem START, nie przystankiem.
    // Godzina startu pozostaje w górnej belce, ale wiersz 0 nigdy nie może
    // zostać celem GPS ani otrzymać ETA "Dojazd".
    const first=routeRows()[0];
    if(first?.children?.[1])first.children[1].textContent='';
    resetTarget();

    const current=gps?.current?.();
    if(current)setTimeout(()=>forceRealReturnTarget(current),50);
  });

  body.addEventListener('route-mode-change',()=>{lastForcedKey=''});
  body.addEventListener('schedule-rendered',()=>{lastForcedKey=''});

  if(gps?.subscribe){
    gps.subscribe(position=>forceRealReturnTarget(position),()=>{});
  }
})();
