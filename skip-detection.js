(()=>{
  const body=document.getElementById('scheduleBody');
  const nav=document.getElementById('routeMapNav');
  if(!body||!nav||!navigator.geolocation)return;

  const MAX_ACCURACY=80;
  const MIN_TARGET_DISTANCE=160;
  const GROWTH_METERS=12;
  const CONFIRM_FIXES=3;
  const AWAY_ANGLE=95;
  const TOWARD_ANGLE=55;
  const COOLDOWN_MS=45000;
  const MIN_SPEED_MPS=1.5;

  let watch=null,lastPos=null,lastPosAt=0,headingAnchor=null,heading=null,lastTargetDistance=Infinity,awayFixes=0,lastPromptAt=0,lastPromptKey='',currentEtaKind='';

  function coord(v){const m=String(v||'').match(/(-?\d+(?:\.\d+)?)\s*[,; ]\s*(-?\d+(?:\.\d+)?)/);return m?[+m[1],+m[2]]:null}
  function dist(a,b){const R=6371000,p=Math.PI/180,dLat=(b[0]-a[0])*p,dLon=(b[1]-a[1])*p,x=Math.sin(dLat/2)**2+Math.cos(a[0]*p)*Math.cos(b[0]*p)*Math.sin(dLon/2)**2;return 2*R*Math.asin(Math.sqrt(x))}
  function bear(a,b){const p=Math.PI/180,y=Math.sin((b[1]-a[1])*p)*Math.cos(b[0]*p),x=Math.cos(a[0]*p)*Math.sin(b[0]*p)-Math.sin(a[0]*p)*Math.cos(b[0]*p)*Math.cos((b[1]-a[1])*p);return(Math.atan2(y,x)*180/Math.PI+360)%360}
  function angle(a,b){return Math.abs(((a-b+540)%360)-180)}
  function rows(){return [...body.querySelectorAll('tr')].filter(r=>coord(r.dataset.coordinate))}
  function currentIndex(){const rs=rows();let i=Number(body.dataset.gpsNextStop);if(Number.isInteger(i)&&i>=0&&i<rs.length)return i;i=rs.findIndex(r=>r.classList.contains('gpsNextStop'));return i>=0?i:0}
  function rowName(r){return r?.querySelector('td:first-child')?.childNodes[0]?.textContent?.trim()||r?.querySelector('td:first-child')?.innerText?.trim()||'Przystanek'}
  function skipPromptAllowed(){return currentEtaKind==='onTime'||currentEtaKind==='late'}
  function captureEta(event){currentEtaKind=String(event.detail?.kind||'')}

  function ensureModal(){
    let modal=document.getElementById('skipDetectionDialog');if(modal)return modal;
    modal=document.createElement('div');modal.id='skipDetectionDialog';modal.hidden=true;
    modal.style.cssText='position:fixed;left:50%;top:86px;z-index:100002;width:min(90vw,520px);transform:translateX(-50%);padding:0;box-sizing:border-box;pointer-events:auto';
    modal.innerHTML=`<div style="background:#241b08f2;border:2px solid #ffb020;border-radius:12px;padding:12px 13px;box-shadow:0 5px 18px #000b,0 0 0 0 #ffb02066;color:#fff">
      <div style="font-size:.82rem;font-weight:1000;color:#ffca55;letter-spacing:.03em">OMIJASZ PRZYSTANEK</div>
      <div id="skipDetectionText" style="margin-top:4px;font-size:1rem;line-height:1.22;font-weight:900;color:#fff"></div>
      <div id="skipDetectionList" style="margin-top:7px;color:#fff;font-size:.93rem;font-weight:800;line-height:1.25"></div>
      <div style="display:flex;flex-wrap:wrap;gap:7px;margin-top:10px">
        <button id="skipDetectionOne" type="button" style="flex:1 1 145px;padding:9px 10px;border:1px solid #fff6;border-radius:9px;background:#d97706;color:#fff;font-weight:1000">POMIŃ</button>
        <button id="skipDetectionAll" type="button" style="flex:1 1 145px;padding:9px 10px;border:1px solid #fff6;border-radius:9px;background:#b91c1c;color:#fff;font-weight:1000">POMIŃ WSZYSTKIE</button>
        <button id="skipDetectionNo" type="button" style="flex:1 1 100%;padding:9px 10px;border:1px solid #fff6;border-radius:9px;background:#444;color:#fff;font-weight:900">NIE — JADĘ DO PRZYSTANKU</button>
      </div>
    </div>`;
    document.body.append(modal);return modal;
  }

  function closePrompt(){const m=document.getElementById('skipDetectionDialog');if(m)m.hidden=true;window.__routeStopActionsOpen=false}

  function promptSkip(fromIndex,toIndex,reason='detected'){
    if(!skipPromptAllowed())return;
    const rs=rows();if(!rs[fromIndex]||toIndex<=fromIndex)return;
    const skipped=rs.slice(fromIndex,toIndex).map(rowName);if(!skipped.length)return;
    const key=`${reason}:${fromIndex}:${toIndex}:${skipped.join('|')}`;
    if(key===lastPromptKey&&Date.now()-lastPromptAt<COOLDOWN_MS)return;
    lastPromptKey=key;lastPromptAt=Date.now();
    const modal=ensureModal(),text=modal.querySelector('#skipDetectionText'),list=modal.querySelector('#skipDetectionList'),one=modal.querySelector('#skipDetectionOne'),all=modal.querySelector('#skipDetectionAll'),no=modal.querySelector('#skipDetectionNo');
    text.textContent=reason==='resume'
      ?(skipped.length===1?`Minąłeś przystanek „${skipped[0]}”. Pominąć go?`:`Minąłeś ${skipped.length} przystanki. Co zrobić?`)
      :(skipped.length===1?`Wygląda na to, że omijasz „${skipped[0]}”. Pominąć ten przystanek?`:`Wygląda na to, że omijasz ${skipped.length} przystanki. Co zrobić?`);
    list.innerHTML=skipped.length>1?skipped.map((n,i)=>`<div>${i+1}. ${String(n).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}</div>`).join(''):'';
    one.textContent=skipped.length===1?'POMIŃ PRZYSTANEK':`POMIŃ NASTĘPNY: ${skipped[0]}`;
    all.hidden=skipped.length<2;
    if(skipped.length>1)all.textContent=`POMIŃ WSZYSTKIE (${skipped.length})`;
    one.onclick=()=>{body.dispatchEvent(new CustomEvent('gps-skip-stop',{bubbles:true,detail:{index:fromIndex+1,skippedIndex:fromIndex,source:reason}}));closePrompt()};
    all.onclick=()=>{body.dispatchEvent(new CustomEvent('gps-skip-stop',{bubbles:true,detail:{index:toIndex,skippedFrom:fromIndex,skippedTo:toIndex-1,source:`${reason}-multiple`}}));closePrompt()};
    no.onclick=()=>{closePrompt();lastPromptAt=Date.now()};
    window.__routeStopActionsOpen=true;
    modal.hidden=false;
  }

  function evaluate(here,speed){
    if(body.dataset.emptyRun==='1')return;
    if(speed<MIN_SPEED_MPS){awayFixes=0;lastTargetDistance=Infinity;return}
    const rs=rows(),i=currentIndex();if(!rs[i]||i>=rs.length-1)return;
    const target=coord(rs[i].dataset.coordinate);if(!target)return;
    const d=dist(here,target);
    if(d<MIN_TARGET_DISTANCE){awayFixes=0;lastTargetDistance=d;return}
    const targetBearing=bear(here,target),away=Number.isFinite(heading)&&angle(heading,targetBearing)>AWAY_ANGLE;
    const growing=Number.isFinite(lastTargetDistance)&&d>lastTargetDistance+GROWTH_METERS;
    if(away&&growing)awayFixes++;else awayFixes=Math.max(0,awayFixes-1);
    lastTargetDistance=d;
    if(awayFixes<CONFIRM_FIXES)return;

    let candidate=-1,bestScore=Infinity;
    for(let j=i+1;j<Math.min(rs.length,i+5);j++){
      const c=coord(rs[j].dataset.coordinate);if(!c)continue;
      const a=Number.isFinite(heading)?angle(heading,bear(here,c)):180;
      const dd=dist(here,c);
      if(a>TOWARD_ANGLE)continue;
      const score=dd+a*8;
      if(score<bestScore){bestScore=score;candidate=j}
    }
    if(candidate>i){awayFixes=0;promptSkip(i,candidate)}
  }

  function onPos(p){
    if((p.coords.accuracy||999)>MAX_ACCURACY)return;
    const here=[p.coords.latitude,p.coords.longitude],now=Number(p.timestamp)||Date.now();
    let speed=Number(p.coords.speed);
    if(!Number.isFinite(speed)||speed<0){speed=lastPos&&lastPosAt&&now>lastPosAt?dist(lastPos,here)/((now-lastPosAt)/1000):0}
    let h=Number(p.coords.heading);
    if(!Number.isFinite(h)||h<0){
      if(!headingAnchor)headingAnchor=here;
      const required=Math.max(12,Math.min(30,(p.coords.accuracy||0)*.35));
      if(dist(headingAnchor,here)>=required){h=bear(headingAnchor,here);headingAnchor=here}
    }else headingAnchor=here;
    if(Number.isFinite(h)&&h>=0)heading=h;
    lastPos=here;lastPosAt=now;evaluate(here,Math.max(0,speed));
  }

  function reset(){awayFixes=0;lastTargetDistance=Infinity;lastPromptKey='';headingAnchor=null;currentEtaKind='';closePrompt()}
  body.addEventListener('nav-eta-update',captureEta);
  body.addEventListener('eta-status-change',captureEta);
  body.addEventListener('gps-next-stop-change',reset);
  body.addEventListener('route-direction-change',reset);
  body.addEventListener('schedule-rendered',reset);
  document.addEventListener('trasy:navigation-resumed',event=>{
    const position=event.detail?.position;
    reset();
    if(!position?.coords)return;
    const here=[Number(position.coords.latitude),Number(position.coords.longitude)];
    if(!Number.isFinite(here[0])||!Number.isFinite(here[1]))return;
    lastPos=here;lastPosAt=Number(position.timestamp)||Date.now();headingAnchor=here;heading=null;
  });
  watch=window.__trasyGps.subscribe(onPos,()=>{});
})();
