(()=>{
  if(globalThis.__trasyEta)return;

  const DEFAULT_TOLERANCE_SECONDS=30;

  function finiteNumber(value){
    if(value===null||value===undefined||value==='')return null;
    const number=Number(value);
    return Number.isFinite(number)?number:null;
  }

  function statusFromDiff(diffSeconds,toleranceSeconds=DEFAULT_TOLERANCE_SECONDS){
    const diff=finiteNumber(diffSeconds);
    if(diff===null)return{kind:'neutral',text:'',diffSeconds:null};
    const tolerance=Math.max(0,Number(toleranceSeconds)||0);
    if(Math.abs(diff)<=tolerance)return{kind:'onTime',text:'👍',diffSeconds:diff};
    const minutes=Math.max(1,Math.floor(Math.abs(diff)/60));
    return diff<0
      ?{kind:'early',text:`${minutes} min za wcześnie`,diffSeconds:diff}
      :{kind:'late',text:`${minutes} min opóźnienia`,diffSeconds:diff};
  }

  function statusFromEta(etaSeconds,planSeconds,toleranceSeconds=DEFAULT_TOLERANCE_SECONDS){
    const eta=finiteNumber(etaSeconds),plan=finiteNumber(planSeconds);
    if(eta===null||plan===null)return{kind:'neutral',text:'',diffSeconds:null,etaSeconds:eta};
    return{...statusFromDiff(eta-plan,toleranceSeconds),etaSeconds:eta};
  }

  globalThis.__trasyEta=Object.freeze({
    DEFAULT_TOLERANCE_SECONDS,
    statusFromDiff,
    statusFromEta
  });
})();
