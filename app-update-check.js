(()=>{
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
