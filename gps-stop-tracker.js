(()=>{
  const body=document.getElementById('scheduleBody');
  const view=document.getElementById('scheduleView');

  if(!body||!view||!navigator.geolocation)return;

  let watch=null;
  let lastPos=null;
  let heading=null;
  let currentIndex=null;
  let applying=false;

  let minDistance=Infinity;
  let reachedCurrent=false;
  let reachedBeforeTime=false;

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
      box-shadow:
        inset 5px 0
        var(--gps-status-color,#ccff33)!important
    }

    #scheduleBody tr.gpsNextStop td:first-child{
      font-weight:900!important;
      color:
        var(--gps-status-color,#ccff33)!important
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
    const m=String(v||'').match(
      /(-?\d+(?:\.\d+)?)\s*[,; ]\s*(-?\d+(?:\.\d+)?)/
    );

    return m?[+m[1],+m[2]]:null;
  }


  function dist(a,b){
    const R=6371000;
    const p=Math.PI/180;

    const dLat=(b[0]-a[0])*p;
    const dLon=(b[1]-a[1])*p;

    const x=
      Math.sin(dLat/2)**2+
      Math.cos(a[0]*p)*
      Math.cos(b[0]*p)*
      Math.sin(dLon/2)**2;

    return 2*R*Math.asin(Math.sqrt(x));
  }


  function bear(a,b){
    const p=Math.PI/180;

    const y=
      Math.sin((b[1]-a[1])*p)*
      Math.cos(b[0]*p);

    const x=
      Math.cos(a[0]*p)*
      Math.sin(b[0]*p)-
      Math.sin(a[0]*p)*
      Math.cos(b[0]*p)*
      Math.cos((b[1]-a[1])*p);

    return(
      Math.atan2(y,x)*
      180/Math.PI+
      360
    )%360;
  }


  function angle(a,b){
    return Math.abs(
      ((a-b+540)%360)-180
    );
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

    d.setHours(
      +m[1],
      +m[2],
      0,
      0
    );

    return d;
  }


  function secondsUntil(date){
    if(!date)return null;

    return(
      date.getTime()-
      Date.now()
    )/1000;
  }


  /*
   * Przed godziną pierwszego przystanku
   * pierwszy przystanek jest chroniony.
   *
   * Dzięki temu przejazd np. obok
   * Strumykowej przed startem TopPoint
   * nie przesunie kursu w środek trasy.
   */
  function firstStopProtected(){
    const rs=rows();

    if(!rs.length)return false;

    const firstTime=rowTime(rs[0]);

    if(!firstTime)return false;

    return Date.now()<firstTime.getTime();
  }


  function routeChanged(){
    currentIndex=null;
    lastPos=null;
    heading=null;
    minDistance=Infinity;
    reachedCurrent=false;
    reachedBeforeTime=false;

    setTimeout(
      ()=>chooseAndApply(),
      100
    );
  }


  /*
   * Gdy aplikacja zostanie uruchomiona
   * już w trakcie kursu:
   *
   * pozycja + kierunek + czas
   * wspólnie wybierają najbardziej
   * prawdopodobny następny przystanek.
   */
  function initialIndex(here){
    const rs=rows();

    if(!rs.length)return null;

    if(firstStopProtected()){
      return 0;
    }

    let best=0;
    let bestScore=Infinity;

    rs.forEach((row,i)=>{
      const c=coord(row.dataset.coordinate);

      if(!c)return;

      const d=dist(here,c);

      let score=d;

      if(Number.isFinite(heading)){
        const a=angle(
          heading,
          bear(here,c)
        );

        score+=a*4;

        if(a>120){
          score+=800;
        }
      }

      const plan=rowTime(row);

      if(plan){
        const diffMinutes=
          Math.abs(
            Date.now()-
            plan.getTime()
          )/60000;

        /*
         * Czas pomaga, ale nie jest
         * ważniejszy od rzeczywistego GPS.
         */
        score+=
          Math.min(
            diffMinutes,
            30
          )*45;
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

    if(
      currentIndex!==null &&
      currentIndex>=rs.length
    ){
      currentIndex=null;
    }

    /*
     * Przed planowym startem:
     * ZAWSZE pierwszy przystanek.
     */
    if(firstStopProtected()){
      currentIndex=0;
      return 0;
    }

    /*
     * Pierwsze uruchomienie w środku trasy.
     */
    if(currentIndex===null){
      currentIndex=initialIndex(here);

      minDistance=Infinity;
      reachedCurrent=false;
      reachedBeforeTime=false;

      return currentIndex;
    }

    const currentRow=rs[currentIndex];

    if(!currentRow){
      return currentIndex;
    }

    const cur=
      coord(
        currentRow.dataset.coordinate
      );

    const next=
      currentIndex+1<rs.length
        ?coord(
            rs[currentIndex+1]
              .dataset.coordinate
          )
        :null;

    const dc=
      cur
        ?dist(here,cur)
        :Infinity;

    const dn=
      next
        ?dist(here,next)
        :Infinity;

    minDistance=
      Math.min(
        minDistance,
        dc
      );

    const accuracy=
      Number(
        window.__navAcc||0
      );

    const reachedRadius=
      Math.max(
        REACHED,
        Math.min(
          85,
          accuracy*1.2
        )
      );

    if(dc<=reachedRadius){
      reachedCurrent=true;

      const plan=rowTime(currentRow);

      if(
        plan &&
        Date.now()<plan.getTime()
      ){
        reachedBeforeTime=true;
      }
    }

    /*
     * Nigdy nie przesuwamy do tyłu.
     *
     * Następny punkt uznajemy dopiero,
     * gdy są mocne dowody, że obecny
     * został faktycznie obsłużony.
     */
    if(next){

      const headingToNext=
        Number.isFinite(heading)
          ?angle(
              heading,
              bear(here,next)
            )
          :0;

      const movingToNext=
        headingToNext<85;

      const clearlyLeaving=
        reachedCurrent &&
        dc>DEPARTED &&
        dn<dc &&
        movingToNext;

      const nextClearlyCloser=
        reachedCurrent &&
        dn+80<dc &&
        movingToNext;

      /*
       * Jeśli byliśmy przy przystanku
       * ZA WCZEŚNIE, nie przechodzimy
       * dalej przed jego godziną.
       */
      const plan=rowTime(currentRow);

      const stillTooEarly=
        plan &&
        Date.now()<plan.getTime();

      if(
        !stillTooEarly &&
        (
          clearlyLeaving ||
          nextClearlyCloser
        )
      ){
        currentIndex++;

        minDistance=Infinity;
        reachedCurrent=false;
        reachedBeforeTime=false;
      }
    }

    return currentIndex;
  }


  function applyIndex(idx){
    const rs=rows();

    if(
      idx===null ||
      !rs[idx]
    )return;

    applying=true;

    try{
      body.querySelectorAll('tr')
        .forEach(r=>{
          const active=
            r===rs[idx];

          r.classList.toggle(
            'gpsNextStop',
            active
          );

          r.classList.toggle(
            'isActiveStop',
            active
          );
        });

      const target=rs[idx];

      body.dataset.gpsNextStop=
        String(idx);

      body.dispatchEvent(
        new CustomEvent(
          'gps-next-stop-change',
          {
            bubbles:true,
            detail:{
              index:idx,
              name:
                target.children[0]
                  ?.innerText
                  .trim()||''
            }
          }
        )
      );

    }finally{
      applying=false;
    }
  }


  function chooseAndApply(){
    if(
      view.hidden ||
      !lastPos
    )return;

    const idx=
      chooseIndex(lastPos);

    applyIndex(idx);

    updateStopGuard();
  }


  function formatCountdown(seconds){
    const s=
      Math.max(
        0,
        Math.ceil(seconds)
      );

    const min=
      Math.floor(s/60);

    const sec=
      s%60;

    return(
      min+
      ':'+
      String(sec)
        .padStart(2,'0')
    );
  }


  /*
   * NIE ODJEDŻAJ ZA WCZEŚNIE
   */
  function updateStopGuard(){
    const rs=rows();

    document
      .querySelectorAll(
        '#scheduleBody .stopGuardNotice'
      )
      .forEach(x=>x.remove());

    if(
      currentIndex===null ||
      !rs[currentIndex] ||
      !lastPos
    ){
      body.dataset.stopGuard='';
      return;
    }

    const row=rs[currentIndex];
    const c=coord(row.dataset.coordinate);
    const plan=rowTime(row);

    if(!c||!plan){
      body.dataset.stopGuard='';

      body.dispatchEvent(
        new CustomEvent(
          'stop-guard-change',
          {
            bubbles:true,
            detail:{
              state:'',
              index:currentIndex
            }
          }
        )
      );

      return;
    }

    const d=dist(lastPos,c);

    const seconds=
      secondsUntil(plan);

    let state='';
    let message='';

    /*
     * Stoimy przy przystanku za wcześnie.
     */
    if(
      seconds>0 &&
      d<=70
    ){
      state='hold';

      message=
        `NIE ODJEDŻAJ • ${formatCountdown(seconds)} • plan ${String(row.children[1]?.firstChild?.textContent||row.children[1]?.textContent||'').trim()}`;
    }

    /*
     * Byliśmy przy nim przed czasem
     * i zaczęliśmy odjeżdżać.
     */
    if(
      seconds>0 &&
      reachedBeforeTime &&
      d>DEPARTED
    ){
      state='earlyDeparture';

      message=
        `ZA WCZEŚNIE — ZATRZYMAJ SIĘ • ${formatCountdown(seconds)}`;
    }

    /*
     * Wybiła planowa godzina.
     */
    if(
      seconds<=0 &&
      reachedCurrent &&
      d<=DEPARTED
    ){
      state='ready';

      message='MOŻESZ JECHAĆ';
    }

    body.dataset.stopGuard=state;

    if(state){
      const notice=
        document.createElement('div');

      notice.className=
        `stopGuardNotice ${state}`;

      notice.textContent=message;

      row
        .querySelector('td:first-child')
        ?.appendChild(notice);
    }

    body.dispatchEvent(
      new CustomEvent(
        'stop-guard-change',
        {
          bubbles:true,
          detail:{
            state,
            message,
            seconds:
              Math.max(
                0,
                seconds||0
              ),
            index:currentIndex,
            plan:
              String(
                row.children[1]
                  ?.firstChild
                  ?.textContent||
                row.children[1]
                  ?.textContent||
                ''
              ).trim(),
            distance:d
          }
        }
      )
    );
  }


  function onPos(p){
    if(
      (p.coords.accuracy||999)>
      MAX_ACCURACY
    )return;

    window.__navAcc=
      p.coords.accuracy||999;

    const here=[
      p.coords.latitude,
      p.coords.longitude
    ];

    let h=
      Number(
        p.coords.heading
      );

    if(
      !Number.isFinite(h) ||
      h<0
    ){
      if(
        lastPos &&
        dist(lastPos,here)>=MIN_MOVE
      ){
        h=bear(lastPos,here);
      }else{
        h=heading;
      }
    }

    if(Number.isFinite(h)){
      heading=h;
    }

    if(
      !lastPos ||
      dist(lastPos,here)>=2
    ){
      lastPos=here;
    }

    chooseAndApply();
  }


  function start(){
    if(watch!==null)return;

    watch=
      navigator.geolocation
        .watchPosition(
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
    if(
      applying ||
      !lastPos
    )return;

    if(
      m.some(
        x=>
          x.type==='attributes' &&
          x.attributeName==='class'
      )
    ){
      setTimeout(
        chooseAndApply,
        0
      );
    }
  })
    .observe(
      body,
      {
        subtree:true,
        attributes:true,
        attributeFilter:['class']
      }
    );


  setInterval(
    updateStopGuard,
    1000
  );


  document.addEventListener(
    'visibilitychange',
    ()=>{
      if(
        document.visibilityState===
        'visible'
      ){
        start();
      }
    }
  );


  start();

})();
