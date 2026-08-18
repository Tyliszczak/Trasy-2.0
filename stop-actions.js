(()=>{
  const body=document.getElementById('scheduleBody');
  if(!body)return;

  const modal=document.createElement('div');
  modal.id='nextStopActions';
  modal.hidden=true;
  modal.style.cssText=`
    position:fixed;
    inset:0;
    z-index:70000;
    background:#0009;
    display:flex;
    align-items:flex-end;
    justify-content:center;
    padding:14px;
    box-sizing:border-box
  `;

  modal.innerHTML=`
    <div style="
      width:min(100%,520px);
      background:#1d1d1d;
      border:1px solid #555;
      border-radius:16px;
      padding:16px;
      box-shadow:0 8px 30px #000b
    ">
      <div id="nextStopActionsTitle" style="font-size:20px;font-weight:900;color:#ccff33"></div>
      <div id="nextStopActionsMeta" style="margin-top:5px;color:#ddd;font-size:14px"></div>
      <div style="display:grid;gap:9px;margin-top:16px">
        <button id="nextStopShowRoute" type="button" style="padding:13px;font-weight:900">POKAŻ TRASĘ DO PRZYSTANKU</button>
        <button id="nextStopSkip" type="button" style="padding:13px;font-weight:900;background:#ffb000;color:#111">POMIŃ PRZYSTANEK</button>
        <button id="nextStopCancel" type="button" style="padding:13px;font-weight:900">ANULUJ</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const title=modal.querySelector('#nextStopActionsTitle');
  const meta=modal.querySelector('#nextStopActionsMeta');
  const showRoute=modal.querySelector('#nextStopShowRoute');
  const skip=modal.querySelector('#nextStopSkip');
  const cancel=modal.querySelector('#nextStopCancel');

  function rows(){
    return [...body.querySelectorAll('tr')]
      .filter(r=>r.dataset.coordinate);
  }

  function current(){
    const rs=rows();
    let idx=Number(body.dataset.gpsNextStop);
    if(!Number.isInteger(idx)||idx<0||idx>=rs.length){
      idx=rs.findIndex(r=>r.classList.contains('gpsNextStop'));
    }
    if(idx<0)idx=0;
    const row=rs[idx];
    if(!row)return null;
    const name=row.querySelector('td:first-child')?.childNodes[0]?.textContent?.trim()
      ||row.querySelector('td:first-child')?.innerText?.trim()
      ||`Przystanek ${idx+1}`;
    const time=String(row.children[1]?.firstChild?.textContent||row.children[1]?.textContent||'').trim();
    const m=String(row.dataset.coordinate||'').match(/(-?\d+(?:\.\d+)?)\s*[,; ]\s*(-?\d+(?:\.\d+)?)/);
    const coord=m?[+m[1],+m[2]]:null;
    return{rs,idx,row,name,time,coord};
  }

  function open(){
    const s=current();
    if(!s)return;
    title.textContent=s.name;
    meta.textContent=s.time?`Planowany czas: ${s.time}`:'';
    skip.disabled=s.idx>=s.rs.length-1;
    skip.textContent=skip.disabled?'OSTATNI PRZYSTANEK':'POMIŃ PRZYSTANEK';
    modal.hidden=false;
  }

  function close(){modal.hidden=true}

  showRoute.onclick=()=>{
    const s=current();
    if(!s?.coord)return;
    const destination=`${s.coord[0]},${s.coord[1]}`;
    const openDirections=origin=>{
      const url='https://www.google.com/maps/dir/?api=1'
        +`&origin=${encodeURIComponent(origin)}`
        +`&destination=${encodeURIComponent(destination)}`
        +'&travelmode=driving';
      window.open(url,'_blank','noopener');
    };
    if(navigator.geolocation){
      navigator.geolocation.getCurrentPosition(
        p=>openDirections(`${p.coords.latitude},${p.coords.longitude}`),
        ()=>openDirections('Current Location'),
        {enableHighAccuracy:true,timeout:7000,maximumAge:3000}
      );
    }else{
      openDirections('Current Location');
    }
    close();
  };

  skip.onclick=()=>{
    const s=current();
    if(!s||s.idx>=s.rs.length-1)return;
    const nextIndex=s.idx+1;
    const nextRow=s.rs[nextIndex];
    const nextName=nextRow?.querySelector('td:first-child')?.childNodes[0]?.textContent?.trim()
      ||nextRow?.querySelector('td:first-child')?.innerText?.trim()
      ||`Przystanek ${nextIndex+1}`;
    if(!confirm(`Pominąć przystanek „${s.name}” i jechać do „${nextName}”?`))return;
    body.dispatchEvent(new CustomEvent('gps-skip-stop',{
      bubbles:true,
      detail:{index:nextIndex,skippedIndex:s.idx,skippedName:s.name}
    }));
    close();
  };

  cancel.onclick=close;
  modal.addEventListener('click',e=>{if(e.target===modal)close()});

  document.addEventListener('click',e=>{
    const bubble=e.target.closest?.('.activeStopEtaBubble');
    const next=e.target.closest?.('#routeNextStop');
    if(!bubble&&!next)return;
    const nav=document.getElementById('routeMapNav');
    if(!nav||nav.hidden)return;
    e.preventDefault();
    e.stopPropagation();
    open();
  },true);
})();
