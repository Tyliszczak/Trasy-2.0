(()=>{
  const button=document.getElementById('wakeLockButton');
  const label=document.getElementById('wakeLockLabel');
  if(!button||!label)return;

  const bulb=button.querySelector('.wakeBulb'),screenLabel=document.createElement('span'),topRow=document.createElement('span');
  screenLabel.className='wakeScreenLabel';screenLabel.textContent='EKRAN';topRow.className='wakeTopRow';if(bulb)topRow.append(bulb);label.textContent='OFF';topRow.append(label);button.replaceChildren(topRow,screenLabel);
  const preferenceKey='trasy2.keepScreenOn';
  let wakeLock=null,manualWanted=null,navigationWanted=false,retryTimer=null;
  let pending=null,revision=0,retryCount=0;
  try{const saved=localStorage.getItem(preferenceKey);if(saved==='on'||saved==='off')manualWanted=saved==='on'}catch{}
  const notice=document.createElement('div');
  notice.id='wakeLockNotice';notice.hidden=true;notice.setAttribute('role','status');
  notice.setAttribute('aria-live','polite');document.body.append(notice);

  let noticeTimer=null;
  function showNotice(message){
    clearTimeout(noticeTimer);notice.textContent=message;notice.hidden=false;
    noticeTimer=setTimeout(()=>{notice.hidden=true},10000);
  }
  function setWakeState(active,state=active?'active':'off'){
    button.classList.toggle('wakeActive',active);label.textContent=state==='pending'?'…':active?'ON':'OFF';
    button.dataset.wakeState=state;button.setAttribute('aria-pressed',String(active));
    button.setAttribute('aria-busy',String(state==='pending'));
  }
  // A driver's explicit choice takes priority over automatic navigation mode.
  function wakeWanted(){return manualWanted??navigationWanted}
  function isActive(){return !!wakeLock&&!wakeLock.released}
  function clearRetry(){if(retryTimer){clearTimeout(retryTimer);retryTimer=null}}
  function scheduleRetry(delay=1500){clearRetry();if(!wakeWanted()||document.visibilityState!=='visible'||retryCount>=3)return;retryCount++;retryTimer=setTimeout(()=>{retryTimer=null;requestWakeLock()},delay)}
  async function releaseWakeLock(){
    revision++;clearRetry();const previous=wakeLock;wakeLock=null;setWakeState(false);
    if(previous){try{await previous.release()}catch{}}
  }
  function requestWakeLock(){
    if(!wakeWanted()||isActive()||document.visibilityState!=='visible')return Promise.resolve();
    if(pending)return pending;
    clearRetry();wakeLock=null;
    if(!navigator.wakeLock?.request){
      setWakeState(false,'unsupported');
      showNotice('Ta przeglądarka nie obsługuje blokady wygaszania. Otwórz aplikację w aktualnej przeglądarce Chrome lub Safari.');
      return Promise.resolve();
    }
    const requestRevision=revision;
    setWakeState(false,'pending');
    pending=(async()=>{
      try{
        const sentinel=await navigator.wakeLock.request('screen');
        // The user may turn this off or hide the app while permission is pending.
        if(requestRevision!==revision||!wakeWanted()||document.visibilityState!=='visible'){
          try{await sentinel.release()}catch{}return;
        }
        if(sentinel.released){setWakeState(false);scheduleRetry();return}
        wakeLock=sentinel;retryCount=0;notice.hidden=true;setWakeState(true);
        sentinel.addEventListener('release',()=>{
          if(wakeLock!==sentinel)return;
          wakeLock=null;setWakeState(false);
          if(wakeWanted()&&document.visibilityState==='visible'){
            showNotice('Telefon zwolnił blokadę wygaszania. Próbuję włączyć ją ponownie.');scheduleRetry();
          }
        },{once:true});
      }catch{
        if(requestRevision!==revision)return;
        setWakeState(false,'error');
        showNotice('Nie udało się zablokować wygaszania. Sprawdź oszczędzanie baterii i ustawienia przeglądarki.');
        scheduleRetry(3000*2**retryCount);
      }
    })().finally(()=>{
      pending=null;
      if(requestRevision!==revision&&wakeWanted()&&document.visibilityState==='visible')scheduleRetry(0);
    });
    return pending;
  }
  async function setNavigationWake(active){
    navigationWanted=!!active;
    if(wakeWanted())await requestWakeLock();else await releaseWakeLock();
  }
  button.addEventListener('click',async e=>{
    e.preventDefault();e.stopImmediatePropagation();manualWanted=!wakeWanted();retryCount=0;
    try{localStorage.setItem(preferenceKey,manualWanted?'on':'off')}catch{}
    notice.hidden=true;
    if(wakeWanted())await requestWakeLock();else await releaseWakeLock();
  },true);
  function resumeWake(){retryCount=0;if(wakeWanted())requestWakeLock()}
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')resumeWake();else releaseWakeLock()});
  window.addEventListener('pagehide',()=>releaseWakeLock());
  window.addEventListener('pageshow',resumeWake);
  window.addEventListener('focus',resumeWake);
  window.__trasyWakeLock={setNavigation:setNavigationWake,isActive};setWakeState(false);resumeWake();
})();
