(()=>{
  const body=document.getElementById('scheduleBody');
  if(!body)return;

  const PREVIEW_FLAG='returnNavPreviewTarget';
  let writing=false;
  let queued=false;
  let observer=null;

  function routeRows(){
    return [...body.querySelectorAll('tr')].filter(row=>String(row.dataset.coordinate||'').trim());
  }

  function returnOriginLocked(){
    return body.dataset.direction==='return'&&
      body.dataset.emptyRun!=='1'&&
      body.dataset.returnOriginActive==='1';
  }

  function previewIndex(){
    const rows=routeRows();
    return rows.length>1?1:null;
  }

  function keepPreviewTarget(){
    if(!returnOriginLocked()){
      delete body.dataset[PREVIEW_FLAG];
      return;
    }

    const index=previewIndex();
    if(index===null)return;

    // Punkt 0 to miejsce STARTU powrotu, a nie cel nawigacji.
    // Indeks 1 jest technicznym celem podglądu przebiegu trasy.
    // Nie dodajemy klas gpsNextStop/isActiveStop podczas oczekiwania.
    body.dataset.gpsNextStop=String(index);
    delete body.dataset.gpsNextStopKey;
    body.dataset[PREVIEW_FLAG]='1';
  }

  function guidanceText(){
    const start=String(body.dataset.returnStart||'').trim();
    return start?`Oczekiwanie na start ${start}`:'Oczekiwanie na start';
  }

  function holdGuidance(){
    if(writing||!returnOriginLocked())return;
    const panel=document.getElementById('routeMapNav');
    if(!panel||panel.hidden)return;

    keepPreviewTarget();

    const maneuver=document.getElementById('routeManeuver');
    const distance=document.getElementById('routeManeuverDistance');
    const text=guidanceText();
    const changed=Boolean(maneuver&&maneuver.textContent!==text);

    writing=true;
    try{
      if(changed)maneuver.textContent=text;
      if(distance&&distance.textContent)distance.textContent='';
      if(changed)try{window.speechSynthesis?.cancel?.()}catch{}
    }finally{
      writing=false;
    }
  }

  function scheduleHold(){
    if(queued)return;
    queued=true;
    queueMicrotask(()=>{
      queued=false;
      holdGuidance();
    });
  }

  function installGuidanceObserver(){
    const maneuver=document.getElementById('routeManeuver');
    const distance=document.getElementById('routeManeuverDistance');
    if(!maneuver||!distance)return;
    if(observer)return;

    observer=new MutationObserver(()=>{
      if(!writing&&returnOriginLocked())scheduleHold();
    });
    observer.observe(maneuver,{subtree:true,childList:true,characterData:true});
    observer.observe(distance,{subtree:true,childList:true,characterData:true});
  }

  function sync(){
    keepPreviewTarget();
    installGuidanceObserver();
    holdGuidance();
  }

  // Capture ustawia techniczny pierwszy cel jeszcze przed obsługą kliknięcia,
  // więc geometria jest liczona od miejsca startu do pierwszego przystanku.
  document.addEventListener('click',sync,true);
  document.addEventListener('pointerdown',sync,true);

  ['return-origin-change','route-direction-change','route-mode-change','schedule-rendered']
    .forEach(type=>body.addEventListener(type,()=>setTimeout(sync,0)));

  document.addEventListener('trasy:route-map-ready',()=>setTimeout(sync,0));

  // Ten skrypt jest ładowany po nav-map.js. Jego subskrypcja wykonuje się więc
  // po aktualizacji manewru przez nawigację i utrwala stan oczekiwania w tej samej klatce.
  try{
    window.__trasyGps?.subscribe?.(()=>{
      if(returnOriginLocked())scheduleHold();
    },()=>{});
  }catch{}

  // Tracker podczas oczekiwania świadomie czyści aktywny cel przy GPS.
  // Odtwarzamy jedynie techniczny indeks podglądu; obserwator usuwa migotanie tekstu.
  setInterval(()=>{
    if(returnOriginLocked()){
      keepPreviewTarget();
      scheduleHold();
    }
  },500);

  sync();
})();