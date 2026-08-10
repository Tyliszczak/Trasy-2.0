(()=>{
  const button=document.getElementById('wakeLockButton');
  const label=document.getElementById('wakeLockLabel');
  const scheduleBody=document.getElementById('scheduleBody');
  const scheduleClock=document.getElementById('scheduleClock');
  const scheduleTimeSelect=document.getElementById('scheduleTimeSelect');
  if(!button||!label)return;

  const bulb=button.querySelector('.wakeBulb'),screenLabel=document.createElement('span'),topRow=document.createElement('span');
  screenLabel.className='wakeScreenLabel';screenLabel.textContent='EKRAN';topRow.className='wakeTopRow';if(bulb)topRow.append(bulb);label.textContent='OFF';topRow.append(label);button.replaceChildren(topRow,screenLabel);
  let wakeLock=null,wakeWanted=false;

  const style=document.createElement('style');style.textContent=`
  #wakeLockButton.wakeLockButton{display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;gap:0!important;width:auto!important;min-width:62px!important;min-height:58px!important;padding:0!important;border:0!important;border-radius:0!important;background:transparent!important;box-shadow:none!important;color:inherit!important}
  #wakeLockButton .wakeTopRow{display:flex;align-items:center;justify-content:center;gap:7px;line-height:1}#wakeLockButton .wakeBulb{font-size:1.9rem!important;line-height:1!important;filter:grayscale(1);opacity:.58;transition:filter .2s,opacity .2s,text-shadow .2s}#wakeLockLabel{min-width:28px;color:#888;font-size:.86rem;font-weight:900;text-align:left}#wakeLockButton .wakeScreenLabel{display:block;margin-top:3px;color:#fff!important;font-size:.72rem;font-weight:900;letter-spacing:.08em}#wakeLockButton.wakeActive .wakeBulb{filter:none;opacity:1;text-shadow:0 0 7px #ffd900,0 0 15px #ffd900}#wakeLockButton.wakeActive #wakeLockLabel{color:#ffd900;text-shadow:0 0 7px #ffd900,0 0 13px #ffd900}
  #scheduleClock.scheduleClock{color:#ccff33!important;font-size:1.34rem!important;font-weight:900!important;font-variant-numeric:tabular-nums}#scheduleBody tr.isActiveStop{background:rgba(204,255,51,.13);box-shadow:inset 4px 0 #ccff33}#scheduleBody tr.isActiveStop td:first-child{font-weight:900;color:#ccff33}
  #scheduleBody .stopMapButton{display:inline-flex;align-items:center;gap:9px;max-width:100%;min-height:38px;padding:5px 7px;border:0;background:transparent;color:#fff;font-weight:inherit;text-decoration:none;line-height:1.2}#scheduleBody .stopMapPin{flex:0 0 auto;width:23px;height:29px;display:block}#scheduleBody .stopMapButton:hover,#scheduleBody .stopMapButton:focus{outline:none}#scheduleBody tr.isActiveStop .stopMapButton{color:#ccff33}
  #scheduleBody td.routeCell{width:58px;text-align:center;white-space:nowrap}#scheduleBody .routeLink{display:inline-flex;align-items:center;justify-content:center;width:48px;height:44px;color:#20a84a;text-decoration:none}#scheduleBody .routeLink svg{width:38px;height:38px;display:block;overflow:visible}#scheduleBody .routeLink:hover,#scheduleBody .routeLink:focus{outline:none;filter:drop-shadow(0 0 5px rgba(32,168,74,.65))}
  .lightNav{position:fixed;z-index:30000;inset:0;background:#161616;color:#fff;padding:14px;display:flex;flex-direction:column}.lightNav[hidden]{display:none!important}.lightNavTop{display:flex;align-items:center;gap:12px;padding-bottom:12px;border-bottom:2px solid #ccff33}.lightNavTop strong{flex:1;color:#ccff33;font-size:1.2rem;text-align:center}.lightNavClose{width:auto!important;min-width:92px!important;min-height:42px!important;padding:0 12px!important;background:#555!important;color:#fff!important}.lightNavMain{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:15px}.lightNavArrow{font-size:4rem;line-height:1;color:#ccff33}.lightNavDistance{font-size:2.5rem;font-weight:900;color:#ccff33;font-variant-numeric:tabular-nums}.lightNavInstruction{max-width:720px;font-size:1.6rem;font-weight:900;line-height:1.25}.lightNavStreet{font-size:1.05rem;color:#bbb}.lightNavSummary{padding:12px 8px;border-top:1px solid #444;color:#bbb;text-align:center}.lightNavStatus{font-size:.9rem;color:#aaa}.lightNavError{color:#ff8d8d;font-weight:900}
  @media(max-width:520px){#wakeLockButton.wakeLockButton{min-width:58px!important}#wakeLockButton .wakeBulb{font-size:1.75rem!important}#scheduleClock.scheduleClock{font-size:1.22rem!important}.lightNavInstruction{font-size:1.35rem}.lightNavDistance{font-size:2.15rem}.lightNavArrow{font-size:3.4rem}}
  `;document.head.append(style);

  function setWakeState(active){button.classList.toggle('wakeActive',active);label.textContent=active?'ON':'OFF';button.setAttribute('aria-pressed',String(active))}
  async function releaseWakeLock(){wakeWanted=false;if(wakeLock){try{await wakeLock.release()}catch{}}wakeLock=null;setWakeState(false)}
  async function requestWakeLock(){if(!('wakeLock'in navigator)){wakeWanted=false;setWakeState(false);return}try{wakeLock=await navigator.wakeLock.request('screen');setWakeState(true);wakeLock.addEventListener('release',()=>{wakeLock=null;setWakeState(false)},{once:true})}catch{wakeLock=null;wakeWanted=false;setWakeState(false)}}
  button.addEventListener('click',async e=>{e.preventDefault();e.stopImmediatePropagation();if(wakeWanted)await releaseWakeLock();else{wakeWanted=true;await requestWakeLock()}},true);document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&wakeWanted&&!wakeLock)requestWakeLock()});setWakeState(false);

  function renderClock(){if(!scheduleClock)return;const n=new Date();scheduleClock.textContent=`${String(n.getHours()).padStart(2,'0')}:${String(n.getMinutes()).padStart(2,'0')}:${String(n.getSeconds()).padStart(2,'0')}`}
  if(scheduleClock){new MutationObserver(()=>{if(!/^\d{2}:\d{2}:\d{2}$/.test(scheduleClock.textContent.trim()))renderClock()}).observe(scheduleClock,{childList:true,characterData:true,subtree:true});renderClock();setInterval(renderClock,1000)}
  if(scheduleTimeSelect){scheduleTimeSelect.setAttribute('title','Wybierz godzinę kursu');scheduleTimeSelect.addEventListener('change',()=>scheduleTimeSelect.blur())}if(!scheduleBody)return;

  function minutes(v){const m=String(v||'').match(/^(\d{1,2}):(\d{2})$/);return m?+m[1]*60+ +m[2]:null}
  function stopMarkerIcon(){const ns='http://www.w3.org/2000/svg',s=document.createElementNS(ns,'svg');s.setAttribute('viewBox','0 0 24 30');s.setAttribute('aria-hidden','true');s.classList.add('stopMapPin');s.innerHTML='<path d="M12 1.5C6.5 1.5 2 6 2 11.5c0 7.1 10 17 10 17s10-9.9 10-17C22 6 17.5 1.5 12 1.5Z" fill="#078df0"/><circle cx="12" cy="11.5" r="3.6" fill="#202020"/>';return s}
  function routeIcon(){const ns='http://www.w3.org/2000/svg',s=document.createElementNS(ns,'svg');s.setAttribute('viewBox','0 0 44 44');s.setAttribute('aria-hidden','true');s.innerHTML='<path d="M8 8c0-4 3.2-7 7-7s7 3 7 7c0 5-7 12-7 12S8 13 8 8Z" fill="currentColor"/><circle cx="15" cy="8" r="2.5" fill="#222"/><path d="M17 20c10 0 15 1 15 6 0 4-5 4-10 4-6 0-8 2-8 5" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M7 35c0-4 3-7 7-7s7 3 7 7c0 5-7 9-7 9s-7-4-7-9Z" fill="currentColor"/><circle cx="14" cy="35" r="2.5" fill="#222"/>';return s}
  function coordinateFromMapLink(a){if(!a)return null;try{return new URL(a.href).searchParams.get('query')}catch{return null}}

  const nav=document.createElement('section');nav.className='lightNav';nav.hidden=true;nav.innerHTML='<div class="lightNavTop"><button type="button" class="lightNavClose">ZAKOŃCZ</button><strong>NAWIGACJA</strong><span style="width:92px"></span></div><div class="lightNavMain"><div class="lightNavStatus">Pobieranie pozycji…</div><div class="lightNavArrow">↑</div><div class="lightNavDistance">--</div><div class="lightNavInstruction">Wyznaczanie trasy…</div><div class="lightNavStreet"></div></div><div class="lightNavSummary"></div>';document.body.append(nav);
  const navStatus=nav.querySelector('.lightNavStatus'),navArrow=nav.querySelector('.lightNavArrow'),navDistance=nav.querySelector('.lightNavDistance'),navInstruction=nav.querySelector('.lightNavInstruction'),navStreet=nav.querySelector('.lightNavStreet'),navSummary=nav.querySelector('.lightNavSummary');
  let watchId=null,navSteps=[],stepIndex=0,lastPosition=null;
  nav.querySelector('.lightNavClose').onclick=stopNavigation;

  function parseCoord(s){const m=String(s||'').match(/(-?\d+(?:\.\d+)?)\s*[,; ]\s*(-?\d+(?:\.\d+)?)/);return m?[+m[1],+m[2]]:null}
  function meters(aLat,aLng,bLat,bLng){const R=6371000,p=Math.PI/180,dLat=(bLat-aLat)*p,dLng=(bLng-aLng)*p,x=Math.sin(dLat/2)**2+Math.cos(aLat*p)*Math.cos(bLat*p)*Math.sin(dLng/2)**2;return 2*R*Math.asin(Math.sqrt(x))}
  function formatDistance(m){if(!Number.isFinite(m))return '--';return m<950?`${Math.max(0,Math.round(m/10)*10)} m`:`${(m/1000).toFixed(m<10000?1:0)} km`}
  function formatDuration(s){const min=Math.max(1,Math.round(s/60));return min<60?`${min} min`:`${Math.floor(min/60)} h ${min%60} min`}
  function arrowFor(mod){return ({left:'←',right:'→','slight left':'↖','slight right':'↗','sharp left':'↙','sharp right':'↘','straight':'↑','uturn':'↩'})[mod]||'↑'}
  function instructionFor(step){const m=step.maneuver||{},street=step.name?` w ${step.name}`:'';if(m.type==='arrive')return 'Cel jest przed Tobą';if(m.type==='depart')return `Rusz${street}`;if(m.type==='roundabout'||m.type==='rotary')return `Wjedź na rondo${m.exit?` i wybierz ${m.exit}. zjazd`:''}`;if(m.type==='merge')return `Włącz się do ruchu${street}`;if(m.type==='fork')return `${m.modifier?.includes('left')?'Trzymaj się lewej':'Trzymaj się prawej'}${street}`;if(m.type==='end of road')return `${m.modifier?.includes('left')?'Skręć w lewo':'Skręć w prawo'}${street}`;if(m.type==='continue'||m.modifier==='straight')return `Jedź prosto${street}`;if(m.modifier?.includes('left'))return `Skręć w lewo${street}`;if(m.modifier?.includes('right'))return `Skręć w prawo${street}`;return `Jedź dalej${street}`}
  function renderStep(){const step=navSteps[Math.min(stepIndex,navSteps.length-1)];if(!step){navInstruction.textContent='Brak instrukcji trasy.';navDistance.textContent='--';return}const loc=step.maneuver?.location;if(lastPosition&&loc){const d=meters(lastPosition.coords.latitude,lastPosition.coords.longitude,loc[1],loc[0]);navDistance.textContent=formatDistance(d)}navArrow.textContent=arrowFor(step.maneuver?.modifier);navInstruction.textContent=instructionFor(step);navStreet.textContent=step.name||''}
  function stopNavigation(){if(watchId!==null){navigator.geolocation.clearWatch(watchId);watchId=null}nav.hidden=true;navSteps=[];stepIndex=0;lastPosition=null}
  function onPosition(pos){lastPosition=pos;navStatus.textContent=`GPS ±${Math.round(pos.coords.accuracy||0)} m`;const step=navSteps[stepIndex],loc=step?.maneuver?.location;if(!loc){renderStep();return}const d=meters(pos.coords.latitude,pos.coords.longitude,loc[1],loc[0]);if(d<35&&stepIndex<navSteps.length-1){stepIndex++;renderStep()}else{navDistance.textContent=formatDistance(d);renderStep()}}
  function positionOnce(){return new Promise((resolve,reject)=>navigator.geolocation.getCurrentPosition(resolve,reject,{enableHighAccuracy:true,timeout:12000,maximumAge:5000}))}
  async function startNavigation(startRow){
    const rows=[...scheduleBody.querySelectorAll('tr')],stops=rows.slice(startRow).map(r=>parseCoord(r.dataset.coordinate)).filter(Boolean);if(!stops.length){alert('Brak współrzędnych dla tej trasy.');return}if(!navigator.geolocation){alert('Telefon nie udostępnia lokalizacji.');return}
    nav.hidden=false;navStatus.textContent='Pobieranie pozycji telefonu…';navInstruction.textContent='Wyznaczanie trasy…';navDistance.textContent='--';navStreet.textContent='';navSummary.textContent='';navArrow.textContent='↑';
    try{
      const pos=await positionOnce();lastPosition=pos;const all=[[pos.coords.latitude,pos.coords.longitude],...stops],coords=all.map(([lat,lng])=>`${lng},${lat}`).join(';'),last=all.length-1;
      const url=`https://router.project-osrm.org/route/v1/driving/${coords}?steps=true&overview=false&continue_straight=true&waypoints=0;${last}`;
      navStatus.textContent='Pobieranie lekkiej trasy…';const res=await fetch(url,{cache:'no-store'});if(!res.ok)throw Error(`HTTP ${res.status}`);const data=await res.json();if(data.code!=='Ok'||!data.routes?.[0])throw Error(data.message||'Nie znaleziono trasy.');const route=data.routes[0];navSteps=route.legs.flatMap(l=>l.steps||[]);stepIndex=0;navSummary.textContent=`Do celu: ${formatDistance(route.distance)} • około ${formatDuration(route.duration)} • punkty pośrednie są tylko punktami przejazdowymi`;navStatus.textContent='Nawigacja aktywna';renderStep();watchId=navigator.geolocation.watchPosition(onPosition,e=>{navStatus.textContent=`GPS: ${e.message}`},{enableHighAccuracy:true,maximumAge:2000,timeout:15000});
    }catch(e){navStatus.classList.add('lightNavError');navStatus.textContent='Nie udało się uruchomić nawigacji.';navInstruction.textContent=e.message||'Błąd wyznaczania trasy.'}
  }

  let enhancing=false;
  function enhanceSchedule(){
    if(enhancing)return;enhancing=true;
    try{
      const rows=[...scheduleBody.querySelectorAll('tr')];if(!rows.length)return;
      const now=new Date(),current=now.getHours()*60+now.getMinutes();let active=rows.findIndex(r=>{const t=minutes(r.children[1]?.textContent.trim());return t!==null&&t>=current});if(active<0)active=rows.length-1;rows.forEach((r,i)=>r.classList.toggle('isActiveStop',i===active));
      rows.forEach(r=>{if(r.dataset.coordinate)return;const mapCell=r.children[2],mapLink=mapCell?.querySelector('a');const coord=coordinateFromMapLink(mapLink);if(coord)r.dataset.coordinate=coord});
      rows.forEach((r,i)=>{
        const name=r.children[0],mapCell=r.children[2];if(!name||!mapCell)return;const originalMapLink=mapCell.querySelector('a:not(.routeLink)');
        if(originalMapLink&&!name.querySelector('.stopMapButton')){const stopName=name.textContent.trim(),a=document.createElement('a');a.href=originalMapLink.href;a.target='_blank';a.rel='noopener';a.className='stopMapButton';a.setAttribute('aria-label',`Otwórz ${stopName} na mapie`);const text=document.createElement('span');text.textContent=stopName;a.append(stopMarkerIcon(),text);name.replaceChildren(a)}
        mapCell.className='routeCell';let routeLink=mapCell.querySelector('.routeLink');if(r.dataset.coordinate){if(!routeLink){mapCell.replaceChildren();routeLink=document.createElement('a');routeLink.href='#';routeLink.className='routeLink';routeLink.setAttribute('aria-label','Uruchom lekką nawigację od bieżącej pozycji przez pozostałe punkty');routeLink.append(routeIcon());mapCell.append(routeLink)}routeLink.onclick=e=>{e.preventDefault();startNavigation(i)}}else mapCell.replaceChildren();
      })
    }finally{enhancing=false}
  }
  new MutationObserver(enhanceSchedule).observe(scheduleBody,{childList:true,subtree:true});setInterval(enhanceSchedule,30000);enhanceSchedule();
})();