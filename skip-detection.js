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

  let watch=null,lastPos=null,lastPosAt=0,headingAnchor=null,heading=null,lastTargetDistance=Infinity,awayFixes=0,lastPromptAt=0,lastPromptKey='';

  function coord(v){const m=String(v||'').match(/(-?\d+(?:\.\d+)?)\s*[,; ]\s*(-?\d+(?:\.\d+)?)/);return m?[+m[1],+m[2]]:null}
  function dist(a,b){const R=6371000,p=Math.PI/180,dLat=(b[0]-a[0])*p,dLon=(b[1]-a[1])*p,x=Math.sin(dLat/2)**2+Math.cos(a[0]*p)*Math.cos(b[0]*p)*Math.sin(dLon/2)**2;return 2*R*Math.asin(Math.sqrt(x))}
  function bear(a,b){const p=Math.PI/180,y=Math.sin((b[1]-a[1])*p)*Math.cos(b[0]*p),x=Math.cos(a[0]*p)*Math.sin(b[0]*p)-Math.sin(a[0]*p)*Math.cos(b[0]*p)*Math.cos((b[1]-a[1])*p);return(Math.atan2(y,x)*180/Math.PI+360)%360}
  function angle(a,b){return Math.abs(((a-b+540)%360)-180)}
  function rows(){return [...body.querySelectorAll('tr')].filter(r=>coord(r.dataset.coordinate))}
  function currentIndex(){const rs=rows();let i=Number(body.dataset.gpsNextStop);if(Number.isInteger(i)&&i>=0&&i<rs.length)return i;i=rs.findIndex(r=>r.classList.contains('gpsNextStop'));return i>=0?i:0}
  function rowName(r){return r?.querySelector('td:first-child')?.childNodes[0]?.textContent?.trim()||r?.querySelector('td:first-child')?.innerText?.trim()||'Przystanek'}

  function ensureModal(){
    let modal=document.getElementById('skipDetectionDialog');if(modal)return modal;
    modal=document.createElement('div');modal.id='skipDetectionDialog';modal.hidden=true;
    modal.style.cssText='position:fixed;inset:0;z-index:70500;background:#000b;display:flex;align-items:center;justify-content:center;padding:16px';
    modal.innerHTML=`<div style="width:min(100%,520px);background:#1d1d1d;border:2px solid #ffb020;border-radius:15px;padding:18px;box-shadow:0 12px 42px #000c">
      <div style="font-size:20px;font-weight:1000;color:#ffb020;text-align:center">MOŻLIWE POMINIĘCIE PRZYSTANKU</div>
      <div id="skipDetectionText" style="margin-top:13px;font-size:16px;line-height:1.4;color:#fff"></div>
      <div id="skipDetectionList" style="margin-top:11px;padding:11px;border-radius:9px;background:#292929;color:#fff;font-weight:800"></div>
      <div style="display:grid;gap:9px;margin-top:16px">
        <button id="skipDetectionOne" type="button" style="padding:13px;background:#d97706;color:#fff;font-weight:1000">POMIŃ NASTĘPNY</button>
        <button id="skipDetectionAll" type="button" style="padding:13px;background:#b91c1c;color:#fff;font-weight:1000">POMIŃ WSZYSTKIE</button>
        <button id="skipDetectionNo" type="button" style="padding:13px;background:#444;color:#fff;font-weight:900">NIE — JADĘ DO PRZYSTANKU</button>
      </div>
    </div>`;
    document.body.append(modal);return modal;
  }

  function closePrompt(){const m=document.getElementById('skipDetectionDialog');if(m)m.hidden=true;window.__routeStopActionsOpen=false}

  function promptSkip(fromIndex,toIndex){
    const rs=rows();if(!rs[fromIndex]||toIndex<=fromIndex)return;
    const skipped=rs.slice(fromIndex,toIndex).map(rowName);if(!skipped.length)return;
    const key=`${fromIndex}:${toIndex}:${skipped.join('|')}`;
    if(key===lastPromptKey&&Date.now()-lastPromptAt<COOLDOWN_MS)return;
    lastPromptKey=key;lastPromptAt=Date.now();
    const modal=ensureModal(),text=modal.querySelector('#skipDetectionText'),list=modal.querySelector('#skipDetectionList'),one=modal.querySelector('#skipDetectionOne'),all=modal.querySelector('#skipDetectionAll'),no=modal.querySelector('#skipDetectionNo');
    text.textContent=skipped.length===1?`Wygląda na to, że omijasz przystanek „${skipped[0]}”. Czy chcesz go pominąć?`:`Wygląda na to, że obecny kierunek jazdy omija ${skipped.length} przystanki. Wybierz, co zrobić:`;
    list.innerHTML=skipped.map((n,i)=>`<div>${i+1}. ${String(n).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}</div>`).join('');
    one.textContent=`POMIŃ NASTĘPNY: ${skipped[0]}`;
    all.hidden=skipped.length<2;
    if(skipped.length>1)all.textContent=`POMIŃ WSZYSTKIE (${skipped.length})`;
    one.onclick=()=>{body.dispatchEvent(new CustomEvent('gps-skip-stop',{bubbles:true,detail:{index:fromIndex+1,skippedIndex:fromIndex,source:'detected'}}));closePrompt()};
    all.onclick=()=>{body.dispatchEvent(new CustomEvent('gps-skip-stop',{bubbles:true,detail:{index:toIndex,skippedFrom:fromIndex,skippedTo:toIndex-1,source:'detected-multiple'}}));closePrompt()};
    no.onclick=()=>{closePrompt();lastPromptAt=Date.now()};
    window.__routeStopActionsOpen=true;
    if(typeof window.__routeEnterManualView==='function')window.__routeEnterManualView();
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
    if(!Number.isFinite(speed)||speed<0){
      speed=lastPos&&lastPosAt&&now>lastPosAt?dist(lastPos,here)/((now-lastPosAt)/1000):0;
    }
    let h=Number(p.coords.heading);
    if(!Number.isFinite(h)||h<0){
      if(!headingAnchor)headingAnchor=here;
      const required=Math.max(12,Math.min(30,(p.coords.accuracy||0)*.35));
      if(dist(headingAnchor,here)>=required){h=bear(headingAnchor,here);headingAnchor=here}
    }else headingAnchor=here;
    if(Number.isFinite(h)&&h>=0)heading=h;
    lastPos=here;lastPosAt=now;evaluate(here,Math.max(0,speed));
  }

  function reset(){awayFixes=0;lastTargetDistance=Infinity;lastPromptKey='';headingAnchor=null;closePrompt()}
  body.addEventListener('gps-next-stop-change',reset);
  body.addEventListener('route-direction-change',reset);
  body.addEventListener('schedule-rendered',reset);
  watch=window.__trasyGps.subscribe(onPos,()=>{});
})();
