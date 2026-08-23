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

  const style=document.createElement('style');
  style.textContent=`
    #routeNextStop{font-size:14px!important;font-weight:800!important;line-height:1.25!important;max-width:62%;}
    #routeNextStop .nextStopLabel{display:block;color:#aaa;font-size:10px;font-weight:800;letter-spacing:.04em;text-transform:uppercase}
    #routeNextStop .nextStopMain{display:block;color:#fff;font-size:14px;font-weight:900}
    #routeNextStop .nextStopStatus{display:block;margin-top:2px;font-size:13px;font-weight:1000}
    #routeNextStop .nextStopStatus.early{color:#ffd60a}
    #routeNextStop .nextStopStatus.onTime{color:#34c759}
    #routeNextStop .nextStopStatus.late{color:#ff3b30}
    #routeNextStop .nextStopGuard{display:block;margin-top:5px;padding:6px 9px;border-radius:7px;font-size:13px;line-height:1.15;font-weight:1000;text-align:center;white-space:normal}
    #routeNextStop .nextStopGuard.hold{background:#ff3b30;color:#fff}
    #routeNextStop .nextStopGuard.ready{background:#34c759;color:#071407}
    #scheduleBody .stopGuardNotice.hold{background:#ff3b30!important;color:#fff!important}
    #scheduleBody .stopGuardNotice.ready{background:#34c759!important;color:#071407!important}
    .activeStopEtaBubble{display:none!important}
    #routeNavRoot .maplibregl-popup{display:none!important}
  `;
  document.head.appendChild(style);

  let lastStatusDetail=null;
  let lastGuardDetail=null;

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

  function guardData(){
    const state=lastGuardDetail?.state||'';
    if(state!=='hold'&&state!=='ready')return null;
    const fallback=state==='hold'?'NIE ODJEDŻAJ':'MOŻESZ JECHAĆ';
    return{
      state,
      message:String(lastGuardDetail?.message||fallback).trim()||fallback
    };
  }

  function render(){
    const data=dataFromRow(activeRow());
    if(!data){
      header.textContent='';
      return;
    }

    const guard=guardData();
    const status=statusText(lastStatusDetail);
    const normalStatus=status.text
      ?`<span class="nextStopStatus ${status.kind}">${escapeHtml(status.text)}</span>`
      :'';
    const guardStatus=guard
      ?`<span class="nextStopGuard ${guard.state}">${escapeHtml(guard.message)}</span>`
      :'';

    header.innerHTML=`<span class="nextStopLabel">Następny przystanek</span><span class="nextStopMain">${escapeHtml(data.name)}${data.plan?` · ${escapeHtml(data.plan)}`:''}</span>${guardStatus||normalStatus}`;
  }

  function escapeHtml(value){
    return String(value).replace(/[&<>"']/g,char=>({
      '&':'&amp;',
      '<':'&lt;',
      '>':'&gt;',
      '"':'&quot;',
      "'":'&#39;'
    }[char]));
  }

  body.addEventListener('nav-eta-update',event=>{
    lastStatusDetail=event.detail;
    render();
  });

  body.addEventListener('stop-guard-change',event=>{
    lastGuardDetail=event.detail||null;
    render();
  });

  body.addEventListener('gps-next-stop-change',()=>{
    lastStatusDetail=null;
    lastGuardDetail=null;
    render();
  });

  render();
})();
