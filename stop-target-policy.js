function dateMs(value){
  if(value===null||value===undefined||value==='')return null;
  if(value instanceof Date){
    const ms=value.getTime();
    return Number.isFinite(ms)?ms:null;
  }
  const ms=Number(value);
  return Number.isFinite(ms)?ms:null;
}

export function shouldApplySchedulePriority({
  direction='forward',
  emptyRun=false
}={}){
  // Ochrona czasowa ma sens tylko na kursie z harmonogramem.
  // Powrót nie ma godzin planowych, więc GPS musi móc swobodnie
  // przechodzić na kolejny przystanek po rzeczywistym odjeździe.
  return String(direction||'forward')!=='return'&&!Boolean(emptyRun);
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
