(()=>{
  const body=document.getElementById('scheduleBody');
  const time=globalThis.__trasyTime;
  const geo=globalThis.__trasyGeo;
  const etaCore=globalThis.__trasyEta;
  if(!body||!time||!geo||!etaCore)return;

  let header=document.getElementById('routeNextStop');
  if(!header)return;

  const ownedHeader=header.cloneNode(false);
  header.replaceWith(ownedHeader);
  header=ownedHeader;
  header.setAttribute('aria-live','polite');

  const labelEl=document.createElement('span');
  labelEl.className='nextStopLabel';
  labelEl.textContent='Następny przystanek';
  const mainEl=document.createElement('span');
  mainEl.className='nextStopMain';
  const statusEl=document.createElement('span');
  statusEl.className='nextStopStatus';
  statusEl.hidden=true;
  const guardEl=document.createElement('span');
  guardEl.className='nextStopGuard';
  guardEl.hidden=true;
  header.append(labelEl,mainEl,statusEl,guardEl);

  const style=document.createElement('style');
  style.textContent=`
    #routeNextStop{font-size:14px!important;font-weight:800!important;line-height:1.25!important;max-width:62%;}
    #routeNextStop .nextStopLabel{display:block;color:#aaa;font-size:10px;font-weight:800;letter-spacing:.04em;text-transform:uppercase}
    #routeNextStop .nextStopMain{display:block;color:#fff;font-size:14px;font-weight:900}
    #routeNextStop .nextStopStatus{display:block;margin-top:2px;font-size:13px;font-weight:1000}
    #routeNextStop .nextStopStatus[hidden],#routeNextStop .nextStopGuard[hidden]{display:none!important}
    #routeNextStop .nextStopStatus.early,
    #routeNextStop .nextStopStatus.onTime,
    #routeNextStop .nextStopStatus.late{color:#39ff69}
    #routeNextStop .nextStopGuard{display:block;margin-top:5px;padding:7px 10px;border-radius:7px;font-size:14px;line-height:1.15;font-weight:1000;text-align:center;white-space:normal}
    #routeNextStop .nextStopGuard.approach{background:#ffd60a;color:#111}
    #routeNextStop .nextStopGuard.hold{background:#ff3b30;color:#fff}
    #routeNextStop .nextStopGuard.ready{background:#34c759;color:#071407}
    #routeNextStop .nextStopGuard.flash3{animation:trasyHoldFlash .36s ease-in-out 3}
    @keyframes trasyHoldFlash{0%,100%{background:#ff3b30;opacity:1;transform:scale(1)}50%{background:#730000;opacity:.3;transform:scale(.98)}}
    #scheduleBody .stopGuardNotice.hold{background:#ff3b30!important;color:#fff!important}
    #scheduleBody .stopGuardNotice.ready{background:#34c759!important;color:#071407!important}
    .activeStopEtaBubble{display:none!important}
    #routeNavRoot .maplibregl-popup{display:none!important}
  `;
  document.head.appendChild(style);

  const STOPPED_MAX_KMH=4;
  const STOPPED_CONFIRM_MS=700;
  const APPROACH_RADIUS_M=100;
  const APPROACH_CLEAR_M=140;
  const APPROACH_MAX_ACCURACY_M=80;
  const AUDIO_PRIME_MS=220;
  const BEEP_LEAD_SECONDS=.08;
  const BEEP_DURATION_SECONDS=.28;
  const BEEP_SPACING_SECONDS=.42;
  const AudioContextClass=window.AudioContext||window.webkitAudioContext;

  let lastStatusDetail=null;
  let lastGuardDetail=null;
  let currentSpeedKmh=null;
  let stoppedSince=0;
  let activeHoldKey='';
  let activeApproachKey='';
  let alertedApproachKey='';
  let alertedHoldKey='';
  let alertedReadyKey='';
  let audioContext=null;

  function rows(){return[...body.querySelectorAll('tr')].filter(row=>row.dataset.coordinate)}
  function activeRow(){
    const routeRows=rows();
    const index=Number(body.dataset.gpsNextStop);
    if(Number.isInteger(index)&&index>=0&&index<routeRows.length)return routeRows[index];
    return routeRows.find(row=>row.classList.contains('gpsNextStop'))||routeRows[0]||null;
  }
  const planTextFromRow=row=>time.rowPlanText(row);
  function alarmEligible(row=activeRow()){
    const routeRows=rows();
    return Boolean(row&&routeRows.length&&row!==routeRows[routeRows.length-1]&&planTextFromRow(row));
  }
  function dataFromRow(row){
    if(!row)return null;
    const name=(row.querySelector('td:first-child')?.childNodes[0]?.textContent||row.querySelector('td:first-child')?.innerText||'').trim();
    return{name,plan:planTextFromRow(row)};
  }
  const coord=value=>geo.parseCoordinate(value);
  function arrivalClock(seconds){if(!Number.isFinite(seconds))return'';const date=new Date(Date.now()+seconds*1000);return`${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`}

  function stopKey(row=activeRow(),detail=lastGuardDetail){
    const data=dataFromRow(row);
    return[
      body.dataset.direction||'outbound',
      detail?.index??body.dataset.gpsNextStop??'',
      row?.dataset.stopId||row?.dataset.coordinate||'',
      data?.plan||''
    ].join('|');
  }

  function isStopped(){
    return Number.isFinite(currentSpeedKmh)&&currentSpeedKmh<=STOPPED_MAX_KMH&&stoppedSince>0&&Date.now()-stoppedSince>=STOPPED_CONFIRM_MS;
  }

  function guardData(){
    if(!alarmEligible())return null;
    const state=lastGuardDetail?.state||'';
    if(state!=='hold'&&state!=='ready')return null;
    const key=stopKey();
    if(state==='hold'&&activeHoldKey!==key&&!isStopped())return null;
    const fallback=state==='hold'?'NIE ODJEDŻAJ':'MOŻESZ JECHAĆ';
    return{state,key,message:String(lastGuardDetail?.message||fallback).trim()||fallback};
  }

  function render(){
    const data=dataFromRow(activeRow());
    if(!data){mainEl.textContent='';statusEl.hidden=true;guardEl.hidden=true;return}

    if(body.dataset.direction==='return'){
      const seconds=Number(lastStatusDetail?.etaSeconds);
      mainEl.textContent=`${data.name}${Number.isFinite(seconds)?` · Dojazd ${arrivalClock(seconds)}`:''}`;
      statusEl.hidden=true;
      statusEl.className='nextStopStatus';
      statusEl.textContent='';
      guardEl.hidden=true;
      guardEl.classList.remove('approach','hold','ready','flash3');
      return;
    }

    mainEl.textContent=`${data.name}${data.plan?` · ${data.plan}`:''}`;
    const guard=guardData();
    const status=etaCore.statusFromDiff(lastStatusDetail?.diffSeconds);

    if(guard){
      guardEl.hidden=false;
      guardEl.classList.remove('approach');
      guardEl.classList.toggle('hold',guard.state==='hold');
      guardEl.classList.toggle('ready',guard.state==='ready');
      guardEl.textContent=guard.message;
      statusEl.hidden=true;
    }else if(activeApproachKey&&alarmEligible()){
      guardEl.hidden=false;
      guardEl.classList.remove('hold','ready','flash3');
      guardEl.classList.add('approach');
      guardEl.textContent='JESTEŚ ZA WCZEŚNIE — POCZEKAJ';
      statusEl.hidden=true;
    }else{
      guardEl.hidden=true;
      guardEl.classList.remove('approach','hold','ready','flash3');
      if(status.text){
        statusEl.hidden=false;
        statusEl.className=`nextStopStatus ${status.kind}`;
        statusEl.textContent=status.text;
      }else{
        statusEl.hidden=true;
        statusEl.className='nextStopStatus';
        statusEl.textContent='';
      }
    }
  }

  function ensureAudio(){
    if(!AudioContextClass)return null;
    try{if(!audioContext)audioContext=new AudioContextClass();return audioContext}catch{return null}
  }
  const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  function primeAudio(context){
    try{
      const oscillator=context.createOscillator();
      const gain=context.createGain();
      gain.gain.setValueAtTime(.0001,context.currentTime);
      oscillator.frequency.setValueAtTime(40,context.currentTime);
      oscillator.connect(gain);gain.connect(context.destination);oscillator.start();oscillator.stop(context.currentTime+.08);
    }catch{}
  }
  async function prepareAudio(context){
    try{if(context.state==='suspended')await context.resume();primeAudio(context);await delay(AUDIO_PRIME_MS);if(context.state==='suspended')await context.resume();return context.state==='running'}catch{return false}
  }
  async function playBeeps(count){
    const context=ensureAudio();if(!context)return;
    try{
      if(!await prepareAudio(context))return;
      const start=context.currentTime+BEEP_LEAD_SECONDS;
      for(let i=0;i<count;i+=1){
        const at=start+i*BEEP_SPACING_SECONDS,end=at+BEEP_DURATION_SECONDS;
        const oscillator=context.createOscillator(),gain=context.createGain();
        oscillator.type='square';oscillator.frequency.setValueAtTime(1180,at);
        gain.gain.setValueAtTime(.0001,at);gain.gain.exponentialRampToValueAtTime(.55,at+.025);gain.gain.setValueAtTime(.55,at+.18);gain.gain.exponentialRampToValueAtTime(.0001,end);
        oscillator.connect(gain);gain.connect(context.destination);oscillator.start(at);oscillator.stop(end+.02);
      }
    }catch{}
  }
  async function unlockAudio(){const context=ensureAudio();if(!context)return;try{if(context.state==='suspended')await context.resume();primeAudio(context)}catch{}}
  function flashHold(){guardEl.classList.remove('flash3');void guardEl.offsetWidth;guardEl.classList.add('flash3')}
  function clearApproach(){if(!activeApproachKey)return;activeApproachKey='';render()}

  function updateApproach(position){
    const navPanel=document.getElementById('routeMapNav');
    if(navPanel?.hidden!==false||body.dataset.direction==='return'||body.dataset.emptyRun==='1'){clearApproach();return}
    const accuracy=Number(position?.coords?.accuracy||999);
    if(!Number.isFinite(accuracy)||accuracy>APPROACH_MAX_ACCURACY_M)return;
    const row=activeRow(),target=coord(row?.dataset.coordinate);
    if(!row||!target||!alarmEligible(row)){clearApproach();return}

    const punctuality=etaCore.statusFromDiff(lastStatusDetail?.diffSeconds);
    const here=[Number(position.coords.latitude),Number(position.coords.longitude)];
    const distance=geo.distanceMeters(here,target);
    const key=stopKey(row,null);

    if(punctuality.kind==='early'&&distance<=APPROACH_RADIUS_M){
      activeApproachKey=key;
      render();
      if(alertedApproachKey!==key){alertedApproachKey=key;playBeeps(1)}
      return;
    }
    if(activeApproachKey===key&&(punctuality.kind!=='early'||distance>APPROACH_CLEAR_M))clearApproach();
  }

  guardEl.addEventListener('animationend',()=>guardEl.classList.remove('flash3'));
  document.addEventListener('pointerdown',unlockAudio,{once:true,capture:true});
  document.addEventListener('keydown',unlockAudio,{once:true,capture:true});

  document.addEventListener('trasy:gps-speed',event=>{
    const kmh=Number(event.detail?.kmh);if(!Number.isFinite(kmh))return;
    currentSpeedKmh=kmh;
    if(kmh<=STOPPED_MAX_KMH){if(!stoppedSince)stoppedSince=Date.now()}else stoppedSince=0;
  });

  if(window.__trasyGps?.subscribe)window.__trasyGps.subscribe(updateApproach,()=>{});

  body.addEventListener('nav-eta-update',event=>{lastStatusDetail=event.detail;render()});
  body.addEventListener('stop-guard-change',event=>{
    lastGuardDetail=event.detail||null;
    if(!alarmEligible()){
      activeApproachKey='';activeHoldKey='';render();return;
    }
    const state=lastGuardDetail?.state||'';
    const key=stopKey(activeRow(),lastGuardDetail);
    if(state==='hold'&&(activeHoldKey===key||isStopped())){
      activeApproachKey='';
      if(activeHoldKey!==key)activeHoldKey=key;
      render();
      if(alertedHoldKey!==key){alertedHoldKey=key;playBeeps(1);flashHold()}
      return;
    }
    if(state==='ready'){
      activeApproachKey='';activeHoldKey='';render();
      const message=String(lastGuardDetail?.message||'');
      if(message.includes('MOŻESZ JECHAĆ')&&alertedReadyKey!==key){alertedReadyKey=key;playBeeps(2)}
      return;
    }
    if(state!=='hold')activeHoldKey='';
    render();
  });

  body.addEventListener('gps-next-stop-change',()=>{
    lastStatusDetail=null;lastGuardDetail=null;activeHoldKey='';activeApproachKey='';alertedApproachKey='';stoppedSince=0;render();
  });

  function resetAlerts(){activeHoldKey='';activeApproachKey='';alertedApproachKey='';alertedHoldKey='';alertedReadyKey='';stoppedSince=0}
  body.addEventListener('route-direction-change',()=>{resetAlerts();render()});
  body.addEventListener('route-mode-change',()=>{resetAlerts();render()});
  body.addEventListener('schedule-rendered',resetAlerts);

  render();
})();