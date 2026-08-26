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


  bubble.append(maneuver,distance);
  document.body.appendChild(bubble);

  // Górna belka zawiera wyłącznie informację o następnym przystanku.
  infoPanel?.classList.add('routeNavInfoShell');
  infoRow?.classList.add('routeNavInfoRow');

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
