(()=>{
  const body=document.getElementById('scheduleBody');
  if(!body||!navigator.geolocation)return;

  const START_RADIUS_M=350;
  const DEPARTURE_DELTA_M=25;
  const CONFIRM_FIXES=2;
  const NEXT_HEADING_MAX=85;
  const WARNING_MS=20000;

  let armed=false;
  let warned=false;
  let minStartDistance=Infinity;
  let departureFixes=0;
  let lastPos=null;
  let derivedHeading=null;
  let warningTimer=null;

  const style=document.createElement('style');
  style.textContent='@keyframes returnEarlyDeparturePulse{0%,100%{transform:translateX(-50%) scale(1);box-shadow:0 8px 28px #000c}50%{transform:translateX(-50%) scale(1.018);box-shadow:0 8px 32px #e11d2e88}}#returnEarlyDepartureWarning[hidden]{display:none!important}#returnEarlyDepartureWarning{position:fixed;z-index:100001;left:50%;top:18px;transform:translateX(-50%);width:min(92vw,520px);padding:16px 18px;border:3px solid #fff;border-radius:12px;background:#e11d2e;color:#fff;box-shadow:0 8px 28px #000c;text-align:center;font-size:1.12rem;font-weight:1000;line-height:1.2;letter-spacing:.02em;pointer-events:auto;animation:returnEarlyDeparturePulse 1.6s ease-in-out infinite}#returnEarlyDepartureWarning small{display:block;margin-top:5px;font-size:.78rem;font-weight:800;opacity:.95}#returnEarlyDepartureWarning button{display:block;margin:12px auto 0;min-width:94px;padding:8px 18px;border:2px solid #fff;border-radius:9px;background:#fff;color:#9f1020;font:1000 .95rem/1 Arial,sans-serif;cursor:pointer}';
  document.head.append(style);

  function parseCoord(v){
    const m=String(v||'').match(/(-?\d+(?:\.\d+)?)\s*[,; ]\s*(-?\d+(?:\.\d+)?)/);
    return m?[+m[1],+m[2]]:null;
  }
  function dist(a,b){
    const R=6371000,p=Math.PI/180,dLat=(b[0]-a[0])*p,dLon=(b[1]-a[1])*p;
    const x=Math.sin(dLat/2)**2+Math.cos(a[0]*p)*Math.cos(b[0]*p)*Math.sin(dLon/2)**2;
    return 2*R*Math.asin(Math.sqrt(x));
  }
  function bearing(a,b){
    const p=Math.PI/180,lat1=a[0]*p,lat2=b[0]*p,dLon=(b[1]-a[1])*p;
    const y=Math.sin(dLon)*Math.cos(lat2);
    const x=Math.cos(lat1)*Math.sin(lat2)-Math.sin(lat1)*Math.cos(lat2)*Math.cos(dLon);
    return(Math.atan2(y,x)*180/Math.PI+360)%360;
  }
  function angle(a,b){return Math.abs(((a-b+540)%360)-180)}
  function rows(){return [...body.querySelectorAll('tr')].filter(r=>parseCoord(r.dataset.coordinate))}
  function planDate(){
    const t=String(body.dataset.returnStart||'').trim();
    const m=t.match(/^(\d{1,2}):(\d{2})$/);
    if(!m)return null;
    const d=new Date();d.setHours(+m[1],+m[2],0,0);return d;
  }
  function hideWarning(){
    clearTimeout(warningTimer);
    warningTimer=null;
    const el=document.getElementById('returnEarlyDepartureWarning');
    if(el)el.hidden=true;
  }
  function reset(){
    armed=false;
    warned=false;
    minStartDistance=Infinity;
    departureFixes=0;
    lastPos=null;
    derivedHeading=null;
    hideWarning();
  }
  function showWarning(plan){
    let el=document.getElementById('returnEarlyDepartureWarning');
    if(!el){
      el=document.createElement('div');
      el.id='returnEarlyDepartureWarning';
      el.setAttribute('role','status');
      el.setAttribute('aria-live','polite');
      document.body.append(el);
    }
    el.innerHTML=`<div>ODJECHAŁEŚ PRZED CZASEM</div><small>Planowany start: ${plan}</small><button type="button">OK</button>`;
    el.querySelector('button').onclick=hideWarning;
    el.hidden=false;
    clearTimeout(warningTimer);
    warningTimer=setTimeout(hideWarning,WARNING_MS);
  }

  function onPos(p){
    if(body.dataset.direction!=='return')return;
    const plan=planDate();
    if(!plan||Date.now()>=plan.getTime())return;
    const rs=rows();
    if(rs.length<2)return;
    const start=parseCoord(rs[0].dataset.coordinate),next=parseCoord(rs[1].dataset.coordinate);
    if(!start||!next)return;
    const here=[p.coords.latitude,p.coords.longitude];
    const accuracy=Number(p.coords.accuracy)||999;
    if(accuracy>120)return;

    let h=Number(p.coords.heading);
    if(!Number.isFinite(h)||h<0){
      if(lastPos&&dist(lastPos,here)>=6)h=bearing(lastPos,here);
      else h=derivedHeading;
    }
    if(Number.isFinite(h))derivedHeading=h;
    if(!lastPos||dist(lastPos,here)>=2)lastPos=here;

    const dStart=dist(here,start);
    if(dStart<=START_RADIUS_M){
      armed=true;
      minStartDistance=Math.min(minStartDistance,dStart);
    }
    if(!armed||warned)return;

    const towardNext=Number.isFinite(derivedHeading)&&angle(derivedHeading,bearing(here,next))<=NEXT_HEADING_MAX;
    const movedAway=dStart>=minStartDistance+DEPARTURE_DELTA_M;
    if(towardNext&&movedAway)departureFixes++;else departureFixes=0;

    if(departureFixes>=CONFIRM_FIXES){
      warned=true;
      showWarning(String(body.dataset.returnStart||''));
    }
  }

  window.__trasyGps.subscribe(onPos,()=>{});
  body.addEventListener('route-direction-change',reset);
  body.addEventListener('schedule-rendered',reset);
})();
