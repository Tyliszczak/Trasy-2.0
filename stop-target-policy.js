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
  nextPlan,
  now=new Date()
}={}){
  const nowMs=dateMs(now);
  const currentMs=dateMs(currentPlan);
  const nextMs=dateMs(nextPlan);
  if(nowMs===null||currentMs===null||nextMs===null)return false;

  // Bieżący przystanek zachowuje priorytet aż do planowej godziny
  // przystanku, na który GPS chciałby przełączyć prowadzenie.
  // Dzięki temu odstęp może wynosić 5, 10, 25 czy 60 minut bez
  // sztywnego okna czasowego.
  return nowMs>=nextMs;
}
