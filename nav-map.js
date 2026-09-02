(()=>{
  const body=document.getElementById('scheduleBody');
  if(!body)return;
  const tr=(key,vars)=>window.TrasyI18n?.t(key,vars)??key;

  let map=null;
  let positionMarker=null;
  let positionEl=null;
  let watchId=null;
  let positionAnimation=0;
  let lastMarkerUpdateAt=0;

  let steps=[];
  let stepProgress=[];
  let routeCoords=[];

  let rerouteTimer=0;
  let refreshTimer=0;

  let lastSpoken='';

  let currentStops=[];
  let lastGpsPoint=null;
  let lastGpsAt=0;
  let currentHeading=0;
  let headingReady=false;
  let currentSpeedMps=0;
  let routingHeadingAt=0;

  let stopMarkers=[];
  let progressIndex=0;

  let lastRouteBuildAt=0;
  let lastRerouteAt=0;
  let legStartAt=0;
  let legDurations=[];
  let routeBuildInFlight=false;
  let routeRequestGeneration=0;
  let routeAbortController=null;
  let routeUsesStartDirection=false;
  let lastDirectionAttemptAt=0;
  let offRouteFixes=0;
  let hiddenAt=0;
  let resumeInstant=false;
  let resumePromise=null;
  let navigationStartPromise=null;


  const PITCH=58;
  const ZOOM=17.2;

  const TOLERANCE_SECONDS=30;
  const TRAFFIC_REFRESH_MS=180000;
  const MIN_REROUTE_DISTANCE=85;
  const REROUTE_CONFIRM_FIXES=3;
  const REROUTE_COOLDOWN_MS=30000;
  const MAX_ROUTE_GPS_AGE_MS=5000;
  const ROUTE_PROGRESS_LOOKAHEAD_M=1200;
  const ROUTE_PROGRESS_BACKTRACK_M=250;


  /* =========================================================
     PANEL NAWIGACJI
     ========================================================= */

  const panel=document.createElement('section');

  panel.id='routeMapNav';
  panel.hidden=true;

  panel.innerHTML=`
    <div
      id="routeNavRoot"
      style="
        position:fixed;
        inset:0;
        z-index:40000;
        background:#111;
        display:flex;
        flex-direction:column
      "
    >

      <div style="
        display:flex;
        align-items:center;
        gap:8px;
        padding:8px 10px;
        background:#181818;
        border-bottom:2px solid #ccff33
      ">

        <button
          id="routeMapClose"
          type="button"
          style="width:auto;min-width:84px"
        >
          ZAKOŃCZ
        </button>

        <strong style="
          flex:1;
          text-align:center;
          color:#ccff33
        ">
          NAWIGACJA
        </strong>

        <button
          id="routeMapCenter"
          type="button"
          style="width:auto;min-width:84px"
        >
          NAWIGUJ
        </button>

      </div>

      <div style="
        background:#222;
        padding:10px 12px;
        border-bottom:1px solid #444
      ">

        <div
          id="routeManeuver"
          style="
            font-size:22px;
            font-weight:900;
            line-height:1.15
          "
        >
          Pobieranie trasy…
        </div>

        <div style="
          display:flex;
          justify-content:space-between;
          gap:12px;
          margin-top:5px
        ">

          <span
            id="routeManeuverDistance"
            style="
              font-size:19px;
              font-weight:900;
              color:#ccff33
            "
          ></span>

          <span
            id="routeNextStop"
            style="
              font-size:14px;
              color:#ddd;
              text-align:right
            "
          ></span>

        </div>

      </div>

      <div
        id="routeMapCanvas"
        style="
          flex:1;
          min-height:0;
          overflow:hidden
        "
      ></div>

      <div style="
        background:#181818;
        border-top:1px solid #333
      " class="routeStatusBar">

        <div
          id="routeMapStatus"
          style="
            padding:6px 12px 2px;
            color:#fff;
            font-weight:800;
            text-align:center
          "
        >
          Pobieranie pozycji…
        </div>

        <div
          id="routeGpsStatus"
          style="
            padding:1px 12px 6px;
            color:#aaa;
            font-size:11px;
            font-weight:700;
            text-align:center
          "
        ></div>

        <div id="routeGpsActions" hidden>
          <button id="routeGpsRetry" type="button">SPRÓBUJ PONOWNIE</button>
        </div>

      </div>
    </div>
  `;

  document.body.append(panel);

  const root=panel.querySelector('#routeNavRoot');
  const status=panel.querySelector('#routeMapStatus');
  const gpsStatus=panel.querySelector('#routeGpsStatus');
  const gpsActions=panel.querySelector('#routeGpsActions');
  const gpsRetry=panel.querySelector('#routeGpsRetry');

  const maneuverEl=
    panel.querySelector('#routeManeuver');

  const maneuverDistance=
    panel.querySelector('#routeManeuverDistance');

  function setNavigationLoading(message='Pobieranie pozycji telefonu…'){
    status.dataset.state='loading';
    status.textContent=message;
    gpsStatus.textContent='';
    gpsActions.hidden=true;
    gpsRetry.disabled=false;
  }

  function navigationErrorMessage(error){
    const code=Number(error?.code);
    const message=String(error?.message||'');
    if(code===1)return'Brak dostępu do lokalizacji. Włącz lokalizację dla tej aplikacji.';
    if(code===2)return'Nie można ustalić pozycji GPS. Sprawdź, czy lokalizacja jest włączona.';
    if(code===3)return'Oczekiwanie na pozycję GPS trwało zbyt długo.';
    if(message.includes('Runtime mapy'))return'Mapa nie jest jeszcze gotowa. Spróbuj ponownie.';
    if(/HTTP|trasy|Renderer/i.test(message))return'Nie udało się pobrać przebiegu trasy.';
    return'Nie udało się uruchomić nawigacji.';
  }

  function navigationErrorHint(error){
    const code=Number(error?.code);
    return code>=1&&code<=3
      ?'Sprawdź ustawienia lokalizacji i spróbuj ponownie.'
      :'Sprawdź połączenie z internetem i spróbuj ponownie.';
  }

  function showNavigationError(error){
    status.dataset.state='error';
    status.textContent=navigationErrorMessage(error);
    gpsStatus.textContent=navigationErrorHint(error);
    maneuverEl.textContent='Nawigacja niedostępna';
    maneuverDistance.textContent='';
    gpsActions.hidden=false;
    gpsRetry.disabled=false;
  }




  /* =========================================================
     PODSTAWOWE
     ========================================================= */

  function parseCoord(s){
    const m=String(s||'').match(
      /(-?\d+(?:\.\d+)?)\s*[,; ]\s*(-?\d+(?:\.\d+)?)/
    );

    return m?[+m[1],+m[2]]:null;
  }

  function hav(a,b){
    const R=6371000,p=Math.PI/180;

    const dLat=(b[0]-a[0])*p;
    const dLon=(b[1]-a[1])*p;

    const x=
      Math.sin(dLat/2)**2+
      Math.cos(a[0]*p)*
      Math.cos(b[0]*p)*
      Math.sin(dLon/2)**2;

    return 2*R*Math.asin(Math.sqrt(x));
  }

  function bearing(a,b){
    const p=Math.PI/180;

    const lat1=a[0]*p;
    const lat2=b[0]*p;
    const dLon=(b[1]-b[1]+b[1]-a[1])*p;

    const y=Math.sin(dLon)*Math.cos(lat2);

    const x=
      Math.cos(lat1)*Math.sin(lat2)-
      Math.sin(lat1)*Math.cos(lat2)*Math.cos(dLon);

    return(
      Math.atan2(y,x)*180/Math.PI+
      360
    )%360;
  }

  function smoothHeading(next){
    if(!Number.isFinite(next)){
      return currentHeading;
    }

    if(!headingReady){
      currentHeading=(next+360)%360;
      headingReady=true;
      return currentHeading;
    }

    const d=
      ((next-currentHeading+540)%360)-180;

    currentHeading=
      (currentHeading+d*.68+360)%360;

    return currentHeading;
  }

  function headingFromPosition(p,ll){
    const rawHeading=p.coords.heading;
    let h=rawHeading===null||rawHeading===undefined?NaN:Number(rawHeading);

    if(!Number.isFinite(h)||h<0){
      if(
        lastGpsPoint&&
        hav(lastGpsPoint,ll)>=3
      ){
        h=bearing(lastGpsPoint,ll);
      }else{
        h=currentHeading;
      }
    }

    if(
      !lastGpsPoint||
      hav(lastGpsPoint,ll)>=2
    ){
      lastGpsPoint=ll;
    }

    return smoothHeading(h);
  }

  function updateNavigationMotion(position,ll){
    const previous=lastGpsPoint?.slice?.()||null;
    const timestamp=Number(position?.timestamp)||Date.now();
    const moved=previous?hav(previous,ll):0;
    let speed=Number(position?.coords?.speed);
    if(!Number.isFinite(speed)||speed<0){
      speed=previous&&lastGpsAt&&timestamp>lastGpsAt
        ?moved/((timestamp-lastGpsAt)/1000)
        :0;
    }
    currentSpeedMps=Math.max(0,speed);
    const rawSensorHeading=position?.coords?.heading;
    const sensorHeading=rawSensorHeading===null||rawSensorHeading===undefined?NaN:Number(rawSensorHeading);
    const sensorReliable=Number.isFinite(sensorHeading)&&sensorHeading>=0;
    const movementReliable=Boolean(previous&&moved>=4&&lastGpsAt&&timestamp>lastGpsAt);
    const nextHeading=headingFromPosition(position,ll);
    lastGpsAt=timestamp;
    if(currentSpeedMps>=1.5&&(sensorReliable||movementReliable)){
      const sampleAge=Date.now()-timestamp;
      routingHeadingAt=sampleAge>=0&&sampleAge<60000?timestamp:Date.now();
    }
    return nextHeading;
  }

  function startDirectionQuery(stops){
    return globalThis.__trasyGeo?.osrmStartDirectionQuery?.({
      heading:currentHeading,
      speedMps:currentSpeedMps,
      headingAgeMs:routingHeadingAt?Date.now()-routingHeadingAt:Infinity,
      waypointCount:stops.length+1
    })||'';
  }

  function headingFromRoute(origin){
    const point=routeCoords.find(candidate=>hav(origin,candidate)>=8);
    return point?bearing(origin,point):currentHeading;
  }

  function headingFromCurrentRoute(origin){
    for(let i=Math.max(0,progressIndex);i<routeCoords.length;i+=1){
      if(hav(origin,routeCoords[i])>=8)return bearing(origin,routeCoords[i]);
    }
    return headingFromRoute(origin);
  }

  function cachedPosition(maxAgeMs=15000){
    const position=window.__trasyGps?.current?.();
    const age=Date.now()-Number(position?.timestamp||0);
    return position&&age>=0&&age<=maxAgeMs?position:null;
  }

  function posOnce(){
    const cached=cachedPosition(MAX_ROUTE_GPS_AGE_MS);
    if(cached){
      window.__trasyGps?.refresh?.({restartWatch:false}).catch(()=>{});
      return Promise.resolve(cached);
    }

    if(window.__trasyGps?.refresh){
      return window.__trasyGps.refresh({restartWatch:false});
    }

    return new Promise(
      (resolve,reject)=>
        navigator.geolocation.getCurrentPosition(
          resolve,
          reject,
          {
            enableHighAccuracy:true,
            timeout:12000,
            maximumAge:3000
          }
        )
    );
  }

  function fmtDistance(m){
    return m<950
      ?`${Math.max(10,Math.round(m/10)*10)} m`
      :`${(m/1000).toFixed(m<10000?1:0)} km`;
  }

  function fmtClock(date){
    return(
      String(date.getHours()).padStart(2,'0')+
      ':'+
      String(date.getMinutes()).padStart(2,'0')
    );
  }

  function parseTodayTime(t){
    const m=String(t||'')
      .trim()
      .match(/^(\d{1,2}):(\d{2})/);

    if(!m)return null;

    const d=new Date();

    d.setHours(+m[1],+m[2],0,0);

    return d;
  }

  function followCamera(ll,heading,instant=false){
    if(!map)return;

    const h=
      map.getContainer().clientHeight||600;

    const target={
      center:[ll[1],ll[0]],
      bearing:heading,
      offset:[0,Math.round(h*.18)],
      instant
    };

    if(window.__routeCameraController){
      window.__routeCameraController.follow(target);
      return;
    }

    map.easeTo({
      center:target.center,
      bearing:target.bearing,
      offset:target.offset,
      zoom:ZOOM,
      pitch:PITCH,
      duration:instant?0:420,
      essential:true
    },{trasyCamera:true});
  }


  /* =========================================================
     POJAZD
     ========================================================= */

  function vehicleElement(){
    const el=document.createElement('div');

    el.style.cssText=`
      width:36px;
      height:36px;
      clip-path:polygon(
        50% 0,
        100% 100%,
        50% 78%,
        0 100%
      );
      background:#078df0;
      border:3px solid #fff;
      filter:drop-shadow(0 2px 5px #000b)
    `;

    return el;
  }

  function setVehicleStatus(kind){
    if(!positionEl)return;

    positionEl.style.background=
      kind==='late'
        ?'#ff3b30'
        :kind==='early'
          ?'#ffd60a'
          :kind==='onTime'
            ?'#34c759'
            :'#078df0';
  }


  /* =========================================================
     PRZYSTANKI
     ========================================================= */

  function routeRows(){
    return [...body.querySelectorAll('tr')]
      .filter(r=>parseCoord(r.dataset.coordinate));
  }

  function stopKey(row,index){
    return row.dataset.stopId||`${index}:${row.dataset.coordinate||''}`;
  }

  function remainingStopsFromGps(){
    const rows=routeRows();

    let idx=Number(body.dataset.gpsNextStop);

    if(
      !Number.isInteger(idx)||
      idx<0||
      idx>=rows.length
    ){
      const active=
        rows.findIndex(
          r=>r.classList.contains('gpsNextStop')
        );

      idx=active>=0?active:0;
    }

    const remaining=rows
      .slice(idx)
      .map((r,i)=>({
        coord:parseCoord(r.dataset.coordinate),

        key:stopKey(r,idx+i),

        name:
          r.querySelector('td:first-child')
            ?.childNodes[0]
            ?.textContent
            ?.trim()
          ||
          r.querySelector('td:first-child')
            ?.innerText
            ?.trim()
          ||
          `Punkt ${i+1}`,

        planTime:String(
          r.children[1]?.firstChild?.textContent||
          r.children[1]?.textContent||
          ''
        ).trim()
      }))
      .filter(x=>x.coord);

    return body.dataset.emptyRun==='1'&&remaining.length
      ?[remaining[remaining.length-1]]
      :remaining;
  }


  /* =========================================================
     ETA AKTYWNEGO PRZYSTANKU
     ========================================================= */

  function liveFirstLegSeconds(){
    if(!legDurations.length)return null;

    const elapsed=
      Math.max(
        0,
        (Date.now()-legStartAt)/1000
      );

    return Math.max(
      0,
      Number(legDurations[0]||0)-elapsed
    );
  }

  function punctuality(){
    const seconds=liveFirstLegSeconds();

    if(seconds===null||!currentStops.length){
      return{
        kind:'neutral',
        seconds:null,
        diff:null
      };
    }

    const plan=parseTodayTime(
      currentStops[0].planTime
    );

    if(!plan){
      return{
        kind:'neutral',
        seconds,
        diff:null
      };
    }

    const predicted=
      new Date(Date.now()+seconds*1000);

    const diff=
      (predicted.getTime()-plan.getTime())/1000;

    let kind='onTime';

    if(diff>TOLERANCE_SECONDS){
      kind='late';
    }else if(diff<-TOLERANCE_SECONDS){
      kind='early';
    }

    return{
      kind,
      seconds,
      diff
    };
  }


  function dispatchEta(){
    const p=punctuality();

    setVehicleStatus(p.kind);

    if(Number.isFinite(p.seconds)){
      body.dispatchEvent(
        new CustomEvent('nav-eta-update',{
          bubbles:true,
          detail:{
            etaSeconds:p.seconds,
            kind:p.kind,
            diffSeconds:p.diff
          }
        })
      );
    }
  }


  /* =========================================================
     MARKERY
     ========================================================= */

  function ordinaryStopElement(number,isLast){
    const dot=document.createElement('div');

    dot.style.cssText=`
      width:28px;
      height:28px;
      border-radius:50%;
      background:${isLast?'#ffb000':'#078df0'};
      border:3px solid #fff;
      box-shadow:0 2px 8px #0009;
      display:flex;
      align-items:center;
      justify-content:center;
      color:#111;
      font-weight:900;
      font-size:11px
    `;

    dot.textContent=String(number);

    return dot;
  }

  function activeStopElement(number){
    const dot=ordinaryStopElement(number,false);
    dot.style.width='32px';
    dot.style.height='32px';
    return{element:dot,badge:null,dot};
  }

  function updatePunctualityUi(){
    dispatchEta();
  }

  function refreshStopMarkers(stops,legs){
    stopMarkers.forEach(
      x=>x.marker.remove()
    );

    stopMarkers=[];

    stops.forEach((stop,i)=>{
      let ui;

      if(i===0){
        ui=activeStopElement(1);
      }else{
        ui={
          element:ordinaryStopElement(
            i+1,
            i===stops.length-1
          ),
          badge:null,
          dot:null
        };
      }

      const marker=
        new maplibregl.Marker({
          element:ui.element,
          anchor:'bottom'
        })
        .setLngLat([
          stop.coord[1],
          stop.coord[0]
        ])
        .setPopup(
          new maplibregl.Popup({
            offset:22
          }).setHTML(
            `<strong>${stop.name}</strong>`+
            `${stop.planTime?`<br>Plan: ${stop.planTime}`:''}`
          )
        )
        .addTo(map);

      stopMarkers.push({
        marker,
        badge:ui.badge,
        stop
      });
    });

  }



  /* =========================================================
     INSTRUKCJE
     ========================================================= */

  function instruction(step){
    const m=step?.maneuver||{};
    const type=m.type||'';
    const mod=m.modifier||'';

    const road=step.name?tr('roadName',{name:step.name}):'';

    const dir={
      left:tr('directionLeft'),
      right:tr('directionRight'),
      'slight left':tr('directionSlightLeft'),
      'slight right':tr('directionSlightRight'),
      'sharp left':tr('directionSharpLeft'),
      'sharp right':tr('directionSharpRight'),
      straight:tr('directionStraight'),
      uturn:tr('directionUturn')
    }[mod]||'';

    if(type==='depart'){
      return dir?tr('departDirection',{direction:dir}):tr('departStraight');
    }

    if(type==='arrive'){
      return tr('arrivePoint');
    }

    if(type==='roundabout'||type==='rotary'){
      return m.exit?tr('roundaboutExit',{exit:m.exit}):tr('roundabout');
    }

    if(type==='merge'){
      return tr('merge',{direction:dir}).trim();
    }

    if(type==='fork'){
      return tr('fork',{direction:dir}).trim();
    }

    if(type==='on ramp'){
      return tr('onRamp',{direction:dir}).trim();
    }

    if(type==='off ramp'){
      return tr('offRamp',{direction:dir}).trim();
    }

    if(type==='end of road'){
      return tr('endOfRoad',{direction:dir,road}).trim();
    }

    if(type==='continue'){
      return tr('continueRoad',{direction:dir||tr('directionStraight'),road}).trim();
    }

    if(type==='turn'||type==='new name'){
      return tr('turnRoad',{direction:dir,road}).trim();
    }

    return tr('driveRoad',{direction:dir||tr('directionStraight'),road}).trim();
  }

  function isVoiceManeuver(step){
    const m=step?.maneuver||{};
    const type=m.type||'';
    const mod=m.modifier||'';

    if(
      type==='arrive'||
      type==='roundabout'||
      type==='rotary'||
      type==='merge'||
      type==='fork'||
      type==='on ramp'||
      type==='off ramp'||
      type==='end of road'
    ){
      return true;
    }

    if(
      type==='turn'||
      type==='new name'||
      type==='continue'
    ){
      return mod&&mod!=='straight';
    }

    return false;
  }

  function speak(step,text,d){
    if(!isVoiceManeuver(step)||window.__routeVoiceMuted===true)return;

    const bucket=
      d<55
        ?'now'
        :d<180
          ?'150'
          :d<420
            ?'400'
            :'';

    if(!bucket)return;
    if(bucket==='400')return;

    const cleanText=window.__trasyCleanGuidanceText?.(text)||text;

    const key=
      (step.maneuver?.type||'')+
      '|'+
      (step.maneuver?.modifier||'')+
      '|'+
      (step.name||'')+
      '|'+
      bucket;

    if(key===lastSpoken)return;

    lastSpoken=key;

    try{
      speechSynthesis.cancel();

      const u=
        new SpeechSynthesisUtterance(
          bucket==='now'
            ?cleanText
            :tr('inMeters',{distance:bucket==='150'?'150':'400',instruction:cleanText})
        );

      u.lang=window.TrasyI18n?.speechLanguage?.()||'pl-PL';
      speechSynthesis.speak(u);

    }catch{}
  }


  /* =========================================================
     POSTĘP NA TRASIE
     ========================================================= */

  function routeWindow(start,backMeters=ROUTE_PROGRESS_BACKTRACK_M,forwardMeters=ROUTE_PROGRESS_LOOKAHEAD_M){
    const safe=Math.max(0,Math.min(Math.trunc(Number(start)||0),Math.max(0,routeCoords.length-1)));
    let from=safe,to=safe,walked=0;
    while(from>0&&walked<backMeters){
      walked+=hav(routeCoords[from],routeCoords[from-1]);
      from-=1;
    }
    walked=0;
    while(to<routeCoords.length-1&&walked<forwardMeters){
      walked+=hav(routeCoords[to],routeCoords[to+1]);
      to+=1;
    }
    return{from,to};
  }

  function nearestRoutePoint(ll,start=0){
    if(!routeCoords.length){
      return{index:0,distance:Infinity};
    }

    const safe=Math.max(0,Math.min(Math.trunc(Number(start)||0),routeCoords.length-1));
    const window=routeWindow(safe);
    let best=safe,bestD=Infinity;

    for(let i=window.from;i<=window.to;i+=1){
      const d=hav(ll,routeCoords[i]);
      if(d<bestD){bestD=d;best=i}
    }

    return{index:best,distance:bestD};
  }

  function mapStepsToProgress(){
    let cursor=0;
    stepProgress=steps.map(s=>{
      const loc=s.maneuver?.location;
      if(!loc)return cursor;

      const ll=[loc[1],loc[0]];
      let best=cursor,bestD=Infinity;

      // Kroki OSRM sa uporzadkowane. Szukamy pierwszego pasujacego miejsca
      // po poprzednim kroku, zamiast ponownie skanowac cala trase od zera.
      for(let i=Math.max(0,cursor-3);i<routeCoords.length;i+=1){
        const d=hav(ll,routeCoords[i]);
        if(d<bestD){bestD=d;best=i}
        if(bestD<3&&i>=best+8)break;
      }

      cursor=Math.max(cursor,best);
      return cursor;
    });
  }

  function nextStepByProgress(ll){
    const snap=
      nearestRoutePoint(ll,progressIndex);

    if(snap.index>=progressIndex-15){
      progressIndex=
        Math.max(progressIndex,snap.index);
    }

    let idx=
      stepProgress.findIndex(
        (p,i)=>
          p>=progressIndex+1&&
          steps[i]?.maneuver?.type!=='depart'
      );

    if(idx<0){
      idx=Math.max(0,steps.length-1);
    }

    const step=steps[idx];
    const loc=step?.maneuver?.location;

    const distance=
      loc
        ?hav(ll,[loc[1],loc[0]])
        :0;

    return{
      step,
      distance,
      off:snap.distance
    };
  }


  /* =========================================================
     PROWADZENIE
     ========================================================= */

  function updateGuidance(ll){
    const g=nextStepByProgress(ll);

    updatePunctualityUi();

    if(!g.step)return;

    const text=instruction(g.step);

    maneuverEl.textContent=text;
    maneuverDistance.textContent=fmtDistance(g.distance);

    speak(g.step,text,g.distance);

    const accuracy=Math.max(
      0,
      Number(window.__navAcc||0)
    );

    const offRouteThreshold=Math.max(
      MIN_REROUTE_DISTANCE,
      accuracy*2
    );

    const isOffRoute=
      g.off>offRouteThreshold;

    if(isOffRoute){
      offRouteFixes+=1;
    }else{
      offRouteFixes=0;

      if(rerouteTimer){
        clearTimeout(rerouteTimer);
        rerouteTimer=0;
      }
    }

    if(
      isOffRoute&&
      offRouteFixes>=REROUTE_CONFIRM_FIXES
    ){
      gpsStatus.textContent=
        'Poza trasą — sprawdzam zjazd…';
    }else{
      gpsStatus.textContent=
        `GPS ±${Math.round(accuracy)} m`;
    }

    if(
      isOffRoute&&
      offRouteFixes>=REROUTE_CONFIRM_FIXES&&
      !rerouteTimer&&
      !routeBuildInFlight&&
      Date.now()-lastRouteBuildAt>5000&&
      Date.now()-lastRerouteAt>REROUTE_COOLDOWN_MS
    ){
      rerouteTimer=setTimeout(()=>{
        rerouteTimer=0;

        if(
          !lastGpsPoint||
          routeBuildInFlight
        )return;

        const latestAccuracy=Math.max(
          0,
          Number(window.__navAcc||0)
        );

        const latestThreshold=Math.max(
          MIN_REROUTE_DISTANCE,
          latestAccuracy*2
        );

        const latestOff=
          nearestRoutePoint(
            lastGpsPoint,
            progressIndex
          ).distance;

        if(latestOff<=latestThreshold){
          offRouteFixes=0;
          return;
        }

        const remaining=
          remainingStopsFromGps();

        if(remaining.length){
          currentStops=remaining;
          lastRerouteAt=Date.now();
          offRouteFixes=0;

          buildRoute(
            lastGpsPoint,
            currentStops
          ).catch(
            err=>
              console.warn(
                'Przeliczenie trasy:',
                err
              )
          );
        }
      },2000);
    }
  }


  /* =========================================================
     TRASA
     ========================================================= */

  function routeGeoJSON(coords){
    return{
      type:'Feature',
      properties:{},
      geometry:{
        type:'LineString',
        coordinates:coords
      }
    };
  }

  async function buildRoute(origin,stops){
    if(!stops.length)return;
    const gpsAge=Date.now()-Number(lastGpsAt||0);
    if(document.visibilityState!=='visible'||!lastGpsAt||gpsAge<0||gpsAge>MAX_ROUTE_GPS_AGE_MS){
      const error=new Error('Czekam na świeżą pozycję GPS przed wyznaczeniem trasy.');
      error.name='StaleGpsPositionError';
      throw error;
    }

    routeAbortController?.abort();
    const requestId=++routeRequestGeneration;
    const controller=new AbortController();
    routeAbortController=controller;
    routeBuildInFlight=true;
    lastRouteBuildAt=Date.now();
    legStartAt=Date.now();
    document.dispatchEvent(new CustomEvent('trasy:route-build',{detail:{
      phase:'start',requestId,origin,stops:stops.map(stop=>({key:stop.key,name:stop.name,coord:stop.coord}))
    }}));

    try{
      const coords=[
        origin,
        ...stops.map(s=>s.coord)
      ]
        .map(([lat,lng])=>`${lng},${lat}`)
        .join(';');

      if(!routeCoords.length){
        status.textContent='Pobieranie przebiegu trasy…';
      }

      const baseRouteUrl=
        `https://router.project-osrm.org/route/v1/driving/${coords}`+
        `?overview=full&geometries=geojson&steps=true&annotations=duration,distance`;
      const directionQuery=startDirectionQuery(stops);
      let routeUrl=`${baseRouteUrl}${directionQuery}`;
      let usedStartDirection=Boolean(directionQuery);
      if(usedStartDirection)lastDirectionAttemptAt=Date.now();
      const routeFetch=window.__trasyRouteFetch||window.fetch.bind(window);
      let res=await routeFetch(routeUrl,{cache:'no-store',signal:controller.signal});

      if(requestId!==routeRequestGeneration||controller.signal.aborted)return;
      if(!res.ok&&usedStartDirection){
        routeUrl=baseRouteUrl;
        usedStartDirection=false;
        res=await routeFetch(routeUrl,{cache:'no-store',signal:controller.signal});
        if(requestId!==routeRequestGeneration||controller.signal.aborted)return;
      }
      if(!res.ok)throw Error(`HTTP ${res.status}`);

      let rawData=await res.json();
      if(requestId!==routeRequestGeneration||controller.signal.aborted)return;
      let data=window.__trasyNormalizeRouteResponse?.(rawData)||rawData;
      if(!data.routes?.[0]&&usedStartDirection){
        routeUrl=baseRouteUrl;
        usedStartDirection=false;
        res=await routeFetch(routeUrl,{cache:'no-store',signal:controller.signal});
        if(requestId!==routeRequestGeneration||controller.signal.aborted)return;
        if(!res.ok)throw Error(`HTTP ${res.status}`);
        rawData=await res.json();
        if(requestId!==routeRequestGeneration||controller.signal.aborted)return;
        data=window.__trasyNormalizeRouteResponse?.(rawData)||rawData;
      }
      window.__trasyCaptureRoute?.(routeUrl,data);
      const route=data.routes?.[0];

      if(!route){
        throw Error('Nie znaleziono trasy.');
      }
      routeUsesStartDirection=usedStartDirection;

      const geo=
        routeGeoJSON(route.geometry.coordinates);

      routeCoords=
        (route.geometry?.coordinates||[])
          .map(([lng,lat])=>[lat,lng]);

      steps=
        (route.legs||[])
          .flatMap(l=>l.steps||[]);

      legDurations=
        (route.legs||[])
          .map(l=>l.duration||0);

      progressIndex=0;
      offRouteFixes=0;

      mapStepsToProgress();

      const renderer=window.__trasyRouteRenderer;
      if(!renderer?.setRoute)throw Error('Renderer trasy nie jest gotowy.');
      renderer.setRoute(geo);

      refreshStopMarkers(
        stops,
        route.legs||[]
      );

      dispatchEta();

      const routeMinutes=Math.max(1,Math.round(route.duration/60));
      const routeDuration=window.__trasyEta?.formatMinutes?.(routeMinutes)||`${routeMinutes} min`;
      const routeSummary=`Trasa ${fmtDistance(route.distance)} • ${routeDuration}`;
      status.dataset.routeBase=routeSummary;
      status.textContent=routeSummary;
      status.dataset.state='ready';
      document.dispatchEvent(new CustomEvent('trasy:route-build',{detail:{
        phase:'success',requestId,usedStartDirection,distance:route.distance,duration:route.duration,
        legDurations:legDurations.slice(),routePointCount:routeCoords.length,stopCount:stops.length
      }}));
    }catch(error){
      if(error?.name==='AbortError'||requestId!==routeRequestGeneration){
        document.dispatchEvent(new CustomEvent('trasy:route-build',{detail:{phase:'aborted',requestId,message:error?.message||''}}));
        return;
      }
      document.dispatchEvent(new CustomEvent('trasy:route-build',{detail:{phase:'error',requestId,name:error?.name||'Error',message:error?.message||String(error)}}));
      throw error;
    }finally{
      if(requestId===routeRequestGeneration){
        routeBuildInFlight=false;
        if(routeAbortController===controller)routeAbortController=null;
      }
    }
  }


  /* =========================================================
     ZMIANA PRZYSTANKU BEZ NOWEGO GOOGLE
     ========================================================= */

  function syncRemainingLocally(){
    if(panel.hidden)return;

    const remaining=
      remainingStopsFromGps();

    if(!remaining.length)return;

    if(!currentStops.length){
      currentStops=remaining;
      return;
    }

    const key=remaining[0].key;

    const oldIndex=
      currentStops.findIndex(
        s=>s.key===key
      );

    if(oldIndex>0){
      if(routeBuildInFlight&&lastGpsPoint){
        currentStops=remaining;
        legDurations=[];
        legStartAt=Date.now();
        buildRoute(lastGpsPoint,currentStops).catch(
          error=>console.warn('Zmiana przystanku:',error)
        );
        return;
      }

      currentStops=
        currentStops.slice(oldIndex);

      legDurations=
        legDurations.slice(oldIndex);

      legStartAt=Date.now();

      refreshStopMarkers(
        currentStops,
        legDurations.map(
          duration=>({duration})
        )
      );

      dispatchEta();

    }else if(oldIndex<0){
      currentStops=remaining;
      legDurations=[];
      legStartAt=Date.now();
      if(lastGpsPoint){
        buildRoute(lastGpsPoint,currentStops).catch(
          error=>console.warn('Zmiana przystanku:',error)
        );
      }
    }
  }


  /* =========================================================
     ODŚWIEŻENIE TRASY CO 3 MINUTY
     ========================================================= */

  function startTrafficRefresh(){
    clearInterval(refreshTimer);

    refreshTimer=setInterval(()=>{
      if(
        panel.hidden||
        document.visibilityState!=='visible'||
        !lastGpsAt||
        Date.now()-lastGpsAt>MAX_ROUTE_GPS_AGE_MS||
        !lastGpsPoint||
        !currentStops.length||
        routeBuildInFlight
      )return;

      if(
        Date.now()-lastRouteBuildAt<
        TRAFFIC_REFRESH_MS
      )return;

      buildRoute(
        lastGpsPoint,
        currentStops
      ).catch(
        err=>
          console.warn(
            'Odświeżenie trasy:',
            err
          )
      );

    },10000);
  }



  /* =========================================================
     PRZYCISKI
     ========================================================= */

  panel.querySelector(
    '#routeMapCenter'
  ).onclick=()=>{
    if(window.__routeResumeNavigation){
      window.__routeResumeNavigation();
      return;
    }

    if(positionMarker&&map){
      const p=positionMarker.getLngLat();

      followCamera(
        [p.lat,p.lng],
        currentHeading,
        true
      );
    }
  };

  panel.querySelector(
    '#routeMapClose'
  ).onclick=closeMapNav;


  /* =========================================================
     START NAWIGACJI
     ========================================================= */

  function clearMarkers(){
    if(positionAnimation){cancelAnimationFrame(positionAnimation);positionAnimation=0}
    lastMarkerUpdateAt=0;
    if(positionMarker){
      positionMarker.remove();
      positionMarker=null;
      positionEl=null;
    }

    stopMarkers.forEach(
      x=>x.marker.remove()
    );

    stopMarkers=[];
  }

  function setVehiclePosition(ll,instant=false){
    if(!positionMarker)return;
    const target=[ll[1],ll[0]];
    const current=positionMarker.getLngLat?.();
    if(positionAnimation){cancelAnimationFrame(positionAnimation);positionAnimation=0}
    if(instant||!current){positionMarker.setLngLat(target);lastMarkerUpdateAt=performance.now();return}
    const from=[Number(current.lng),Number(current.lat)];
    const jump=hav([from[1],from[0]],ll);
    if(!Number.isFinite(jump)||jump>250){positionMarker.setLngLat(target);lastMarkerUpdateAt=performance.now();return}
    const now=performance.now();
    const interval=lastMarkerUpdateAt?now-lastMarkerUpdateAt:900;
    lastMarkerUpdateAt=now;
    const duration=Math.max(550,Math.min(1350,interval*1.12));
    const started=now;
    const animate=time=>{
      const t=Math.min(1,(time-started)/duration);
      positionMarker?.setLngLat([from[0]+(target[0]-from[0])*t,from[1]+(target[1]-from[1])*t]);
      if(t<1&&!panel.hidden&&positionMarker)positionAnimation=requestAnimationFrame(animate);
      else{positionAnimation=0;positionMarker?.setLngLat(target)}
    };
    positionAnimation=requestAnimationFrame(animate);
  }

  function applyNavigationPosition(position){
    const ll=[Number(position?.coords?.latitude),Number(position?.coords?.longitude)];
    if(!Number.isFinite(ll[0])||!Number.isFinite(ll[1])||panel.hidden)return;
    const instant=resumeInstant;
    if(instant){
      const snap=nearestRoutePoint(ll,progressIndex);
      const accuracy=Math.max(0,Number(position?.coords?.accuracy)||0);
      if(snap.distance<=Math.max(MIN_REROUTE_DISTANCE,accuracy*2))progressIndex=Math.max(progressIndex,snap.index);
      lastGpsPoint=null;
      headingReady=false;
    }

    window.__navAcc=position.coords.accuracy||0;
    setVehiclePosition(ll,instant);

    const rawSensorHeading=position.coords.heading;
    const sensorHeading=rawSensorHeading===null||rawSensorHeading===undefined?NaN:Number(rawSensorHeading);
    if(instant&&(!Number.isFinite(sensorHeading)||sensorHeading<0)){
      currentHeading=headingFromCurrentRoute(ll);
      headingReady=true;
      lastGpsPoint=ll;
    }
    const heading=updateNavigationMotion(position,ll);
    if(
      !routeUsesStartDirection&&
      !routeBuildInFlight&&
      currentStops.length&&
      startDirectionQuery(currentStops)&&
      Date.now()-lastDirectionAttemptAt>=30000
    ){
      buildRoute(ll,currentStops).catch(error=>console.warn('Korekta kierunku trasy:',error));
    }
    followCamera(ll,heading,instant);
    updateGuidance(ll);
    resumeInstant=false;
  }

  async function recoverNavigation(){
    if(panel.hidden||document.visibilityState!=='visible'||resumePromise)return resumePromise;
    resumeInstant=true;
    const previousStatus=status.textContent;
    status.textContent='Aktualizuję pozycję po wznowieniu…';
    resumePromise=window.__trasyGps.refresh()
      .then(async position=>{
        const origin=[Number(position.coords.latitude),Number(position.coords.longitude)];
        updateNavigationMotion(position,origin);
        const remaining=remainingStopsFromGps();
        if(remaining.length)currentStops=remaining;
        if(currentStops.length){
          const accuracy=Math.max(0,Number(position.coords.accuracy)||0);
          const snap=nearestRoutePoint(origin,progressIndex);
          const stillOnRoute=routeCoords.length&&snap.distance<=Math.max(MIN_REROUTE_DISTANCE,accuracy*2);
          if(stillOnRoute)progressIndex=Math.max(progressIndex,snap.index);
          if(stillOnRoute){
            status.textContent=previousStatus;
            updateGuidance(origin);
            followCamera(origin,currentHeading,true);
          }else{
            try{
              await buildRoute(origin,currentStops);
              updateGuidance(origin);
              followCamera(origin,currentHeading,true);
            }catch(error){
              status.textContent='Pozycja zaktualizowana • używam dotychczasowej trasy';
              console.warn('Wznowienie przebiegu trasy:',error);
            }
          }
          document.dispatchEvent(new CustomEvent('trasy:navigation-resumed',{detail:{position,hiddenAt}}));
        }else{
          document.dispatchEvent(new CustomEvent('trasy:navigation-resumed',{detail:{position,hiddenAt}}));
        }
        return position;
      })
      .catch(error=>{
        status.textContent='Czekam na świeżą pozycję GPS…';
        console.warn('Wznowienie GPS:',error);
        return null;
      })
      .finally(()=>{resumePromise=null;resumeInstant=false});
    return resumePromise;
  }

  async function openMapNav(){
    if(!window.maplibregl){
      alert(
        'Mapa nie została załadowana. Sprawdź połączenie z internetem.'
      );
      return;
    }

    const stops=remainingStopsFromGps();

    if(!stops.length){
      alert('Brak pozostałych punktów trasy.');
      return;
    }

    currentStops=stops;

    panel.hidden=false;
    window.__trasyWakeLock?.setNavigation(true);
    window.__routeCameraController?.startGuidance();

    setNavigationLoading();

    maneuverEl.textContent=
      'Pobieranie trasy…';

    maneuverDistance.textContent='';

    lastSpoken='';
    lastGpsPoint=null;
    lastGpsAt=0;
    currentHeading=0;
    headingReady=false;
    currentSpeedMps=0;
    routingHeadingAt=0;
    routeUsesStartDirection=false;
    lastDirectionAttemptAt=0;
    progressIndex=0;
    offRouteFixes=0;
    lastRerouteAt=0;

    if(rerouteTimer){
      clearTimeout(rerouteTimer);
      rerouteTimer=0;
    }

    if(!navigator.geolocation){
      showNavigationError({code:2,message:'Geolocation unavailable'});
      return;
    }

    try{
      const pos=await posOnce();

      const origin=[
        pos.coords.latitude,
        pos.coords.longitude
      ];

      const initialHeading=updateNavigationMotion(pos,origin);

      window.__navAcc=
        pos.coords.accuracy||0;

      if(!map){
        const createMap=window.__trasyMapRuntime?.createMap;
        if(typeof createMap!=='function')throw Error('Runtime mapy nie jest gotowy.');
        map=createMap({
          container:'routeMapCanvas',
          center:[origin[1],origin[0]],
          zoom:ZOOM,
          pitch:PITCH,
          bearing:0,
          attributionControl:true,
          maxPitch:60
        });

        map.addControl(
          new maplibregl.NavigationControl({
            showCompass:true,
            showZoom:true
          }),
          'bottom-right'
        );

        document.dispatchEvent(new CustomEvent('trasy:route-map-ready',{
          detail:{map}
        }));


        await new Promise(
          resolve=>
            map.loaded()
              ?resolve()
              :map.once('load',resolve)
        );

      }else{
        map.resize();

        window.__trasyRouteRenderer?.clear?.();
      }

      clearMarkers();

      positionEl=vehicleElement();

      positionMarker=
        new maplibregl.Marker({
          element:positionEl,
          rotationAlignment:'viewport',
          pitchAlignment:'viewport',
          subpixelPositioning:true
        })
        .setLngLat([
          origin[1],
          origin[0]
        ])
        .addTo(map);

      await buildRoute(origin,stops);

      updateGuidance(origin);

      if(!routingHeadingAt)currentHeading=headingFromRoute(origin);
      headingReady=true;

      followCamera(
        origin,
        routingHeadingAt?initialHeading:currentHeading,
        true
      );

      startTrafficRefresh();

      if(watchId!==null){
        window.__trasyGps.unsubscribe(watchId);
      }

      watchId=
        window.__trasyGps.subscribe(
          applyNavigationPosition,

          ()=>{
            gpsStatus.textContent=
              'Brak aktualnej pozycji GPS.';
          }
        );

    }catch(e){
      showNavigationError(e);
    }
  }

  function startMapNav(){
    if(navigationStartPromise)return navigationStartPromise;
    navigationStartPromise=openMapNav()
      .catch(error=>showNavigationError(error))
      .finally(()=>{navigationStartPromise=null;gpsRetry.disabled=false});
    return navigationStartPromise;
  }

  gpsRetry.onclick=()=>{
    gpsRetry.disabled=true;
    startMapNav();
  };

  function closeMapNav(){
    window.__routeCameraController?.startGuidance();
    window.__trasyWakeLock?.setNavigation(false);

    if(watchId!==null){
      window.__trasyGps.unsubscribe(watchId);
      watchId=null;
    }

    if(rerouteTimer){
      clearTimeout(rerouteTimer);
      rerouteTimer=0;
    }

    clearInterval(refreshTimer);
    refreshTimer=0;

    panel.hidden=true;

    speechSynthesis?.cancel?.();

    lastGpsPoint=null;
    lastGpsAt=0;
    currentHeading=0;
    headingReady=false;
    currentSpeedMps=0;
    routingHeadingAt=0;
    routeUsesStartDirection=false;
    lastDirectionAttemptAt=0;
    progressIndex=0;
    offRouteFixes=0;
    routeBuildInFlight=false;
  }


  /* =========================================================
     ZDARZENIA
     ========================================================= */

  body.addEventListener(
    'gps-next-stop-change',
    syncRemainingLocally
  );

  body.addEventListener(
    'route-direction-change',
    ()=>{
      if(panel.hidden)return;

      const remaining=
        remainingStopsFromGps();

      if(!remaining.length)return;

      currentStops=remaining;

      if(lastGpsPoint){
        buildRoute(
          lastGpsPoint,
          currentStops
        );
      }
    }
  );

  body.addEventListener(
    'route-mode-change',
    ()=>{
      if(panel.hidden)return;

      const remaining=
        remainingStopsFromGps();

      if(!remaining.length)return;

      currentStops=remaining;

      if(lastGpsPoint){
        buildRoute(
          lastGpsPoint,
          currentStops
        );
      }
    }
  );

  document.addEventListener(
    'click',
    e=>{
      const link=
        e.target.closest?.('.routeLink');

      if(
        !link||
        !body.contains(link)
      )return;

      e.preventDefault();
      e.stopImmediatePropagation();

      startMapNav();
    },
    true
  );

  document.addEventListener('visibilitychange',()=>{
    if(document.visibilityState==='hidden'){
      hiddenAt=Date.now();
      return;
    }
    if(!panel.hidden&&hiddenAt&&Date.now()-hiddenAt>=3000)recoverNavigation();
  });
  window.addEventListener('pageshow',event=>{
    if(event.persisted&&!panel.hidden)recoverNavigation();
  });

  setInterval(()=>{
    if(panel.hidden)return;

    updatePunctualityUi();

  },1000);

})();
