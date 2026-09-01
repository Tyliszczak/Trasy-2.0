(()=>{
  const body=document.getElementById('scheduleBody');
  if(!body)return;

  const PREVIEW_FLAG='returnNavPreviewTarget';

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

    // Punkt 0 jest miejscem STARTU powrotu, a nie celem nawigacji.
    // Ustawiamy indeks 1 tylko jako techniczny cel podglądu mapy.
    // Nie dodajemy klas gpsNextStop/isActiveStop, więc harmonogram nadal
    // pozostaje w stanie „oczekiwanie na start”.
    body.dataset.gpsNextStop=String(index);
    delete body.dataset.gpsNextStopKey;
    body.dataset[PREVIEW_FLAG]='1';
  }

  function holdGuidance(){
    if(!returnOriginLocked())return;
    const panel=document.getElementById('routeMapNav');
    if(!panel||panel.hidden)return;

    keepPreviewTarget();

    const maneuver=document.getElementById('routeManeuver');
    const distance=document.getElementById('routeManeuverDistance');
    const start=String(body.dataset.returnStart||'').trim();
    const text=start?`Oczekiwanie na start ${start}`:'Oczekiwanie na start';

    if(maneuver&&maneuver.textContent!==text){
      maneuver.textContent=text;
      try{window.speechSynthesis?.cancel?.()}catch{}
    }
    if(distance&&distance.textContent)distance.textContent='';
  }

  function sync(){
    keepPreviewTarget();
    holdGuidance();
  }

  // Capture powoduje ustawienie prawidłowego celu jeszcze przed obsługą
  // kliknięcia przez nav-map.js i wyliczeniem geometrii trasy.
  document.addEventListener('click',sync,true);
  document.addEventListener('pointerdown',sync,true);

  ['return-origin-change','route-direction-change','route-mode-change','schedule-rendered']
    .forEach(type=>body.addEventListener(type,()=>setTimeout(sync,0)));

  // Tracker podczas oczekiwania świadomie czyści aktywny cel przy każdym GPS.
  // Odtwarzamy wyłącznie techniczny indeks podglądu; bez klas wizualnych.
  setInterval(sync,120);
  sync();
})();