(()=>{
  if(globalThis.__trasyTime)return;

  const DAY_MS=24*60*60*1000;
  const DAY_SECONDS=24*60*60;

  function normalizeClockTime(value){
    const text=String(value??'').trim();
    const iso=text.match(/T(\d{2}):(\d{2})(?::\d{2})?/);
    const match=iso||text.match(/(?:^|\D)(\d{1,2}):(\d{2})(?:\D|$)/);
    if(!match)return'';
    const hours=Number(match[1]);
    const minutes=Number(match[2]);
    if(!Number.isInteger(hours)||hours<0||hours>23||!Number.isInteger(minutes)||minutes<0||minutes>59)return'';
    return`${String(hours).padStart(2,'0')}:${String(minutes).padStart(2,'0')}`;
  }

  function clockParts(value){
    const normalized=normalizeClockTime(value);
    if(!normalized)return null;
    const [hours,minutes]=normalized.split(':').map(Number);
    return{hours,minutes,totalMinutes:hours*60+minutes};
  }

  function rowPlanText(row){
    const cell=row?.children?.[1];
    if(!cell)return'';
    const candidates=[
      cell.dataset?.routeRolePlan,
      cell.dataset?.finalStopPlan,
      cell.dataset?.forwardTime,
      cell.querySelector?.('.routeRolePlan')?.textContent,
      cell.textContent
    ];
    for(const candidate of candidates){
      const normalized=normalizeClockTime(candidate);
      if(normalized)return normalized;
    }
    return'';
  }

  function nearestFutureTime(values,now=new Date()){
    const nowSeconds=now.getHours()*3600+now.getMinutes()*60+now.getSeconds()+now.getMilliseconds()/1000;
    let best=null;
    for(const original of values||[]){
      const normalized=normalizeClockTime(original);
      const parts=clockParts(normalized);
      if(!parts)continue;
      const courseSeconds=parts.hours*3600+parts.minutes*60;
      const waitSeconds=(courseSeconds-nowSeconds+DAY_SECONDS)%DAY_SECONDS;
      if(!best||waitSeconds<best.waitSeconds){
        best={value:original,normalized,waitSeconds};
      }
    }
    return best?.value??'';
  }

  function addMinutesToTime(value,deltaMinutes){
    const parts=clockParts(value);
    if(!parts)return'';
    const delta=Number(deltaMinutes);
    if(!Number.isFinite(delta))return'';
    const total=((parts.totalMinutes+Math.trunc(delta))%(24*60)+(24*60))%(24*60);
    return`${String(Math.floor(total/60)).padStart(2,'0')}:${String(total%60).padStart(2,'0')}`;
  }

  function planDateForRow(rows,row,now=new Date()){
    const list=Array.from(rows||[]);
    const targetIndex=list.indexOf(row);
    if(targetIndex<0)return null;

    let dayOffset=0;
    let previousMinutes=null;
    let target=null;

    for(let i=0;i<=targetIndex;i+=1){
      const parts=clockParts(rowPlanText(list[i]));
      if(!parts)continue;
      if(previousMinutes!==null&&parts.totalMinutes<previousMinutes-12*60)dayOffset+=1;
      previousMinutes=parts.totalMinutes;
      if(i===targetIndex){
        target=new Date(now);
        target.setHours(parts.hours,parts.minutes,0,0);
        target.setDate(target.getDate()+dayOffset);
      }
    }

    if(!target)return null;
    while(target.getTime()-now.getTime()>12*60*60*1000)target=new Date(target.getTime()-DAY_MS);
    while(now.getTime()-target.getTime()>18*60*60*1000)target=new Date(target.getTime()+DAY_MS);
    return target;
  }

  globalThis.__trasyTime=Object.freeze({
    normalizeClockTime,
    rowPlanText,
    nearestFutureTime,
    addMinutesToTime,
    planDateForRow
  });
})();
