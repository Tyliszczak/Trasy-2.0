import './geo-core.js';

const geo=globalThis.__trasyGeo;
export const distanceMeters=geo.distanceMeters;
export const bearingDegrees=geo.bearingDegrees;
export const angleDifference=geo.angleDifference;

export const DEFAULT_STOP_ENGINE_CONFIG=Object.freeze({
  maxAccuracy:100,
  arrivalBaseMeters:35,
  arrivalMaxMeters:55,
  arrivalFixes:3,
  maximumArrivalSpeedMps:1.4,
  departureBaseMeters:85,
  departureGrowthMeters:5,
  departureFixes:2,
  departureFixesWithoutDirection:3,
  minimumMovingSpeedMps:1.5,
  maximumHeadingToNextDegrees:100,
  initialNearbyMeters:600,
  initialAdvantageMeters:200,
  initialMaximumHeadingDegrees:110,
  passNearBaseMeters:75,
  passNearMaxMeters:100,
  passGrowthMeters:18,
  passFixes:3,
  passMinimumSpeedMps:2,
  passMaximumHeadingToNextDegrees:75,
  reacquireDistanceMeters:220,
  reacquireFixes:2,
  reacquireMinimumSpeedMps:2,
  reacquireCurrentBehindDegrees:120,
  reacquireMaximumHeadingDegrees:110,
  reacquireMaximumIndexAdvance:1
});

export function createStopProgressEngine(overrides={}){
  const config={...DEFAULT_STOP_ENGINE_CONFIG,...overrides};
  let index=null;
  let phase='approaching';
  let arrivalFixes=0;
  let departureFixes=0;
  let passFixes=0;
  let closestDistance=Infinity;
  let lastDistance=Infinity;
  let reacquireCandidate=null;
  let reacquireFixes=0;
  // Pierwszy cel wybrany bez wiarygodnego kierunku jazdy jest tylko
  // tymczasowy. Gdy pojazd ruszy i GPS poda pewny heading, wybieramy go
  // ponownie. To zapobiega przyklejeniu nawigacji do pierwszego przystanku,
  // jeśli aplikacja została otwarta na postoju lub w środku trasy.
  let initialSelectionProvisional=false;
  // Automatyczne odzyskanie celu jest domyślnie zablokowane. Sam kierunek
  // jazdy nie jest dowodem minięcia odległego przystanku (objazd, rondo,
  // droga serwisowa). Tracker może uzbroić jedną próbę wyłącznie po
  // kontrolowanym wznowieniu nawigacji.
  let reacquireLocked=true;

  function resetReacquire(){
    reacquireCandidate=null;
    reacquireFixes=0;
  }

  function reset(nextIndex=null){
    index=Number.isInteger(nextIndex)?nextIndex:null;
    phase='approaching';
    arrivalFixes=0;
    departureFixes=0;
    passFixes=0;
    closestDistance=Infinity;
    lastDistance=Infinity;
    initialSelectionProvisional=false;
    reacquireLocked=true;
    resetReacquire();
  }

  function setIndex(nextIndex){
    reset(nextIndex);
    return snapshot();
  }

  function armReacquire(){
    reacquireLocked=false;
    resetReacquire();
  }

  function snapshot(){
    return{index,phase,arrived:phase==='arrived'};
  }

  function selectInitial(stops,position,{emptyRun=false,speedMps=0,heading=null,headingReliable=false,minimumIndex=0}={}){
    if(!stops.length)return null;
    if(emptyRun)return stops.length-1;
    const firstIndex=Math.max(0,Math.min(stops.length-1,Math.trunc(Number(minimumIndex)||0)));

    const moving=Number.isFinite(speedMps)&&speedMps>=config.minimumMovingSpeedMps;
    if(moving){
      // Gdy aplikacja/tracker startuje już podczas jazdy, nie przypinaj celu
      // do pierwszego przystanku tylko dlatego, że kierunek GPS nie zdążył
      // się jeszcze ustabilizować. Po kilku metrach tracker wyliczy heading.
      if(!headingReliable||!Number.isFinite(heading))return null;

      // Wybieramy pierwszy przystanek w kolejności trasy, który znajduje się
      // przed autem. Dzięki temu punkt pozostawiony za plecami nie wraca jako
      // aktywny cel, nawet jeśli kolejny jest jeszcze daleko (>600 m).
      for(let i=firstIndex;i<stops.length;i+=1){
        const targetBearing=bearingDegrees(position,stops[i].coord);
        if(angleDifference(heading,targetBearing)<=config.initialMaximumHeadingDegrees)return i;
      }
    }

    const distances=stops.map(stop=>distanceMeters(position,stop.coord));
    let nearest=firstIndex;
    for(let i=firstIndex+1;i<distances.length;i+=1){
      if(distances[i]<distances[nearest])nearest=i;
    }
    if(nearest>firstIndex&&distances[nearest]<=config.initialNearbyMeters&&distances[firstIndex]-distances[nearest]>=config.initialAdvantageMeters)return nearest;
    return firstIndex;
  }

  function findReacquireCandidate(stops,position,speedMps,heading,headingReliable,currentDistance){
    if(index===null||index>=stops.length-1)return null;
    if(reacquireLocked)return null;
    if(!headingReliable||!Number.isFinite(heading))return null;
    if(!Number.isFinite(speedMps)||speedMps<config.reacquireMinimumSpeedMps)return null;
    if(!Number.isFinite(currentDistance)||currentDistance<config.reacquireDistanceMeters)return null;

    const currentBearing=bearingDegrees(position,stops[index].coord);
    if(angleDifference(heading,currentBearing)<config.reacquireCurrentBehindDegrees)return null;

    const lastCandidate=Math.min(stops.length-1,index+Math.max(1,Math.trunc(config.reacquireMaximumIndexAdvance)||1));
    for(let i=index+1;i<=lastCandidate;i+=1){
      const targetBearing=bearingDegrees(position,stops[i].coord);
      if(angleDifference(heading,targetBearing)<=config.reacquireMaximumHeadingDegrees)return i;
    }
    // Jeśli również kolejny punkt został już za pojazdem, wolno odzyskać
    // wyłącznie ten jeden punkt. Blokada po przejściu nie pozwoli utworzyć
    // łańcucha kolejnych automatycznych pominięć.
    return index+1;
  }

  function update({stops,position,accuracy,speedMps=0,heading=null,headingReliable=false,emptyRun=false,minimumIndex=0}){
    if(!Array.isArray(stops)||!stops.length||!position)return{...snapshot(),changed:false,reason:'no-stops'};
    const firstIndex=Math.max(0,Math.min(stops.length-1,Math.trunc(Number(minimumIndex)||0)));
    if(emptyRun){
      const nextIndex=stops.length-1;
      const changed=index!==nextIndex;
      if(changed)reset(nextIndex);
      return{...snapshot(),changed,reason:changed?'empty-run-target':'tracking'};
    }
    if(!Number.isFinite(accuracy)||accuracy>config.maxAccuracy)return{...snapshot(),changed:false,reason:'poor-accuracy'};
    if(index===null||index<firstIndex||index>=stops.length){
      const movingReliable=Number.isFinite(speedMps)&&speedMps>=config.minimumMovingSpeedMps&&headingReliable&&Number.isFinite(heading);
      const selected=selectInitial(stops,position,{emptyRun:false,speedMps,heading,headingReliable,minimumIndex:firstIndex});
      if(selected===null)return{...snapshot(),changed:false,reason:'awaiting-heading'};
      index=selected;
      phase='approaching';
      arrivalFixes=0;
      departureFixes=0;
      passFixes=0;
      closestDistance=Infinity;
      lastDistance=Infinity;
      initialSelectionProvisional=!movingReliable;
      resetReacquire();
      return{...snapshot(),changed:true,reason:'initial-target'};
    }

    const movingReliable=Number.isFinite(speedMps)&&speedMps>=config.minimumMovingSpeedMps&&headingReliable&&Number.isFinite(heading);
    if(initialSelectionProvisional&&phase==='approaching'&&movingReliable){
      const selected=selectInitial(stops,position,{emptyRun:false,speedMps,heading,headingReliable:true,minimumIndex:firstIndex});
      initialSelectionProvisional=false;
      if(selected!==null&&selected!==index){
        const fromIndex=index;
        index=selected;
        phase='approaching';
        arrivalFixes=0;
        departureFixes=0;
        passFixes=0;
        closestDistance=Infinity;
        lastDistance=Infinity;
        reacquireLocked=true;
        resetReacquire();
        const distance=distanceMeters(position,stops[index].coord);
        const arrivalRadius=Math.min(config.arrivalMaxMeters,config.arrivalBaseMeters+Math.max(0,accuracy)*0.25);
        const departureRadius=Math.max(config.departureBaseMeters,arrivalRadius+35);
        return{...snapshot(),changed:true,reason:'initial-motion-target',fromIndex,distance,arrivalRadius,departureRadius};
      }
    }

    const current=stops[index];
    const distance=distanceMeters(position,current.coord);
    const arrivalRadius=Math.min(config.arrivalMaxMeters,config.arrivalBaseMeters+Math.max(0,accuracy)*0.25);
    const departureRadius=Math.max(config.departureBaseMeters,arrivalRadius+35);

    if(phase==='approaching'){
      closestDistance=Math.min(closestDistance,distance);

      // Samonaprawa celu GPS: jeśli aktywny przystanek jest już wyraźnie za
      // pojazdem, a kierunek ruchu przez dwa kolejne odczyty wskazuje jeden z
      // dalszych punktów trasy, tracker ponownie łapie właściwy cel. To usuwa
      // sytuację, w której po uruchomieniu aplikacji w środku kursu nawigacja
      // zostaje na pierwszym przystanku tylko dlatego, że nie zarejestrowała
      // wcześniejszego przejazdu przez jego promień.
      const candidate=findReacquireCandidate(stops,position,speedMps,heading,headingReliable,distance);
      if(candidate!==null){
        if(reacquireCandidate===candidate)reacquireFixes+=1;
        else{
          reacquireCandidate=candidate;
          reacquireFixes=1;
        }
        if(reacquireFixes>=config.reacquireFixes){
          const fromIndex=index;
          index=candidate;
          phase='approaching';
          arrivalFixes=0;
          departureFixes=0;
          passFixes=0;
          closestDistance=Infinity;
          lastDistance=Infinity;
          initialSelectionProvisional=false;
          // Jedno odzyskanie celu może przesunąć nawigację najwyżej o jeden
          // przystanek. Następne wymaga fizycznego potwierdzenia przejazdu lub
          // postoju, więc seria odczytów GPS nie usunie kilku punktów naraz.
          reacquireLocked=true;
          resetReacquire();
          return{...snapshot(),changed:true,reason:'reacquired-target',fromIndex,distance,arrivalRadius,departureRadius};
        }
      }else resetReacquire();

      const stopped=Number.isFinite(speedMps)&&speedMps<=config.maximumArrivalSpeedMps;
      if(distance<=arrivalRadius&&stopped)arrivalFixes+=1;
      else arrivalFixes=0;
      lastDistance=distance;
      if(arrivalFixes>=config.arrivalFixes){
        phase='arrived';
        departureFixes=0;
        passFixes=0;
        initialSelectionProvisional=false;
        reacquireLocked=true;
        resetReacquire();
        return{...snapshot(),changed:false,reason:'arrival-confirmed',justArrived:true,distance,arrivalRadius,departureRadius};
      }

      if(index<stops.length-1){
        const next=stops[index+1];
        const passNearRadius=Math.min(config.passNearMaxMeters,config.passNearBaseMeters+Math.max(0,accuracy)*0.25);
        const wasNear=closestDistance<=passNearRadius;
        const moving=Number.isFinite(speedMps)&&speedMps>=config.passMinimumSpeedMps;
        const movingAway=distance>=closestDistance+config.passGrowthMeters;
        const towardNext=headingReliable&&Number.isFinite(heading)&&angleDifference(heading,bearingDegrees(position,next.coord))<=config.passMaximumHeadingToNextDegrees;
        if(wasNear&&moving&&movingAway&&towardNext)passFixes+=1;
        else if(!movingAway||!moving||!towardNext)passFixes=0;

        if(passFixes>=config.passFixes){
          const fromIndex=index;
          index+=1;
          phase='approaching';
          arrivalFixes=0;
          departureFixes=0;
          passFixes=0;
          closestDistance=Infinity;
          lastDistance=Infinity;
          initialSelectionProvisional=false;
          reacquireLocked=true;
          resetReacquire();
          return{...snapshot(),changed:true,reason:'passed-stop',fromIndex,skippedIndex:fromIndex,justSkipped:true,distance,arrivalRadius,departureRadius};
        }
      }

      return{...snapshot(),changed:false,reason:'approaching',distance,arrivalRadius,departureRadius,stopped,closestDistance,passFixes,reacquireCandidate,reacquireFixes};
    }

    initialSelectionProvisional=false;
    resetReacquire();
    if(index>=stops.length-1){
      lastDistance=distance;
      return{...snapshot(),changed:false,reason:'final-arrived',distance,arrivalRadius,departureRadius};
    }

    const next=stops[index+1];
    const growing=Number.isFinite(lastDistance)&&distance>=lastDistance+config.departureGrowthMeters;
    const moving=Number.isFinite(speedMps)&&speedMps>=config.minimumMovingSpeedMps;
    const towardNext=headingReliable&&Number.isFinite(heading)&&angleDifference(heading,bearingDegrees(position,next.coord))<=config.maximumHeadingToNextDegrees;

    if(distance>=departureRadius&&growing&&moving)departureFixes+=1;
    else departureFixes=0;
    lastDistance=distance;

    const requiredDepartureFixes=towardNext?config.departureFixes:config.departureFixesWithoutDirection;
    if(departureFixes>=requiredDepartureFixes){
      const fromIndex=index;
      index+=1;
      phase='approaching';
      arrivalFixes=0;
      departureFixes=0;
      passFixes=0;
      closestDistance=Infinity;
      lastDistance=Infinity;
      initialSelectionProvisional=false;
      reacquireLocked=true;
      resetReacquire();
      return{...snapshot(),changed:true,reason:'confirmed-departure',fromIndex,distance,arrivalRadius,departureRadius};
    }
    return{...snapshot(),changed:false,reason:'arrived',distance,arrivalRadius,departureRadius};
  }

  return{reset,setIndex,armReacquire,update,snapshot,config};
}
