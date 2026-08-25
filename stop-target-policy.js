export const AUTO_ADVANCE_GRACE_MS=15*60*1000;
export const NEXT_STOP_MAX_AHEAD_MS=15*60*1000;

function dateMs(value){
  if(value===null||value===undefined||value==='')return null;
  if(value instanceof Date){
    const ms=value.getTime();
    return Number.isFinite(ms)?ms:null;
  }
  const ms=Number(value);
  return Number.isFinite(ms)?ms:null;
}

export function canAutoAdvanceBySchedule({
  currentPlan,
  nextPlan=null,
  now=new Date(),
  graceMs=AUTO_ADVANCE_GRACE_MS,
  nextStopMaxAheadMs=NEXT_STOP_MAX_AHEAD_MS
}={}){
  const nowMs=dateMs(now);
  const currentMs=dateMs(currentPlan);
  if(nowMs===null||currentMs===null)return false;

  const grace=Math.max(0,Number(graceMs)||0);
  if(nowMs-currentMs<grace)return false;

  const nextMs=dateMs(nextPlan);
  if(nextMs===null)return true;

  const maxAhead=Math.max(0,Number(nextStopMaxAheadMs)||0);
  return nextMs-nowMs<=maxAhead;
}
