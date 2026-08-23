(()=>{
  const body=document.getElementById('scheduleBody');
  const guard=document.querySelector('#routeNextStop .nextStopGuard');
  if(!body||!guard)return;

  const style=document.createElement('style');
  style.textContent=`
    #stopScreenFlash{
      position:fixed;
      inset:0;
      z-index:2147483646;
      pointer-events:none;
      background:#fff;
      opacity:0;
      visibility:hidden;
      transition:opacity 70ms linear,visibility 0s linear 220ms;
    }
    #stopScreenFlash.on{
      opacity:.92;
      visibility:visible;
      transition:opacity 35ms linear,visibility 0s;
    }
    @media (prefers-reduced-motion:reduce){
      #stopScreenFlash{transition:none}
    }
  `;
  document.head.appendChild(style);

  const flash=document.createElement('div');
  flash.id='stopScreenFlash';
  flash.setAttribute('aria-hidden','true');
  document.body.appendChild(flash);

  let timer=null;
  let lastState='';
  let lastStopKey='';

  function stopKey(){
    const row=body.querySelector('tr.gpsNextStop');
    return[
      body.dataset.direction||'outbound',
      body.dataset.gpsNextStopKey||row?.dataset.stopId||row?.dataset.coordinate||'',
      row?.children?.[1]?.textContent?.trim()||''
    ].join('|');
  }

  function state(){
    if(guard.hidden)return'';
    if(guard.classList.contains('hold'))return'hold';
    if(guard.classList.contains('ready'))return'ready';
    if(guard.classList.contains('approach'))return'approach';
    return'';
  }

  function flashScreen(){
    clearTimeout(timer);
    flash.classList.remove('on');
    void flash.offsetWidth;
    flash.classList.add('on');
    timer=setTimeout(()=>flash.classList.remove('on'),150);
  }

  function sync(){
    const nextState=state();
    const nextStopKey=stopKey();
    if(nextState&&(
      nextState!==lastState||
      nextStopKey!==lastStopKey
    )){
      flashScreen();
    }
    lastState=nextState;
    lastStopKey=nextStopKey;
  }

  const observer=new MutationObserver(sync);
  observer.observe(guard,{
    attributes:true,
    attributeFilter:['class','hidden'],
    childList:true,
    characterData:true,
    subtree:true
  });

  body.addEventListener('gps-next-stop-change',()=>{
    lastState='';
    lastStopKey='';
  });
  body.addEventListener('route-direction-change',()=>{
    lastState='';
    lastStopKey='';
  });
  body.addEventListener('route-mode-change',()=>{
    lastState='';
    lastStopKey='';
  });

  sync();
})();
