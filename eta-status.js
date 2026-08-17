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

  let etaSeconds=null;
  let etaMeasuredAt=0;

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
    return body.querySelector('tr.gpsNextStop');
  }

  function planSeconds(row){
    const text=String(
      row?.children[1]?.firstChild?.textContent||
      row?.children[1]?.textContent||
      ''
    ).trim();

    const m=text.match(/^(\d{1,2}):(\d{2})/);
    if(!m)return null;

    const now=new Date();
    const plan=new Date(now);

    plan.setHours(+m[1],+m[2],0,0);

    return(
      plan.getTime()-
      now.getTime()
    )/1000;
  }

  function liveEta(){
    if(
      etaSeconds===null||
      !etaMeasuredAt
    )return null;

    const elapsed=
      (Date.now()-etaMeasuredAt)/1000;

    return Math.max(
      0,
      etaSeconds-elapsed
    );
  }

  function fullMinutesLabel(diff){
    if(Math.abs(diff)<=TOLERANCE_SECONDS){
      return '0 min';
    }

    const full=Math.max(
      1,
      Math.floor(Math.abs(diff)/60)
    );

    /*
     * + = zapas / wcześniej
     * − = strata / później
     */
    return diff<0
      ?`+${full} min`
      :`−${full} min`;
  }

  async function refreshEta(force=false){
    const row=activeRow();

    if(
      requesting||
      !row||
      !pos
    )return;

    const c=coord(row.dataset.coordinate);
    if(!c)return;

    const changed=lastTarget!==row;

    if(
      !force&&
      !changed&&
      Date.now()-lastRouteAt<ROUTE_REFRESH_MS
    ){
      return;
    }

    /*
     * Jeśli pełna nawigacja jest otwarta,
     * ETA dostajemy z nav-map.js.
     */
    const nav=document.getElementById('routeMapNav');

    if(nav&&!nav.hidden){
      return;
    }

    requesting=true;
    lastRouteAt=Date.now();
    lastTarget=row;

    try{
      /*
       * Ten adres jest przechwytywany przez
       * google-routes-provider.js.
       *
       * GOOGLE -> Google Routes
       * OSRM -> OSRM
       */
      const url=
        `https://router.project-osrm.org/route/v1/driving/`+
        `${pos.lng},${pos.lat};${c[1]},${c[0]}`+
        `?overview=false&steps=false`;

      const res=await fetch(url,{cache:'no-store'});
      const data=await res.json();

      const value=data?.routes?.[0]?.duration;

      if(Number.isFinite(value)){
        etaSeconds=value;
        etaMeasuredAt=Date.now();
      }

    }catch(err){
      console.warn('ETA:',err);

    }finally{
      requesting=false;
    }
  }

  function render(){
    if(view.hidden)return;

    document.querySelectorAll(
      '#scheduleBody .etaPunctuality'
    ).forEach(x=>x.remove());

    const row=activeRow();
    if(!row)return;

    const eta=liveEta();
    if(eta===null)return;

    const info=document.createElement('div');
    info.className='etaPunctuality';

    const etaMin=Math.max(
      0,
      Math.ceil(eta/60)
    );

    const plan=planSeconds(row);

    /*
     * Powrót może nie mieć godzin
     * na przystankach pośrednich.
     */
    if(plan===null){
      info.classList.add('neutral');
      info.textContent=`dojazd za ${etaMin} min`;

      row.querySelector('td:first-child')
        ?.appendChild(info);

      return;
    }

    const diff=eta-plan;

    let kind='onTime';

    if(diff>TOLERANCE_SECONDS){
      kind='late';
    }else if(diff<-TOLERANCE_SECONDS){
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
      `dojazd za ${etaMin} min • ${fullMinutesLabel(diff)}`;

    row.querySelector('td:first-child')
      ?.appendChild(info);

    body.dataset.etaKind=kind;
    body.dataset.etaDiffSeconds=String(diff);
    body.dataset.etaSeconds=String(eta);

    body.dispatchEvent(
      new CustomEvent('eta-status-change',{
        bubbles:true,
        detail:{
          kind,
          diffSeconds:diff,
          etaSeconds:eta
        }
      })
    );
  }

  /*
   * ETA z pełnej nawigacji.
   */
  body.addEventListener(
    'nav-eta-update',
    e=>{
      const seconds=Number(
        e.detail?.etaSeconds
      );

      if(Number.isFinite(seconds)){
        etaSeconds=seconds;
        etaMeasuredAt=Date.now();
        render();
      }
    }
  );

  body.addEventListener(
    'gps-next-stop-change',
    ()=>{
      lastTarget=null;
      etaSeconds=null;
      etaMeasuredAt=0;

      refreshEta(true).then(render);
    }
  );

  function start(){
    if(watch!==null)return;

    watch=navigator.geolocation.watchPosition(
      p=>{
        pos={
          lat:p.coords.latitude,
          lng:p.coords.longitude,
          accuracy:p.coords.accuracy||999
        };

        if(pos.accuracy<=MAX_GPS_ACCURACY){
          refreshEta().then(render);
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
   * Odliczanie lokalne co sekundę.
   * Nie jest to nowe zapytanie Google.
   */
  setInterval(()=>{
    if(
      !view.hidden&&
      pos?.accuracy<=MAX_GPS_ACCURACY
    ){
      refreshEta();
      render();
    }
  },1000);

  document.addEventListener(
    'visibilitychange',
    ()=>{
      if(document.visibilityState==='visible'){
        start();
      }
    }
  );
})();
