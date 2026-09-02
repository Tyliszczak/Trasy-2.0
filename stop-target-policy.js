function dateMs(value){
  if(value===null||value===undefined||value==='')return null;
  if(value instanceof Date){
    const ms=value.getTime();
    return Number.isFinite(ms)?ms:null;
  }
  const ms=Number(value);
  return Number.isFinite(ms)?ms:null;
}

const SCHEDULE_PRIORITY_GRACE_MS=10*60*1000;

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
  now=new Date(),
  transitionReason=''
}={}){
  const nowMs=dateMs(now);
  const currentMs=dateMs(currentPlan);
  const nextMs=dateMs(nextPlan);
  if(nowMs===null||currentMs===null||nextMs===null)return false;

  // Przy pierwszym wyborze celu nigdy nie wolno przeskakiwać do przystanku
  // położonego bliżej auta. Nawigacja ma zacząć od pierwszego przystanku
  // wynikającego z kolejności trasy. Kolejne zmiany celu wymagają już
  // rzeczywistego przejazdu / odjazdu albo ręcznego pominięcia.
  if(transitionReason==='initial-target')return false;

  // Gdy GPS podczas jazdy wiarygodnie potwierdzi fizyczne minięcie celu,
  // bieżący przystanek może zostać zamknięty już od jego planowej godziny.
  // Przed planem nadal go chronimy, aby przejazd obok nie oznaczał pominięcia.
  if(transitionReason==='passed-stop')return nowMs>=currentMs;

  // Po wyraźnym minięciu planu bieżącego przystanku harmonogram nie może
  // już przytrzymywać prowadzenia na celu pozostawionym za pojazdem.
  if(nowMs-currentMs>=SCHEDULE_PRIORITY_GRACE_MS)return true;

  // W krótkim okresie ochronnym bieżący przystanek zachowuje priorytet
  // do planowej godziny przystanku, na który GPS chce przełączyć cel.
  return nowMs>=nextMs;
}
