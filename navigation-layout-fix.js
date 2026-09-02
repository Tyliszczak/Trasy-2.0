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
      width:42px!important;
      height:42px!important;
      min-width:42px!important;
      min-height:42px!important;
      border:0!important;
      border-radius:21px!important;
      background:rgba(68,68,68,.62)!important;
      color:#fff!important;
      box-shadow:0 2px 8px #0007!important;
      -webkit-backdrop-filter:blur(2px)!important;
      backdrop-filter:blur(2px)!important;
    }
    #routeFunctionStack>#routeMapClose{font-size:0!important;line-height:0!important}
    #routeFunctionStack>#routeMapClose::before{content:"";display:block;width:13px;height:13px;box-sizing:border-box;border-left:3px solid currentColor;border-bottom:3px solid currentColor;border-radius:1px;transform:rotate(45deg);margin-left:4px}
    #routeMapCanvas .maplibregl-ctrl-bottom-right .maplibregl-ctrl-group:has(.maplibregl-ctrl-zoom-in){
      display:flex!important;
      flex-direction:column!important;
      margin:0!important;
      border-radius:21px!important;
      overflow:hidden!important;
      background:transparent!important;
      box-shadow:0 2px 8px #0007!important;
    }
    #routeMapCanvas .maplibregl-ctrl-bottom-right .maplibregl-ctrl-group:has(.maplibregl-ctrl-zoom-in) button,
    #routePitchToggle{
      width:42px!important;
      min-width:42px!important;
      height:42px!important;
      min-height:42px!important;
      border:0!important;
      border-radius:0!important;
      background:rgba(68,68,68,.62)!important;
      color:#fff!important;
      box-shadow:none!important;
      -webkit-backdrop-filter:blur(2px)!important;
      backdrop-filter:blur(2px)!important;
    }
    #routeMapCanvas .maplibregl-ctrl-bottom-right .maplibregl-ctrl-group:has(.maplibregl-ctrl-zoom-in) button+button,
    #routeMapCanvas .maplibregl-ctrl-bottom-right .maplibregl-ctrl-group:has(.maplibregl-ctrl-zoom-in) #routePitchToggle+button{
      border-top:1px solid rgba(255,255,255,.14)!important;
    }
    #routeMapCanvas .maplibregl-ctrl-bottom-right .maplibregl-ctrl-icon{filter:invert(1) brightness(1.35)!important}
    #routeMapCanvas>#routeNorthIndicator{
      position:absolute!important;
      left:auto!important;
      bottom:auto!important;
      right:12px!important;
      width:42px!important;
      height:42px!important;
      min-width:42px!important;
      min-height:42px!important;
      margin:0!important;
      border:0!important;
      border-radius:21px!important;
      background:rgba(68,68,68,.62)!important;
      color:#fff!important;
      box-shadow:0 2px 8px #0007!important;
      -webkit-backdrop-filter:blur(2px)!important;
      backdrop-filter:blur(2px)!important;
      z-index:50135!important;
      pointer-events:none!important;
    }
    #routeManeuverBubble{
      position:fixed!important;
      left:50%!important;
      top:112px!important;
      bottom:auto!important;
      width:max-content!important;
      max-width:min(88vw,420px)!important;
      min-width:0!important;
      padding:8px 12px!important;
      border:0!important;
      border-radius:12px!important;
      background:rgba(68,68,68,.62)!important;
      box-shadow:0 2px 8px #0007!important;
      -webkit-backdrop-filter:blur(2px)!important;
      backdrop-filter:blur(2px)!important;
      transform:translateX(-50%)!important;
      z-index:80490!important;
    }
    #routeManeuverBubble #routeManeuver{white-space:normal!important;overflow-wrap:anywhere!important}
    #routeMapCanvas .maplibregl-ctrl-bottom-right{
      right:10px!important;
      bottom:10px!important;
    }
    #routeMapCanvas .maplibregl-ctrl-bottom-left{
      left:6px!important;
      bottom:76px!important;
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

  function getHeaderBottom(){
    const info=root.querySelector('.routeNavInfoShell');
    if(!info)return 100;
    const rect=info.getBoundingClientRect();
    return Math.max(0,Math.round(rect.bottom));
  }

  function placeTopUi(){
    const headerBottom=getHeaderBottom();
    const gap=10;
    const stack=document.getElementById('routeFunctionStack');
    if(stack)stack.style.top=`${headerBottom+gap}px`;
    const bubble=document.getElementById('routeManeuverBubble');
    if(bubble)bubble.style.top=`${headerBottom+gap}px`;
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
    const canvasRect=canvas.getBoundingClientRect();
    const headerBottom=getHeaderBottom();
    const top=Math.max(10,Math.round(headerBottom-canvasRect.top+10));
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
    placeTopUi();
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
  observer.observe(document.body,{subtree:true,childList:true,characterData:true});
  document.addEventListener('trasy:route-map-ready',scheduleSync);
  document.addEventListener('trasy:gps-speed',scheduleSync);
  document.addEventListener('trasy:road-speed-limit',scheduleSync);
  window.addEventListener('resize',scheduleSync,{passive:true});
  setInterval(sync,1000);
  sync();
})();