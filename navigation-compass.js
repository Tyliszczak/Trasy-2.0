(()=>{
  const MAX_TILT_DEG=30;
  const TILT_RATIO=.5;
  let map=null;

  const style=document.createElement('style');
  style.textContent=`
    #routeNorthIndicator[hidden]{display:flex!important}
    #routeNorthIndicator{transform-origin:50% 68%;transition:transform 120ms linear}
  `;
  document.head.appendChild(style);

  function update(){
    const indicator=document.getElementById('routeNorthIndicator');
    if(!map||!indicator)return;
    const arrow=indicator.querySelector('.northArrow');
    const bearing=Number(map.getBearing?.())||0;
    const pitch=Math.max(0,Number(map.getPitch?.())||0);
    const tilt=Math.min(MAX_TILT_DEG,pitch*TILT_RATIO);

    indicator.hidden=false;
    indicator.style.transform=`perspective(90px) rotateX(${tilt}deg)`;
    indicator.dataset.compassTilt=String(Math.round(tilt));
    if(arrow)arrow.style.transform=`rotate(${-bearing}deg)`;
  }

  function attach(nextMap){
    if(!nextMap||nextMap===map)return;
    map=nextMap;
    for(const eventName of ['rotate','rotateend','pitch','pitchend','moveend']){
      map.on(eventName,update);
    }
    update();
  }

  document.addEventListener('trasy:route-map-ready',event=>attach(event.detail?.map||window.__routeMap));
  if(window.__routeMap)attach(window.__routeMap);
})();
