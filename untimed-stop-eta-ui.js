(()=>{
  const body=document.getElementById('scheduleBody');
  const time=globalThis.__trasyTime;
  const header=document.getElementById('routeNextStop');
  if(!body||!header)return;

  const style=document.createElement('style');
  style.textContent=`#scheduleBody .etaPunctuality.etaOnly{color:#ccff33!important}#scheduleBody .etaPunctuality.etaOnly:before{display:none!important;content:none!important}#routeNextStop .nextStopPlan[data-eta-only="1"]{color:#ccff33!important;font-weight:900!important}`;
  document.head.appendChild(style);

  let latestEtaSeconds=null;
  let queued=false;

  function rows(){return[...body.querySelectorAll('tr')].filter(row=>row.dataset.coordinate)}
  function activeRow(){
    const list=rows();
    const index=Number(body.dataset.gpsNextStop);
    if(Number.isInteger(index)&&index>=0&&index<list.length)return list[index];
    return list.find(row=>row.classList.contains('gpsNextStop'))||list[0]||null;
  }
  function planText(row){
    if(!row)return'';
    if(typeof time?.rowPlanText==='function')return String(time.rowPlanText(row)||'').trim();
    const cell=row.children?.[1];
    const direct=[...(cell?.childNodes||[])].filter(node=>node?.nodeType===3).map(node=>String(node.textContent||'').trim()).join(' ');
    return /^\d{1,2}:\d{2}$/.test(direct)?direct:'';
  }
  function arrivalClock(seconds){
    if(!Number.isFinite(seconds))return'';
    const date=new Date(Date.now()+Math.max(0,seconds)*1000);
    return`${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`;
  }
  const planElement=()=>header.querySelector('.nextStopPlan');
  const statusElement=()=>header.querySelector('.nextStopStatus');
  const guardElement=()=>header.querySelector('.nextStopGuard');
  const isUntimed=()=>{const row=activeRow();return Boolean(row&&!planText(row))};

  function render(){
    queued=false;
    const row=activeRow();
    const plan=planElement();
    if(!row||!plan)return;
    if(planText(row)){
      delete plan.dataset.etaOnly;
      return;
    }
    const status=statusElement();
    if(status){
      if(!status.hidden)status.hidden=true;
      if(status.className!=='nextStopStatus')status.className='nextStopStatus';
      if(status.textContent)status.textContent='';
    }
    const guard=guardElement();
    if(guard){
      if(!guard.hidden)guard.hidden=true;
      guard.classList.remove('approach','hold','ready','flash3');
      if(guard.textContent)guard.textContent='';
    }
    if(Number.isFinite(latestEtaSeconds)&&latestEtaSeconds>=0){
      const value=`Dojazd ${arrivalClock(latestEtaSeconds)}`;
      const scheduleInfo=row.querySelector('.etaPunctuality.etaOnly');
      if(scheduleInfo&&scheduleInfo.textContent!==value)scheduleInfo.textContent=value;
      if(plan.textContent!==value)plan.textContent=value;
    }else if(plan.textContent){
      plan.textContent='';
    }
    if(plan.dataset.etaOnly!=='1')plan.dataset.etaOnly='1';
  }
  function queueRender(){if(queued)return;queued=true;queueMicrotask(render)}
  function acceptEta(detail){
    const seconds=Number(detail?.etaSeconds);
    if(Number.isFinite(seconds)&&seconds>=0)latestEtaSeconds=seconds;
    if(isUntimed())queueRender();
  }
  function reset(){latestEtaSeconds=null;queueRender()}

  body.addEventListener('nav-eta-update',event=>acceptEta(event.detail));
  body.addEventListener('eta-status-change',event=>acceptEta(event.detail));
  body.addEventListener('gps-next-stop-change',reset);
  body.addEventListener('route-direction-change',reset);
  body.addEventListener('route-mode-change',reset);
  body.addEventListener('schedule-rendered',reset);

  const initial=Number(body.dataset.etaSeconds);
  if(Number.isFinite(initial)&&initial>=0)latestEtaSeconds=initial;
  render();
})();
