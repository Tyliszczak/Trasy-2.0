(()=>{
  const MAX_AGE_MS=15000;
  const MAX_ACCURACY_M=120;
  const MAX_FUTURE_MS=1000;

  function evaluate(position,{now=Date.now(),notBefore=0}={}){
    const coords=position?.coords;
    const timestamp=position?.timestamp;
    const accuracy=coords?.accuracy;
    const ageMs=Number.isFinite(timestamp)?now-timestamp:null;
    const result=(usable,reason)=>({usable,reason,ageMs,accuracy:Number.isFinite(accuracy)?accuracy:null});
    if(!position)return result(false,'missing-position');
    if(!coords||!Number.isFinite(coords.latitude)||Math.abs(coords.latitude)>90||
      !Number.isFinite(coords.longitude)||Math.abs(coords.longitude)>180)return result(false,'invalid-coordinates');
    if(!Number.isFinite(timestamp)||timestamp<=0)return result(false,'invalid-timestamp');
    if(!Number.isFinite(now)||ageMs < -MAX_FUTURE_MS)return result(false,'future-timestamp');
    if(timestamp<notBefore)return result(false,'before-resume');
    if(ageMs>MAX_AGE_MS)return result(false,'stale');
    if(!Number.isFinite(accuracy)||accuracy<0)return result(false,'invalid-accuracy');
    if(accuracy>MAX_ACCURACY_M)return result(false,'poor-accuracy');
    return result(true,'ready');
  }

  globalThis.__trasyGpsQuality=Object.freeze({evaluate,MAX_AGE_MS,MAX_ACCURACY_M,MAX_FUTURE_MS});
})();
