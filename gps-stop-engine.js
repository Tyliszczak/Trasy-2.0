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
  passNearBaseMeters:75,
  passNearMaxMeters:100,
  passGrowthMeters:18,
  passFixes:3,
  passMinimumSpeedMps:2,
  passMaximumHeadingToNextDegrees:75
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

  function reset(nextIndex=null){
    index=Number.isInteger(nextIndex)?nextIndex:null;
    phase='approaching';
    arrivalFixes=0;
    departureFixes=0;
    passFixes=0;
    closestDistance=Infinity;
    lastDistance=Infinity;
  }

  function setIndex(nextIndex){
    reset(nextIndex);
    return snapshot();
  }

  function snapshot(){
    return{index,phase,arrived:phase==='arrived'};
  }

  function selectInitial(stops,position,emptyRun=false){
    if(!stops.length)return null;
    if(emptyRun)return stops.length-1;
    const distances=stops.map(stop=>distanceMeters(position,stop.coord));
    let nearest=0;
    for(let i=1;i<distances.length;i+=1){
      if(distances[i]<distances[nearest])nearest=i;
    }
    if(nearest>0&&distances[nearest]<=config.initialNearbyMeters&&distances[0]-distances[nearest]>=config.initialAdvantageMeters)return nearest;
    return 0;
  }

  function update({stops,position,accuracy,speedMps=0,heading=null,headingReliable=false,emptyRun=false}){
    if(!Array.isArray(stops)||!stops.length||!position)return{...snapshot(),changed:false,reason:'no-stops'};
    if(emptyRun){
      const nextIndex=stops.length-1;
      const changed=index!==nextIndex;
      if(changed)reset(nextIndex);
      return{...snapshot(),changed,reason:changed?'empty-run-target':'tracking'};
    }
    if(!Number.isFinite(accuracy)||accuracy>config.maxAccuracy)return{...snapshot(),changed:false,reason:'poor-accuracy'};
    if(index===null||index<0||index>=stops.length){
      index=selectInitial(stops,position,false);
      phase='approaching';
      arrivalFixes=0;
      departureFixes=0;
      passFixes=0;
      closestDistance=Infinity;
      lastDistance=Infinity;
      return{...snapshot(),changed:true,reason:'initial-target'};
    }

    const current=stops[index];
    const distance=distanceMeters(position,current.coord);
    const arrivalRadius=Math.min(config.arrivalMaxMeters,config.arrivalBaseMeters+Math.max(0,accuracy)*0.25);
    const departureRadius=Math.max(config.departureBaseMeters,arrivalRadius+35);

    if(phase==='approaching'){
      closestDistance=Math.min(closestDistance,distance);
      const stopped=Number.isFinite(speedMps)&&speedMps<=config.maximumArrivalSpeedMps;
      if(distance<=arrivalRadius&&stopped)arrivalFixes+=1;
      else arrivalFixes=0;
      lastDistance=distance;
      if(arrivalFixes>=config.arrivalFixes){
        phase='arrived';
        departureFixes=0;
        passFixes=0;
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
          return{...snapshot(),changed:true,reason:'passed-stop',fromIndex,skippedIndex:fromIndex,justSkipped:true,distance,arrivalRadius,departureRadius};
        }
      }

      return{...snapshot(),changed:false,reason:'approaching',distance,arrivalRadius,departureRadius,stopped,closestDistance,passFixes};
    }

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
      return{...snapshot(),changed:true,reason:'confirmed-departure',fromIndex,distance,arrivalRadius,departureRadius};
    }
    return{...snapshot(),changed:false,reason:'arrived',distance,arrivalRadius,departureRadius};
  }

  return{reset,setIndex,update,snapshot,config};
}
