(()=>{
  const body=document.getElementById('scheduleBody');
  const controls=document.querySelector('#scheduleView .scheduleControls');
  const routeNameEl=document.getElementById('scheduleRouteName');
  const forwardTimeSelect=document.getElementById('scheduleTimeSelect');
  if(!body||!controls||!routeNameEl||!forwardTimeSelect)return;

  let rawData=null,direction='forward',loading=null,applying=false,forwardCourseTime='',emptyRun=false;
  let forceReturnOriginOnce=false,suppressObserverUntil=0,selectedParking=null,parkingChoicePending=false;
  const parkingData=import('./parking-data.js');

  const switchGroup=document.createElement('div');
  switchGroup.className='routeModeSwitches';
  const switchLabel=document.createElement('label');
  switchLabel.className='returnRouteSwitchLabel';
  switchLabel.innerHTML='<span>POWRÓT</span><span class="returnSwitch"><input id="returnRouteSwitch" type="checkbox" role="switch" aria-label="Powrót"><span class="returnSlider"></span></span>';
  const emptyLabel=document.createElement('label');
  emptyLabel.className='emptyRouteSwitchLabel';
  emptyLabel.innerHTML='<span>NA PUSTO</span><span class="returnSwitch"><input id="emptyRouteSwitch" type="checkbox" role="switch" aria-label="Na pusto"><span class="returnSlider"></span></span>';
  switchGroup.append(switchLabel,emptyLabel);
  controls.append(switchGroup);
  const returnSwitch=switchLabel.querySelector('#returnRouteSwitch');
  const emptySwitch=emptyLabel.querySelector('#emptyRouteSwitch');
  const returnStartLabel=document.createElement('span');
  returnStartLabel.id='returnStartLabel';
  returnStartLabel.hidden=true;
  switchGroup.before(returnStartLabel);

  const style=document.createElement('style');
  style.textContent='.routeModeSwitches{display:flex;flex-direction:column;align-items:flex-end;gap:10px}.returnRouteSwitchLabel,.emptyRouteSwitchLabel{display:inline-flex;align-items:center;gap:5px;font-weight:900;white-space:nowrap;font-size:.78rem;margin:0;flex:0 0 auto}.returnSwitch{position:relative;display:inline-block;width:28px;height:16px;flex:0 0 28px}.returnSwitch input{opacity:0;width:0;height:0}.returnSlider{position:absolute;inset:0;border-radius:999px;background:#555;cursor:pointer;transition:.2s}.returnSlider:before{content:"";position:absolute;width:12px;height:12px;left:2px;top:2px;border-radius:50%;background:#fff;transition:.2s;box-shadow:0 1px 3px #0008}.returnSwitch input:checked+.returnSlider{background:#22c55e}.returnSwitch input:checked+.returnSlider:before{transform:translateX(12px)}#returnStartLabel{font-weight:900;color:#ccff33;white-space:nowrap}#parkingChoiceDialog[hidden]{display:none!important}#parkingChoiceDialog{position:fixed;inset:0;z-index:71000;display:flex;align-items:center;justify-content:center;padding:16px;background:#000c}.parkingChoiceCard{width:min(100%,480px);padding:18px;border:2px solid #ccff33;border-radius:14px;background:#222;box-shadow:0 12px 40px #000}.parkingChoiceCard h2{margin:0 0 14px}.parkingChoiceList{display:grid;gap:9px}.parkingChoiceButton{margin:0;padding:12px;background:#ccff33;color:#111}.parkingChoiceCancel{margin-top:12px;background:#555;color:#fff}@media(max-width:520px){.returnRouteSwitchLabel,.emptyRouteSwitchLabel{font-size:.7rem}}';
  document.head.append(style);

  function add15(t){const m=String(t||'').match(/^(\d{1,2}):(\d{2})$/);if(!m)return'';const x=(+m[1]*60 + +m[2]+15)%(24*60);return`${String(Math.floor(x/60)).padStart(2,'0')}:${String(x%60).padStart(2,'0')}`}
  function minutesOf(t){const m=String(t||'').match(/^(\d{1,2}):(\d{2})$/);return m?+m[1]*60 + +m[2]:null}
  function resolveOutboundCourse(){const now=new Date(),current=now.getHours()*60+now.getMinutes()+now.getSeconds()/60;const times=[...forwardTimeSelect.options].map(o=>o.value).filter(Boolean).map(t=>({t,m:minutesOf(t)})).filter(x=>x.m!==null);if(!times.length)return forwardCourseTime||forwardTimeSelect.value||'';times.sort((a,b)=>Math.abs(a.m-current)-Math.abs(b.m-current)||a.m-b.m);return times[0].t}
  async function loadRaw(){if(rawData)return rawData;if(loading)return loading;loading=window.__trasyRouteDataService.load().then(data=>(rawData=data?.data??data,rawData)).finally(()=>loading=null);return loading}
  function tableForRoute(data,name){if(!data||!name||Array.isArray(data))return null;const exact=data[name];if(Array.isArray(exact)&&Array.isArray(exact[0]))return exact;const key=Object.keys(data).find(k=>String(k).trim().toLowerCase()===String(name).trim().toLowerCase());return key&&Array.isArray(data[key])?data[key]:null}
  function returnMapFromTable(table){if(!table?.length)return new Map();const h=table[0].map(x=>String(x??'').trim().toUpperCase());let nc=h.findIndex(x=>x.includes('PRZYSTANEK')),rc=h.findIndex(x=>x.includes('LOKALIZACJA')&&x.includes('POWR'));if(nc<0)nc=0;if(rc<0)rc=3;const map=new Map();table.slice(1).forEach(row=>{const n=String(row?.[nc]??'').trim(),c=String(row?.[rc]??'').trim();if(n&&c)map.set(n.toLowerCase(),c)});return map}
  function rowName(row){return row.querySelector('td:first-child .stopMapButton span:last-child')?.textContent.trim()||row.querySelector('td:first-child')?.innerText.trim()||''}
  function remember(row){if(row.dataset.forwardTime==null)row.dataset.forwardTime=(row.children[1]?.firstChild?.textContent||row.children[1]?.textContent||'').trim()}
  function setTime(row,time){const cell=row.children[1];if(!cell)return;cell.querySelectorAll('.punctualityLamp,.etaPunctuality').forEach(element=>element.remove());cell.textContent=time}

  function parkingDialog(options){
    return new Promise(resolve=>{
      let dialog=document.getElementById('parkingChoiceDialog');
      if(!dialog){dialog=document.createElement('div');dialog.id='parkingChoiceDialog';dialog.hidden=true;dialog.innerHTML='<div class="parkingChoiceCard" role="dialog" aria-modal="true" aria-labelledby="parkingChoiceTitle"><h2 id="parkingChoiceTitle">WYBIERZ PARKING</h2><div class="parkingChoiceList"></div><button type="button" class="parkingChoiceCancel">ANULUJ</button></div>';document.body.append(dialog)}
      const list=dialog.querySelector('.parkingChoiceList');
      const finish=value=>{dialog.hidden=true;resolve(value)};
      list.replaceChildren(...options.map(parking=>{const button=document.createElement('button');button.type='button';button.className='parkingChoiceButton';button.textContent=parking.name;button.onclick=()=>finish(parking);return button}));
      dialog.querySelector('.parkingChoiceCancel').onclick=()=>finish(null);
      dialog.hidden=false;
      list.querySelector('button')?.focus();
    });
  }

  async function chooseReturnParking(){
    if(parkingChoicePending)return false;
    parkingChoicePending=true;
    returnSwitch.disabled=true;
    emptySwitch.disabled=true;
    try{
      const {getParkingOptions}=await parkingData;
      const options=getParkingOptions(await loadRaw(),routeNameEl.textContent.trim());
      if(!options.length){alert('Administrator nie wprowadził parkingu dla tej firmy lub trasy.');selectedParking=null;return false}
      selectedParking=options.length===1?options[0]:await parkingDialog(options);
      return !!selectedParking;
    }catch(error){console.error('Parkingi:',error);alert('Nie udało się pobrać parkingów.');selectedParking=null;return false}
    finally{parkingChoicePending=false;returnSwitch.disabled=false;emptySwitch.disabled=false}
  }

  function createParkingRow(parking,sampleRow){
    const row=document.createElement('tr');
    row.dataset.parkingRow='1';
    row.dataset.stopId=`parking:${parking.coordinates}`;
    row.dataset.coordinate=parking.coordinates;
    row.dataset.forwardCoordinate=parking.coordinates;
    row.dataset.returnCoordinate=parking.coordinates;
    const name=document.createElement('td');name.textContent=parking.name;
    const type=document.createElement('td');type.textContent='PARKING';
    const action=document.createElement('td');action.className='routeCell';
    const template=sampleRow?.querySelector('.routeLink');
    const link=template?template.cloneNode(true):document.createElement('a');
    link.className='routeLink routeIconLink';
    link.href=`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(parking.coordinates)}`;
    link.title=`Nawiguj do parkingu ${parking.name}`;
    link.setAttribute('role','button');
    link.setAttribute('aria-label',`Uruchom nawigację do parkingu ${parking.name}`);
    if(!template)link.textContent='NAWIGUJ';
    action.append(link);row.append(name,type,action);
    return row;
  }

  async function enrichRows(){
    if(applying)return;
    const rows=[...body.querySelectorAll('tr:not([data-parking-row])')];
    if(!rows.length)return;
    rows.forEach((row,index)=>{if(row.dataset.routeOrder==null)row.dataset.routeOrder=String(index);if(!row.dataset.forwardCoordinate)row.dataset.forwardCoordinate=row.dataset.coordinate||'';remember(row)});
    try{const table=tableForRoute(await loadRaw(),routeNameEl.textContent.trim()),returns=returnMapFromTable(table);rows.forEach(row=>{const coordinate=returns.get(rowName(row).toLowerCase());if(coordinate)row.dataset.returnCoordinate=coordinate})}catch(error){console.warn('Punkty powrotne:',error)}
    applyDirection();
  }

  function applyDirection(){
    if(applying)return;
    applying=true;
    suppressObserverUntil=Date.now()+500;
    try{
      body.querySelectorAll('tr[data-parking-row]').forEach(row=>row.remove());
      const rows=[...body.querySelectorAll('tr')];
      if(!rows.length)return;
      rows.forEach(remember);
      const ordered=rows.slice().sort((a,b)=>(+a.dataset.routeOrder||0)-(+b.dataset.routeOrder||0));
      if(direction==='return')ordered.reverse();
      const start=add15(forwardCourseTime||resolveOutboundCourse());
      ordered.forEach((row,index)=>{row.hidden=false;row.dataset.coordinate=direction==='return'?(row.dataset.returnCoordinate||row.dataset.forwardCoordinate||''):(row.dataset.forwardCoordinate||'');setTime(row,direction==='return'?(index===0?start:''):(row.dataset.forwardTime||''));body.append(row)});
      const displayRows=ordered.slice();
      if(direction==='return'&&emptyRun&&selectedParking){const parkingRow=createParkingRow(selectedParking,ordered[ordered.length-1]);body.append(parkingRow);displayRows.push(parkingRow)}
      forwardTimeSelect.hidden=direction==='return';
      returnStartLabel.hidden=direction!=='return';
      returnStartLabel.textContent=direction==='return'?`START ${start}`:'';
      body.dataset.direction=direction;
      body.dataset.returnStart=direction==='return'?start:'';
      body.dataset.outboundCourse=direction==='return'?forwardCourseTime:'';
      body.dataset.selectedParking=direction==='return'&&emptyRun&&selectedParking?selectedParking.name:'';
      if(emptyRun){const target=displayRows.length-1;body.dataset.returnOriginActive='';body.dataset.gpsNextStop=String(target);displayRows.forEach((row,index)=>{const active=index===target;row.hidden=!active;row.classList.toggle('gpsNextStop',active);row.classList.toggle('isActiveStop',active)})}
      else if(direction==='return'&&forceReturnOriginOnce){body.dataset.returnOriginActive='1';body.dataset.gpsNextStop='0';displayRows.forEach((row,index)=>{const active=index===0;row.classList.toggle('gpsNextStop',active);row.classList.toggle('isActiveStop',active)});forceReturnOriginOnce=false}
      else if(direction!=='return'){body.dataset.returnOriginActive='';delete body.dataset.gpsNextStop}
      body.dispatchEvent(new CustomEvent('route-direction-change',{bubbles:true,detail:{direction,returnStart:start,outboundCourse:forwardCourseTime,returnOriginActive:body.dataset.returnOriginActive==='1',emptyRun,parking:selectedParking}}));
    }finally{applying=false}
  }

  returnSwitch.addEventListener('change',async()=>{
    direction=returnSwitch.checked?'return':'forward';
    if(direction==='return'){
      forwardCourseTime=resolveOutboundCourse();
      forceReturnOriginOnce=true;
      if(emptyRun&&!(await chooseReturnParking())){emptyRun=false;emptySwitch.checked=false;body.dataset.emptyRun=''}
    }else selectedParking=null;
    applyDirection();
  });
  emptySwitch.addEventListener('change',async()=>{
    const requested=emptySwitch.checked;
    if(requested&&direction==='return'&&!(await chooseReturnParking())){emptySwitch.checked=false;return}
    emptyRun=requested;
    if(!emptyRun)selectedParking=null;
    body.dataset.emptyRun=emptyRun?'1':'';
    applyDirection();
    body.dispatchEvent(new CustomEvent('route-mode-change',{bubbles:true,detail:{direction,emptyRun,parking:selectedParking}}));
  });
  forwardTimeSelect.addEventListener('change',()=>{if(direction==='forward')forwardCourseTime=forwardTimeSelect.value});
  new MutationObserver(mutations=>{if(applying||Date.now()<suppressObserverUntil)return;if(mutations.some(mutation=>mutation.type==='childList'))setTimeout(enrichRows,60)}).observe(body,{childList:true});
  setTimeout(enrichRows,200);
})();
