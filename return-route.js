(()=>{
  const body=document.getElementById('scheduleBody');
  const controls=document.querySelector('#scheduleView .scheduleControls');
  const routeNameEl=document.getElementById('scheduleRouteName');
  const forwardTimeSelect=document.getElementById('scheduleTimeSelect');
  const time=globalThis.__trasyTime;
  const geo=globalThis.__trasyGeo;
  if(!body||!controls||!routeNameEl||!forwardTimeSelect||!time||!geo)return;

  let rawData=null,parkingRawData=null,direction='forward',loading=null,parkingLoading=null,applying=false,forwardCourseTime='',emptyRun=false;
  let forceReturnOriginOnce=false,suppressObserverUntil=0,selectedParking=null,parkingChoicePending=false;
  let parkingTransitionPending=false,completedReturnArrival='';
  let modeNoticeTimer=0;
  const parkingData=import('./parking-data.js');

  const RETURN_START_RADIUS_M=350;
  const RETURN_START_OUTSIDE_M=450;
  const RETURN_DEPARTURE_DELTA_M=25;
  const RETURN_DEPARTURE_FIXES=2;
  const RETURN_NEXT_HEADING_MAX=85;
  const RETURN_WARNING_MS=20000;
  let returnStartArmed=false,returnMinStartDistance=Infinity,returnDepartureFixes=0;
  let returnLastPosition=null,returnDerivedHeading=null,returnWarningTimer=0;

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

  function showModeNotice(text){
    let notice=document.getElementById('routeModeNotice');
    if(!notice){
      notice=document.createElement('div');
      notice.id='routeModeNotice';
      notice.className='routeModeNotice';
      notice.setAttribute('role','status');
      notice.setAttribute('aria-live','polite');
      notice.innerHTML='<span></span><button type="button" aria-label="Zamknij">×</button>';
      notice.querySelector('button').onclick=()=>{notice.hidden=true;clearTimeout(modeNoticeTimer)};
      document.body.append(notice);
    }
    notice.querySelector('span').textContent=text;
    notice.hidden=false;
    clearTimeout(modeNoticeTimer);
    modeNoticeTimer=setTimeout(()=>{notice.hidden=true},7000);
  }


  function hideReturnWarning(){
    clearTimeout(returnWarningTimer);returnWarningTimer=0;
    const el=document.getElementById('returnEarlyDepartureWarning');
    if(el)el.hidden=true;
  }
  function resetReturnOriginTracking(){
    returnStartArmed=false;returnMinStartDistance=Infinity;returnDepartureFixes=0;
    returnLastPosition=null;returnDerivedHeading=null;hideReturnWarning();
  }
  function returnPlanDate(){
    const match=String(body.dataset.returnStart||'').trim().match(/^(\d{1,2}):(\d{2})$/);
    if(!match)return null;
    const date=new Date();date.setHours(Number(match[1]),Number(match[2]),0,0);return date;
  }
  function showReturnWarning(){
    let el=document.getElementById('returnEarlyDepartureWarning');
    if(!el){
      el=document.createElement('div');el.id='returnEarlyDepartureWarning';
      el.setAttribute('role','status');el.setAttribute('aria-live','polite');document.body.append(el);
    }
    const plan=String(body.dataset.returnStart||'').trim();
    el.innerHTML=`<div>ODJECHAŁEŚ PRZED CZASEM</div><small>Planowany start: ${plan}</small><button type="button">OK</button>`;
    el.querySelector('button').onclick=hideReturnWarning;el.hidden=false;
    clearTimeout(returnWarningTimer);returnWarningTimer=setTimeout(hideReturnWarning,RETURN_WARNING_MS);
  }
  function clearReturnOrigin(reason){
    if(body.dataset.returnOriginActive!=='1')return;
    body.dataset.returnOriginActive='';
    body.dispatchEvent(new CustomEvent('return-origin-change',{bubbles:true,detail:{active:false,reason}}));
  }
  function onReturnPosition(position){
    if(direction!=='return'||emptyRun||body.dataset.returnOriginActive!=='1')return;
    const routeRows=[...body.querySelectorAll('tr:not([data-parking-row])')].filter(row=>geo.parseCoordinate(row.dataset.coordinate));
    if(routeRows.length<2)return;
    const accuracy=Number(position?.coords?.accuracy)||999;
    if(accuracy>120)return;
    const start=geo.parseCoordinate(routeRows[0].dataset.coordinate),next=geo.parseCoordinate(routeRows[1].dataset.coordinate);
    const here=[Number(position.coords.latitude),Number(position.coords.longitude)];
    if(!start||!next||!Number.isFinite(here[0])||!Number.isFinite(here[1]))return;

    const startDistance=geo.distanceMeters(here,start);
    if(!returnStartArmed){
      if(startDistance<=RETURN_START_RADIUS_M){returnStartArmed=true;returnMinStartDistance=startDistance}
      else if(startDistance>=RETURN_START_OUTSIDE_M){clearReturnOrigin('outside-start');return}
    }
    if(!returnStartArmed)return;
    returnMinStartDistance=Math.min(returnMinStartDistance,startDistance);

    let heading=Number(position.coords.heading);
    if(!Number.isFinite(heading)||heading<0){
      if(returnLastPosition&&geo.distanceMeters(returnLastPosition,here)>=6)heading=geo.bearingDegrees(returnLastPosition,here);
      else heading=returnDerivedHeading;
    }
    if(Number.isFinite(heading))returnDerivedHeading=heading;
    if(!returnLastPosition||geo.distanceMeters(returnLastPosition,here)>=2)returnLastPosition=here;

    const towardNext=Number.isFinite(returnDerivedHeading)&&geo.angleDifference(returnDerivedHeading,geo.bearingDegrees(here,next))<=RETURN_NEXT_HEADING_MAX;
    const movedAway=startDistance>=returnMinStartDistance+RETURN_DEPARTURE_DELTA_M;
    if(towardNext&&movedAway)returnDepartureFixes+=1;else returnDepartureFixes=0;
    if(returnDepartureFixes<RETURN_DEPARTURE_FIXES)return;

    const plan=returnPlanDate();
    const early=Boolean(plan&&Date.now()<plan.getTime());
    clearReturnOrigin('confirmed-departure');
    if(early)showReturnWarning();
  }

  function add15(t){return time.addMinutesToTime(t,15)}
  function resolveOutboundCourse(){
    const values=[...forwardTimeSelect.options].map(option=>option.value).filter(Boolean);
    return time.nearestClockTime?.(values,new Date())||time.nearestFutureTime(values,new Date())||forwardTimeSelect.value||'';
  }
  async function loadRaw(){if(rawData)return rawData;if(loading)return loading;loading=window.__trasyRouteDataService.load().then(data=>(rawData=data?.data??data,rawData)).finally(()=>loading=null);return loading}
  async function loadParkings(){if(parkingRawData)return parkingRawData;if(parkingLoading)return parkingLoading;const platform=window.__trasyPlatform;if(platform?.capabilities().parkings){parkingLoading=platform.parkings().then(data=>(parkingRawData=data,parkingRawData)).finally(()=>parkingLoading=null);return parkingLoading}if(platform?.profile?.requirePlatform)return null;return loadRaw()}
  function tableForRoute(data,name){if(!data||!name||Array.isArray(data))return null;const exact=data[name];if(Array.isArray(exact)&&Array.isArray(exact[0]))return exact;const key=Object.keys(data).find(k=>String(k).trim().toLowerCase()===String(name).trim().toLowerCase());return key&&Array.isArray(data[key])?data[key]:null}
  function returnMapFromTable(table){if(!table?.length)return new Map();const h=table[0].map(x=>String(x??'').trim().toUpperCase());let nc=h.findIndex(x=>x.includes('PRZYSTANEK')),rc=h.findIndex(x=>x.includes('LOKALIZACJA')&&x.includes('POWR'));if(nc<0)nc=0;if(rc<0)rc=3;const map=new Map();table.slice(1).forEach(row=>{const n=String(row?.[nc]??'').trim(),c=String(row?.[rc]??'').trim();if(n&&c)map.set(n.toLowerCase(),c)});return map}
  function rowName(row){return row.querySelector('td:first-child .stopMapButton span:last-child')?.textContent.trim()||row.querySelector('td:first-child')?.innerText.trim()||''}
  function remember(row){if(row.dataset.forwardTime==null)row.dataset.forwardTime=time.rowPlanText(row)}
  function setTime(row,value){const cell=row.children[1];if(!cell)return;cell.querySelectorAll('.punctualityLamp,.etaPunctuality').forEach(element=>element.remove());cell.textContent=value}

  function parkingDialog(options){
    return new Promise(resolve=>{
      let dialog=document.getElementById('parkingChoiceDialog');
      if(!dialog){dialog=document.createElement('div');dialog.id='parkingChoiceDialog';dialog.hidden=true;dialog.innerHTML='<div class="parkingChoiceCard" role="dialog" aria-modal="true" aria-labelledby="parkingChoiceTitle"><h2 id="parkingChoiceTitle">WYBIERZ BAZĘ / PARKING</h2><div class="parkingChoiceList"></div><button type="button" class="parkingChoiceCancel">ANULUJ</button></div>';document.body.append(dialog)}
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
      const options=getParkingOptions(await loadParkings(),routeNameEl.textContent.trim());
      if(!options.length){showModeNotice('Brak Bazy/Parkingu dla tej firmy lub trasy. Poproś administratora o uzupełnienie lokalizacji.');selectedParking=null;return false}
      selectedParking=options.length===1?options[0]:await parkingDialog(options);
      return !!selectedParking;
    }catch(error){console.error('Parkingi:',error);showModeNotice('Nie udało się pobrać parkingów. Sprawdź połączenie i spróbuj ponownie.');selectedParking=null;return false}
    finally{parkingChoicePending=false;returnSwitch.disabled=false;emptySwitch.disabled=false}
  }

  async function startParkingLegAfterReturn(arrival){
    if(direction!=='return'||emptyRun||parkingTransitionPending)return;
    const routeRows=[...body.querySelectorAll('tr:not([data-parking-row])')].filter(row=>row.dataset.coordinate);
    const index=Number(arrival?.index);
    if(!routeRows.length||index!==routeRows.length-1)return;
    const arrivalKey=String(arrival?.key||`${index}:${routeRows[index]?.dataset.coordinate||''}`);
    if(completedReturnArrival===arrivalKey)return;
    completedReturnArrival=arrivalKey;
    parkingTransitionPending=true;
    try{
      if(!(await chooseReturnParking()))return;
      emptyRun=true;
      emptySwitch.checked=true;
      body.dataset.emptyRun='1';
      applyDirection();
      body.dispatchEvent(new CustomEvent('route-mode-change',{
        bubbles:true,
        detail:{direction,emptyRun,parking:selectedParking,reason:'return-completed'}
      }));
    }finally{parkingTransitionPending=false}
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
      else if(direction==='return'&&forceReturnOriginOnce){
        body.dataset.returnOriginActive='1';delete body.dataset.gpsNextStop;delete body.dataset.gpsNextStopKey;
        displayRows.forEach(row=>row.classList.remove('gpsNextStop','isActiveStop'));
        resetReturnOriginTracking();forceReturnOriginOnce=false;
        body.dispatchEvent(new CustomEvent('return-origin-change',{bubbles:true,detail:{active:true,reason:'return-start'}}));
      }
      else if(direction!=='return'){body.dataset.returnOriginActive='';delete body.dataset.gpsNextStop;delete body.dataset.gpsNextStopKey;resetReturnOriginTracking()}
      body.dispatchEvent(new CustomEvent('route-direction-change',{bubbles:true,detail:{direction,returnStart:start,outboundCourse:forwardCourseTime,returnOriginActive:body.dataset.returnOriginActive==='1',emptyRun,parking:selectedParking}}));
    }finally{applying=false}
  }

  returnSwitch.addEventListener('change',async()=>{
    direction=returnSwitch.checked?'return':'forward';
    if(direction==='return'){
      forwardCourseTime=resolveOutboundCourse();
      forceReturnOriginOnce=true;
      completedReturnArrival='';
      if(emptyRun&&!(await chooseReturnParking())){emptyRun=false;emptySwitch.checked=false;body.dataset.emptyRun=''}
    }else{selectedParking=null;completedReturnArrival=''}
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
  body.addEventListener('gps-stop-arrival',event=>{startParkingLegAfterReturn(event.detail).catch(error=>console.error('Powrót do Bazy/Parkingu:',error))});
  document.addEventListener('trasy:route-data-updated',event=>{rawData=event.detail?.data??event.detail??null});
  window.__trasyGps?.subscribe?.(onReturnPosition,()=>{});
  new MutationObserver(mutations=>{if(applying||Date.now()<suppressObserverUntil)return;if(mutations.some(mutation=>mutation.type==='childList'))setTimeout(enrichRows,60)}).observe(body,{childList:true});
  setTimeout(enrichRows,200);
})();
