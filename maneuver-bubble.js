(()=>{
  const maneuver=document.getElementById('routeManeuver');
  const distance=document.getElementById('routeManeuverDistance');
  const panel=document.getElementById('routeMapNav');
  if(!maneuver||!distance||!panel)return;

  const infoPanel=maneuver.parentElement;
  const infoRow=distance.parentElement;

  const bubble=document.createElement('div');
  bubble.id='routeManeuverBubble';
  bubble.setAttribute('role','status');
  bubble.setAttribute('aria-live','polite');
  bubble.style.cssText=`
    position:fixed;
    left:50%;
    top:73dvh;
    z-index:40050;
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
    transform:translateX(-50%);
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
  document.body.appendChild(bubble);

  // Górna belka zawiera wyłącznie informację o następnym przystanku.
  if(infoPanel){
    infoPanel.style.padding='7px 12px';
    infoPanel.style.minHeight='0';
  }
  if(infoRow){
    infoRow.style.marginTop='0';
    infoRow.style.justifyContent='flex-start';
    infoRow.style.alignItems='center';
  }

  function hasMessage(){
    return Boolean(String(maneuver.textContent||'').trim()||String(distance.textContent||'').trim());
  }

  function syncVisibility(){
    bubble.style.visibility=!panel.hidden&&hasMessage()?'visible':'hidden';
  }

  // Dymek jest elementem okna, nie mapy. Nie śledzi GPS, markera, zoomu,
  // obrotu ani pitchu; jego pozycja ekranowa jest zawsze taka sama.
  new MutationObserver(syncVisibility).observe(bubble,{childList:true,characterData:true,subtree:true});
  new MutationObserver(syncVisibility).observe(panel,{attributes:true,attributeFilter:['hidden']});
  document.addEventListener('visibilitychange',syncVisibility);

  syncVisibility();
})();
