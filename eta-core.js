(()=>{
  if(globalThis.__trasyEta)return;

  const DEFAULT_TOLERANCE_SECONDS=30;

  function statusFromDiff(diffSeconds,toleranceSeconds=DEFAULT_TOLERANCE_SECONDS){
    const diff=Number(diffSeconds);
    if(!Number.isFinite(diff))return{kind:'neutral',text:'',diffSeconds:null};
    const tolerance=Math.max(0,Number(toleranceSeconds)||0);
    if(Math.abs(diff)<=tolerance)return{kind:'onTime',text:'👍',diffSeconds:diff};
    const minutes=Math.max(1,Math.floor(Math.abs(diff)/60));
    return diff<0
      ?{kind:'early',text:`${minutes} min za wcześnie`,diffSeconds:diff}
      :{kind:'late',text:`${minutes} min opóźnienia`,diffSeconds:diff};
  }

  function statusFromEta(etaSeconds,planSeconds,toleranceSeconds=DEFAULT_TOLERANCE_SECONDS){
    const eta=Number(etaSeconds),plan=Number(planSeconds);
    if(!Number.isFinite(eta)||!Number.isFinite(plan))return{kind:'neutral',text:'',diffSeconds:null,etaSeconds:Number.isFinite(eta)?eta:null};
    return{...statusFromDiff(eta-plan,toleranceSeconds),etaSeconds:eta};
  }

  globalThis.__trasyEta=Object.freeze({
    DEFAULT_TOLERANCE_SECONDS,
    statusFromDiff,
    statusFromEta
  });
})();
