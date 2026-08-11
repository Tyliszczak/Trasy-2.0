(()=>{
  const body=document.getElementById('scheduleBody');
  if(!body)return;
  let map=null,routeLayer=null,positionMarker=null,watchId=null,steps=[],routeCoords=[],rerouteTimer=0,lastSpoken='';
  let autoCenter=true,currentStops=[];
  const panel=document.createElement('section');
  panel.id='routeMapNav';panel.hidden=true;
  panel.innerHTML=`<div style="position:fixed;inset:0;z-index:40000;background:#111;display:flex;flex-direction:column">
    <div style="display:flex;align-items:center;gap:8px;padding:8px 10px;background:#181818;border-bottom:2px solid #ccff33">
      <button id="routeMapClose" type="button" style="width:auto;min-width:84px">ZAKOŃCZ</button>
      <strong style="flex:1;text-align:center;color:#ccff33">NAWIGACJA</strong>
      <button id="routeMapCenter" type="button" style="width:auto;min-width:84px">CENTRUJ</button>
    </div>
    <div style="background:#222;padding:10px 12px;border-bottom:1px solid #444">
      <div id="routeManeuver" style="font-size:22px;font-weight:900;line-height:1.15">Pobieranie trasy…</div>
      <div style="display:flex;justify-content:space-between;gap:12px;margin-top:5px"><span id="routeManeuverDistance" style="font-size:19px;font-weight:900;color:#ccff33"></span><span id="routeNextStop" style="font-size:14px;color:#ddd;text-align:right"></span></div>
    </div>
    <div id="routeMapCanvas" style="flex:1;min-height:0"></div>
    <div id="routeMapStatus" style="padding:8px 12px;background:#181818;color:#fff;font-weight:800;text-align:center">Pobieranie pozycji…</div>
  </div>`;
  document.body.append(panel);
  const status=panel.querySelector('#routeMapStatus'),maneuverEl=panel.querySelector('#routeManeuver'),maneuverDistance=panel.querySelector('#routeManeuverDistance'),nextStopEl=panel.querySelector('#routeNextStop');
  panel.querySelector('#routeMapClose').onclick=closeMapNav;
  panel.querySelector('#routeMapCenter').onclick=()=>{autoCenter=true;if(positionMarker&&map){map.setView(positionMarker.getLatLng(),17)}};

  function closeMapNav(){if(watchId!==null){navigator.geolocation.clearWatch(watchId);watchId=null}panel.hidden=true;speechSynthesis?.cancel?.()}
  function parseCoord(s){const m=String(s||'').match(/(-?\d+(?:\.\d+)?)\s*[,; ]\s*(-?\d+(?:\.\d+)?)/);return m?[+m[1],+m[2]]:null}
  function posOnce(){return new Promise((resolve,reject)=>navigator.geolocation.getCurrentPosition(resolve,reject,{enableHighAccuracy:true,timeout:12000,maximumAge:3000}))}
  function fmtDistance(m){return m<950?`${Math.max(10,Math.round(m/10)*10)} m`:`${(m/1000).toFixed(m<10000?1:0)} km`}
  function makeStopIcon(text,color){return L.divIcon({className:'',html:`<div style="width:26px;height:26px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:${color};border:2px solid #fff;box-shadow:0 1px 5px #0008"><span style="display:block;transform:rotate(45deg);font-size:10px;font-weight:900;text-align:center;line-height:22px;color:#111">${text}</span></div>`,iconSize:[26,26],iconAnchor:[13,25]})}
  function hav(a,b){const R=6371000,p=Math.PI/180,dLat=(b[0]-a[0])*p,dLon=(b[1]-a[1])*p,x=Math.sin(dLat/2)**2+Math.cos(a[0]*p)*Math.cos(b[0]*p)*Math.sin(dLon/2)**2;return 2*R*Math.asin(Math.sqrt(x))}
  function instruction(step){
    const m=step?.maneuver||{},type=m.type||'',mod=m.modifier||'',road=step.name?` w ${step.name}`:'';
    const dir={left:'w lewo',right:'w prawo','slight left':'lekko w lewo','slight right':'lekko w prawo','sharp left':'ostro w lewo','sharp right':'ostro w prawo',straight:'prosto',uturn:'zawróć'}[mod]||'';
    if(type==='depart')return dir?`Rusz ${dir}`:'Rusz prosto';
    if(type==='arrive')return 'Dojeżdżasz do punktu';
    if(type==='roundabout'||type==='rotary')return `Wjedź na rondo${m.exit?` i wybierz ${m.exit}. zjazd`:''}`;
    if(type==='merge')return `Włącz się ${dir}`.trim();
    if(type==='fork')return `Na rozwidleniu trzymaj się ${dir}`.trim();
    if(type==='on ramp')return `Wjedź na zjazd ${dir}`.trim();
    if(type==='off ramp')return `Zjedź ${dir}`.trim();
    if(type==='end of road')return `Na końcu drogi skręć ${dir}${road}`.trim();
    if(type==='continue')return `Jedź ${dir||'prosto'}${road}`.trim();
    if(type==='turn'||type==='new name')return `Skręć ${dir}${road}`.trim();
    return `${dir?`Jedź ${dir}`:'Jedź prosto'}${road}`.trim();
  }
  function nearestStep(ll){
    let best=null,bestD=Infinity;
    for(const s of steps){const loc=s.maneuver?.location;if(!loc)continue;const d=hav(ll,[loc[1],loc[0]]);if(d<bestD){bestD=d;best=s}}
    return {step:best,distance:bestD};
  }
  function nearestRouteDistance(ll){let best=Infinity;for(let i=0;i<routeCoords.length;i+=Math.max(1,Math.floor(routeCoords.length/500))){best=Math.min(best,hav(ll,routeCoords[i]))}return best}
  function speak(text,d){
    let bucket=d<70?'now':d<220?'200':d<550?'500':'';if(!bucket)return;const key=text+'|'+bucket;if(key===lastSpoken)return;lastSpoken=key;
    try{speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(bucket==='now'?text:`Za ${bucket==='200'?'200':'500'} metrów. ${text}`);u.lang='pl-PL';speechSynthesis.speak(u)}catch{}
  }
  function updateGuidance(ll){
    const {step,distance}=nearestStep(ll);if(!step)return;
    const text=instruction(step);maneuverEl.textContent=text;maneuverDistance.textContent=fmtDistance(distance);speak(text,distance);
    if(currentStops.length){let best=currentStops[0],d=hav(ll,best.coord);for(const s of currentStops){const x=hav(ll,s.coord);if(x<d){best=s;d=x}}nextStopEl.textContent=`Najbliższy punkt: ${best.name}`}
    const off=nearestRouteDistance(ll);status.textContent=off>80?'Poza trasą — przeliczam…':`Na trasie • dokładność GPS ${Math.round(window.__navAcc||0)} m`;
    if(off>80&&!rerouteTimer){rerouteTimer=setTimeout(()=>{rerouteTimer=0;buildRoute(ll,currentStops)},1800)}
  }
  async function buildRoute(origin,stops){
    if(routeLayer){routeLayer.remove();routeLayer=null}
    const coords=[origin,...stops.map(s=>s.coord)].map(([lat,lng])=>`${lng},${lat}`).join(';');status.textContent='Pobieranie przebiegu trasy…';
    const res=await fetch(`https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson&steps=true`,{cache:'no-store'});if(!res.ok)throw Error(`HTTP ${res.status}`);
    const data=await res.json(),route=data.routes?.[0];if(!route)throw Error('Nie znaleziono trasy.');
    routeLayer=L.geoJSON(route.geometry,{style:{weight:7,opacity:.9}}).addTo(map);routeCoords=(route.geometry?.coordinates||[]).map(([lng,lat])=>[lat,lng]);steps=(route.legs||[]).flatMap(l=>l.steps||[]);
    if(autoCenter)map.fitBounds(routeLayer.getBounds(),{padding:[28,28]});
    status.textContent=`Trasa ${fmtDistance(route.distance)} • ${Math.round(route.duration/60)} min`;
  }
  async function openMapNav(startIndex){
    if(!window.L){alert('Mapa nie została załadowana. Sprawdź połączenie z internetem.');return}
    const rows=[...body.querySelectorAll('tr')];
    const stops=rows.slice(startIndex).map((r,i)=>({coord:parseCoord(r.dataset.coordinate),name:r.querySelector('td:first-child')?.innerText.trim()||`Punkt ${i+1}`})).filter(x=>x.coord);
    if(!stops.length){alert('Brak współrzędnych dla wybranego odcinka trasy.');return}if(!navigator.geolocation){alert('Telefon nie udostępnia lokalizacji.');return}
    currentStops=stops;panel.hidden=false;status.textContent='Pobieranie pozycji telefonu…';maneuverEl.textContent='Pobieranie trasy…';maneuverDistance.textContent='';nextStopEl.textContent='';autoCenter=true;lastSpoken='';
    try{
      const pos=await posOnce(),origin=[pos.coords.latitude,pos.coords.longitude];window.__navAcc=pos.coords.accuracy||0;
      if(!map){map=L.map('routeMapCanvas',{zoomControl:true,preferCanvas:true});L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap'}).addTo(map);map.on('dragstart zoomstart',()=>{autoCenter=false})}
      map.eachLayer(layer=>{if(layer instanceof L.Marker)map.removeLayer(layer)});
      positionMarker=L.marker(origin,{icon:makeStopIcon('JA','#ccff33')}).addTo(map).bindPopup('Twoja pozycja');
      stops.forEach((s,i)=>L.marker(s.coord,{icon:makeStopIcon(String(i+1),i===stops.length-1?'#ffb000':'#078df0')}).addTo(map).bindPopup(s.name));
      await buildRoute(origin,stops);updateGuidance(origin);
      if(watchId!==null)navigator.geolocation.clearWatch(watchId);
      watchId=navigator.geolocation.watchPosition(p=>{const ll=[p.coords.latitude,p.coords.longitude];window.__navAcc=p.coords.accuracy||0;if(positionMarker)positionMarker.setLatLng(ll);if(autoCenter&&map)map.setView(ll,17);updateGuidance(ll)},e=>{status.textContent='Brak aktualnej pozycji GPS.'},{enableHighAccuracy:true,maximumAge:1000,timeout:15000});
    }catch(e){status.textContent=`Nie udało się uruchomić nawigacji: ${e.message||'błąd'}`}
  }
  document.addEventListener('click',e=>{const link=e.target.closest?.('.routeLink');if(!link||!body.contains(link))return;e.preventDefault();e.stopImmediatePropagation();const row=link.closest('tr'),rows=[...body.querySelectorAll('tr')],index=rows.indexOf(row);if(index>=0)openMapNav(index)},true);
})();