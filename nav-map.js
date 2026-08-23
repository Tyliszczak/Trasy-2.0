(()=>{
  const body=document.getElementById('scheduleBody');
  if(!body)return;

  let map=null;
  let positionMarker=null;
  let positionEl=null;
  let watchId=null;

  let steps=[];
  let stepProgress=[];
  let routeCoords=[];

  let rerouteTimer=0;
  let refreshTimer=0;

  let lastSpoken='';

  let currentStops=[];
  let lastGpsPoint=null;
  let currentHeading=0;

  let stopMarkers=[];
  let progressIndex=0;

  let lastRouteBuildAt=0;
  let lastRerouteAt=0;
  let legStartAt=0;
  let legDurations=[];
  let routeBuildInFlight=false;
  let offRouteFixes=0;

  let guardState={
    state:'',
    message:''
  };

  const PITCH=58;
  const ZOOM=17.2;

  const TOLERANCE_SECONDS=30;
  const TRAFFIC_REFRESH_MS=180000;
  const MIN_REROUTE_DISTANCE=85;
  const REROUTE_CONFIRM_FIXES=3;
  const REROUTE_COOLDOWN_MS=30000;


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
      ">

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

      </div>
    </div>
  `;

  document.body.append(panel);

  const root=panel.querySelector('#routeNavRoot');
  const status=panel.querySelector('#routeMapStatus');
  const gpsStatus=panel.querySelector('#routeGpsStatus');

  const maneuverEl=
    panel.querySelector('#routeManeuver');

  const maneuverDistance=
    panel.querySelector('#routeManeuverDistance');

  const nextStopEl=
    panel.querySelector('#routeNextStop');


  /* =========================================================
     PANEL ETA POZA EKRANEM
     ========================================================= */

  const offscreenPanel=
    document.createElement('button');

  offscreenPanel.type='button';
  offscreenPanel.hidden=true;

  offscreenPanel.style.cssText=`
    position:absolute;
    top:190px;
    left:10px;
    z-index:50020;
    max-width:72%;
    min-width:145px;
    padding:7px 9px;
    border:1px solid #fff8;
    border-radius:9px;
    background:#111e;
    color:#fff;
    box-shadow:0 3px 10px #0009;
    text-align:left;
    font-size:12px;
    line-height:1.2;
    font-weight:900;
    cursor:pointer
  `;

  offscreenPanel.innerHTML=`
    <span
      id="offscreenArrow"
      style="
        display:inline-block;
        margin-right:6px;
        font-size:18px;
        transform-origin:50% 50%
      "
    >↑</span>
    <span id="offscreenText"></span>
  `;

  root.appendChild(offscreenPanel);

  const offscreenArrow=
    offscreenPanel.querySelector('#offscreenArrow');

  const offscreenText=
    offscreenPanel.querySelector('#offscreenText');


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

    const d=
      ((next-currentHeading+540)%360)-180;

    currentHeading=
      (currentHeading+d*.28+360)%360;

    return currentHeading;
  }

  function headingFromPosition(p,ll){
    let h=Number(p.coords.heading);

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

  function posOnce(){
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

  function deltaText(diff){
    if(diff===null)return '';

    if(Math.abs(diff)<=TOLERANCE_SECONDS){
      return '👍';
    }

    const full=Math.max(
      1,
      Math.floor(Math.abs(diff)/60)
    );

    return diff<0
      ?`${full} min za wcześnie`
      :`${full} min opóźnienia`;
  }

  function activeEtaData(){
    const p=punctuality();

    const eta=
      Number.isFinite(p.seconds)
        ?fmtClock(
            new Date(Date.now()+p.seconds*1000)
          )
        :'--:--';

    let text=
      currentStops[0]
        ?`${currentStops[0].name} • ${eta}`
        :eta;

    if(p.diff!==null){
      text+=` • ${deltaText(p.diff)}`;
    }

    if(guardState.state&&guardState.message){
      text=guardState.message;
    }

    let background='#111e';
    let color='#fff';

    if(guardState.state==='hold'){
      background='#ffd60a';
      color='#111';

    }else if(guardState.state==='ready'){
      background='#34c759';
      color='#071407';

    }else if(guardState.state==='earlyDeparture'){
      background='#ff3b30';
      color='#fff';

    }else if(p.kind==='late'){
      background='#ff3b30';

    }else if(p.kind==='early'){
      background='#ffd60a';
      color='#111';

    }else if(p.kind==='onTime'){
      background='#34c759';
    }

    return{
      ...p,
      eta,
      text,
      background,
      color
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
    const wrap=document.createElement('div');

    wrap.style.cssText=`
      display:flex;
      flex-direction:column;
      align-items:center;
      gap:2px;
      transform:translateY(-9px)
    `;

    const badge=document.createElement('div');

    badge.className='activeStopEtaBubble';

    badge.style.cssText=`
      padding:4px 7px;
      border-radius:7px;
      border:1px solid #fff9;
      font-size:11px;
      line-height:1.15;
      font-weight:900;
      white-space:nowrap;
      text-align:center;
      box-shadow:0 2px 7px #0009
    `;

    const dot=ordinaryStopElement(number,false);

    dot.style.width='32px';
    dot.style.height='32px';

    wrap.append(badge,dot);

    return{
      element:wrap,
      badge,
      dot
    };
  }

  function updateActiveBubble(){
    const first=stopMarkers[0];

    if(!first?.badge)return;

    const data=activeEtaData();

    first.badge.textContent=data.text;
    first.badge.style.background=data.background;
    first.badge.style.color=data.color;
  }

  function updatePunctualityUi(){
    dispatchEta();

    const p=punctuality();

    if(currentStops.length){
      const eta=Number.isFinite(p.seconds)
        ?fmtClock(new Date(Date.now()+p.seconds*1000))
        :'';

      nextStopEl.textContent=
        `Następny: ${currentStops[0].name}`+
        `${eta?` • ${eta}`:''}`+
        `${p.diff!==null?` • ${deltaText(p.diff)}`:''}`;
    }else{
      nextStopEl.textContent='';
    }

    updateActiveBubble();
    updateActiveStopVisibility();
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

    updateActiveBubble();
    updateActiveStopVisibility();
  }


  /* =========================================================
     AKTYWNY PRZYSTANEK POZA EKRANEM
     ========================================================= */

  function updateOffscreenArrow(){
    if(
      offscreenPanel.hidden||
      !map||
      !currentStops[0]
    )return;

    const stop=currentStops[0];

    const point=
      map.project([
        stop.coord[1],
        stop.coord[0]
      ]);

    const canvas=map.getCanvas();

    const cx=canvas.clientWidth/2;
    const cy=canvas.clientHeight/2;

    const dx=point.x-cx;
    const dy=point.y-cy;

    const angle=
      Math.atan2(dy,dx)*180/Math.PI+90;

    offscreenArrow.style.transform=
      `rotate(${angle}deg)`;
  }

  function updateActiveStopVisibility(){
    if(
      panel.hidden||
      !map||
      !currentStops[0]||
      !stopMarkers.length
    ){
      offscreenPanel.hidden=true;
      return;
    }

    const stop=currentStops[0];

    const insideBounds=
      map.getBounds().contains([
        stop.coord[1],
        stop.coord[0]
      ]);

    const first=stopMarkers[0];

    const markerElement=first?.badge?.parentElement;
    const markerRect=markerElement?.getBoundingClientRect?.();
    const safelyVisible=!markerRect||(!markerRect.width&&!markerRect.height)
      ?insideBounds
      :insideBounds&&
        markerRect.left>=20&&
        markerRect.right<=window.innerWidth-20&&
        markerRect.top>=150&&
        markerRect.bottom<=window.innerHeight-75;

    if(safelyVisible){
      offscreenPanel.hidden=true;

      if(first?.badge){
        first.badge.style.display='';
      }

      return;
    }

    if(first?.badge){
      first.badge.style.display='none';
    }

    const data=activeEtaData();

    offscreenText.textContent=data.text;

    offscreenPanel.style.background=data.background;
    offscreenPanel.style.color=data.color;

    offscreenPanel.hidden=false;

    updateOffscreenArrow();
  }

  offscreenPanel.onclick=()=>{
    if(
      !map||
      !lastGpsPoint||
      !currentStops[0]
    )return;

    window.__routeEnterManualView?.();

    const stop=currentStops[0];

    const bounds=
      new maplibregl.LngLatBounds();

    bounds.extend([
      lastGpsPoint[1],
      lastGpsPoint[0]
    ]);

    bounds.extend([
      stop.coord[1],
      stop.coord[0]
    ]);

    map.fitBounds(bounds,{
      padding:{
        top:80,
        bottom:90,
        left:55,
        right:55
      },
      maxZoom:15.5,
      duration:700
    });
  };


  /* =========================================================
     INSTRUKCJE
     ========================================================= */

  function instruction(step){
    const m=step?.maneuver||{};
    const type=m.type||'';
    const mod=m.modifier||'';

    const road=
      step.name
        ?` w ${step.name}`
        :'';

    const dir={
      left:'w lewo',
      right:'w prawo',
      'slight left':'lekko w lewo',
      'slight right':'lekko w prawo',
      'sharp left':'ostro w lewo',
      'sharp right':'ostro w prawo',
      straight:'prosto',
      uturn:'zawróć'
    }[mod]||'';

    if(type==='depart'){
      return dir?`Rusz ${dir}`:'Rusz prosto';
    }

    if(type==='arrive'){
      return'Dojeżdżasz do punktu';
    }

    if(type==='roundabout'||type==='rotary'){
      return(
        `Wjedź na rondo${
          m.exit
            ?` i wybierz ${m.exit}. zjazd`
            :''
        }`
      );
    }

    if(type==='merge'){
      return`Włącz się ${dir}`.trim();
    }

    if(type==='fork'){
      return`Na rozwidleniu trzymaj się ${dir}`.trim();
    }

    if(type==='on ramp'){
      return`Wjedź na zjazd ${dir}`.trim();
    }

    if(type==='off ramp'){
      return`Zjedź ${dir}`.trim();
    }

    if(type==='end of road'){
      return(
        `Na końcu drogi skręć ${dir}${road}`
      ).trim();
    }

    if(type==='continue'){
      return(
        `Jedź ${dir||'prosto'}${road}`
      ).trim();
    }

    if(type==='turn'||type==='new name'){
      return(
        `Skręć ${dir}${road}`
      ).trim();
    }

    return(
      `${dir?`Jedź ${dir}`:'Jedź prosto'}${road}`
    ).trim();
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
    if(!isVoiceManeuver(step))return;

    const bucket=
      d<55
        ?'now'
        :d<180
          ?'150'
          :d<420
            ?'400'
            :'';

    if(!bucket)return;

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
            ?text
            :`Za ${bucket==='150'?'150':'400'} metrów. ${text}`
        );

      u.lang='pl-PL';
      speechSynthesis.speak(u);

    }catch{}
  }


  /* =========================================================
     POSTĘP NA TRASIE
     ========================================================= */

  function nearestRoutePoint(ll,start=0){
    if(!routeCoords.length){
      return{
        index:0,
        distance:Infinity
      };
    }

    let best=Math.max(
      0,
      Math.min(start,routeCoords.length-1)
    );

    let bestD=Infinity;

    const from=Math.max(0,best-80);

    for(
      let i=from;
      i<routeCoords.length;
      i++
    ){
      const d=hav(ll,routeCoords[i]);

      if(d<bestD){
        bestD=d;
        best=i;
      }

      if(i>best+500&&bestD<25){
        break;
      }
    }

    return{
      index:best,
      distance:bestD
    };
  }

  function mapStepsToProgress(){
    stepProgress=steps.map(s=>{
      const loc=s.maneuver?.location;
      if(!loc)return 0;

      const ll=[loc[1],loc[0]];

      let best=0,bestD=Infinity;

      for(
        let i=0;
        i<routeCoords.length;
        i++
      ){
        const d=hav(ll,routeCoords[i]);

        if(d<bestD){
          bestD=d;
          best=i;
        }
      }

      return best;
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
    if(
      !stops.length||
      routeBuildInFlight
    )return;

    routeBuildInFlight=true;
    lastRouteBuildAt=Date.now();
    legStartAt=Date.now();

    try{
      const coords=[
        origin,
        ...stops.map(s=>s.coord)
      ]
        .map(([lat,lng])=>`${lng},${lat}`)
        .join(';');

      status.textContent=
        'Pobieranie przebiegu trasy…';

      const res=await fetch(
        `https://router.project-osrm.org/route/v1/driving/${coords}`+
        `?overview=full&geometries=geojson&steps=true&annotations=duration,distance`,
        {cache:'no-store'}
      );

      if(!res.ok){
        throw Error(`HTTP ${res.status}`);
      }

      const data=await res.json();
      const route=data.routes?.[0];

      if(!route){
        throw Error('Nie znaleziono trasy.');
      }

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

      if(map.getSource('route')){
        map.getSource('route').setData(geo);

      }else{
        map.addSource('route',{
          type:'geojson',
          data:geo
        });

        map.addLayer({
          id:'route-outline',
          type:'line',
          source:'route',
          layout:{
            'line-cap':'round',
            'line-join':'round'
          },
          paint:{
            'line-color':'#202020',
            'line-width':11,
            'line-opacity':.7
          }
        });

        map.addLayer({
          id:'route-line',
          type:'line',
          source:'route',
          layout:{
            'line-cap':'round',
            'line-join':'round'
          },
          paint:{
            'line-color':'#ccff33',
            'line-width':7,
            'line-opacity':.95
          }
        });
      }

      refreshStopMarkers(
        stops,
        route.legs||[]
      );

      dispatchEta();

      status.textContent=
        `Trasa ${fmtDistance(route.distance)} • `+
        `${Math.round(route.duration/60)} min`;
    }finally{
      routeBuildInFlight=false;
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
      if(lastGpsPoint&&!routeBuildInFlight){
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
     KOMUNIKAT NIE ODJEDŻAJ
     ========================================================= */

  body.addEventListener(
    'stop-guard-change',
    e=>{
      guardState={
        state:e.detail?.state||'',
        message:e.detail?.message||''
      };

      updateActiveBubble();
      updateActiveStopVisibility();
    }
  );


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

    if(!navigator.geolocation){
      alert('Telefon nie udostępnia lokalizacji.');
      return;
    }

    currentStops=stops;

    panel.hidden=false;
    window.__routeCameraController?.startGuidance();

    status.textContent=
      'Pobieranie pozycji telefonu…';

    gpsStatus.textContent='';

    maneuverEl.textContent=
      'Pobieranie trasy…';

    maneuverDistance.textContent='';
    nextStopEl.textContent='';

    lastSpoken='';
    lastGpsPoint=null;
    currentHeading=0;
    progressIndex=0;
    offRouteFixes=0;
    lastRerouteAt=0;

    if(rerouteTimer){
      clearTimeout(rerouteTimer);
      rerouteTimer=0;
    }

    try{
      const pos=await posOnce();

      const origin=[
        pos.coords.latitude,
        pos.coords.longitude
      ];

      lastGpsPoint=origin;

      window.__navAcc=
        pos.coords.accuracy||0;

      if(!map){
        map=new maplibregl.Map({
          container:'routeMapCanvas',

          style:{
            version:8,

            sources:{
              osm:{
                type:'raster',
                tiles:[
                  'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
                ],
                tileSize:256,
                attribution:'© OpenStreetMap contributors'
              }
            },

            layers:[
              {
                id:'osm',
                type:'raster',
                source:'osm'
              }
            ]
          },

          center:[
            origin[1],
            origin[0]
          ],

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

        map.on('move',()=>{
          updateActiveStopVisibility();
          updateOffscreenArrow();
        });

        await new Promise(
          resolve=>
            map.loaded()
              ?resolve()
              :map.once('load',resolve)
        );

      }else{
        map.resize();

        if(map.getSource('route')){
          map.getSource('route')
            .setData(routeGeoJSON([]));
        }
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

      followCamera(
        origin,
        0,
        true
      );

      startTrafficRefresh();

      if(watchId!==null){
        window.__trasyGps.unsubscribe(watchId);
      }

      watchId=
        window.__trasyGps.subscribe(
          p=>{
            const ll=[
              p.coords.latitude,
              p.coords.longitude
            ];

            window.__navAcc=
              p.coords.accuracy||0;

            lastGpsPoint=ll;

            if(positionMarker){
              positionMarker.setLngLat([
                ll[1],
                ll[0]
              ]);
            }

            const h=
              headingFromPosition(p,ll);

            followCamera(
              ll,
              h,
              false
            );

            updateGuidance(ll);
          },

          ()=>{
            gpsStatus.textContent=
              'Brak aktualnej pozycji GPS.';
          }
        );

    }catch(e){
      status.textContent=
        `Nie udało się uruchomić nawigacji: `+
        `${e.message||'błąd'}`;
    }
  }

  function closeMapNav(){
    window.__routeCameraController?.startGuidance();

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
    offscreenPanel.hidden=true;

    speechSynthesis?.cancel?.();

    lastGpsPoint=null;
    currentHeading=0;
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

      openMapNav();
    },
    true
  );

  setInterval(()=>{
    if(panel.hidden)return;

    updatePunctualityUi();

  },1000);

})();
