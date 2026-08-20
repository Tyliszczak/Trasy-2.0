(()=>{
  const body=document.getElementById('scheduleBody');
  if(!body)return;

  body.addEventListener('route-direction-change',e=>{
    if(e.detail?.direction!=='return')return;

    // Godzina START pozostaje informacją w nagłówku, ale nie blokuje logiki GPS.
    body.dataset.returnOriginActive='';

    // Usuń godzinę przypisaną do pierwszego wiersza powrotu, żeby tracker
    // nie chronił go sztywno do czasu planowanego odjazdu.
    const first=[...body.querySelectorAll('tr')].find(r=>r.dataset.coordinate);
    if(first?.children?.[1]) first.children[1].textContent='';

    // Pozwól trackerowi GPS od razu wybrać właściwy punkt według pozycji,
    // kierunku jazdy i odległości.
    delete body.dataset.gpsNextStop;
    body.querySelectorAll('tr').forEach(r=>{
      r.classList.remove('gpsNextStop','isActiveStop');
    });
  });
})();
