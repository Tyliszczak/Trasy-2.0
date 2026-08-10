(()=>{
  const button=document.getElementById('wakeLockButton');
  const label=document.getElementById('wakeLockLabel');
  const scheduleBody=document.getElementById('scheduleBody');
  if(!button||!label)return;

  let wakeLock=null;
  let wakeWanted=false;

  function setWakeState(active){
    button.classList.toggle('wakeActive',active);
    label.textContent=active?'EKRAN ON':'EKRAN OFF';
    button.setAttribute('aria-pressed',String(active));
  }

  async function releaseWakeLock(){
    if(!wakeLock)return;
    try{await wakeLock.release()}catch{}
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
    wakeWanted=!wakeWanted;
    if(wakeWanted)await requestWakeLock();
    else await releaseWakeLock();
  },true);

  document.addEventListener('visibilitychange',()=>{
    if(document.visibilityState==='visible'&&wakeWanted&&!wakeLock)requestWakeLock();
  });

  setWakeState(false);

  if(!scheduleBody)return;

  const style=document.createElement('style');
  style.textContent=`
    #scheduleBody tr.isActiveStop{background:rgba(204,255,51,.13);box-shadow:inset 4px 0 #ccff33}
    #scheduleBody tr.isActiveStop td:first-child{font-weight:900;color:#ccff33}
    #scheduleBody td:last-child{white-space:nowrap}
    #scheduleBody .routeLink{margin-left:8px;color:#ccff33;font-weight:900;text-decoration:none}
  `;
  document.head.append(style);

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