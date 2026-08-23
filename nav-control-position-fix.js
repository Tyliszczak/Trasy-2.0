(()=>{
  const infoPanel=document.getElementById('routeManeuver')?.parentElement;
  const back=document.getElementById('routeMapClose');
  const center=document.getElementById('routeMapCenter');
  const voice=document.getElementById('routeVoiceToggle');
  if(!infoPanel||!back)return;

  function reposition(){
    const rect=infoPanel.getBoundingClientRect();
    const top=Math.max(10,Math.ceil(rect.bottom)+10);
    back.style.top=`${top}px`;
    if(center)center.style.top=`${top}px`;
    if(voice)voice.style.top=`${top+50}px`;
  }

  if('ResizeObserver'in window){
    const observer=new ResizeObserver(reposition);
    observer.observe(infoPanel);
  }
  window.addEventListener('resize',reposition,{passive:true});
  document.addEventListener('trasy:route-map-ready',reposition);
  requestAnimationFrame(reposition);
  setTimeout(reposition,0);
})();
