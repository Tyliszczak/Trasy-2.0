(()=>{
  const controls=document.querySelector('#scheduleView .scheduleControls');
  const heading=document.querySelector('#scheduleView .scheduleHeading');
  if(!controls||!heading)return;

  const UNKNOWN_LIMIT_LABEL='Brak danych o ograniczeniu prędkości';
  const style=document.createElement('style');
  style.textContent=`
    #scheduleSpeedBox{display:inline-flex;align-items:center;gap:10px;white-space:nowrap;z-index:2}
    #scheduleSpeedBox .routeSpeedLimit{width:54px;height:54px;border-width:5px;font-size:22px}
    #scheduleSpeedBox .routeCurrentSpeed{min-width:68px;font-size:30px}
    #scheduleSpeedBox .routeCurrentSpeed small{font-size:10px}
    .routeSpeedLimitWrap{display:grid;justify-items:center}
    .routeSpeedLimit{width:40px;height:40px;border:4px solid #e11d2e;border-radius:50%;background:#fff;color:#111;display:flex;align-items:center;justify-content:center;font:1000 17px/1 Arial,sans-serif;box-sizing:border-box}
    .routeSpeedStatus{display:none!important}
    .routeCurrentSpeed{min-width:58px;text-align:center;font:1000 22px/1 Arial,sans-serif;color:#fff}
    .routeCurrentSpeed small{display:block;margin-top:2px;font-size:8px;color:#aaa;letter-spacing:.05em}
    #routeMapSpeedBox{position:absolute;right:12px;top:12px;left:auto;bottom:auto;z-index:50130;display:flex;align-items:flex-start;gap:8px;padding:7px 8px;border-radius:12px;background:rgba(17,17,17,.5);box-shadow:0 2px 9px #0009;pointer-events:none}
    #routeMapSpeedBox .routeSpeedLimit{width:48px;height:48px;font-size:20px;border-width:4px}
    #routeMapSpeedBox .routeCurrentSpeed{min-width:58px;font-size:26px;text-shadow:0 1px 2px #000}
    #routeMapSpeedBox .routeCurrentSpeed small{font-size:9px}
    @media(max-width:520px){#scheduleSpeedBox{gap:7px}#scheduleSpeedBox .routeSpeedLimit{width:48px;height:48px;font-size:20px;border-width:4px}#scheduleSpeedBox .routeCurrentSpeed{min-width:60px;font-size:27px}#routeMapSpeedBox{right:10px;top:10px;left:auto;bottom:auto}}
  `;
  document.head.append(style);

  document.querySelectorAll('.routeSpeedStatus').forEach(el=>el.remove());
  const speedMarkup='<span class="routeSpeedLimitWrap" hidden><span class="routeSpeedLimit" aria-label="Ograniczenie prędkości"></span></span><span class="routeCurrentSpeed">0<small>km/h</small></span>';

  const box=document.createElement('div');
  box.id='scheduleSpeedBox';
  box.setAttribute('aria-label','Prędkość i ograniczenie prędkości');
  box.innerHTML=speedMarkup;
  heading.append(box);

  let mapBox=null;
  function ensureMapBox(){
    const canvas=document.getElementById('routeMapCanvas');
    if(!canvas)return null;
    if(mapBox?.isConnected)return mapBox;
    if(getComputedStyle(canvas).position==='static')canvas.style.position='relative';
    mapBox=document.createElement('div');
    mapBox.id='routeMapSpeedBox';
    mapBox.setAttribute('aria-label','Prędkość i ograniczenie prędkości');
    mapBox.innerHTML=speedMarkup;
    canvas.appendChild(mapBox);
    return mapBox;
  }

  function currentRoadLimit(){
    const value=Number(window.__routeRoadSpeedLimitKmh);
    return Number.isFinite(value)&&value>0?Math.round(value):null;
  }

  function renderOne(parent){
    if(!parent)return;
    const wrap=parent.querySelector('.routeSpeedLimitWrap');
    const limitEl=parent.querySelector('.routeSpeedLimit');
    const speedEl=parent.querySelector('.routeCurrentSpeed');
    const speed=Math.max(0,Number(window.__routeCurrentSpeedKmh)||0);
    const limit=currentRoadLimit();

    wrap.hidden=!limit;
    if(limit){
      wrap.removeAttribute('aria-label');
      limitEl.textContent=String(limit);
      limitEl.setAttribute('aria-label',`Ograniczenie prędkości ${limit} kilometrów na godzinę`);
    }else{
      wrap.setAttribute('aria-label',UNKNOWN_LIMIT_LABEL);
      limitEl.textContent='';
      limitEl.removeAttribute('aria-label');
    }
    limitEl.removeAttribute('title');
    speedEl.innerHTML=`${Math.round(speed)}<small>km/h</small>`;
  }

  function render(){
    renderOne(box);
    renderOne(ensureMapBox());
  }

  document.addEventListener('trasy:gps-speed',render);
  document.addEventListener('trasy:road-speed-limit',event=>{
    const value=Number(event.detail?.maxspeed);
    window.__routeRoadSpeedLimitKmh=Number.isFinite(value)&&value>0?value:null;
    render();
  });
  setInterval(render,1000);
  render();
})();