(()=>{
  const body=document.getElementById('scheduleBody');
  const header=document.getElementById('routeNextStop');
  if(!body||!header)return;

  function rows(){
    return[...body.querySelectorAll('tr')].filter(row=>row.dataset.coordinate);
  }

  function rowName(row){
    return(
      row?.querySelector('td:first-child')?.childNodes?.[0]?.textContent||
      row?.querySelector('td:first-child')?.innerText||
      ''
    ).trim();
  }

  function apply(){
    const label=header.querySelector('.nextStopLabel');
    const main=header.querySelector('.nextStopMain');
    const status=header.querySelector('.nextStopStatus');
    const guard=header.querySelector('.nextStopGuard');
    if(!label||!main)return;

    const index=Number(body.dataset.gpsNextStop);
    const isReturnStart=body.dataset.direction==='return'&&index===0&&body.dataset.emptyRun!=='1';

    if(!isReturnStart){
      if(label.dataset.returnStart==='1'){
        label.textContent='Następny przystanek';
        delete label.dataset.returnStart;
      }
      return;
    }

    const row=rows()[0];
    const name=rowName(row)||'Punkt startowy';
    const start=String(body.dataset.returnStart||'').trim();

    label.textContent='START TRASY POWROTNEJ';
    label.dataset.returnStart='1';
    main.textContent=`${name}${start?` · Start ${start}`:''}`;

    if(status){
      status.hidden=true;
      status.textContent='';
      status.className='nextStopStatus';
    }
    if(guard){
      guard.hidden=true;
      guard.textContent='';
      guard.classList.remove('approach','hold','ready','flash3');
    }
  }

  ['nav-eta-update','stop-guard-change','gps-next-stop-change','route-direction-change','route-mode-change','schedule-rendered']
    .forEach(type=>body.addEventListener(type,()=>queueMicrotask(apply)));

  new MutationObserver(()=>queueMicrotask(apply)).observe(body,{childList:true,subtree:true});
  setTimeout(apply,0);
})();
