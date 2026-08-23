(()=>{
  const body=document.getElementById('scheduleBody');
  const view=document.getElementById('scheduleView');
  if(!body||!view||!navigator.geolocation)return;

  const TOLERANCE_SECONDS=30;
  const ROUTE_REFRESH_MS=180000;
  const MAX_GPS_ACCURACY=120;
  const FINAL_ARRIVAL_RADIUS=70;

  let pos=null,watch=null,lastRouteAt=0,lastTarget=null;
  let etaSeconds=null,etaMeasuredAt=0,requesting=false;
  let infoEl=null,infoRow=null;

  const style=document.createElement('style');
  style.textContent=`#scheduleBody .punctualityLamp{display:none!important}#scheduleBody .etaPunctuality{display:block;margin-top:4px;font-size:12px;line-height:1.15;font-weight:1000;white-space:nowrap}#scheduleBody .etaPunctuality.onTime{color:#34c759}#scheduleBody .etaPunctuality.early{color:#d6a900}#scheduleBody .etaPunctuality.late{color:#ff3b30}#scheduleBody .etaPunctuality.neutral{color:#aaa}#scheduleBody .etaPunctuality.returnStartHold{color:#ffd60a}#scheduleBody .etaPunctuality.returnStartReady{color:#34c759}#scheduleBody .etaPunctuality.arrived{color:#fff!important}`;
  document.head.append(style);

  function coord(v){const m=String(v||'').match(/(-?\d+(?:\.\d+)?)\s*[,; ]\s*(-?\d+(?:\.\d+)?)/);return m?[+m[1],+m[2]]:null}
  function distanceMeters(a,b){const R=6371000,p=Math.PI/180,dLat=(b[0]-a[0])*p,dLon=(b[1]-a[1])*p,x=Math.sin(dLat/2)**2+Math.cos(a[0]*p)*Math.cos(b[0]*p)*Math.sin(dLon/2)**2;return 2*R*Math.asin(Math.sqrt(x))}
  function activeRow(){return body.querySelector('tr.gpsNextStop')}
  function routeRows(){return [...body.querySelectorAll('tr')].filter(r=>r.dataset.coordinate)}
  function isFinalRow(row){const rows=routeRows();return !!row&&rows.length>0&&row===rows[rows.length-1]}
  function isFinalArrived(row){if(!isFinalRow(row)||!pos)return false;const c=coord(row.dataset.coordinate);if(!c)return false;return distanceMeters([pos.lat,pos.lng],c)<=Math.max(FINAL_ARRIVAL_RADIUS,Math.min(90,(pos.accuracy||0)*1.2))}
  function isReturnOrigin(row){const rows=routeRows();return body.dataset.direction==='return'&&body.dataset.returnOriginActive==='1'&&row===rows[0]&&Number(body.dataset.gpsNextStop||0)===0}
  function guardIsShowing(){return !!body.querySelector('tr.gpsNextStop .stopGuardNotice')}
  function planSeconds(row){const text=String(row?.children[1]?.firstChild?.textContent||row?.children[1]?.textContent||'').trim();const m=text.match(/^(\d{1,2}):(\d{2})/);if(!m)return null;const now=new Date(),plan=new Date(now);plan.setHours(+m[1],+m[2],0,0);return(plan.getTime()-now.getTime())/1000}
  function liveEta(){if(etaSeconds===null||!etaMeasuredAt)return null;return Math.max(0,etaSeconds-(Date.now()-etaMeasuredAt)/1000)}
  function fullMinutesLabel(diff){if(Math.abs(diff)<=TOLERANCE_SECONDS)return'0 min';const full=Math.max(1,Math.floor(Math.abs(diff)/60));return diff<0?`+${full} min`:`−${full} min`}

  function ensureInfo(row){if(!row)return null;if(infoEl&&infoRow===row&&infoEl.isConnected)return infoEl;if(infoEl?.isConnected)infoEl.remove();infoEl=document.createElement('div');infoEl.className='etaPunctuality';row.querySelector('td:first-child')?.appendChild(infoEl);infoRow=row;return infoEl}
  function clearInfo(){if(infoEl?.isConnected)infoEl.remove();infoEl=null;infoRow=null}

  async function refreshEta(force=false){const row=activeRow();if(requesting||!row||!pos)return;if(isReturnOrigin(row)||isFinalArrived(row)){etaSeconds=null;etaMeasuredAt=0;lastTarget=row;return}const c=coord(row.dataset.coordinate);if(!c)return;const changed=lastTarget!==row;if(!force&&!changed&&Date.now()-lastRouteAt<ROUTE_REFRESH_MS)return;const nav=document.getElementById('routeMapNav');if(nav&&!nav.hidden)return;requesting=true;lastRouteAt=Date.now();lastTarget=row;try{const url=`https://router.project-osrm.org/route/v1/driving/${pos.lng},${pos.lat};${c[1]},${c[0]}?overview=false&steps=false`;const res=await fetch(url,{cache:'no-store'});const data=await res.json();const value=data?.routes?.[0]?.duration;if(Number.isFinite(value)){etaSeconds=value;etaMeasuredAt=Date.now()}}catch(err){console.warn('ETA:',err)}finally{requesting=false}}

  function render(){if(view.hidden)return;const row=activeRow();if(!row){clearInfo();return}if(guardIsShowing()){clearInfo();return}const info=ensureInfo(row);if(!info)return;
    if(isFinalArrived(row)){info.className='etaPunctuality arrived';info.textContent='JESTEŚ NA MIEJSCU';row.style.setProperty('--gps-status-color','#34c759');body.dataset.etaKind='arrived';body.dataset.etaDiffSeconds='0';body.dataset.etaSeconds='0';body.dispatchEvent(new CustomEvent('eta-status-change',{bubbles:true,detail:{kind:'arrived',diffSeconds:0,etaSeconds:0}}));return}
    if(isReturnOrigin(row)){clearInfo();return}
    const eta=liveEta();if(eta===null){info.textContent='';info.className='etaPunctuality neutral';return}const etaMin=Math.max(0,Math.ceil(eta/60));const plan=planSeconds(row);if(plan===null){info.className='etaPunctuality neutral';info.textContent=`dojazd za ${etaMin} min`;return}const diff=eta-plan;let kind='onTime';if(diff>TOLERANCE_SECONDS)kind='late';else if(diff<-TOLERANCE_SECONDS)kind='early';const color=kind==='late'?'#ff3b30':kind==='early'?'#ffd60a':'#34c759';row.style.setProperty('--gps-status-color',color);info.className=`etaPunctuality ${kind}`;info.textContent=`dojazd za ${etaMin} min • ${fullMinutesLabel(diff)}`;body.dataset.etaKind=kind;body.dataset.etaDiffSeconds=String(diff);body.dataset.etaSeconds=String(eta);body.dispatchEvent(new CustomEvent('eta-status-change',{bubbles:true,detail:{kind,diffSeconds:diff,etaSeconds:eta}}))}

  body.addEventListener('nav-eta-update',e=>{const row=activeRow();if(row&&(isReturnOrigin(row)||isFinalArrived(row)))return;const seconds=Number(e.detail?.etaSeconds);if(Number.isFinite(seconds)){etaSeconds=seconds;etaMeasuredAt=Date.now();render()}});
  body.addEventListener('gps-next-stop-change',e=>{if(Number(e.detail?.index)>0)body.dataset.returnOriginActive='';lastTarget=null;etaSeconds=null;etaMeasuredAt=0;clearInfo();refreshEta(true).then(render)});
  body.addEventListener('stop-guard-change',()=>render());
  function start(){if(watch!==null)return;watch=window.__trasyGps.subscribe(p=>{pos={lat:p.coords.latitude,lng:p.coords.longitude,accuracy:p.coords.accuracy||999};if(pos.accuracy<=MAX_GPS_ACCURACY){refreshEta().then(render)}},()=>{})}
  start();setInterval(()=>{if(!view.hidden&&pos?.accuracy<=MAX_GPS_ACCURACY){refreshEta();render()}},1000);document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')start()});
})();
