(()=>{
  const root=document.getElementById('routeNavRoot');
  const body=document.getElementById('scheduleBody');
  if(!root)return;

  const style=document.createElement('style');
  style.textContent=`
    #routeMapCanvas{position:relative!important}
    #routeMapCanvas>#routeFunctionStack{
      position:absolute!important;
      left:12px!important;
      top:12px!important;
      right:auto!important;
      bottom:auto!important;
    }
    #routeNextStop .nextStopMainRow{
      display:flex!important;
      align-items:center!important;
      gap:10px!important;
      width:100%!important;
      min-width:0!important;
    }
    #routeNextStop .nextStopMainRow>.nextStopMain{
      display:block!important;
      flex:1 1 auto!important;
      min-width:0!important;
      margin:0!important;
      overflow-wrap:anywhere!important;
    }
    #routeNextStop .nextStopMainRow>#routeSkipCurrentButton{
      flex:0 0 auto!important;
      align-self:center!important;
      margin:0!important;
    }
    html[data-nav-punctuality="early"] #routeMapCanvas .maplibregl-marker[style*="clip-path"],
    html[data-nav-punctuality="early"] #routeMapCanvas .maplibregl-marker [style*="clip-path"]{background:#ff3b30!important}
    html[data-nav-punctuality="late"] #routeMapCanvas .maplibregl-marker[style*="clip-path"],
    html[data-nav-punctuality="late"] #routeMapCanvas .maplibregl-marker [style*="clip-path"]{background:#ff9500!important}
    html[data-nav-punctuality="onTime"] #routeMapCanvas .maplibregl-marker[style*="clip-path"],
    html[data-nav-punctuality="onTime"] #routeMapCanvas .maplibregl-marker [style*="clip-path"],
    html[data-nav-punctuality="arrived"] #routeMapCanvas .maplibregl-marker[style*="clip-path"],
    html[data-nav-punctuality="arrived"] #routeMapCanvas .maplibregl-marker [style*="clip-path"]{background:#34c759!important}
  `;
  document.head.appendChild(style);

  function groupStopNameAndSkip(){
    const header=document.getElementById('routeNextStop');
    const main=header?.querySelector('.nextStopMain');
    if(!header||!main)return;
    let row=header.querySelector('.nextStopMainRow');
    if(!row){
      row=document.createElement('span');
      row.className='nextStopMainRow';
      main.before(row);
      row.appendChild(main);
    }
    const skip=document.getElementById('routeSkipCurrentButton');
    if(skip&&skip.parentElement!==row)row.appendChild(skip);
  }

  function moveFunctionStack(){
    const canvas=document.getElementById('routeMapCanvas');
    const stack=document.getElementById('routeFunctionStack');
    if(!canvas||!stack)return;
    if(stack.parentElement!==canvas)canvas.appendChild(stack);
    stack.style.setProperty('position','absolute','important');
    stack.style.setProperty('left','12px','important');
    stack.style.setProperty('top','12px','important');
    stack.style.setProperty('right','auto','important');
    stack.style.setProperty('bottom','auto','important');
  }

  function colorFor(kind){
    if(kind==='early')return'#ff3b30';
    if(kind==='late')return'#ff9500';
    if(kind==='onTime'||kind==='arrived')return'#34c759';
    return'#078df0';
  }

  function applyVehicleStatus(kind=document.documentElement.dataset.navPunctuality){
    const canvas=document.getElementById('routeMapCanvas');
    if(!canvas)return;
    const vehicle=canvas.querySelector('.maplibregl-marker[style*="clip-path"], .maplibregl-marker [style*="clip-path"]');
    if(!vehicle)return;
    const normalized=['early','late','onTime','arrived'].includes(kind)?kind:'neutral';
    vehicle.style.setProperty('background',colorFor(normalized),'important');
    vehicle.dataset.punctuality=normalized;
  }

  function sync(){
    groupStopNameAndSkip();
    moveFunctionStack();
    applyVehicleStatus();
  }

  let queued=false;
  function scheduleSync(){
    if(queued)return;
    queued=true;
    requestAnimationFrame(()=>{queued=false;sync()});
  }

  body?.addEventListener('eta-status-change',event=>applyVehicleStatus(event.detail?.kind));
  body?.addEventListener('nav-eta-update',event=>{
    if(event.detail?.source==='navigation-live-engine')applyVehicleStatus(event.detail?.kind);
  });
  body?.addEventListener('gps-next-stop-change',scheduleSync);
  document.addEventListener('trasy:route-map-ready',scheduleSync);
  window.addEventListener('resize',scheduleSync,{passive:true});
  new MutationObserver(scheduleSync).observe(root,{subtree:true,childList:true});
  setInterval(sync,1000);
  sync();
})();
