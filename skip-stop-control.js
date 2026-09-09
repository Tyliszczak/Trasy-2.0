(()=>{
  const body=document.getElementById('scheduleBody');
  if(!body)return;

  const modal=document.createElement('div');
  modal.id='routeStopActions';
  modal.hidden=true;
  modal.style.cssText=`
    position:fixed;
    inset:0;
    z-index:70100;
    background:#0008;
    display:flex;
    align-items:flex-end;
    justify-content:center;
    padding:14px;
    box-sizing:border-box;
    backdrop-filter:blur(3px);
    -webkit-backdrop-filter:blur(3px)
  `;
  modal.innerHTML=`
    <div style="width:min(100%,520px);background:#242424;border:1px solid #ffffff33;border-radius:20px;padding:18px;box-shadow:0 16px 44px #000a">
      <div id="routeStopActionsTitle" style="font-size:20px;font-weight:900;color:#fff"></div>
      <div id="routeStopActionsMeta" style="margin-top:6px;color:#ccff33;font-size:16px;font-weight:800"></div>
      <div style="display:grid;gap:10px;margin-top:18px">
        <button id="routeStopShowSegment" type="button" style="min-height:50px;padding:12px;border:1px solid #666;border-radius:12px;background:#393939;color:#fff;font-weight:900">POKAŻ ODCINEK</button>
        <button id="routeStopSkip" type="button" style="min-height:52px;padding:12px;border:0;border-radius:12px;background:#ccff33;color:#111;font-weight:1000">POMIŃ</button>
        <button id="routeStopPrevious" type="button" style="min-height:50px;padding:12px;border:1px solid #666;border-radius:12px;background:#393939;color:#fff;font-weight:900">POPRZEDNI PRZYSTANEK</button>
        <button id="routeStopCancel" type="button" style="min-height:50px;padding:12px;border:1px solid #666;border-radius:12px;background:#303030;color:#fff;font-weight:900">ANULUJ</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  const title=modal.querySelector('#routeStopActionsTitle');
  const meta=modal.querySelector('#routeStopActionsMeta');
  const showSegment=modal.querySelector('#routeStopShowSegment');
  const skip=modal.querySelector('#routeStopSkip');
  const previous=modal.querySelector('#routeStopPrevious');
  const cancel=modal.querySelector('#routeStopCancel');
  let confirmingSkip=false;

  function rows(){return [...body.querySelectorAll('tr')].filter(r=>r.dataset.coordinate)}
  function parseCoord(v){const m=String(v||'').match(/(-?\d+(?:\.\d+)?)\s*[,; ]\s*(-?\d+(?:\.\d+)?)/);return m?[+m[1],+m[2]]:null}
  function currentIndex(){const rs=rows();let idx=Number(body.dataset.gpsNextStop);if(Number.isInteger(idx)&&idx>=0&&idx<rs.length)return idx;idx=rs.findIndex(r=>r.classList.contains('gpsNextStop'));return idx>=0?idx:0}
  function currentStop(){
    const rs=rows(),idx=currentIndex(),row=rs[idx];
    if(!row)return null;
    const name=row.querySelector('td:first-child')?.childNodes[0]?.textContent?.trim()||row.querySelector('td:first-child')?.innerText?.trim()||`Przystanek ${idx+1}`;
    const time=String(row.children[1]?.firstChild?.textContent||row.children[1]?.textContent||'').trim();
    return{rs,idx,row,name,time,coord:parseCoord(row.dataset.coordinate)};
  }
  function openMenu(confirmSkip=false){
    const nav=document.getElementById('routeMapNav');
    const navOpen=Boolean(nav&&!nav.hidden);
    const scheduleOpen=document.getElementById('scheduleView')?.hidden===false;
    if(!navOpen&&!scheduleOpen)return;
    const s=currentStop();if(!s)return;
    if(navOpen)window.__routeEnterManualView?.();
    window.__routeStopActionsOpen=true;
    confirmingSkip=Boolean(confirmSkip&&s.idx<s.rs.length-1);
    if(confirmingSkip){
      title.textContent='Pominąć przystanek?';
      meta.textContent=s.name;
      showSegment.hidden=true;
      previous.hidden=true;
      skip.hidden=false;
      skip.textContent='POMIŃ';
    }else{
      title.textContent=s.name;
      meta.textContent=s.time?`Plan: ${s.time}`:'';
      showSegment.hidden=!navOpen;
      previous.hidden=s.idx<=0||body.dataset.emptyRun==='1';
      skip.hidden=s.idx>=s.rs.length-1;
      skip.textContent='POMIŃ';
    }
    cancel.textContent='ANULUJ';
    modal.hidden=false;
  }
  function closeMenu(){modal.hidden=true;window.__routeStopActionsOpen=false;confirmingSkip=false}
  function showSegmentOnMap(){
    const s=currentStop(),map=window.__routeMap;
    if(!s?.coord||!map)return;
    window.__routeEnterManualView?.();
    const fit=here=>{try{const bounds=new maplibregl.LngLatBounds();bounds.extend([here[1],here[0]]);bounds.extend([s.coord[1],s.coord[0]]);map.fitBounds(bounds,{padding:{top:90,bottom:110,left:55,right:55},maxZoom:16,duration:650})}catch{}};
    if(navigator.geolocation){navigator.geolocation.getCurrentPosition(p=>fit([p.coords.latitude,p.coords.longitude]),()=>{},{enableHighAccuracy:true,timeout:7000,maximumAge:3000})}
    closeMenu();
  }

  function selectPreviousStop(){
    const s=currentStop();
    if(!s||s.idx<=0)return;
    body.dispatchEvent(new CustomEvent('gps-skip-stop',{
      bubbles:true,
      detail:{index:s.idx-1,source:'manual-previous'}
    }));
    closeMenu();
  }

  function skipCurrentStop(){
    const s=currentStop();
    if(!s||s.idx>=s.rs.length-1)return;
    if(!confirmingSkip){openMenu(true);return}
    body.dispatchEvent(new CustomEvent('gps-skip-current-stop',{
      bubbles:true,
      detail:{expectedIndex:s.idx,source:'manual-skip'}
    }));
    closeMenu();
  }

  function ensureQuickSkipButton(){
    const header=document.getElementById('routeNextStop');
    if(!header||document.getElementById('routeSkipCurrentButton'))return;
    const button=document.createElement('button');
    button.id='routeSkipCurrentButton';
    button.type='button';
    button.textContent='POMIŃ';
    button.setAttribute('aria-label','Pomiń aktualny przystanek');
    header.append(button);
    updateQuickSkipButton();
  }

  function updateQuickSkipButton(){
    const button=document.getElementById('routeSkipCurrentButton');
    if(!button)return;
    const s=currentStop();
    button.hidden=!s||s.idx>=s.rs.length-1||body.dataset.returnOriginActive==='1';
    if(s&&!button.hidden)button.setAttribute('aria-label',`Pomiń przystanek ${s.name}`);
  }

  function updateScheduleSkipButton(){
    body.querySelectorAll('.scheduleSkipStopButton').forEach(button=>button.remove());
    if(document.getElementById('scheduleView')?.hidden!==false)return;
    const s=currentStop();
    if(!s||s.idx>=s.rs.length-1||body.dataset.returnOriginActive==='1')return;
    const cell=s.row.querySelector('td:first-child');
    if(!cell)return;
    const button=document.createElement('button');
    button.type='button';
    button.className='scheduleSkipStopButton';
    button.textContent='POMIŃ';
    button.setAttribute('aria-label',`Pomiń przystanek ${s.name}`);
    button.addEventListener('click',event=>{
      event.preventDefault();
      event.stopPropagation();
      openMenu(true);
    });
    cell.append(button);
  }

  function updateSkipControls(){
    updateQuickSkipButton();
    updateScheduleSkipButton();
  }

  showSegment.addEventListener('click',showSegmentOnMap);
  skip.addEventListener('click',skipCurrentStop);
  previous.addEventListener('click',selectPreviousStop);
  cancel.addEventListener('click',closeMenu);
  modal.addEventListener('click',e=>{if(e.target===modal)closeMenu()});
  document.addEventListener('click',e=>{
    const nav=document.getElementById('routeMapNav');if(!nav||nav.hidden)return;
    const quickSkip=e.target.closest?.('#routeSkipCurrentButton');
    if(quickSkip){
      e.preventDefault();e.stopPropagation();
      openMenu(true);
      return;
    }
    const nextLabel=e.target.closest?.('#routeNextStop');
    const bubble=e.target.closest?.('.activeStopEtaBubble');
    const marker=e.target.closest?.('.maplibregl-marker');
    const activeMarker=marker?.querySelector?.('.activeStopEtaBubble');
    if(!nextLabel&&!bubble&&!activeMarker)return;
    e.preventDefault();e.stopPropagation();
    window.__routeEnterManualView?.();
    openMenu();
  },true);
  body.addEventListener('gps-next-stop-change',updateSkipControls);
  body.addEventListener('return-origin-change',updateSkipControls);
  body.addEventListener('route-direction-change',()=>setTimeout(updateSkipControls,0));
  body.addEventListener('schedule-rendered',()=>setTimeout(updateSkipControls,0));
  setTimeout(()=>{ensureQuickSkipButton();updateSkipControls()},0);
})();
