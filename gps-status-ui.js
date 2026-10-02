(()=>{
  const hub=window.__trasyGps;
  const notice=document.getElementById('gpsQualityNotice');
  const message=document.getElementById('gpsQualityMessage');
  const retry=document.getElementById('gpsQualityRetry');
  if(!hub||!notice||!message||!retry)return;
  const messages={
    waiting:'Aktualizuję pozycję GPS…',
    stale:'Brak świeżej pozycji GPS. Czekam na sygnał.',
    poor:'Słaby sygnał GPS. Czekam na dokładniejszą pozycję.',
    denied:'Brak dostępu do lokalizacji. Zezwól na lokalizację w ustawieniach witryny lub aplikacji i telefonu, a następnie spróbuj ponownie.',
    unavailable:'Nie można ustalić pozycji GPS. Sprawdź, czy lokalizacja jest włączona.'
  };
  let status=hub.getStatus(),pending=false;
  const translate=text=>window.TrasyI18n?.translateText(text)??text;
  function render(){
    const active=Boolean(document.getElementById('scheduleView')?.hidden===false||document.getElementById('routeMapNav')?.hidden===false);
    const state=status.state;
    notice.hidden=document.visibilityState==='hidden'||state==='ready'||(!active&&state!=='denied'&&state!=='unavailable');
    const text=messages[state]||messages.waiting;
    const translated=translate(text);
    if(message.textContent!==translated)message.textContent=translated;
    retry.hidden=state==='waiting'||state==='poor';
    retry.disabled=pending;
    notice.dataset.state=state;
  }
  retry.addEventListener('click',async()=>{
    if(pending)return;
    pending=true;render();
    try{await hub.refresh()}catch{}finally{pending=false;status=hub.getStatus();render()}
  });
  window.addEventListener('trasy:gps-status',event=>{status=event.detail;render()});
  document.addEventListener('visibilitychange',render);
  document.addEventListener('trasy:languagechange',render);
  const observer=new MutationObserver(mutations=>{
    if(mutations.some(item=>item.target.id==='scheduleView'||item.target.id==='routeMapNav'))render();
  });
  observer.observe(document.body,{subtree:true,attributes:true,attributeFilter:['hidden']});
  render();
})();
