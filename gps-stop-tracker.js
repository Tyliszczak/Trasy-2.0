import{
  bearingDegrees,
  createStopProgressEngine,
  distanceMeters
}from'./gps-stop-engine.js';
import{planDateForRow,rowPlanText}from'./schedule-time.js';
import{stopGuardState}from'./stop-alert-core.js';
import{canAutoAdvanceBySchedule,shouldApplySchedulePriority}from'./stop-target-policy.js';

(()=>{
  const body=document.getElementById('scheduleBody');
  const view=document.getElementById('scheduleView');
  const geo=globalThis.__trasyGeo;
  if(!body||!view||!navigator.geolocation||!geo)return;

  const MAX_ACCURACY=100;
  const MIN_HEADING_MOVE=12;
  const MIN_HEADING_SPEED_MPS=1.5;
  const HEADING_VALID_MS=10000;
  const EARLY_WARNING_MS=10000;
  const MISSED_STOP_WARNING_MS=20000;

  const engine=createStopProgressEngine({maxAccuracy:MAX_ACCURACY});
  let watch=null;
  let lastPos=null;
  let lastPosAt=0;
  let headingAnchor=null;
  let heading=null;
  let headingAt=0;
  let currentIndex=null;
  let reachedBeforeTime=false;
  let earlyWarningTimer=null;
  let missedStopWarningTimer=null;


  const coord=value=>geo.parseCoordinate(value);

  function rows(){
    return[...body.querySelectorAll('tr')].filter(row=>coord(row.dataset.coordinate));
  }

  function minimumTargetIndex(){
    return body.dataset.direction==='return'&&body.dataset.emptyRun!=='1'?1:0;
  }

  function stops(){
    return rows().map((row,index)=>({
      coord:coord(row.dataset.coordinate),
      key:row.dataset.stopId||`${index}:${row.dataset.coordinate}`
    }));
  }

  function alarmEligible(routeRows,index,row=routeRows[index]){
    return Boolean(row&&Number.isInteger(index)&&index>=0&&index<routeRows.length-1&&rowPlanText(row));
  }

  function rowPlanDate(row,now=new Date()){
    return planDateForRow(rows(),row,now);
  }

  function scheduleAllowsAutoAdvance(fromIndex,toIndex,now=new Date()){
    const routeRows=rows();
    const current=routeRows[fromIndex];
    const next=routeRows[toIndex];
    if(!current||!next)return false;
    return canAutoAdvanceBySchedule({
      currentPlan:rowPlanDate(current,now),
      nextPlan:rowPlanDate(next,now),
      now
    });
  }

  function routeChanged(){
    delete body.dataset.gpsNextStop;
    delete body.dataset.gpsNextStopKey;
    currentIndex=null;
    lastPos=null;
    lastPosAt=0;
    headingAnchor=null;
    heading=null;
    headingAt=0;
    reachedBeforeTime=false;
    engine.reset();
    setTimeout(chooseAndApply,100);
  }

  function showEarlyDepartureWarning(planText){
    let el=document.getElementById('earlyDepartureWarning');
    if(!el){
      el=document.createElement('div');
      el.id='earlyDepartureWarning';
      document.body.append(el);
    }
    el.innerHTML=`ODJECHAŁEŚ PRZED CZASEM${planText?`<small>Planowany odjazd: ${planText}</small>`:''}`;
    el.hidden=false;
    clearTimeout(earlyWarningTimer);
    earlyWarningTimer=setTimeout(()=>{el.hidden=true},EARLY_WARNING_MS);
  }

  function showMissedStopWarning(name){
    let el=document.getElementById('missedStopWarning');
    if(!el){
      el=document.createElement('div');
      el.id='missedStopWarning';
      el.setAttribute('role','status');
      el.setAttribute('aria-live','polite');
      el.innerHTML='<div class="missedStopText"><strong>POMINĄŁEŚ PRZYSTANEK</strong><span></span></div><button type="button" aria-label="Zamknij komunikat">×</button>';
      el.querySelector('button').onclick=()=>{clearTimeout(missedStopWarningTimer);el.hidden=true};
      document.body.append(el);
    }
    el.querySelector('.missedStopText span').textContent=name||'Przystanek';
    el.hidden=false;
    clearTimeout(missedStopWarningTimer);
    missedStopWarningTimer=setTimeout(()=>{el.hidden=true},MISSED_STOP_WARNING_MS);
  }

  function applyIndex(index,reason='tracking',transition={}){
    const routeRows=rows();
    if(index===null||!routeRows[index])return;
    const target=routeRows[index];
    const key=target.dataset.stopId||`${index}:${target.dataset.coordinate}`;
    const previous=Number(body.dataset.gpsNextStop);
    const changed=!Number.isInteger(previous)||previous!==index||body.dataset.gpsNextStopKey!==key;

    if(changed){
      body.querySelectorAll('tr').forEach(row=>{
        const active=row===target;
        row.classList.toggle('gpsNextStop',active);
        row.classList.toggle('isActiveStop',active);
      });
    }

    body.dataset.gpsNextStop=String(index);
    body.dataset.gpsNextStopKey=key;
    body.dataset.gpsTransitionReason=reason;

    if(changed){
      body.dispatchEvent(new CustomEvent('gps-next-stop-change',{
        bubbles:true,
        detail:{
          index,
          previousIndex:Number.isInteger(previous)?previous:null,
          name:target.children[0]?.innerText.trim()||'',
          key,
          coordinate:target.dataset.coordinate||'',
          reason
        }
      }));
      document.dispatchEvent(new CustomEvent('trasy:stop-transition',{
        detail:{
          from:Number.isInteger(previous)?previous:null,
          to:index,
          reason,
          accuracy:Number(window.__navAcc||0),
          distance:Number(transition.distance||0),
          speedKmh:Number(window.__routeCurrentSpeedKmh||0)
        }
      }));
    }
  }

  function emitGuard(state,message,seconds,index,plan,distance){
    body.dataset.stopGuard=state||'';
    body.dispatchEvent(new CustomEvent('stop-guard-change',{
      bubbles:true,
      detail:{state,message,seconds,index,plan,distance}
    }));
  }

  function updateStopGuard(){
    const routeRows=rows();
    document.querySelectorAll('#scheduleBody .stopGuardNotice').forEach(element=>element.remove());
    if(currentIndex===null||!routeRows[currentIndex]||!lastPos){
      emitGuard('','',0,currentIndex,'',Infinity);
      return;
    }

    const row=routeRows[currentIndex];
    const eligible=alarmEligible(routeRows,currentIndex,row);
    if(body.dataset.direction==='return'||!eligible){
      emitGuard('','',0,currentIndex,'',Infinity);
      return;
    }

    const target=coord(row.dataset.coordinate);
    const plan=rowPlanDate(row);
    if(!target||!plan){
      emitGuard('','',0,currentIndex,'',Infinity);
      return;
    }

    const distance=distanceMeters(lastPos,target);
    const seconds=(plan.getTime()-Date.now())/1000;
    const planText=rowPlanText(row);
    const guard=stopGuardState({
      eligible,
      direction:body.dataset.direction||'forward',
      arrived:engine.snapshot().arrived,
      seconds,
      planText
    });

    if(guard.state){
      const notice=document.createElement('div');
      notice.className=`stopGuardNotice ${guard.state}`;
      notice.textContent=guard.message;
      row.querySelector('td:first-child')?.appendChild(notice);
    }
    emitGuard(guard.state,guard.message,Math.max(0,seconds),currentIndex,planText,distance);
  }

  function chooseAndApply(motion={}){
    if(view.hidden||!lastPos)return;
    const routeRows=rows();
    const result=engine.update({
      stops:stops(),
      position:lastPos,
      accuracy:Number(window.__navAcc||999),
      speedMps:Number(motion.speedMps||0),
      heading,
      headingReliable:Boolean(motion.headingReliable),
      emptyRun:body.dataset.emptyRun==='1',
      minimumIndex:minimumTargetIndex()
    });
    currentIndex=result.index;

    const protectSchedule=shouldApplySchedulePriority({
      direction:body.dataset.direction||'forward',
      emptyRun:body.dataset.emptyRun==='1'
    });
    const scheduleProtectedReason=result.reason==='initial-target'||result.reason==='passed-stop'||result.reason==='reacquired-target';
    if(protectSchedule&&result.changed&&currentIndex>0&&scheduleProtectedReason){
      const fromIndex=result.reason==='passed-stop'&&Number.isInteger(result.skippedIndex)
        ?result.skippedIndex
        :result.reason==='reacquired-target'&&Number.isInteger(result.fromIndex)
          ?result.fromIndex
          :minimumTargetIndex();
      if(!scheduleAllowsAutoAdvance(fromIndex,currentIndex)){
        currentIndex=fromIndex;
        engine.setIndex(currentIndex);
        applyIndex(currentIndex,'schedule-priority',result);
        updateStopGuard();
        return;
      }
    }

    let arrivalDetail=null;

    if(result.justArrived){
      const row=routeRows[currentIndex];
      const plan=alarmEligible(routeRows,currentIndex,row)?rowPlanDate(row):null;
      reachedBeforeTime=Boolean(plan&&Date.now()<plan.getTime());
      arrivalDetail={
        index:currentIndex,
        key:row?.dataset.stopId||`${currentIndex}:${row?.dataset.coordinate||''}`,
        name:row?.children[0]?.innerText.trim()||'',
        coordinate:row?.dataset.coordinate||'',
        final:currentIndex===routeRows.length-1,
        direction:body.dataset.direction||'forward',
        emptyRun:body.dataset.emptyRun==='1'
      };
    }
    if(result.changed&&result.reason==='confirmed-departure'){
      const previousRow=routeRows[result.fromIndex];
      const eligible=alarmEligible(routeRows,result.fromIndex,previousRow);
      const plan=eligible?rowPlanDate(previousRow):null;
      if(eligible&&reachedBeforeTime&&plan&&Date.now()<plan.getTime()&&body.dataset.direction!=='return')showEarlyDepartureWarning(rowPlanText(previousRow));
      reachedBeforeTime=false;
    }
    if(result.justSkipped&&Number.isInteger(result.skippedIndex)){
      const skippedRow=routeRows[result.skippedIndex];
      const skippedName=skippedRow?.children[0]?.innerText.trim()||'Przystanek';
      reachedBeforeTime=false;
      showMissedStopWarning(skippedName);
      body.dispatchEvent(new CustomEvent('gps-stop-skipped',{
        bubbles:true,
        detail:{
          index:result.skippedIndex,
          name:skippedName,
          key:skippedRow?.dataset.stopId||`${result.skippedIndex}:${skippedRow?.dataset.coordinate||''}`,
          coordinate:skippedRow?.dataset.coordinate||'',
          nextIndex:currentIndex,
          direction:body.dataset.direction||'forward'
        }
      }));
    }

    applyIndex(currentIndex,result.reason,result);
    if(arrivalDetail)body.dispatchEvent(new CustomEvent('gps-stop-arrival',{bubbles:true,detail:arrivalDetail}));
    updateStopGuard();
  }

  function onPos(position){
    const accuracy=Number(position.coords.accuracy||999);
    if(accuracy>MAX_ACCURACY)return;
    window.__navAcc=accuracy;

    const here=[position.coords.latitude,position.coords.longitude];
    const now=Number(position.timestamp)||Date.now();
    let speed=Number(position.coords.speed);
    if(!Number.isFinite(speed)||speed<0){
      if(lastPos&&lastPosAt&&now>lastPosAt)speed=distanceMeters(lastPos,here)/((now-lastPosAt)/1000);
      else speed=0;
    }
    speed=Math.max(0,speed);
    const kmh=speed*3.6;
    window.__routeCurrentSpeedKmh=kmh;
    document.dispatchEvent(new CustomEvent('trasy:gps-speed',{detail:{kmh,accuracy}}));

    let nextHeading=Number(position.coords.heading);
    let reliable=Number.isFinite(nextHeading)&&nextHeading>=0&&speed>=MIN_HEADING_SPEED_MPS;
    if(!reliable){
      if(!headingAnchor)headingAnchor=here;
      const moved=distanceMeters(headingAnchor,here);
      const requiredMove=Math.max(MIN_HEADING_MOVE,Math.min(30,accuracy*0.35));
      if(moved>=requiredMove&&speed>=MIN_HEADING_SPEED_MPS){
        nextHeading=bearingDegrees(headingAnchor,here);
        reliable=true;
        headingAnchor=here;
      }
    }else headingAnchor=here;
    if(reliable){
      heading=nextHeading;
      headingAt=now;
    }
    const headingReliable=Number.isFinite(heading)&&speed>=MIN_HEADING_SPEED_MPS&&now-headingAt<=HEADING_VALID_MS;

    lastPos=here;
    lastPosAt=now;
    chooseAndApply({speedMps:speed,headingReliable});
  }

  function start(){
    if(watch!==null)return;
    watch=window.__trasyGps.subscribe(onPos,()=>{});
  }

  function setManualIndex(index,source){
    const routeRows=rows();
    const minimum=minimumTargetIndex();
    if(!Number.isInteger(index)||index<minimum||index>=routeRows.length)return;
    currentIndex=index;
    reachedBeforeTime=false;
    engine.setIndex(index);
    applyIndex(index,source||'manual-target');
    updateStopGuard();
  }

  body.addEventListener('route-direction-change',routeChanged);
  body.addEventListener('route-mode-change',routeChanged);
  body.addEventListener('schedule-rendered',routeChanged);
  body.addEventListener('gps-skip-stop',event=>setManualIndex(Number(event.detail?.index),event.detail?.source));
  setInterval(updateStopGuard,1000);
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')start()});
  start();
})();