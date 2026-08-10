(()=>{
  const body=document.getElementById('scheduleBody');
  if(!body)return;
  let map=null,routeLayer=null,positionMarker=null,watchId=null,currentStartIndex=0;
  const panel=document.createElement('section');
  panel.id='routeMapNav';
  panel.hidden=true;
  panel.innerHTML=`<div style="position:fixed;inset:0;z-index:40000;background:#111;display:flex;flex-direction:column">
    <div style="display:flex;align-items:center;gap:10px;padding:10px;background:#181818;border-bottom:2px solid #ccff33">
      <button id="routeMapClose" type="button" style="width:auto;min-width:92px">ZAKOŃCZ</button>
      <strong style="flex:1;text-align:center;color:#ccff33">NAWIGACJA</strong>
      <span id="routeMapInfo" style="min-width:92px;text-align:right;font-weight:800;color:#fff"></span>
    </div>
    <div id="routeMapCanvas" style="flex:1;min-height:0"></div>
    <div id="routeMapStatus" style="padding:10px 12px;background:#181818;color:#fff;font-weight:800;text-align:center">Pobieranie pozycji…</div>
  </div>`;
  document.body.append(panel);
  const status=panel.querySelector('#routeMapStatus'),info=panel.querySelector('#routeMapInfo');
  panel.querySelector('#routeMapClose').onclick=closeMapNav;

  function closeMapNav(){
    if(watchId!==null){navigator.geolocation.clearWatch(watchId);watchId=null}
    panel.hidden=true;
  }
  function parseCoord(s){const m=String(s||'').match(/(-?\d+(?:\.\d+)?)\s*[,; ]\s*(-?\d+(?:\.\d+)?)/);return m?[+m[1],+m[2]]:null}
  function posOnce(){return new Promise((resolve,reject)=>navigator.geolocation.getCurrentPosition(resolve,reject,{enableHighAccuracy:true,timeout:12000,maximumAge:3000}))}
  function fmtDistance(m){return m<950?`${Math.round(m/10)*10} m`:`${(m/1000).toFixed(m<10000?1:0)} km`}
  function makeStopIcon(text,color){return L.divIcon({className:'',html:`<div style="width:26px;height:26px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:${color};border:2px solid #fff;box-shadow:0 1px 5px #0008"><span style="display:block;transform:rotate(45deg);font-size:10px;font-weight:900;text-align:center;line-height:22px;color:#111">${text}</span></div>`,iconSize:[26,26],iconAnchor:[13,25]})}

  async function openMapNav(startIndex){
    if(!window.L){alert('Mapa nie została załadowana. Sprawdź połączenie z internetem.');return}
    const rows=[...body.querySelectorAll('tr')];
    const stops=rows.slice(startIndex).map((r,i)=>({coord:parseCoord(r.dataset.coordinate),name:r.querySelector('td:first-child')?.innerText.trim()||`Punkt ${i+1}`})).filter(x=>x.coord);
    if(!stops.length){alert('Brak współrzędnych dla wybranego odcinka trasy.');return}
    if(!navigator.geolocation){alert('Telefon nie udostępnia lokalizacji.');return}
    currentStartIndex=startIndex;panel.hidden=false;status.textContent='Pobieranie pozycji telefonu…';info.textContent='';
    try{
      const pos=await posOnce();
      const origin=[pos.coords.latitude,pos.coords.longitude];
      if(!map){map=L.map('routeMapCanvas',{zoomControl:true,preferCanvas:true});L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap'}).addTo(map)}
      if(routeLayer){routeLayer.remove();routeLayer=null}
      map.eachLayer(layer=>{if(layer instanceof L.Marker)map.removeLayer(layer)});
      const all=[origin,...stops.map(s=>s.coord)];
      const coords=all.map(([lat,lng])=>`${lng},${lat}`).join(';');
      status.textContent='Pobieranie przebiegu trasy…';
      const res=await fetch(`https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson&steps=false`,{cache:'no-store'});
      if(!res.ok)throw Error(`HTTP ${res.status}`);
      const data=await res.json(),route=data.routes?.[0];
      if(!route)throw Error('Nie znaleziono trasy.');
      routeLayer=L.geoJSON(route.geometry,{style:{weight:7,opacity:.9}}).addTo(map);
      positionMarker=L.marker(origin,{icon:makeStopIcon('JA','#ccff33')}).addTo(map).bindPopup('Twoja pozycja');
      stops.forEach((s,i)=>L.marker(s.coord,{icon:makeStopIcon(String(i+1),i===stops.length-1?'#ffb000':'#078df0')}).addTo(map).bindPopup(s.name));
      map.fitBounds(routeLayer.getBounds(),{padding:[28,28]});
      info.textContent=fmtDistance(route.distance);
      status.textContent=`Start: Twoja pozycja • przez ${stops.length>1?stops.length-1:0} punktów • cel: ${stops.at(-1).name}`;
      if(watchId!==null)navigator.geolocation.clearWatch(watchId);
      watchId=navigator.geolocation.watchPosition(p=>{
        const ll=[p.coords.latitude,p.coords.longitude];
        if(positionMarker)positionMarker.setLatLng(ll);
      },()=>{}, {enableHighAccuracy:true,maximumAge:1500,timeout:15000});
    }catch(e){status.textContent=`Nie udało się uruchomić mapy: ${e.message||'błąd'}`}
  }

  document.addEventListener('click',e=>{
    const link=e.target.closest?.('.routeLink');
    if(!link||!body.contains(link))return;
    e.preventDefault();e.stopImmediatePropagation();
    const row=link.closest('tr'),rows=[...body.querySelectorAll('tr')],index=rows.indexOf(row);
    if(index>=0)openMapNav(index);
  },true);
})();