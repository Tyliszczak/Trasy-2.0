(()=>{
  const TOP_SAFE=150;
  const BOTTOM_SAFE=75;
  const SIDE_SAFE=20;

  let busy=false;

  function elements(){
    const badge=document.querySelector('#routeMapNav .activeStopEtaBubble');
    const text=document.getElementById('offscreenText');
    const panel=text?.closest('button');
    const marker=badge?.parentElement;
    return{badge,text,panel,marker};
  }

  function markerSafelyVisible(marker){
    if(!marker)return false;

    const r=marker.getBoundingClientRect();

    if(!r.width&&!r.height)return false;

    return(
      r.left>=SIDE_SAFE&&
      r.right<=window.innerWidth-SIDE_SAFE&&
      r.top>=TOP_SAFE&&
      r.bottom<=window.innerHeight-BOTTOM_SAFE
    );
  }

  function sync(){
    if(busy)return;

    const nav=document.getElementById('routeMapNav');
    if(!nav||nav.hidden)return;

    const {badge,text,panel,marker}=elements();
    if(!badge||!text||!panel||!marker)return;

    busy=true;

    try{
      const visible=markerSafelyVisible(marker);

      if(visible){
        panel.hidden=true;
        badge.style.display='';
        return;
      }

      text.textContent=badge.textContent||text.textContent;

      const cs=getComputedStyle(badge);
      panel.style.background=cs.backgroundColor||panel.style.background;
      panel.style.color=cs.color||panel.style.color;

      badge.style.display='none';
      panel.hidden=false;
    }finally{
      busy=false;
    }
  }

  const observer=new MutationObserver(()=>{
    queueMicrotask(sync);
  });

  observer.observe(document.body,{
    subtree:true,
    childList:true,
    attributes:true,
    attributeFilter:['hidden','style']
  });

  window.addEventListener('resize',sync,{passive:true});
  window.addEventListener('orientationchange',sync,{passive:true});

  setInterval(sync,250);
})();
