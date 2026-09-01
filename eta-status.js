import{planDateForRow}from'./schedule-time.js';
import'./eta-core.js';
import'./geo-core.js';

(()=>{
  const body=document.getElementById('scheduleBody');
  const view=document.getElementById('scheduleView');
  const etaCore=globalThis.__trasyEta;
  const geo=globalThis.__trasyGeo;
  if(!body||!view||!navigator.geolocation||!etaCore||!geo)return;

  const ROUTE_REFRESH_MS=180000;
  const MAX_GPS_ACCURACY=120;
  const FINAL_ARRIVAL_RADIUS=70;

  let pos=null,watch=null,lastRouteAt=0,lastTarget=null;
  let etaSeconds=null,etaMeasuredAt=0,requesting=false;
  let infoEl=null,infoRow=null;

  const coord=value=>geo.parseCoordinate(value);
  function activeRow(){return body.querySelector('tr.gpsNextStop')}
  function routeRows(){return [...body.querySelectorAll('tr')].filter(r=>r.dataset.coordinate)}
  function returnOriginLocked(){return body.dataset.direction==='return'&&body.dataset.emptyRun!=='1'&&body.dataset.returnOriginActive==='1'}
  function isReturnStartRow(row){const rows=routeRows();return body.dataset.direction==='return'&&!!row&&rows.length>0&&row===rows[0]}
  function isFinalRow(row){const rows=routeRows();return !!row&&rows.length>0&&row===rows[rows.length-1]}
  function isFinalArrived(row){if(!isFinalRow(row)||!pos)return false;const c=coord(row.dataset.coordinate);if(!c)return false;return geo.distanceMeters([pos.lat,pos.lng],c)<=Math.max(FINAL_ARRIVAL_RADIUS,Math.min(90,(pos.accuracy||0)*1.2))}
  function guardIsShowing(){const state=String(body.dataset.stopGuard||'');return state==='hold'||state==='ready'}
  function planSeconds(row){const now=new Date(),plan=planDateForRow(routeRows(),row,now);return plan?(plan.getTime()-now.getTime())/1000:null}
  function liveEta(){if(etaSeconds===null||!etaMeasuredAt)return null;return Math.max(0,etaSeconds-(Date.now()-etaMeasuredAt)/1000)}
  function arrivalClock(seconds){if(!Number.isFinite(seconds))return'';const d=new Date(Date.now()+seconds*1000);return`${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`}

  function ensureInfo(row){
    if(!row)return null;
    if(infoEl&&infoRow===row&&infoEl.isConnected)return infoEl;
    if(infoEl?.isConnected)infoEl.remove();
    infoEl=document.createElement('div');
    infoEl.className='etaPunctuality neutral';
    row.querySelector('td:nth-child(2)')?.appendChild(infoEl);
    infoRow=row;
    return infoEl;
  }
  function setInfo(info,className,text){
    if(!info)return;
    if(info.className!==className)info.className=className;
    if(info.textContent!==text)info.textContent=text;
  }
  function hideInfo(row=infoRow){
    const info=row?ensureInfo(row):infoEl;
    if(info)setInfo(info,'etaPunctuality neutral','');
  }
  function clearInfo(){if(infoEl?.isConnected)infoEl.remove();infoEl=null;infoRow=null}
  function resetEta(){lastTarget=null;etaSeconds=null;etaMeasuredAt=0;clearInfo()}

  async function refreshEta(force=false){
    if(returnOriginLocked()){resetEta();return}
    const row=activeRow();
    if(requesting||!row||!pos)return;
    if(isReturnStartRow(row)){etaSeconds=null;etaMeasuredAt=0;lastTarget=row;hideInfo(row);return}
    if(isFinalArrived(row)){etaSeconds=null;etaMeasuredAt=0;lastTarget=row;return}
    const c=coord(row.dataset.coordinate);if(!c)return;
    const changed=lastTarget!==row;
    if(!force&&!changed&&Date.now()-lastRouteAt<ROUTE_REFRESH_MS)return;
    const nav=document.getElementById('routeMapNav');if(nav&&!nav.hidden)return;
    requesting=true;lastRouteAt=Date.now();lastTarget=row;
    try{
      const url=`https://router.project-osrm.org/route/v1/driving/${pos.lng},${pos.lat};${c[1]},${c[0]}?overview=false&steps=false`;
      const res=await fetch(url,{cache:'no-store'});
      const data=await res.json();
      const value=data?.routes?.[0]?.duration;
      if(Number.isFinite(value)){etaSeconds=value;etaMeasuredAt=Date.now()}
    }catch(err){console.warn('ETA:',err)}finally{requesting=false}
  }

  function render(){
    if(view.hidden)return;
    if(returnOriginLocked()){if(infoRow)hideInfo(infoRow);return}
    const row=activeRow();
    if(!row){clearInfo();return}
    if(isReturnStartRow(row)){hideInfo(row);return}
    const info=ensureInfo(row);if(!info)return;
    if(guardIsShowing()){hideInfo(row);return}
    if(body.dataset.direction==='return'){
      if(isFinalArrived(row)){hideInfo(row);return}
      const etaSecondsLive=liveEta();
      if(etaSecondsLive===null){hideInfo(row);return}
      setInfo(info,'etaPunctuality returnArrival',`Dojazd ${arrivalClock(etaSecondsLive)}`);
      body.dataset.etaKind='returnArrival';body.dataset.etaDiffSeconds='';body.dataset.etaSeconds=String(etaSecondsLive);
      body.dispatchEvent(new CustomEvent('eta-status-change',{bubbles:true,detail:{kind:'returnArrival',diffSeconds:null,etaSeconds:etaSecondsLive}}));
      return;
    }
    if(isFinalArrived(row)){
      setInfo(info,'etaPunctuality onTime','👍');
      row.style.setProperty('--gps-status-color','#34c759');body.dataset.etaKind='arrived';body.dataset.etaDiffSeconds='0';body.dataset.etaSeconds='0';body.dispatchEvent(new CustomEvent('eta-status-change',{bubbles:true,detail:{kind:'arrived',diffSeconds:0,etaSeconds:0}}));return
    }
    const etaSecondsLive=liveEta();if(etaSecondsLive===null){hideInfo(row);return}
    const plan=planSeconds(row);if(plan===null){hideInfo(row);return}
    const punctuality=etaCore.statusFromEta(etaSecondsLive,plan);const kind=punctuality.kind;const diff=punctuality.diffSeconds;
    const color=kind==='late'?'#ff3b30':kind==='early'?'#ffd60a':'#34c759';
    row.style.setProperty('--gps-status-color',color);
    setInfo(info,`etaPunctuality ${kind}`,punctuality.text);
    body.dataset.etaKind=kind;body.dataset.etaDiffSeconds=String(diff);body.dataset.etaSeconds=String(etaSecondsLive);
    body.dispatchEvent(new CustomEvent('eta-status-change',{bubbles:true,detail:{kind,diffSeconds:diff,etaSeconds:etaSecondsLive}}));
  }

  body.addEventListener('nav-eta-update',event=>{
    if(returnOriginLocked())return;
    const row=activeRow();
    if(row&&isReturnStartRow(row))return;
    if(row&&isFinalArrived(row))return;
    const seconds=Number(event.detail?.etaSeconds);
    if(Number.isFinite(seconds)){etaSeconds=seconds;etaMeasuredAt=Date.now();render()}
  });
  body.addEventListener('gps-next-stop-change',()=>{resetEta();refreshEta(true).then(render)});
  body.addEventListener('route-direction-change',()=>{resetEta();setTimeout(()=>refreshEta(true).then(render),0)});
  body.addEventListener('route-mode-change',()=>{resetEta();setTimeout(()=>refreshEta(true).then(render),0)});
  body.addEventListener('return-origin-change',event=>{
    resetEta();
    if(event.detail?.active===true||returnOriginLocked()){render();return}
    setTimeout(()=>refreshEta(true).then(render),0);
  });
  body.addEventListener('stop-guard-change',()=>render());
  function start(){if(watch!==null)return;watch=window.__trasyGps.subscribe(p=>{pos={lat:p.coords.latitude,lng:p.coords.longitude,accuracy:p.coords.accuracy||999};if(pos.accuracy<=MAX_GPS_ACCURACY){refreshEta().then(render)}},()=>{})}
  start();
  setInterval(()=>{if(!view.hidden&&pos?.accuracy<=MAX_GPS_ACCURACY){refreshEta();render()}},1000);
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')start()});
})();