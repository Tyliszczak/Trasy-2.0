(()=>{
  const technicalStyle=document.createElement('style');
  technicalStyle.id='technicalBarLayoutFix';
  technicalStyle.textContent=`
    #globalTestVersion{
      top:4.5px!important;
      right:7.5px!important;
      padding:2.5px 6.5px!important;
      border-radius:5.5px!important;
      font-size:15px!important;
      line-height:1!important;
      opacity:.89!important;
    }
    html body .header{
      min-height:27px!important;
      height:27px!important;
      padding:3px 8px!important;
    }
    html body .headerActions{padding-right:118px!important}
    html body .container{margin-top:33px!important}
    #routeNavRoot{inset:27px 0 0 0!important}

    /* Harmonogram: pasek techniczny i właściwa górna belka nie mogą na siebie nachodzić. */
    body:has(#scheduleView:not([hidden])) .container{
      margin-top:0!important;
      padding-top:33px!important;
      margin-bottom:0!important;
      height:100dvh!important;
      max-height:100dvh!important;
      overflow:hidden!important;
    }
    body:has(#scheduleView:not([hidden])) #scheduleView{
      height:calc(100dvh - 33px)!important;
      max-height:calc(100dvh - 33px)!important;
      overflow:hidden!important;
    }
    body:has(#scheduleView:not([hidden])) #scheduleView .scheduleHeading{
      position:relative!important;
      top:auto!important;
      flex:0 0 auto!important;
      margin:0 -8px 6px!important;
      padding-top:9px!important;
      z-index:30!important;
    }
    body:has(#scheduleView:not([hidden])) #scheduleView .tableWrap{
      flex:1 1 auto!important;
      min-height:0!important;
      overflow-y:auto!important;
      overflow-x:hidden!important;
      overscroll-behavior:contain!important;
    }
  `;
  document.head.appendChild(technicalStyle);

  const CHECK_INTERVAL_MS=10*60*1000;
  const button=document.getElementById('showSchedule');
  const notice=document.getElementById('updateNotice');
  const currentVersion=String(document.getElementById('globalTestVersion')?.dataset.version||'');
  if(!('serviceWorker'in navigator))return;

  function workerVersion(worker){
    return new Promise(resolve=>{
      if(!worker){resolve('');return}
      const channel=new MessageChannel();
      let done=false;
      const finish=value=>{if(done)return;done=true;clearTimeout(timer);channel.port1.close();resolve(String(value||''))};
      const timer=setTimeout(()=>finish(''),1200);
      channel.port1.onmessage=event=>finish(event.data?.version);
      try{worker.postMessage({type:'GET_VERSION'},[channel.port2])}catch{finish('')}
    });
  }

  async function handleWaiting(reg){
    const worker=reg?.waiting;
    if(!worker)return false;
    const waitingVersion=await workerVersion(worker);
    if(reg.waiting!==worker)return false;
    if(currentVersion&&waitingVersion===currentVersion){
      if(notice)notice.hidden=true;
      worker.postMessage({type:'SKIP_WAITING',reason:'already-loaded'});
      return false;
    }
    if(notice)notice.hidden=false;
    return true;
  }

  async function checkForUpdate(){
    if(!navigator.onLine)return false;
    try{
      const reg=await navigator.serviceWorker.getRegistration();
      if(!reg)return false;
      await reg.update();
      return handleWaiting(reg);
    }catch(error){
      console.warn('Sprawdzenie aktualizacji PWA:',error);
      return false;
    }
  }

  button?.addEventListener('click',()=>{checkForUpdate()});
  window.setInterval(checkForUpdate,CHECK_INTERVAL_MS);
  window.__trasyCheckForUpdate=checkForUpdate;
})();
