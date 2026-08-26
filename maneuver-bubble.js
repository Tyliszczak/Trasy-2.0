(()=>{
  const gps=window.__trasyGps;
  const maneuver=document.getElementById('routeManeuver');
  const distance=document.getElementById('routeManeuverDistance');
  if(!maneuver||!distance)return;

  const infoPanel=maneuver.parentElement;
  const infoRow=distance.parentElement;

  const bubble=document.createElement('div');
  bubble.id='routeManeuverBubble';
  bubble.setAttribute('role','status');
  bubble.setAttribute('aria-live','polite');
  bubble.style.cssText=`
    width:min(72vw,310px);
    max-width:310px;
    padding:8px 11px 7px;
    border:1px solid #777;
    border-radius:11px;
    background:#141414ee;
    color:#fff;
    box-shadow:0 4px 14px #000b;
    text-align:center;
    pointer-events:none;
    user-select:none;
  `;

  maneuver.style.cssText=`
    margin:0;
    color:#fff;
    font-size:16px;
    font-weight:900;
    line-height:1.15;
    text-align:center;
    overflow-wrap:anywhere;
  `;
  distance.style.cssText=`
    display:block;
    margin-top:3px;
    color:#ccff33;
    font-size:14px;
    font-weight:1000;
    line-height:1.1;
    text-align:center;
  `;

  bubble.append(maneuver,distance);

  // Po przeniesieniu manewru górna belka zawiera tylko informację
  // o następnym przystanku i nie zmienia wysokości wraz z instrukcjami.
  if(infoPanel){
    infoPanel.style.padding='7px 12px';
    infoPanel.style.minHeight='0';
  }
  if(infoRow){
    infoRow.style.marginTop='0';
    infoRow.style.justifyContent='flex-start';
    infoRow.style.alignItems='center';
  }

  let map=null;
  let marker=null;
  let lastLngLat=null;

  function hasMessage(){
    return Boolean(String(maneuver.textContent||'').trim()||String(distance.textContent||'').trim());
  }

  function syncVisibility(){
    bubble.style.visibility=hasMessage()?'visible':'hidden';
  }

  new MutationObserver(syncVisibility).observe(bubble,{childList:true,characterData:true,subtree:true});
  syncVisibility();

  function attach(nextMap){
    if(!nextMap||!window.maplibregl?.Marker)return;
    if(marker)marker.remove();
    map=nextMap;
    marker=new maplibregl.Marker({
      element:bubble,
      anchor:'top',
      offset:[0,27],
      rotationAlignment:'viewport',
      pitchAlignment:'viewport',
      subpixelPositioning:true
    });
    if(lastLngLat)marker.setLngLat(lastLngLat).addTo(map);
  }

  function updatePosition(position){
    const lat=Number(position?.coords?.latitude);
    const lng=Number(position?.coords?.longitude);
    if(!Number.isFinite(lat)||!Number.isFinite(lng))return;
    lastLngLat=[lng,lat];
    if(marker){
      marker.setLngLat(lastLngLat);
      if(!marker.getElement()?.parentNode&&map)marker.addTo(map);
    }
  }

  document.addEventListener('trasy:route-map-ready',event=>attach(event.detail?.map));
  if(gps?.subscribe)gps.subscribe(updatePosition,()=>{});
  const current=gps?.current?.();
  if(current)updatePosition(current);
})();
