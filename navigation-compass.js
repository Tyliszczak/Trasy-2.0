(()=>{
  const MAX_TILT_DEG=30;
  const TILT_RATIO=.5;
  let map=null;

  const style=document.createElement('style');
  style.textContent=`
    #routeNorthIndicator[hidden]{display:flex!important}
    #routeNorthIndicator{
      width:54px!important;height:54px!important;border-radius:50%!important;padding:0!important;
      border:1px solid rgba(255,255,255,.72)!important;
      background:radial-gradient(circle at 38% 30%,rgba(70,76,86,.96),rgba(18,21,26,.98) 62%,rgba(5,6,8,.99))!important;
      box-shadow:0 3px 12px #000b,inset 0 0 0 2px rgba(255,255,255,.08),inset 0 -5px 9px rgba(0,0,0,.34)!important;
      overflow:hidden!important;transform-origin:50% 70%;transition:transform 120ms linear;
    }
    #routeNorthIndicator .compassCard{display:block;width:100%;height:100%;margin:0!important;transform-origin:50% 50%;will-change:transform;filter:drop-shadow(0 1px 1px #0008)}
    #routeNorthIndicator .compassSvg{display:block;width:100%;height:100%}
    #routeNorthIndicator .compassLabel{font:800 7px/1 Arial,sans-serif;fill:#d6d9df;paint-order:stroke;stroke:#090b0e;stroke-width:1.1px}
    #routeNorthIndicator .compassLabelNorth{fill:#ff4a4a;font-size:8px;font-weight:1000}
  `;
  document.head.appendChild(style);

  function ensureFace(indicator){
    if(indicator.querySelector('.compassCard'))return;
    indicator.innerHTML=`
      <div class="northArrow compassCard" aria-hidden="true">
        <svg class="compassSvg" viewBox="0 0 64 64" focusable="false">
          <circle cx="32" cy="32" r="29" fill="none" stroke="rgba(255,255,255,.36)" stroke-width="1.2"/>
          <circle cx="32" cy="32" r="24.5" fill="none" stroke="rgba(255,255,255,.12)" stroke-width=".8"/>
          <g stroke-linecap="round">
            <path d="M32 4v5M60 32h-5M32 60v-5M4 32h5" stroke="#f4f6f8" stroke-width="2"/>
            <path d="M12.2 12.2l3.7 3.7M51.8 12.2l-3.7 3.7M51.8 51.8l-3.7-3.7M12.2 51.8l3.7-3.7" stroke="rgba(255,255,255,.55)" stroke-width="1.4"/>
            <path d="M21.3 6.1l1.8 4.3M42.7 6.1l-1.8 4.3M57.9 21.3l-4.3 1.8M57.9 42.7l-4.3-1.8M42.7 57.9l-1.8-4.3M21.3 57.9l1.8-4.3M6.1 42.7l4.3-1.8M6.1 21.3l4.3 1.8" stroke="rgba(255,255,255,.3)" stroke-width="1"/>
          </g>
          <text x="32" y="14" text-anchor="middle" class="compassLabel compassLabelNorth">N</text>
          <text x="51" y="34.5" text-anchor="middle" class="compassLabel">E</text>
          <text x="32" y="54" text-anchor="middle" class="compassLabel">S</text>
          <text x="13" y="34.5" text-anchor="middle" class="compassLabel">W</text>
          <path d="M32 15 L37.5 33 L32 30 L26.5 33 Z" fill="#ff3b30" stroke="#ffd3d0" stroke-width=".8"/>
          <path d="M32 49 L37.5 31 L32 34 L26.5 31 Z" fill="#f3f5f7" stroke="#aeb4bc" stroke-width=".8"/>
          <circle cx="32" cy="32" r="4.1" fill="#14171b" stroke="#eef1f4" stroke-width="1.2"/>
          <circle cx="32" cy="32" r="1.5" fill="#ccff33"/>
        </svg>
      </div>`;
  }

  function update(){
    const indicator=document.getElementById('routeNorthIndicator');
    if(!map||!indicator)return;
    ensureFace(indicator);
    enableOverviewControl(indicator);
    const card=indicator.querySelector('.compassCard');
    const bearing=Number(map.getBearing?.())||0;
    const pitch=Math.max(0,Number(map.getPitch?.())||0);
    const tilt=Math.min(MAX_TILT_DEG,pitch*TILT_RATIO);

    indicator.hidden=false;
    indicator.style.transform=`perspective(110px) rotateX(${tilt}deg)`;
    indicator.dataset.compassTilt=String(Math.round(tilt));
    indicator.dataset.compassBearing=String(Math.round((bearing+360)%360));
    if(card)card.style.transform=`rotate(${-bearing}deg)`;
  }

  function currentRouteBounds(){
    const geometry=window.__trasyLastRouteGeometry?.geometry;
    if(geometry?.type!=='LineString'||!Array.isArray(geometry.coordinates))return null;
    let west=Infinity;
    let south=Infinity;
    let east=-Infinity;
    let north=-Infinity;
    let points=0;
    for(const coordinate of geometry.coordinates){
      const longitude=Number(coordinate?.[0]);
      const latitude=Number(coordinate?.[1]);
      if(!Number.isFinite(longitude)||!Number.isFinite(latitude))continue;
      west=Math.min(west,longitude);
      south=Math.min(south,latitude);
      east=Math.max(east,longitude);
      north=Math.max(north,latitude);
      points++;
    }
    return points>=2?[[west,south],[east,north]]:null;
  }

  function showWholeRoute(event){
    event?.preventDefault?.();
    event?.stopPropagation?.();
    const bounds=currentRouteBounds();
    if(!bounds)return;
    window.__routeShowOverview?.(bounds);
  }

  function enableOverviewControl(indicator){
    if(indicator.dataset.overviewControl==='1')return;
    indicator.dataset.overviewControl='1';
    indicator.setAttribute('role','button');
    indicator.setAttribute('tabindex','0');
    indicator.setAttribute('aria-label','Pokaż całą trasę w 2D, północ u góry');
    indicator.title='Pokaż całą trasę w 2D, północ u góry';
    indicator.addEventListener('click',showWholeRoute);
    indicator.addEventListener('keydown',event=>{
      if(event.key==='Enter'||event.key===' ')showWholeRoute(event);
    });
  }

  function attach(nextMap){
    if(!nextMap||nextMap===map)return;
    map=nextMap;
    for(const eventName of ['rotate','rotateend','pitch','pitchend','moveend']){
      map.on(eventName,update);
    }
    update();
  }

  window.__routeCompassUpdate=update;
  document.addEventListener('trasy:route-map-ready',event=>attach(event.detail?.map||window.__routeMap));
  if(window.__routeMap)attach(window.__routeMap);
})();
