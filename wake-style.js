(()=>{
  const button=document.getElementById('wakeLockButton');
  const label=document.getElementById('wakeLockLabel');
  const scheduleBody=document.getElementById('scheduleBody');
  const scheduleClock=document.getElementById('scheduleClock');
  const scheduleTimeSelect=document.getElementById('scheduleTimeSelect');
  if(!button||!label)return;

  const bulb=button.querySelector('.wakeBulb'),screenLabel=document.createElement('span'),topRow=document.createElement('span');
  screenLabel.className='wakeScreenLabel';screenLabel.textContent='EKRAN';topRow.className='wakeTopRow';if(bulb)topRow.append(bulb);label.textContent='OFF';topRow.append(label);button.replaceChildren(topRow,screenLabel);
  let wakeLock=null,manualWanted=false,navigationWanted=false;

  const style=document.createElement('style');style.textContent=`
  #wakeLockButton.wakeLockButton{display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;gap:0!important;width:auto!important;min-width:62px!important;min-height:58px!important;padding:0!important;border:0!important;border-radius:0!important;background:transparent!important;box-shadow:none!important;color:inherit!important}
  #wakeLockButton .wakeTopRow{display:flex;align-items:center;justify-content:center;gap:7px;line-height:1}#wakeLockButton .wakeBulb{font-size:1.9rem!important;line-height:1!important;filter:grayscale(1);opacity:.58;transition:filter .2s,opacity .2s,text-shadow .2s}#wakeLockLabel{min-width:28px;color:#888;font-size:.86rem;font-weight:900;text-align:left}#wakeLockButton .wakeScreenLabel{display:block;margin-top:3px;color:#fff!important;font-size:.72rem;font-weight:900;letter-spacing:.08em}#wakeLockButton.wakeActive .wakeBulb{filter:none;opacity:1;text-shadow:0 0 7px #ffd900,0 0 15px #ffd900}#wakeLockButton.wakeActive #wakeLockLabel{color:#ffd900;text-shadow:0 0 7px #ffd900,0 0 13px #ffd900}
  #scheduleClock.scheduleClock{color:#ccff33!important;font-size:1.34rem!important;font-weight:900!important;font-variant-numeric:tabular-nums}#scheduleBody tr.isActiveStop{background:rgba(204,255,51,.13);box-shadow:inset 4px 0 #ccff33}#scheduleBody tr.isActiveStop td:first-child{font-weight:900;color:#ccff33}
  #scheduleBody .stopMapButton{display:inline-flex;align-items:center;gap:9px;max-width:100%;min-height:38px;padding:5px 7px;border:0;background:transparent;color:#fff;font-weight:inherit;text-decoration:none;line-height:1.2}#scheduleBody .stopMapPin{flex:0 0 auto;width:23px;height:29px;display:block}#scheduleBody .stopMapButton:hover,#scheduleBody .stopMapButton:focus{outline:none}#scheduleBody tr.isActiveStop .stopMapButton{color:#ccff33}
  #scheduleBody td.routeCell{width:58px;text-align:center;white-space:nowrap}#scheduleBody .routeLink{display:inline-flex;align-items:center;justify-content:center;width:48px;height:44px;color:#20a84a;text-decoration:none}#scheduleBody .routeLink svg{width:38px;height:38px;display:block;overflow:visible}#scheduleBody .routeLink:hover,#scheduleBody .routeLink:focus{outline:none;filter:drop-shadow(0 0 5px rgba(32,168,74,.65))}
  @media(max-width:520px){#wakeLockButton.wakeLockButton{min-width:58px!important}#wakeLockButton .wakeBulb{font-size:1.75rem!important}#scheduleClock.scheduleClock{font-size:1.22rem!important}}
  `;document.head.append(style);

  function setWakeState(active){button.classList.toggle('wakeActive',active);label.textContent=active?'ON':'OFF';button.setAttribute('aria-pressed',String(active))}
  function wakeWanted(){return manualWanted||navigationWanted}
  async function releaseWakeLock(){if(wakeLock){try{await wakeLock.release()}catch{}}wakeLock=null;setWakeState(false)}
  async function requestWakeLock(){if(!wakeWanted()||wakeLock||document.visibilityState!=='visible')return;if(!('wakeLock'in navigator)){setWakeState(false);return}try{wakeLock=await navigator.wakeLock.request('screen');setWakeState(true);wakeLock.addEventListener('release',()=>{wakeLock=null;setWakeState(false)},{once:true})}catch{wakeLock=null;setWakeState(false)}}
  async function setNavigationWake(active){navigationWanted=!!active;if(wakeWanted())await requestWakeLock();else await releaseWakeLock()}
  button.addEventListener('click',async e=>{e.preventDefault();e.stopImmediatePropagation();manualWanted=!manualWanted;if(wakeWanted())await requestWakeLock();else await releaseWakeLock()},true);document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&wakeWanted()&&!wakeLock)requestWakeLock()});window.__trasyWakeLock={setNavigation:setNavigationWake,isActive:()=>!!wakeLock};setWakeState(false);

  function renderClock(){if(!scheduleClock)return;const n=new Date();scheduleClock.textContent=`${String(n.getHours()).padStart(2,'0')}:${String(n.getMinutes()).padStart(2,'0')}:${String(n.getSeconds()).padStart(2,'0')}`}
  if(scheduleClock){new MutationObserver(()=>{if(!/^\d{2}:\d{2}:\d{2}$/.test(scheduleClock.textContent.trim()))renderClock()}).observe(scheduleClock,{childList:true,characterData:true,subtree:true});renderClock();setInterval(renderClock,1000)}
  if(scheduleTimeSelect){scheduleTimeSelect.setAttribute('title','Wybierz godzinę kursu');scheduleTimeSelect.addEventListener('change',()=>scheduleTimeSelect.blur())}if(!scheduleBody)return;

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
      })
    }finally{enhancing=false}
  }
  new MutationObserver(enhanceSchedule).observe(scheduleBody,{childList:true,subtree:true});setInterval(enhanceSchedule,30000);enhanceSchedule();
})();
