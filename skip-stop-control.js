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
    background:#0009;
    display:flex;
    align-items:flex-end;
    justify-content:center;
    padding:14px;
    box-sizing:border-box
  `;
  modal.innerHTML=`
    <div style="width:min(100%,520px);background:#1d1d1d;border:1px solid #555;border-radius:16px;padding:16px;box-shadow:0 8px 30px #000b">
      <div id="routeStopActionsTitle" style="font-size:20px;font-weight:900;color:#ccff33"></div>
      <div id="routeStopActionsMeta" style="margin-top:5px;color:#ddd;font-size:14px"></div>
      <div style="display:grid;gap:9px;margin-top:16px">
        <button id="routeStopShowSegment" type="button" style="padding:13px;font-weight:900">POKAŻ ODCINEK DO PRZYSTANKU</button>
        <button id="routeStopSkip" type="button" style="padding:13px;font-weight:1000;background:#9f1d2c;color:#fff">POMIŃ TEN PRZYSTANEK</button>
        <button id="routeStopPrevious" type="button" style="padding:13px;font-weight:900;background:#2d5f94;color:#fff">WRÓĆ DO POPRZEDNIEGO PRZYSTANKU</button>
        <button id="routeStopCancel" type="button" style="padding:13px;font-weight:900">ANULUJ</button>
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
    if(!nav||nav.hidden)return;
    const s=currentStop();if(!s)return;
    window.__routeEnterManualView?.();
    window.__routeStopActionsOpen=true;
    title.textContent=s.name;meta.textContent=s.time?`Plan: ${s.time}`:'';
    previous.hidden=s.idx<=0||body.dataset.emptyRun==='1';
    skip.hidden=s.idx>=s.rs.length-1;
    confirmingSkip=Boolean(confirmSkip&&!skip.hidden);
    skip.textContent=confirmingSkip?`POTWIERDŹ POMINIĘCIE: ${s.name}`:'POMIŃ TEN PRZYSTANEK';
    skip.style.background=confirmingSkip?'#e11d2e':'#9f1d2c';
    if(confirmingSkip)meta.textContent='Nawigacja natychmiast przejdzie do kolejnego przystanku.';
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
    if(!confirmingSkip){
      confirmingSkip=true;
      meta.textContent='Nawigacja natychmiast przejdzie do kolejnego przystanku.';
      skip.textContent=`POTWIERDŹ POMINIĘCIE: ${s.name}`;
      skip.style.background='#e11d2e';
      return;
    }
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
  body.addEventListener('gps-next-stop-change',updateQuickSkipButton);
  body.addEventListener('return-origin-change',updateQuickSkipButton);
  body.addEventListener('route-direction-change',()=>setTimeout(updateQuickSkipButton,0));
  body.addEventListener('schedule-rendered',()=>setTimeout(updateQuickSkipButton,0));
  setTimeout(ensureQuickSkipButton,0);
})();
