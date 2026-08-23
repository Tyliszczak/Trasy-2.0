export const DEFAULT_STOP_ENGINE_CONFIG=Object.freeze({
  maxAccuracy:100,
  arrivalBaseMeters:35,
  arrivalMaxMeters:55,
  arrivalFixes:3,
  departureBaseMeters:85,
  departureGrowthMeters:5,
  departureFixes:2,
  departureFixesWithoutDirection:3,
  minimumMovingSpeedMps:1.5,
  maximumHeadingToNextDegrees:100,
  initialNearbyMeters:600,
  initialAdvantageMeters:200
});

export function distanceMeters(a,b){
  const R=6371000,p=Math.PI/180;
  const dLat=(b[0]-a[0])*p,dLon=(b[1]-a[1])*p;
  const x=Math.sin(dLat/2)**2+
    Math.cos(a[0]*p)*Math.cos(b[0]*p)*Math.sin(dLon/2)**2;
  return 2*R*Math.asin(Math.sqrt(x));
}

export function bearingDegrees(a,b){
  const p=Math.PI/180;
  const y=Math.sin((b[1]-a[1])*p)*Math.cos(b[0]*p);
  const x=Math.cos(a[0]*p)*Math.sin(b[0]*p)-
    Math.sin(a[0]*p)*Math.cos(b[0]*p)*Math.cos((b[1]-a[1])*p);
  return(Math.atan2(y,x)*180/Math.PI+360)%360;
}

export function angleDifference(a,b){
  return Math.abs(((a-b+540)%360)-180);
}

export function createStopProgressEngine(overrides={}){
  const config={...DEFAULT_STOP_ENGINE_CONFIG,...overrides};
  let index=null;
  let phase='approaching';
  let arrivalFixes=0;
  let departureFixes=0;
  let lastDistance=Infinity;

  function reset(nextIndex=null){
    index=Number.isInteger(nextIndex)?nextIndex:null;
    phase='approaching';
    arrivalFixes=0;
    departureFixes=0;
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
    for(let i=1;i<distances.length;i++){
      if(distances[i]<distances[nearest])nearest=i;
    }

    if(
      nearest>0&&
      distances[nearest]<=config.initialNearbyMeters&&
      distances[0]-distances[nearest]>=config.initialAdvantageMeters
    )return nearest;

    return 0;
  }

  function update({
    stops,
    position,
    accuracy,
    speedMps=0,
    heading=null,
    headingReliable=false,
    emptyRun=false
  }){
    if(!Array.isArray(stops)||!stops.length||!position){
      return{...snapshot(),changed:false,reason:'no-stops'};
    }

    if(emptyRun){
      const nextIndex=stops.length-1;
      const changed=index!==nextIndex;
      if(changed)reset(nextIndex);
      return{...snapshot(),changed,reason:changed?'empty-run-target':'tracking'};
    }

    if(!Number.isFinite(accuracy)||accuracy>config.maxAccuracy){
      return{...snapshot(),changed:false,reason:'poor-accuracy'};
    }

    if(index===null||index<0||index>=stops.length){
      index=selectInitial(stops,position,false);
      phase='approaching';
      arrivalFixes=0;
      departureFixes=0;
      lastDistance=Infinity;
      return{...snapshot(),changed:true,reason:'initial-target'};
    }

    const current=stops[index];
    const distance=distanceMeters(position,current.coord);
    const arrivalRadius=Math.min(
      config.arrivalMaxMeters,
      config.arrivalBaseMeters+Math.max(0,accuracy)*0.25
    );
    const departureRadius=Math.max(
      config.departureBaseMeters,
      arrivalRadius+35
    );

    if(phase==='approaching'){
      if(distance<=arrivalRadius)arrivalFixes+=1;
      else arrivalFixes=0;

      lastDistance=distance;
      if(arrivalFixes>=config.arrivalFixes){
        phase='arrived';
        departureFixes=0;
        return{
          ...snapshot(),changed:false,reason:'arrival-confirmed',
          justArrived:true,distance,arrivalRadius,departureRadius
        };
      }

      return{
        ...snapshot(),changed:false,reason:'approaching',
        distance,arrivalRadius,departureRadius
      };
    }

    if(index>=stops.length-1){
      lastDistance=distance;
      return{
        ...snapshot(),changed:false,reason:'final-arrived',
        distance,arrivalRadius,departureRadius
      };
    }

    const next=stops[index+1];
    const growing=Number.isFinite(lastDistance)&&
      distance>=lastDistance+config.departureGrowthMeters;
    const moving=Number.isFinite(speedMps)&&
      speedMps>=config.minimumMovingSpeedMps;
    const towardNext=headingReliable&&Number.isFinite(heading)&&
      angleDifference(heading,bearingDegrees(position,next.coord))<=
        config.maximumHeadingToNextDegrees;

    if(distance>=departureRadius&&growing&&moving){
      departureFixes+=1;
    }else{
      departureFixes=0;
    }
    lastDistance=distance;

    const requiredDepartureFixes=towardNext
      ?config.departureFixes
      :config.departureFixesWithoutDirection;

    if(departureFixes>=requiredDepartureFixes){
      const fromIndex=index;
      index+=1;
      phase='approaching';
      arrivalFixes=0;
      departureFixes=0;
      lastDistance=Infinity;
      return{
        ...snapshot(),changed:true,reason:'confirmed-departure',
        fromIndex,distance,arrivalRadius,departureRadius
      };
    }

    return{
      ...snapshot(),changed:false,reason:'arrived',
      distance,arrivalRadius,departureRadius
    };
  }

  return{reset,setIndex,update,snapshot,config};
}
