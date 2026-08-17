(()=>{
  const body=document.getElementById('scheduleBody');
  const view=document.getElementById('scheduleView');
  if(!body||!view||!navigator.geolocation)return;

  let watch=null,lastPos=null,heading=null,currentIndex=null,applying=false;
  let reachedCurrent=false,reachedBeforeTime=false;

  const MIN_MOVE=7;
  const REACHED=60;
  const DEPARTED=90;
  const MAX_ACCURACY=120;

  const style=document.createElement('style');
  style.textContent=`
    #scheduleBody tr.isActiveStop:not(.gpsNextStop){
      background:transparent!important;
      box-shadow:none!important
    }

    #scheduleBody tr.isActiveStop:not(.gpsNextStop) td:first-child{
      color:inherit!important;
      font-weight:inherit!important
    }

    #scheduleBody tr.gpsNextStop{
      background:rgba(204,255,51,.10)!important;
      box-shadow:inset 5px 0 var(--gps-status-color,#ccff33)!important
    }

    #scheduleBody tr.gpsNextStop td:first-child{
      font-weight:900!important;
      color:var(--gps-status-color,#ccff33)!important
    }

    #scheduleBody .stopGuardNotice{
      display:block;
      margin-top:5px;
      padding:6px 8px;
      border-radius:7px;
      font-size:12px;
      line-height:1.15;
      font-weight:1000;
      white-space:normal
    }

    #scheduleBody .stopGuardNotice.hold{
      background:#ffd60a;
      color:#111
    }

    #scheduleBody .stopGuardNotice.ready{
      background:#34c759;
      color:#071407
    }

    #scheduleBody .stopGuardNotice.earlyDeparture{
      background:#ff3b30;
      color:#fff
    }
  `;
  document.head.append(style);

  function coord(v){
    const m=String(v||'').match(/(-?\d+(?:\.\d+)?)\s*[,; ]\s*(-?\d+(?:\.\d+)?)/);
    return m?[+m[1],+m[2]]:null;
  }

  function dist(a,b){
    const R=6371000,p=Math.PI/180;
    const dLat=(b[0]-a[0])*p,dLon=(b[1]-a[1])*p;
    const x=Math.sin(dLat/2)**2+
      Math.cos(a[0]*p)*Math.cos(b[0]*p)*Math.sin(dLon/2)**2;
    return 2*R*Math.asin(Math.sqrt(x));
  }

  function bear(a,b){
    const p=Math.PI/180;
    const y=Math.sin((b[1]-a[1])*p)*Math.cos(b[0]*p);
    const x=Math.cos(a[0]*p)*Math.sin(b[0]*p)-
      Math.sin(a[0]*p)*Math.cos(b[0]*p)*Math.cos((b[1]-a[1])*p);
    return(Math.atan2(y,x)*180/Math.PI+360)%360;
  }

  function angle(a,b){
    return Math.abs(((a-b+540)%360)-180);
  }

  function rows(){
    return [...body.querySelectorAll('tr')]
      .filter(r=>coord(r.dataset.coordinate));
  }

  function rowTime(row){
    const text=String(
      row?.children[1]?.firstChild?.textContent||
      row?.children[1]?.textContent||
      ''
    ).trim();

    const m=text.match(/^(\d{1,2}):(\d{2})/);
    if(!m)return null;

    const d=new Date();
    d.setHours(+m[1],+m[2],0,0);
    return d;
  }

  /*
   * Przed planową godziną pierwszego przystanku
   * nie pozwalamy GPS przeskoczyć w środek trasy.
   */
  function firstStopProtected(){
    const rs=rows();
    if(!rs.length)return false;

    const t=rowTime(rs[0]);
    return !!t && Date.now()<t.getTime();
  }

  function routeChanged(){
    currentIndex=null;
    lastPos=null;
    heading=null;
    reachedCurrent=false;
    reachedBeforeTime=false;
    setTimeout(chooseAndApply,100);
  }

  /*
   * Uruchomienie aplikacji już w trakcie kursu:
   * GPS + kierunek + czas wybierają następny punkt.
   */
  function initialIndex(here){
    const rs=rows();
    if(!rs.length)return null;

    if(firstStopProtected())return 0;

    let best=0,bestScore=Infinity;

    rs.forEach((row,i)=>{
      const c=coord(row.dataset.coordinate);
      if(!c)return;

      const d=dist(here,c);
      let score=d;

      if(Number.isFinite(heading)){
        const a=angle(heading,bear(here,c));
        score+=a*4;
        if(a>120)score+=800;
      }

      const plan=rowTime(row);

      if(plan){
        const minutes=Math.abs(Date.now()-plan.getTime())/60000;
        score+=Math.min(minutes,30)*45;
      }

      if(score<bestScore){
        bestScore=score;
        best=i;
      }
    });

    return best;
  }

  function chooseIndex(here){
    const rs=rows();
    if(!rs.length)return null;

    if(currentIndex!==null&&currentIndex>=rs.length){
      currentIndex=null;
    }

    if(firstStopProtected()){
      currentIndex=0;
      return 0;
    }

    if(currentIndex===null){
      currentIndex=initialIndex(here);
      reachedCurrent=false;
      reachedBeforeTime=false;
      return currentIndex;
    }

    const row=rs[currentIndex];
    if(!row)return currentIndex;

    const cur=coord(row.dataset.coordinate);

    const next=
      currentIndex+1<rs.length
        ?coord(rs[currentIndex+1].dataset.coordinate)
        :null;

    const dc=cur?dist(here,cur):Infinity;
    const dn=next?dist(here,next):Infinity;

    const accuracy=Number(window.__navAcc||0);

    const reachedRadius=Math.max(
      REACHED,
      Math.min(85,accuracy*1.2)
    );

    if(dc<=reachedRadius){
      reachedCurrent=true;

      const plan=rowTime(row);
      if(plan&&Date.now()<plan.getTime()){
        reachedBeforeTime=true;
      }
    }

    if(next){
      const headingToNext=
        Number.isFinite(heading)
          ?angle(heading,bear(here,next))
          :0;

      const movingToNext=headingToNext<85;

      const clearlyLeaving=
        reachedCurrent&&
        dc>DEPARTED&&
        dn<dc&&
        movingToNext;

      const nextClearlyCloser=
        reachedCurrent&&
        dn+80<dc&&
        movingToNext;

      const plan=rowTime(row);

      const stillTooEarly=
        plan&&Date.now()<plan.getTime();

      if(
        !stillTooEarly&&
        (clearlyLeaving||nextClearlyCloser)
      ){
        currentIndex++;
        reachedCurrent=false;
        reachedBeforeTime=false;
      }
    }

    return currentIndex;
  }

  function applyIndex(idx){
    const rs=rows();

    if(idx===null||!rs[idx])return;

    const previous=Number(body.dataset.gpsNextStop);

    const changed=
      !Number.isInteger(previous)||
      previous!==idx;

    applying=true;

    try{
      body.querySelectorAll('tr').forEach(r=>{
        const active=r===rs[idx];

        r.classList.toggle('gpsNextStop',active);
        r.classList.toggle('isActiveStop',active);
      });

      const target=rs[idx];

      body.dataset.gpsNextStop=String(idx);

      /*
       * Nie wysyłamy tego zdarzenia przy każdym odczycie GPS.
       * Tylko przy rzeczywistej zmianie przystanku.
       */
      if(changed){
        body.dispatchEvent(
          new CustomEvent('gps-next-stop-change',{
            bubbles:true,
            detail:{
              index:idx,
              name:target.children[0]?.innerText.trim()||''
            }
          })
        );
      }

    }finally{
      applying=false;
    }
  }

  function formatCountdown(seconds){
    const s=Math.max(0,Math.ceil(seconds));
    const min=Math.floor(s/60);
    const sec=s%60;

    return `${min}:${String(sec).padStart(2,'0')}`;
  }

  function emitGuard(state,message,seconds,index,plan,distance){
    body.dataset.stopGuard=state||'';

    body.dispatchEvent(
      new CustomEvent('stop-guard-change',{
        bubbles:true,
        detail:{
          state,
          message,
          seconds,
          index,
          plan,
          distance
        }
      })
    );
  }

  function updateStopGuard(){
    const rs=rows();

    document.querySelectorAll(
      '#scheduleBody .stopGuardNotice'
    ).forEach(x=>x.remove());

    if(
      currentIndex===null||
      !rs[currentIndex]||
      !lastPos
    ){
      emitGuard('','',0,currentIndex,'',Infinity);
      return;
    }

    const row=rs[currentIndex];
    const c=coord(row.dataset.coordinate);
    const plan=rowTime(row);

    if(!c||!plan){
      emitGuard('','',0,currentIndex,'',Infinity);
      return;
    }

    const d=dist(lastPos,c);
    const seconds=(plan.getTime()-Date.now())/1000;

    const planText=String(
      row.children[1]?.firstChild?.textContent||
      row.children[1]?.textContent||
      ''
    ).trim();

    let state='';
    let message='';

    if(seconds>0&&d<=70){
      state='hold';
      message=
        `NIE ODJEDŻAJ • ${formatCountdown(seconds)} • plan ${planText}`;
    }

    if(
      seconds>0&&
      reachedBeforeTime&&
      d>DEPARTED
    ){
      state='earlyDeparture';
      message=
        `ZA WCZEŚNIE — ZATRZYMAJ SIĘ • ${formatCountdown(seconds)}`;
    }

    if(
      seconds<=0&&
      reachedCurrent&&
      d<=DEPARTED
    ){
      state='ready';
      message='MOŻESZ JECHAĆ';
    }

    if(state){
      const notice=document.createElement('div');

      notice.className=`stopGuardNotice ${state}`;
      notice.textContent=message;

      row.querySelector('td:first-child')?.appendChild(notice);
    }

    emitGuard(
      state,
      message,
      Math.max(0,seconds),
      currentIndex,
      planText,
      d
    );
  }

  function chooseAndApply(){
    if(view.hidden||!lastPos)return;

    const idx=chooseIndex(lastPos);
    applyIndex(idx);
    updateStopGuard();
  }

  function onPos(p){
    if((p.coords.accuracy||999)>MAX_ACCURACY)return;

    window.__navAcc=p.coords.accuracy||999;

    const here=[
      p.coords.latitude,
      p.coords.longitude
    ];

    let h=Number(p.coords.heading);

    if(!Number.isFinite(h)||h<0){
      if(lastPos&&dist(lastPos,here)>=MIN_MOVE){
        h=bear(lastPos,here);
      }else{
        h=heading;
      }
    }

    if(Number.isFinite(h)){
      heading=h;
    }

    if(!lastPos||dist(lastPos,here)>=2){
      lastPos=here;
    }

    chooseAndApply();
  }

  function start(){
    if(watch!==null)return;

    watch=navigator.geolocation.watchPosition(
      onPos,
      ()=>{},
      {
        enableHighAccuracy:true,
        maximumAge:700,
        timeout:15000
      }
    );
  }

  body.addEventListener(
    'route-direction-change',
    routeChanged
  );

  new MutationObserver(m=>{
    if(applying||!lastPos)return;

    if(
      m.some(
        x=>
          x.type==='attributes'&&
          x.attributeName==='class'
      )
    ){
      setTimeout(chooseAndApply,0);
    }
  }).observe(body,{
    subtree:true,
    attributes:true,
    attributeFilter:['class']
  });

  setInterval(updateStopGuard,1000);

  document.addEventListener(
    'visibilitychange',
    ()=>{
      if(document.visibilityState==='visible'){
        start();
      }
    }
  );

  start();
})();
