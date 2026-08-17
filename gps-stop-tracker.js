(()=>{
  const body=document.getElementById('scheduleBody'),view=document.getElementById('scheduleView');
  if(!body||!view||!navigator.geolocation)return;
  let watch=null,lastPos=null,heading=null,currentIndex=null,applying=false;
  const MIN_MOVE=7,REACHED=70,MAX_ACCURACY=120;
  const style=document.createElement('style');style.textContent=`
    #scheduleBody tr.isActiveStop:not(.gpsNextStop){background:transparent!important;box-shadow:none!important}
    #scheduleBody tr.isActiveStop:not(.gpsNextStop) td:first-child{color:inherit!important;font-weight:inherit!important}
    #scheduleBody tr.gpsNextStop{background:rgba(204,255,51,.13)!important;box-shadow:inset 4px 0 #ccff33!important}
    #scheduleBody tr.gpsNextStop td:first-child{font-weight:900!important;color:#ccff33!important}
  `;document.head.append(style);

  function coord(v){const m=String(v||'').match(/(-?\d+(?:\.\d+)?)\s*[,; ]\s*(-?\d+(?:\.\d+)?)/);return m?[+m[1],+m[2]]:null}
  function dist(a,b){const R=6371000,p=Math.PI/180,dLat=(b[0]-a[0])*p,dLon=(b[1]-a[1])*p,x=Math.sin(dLat/2)**2+Math.cos(a[0]*p)*Math.cos(b[0]*p)*Math.sin(dLon/2)**2;return 2*R*Math.asin(Math.sqrt(x))}
  function bear(a,b){const p=Math.PI/180,y=Math.sin((b[1]-a[1])*p)*Math.cos(b[0]*p),x=Math.cos(a[0]*p)*Math.sin(b[0]*p)-Math.sin(a[0]*p)*Math.cos(b[0]*p)*Math.cos((b[1]-a[1])*p);return(Math.atan2(y,x)*180/Math.PI+360)%360}
  function angle(a,b){return Math.abs(((a-b+540)%360)-180)}
  function rows(){return [...body.querySelectorAll('tr')].filter(r=>coord(r.dataset.coordinate))}
  function routeChanged(){currentIndex=null;lastPos=null;heading=null;setTimeout(()=>chooseAndApply(),100)}

  function chooseIndex(here){
    const rs=rows();if(!rs.length)return null;
    if(currentIndex!==null&&currentIndex>=rs.length)currentIndex=null;
    if(currentIndex!==null){
      const cur=coord(rs[currentIndex].dataset.coordinate),next=currentIndex+1<rs.length?coord(rs[currentIndex+1].dataset.coordinate):null;
      const dc=cur?dist(here,cur):Infinity,dn=next?dist(here,next):Infinity;
      if(next&&(dc<=REACHED||dn+90<dc)){currentIndex++}
      if(currentIndex!==null)return currentIndex;
    }
    let best=0,bestScore=Infinity;
    rs.forEach((r,i)=>{const c=coord(r.dataset.coordinate);if(!c)return;const d=dist(here,c);let score=d; if(Number.isFinite(heading)){const a=angle(heading,bear(here,c));score+=a*4;if(a>115)score+=900} if(score<bestScore){bestScore=score;best=i}});
    currentIndex=best;return best;
  }

  function applyIndex(idx){const rs=rows();if(idx===null||!rs[idx])return;applying=true;try{body.querySelectorAll('tr').forEach((r,i)=>{const active=r===rs[idx];r.classList.toggle('gpsNextStop',active);r.classList.toggle('isActiveStop',active)});const target=rs[idx];body.dataset.gpsNextStop=String(idx);body.dispatchEvent(new CustomEvent('gps-next-stop-change',{bubbles:true,detail:{index:idx,name:target.children[0]?.innerText.trim()||''}}))}finally{applying=false}}
  function chooseAndApply(){if(view.hidden||!lastPos)return;const idx=chooseIndex(lastPos);applyIndex(idx)}

  function onPos(p){if((p.coords.accuracy||999)>MAX_ACCURACY)return;const here=[p.coords.latitude,p.coords.longitude];let h=Number(p.coords.heading);if(!Number.isFinite(h)||h<0){if(lastPos&&dist(lastPos,here)>=MIN_MOVE)h=bear(lastPos,here);else h=heading}if(Number.isFinite(h))heading=h;if(!lastPos||dist(lastPos,here)>=2)lastPos=here;chooseAndApply()}
  function start(){if(watch!==null)return;watch=navigator.geolocation.watchPosition(onPos,()=>{}, {enableHighAccuracy:true,maximumAge:700,timeout:15000})}

  body.addEventListener('route-direction-change',routeChanged);
  new MutationObserver(m=>{if(applying||!lastPos)return;if(m.some(x=>x.type==='attributes'&&x.attributeName==='class'))setTimeout(chooseAndApply,0)}).observe(body,{subtree:true,attributes:true,attributeFilter:['class']});
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')start()});
  start();
})();