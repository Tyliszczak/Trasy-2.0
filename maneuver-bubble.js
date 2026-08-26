(()=>{
  const maneuver=document.getElementById('routeManeuver');
  const distance=document.getElementById('routeManeuverDistance');
  const canvas=document.getElementById('routeMapCanvas');
  if(!maneuver||!distance||!canvas)return;

  const infoPanel=maneuver.parentElement;
  const infoRow=distance.parentElement;

  const bubble=document.createElement('div');
  bubble.id='routeManeuverBubble';
  bubble.setAttribute('role','status');
  bubble.setAttribute('aria-live','polite');
  bubble.style.cssText=`
    position:absolute;
    left:0;
    top:0;
    z-index:18;
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
    will-change:transform;
    transform:translate3d(-9999px,-9999px,0);
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

  if(getComputedStyle(canvas).position==='static')canvas.style.position='relative';

  let raf=0;
  let attached=false;
  let vehicleEl=null;

  function hasMessage(){
    return Boolean(String(maneuver.textContent||'').trim()||String(distance.textContent||'').trim());
  }

  function syncVisibility(){
    bubble.style.visibility=hasMessage()?'visible':'hidden';
  }

  function findVehicleElement(){
    if(vehicleEl?.isConnected)return vehicleEl;
    vehicleEl=[...canvas.querySelectorAll('.maplibregl-marker')].find(el=>{
      const clip=String(el.style.clipPath||el.style.webkitClipPath||'');
      return clip.includes('polygon')&&el.style.width==='36px'&&el.style.height==='36px';
    })||null;
    return vehicleEl;
  }

  function positionBubble(){
    raf=0;
    if(!attached||!bubble.isConnected)return;
    const vehicle=findVehicleElement();
    if(!vehicle){
      bubble.style.transform='translate3d(-9999px,-9999px,0)';
      schedulePosition();
      return;
    }

    const vehicleRect=vehicle.getBoundingClientRect();
    const canvasRect=canvas.getBoundingClientRect();
    if(!vehicleRect.width||!vehicleRect.height||!canvasRect.width||!canvasRect.height){
      schedulePosition();
      return;
    }

    // Dymek jest pozycjonowany względem faktycznie narysowanej strzałki,
    // a nie jako drugi marker GPS. Stały odstęp 8 px eliminuje pływanie góra-dół.
    const x=Math.round(vehicleRect.left+vehicleRect.width/2-canvasRect.left);
    const y=Math.round(vehicleRect.bottom-canvasRect.top+8);
    bubble.style.transform=`translate3d(${x}px,${y}px,0) translateX(-50%)`;
    schedulePosition();
  }

  function schedulePosition(){
    if(!raf)raf=requestAnimationFrame(positionBubble);
  }

  function attach(){
    if(!bubble.isConnected)canvas.appendChild(bubble);
    attached=true;
    vehicleEl=null;
    syncVisibility();
    schedulePosition();
  }

  new MutationObserver(()=>{
    vehicleEl=null;
    syncVisibility();
    schedulePosition();
  }).observe(canvas,{childList:true,subtree:true});
  new MutationObserver(syncVisibility).observe(bubble,{childList:true,characterData:true,subtree:true});

  document.addEventListener('trasy:route-map-ready',attach);
  document.addEventListener('visibilitychange',()=>{
    if(document.visibilityState==='visible')schedulePosition();
  });
  window.addEventListener('resize',schedulePosition);

  syncVisibility();
  if(window.__routeMap)attach();
})();
