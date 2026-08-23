(()=>{
  const body=document.getElementById('scheduleBody');
  if(!body)return;

  let header=document.getElementById('routeNextStop');
  if(!header)return;

  // nav-map.js keeps a reference to the original node. Replacing it gives
  // this module exclusive ownership of the visible navigation header.
  const ownedHeader=header.cloneNode(false);
  header.replaceWith(ownedHeader);
  header=ownedHeader;
  header.setAttribute('aria-live','polite');

  // The old off-screen stop panel was retired. Remove it from the DOM
  // instead of only hiding it with CSS.
  document.getElementById('offscreenText')?.closest('button')?.remove();

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
    #routeNextStop .nextStopStatus.early{color:#ffd60a}
    #routeNextStop .nextStopStatus.onTime{color:#34c759}
    #routeNextStop .nextStopStatus.late{color:#ff3b30}
    #routeNextStop .nextStopGuard{display:block;margin-top:5px;padding:7px 10px;border-radius:7px;font-size:14px;line-height:1.15;font-weight:1000;text-align:center;white-space:normal}
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
  const AudioContextClass=window.AudioContext||window.webkitAudioContext;

  let lastStatusDetail=null;
  let lastGuardDetail=null;
  let currentSpeedKmh=null;
  let stoppedSince=0;
  let activeHoldKey='';
  let alertedHoldKey='';
  let alertedReadyKey='';
  let audioContext=null;

  function rows(){
    return[...body.querySelectorAll('tr')].filter(row=>row.dataset.coordinate);
  }

  function activeRow(){
    const routeRows=rows();
    const index=Number(body.dataset.gpsNextStop);
    if(Number.isInteger(index)&&index>=0&&index<routeRows.length){
      return routeRows[index];
    }
    return routeRows.find(row=>row.classList.contains('gpsNextStop'))||routeRows[0]||null;
  }

  function dataFromRow(row){
    if(!row)return null;
    const name=(
      row.querySelector('td:first-child')?.childNodes[0]?.textContent||
      row.querySelector('td:first-child')?.innerText||''
    ).trim();
    const plan=(
      row.children[1]?.firstChild?.textContent||
      row.children[1]?.textContent||''
    ).trim().match(/\b\d{1,2}:\d{2}\b/)?.[0]||'';
    return{name,plan};
  }

  function statusText(detail){
    const raw=detail?.diffSeconds;
    if(raw===null||raw===undefined||raw==='')return{kind:'',text:''};
    const diff=Number(raw);
    if(!Number.isFinite(diff))return{kind:'',text:''};
    if(Math.abs(diff)<=30)return{kind:'onTime',text:'👍'};
    const min=Math.max(1,Math.floor(Math.abs(diff)/60));
    return diff<0
      ?{kind:'early',text:`${min} min za wcześnie`}
      :{kind:'late',text:`${min} min opóźnienia`};
  }

  function guardKey(detail=lastGuardDetail){
    const row=activeRow();
    const data=dataFromRow(row);
    return[
      body.dataset.direction||'outbound',
      detail?.index??body.dataset.gpsNextStop??'',
      row?.dataset.stopId||row?.dataset.coordinate||'',
      data?.plan||''
    ].join('|');
  }

  function isStopped(){
    return Number.isFinite(currentSpeedKmh)&&
      currentSpeedKmh<=STOPPED_MAX_KMH&&
      stoppedSince>0&&
      Date.now()-stoppedSince>=STOPPED_CONFIRM_MS;
  }

  function guardData(){
    const state=lastGuardDetail?.state||'';
    if(state!=='hold'&&state!=='ready')return null;

    const key=guardKey();
    if(state==='hold'&&activeHoldKey!==key&&!isStopped())return null;

    const fallback=state==='hold'?'NIE ODJEDŻAJ':'MOŻESZ JECHAĆ';
    return{
      state,
      key,
      message:String(lastGuardDetail?.message||fallback).trim()||fallback
    };
  }

  function render(){
    const data=dataFromRow(activeRow());
    if(!data){
      mainEl.textContent='';
      statusEl.hidden=true;
      guardEl.hidden=true;
      return;
    }

    mainEl.textContent=`${data.name}${data.plan?` · ${data.plan}`:''}`;

    const guard=guardData();
    const status=statusText(lastStatusDetail);

    if(guard){
      guardEl.hidden=false;
      guardEl.classList.toggle('hold',guard.state==='hold');
      guardEl.classList.toggle('ready',guard.state==='ready');
      guardEl.textContent=guard.message;
      statusEl.hidden=true;
    }else{
      guardEl.hidden=true;
      guardEl.classList.remove('hold','ready','flash3');
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
    try{
      if(!audioContext)audioContext=new AudioContextClass();
      return audioContext;
    }catch{
      return null;
    }
  }

  async function playBeeps(count){
    const context=ensureAudio();
    if(!context)return;
    try{
      if(context.state==='suspended')await context.resume();
      const start=context.currentTime+.02;
      for(let i=0;i<count;i+=1){
        const at=start+i*.29;
        const oscillator=context.createOscillator();
        const gain=context.createGain();
        oscillator.type='square';
        oscillator.frequency.setValueAtTime(1180,at);
        gain.gain.setValueAtTime(.0001,at);
        gain.gain.exponentialRampToValueAtTime(.48,at+.018);
        gain.gain.setValueAtTime(.48,at+.13);
        gain.gain.exponentialRampToValueAtTime(.0001,at+.19);
        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.start(at);
        oscillator.stop(at+.2);
      }
    }catch{}
  }

  function unlockAudio(){
    const context=ensureAudio();
    if(!context)return;
    context.resume?.().catch?.(()=>{});
  }

  function flashHold(){
    guardEl.classList.remove('flash3');
    void guardEl.offsetWidth;
    guardEl.classList.add('flash3');
  }

  guardEl.addEventListener('animationend',()=>{
    guardEl.classList.remove('flash3');
  });

  document.addEventListener('pointerdown',unlockAudio,{once:true,capture:true});
  document.addEventListener('keydown',unlockAudio,{once:true,capture:true});

  document.addEventListener('trasy:gps-speed',event=>{
    const kmh=Number(event.detail?.kmh);
    if(!Number.isFinite(kmh))return;
    currentSpeedKmh=kmh;
    if(kmh<=STOPPED_MAX_KMH){
      if(!stoppedSince)stoppedSince=Date.now();
    }else{
      stoppedSince=0;
    }
  });

  body.addEventListener('nav-eta-update',event=>{
    lastStatusDetail=event.detail;
    render();
  });

  body.addEventListener('stop-guard-change',event=>{
    lastGuardDetail=event.detail||null;
    const state=lastGuardDetail?.state||'';
    const key=guardKey(lastGuardDetail);

    if(state==='hold'&&(activeHoldKey===key||isStopped())){
      if(activeHoldKey!==key)activeHoldKey=key;
      render();
      if(alertedHoldKey!==key){
        alertedHoldKey=key;
        playBeeps(1);
        flashHold();
      }
      return;
    }

    if(state==='ready'){
      activeHoldKey='';
      render();
      const message=String(lastGuardDetail?.message||'');
      if(message.includes('MOŻESZ JECHAĆ')&&alertedReadyKey!==key){
        alertedReadyKey=key;
        playBeeps(2);
      }
      return;
    }

    if(state!=='hold')activeHoldKey='';
    render();
  });

  body.addEventListener('gps-next-stop-change',()=>{
    lastStatusDetail=null;
    lastGuardDetail=null;
    activeHoldKey='';
    stoppedSince=0;
    render();
  });

  function resetAlerts(){
    activeHoldKey='';
    alertedHoldKey='';
    alertedReadyKey='';
    stoppedSince=0;
  }

  body.addEventListener('route-direction-change',resetAlerts);
  body.addEventListener('route-mode-change',resetAlerts);
  body.addEventListener('schedule-rendered',resetAlerts);

  render();
})();
