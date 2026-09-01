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
    #routeFunctionStack>#routeNorthIndicator,
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
    #routeFunctionStack>#routeNorthIndicator{
      width:42px!important;
      height:42px!important;
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
      document.getElementById('routeFeedbackButton'),
      document.getElementById('routeNorthIndicator')
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

  function sync(){
    ensureStack();
    restoreRightMapControls();
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
  window.addEventListener('resize',scheduleSync,{passive:true});
  setInterval(sync,1000);
  sync();
})();