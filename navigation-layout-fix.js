(()=>{
  const root=document.getElementById('routeNavRoot');
  if(!root)return;

  const style=document.createElement('style');
  style.textContent=`
    #routeFunctionStack{
      position:fixed!important;
      left:12px!important;
      top:112px!important;
      right:auto!important;
      bottom:auto!important;
      z-index:80510!important;
      display:flex!important;
      flex-direction:column!important;
      align-items:center!important;
      gap:7px!important;
      width:46px!important;
      pointer-events:none!important;
    }
    #routeFunctionStack>#routeMapClose,
    #routeFunctionStack>#routeMapCenter,
    #routeFunctionStack>#routeVoiceToggle,
    #routeFunctionStack>#routeFeedbackButton{
      position:static!important;
      inset:auto!important;
      margin:0!important;
      transform:none!important;
      pointer-events:auto!important;
      flex:0 0 auto!important;
    }
    #routeFunctionStack>#routeFeedbackButton{
      width:42px!important;
      height:42px!important;
      min-width:42px!important;
      min-height:42px!important;
      border-radius:21px!important;
    }
    #routeMapCanvas>#routeNorthIndicator{
      position:absolute!important;
      left:auto!important;
      bottom:auto!important;
      right:12px!important;
      width:54px!important;
      height:54px!important;
      margin:0!important;
      z-index:50135!important;
      pointer-events:none!important;
    }
    #routeMapCanvas .maplibregl-ctrl-bottom-right{
      right:10px!important;
      bottom:10px!important;
    }
    #routeMapCanvas .maplibregl-ctrl-bottom-right .maplibregl-ctrl-group:has(.maplibregl-ctrl-zoom-in){
      display:flex!important;
      flex-direction:column!important;
      margin:0!important;
      border-radius:5px!important;
      overflow:hidden!important;
    }
    #routeMapCanvas .maplibregl-ctrl-bottom-left{
      left:6px!important;
      bottom:5px!important;
      max-width:calc(100% - 92px)!important;
      z-index:50020!important;
    }
    #routeMapCanvas .maplibregl-ctrl-bottom-left .maplibregl-ctrl-attrib{
      margin:0!important;
      max-width:100%!important;
      font-size:9px!important;
      opacity:.72!important;
    }
  `;
  document.head.appendChild(style);

  function ensureStack(){
    let stack=document.getElementById('routeFunctionStack');
    if(!stack){
      stack=document.createElement('div');
      stack.id='routeFunctionStack';
      root.appendChild(stack);
    }
    const items=[
      document.getElementById('routeMapClose'),
      document.getElementById('routeVoiceToggle'),
      document.getElementById('routeMapCenter'),
      document.getElementById('routeFeedbackButton')
    ].filter(Boolean);
    items.forEach(item=>{if(item.parentElement!==stack)stack.appendChild(item)});
    return stack;
  }

  function restoreRightMapControls(){
    const canvas=document.getElementById('routeMapCanvas');
    if(!canvas)return;
    const bottomRight=canvas.querySelector('.maplibregl-ctrl-bottom-right');
    if(!bottomRight)return;
    const stack=document.getElementById('routeFunctionStack');
    const groups=[
      ...(stack?[...stack.querySelectorAll('.maplibregl-ctrl-group')]:[]),
      ...canvas.querySelectorAll('.maplibregl-ctrl-group')
    ];
    const zoomGroup=groups.find(group=>group.querySelector('.maplibregl-ctrl-zoom-in')&&group.querySelector('.maplibregl-ctrl-zoom-out'));
    if(!zoomGroup)return;
    const pitch=document.getElementById('routePitchToggle');
    const zoomIn=zoomGroup.querySelector('.maplibregl-ctrl-zoom-in');
    if(pitch&&zoomIn&&(pitch.parentElement!==zoomGroup||pitch.nextElementSibling!==zoomIn))zoomGroup.insertBefore(pitch,zoomIn);
    if(zoomGroup.parentElement!==bottomRight)bottomRight.appendChild(zoomGroup);
  }

  function placeCompass(){
    const canvas=document.getElementById('routeMapCanvas');
    const compass=document.getElementById('routeNorthIndicator');
    if(!canvas||!compass)return;
    if(compass.parentElement!==canvas)canvas.appendChild(compass);
    const speed=document.getElementById('routeMapSpeedBox');
    let top=82;
    if(speed){
      const canvasRect=canvas.getBoundingClientRect();
      const speedRect=speed.getBoundingClientRect();
      top=Math.max(10,Math.round(speedRect.bottom-canvasRect.top+8));
    }
    compass.style.top=`${top}px`;
    compass.style.right='12px';
  }

  function moveAttribution(){
    const canvas=document.getElementById('routeMapCanvas');
    if(!canvas)return;
    const attribution=canvas.querySelector('.maplibregl-ctrl-attrib');
    const bottomLeft=canvas.querySelector('.maplibregl-ctrl-bottom-left');
    if(attribution&&bottomLeft&&attribution.parentElement!==bottomLeft)bottomLeft.appendChild(attribution);
  }

  function sync(){
    ensureStack();
    restoreRightMapControls();
    placeCompass();
    moveAttribution();
  }

  let queued=false;
  const scheduleSync=()=>{
    if(queued)return;
    queued=true;
    requestAnimationFrame(()=>{queued=false;sync()});
  };

  const observer=new MutationObserver(scheduleSync);
  observer.observe(document.body,{subtree:true,childList:true});
  document.addEventListener('trasy:route-map-ready',scheduleSync);
  document.addEventListener('trasy:gps-speed',scheduleSync);
  document.addEventListener('trasy:road-speed-limit',scheduleSync);
  window.addEventListener('resize',scheduleSync,{passive:true});
  setInterval(sync,1000);
  sync();
})();