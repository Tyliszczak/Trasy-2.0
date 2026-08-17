(()=>{
  const body=document.getElementById('scheduleBody');
  const view=document.getElementById('scheduleView');

  if(!body||!view||!navigator.geolocation)return;

  const TOLERANCE_SECONDS=30;
  const ROUTE_REFRESH_MS=180000;
  const MAX_GPS_ACCURACY=120;

  let pos=null;
  let watch=null;

  let lastRouteAt=0;
  let lastTarget=null;

  let etaAt=0;
  let etaSeconds=null;

  let requesting=false;


  const style=document.createElement('style');

  style.textContent=`
    #scheduleBody .punctualityLamp{
      display:none!important
    }

    #scheduleBody .etaPunctuality{
      display:block;
      margin-top:4px;
      font-size:12px;
      line-height:1.15;
      font-weight:1000;
      white-space:nowrap
    }

    #scheduleBody .etaPunctuality.onTime{
      color:#34c759
    }

    #scheduleBody .etaPunctuality.early{
      color:#d6a900
    }

    #scheduleBody .etaPunctuality.late{
      color:#ff3b30
    }

    #scheduleBody .etaPunctuality.neutral{
      color:#aaa
    }
  `;

  document.head.append(style);


  function coord(v){
    const m=String(v||'').match(
      /(-?\d+(?:\.\d+)?)\s*[,; ]\s*(-?\d+(?:\.\d+)?)/
    );

    return m?[+m[1],+m[2]]:null;
  }


  function activeRow(){
    return(
      body.querySelector(
        'tr.gpsNextStop'
      )
      ||
      null
    );
  }


  function planSeconds(row){
    const text=String(
      row?.children[1]?.firstChild?.textContent||
      row?.children[1]?.textContent||
      ''
    ).trim();

    const m=text.match(
      /^(\d{1,2}):(\d{2})/
    );

    if(!m)return null;

    const n=new Date();
    const d=new Date(n);

    d.setHours(
      +m[1],
      +m[2],
      0,
      0
    );

    return(
      d.getTime()-
      n.getTime()
    )/1000;
  }


  function liveEtaSeconds(){
    if(
      etaSeconds===null ||
      !etaAt
    )return null;

    return Math.max(
      0,
      etaSeconds-
      (
        Date.now()-
        etaAt
      )/1000
    );
  }


  function formatDelta(diff){
    if(
      Math.abs(diff)<=
      TOLERANCE_SECONDS
    ){
      return '0 min';
    }

    const full=
      Math.floor(
        Math.abs(diff)/60
      );

    /*
     * + = zapas / wcześniej
     * - = strata / później
     */
    return diff<0
      ?`+${full} min`
      :`−${full} min`;
  }


  function formatArrivalMinutes(seconds){
    return Math.max(
      0,
      Math.ceil(seconds/60)
    );
  }


  async function refreshEta(force=false){
    const row=activeRow();

    if(
      requesting ||
      !row ||
      !pos
    )return;

    const c=
      coord(
        row.dataset.coordinate
      );

    if(!c)return;

    const changed=
      lastTarget!==row;

    if(
      !force &&
      !changed &&
      Date.now()-lastRouteAt<
      ROUTE_REFRESH_MS
    ){
      return;
    }

    /*
     * Jeżeli otwarta jest pełna nawigacja,
     * nie wysyłamy drugiego równoległego
     * zapytania. nav-map.js poda nam ETA.
     */
    const nav=
      document.getElementById(
        'routeMapNav'
      );

    if(
      nav &&
      !nav.hidden
    ){
      return;
    }

    requesting=true;

    lastRouteAt=Date.now();
    lastTarget=row;

    try{
      const u=
        `https://router.project-osrm.org/route/v1/driving/${pos.lng},${pos.lat};${c[1]},${c[0]}?overview=false&steps=false`;

      const r=
        await fetch(
          u,
          {cache:'no-store'}
        );

      const j=
        await r.json();

      const value=
        j?.routes?.[0]?.duration;

      if(
        Number.isFinite(value)
      ){
        etaSeconds=value;
        etaAt=Date.now();
      }

    }catch(e){
      console.warn(
        'Nie udało się odświeżyć ETA:',
        e
      );

    }finally{
      requesting=false;
    }
  }


  function render(){
    if(view.hidden)return;

    document
      .querySelectorAll(
        '#scheduleBody .etaPunctuality'
      )
      .forEach(x=>x.remove());

    const row=activeRow();

    if(!row)return;

    const eta=
      liveEtaSeconds();

    if(eta===null)return;

    const plan=
      planSeconds(row);

    const info=
      document.createElement('div');

    info.className=
      'etaPunctuality';

    const etaMin=
      formatArrivalMinutes(
        eta
      );

    /*
     * POWRÓT:
     * pośrednie przystanki nie mają
     * godzin, więc pokazujemy samo ETA.
     */
    if(plan===null){
      info.classList.add(
        'neutral'
      );

      info.textContent=
        `dojazd za ${etaMin} min`;

      row
        .querySelector('td:first-child')
        ?.appendChild(info);

      return;
    }

    const diff=
      eta-plan;

    let kind=
      'onTime';

    if(
      diff>
      TOLERANCE_SECONDS
    ){
      kind='late';

    }else if(
      diff<
      -TOLERANCE_SECONDS
    ){
      kind='early';
    }

    const color=
      kind==='late'
        ?'#ff3b30'
        :kind==='early'
          ?'#ffd60a'
          :'#34c759';

    row.style.setProperty(
      '--gps-status-color',
      color
    );

    info.classList.add(kind);

    info.textContent=
      `dojazd za ${etaMin} min • ${formatDelta(diff)}`;

    row
      .querySelector('td:first-child')
      ?.appendChild(info);

    body.dataset.etaKind=kind;
    body.dataset.etaDiffSeconds=
      String(diff);
    body.dataset.etaSeconds=
      String(eta);

    body.dispatchEvent(
      new CustomEvent(
        'eta-status-change',
        {
          bubbles:true,
          detail:{
            kind,
            diffSeconds:diff,
            etaSeconds:eta
          }
        }
      )
    );
  }


  /*
   * ETA z pełnej nawigacji.
   * Dzięki temu nie płacimy za
   * drugie równoległe zapytanie.
   */
  body.addEventListener(
    'nav-eta-update',
    e=>{
      const seconds=
        Number(
          e.detail?.etaSeconds
        );

      if(
        Number.isFinite(seconds)
      ){
        etaSeconds=seconds;
        etaAt=Date.now();

        render();
      }
    }
  );


  body.addEventListener(
    'gps-next-stop-change',
    ()=>{
      lastTarget=null;
      etaSeconds=null;
      etaAt=0;

      refreshEta(true)
        .then(render);
    }
  );


  function start(){
    if(watch!==null)return;

    watch=
      navigator.geolocation
        .watchPosition(
          p=>{
            pos={
              lat:p.coords.latitude,
              lng:p.coords.longitude,
              accuracy:
                p.coords.accuracy||999
            };

            if(
              pos.accuracy<=
              MAX_GPS_ACCURACY
            ){
              refreshEta()
                .then(render);
            }
          },
          ()=>{},
          {
            enableHighAccuracy:true,
            maximumAge:1000,
            timeout:15000
          }
        );
  }


  start();


  /*
   * Co sekundę zmniejszamy ETA lokalnie.
   * Google nie jest odpytywany co sekundę.
   */
  setInterval(
    ()=>{
      if(
        !view.hidden &&
        pos?.accuracy<=
        MAX_GPS_ACCURACY
      ){
        refreshEta();
        render();
      }
    },
    1000
  );


  document.addEventListener(
    'visibilitychange',
    ()=>{
      if(
        document.visibilityState===
        'visible'
      ){
        start();
      }
    }
  );

})();
