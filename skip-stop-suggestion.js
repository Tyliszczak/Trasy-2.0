(()=>{
  const body=document.getElementById('scheduleBody');
  const geo=globalThis.__trasyGeo;
  const time=globalThis.__trasyTime;
  if(!body||!geo||!time||!window.__trasyGps?.subscribe)return;

  const MAX_ACCURACY_M=80;
  const MIN_SPEED_MPS=2.5;
  const CURRENT_BEHIND_DEG=120;
  const NEXT_AHEAD_DEG=75;
  const MIN_CURRENT_DISTANCE_M=220;
  const CONFIRM_FIXES=3;
  const MIN_AWAY_GROWTH_M=12;
  const HEADING_VALID_MS=10000;
  const HEADING_MOVE_M=14;

  let lastPosition=null;
  let lastPositionAt=0;
  let headingAnchor=null;
  let heading=null;
  let headingAt=0;
  let candidateKey='';
  let candidateFixes=0;
  let candidateClosest=Infinity;
  let declinedKey='';
  let dialogIndex=null;
  let restoringTarget=false;

  function rows(){
    return[...body.querySelectorAll('tr')].filter(row=>geo.parseCoordinate(row.dataset.coordinate));
  }

  function currentIndex(){
    const routeRows=rows();
    const stored=Number(body.dataset.gpsNextStop);
    if(Number.isInteger(stored)&&stored>=0&&stored<routeRows.length)return stored;
    const found=routeRows.findIndex(row=>row.classList.contains('gpsNextStop'));
    return found>=0?found:null;
  }

  function rowKey(row,index){
    return row?(row.dataset.stopId||`${index}:${row.dataset.coordinate||''}`):'';
  }

  function stopName(row,index){
    return row?.querySelector('td:first-child')?.childNodes?.[0]?.textContent?.trim()
      ||row?.querySelector('td:first-child')?.innerText?.trim()
      ||`Przystanek ${index+1}`;
  }

  function navigationOpen(){
    const nav=document.getElementById('routeMapNav');
    return Boolean(nav&&nav.hidden===false);
  }

  function routeAllowsSuggestion(){
    return navigationOpen()
      &&body.dataset.emptyRun!=='1'
      &&body.dataset.returnOriginActive!=='1';
  }

  function timingAllowsSuggestion(row){
    const plan=String(time.rowPlanText(row)||'').trim();
    if(!plan)return true;
    return['late','onTime','arrived'].includes(String(body.dataset.etaKind||''));
  }

  function resetCandidate(){
    candidateKey='';
    candidateFixes=0;
    candidateClosest=Infinity;
  }

  const modal=document.createElement('div');
  modal.id='skipStopSuggestion';
  modal.hidden=true;
  modal.style.cssText='position:fixed;inset:0;z-index:71000;background:#000b;display:flex;align-items:center;justify-content:center;padding:18px;box-sizing:border-box';
  modal.innerHTML=`
    <div role="dialog" aria-modal="true" aria-labelledby="skipStopSuggestionQuestion" style="width:min(100%,520px);background:#202020;border:2px solid #ccff33;border-radius:16px;padding:20px 18px;box-shadow:0 14px 44px #000;text-align:center">
      <div id="skipStopSuggestionQuestion" style="font-size:21px;line-height:1.3;font-weight:1000;color:#fff"></div>
      <div style="display:grid;gap:10px;margin-top:20px">
        <button id="skipStopSuggestionYes" type="button" style="min-height:54px;margin:0;padding:10px 14px;border:1px solid #ccff33;border-radius:9px;background:#ccff33;color:#111;font-size:17px;font-weight:1000">TAK</button>
        <button id="skipStopSuggestionNo" type="button" style="min-height:54px;margin:0;padding:10px 14px;border:1px solid #777;border-radius:9px;background:#333;color:#fff;font-size:17px;font-weight:1000">NIE, JADĘ OBJAZDEM</button>
      </div>
    </div>`;
  document.body.appendChild(modal);

  const question=modal.querySelector('#skipStopSuggestionQuestion');
  const yesButton=modal.querySelector('#skipStopSuggestionYes');
  const noButton=modal.querySelector('#skipStopSuggestionNo');

  function closeDialog(){
    modal.hidden=true;
    dialogIndex=null;
  }

  function openDialog(index){
    const routeRows=rows();
    const row=routeRows[index];
    if(!row||index>=routeRows.length-1||currentIndex()!==index)return;
    const key=rowKey(row,index);
    if(!key||declinedKey===key||!routeAllowsSuggestion()||!timingAllowsSuggestion(row))return;
    dialogIndex=index;
    question.textContent=`Czy chcesz ominąć przystanek ${stopName(row,index)}?`;
    modal.hidden=false;
    yesButton.focus({preventScroll:true});
  }

  yesButton.addEventListener('click',()=>{
    const index=dialogIndex;
    closeDialog();
    resetCandidate();
    declinedKey='';
    if(!Number.isInteger(index)||currentIndex()!==index)return;
    body.dispatchEvent(new CustomEvent('gps-skip-current-stop',{
      bubbles:true,
      detail:{expectedIndex:index,source:'skip-suggestion-confirmed'}
    }));
  });

  noButton.addEventListener('click',()=>{
    const index=dialogIndex;
    const row=Number.isInteger(index)?rows()[index]:null;
    if(row)declinedKey=rowKey(row,index);
    closeDialog();
    resetCandidate();
  });

  function candidateFromPosition(position){
    if(!routeAllowsSuggestion()||!modal.hidden)return;
    const accuracy=Number(position?.coords?.accuracy||999);
    if(!Number.isFinite(accuracy)||accuracy>MAX_ACCURACY_M){resetCandidate();return}

    const here=[Number(position.coords.latitude),Number(position.coords.longitude)];
    if(!here.every(Number.isFinite)){resetCandidate();return}
    const now=Number(position.timestamp)||Date.now();
    let speed=Number(position.coords.speed);
    if(!Number.isFinite(speed)||speed<0){
      speed=lastPosition&&lastPositionAt&&now>lastPositionAt
        ?geo.distanceMeters(lastPosition,here)/((now-lastPositionAt)/1000)
        :0;
    }
    speed=Math.max(0,speed);

    let nextHeading=Number(position.coords.heading);
    let reliable=Number.isFinite(nextHeading)&&nextHeading>=0&&speed>=MIN_SPEED_MPS;
    if(!reliable){
      if(!headingAnchor)headingAnchor=here;
      const moved=geo.distanceMeters(headingAnchor,here);
      const required=Math.max(HEADING_MOVE_M,Math.min(30,accuracy*.35));
      if(moved>=required&&speed>=MIN_SPEED_MPS){
        nextHeading=geo.bearingDegrees(headingAnchor,here);
        reliable=true;
        headingAnchor=here;
      }
    }else headingAnchor=here;
    if(reliable){heading=nextHeading;headingAt=now}

    lastPosition=here;
    lastPositionAt=now;
    const headingReliable=Number.isFinite(heading)&&speed>=MIN_SPEED_MPS&&now-headingAt<=HEADING_VALID_MS;
    if(!headingReliable){resetCandidate();return}

    const routeRows=rows();
    const index=currentIndex();
    if(!Number.isInteger(index)||index<0||index>=routeRows.length-1){resetCandidate();return}
    const current=routeRows[index];
    const next=routeRows[index+1];
    const key=rowKey(current,index);
    if(!key||declinedKey===key||!timingAllowsSuggestion(current)){resetCandidate();return}

    const currentCoord=geo.parseCoordinate(current.dataset.coordinate);
    const nextCoord=geo.parseCoordinate(next.dataset.coordinate);
    if(!currentCoord||!nextCoord){resetCandidate();return}
    const currentDistance=geo.distanceMeters(here,currentCoord);
    const currentAngle=geo.angleDifference(heading,geo.bearingDegrees(here,currentCoord));
    const nextAngle=geo.angleDifference(heading,geo.bearingDegrees(here,nextCoord));

    const likelySkipping=currentDistance>=MIN_CURRENT_DISTANCE_M
      &&currentAngle>=CURRENT_BEHIND_DEG
      &&nextAngle<=NEXT_AHEAD_DEG;
    if(!likelySkipping){resetCandidate();return}

    if(candidateKey===key){
      candidateFixes+=1;
      candidateClosest=Math.min(candidateClosest,currentDistance);
    }else{
      candidateKey=key;
      candidateFixes=1;
      candidateClosest=currentDistance;
    }
    if(candidateFixes>=CONFIRM_FIXES&&currentDistance>=candidateClosest+MIN_AWAY_GROWTH_M){
      openDialog(index);
      resetCandidate();
    }
  }

  body.addEventListener('gps-next-stop-change',event=>{
    const detail=event.detail||{};
    if(restoringTarget){restoringTarget=false;return}

    if(detail.reason==='reacquired-target'
      &&Number.isInteger(detail.previousIndex)
      &&Number.isInteger(detail.index)
      &&detail.index===detail.previousIndex+1
      &&routeAllowsSuggestion()){
      const previousIndex=detail.previousIndex;
      const previousRow=rows()[previousIndex];
      const key=rowKey(previousRow,previousIndex);
      restoringTarget=true;
      body.dispatchEvent(new CustomEvent('gps-skip-stop',{
        bubbles:true,
        detail:{index:previousIndex,source:'skip-suggestion-hold'}
      }));
      if(key&&declinedKey!==key&&timingAllowsSuggestion(previousRow))queueMicrotask(()=>openDialog(previousIndex));
      resetCandidate();
      return;
    }

    const index=currentIndex();
    const row=Number.isInteger(index)?rows()[index]:null;
    const key=rowKey(row,index);
    if(declinedKey&&declinedKey!==key)declinedKey='';
    if(dialogIndex!==null&&dialogIndex!==index)closeDialog();
    resetCandidate();
  });

  body.addEventListener('route-direction-change',()=>{declinedKey='';closeDialog();resetCandidate()});
  body.addEventListener('route-mode-change',()=>{declinedKey='';closeDialog();resetCandidate()});
  body.addEventListener('schedule-rendered',()=>{declinedKey='';closeDialog();resetCandidate()});
  body.addEventListener('return-origin-change',()=>{closeDialog();resetCandidate()});

  window.__trasyGps.subscribe(candidateFromPosition,()=>{});
})();
