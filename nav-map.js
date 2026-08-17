(()=>{
  const body=document.getElementById('scheduleBody');
  if(!body)return;

  let map=null,positionMarker=null,positionEl=null,watchId=null,steps=[],stepProgress=[],routeCoords=[],rerouteTimer=0,lastSpoken='';
  let autoCenter=true,currentStops=[],lastGpsPoint=null,currentHeading=0,stopMarkers=[],progressIndex=0,lastRouteBuildAt=0;
  let legDurations=[],lastPunctuality='neutral';
  let routeSummary='';

  const PITCH=58,ZOOM=17.2,TOLERANCE_SECONDS=30;

  const panel=document.createElement('section');
  panel.id='routeMapNav';
  panel.hidden=true;

  panel.innerHTML=`
    <div style="position:fixed;inset:0;z-index:40000;background:#111;display:flex;flex-direction:column">

      <div style="display:flex;align-items:center;gap:8px;padding:8px 10px;background:#181818;border-bottom:2px solid #ccff33">
        <button id="routeMapClose" type="button" style="width:auto;min-width:84px">ZAKOŃCZ</button>
        <strong style="flex:1;text-align:center;color:#ccff33">NAWIGACJA</strong>
        <button id="routeMapCenter" type="button" style="width:auto;min-width:84px">NAWIGUJ</button>
      </div>

      <div style="background:#222;padding:10px 12px;border-bottom:1px solid #444">
        <div id="routeManeuver" style="font-size:22px;font-weight:900;line-height:1.15">
          Pobieranie trasy…
        </div>

        <div style="display:flex;justify-content:space-between;gap:12px;margin-top:5px">
          <span id="routeManeuverDistance" style="font-size:19px;font-weight:900;color:#ccff33"></span>
          <span id="routeNextStop" style="font-size:14px;color:#ddd;text-align:right"></span>
        </div>
      </div>

      <div id="routeMapCanvas" style="flex:1;min-height:0;overflow:hidden"></div>

      <div style="background:#181818;border-top:1px solid #333">
        <div
          id="routeMapStatus"
          style="padding:6px 12px 2px;color:#fff;font-weight:800;text-align:center"
        >
          Pobieranie pozycji…
        </div>

        <div
          id="routeGpsStatus"
          style="padding:1px 12px 6px;color:#aaa;font-size:11px;font-weight:700;text-align:center"
        ></div>
      </div>

    </div>
  `;

  document.body.append(panel);


  /* =========================================================
     GOOGLE / OSRM
     ========================================================= */

  const providerBadge=document.createElement('button');

  providerBadge.id='routeProviderBadge';
  providerBadge.type='button';
  providerBadge.textContent='GOOGLE';

  providerBadge.style.cssText=
    'position:absolute;top:54px;right:10px;z-index:50000;font-size:9px;font-weight:900;color:#7CFF7C;background:#0009;padding:3px 5px;border:0;border-radius:4px;cursor:pointer';

  panel.firstElementChild.appendChild(providerBadge);

  window.__routeMode=window.__routeMode||'google';

  function updateProviderBadge(){
    const mode=window.__routeMode||'google';

    providerBadge.textContent=
      mode==='osrm'?'OSRM':'GOOGLE';

    providerBadge.style.color=
      mode==='osrm'?'#FFD166':'#7CFF7C';
  }

  updateProviderBadge();


  const status=panel.querySelector('#routeMapStatus');
  const gpsStatus=panel.querySelector('#routeGpsStatus');
  const maneuverEl=panel.querySelector('#routeManeuver');
  const maneuverDistance=panel.querySelector('#routeManeuverDistance');
  const nextStopEl=panel.querySelector('#routeNextStop');


  providerBadge.onclick=async()=>{
    window.__routeMode=
      window.__routeMode==='osrm'
        ?'google'
        :'osrm';

    updateProviderBadge();

    if(positionMarker&&currentStops.length){

      const p=positionMarker.getLngLat();

      status.textContent=
        window.__routeMode==='osrm'
          ?'Przełączam na OSRM…'
          :'Przełączam na Google…';

      try{
        await buildRoute(
          [p.lat,p.lng],
          currentStops
        );

        updateProviderBadge();

      }catch(err){
        console.error(
          'Błąd przełączania nawigacji:',
          err
        );
      }
    }
  };


  panel.querySelector('#routeMapClose').onclick=closeMapNav;

  panel.querySelector('#routeMapCenter').onclick=()=>{
    autoCenter=true;

    if(positionMarker&&map){
      followCamera(
        [
          positionMarker.getLngLat().lat,
          positionMarker.getLngLat().lng
        ],
        currentHeading,
        true
      );
    }
  };


  function closeMapNav(){
    if(watchId!==null){
      navigator.geolocation.clearWatch(watchId);
      watchId=null;
    }

    panel.hidden=true;

    speechSynthesis?.cancel?.();

    lastGpsPoint=null;
    currentHeading=0;
    progressIndex=0;
  }


  function parseCoord(s){
    const m=String(s||'').match(
      /(-?\d+(?:\.\d+)?)\s*[,; ]\s*(-?\d+(?:\.\d+)?)/
    );

    return m?[+m[1],+m[2]]:null;
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


  function hav(a,b){
    const R=6371000;
    const p=Math.PI/180;

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
    const dLon=(b[1]-a[1])*p;

    const y=
      Math.sin(dLon)*
      Math.cos(lat2);

    const x=
      Math.cos(lat1)*
      Math.sin(lat2)-
      Math.sin(lat1)*
      Math.cos(lat2)*
      Math.cos(dLon);

    return(
      Math.atan2(y,x)*
      180/Math.PI+
      360
    )%360;
  }


  function smoothHeading(next){
    if(!Number.isFinite(next))
      return currentHeading;

    let d=
      ((next-currentHeading+540)%360)-180;

    currentHeading=
      (currentHeading+d*.28+360)%360;

    return currentHeading;
  }


  function headingFromPosition(p,ll){
    let h=Number(p.coords.heading);

    if(!Number.isFinite(h)||h<0){

      if(
        lastGpsPoint &&
        hav(lastGpsPoint,ll)>=3
      ){
        h=bearing(lastGpsPoint,ll);
      }else{
        h=currentHeading;
      }
    }

    if(
      !lastGpsPoint ||
      hav(lastGpsPoint,ll)>=2
    ){
      lastGpsPoint=ll;
    }

    return smoothHeading(h);
  }


  function followCamera(ll,heading,instant=false){
    if(!map||!autoCenter)return;

    const h=
      map.getContainer().clientHeight||600;

    map.easeTo({
      center:[ll[1],ll[0]],
      zoom:ZOOM,
      bearing:heading,
      pitch:PITCH,
      offset:[0,Math.round(h*.18)],
      duration:instant?0:420,
      essential:true
    });
  }


  function fmtClock(date){
    return(
      `${String(date.getHours()).padStart(2,'0')}:`+
      `${String(date.getMinutes()).padStart(2,'0')}`
    );
  }


  function parseTodayTime(t){
    const m=
      String(t||'')
        .trim()
        .match(/^(\d{1,2}):(\d{2})/);

    if(!m)return null;

    const d=new Date();

    d.setHours(
      +m[1],
      +m[2],
      0,
      0
    );

    return d;
  }


  function vehicleElement(){
    const el=document.createElement('div');

    el.style.cssText=
      'width:36px;height:36px;clip-path:polygon(50% 0,100% 100%,50% 78%,0 100%);background:#078df0;border:3px solid #fff;filter:drop-shadow(0 2px 5px #000b);transition:background .25s';

    return el;
  }


  function setVehicleStatus(kind){
    if(
      !positionEl ||
      kind===lastPunctuality
    )return;

    lastPunctuality=kind;

    positionEl.style.background=
      kind==='late'
        ?'#ff3b30'
        :kind==='early'
          ?'#ffd60a'
          :kind==='onTime'
            ?'#34c759'
            :'#078df0';
  }


  function stopElement(number,eta,isLast){
    const wrap=document.createElement('div');

    wrap.style.cssText=
      'display:flex;flex-direction:column;align-items:center;gap:2px;transform:translateY(-9px)';

    const badge=document.createElement('div');

    badge.className='navStopEta';

    badge.style.cssText=
      'padding:2px 5px;border-radius:6px;background:#111e;color:#fff;border:1px solid #fff9;font-size:11px;font-weight:900;white-space:nowrap';

    badge.textContent=eta||'--:--';

    const dot=document.createElement('div');

    dot.style.cssText=
      `width:28px;height:28px;border-radius:50%;background:${isLast?'#ffb000':'#078df0'};border:3px solid #fff;box-shadow:0 2px 8px #0009;display:flex;align-items:center;justify-content:center;color:#111;font-weight:900;font-size:11px`;

    dot.textContent=String(number);

    wrap.append(badge,dot);

    return wrap;
  }


  function instruction(step){
    const m=step?.maneuver||{};
    const type=m.type||'';
    const mod=m.modifier||'';
    const road=step.name?` w ${step.name}`:'';

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

    if(type==='depart')
      return dir?`Rusz ${dir}`:'Rusz prosto';

    if(type==='arrive')
      return'Dojeżdżasz do punktu';

    if(type==='roundabout'||type==='rotary')
      return`Wjedź na rondo${m.exit?` i wybierz ${m.exit}. zjazd`:''}`;

    if(type==='merge')
      return`Włącz się ${dir}`.trim();

    if(type==='fork')
      return`Na rozwidleniu trzymaj się ${dir}`.trim();

    if(type==='on ramp')
      return`Wjedź na zjazd ${dir}`.trim();

    if(type==='off ramp')
      return`Zjedź ${dir}`.trim();

    if(type==='end of road')
      return`Na końcu drogi skręć ${dir}${road}`.trim();

    if(type==='continue')
      return`Jedź ${dir||'prosto'}${road}`.trim();

    if(type==='turn'||type==='new name')
      return`Skręć ${dir}${road}`.trim();

    return`${dir?`Jedź ${dir}`:'Jedź prosto'}${road}`.trim();
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
    )return true;

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

    let bucket=
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


  function nearestRoutePoint(ll,start=0){
    if(!routeCoords.length)
      return{
        index:0,
        distance:Infinity
      };

    let best=
      Math.max(
        0,
        Math.min(
          start,
          routeCoords.length-1
        )
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

      if(
        i>best+500 &&
        bestD<25
      )break;
    }

    return{
      index:best,
      distance:bestD
    };
  }


  function mapStepsToProgress(){
    stepProgress=
      steps.map(s=>{
        const loc=s.maneuver?.location;

        if(!loc)return 0;

        const ll=[
          loc[1],
          loc[0]
        ];

        let best=0;
        let bestD=Infinity;

        for(
          let i=0;
          i<routeCoords.length;
          i++
        ){
          const d=
            hav(
              ll,
              routeCoords[i]
            );

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
      nearestRoutePoint(
        ll,
        progressIndex
      );

    if(
      snap.index>=
      progressIndex-15
    ){
      progressIndex=
        Math.max(
          progressIndex,
          snap.index
        );
    }

    let idx=
      stepProgress.findIndex(
        (p,i)=>
          p>=progressIndex+1 &&
          steps[i]?.maneuver?.type!=='depart'
      );

    if(idx<0)
      idx=Math.max(
        0,
        steps.length-1
      );

    const step=steps[idx];
    const loc=step?.maneuver?.location;

    const distance=
      loc
        ?hav(
            ll,
            [loc[1],loc[0]]
          )
        :0;

    return{
      step,
      distance,
      off:snap.distance
    };
  }


  function remainingStopsFromGps(){
    const rows=[
      ...body.querySelectorAll('tr')
    ];

    let idx=
      Number(
        body.dataset.gpsNextStop
      );

    if(
      !Number.isInteger(idx)||
      idx<0||
      idx>=rows.length
    ){
      const active=
        rows.findIndex(
          r=>
            r.classList.contains(
              'gpsNextStop'
            )
        );

      idx=active>=0?active:0;
    }

    return rows
      .slice(idx)
      .map((r,i)=>({
        coord:
          parseCoord(
            r.dataset.coordinate
          ),

        name:
          r.querySelector(
            'td:first-child'
          )?.innerText.trim()||
          `Punkt ${i+1}`,

        planTime:
          (
            r.children[1]
              ?.firstChild
              ?.textContent||
            r.children[1]
              ?.textContent||
            ''
          ).trim()
      }))
      .filter(x=>x.coord);
  }


  function updatePunctuality(){
    if(
      !currentStops.length||
      !legDurations.length
    ){
      setVehicleStatus('neutral');
      return;
    }

    const plan=
      parseTodayTime(
        currentStops[0].planTime
      );

    if(!plan){
      setVehicleStatus('neutral');
      return;
    }

    const predicted=
      new Date(
        Date.now()+
        legDurations[0]*1000
      );

    const diff=
      (predicted-plan)/1000;

    if(diff>TOLERANCE_SECONDS)
      setVehicleStatus('late');

    else if(diff<-TOLERANCE_SECONDS)
      setVehicleStatus('early');

    else
      setVehicleStatus('onTime');
  }


  /* =========================================================
     WAŻNA POPRAWKA:
     GPS ma osobny pasek i nie nadpisuje już podsumowania trasy.
     ========================================================= */

  function updateGuidance(ll){
    const g=
      nextStepByProgress(ll);

    if(!g.step)return;

    const text=
      instruction(g.step);

    maneuverEl.textContent=text;

    maneuverDistance.textContent=
      fmtDistance(g.distance);

    speak(
      g.step,
      text,
      g.distance
    );

    if(currentStops.length){

      const eta=
        legDurations.length
          ?fmtClock(
              new Date(
                Date.now()+
                legDurations[0]*1000
              )
            )
          :'';

      nextStopEl.textContent=
        `Następny: ${currentStops[0].name}`+
        `${eta?` • ${eta}`:''}`;
    }

    updatePunctuality();

    if(g.off>65){

      gpsStatus.textContent=
        'Poza trasą — przeliczam…';

    }else{

      gpsStatus.textContent=
        `GPS ±${Math.round(window.__navAcc||0)} m`;
    }

    /*
     * Nie zmieniamy tutaj routeMapStatus.
     * Dzięki temu napis:
     * "Trasa 39 km • 50 min"
     * nie znika przy każdym odczycie GPS.
     */

    if(
      g.off>65 &&
      !rerouteTimer &&
      Date.now()-lastRouteBuildAt>3000
    ){
      rerouteTimer=
        setTimeout(()=>{
          rerouteTimer=0;

          const remaining=
            remainingStopsFromGps();

          if(remaining.length){
            currentStops=remaining;
            buildRoute(
              ll,
              currentStops
            );
          }

        },1400);
    }
  }


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


  function refreshStopMarkers(stops,legs){
    stopMarkers.forEach(
      m=>m.remove()
    );

    stopMarkers=[];

    let elapsed=0;

    stops.forEach((s,i)=>{

      elapsed+=
        legs[i]?.duration||0;

      const eta=
        fmtClock(
          new Date(
            Date.now()+
            elapsed*1000
          )
        );

      const marker=
        new maplibregl.Marker({
          element:
            stopElement(
              i+1,
              eta,
              i===stops.length-1
            ),
          anchor:'bottom'
        })
        .setLngLat([
          s.coord[1],
          s.coord[0]
        ])
        .setPopup(
          new maplibregl.Popup({
            offset:22
          }).setHTML(
            `<strong>${s.name}</strong><br>`+
            `Przewidywany przyjazd: ${eta}`+
            `${s.planTime?`<br>Plan: ${s.planTime}`:''}`
          )
        )
        .addTo(map);

      stopMarkers.push(marker);
    });
  }


  async function buildRoute(origin,stops){
    if(!stops.length)return;

    lastRouteBuildAt=Date.now();

    const coords=
      [origin,...stops.map(s=>s.coord)]
        .map(
          ([lat,lng])=>
            `${lng},${lat}`
        )
        .join(';');

    status.textContent=
      'Pobieranie przebiegu trasy…';

    gpsStatus.textContent='';

    const res=
      await fetch(
        `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson&steps=true&annotations=duration,distance`,
        {
          cache:'no-store'
        }
      );

    if(!res.ok)
      throw Error(
        `HTTP ${res.status}`
      );

    const data=await res.json();
    const route=data.routes?.[0];

    if(!route)
      throw Error(
        'Nie znaleziono trasy.'
      );

    const geo=
      routeGeoJSON(
        route.geometry.coordinates
      );

    routeCoords=
      (
        route.geometry?.coordinates||
        []
      ).map(
        ([lng,lat])=>[lat,lng]
      );

    steps=
      (route.legs||[])
        .flatMap(
          l=>l.steps||[]
        );

    legDurations=
      (route.legs||[])
        .map(
          l=>l.duration||0
        );

    progressIndex=0;

    mapStepsToProgress();

    if(map.getSource('route')){

      map
        .getSource('route')
        .setData(geo);

    }else{

      map.addSource(
        'route',
        {
          type:'geojson',
          data:geo
        }
      );

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

    updatePunctuality();

    routeSummary=
      `Trasa ${fmtDistance(route.distance)} • ${Math.round(route.duration/60)} min`;

    status.textContent=
      routeSummary;
  }


  function clearMarkers(){
    if(positionMarker){
      positionMarker.remove();
      positionMarker=null;
      positionEl=null;
    }

    stopMarkers.forEach(
      m=>m.remove()
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

    const stops=
      remainingStopsFromGps();

    if(!stops.length){
      alert(
        'Brak pozostałych punktów trasy.'
      );
      return;
    }

    if(!navigator.geolocation){
      alert(
        'Telefon nie udostępnia lokalizacji.'
      );
      return;
    }

    currentStops=stops;

    panel.hidden=false;

    status.textContent=
      'Pobieranie pozycji telefonu…';

    gpsStatus.textContent='';

    maneuverEl.textContent=
      'Pobieranie trasy…';

    maneuverDistance.textContent='';
    nextStopEl.textContent='';

    autoCenter=true;
    lastSpoken='';
    lastGpsPoint=null;
    currentHeading=0;
    progressIndex=0;

    try{

      const pos=await posOnce();

      const origin=[
        pos.coords.latitude,
        pos.coords.longitude
      ];

      window.__navAcc=
        pos.coords.accuracy||0;

      if(!map){

        map=
          new maplibregl.Map({
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
                  attribution:
                    '© OpenStreetMap contributors'
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

        map.on(
          'dragstart',
          e=>{
            if(e.originalEvent)
              autoCenter=false;
          }
        );

        await new Promise(
          resolve=>
            map.loaded()
              ?resolve()
              :map.once(
                  'load',
                  resolve
                )
        );

      }else{

        map.resize();

        if(map.getSource('route')){
          map
            .getSource('route')
            .setData(
              routeGeoJSON([])
            );
        }
      }

      clearMarkers();

      positionEl=
        vehicleElement();

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

      await buildRoute(
        origin,
        stops
      );

      updateGuidance(origin);

      followCamera(
        origin,
        0,
        true
      );

      if(watchId!==null)
        navigator.geolocation.clearWatch(
          watchId
        );

      watchId=
        navigator.geolocation.watchPosition(

          p=>{
            const ll=[
              p.coords.latitude,
              p.coords.longitude
            ];

            window.__navAcc=
              p.coords.accuracy||0;

            if(positionMarker){
              positionMarker.setLngLat([
                ll[1],
                ll[0]
              ]);
            }

            const h=
              headingFromPosition(
                p,
                ll
              );

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
          },

          {
            enableHighAccuracy:true,
            maximumAge:500,
            timeout:15000
          }
        );

    }catch(e){

      status.textContent=
        `Nie udało się uruchomić nawigacji: ${e.message||'błąd'}`;

      gpsStatus.textContent='';
    }
  }


  function rebuildForRemaining(){
    if(panel.hidden)return;

    const remaining=
      remainingStopsFromGps();

    if(!remaining.length)return;

    currentStops=remaining;

    if(lastGpsPoint){

      clearTimeout(
        rerouteTimer
      );

      rerouteTimer=
        setTimeout(()=>{
          rerouteTimer=0;

          buildRoute(
            lastGpsPoint,
            currentStops
          );

        },300);
    }
  }


  body.addEventListener(
    'gps-next-stop-change',
    rebuildForRemaining
  );

  body.addEventListener(
    'route-direction-change',
    rebuildForRemaining
  );


  document.addEventListener(
    'click',
    e=>{
      const link=
        e.target.closest?.(
          '.routeLink'
        );

      if(
        !link ||
        !body.contains(link)
      )return;

      e.preventDefault();
      e.stopImmediatePropagation();

      openMapNav();

    },
    true
  );

})();
