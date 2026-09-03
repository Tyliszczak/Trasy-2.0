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

  // Przy uruchomieniu kursu pierwszy przystanek jest chroniony przed
  // przypadkowym wyborem dalszego punktu. Ta ochrona nie może jednak
  // unieważniać pozycji GPS i kierunku jazdy bez końca: po 10 minutach od
  // planu silnik GPS może wybrać pierwszy przystanek znajdujący się przed
  // pojazdem. Dzięki temu start aplikacji w środku opóźnionego kursu nie
  // przykleja prowadzenia do punktu pozostawionego daleko za autobusem.
  if(transitionReason==='initial-target')return nowMs-currentMs>=SCHEDULE_PRIORITY_GRACE_MS;

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
