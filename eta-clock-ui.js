(()=>{
  const body=document.getElementById('scheduleBody');
  if(!body)return;

  const ETA_PREFIX=/^ETA\s+\d{2}:\d{2}\s*•\s*/;
  let etaSeconds=null;
  let etaMeasuredAt=0;

  function liveEtaSeconds(){
    if(!Number.isFinite(etaSeconds)||!etaMeasuredAt)return null;
    return Math.max(0,etaSeconds-(Date.now()-etaMeasuredAt)/1000);
  }

  function formatClock(seconds){
    if(!Number.isFinite(seconds))return'';
    const date=new Date(Date.now()+seconds*1000);
    return `${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`;
  }

  function decorate(element){
    if(!element||element.hidden||!element.isConnected)return;
    const base=String(element.textContent||'').replace(ETA_PREFIX,'').trim();
    const seconds=liveEtaSeconds();
    if(!base||!Number.isFinite(seconds)||base==='JESTEŚ NA MIEJSCU')return;
    const next=`ETA ${formatClock(seconds)} • ${base}`;
    if(element.textContent!==next)element.textContent=next;
  }

  function render(){
    const row=body.querySelector('tr.gpsNextStop');
    decorate(row?.querySelector('.etaPunctuality'));
    decorate(document.querySelector('#routeNextStop .nextStopStatus'));
  }

  function capture(event){
    if(event.detail?.kind==='arrived'){
      etaSeconds=null;
      etaMeasuredAt=0;
      return;
    }
    const seconds=Number(event.detail?.etaSeconds);
    if(!Number.isFinite(seconds))return;
    etaSeconds=seconds;
    etaMeasuredAt=Date.now();
    queueMicrotask(render);
  }

  function reset(){
    etaSeconds=null;
    etaMeasuredAt=0;
  }

  body.addEventListener('nav-eta-update',capture);
  body.addEventListener('eta-status-change',capture);
  body.addEventListener('gps-next-stop-change',reset);
  body.addEventListener('route-direction-change',reset);
  body.addEventListener('route-mode-change',reset);
  body.addEventListener('schedule-rendered',reset);

  setInterval(render,1000);
})();
