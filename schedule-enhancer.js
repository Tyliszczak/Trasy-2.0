(()=>{
  const scheduleBody=document.getElementById('scheduleBody');
  const scheduleClock=document.getElementById('scheduleClock');
  const scheduleTimeSelect=document.getElementById('scheduleTimeSelect');
  function renderClock(){if(!scheduleClock)return;const n=new Date();scheduleClock.textContent=`${String(n.getHours()).padStart(2,'0')}:${String(n.getMinutes()).padStart(2,'0')}:${String(n.getSeconds()).padStart(2,'0')}`}
  if(scheduleClock){new MutationObserver(()=>{if(!/^\d{2}:\d{2}:\d{2}$/.test(scheduleClock.textContent.trim()))renderClock()}).observe(scheduleClock,{childList:true,characterData:true,subtree:true});renderClock();setInterval(renderClock,1000)}
  if(scheduleTimeSelect){scheduleTimeSelect.setAttribute('title','Wybierz godzinę kursu');scheduleTimeSelect.addEventListener('change',()=>scheduleTimeSelect.blur())}
  if(!scheduleBody)return;
  function minutes(v){const m=String(v||'').match(/^(\d{1,2}):(\d{2})$/);return m?+m[1]*60+ +m[2]:null}
  function stopMarkerIcon(){const ns='http://www.w3.org/2000/svg',s=document.createElementNS(ns,'svg');s.setAttribute('viewBox','0 0 24 30');s.setAttribute('aria-hidden','true');s.classList.add('stopMapPin');s.innerHTML='<path d="M12 1.5C6.5 1.5 2 6 2 11.5c0 7.1 10 17 10 17s10-9.9 10-17C22 6 17.5 1.5 12 1.5Z" fill="#078df0"/><circle cx="12" cy="11.5" r="3.6" fill="#202020"/>';return s}
  function routeIcon(){const ns='http://www.w3.org/2000/svg',s=document.createElementNS(ns,'svg');s.setAttribute('viewBox','0 0 44 44');s.setAttribute('aria-hidden','true');s.innerHTML='<path d="M8 8c0-4 3.2-7 7-7s7 3 7 7c0 5-7 12-7 12S8 13 8 8Z" fill="currentColor"/><circle cx="15" cy="8" r="2.5" fill="#222"/><path d="M17 20c10 0 15 1 15 6 0 4-5 4-10 4-6 0-8 2-8 5" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M7 35c0-4 3-7 7-7s7 3 7 7c0 5-7 9-7 9s-7-4-7-9Z" fill="currentColor"/><circle cx="14" cy="35" r="2.5" fill="#222"/>';return s}
  function coordinateFromMapLink(a){if(!a)return null;try{return new URL(a.href).searchParams.get('query')}catch{return null}}
  let enhancing=false;
  function enhanceSchedule(){
    if(enhancing)return;enhancing=true;
    try{
      const rows=[...scheduleBody.querySelectorAll('tr')];if(!rows.length)return;
      const now=new Date(),current=now.getHours()*60+now.getMinutes();let active=rows.findIndex(r=>{const t=minutes(r.children[1]?.textContent.trim());return t!==null&&t>=current});if(active<0)active=rows.length-1;rows.forEach((r,i)=>r.classList.toggle('isActiveStop',i===active));
      rows.forEach(r=>{if(r.dataset.coordinate)return;const mapCell=r.children[2],mapLink=mapCell?.querySelector('a');const coord=coordinateFromMapLink(mapLink);if(coord)r.dataset.coordinate=coord});
      rows.forEach(r=>{
        const name=r.children[0],mapCell=r.children[2];if(!name||!mapCell)return;const originalMapLink=mapCell.querySelector('a:not(.routeLink)');
        if(originalMapLink&&!name.querySelector('.stopMapButton')){const stopName=name.textContent.trim(),a=document.createElement('a');a.href=originalMapLink.href;a.target='_blank';a.rel='noopener';a.className='stopMapButton';a.setAttribute('aria-label',`Otwórz ${stopName} na mapie`);const text=document.createElement('span');text.textContent=stopName;a.append(stopMarkerIcon(),text);name.replaceChildren(a)}
        mapCell.className='routeCell';let routeLink=mapCell.querySelector('.routeLink');if(r.dataset.coordinate){if(!routeLink){mapCell.replaceChildren();routeLink=document.createElement('a');routeLink.href='#';routeLink.className='routeLink';routeLink.setAttribute('role','button');routeLink.setAttribute('aria-label','Uruchom nawigację od bieżącej pozycji przez pozostałe punkty');routeLink.append(routeIcon());mapCell.append(routeLink)}}else mapCell.replaceChildren();
      });
    }finally{enhancing=false}
  }
  new MutationObserver(enhanceSchedule).observe(scheduleBody,{childList:true,subtree:true});setInterval(enhanceSchedule,30000);enhanceSchedule();
})();
