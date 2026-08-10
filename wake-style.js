(()=>{
  const button=document.getElementById('wakeLockButton');
  const label=document.getElementById('wakeLockLabel');
  const scheduleBody=document.getElementById('scheduleBody');
  const scheduleClock=document.getElementById('scheduleClock');
  const scheduleTimeSelect=document.getElementById('scheduleTimeSelect');
  if(!button||!label)return;

  const bulb=button.querySelector('.wakeBulb');
  const screenLabel=document.createElement('span');
  screenLabel.className='wakeScreenLabel';
  screenLabel.textContent='EKRAN';
  const topRow=document.createElement('span');
  topRow.className='wakeTopRow';
  if(bulb)topRow.append(bulb);
  label.textContent='OFF';
  topRow.append(label);
  button.replaceChildren(topRow,screenLabel);

  let wakeLock=null;
  let wakeWanted=false;

  const style=document.createElement('style');
  style.textContent=`
    #wakeLockButton.wakeLockButton{display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;gap:0!important;width:auto!important;min-width:62px!important;min-height:58px!important;padding:0!important;border:0!important;border-radius:0!important;background:transparent!important;box-shadow:none!important;color:inherit!important}
    #wakeLockButton .wakeTopRow{display:flex;align-items:center;justify-content:center;gap:7px;line-height:1}
    #wakeLockButton .wakeBulb{font-size:1.9rem!important;line-height:1!important;filter:grayscale(1);opacity:.58;transition:filter .2s,opacity .2s,text-shadow .2s}
    #wakeLockLabel{min-width:28px;color:#888;font-size:.86rem;font-weight:900;text-align:left;transition:color .2s,text-shadow .2s}
    #wakeLockButton .wakeScreenLabel{display:block;margin-top:3px;color:#fff!important;font-size:.72rem;font-weight:900;letter-spacing:.08em;line-height:1;text-align:center;text-shadow:none!important}
    #wakeLockButton.wakeActive .wakeBulb{filter:none;opacity:1;text-shadow:0 0 7px #ffd900,0 0 15px #ffd900}
    #wakeLockButton.wakeActive #wakeLockLabel{color:#ffd900;text-shadow:0 0 7px #ffd900,0 0 13px #ffd900}
    #scheduleClock.scheduleClock{color:#ccff33!important;font-size:1.34rem!important;font-weight:900!important;font-variant-numeric:tabular-nums;letter-spacing:.025em}
    #scheduleTimeSelect.scheduleTimeSelect{cursor:pointer}
    #scheduleBody tr.isActiveStop{background:rgba(204,255,51,.13);box-shadow:inset 4px 0 #ccff33}
    #scheduleBody tr.isActiveStop td:first-child{font-weight:900;color:#ccff33}
    #scheduleBody td:last-child{white-space:nowrap}
    #scheduleBody .routeLink{margin-left:8px;color:#ccff33;font-weight:900;text-decoration:none}
    #scheduleBody .stopMapButton{display:inline-flex;align-items:center;gap:7px;width:auto;max-width:100%;min-height:38px;padding:7px 10px;border:1px solid #626262;border-radius:5px;background:#333;color:#fff;font-weight:900;text-decoration:none;line-height:1.2}
    #scheduleBody .stopMapButton:hover,#scheduleBody .stopMapButton:focus{border-color:#ccff33;outline:none;box-shadow:0 0 0 1px #ccff33}
    #scheduleBody .stopMapPin{flex:0 0 auto;font-size:1.1rem;line-height:1}
    #scheduleBody tr.isActiveStop .stopMapButton{color:#ccff33}
    @media(max-width:520px){#wakeLockButton.wakeLockButton{min-width:58px!important}#wakeLockButton .wakeBulb{font-size:1.75rem!important}#scheduleClock.scheduleClock{font-size:1.22rem!important}}
  `;
  document.head.append(style);

  function setWakeState(active){
    button.classList.toggle('wakeActive',active);
    label.textContent=active?'ON':'OFF';
    button.setAttribute('aria-pressed',String(active));
  }

  async function releaseWakeLock(){
    wakeWanted=false;
    if(wakeLock){
      try{await wakeLock.release()}catch{}
    }
    wakeLock=null;
    setWakeState(false);
  }

  async function requestWakeLock(){
    if(!('wakeLock'in navigator)){
      wakeWanted=false;
      setWakeState(false);
      return;
    }
    try{
      wakeLock=await navigator.wakeLock.request('screen');
      setWakeState(true);
      wakeLock.addEventListener('release',()=>{
        wakeLock=null;
        setWakeState(false);
      },{once:true});
    }catch{
      wakeLock=null;
      wakeWanted=false;
      setWakeState(false);
    }
  }

  button.addEventListener('click',async event=>{
    event.preventDefault();
    event.stopImmediatePropagation();
    if(wakeWanted)await releaseWakeLock();
    else{
      wakeWanted=true;
      await requestWakeLock();
    }
  },true);

  document.addEventListener('visibilitychange',()=>{
    if(document.visibilityState==='visible'&&wakeWanted&&!wakeLock)requestWakeLock();
  });

  setWakeState(false);

  function renderClock(){
    if(!scheduleClock)return;
    const now=new Date();
    scheduleClock.textContent=`${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`;
  }
  if(scheduleClock){
    const clockObserver=new MutationObserver(()=>{
      if(scheduleClock.textContent.includes('🕒')||!/^\d{2}:\d{2}:\d{2}$/.test(scheduleClock.textContent.trim()))renderClock();
    });
    clockObserver.observe(scheduleClock,{childList:true,characterData:true,subtree:true});
    renderClock();
    setInterval(renderClock,1000);
  }

  if(scheduleTimeSelect){
    scheduleTimeSelect.setAttribute('title','Wybierz godzinę kursu');
    scheduleTimeSelect.addEventListener('change',()=>{
      scheduleTimeSelect.blur();
    });
  }

  if(!scheduleBody)return;

  function minutes(value){
    const m=String(value||'').match(/^(\d{1,2}):(\d{2})$/);
    return m?Number(m[1])*60+Number(m[2]):null;
  }

  function getCoordinate(row){
    const link=row.querySelector('td:last-child a');
    if(!link)return null;
    try{
      const url=new URL(link.href);
      return url.searchParams.get('query');
    }catch{return null}
  }

  function directionsUrl(rows,startIndex){
    const coordinates=rows.slice(startIndex).map(getCoordinate).filter(Boolean);
    if(!coordinates.length)return null;
    const destination=coordinates.at(-1);
    const url=new URL('https://www.google.com/maps/dir/');
    url.searchParams.set('api','1');
    url.searchParams.set('destination',destination);
    url.searchParams.set('travelmode','driving');
    if(coordinates.length>1)url.searchParams.set('waypoints',coordinates.slice(0,-1).join('|'));
    return url.toString();
  }

  function makeStopMapButton(row){
    const nameCell=row.querySelector('td:first-child');
    const mapLink=row.querySelector('td:last-child a');
    if(!nameCell||!mapLink||nameCell.querySelector('.stopMapButton'))return;
    const stopName=nameCell.textContent.trim();
    if(!stopName)return;
    const a=document.createElement('a');
    a.href=mapLink.href;
    a.target='_blank';
    a.rel='noopener';
    a.className='stopMapButton';
    a.setAttribute('aria-label',`Otwórz ${stopName} na mapie`);
    const pin=document.createElement('span');
    pin.className='stopMapPin';
    pin.textContent='📍';
    const text=document.createElement('span');
    text.textContent=stopName;
    a.append(pin,text);
    nameCell.replaceChildren(a);
  }

  function enhanceSchedule(){
    const rows=[...scheduleBody.querySelectorAll('tr')];
    if(!rows.length)return;

    const now=new Date();
    const current=now.getHours()*60+now.getMinutes();
    let activeIndex=rows.findIndex(row=>{
      const cells=row.querySelectorAll('td');
      const t=minutes(cells[1]?.textContent.trim());
      return t!==null&&t>=current;
    });
    if(activeIndex<0)activeIndex=rows.length-1;
    rows.forEach((row,index)=>row.classList.toggle('isActiveStop',index===activeIndex));

    rows.forEach((row,index)=>{
      makeStopMapButton(row);
      const mapCell=row.querySelector('td:last-child');
      if(!mapCell||mapCell.querySelector('.routeLink'))return;
      const href=directionsUrl(rows,index);
      if(!href)return;
      const a=document.createElement('a');
      a.href=href;
      a.target='_blank';
      a.rel='noopener';
      a.className='routeLink';
      a.textContent='TRASA';
      a.setAttribute('aria-label','Nawiguj przez pozostałe przystanki');
      mapCell.append(a);
    });
  }

  const observer=new MutationObserver(enhanceSchedule);
  observer.observe(scheduleBody,{childList:true,subtree:true});
  setInterval(enhanceSchedule,30000);
  enhanceSchedule();
})();