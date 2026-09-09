(()=>{
  const body=document.getElementById('scheduleBody');
  const time=globalThis.__trasyTime;
  if(!body)return;

  const style=document.createElement('style');
  style.textContent=`
    #scheduleBody .etaPunctuality.etaOnly{color:#ccff33!important}
    #scheduleBody .etaPunctuality.etaOnly:before{display:none!important;content:none!important}
    #routeNextStop .nextStopPlan[data-eta-only="1"]{color:#ccff33!important;font-weight:900!important}
  `;
  document.head.appendChild(style);

  function rows(){return[...body.querySelectorAll('tr')].filter(row=>row.dataset.coordinate)}
  function activeRow(){
    const routeRows=rows();
    const index=Number(body.dataset.gpsNextStop);
    if(Number.isInteger(index)&&index>=0&&index<routeRows.length)return routeRows[index];
    return routeRows.find(row=>row.classList.contains('gpsNextStop'))||routeRows[0]||null;
  }
  function planText(row){
    if(!row)return'';
    if(typeof time?.rowPlanText==='function')return String(time.rowPlanText(row)||'').trim();
    const cell=row.children?.[1];
    return String(cell?.dataset?.routeRolePlan||cell?.dataset?.finalStopPlan||cell?.textContent||'').trim();
  }
  function arrivalClock(seconds){
    if(!Number.isFinite(seconds))return'';
    const date=new Date(Date.now()+Math.max(0,seconds)*1000);
    return`${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`;
  }
  function planElement(){return document.querySelector('#routeNextStop .nextStopPlan')}
  function clearEtaOnly(){
    const plan=planElement();
    if(plan?.dataset.etaOnly==='1'){
      plan.textContent='';
      delete plan.dataset.etaOnly;
    }
  }
  function renderEta(detail){
    const row=activeRow();
    const plan=planElement();
    if(!row||!plan)return;
    if(planText(row)){
      delete plan.dataset.etaOnly;
      return;
    }
    const seconds=Number(detail?.etaSeconds);
    if(!Number.isFinite(seconds)||seconds<0)return;
    plan.textContent=`ETA ${arrivalClock(seconds)}`;
    plan.dataset.etaOnly='1';
  }

  body.addEventListener('nav-eta-update',event=>renderEta(event.detail));
  body.addEventListener('eta-status-change',event=>renderEta(event.detail));
  body.addEventListener('gps-next-stop-change',()=>{clearEtaOnly();setTimeout(()=>renderEta({etaSeconds:Number(body.dataset.etaSeconds)}),0)});
  body.addEventListener('route-direction-change',clearEtaOnly);
  body.addEventListener('route-mode-change',clearEtaOnly);
  body.addEventListener('schedule-rendered',clearEtaOnly);
})();
