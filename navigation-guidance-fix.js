(()=>{
  const nativeFetch=window.fetch.bind(window);

  function angleDiff(a,b){
    if(!Number.isFinite(a)||!Number.isFinite(b))return null;
    return Math.abs(((b-a+540)%360)-180);
  }

  function cleanGuidanceText(value){
    let text=String(value||'').trim();
    if(!text)return text;

    // Najczęstszy „kwiatek” z tłumaczenia manewru straight.
    text=text.replace(/^Skręć\s+(?:lekko\s+)?prosto\s+w\s+(.+)$/i,'Jedź prosto — $1');
    text=text.replace(/^Skręć\s+(?:lekko\s+)?prosto\s*$/i,'Jedź prosto');
    text=text.replace(/^Skręć\s+prosto\s+na\s+(.+)$/i,'Jedź prosto — $1');

    // Drobne duplikaty powstające po składaniu komunikatów.
    text=text.replace(/\bprosto\s+prosto\b/gi,'prosto');
    text=text.replace(/\bskręć\s+skręć\b/gi,'skręć');
    text=text.replace(/\s{2,}/g,' ').trim();

    return text;
  }

  function normalizeRouteResponse(data){
    try{
      const routes=data?.routes;
      if(!Array.isArray(routes))return data;

      routes.forEach(route=>{
        (route.legs||[]).forEach(leg=>{
          (leg.steps||[]).forEach(step=>{
            const m=step?.maneuver;
            if(!m)return;

            const type=String(m.type||'');
            const mod=String(m.modifier||'');
            const before=Number(m.bearing_before);
            const after=Number(m.bearing_after);
            const realTurn=angleDiff(before,after);

            // Dostawca czasem oznacza skręt mimo że geometria drogi jest praktycznie prosta.
            if(
              (type==='turn'||type==='fork'||type==='new name')&&
              /left|right/i.test(mod)&&
              realTurn!==null&&realTurn<25
            ){
              m.type='continue';
              m.modifier='straight';
            }

            // Jeżeli dostawca zwróci modifier "straight", nie może on później zostać
            // przedstawiony użytkownikowi jako "skręć prosto".
            if(/straight/i.test(mod)&&type==='turn'){
              m.type='continue';
              m.modifier='straight';
            }

            if(type==='roundabout'||type==='rotary'){
              m.type=type;
              if(!m.exit)m.modifier='';
            }
          });
        });
      });
    }catch{}

    return data;
  }

  window.fetch=async function(input,init){
    const res=await nativeFetch(input,init);
    const url=typeof input==='string'?input:input?.url||'';

    if(!url.includes('/route/v1/driving/'))return res;

    try{
      const clone=res.clone();
      const data=await clone.json();
      const normalized=normalizeRouteResponse(data);
      return new Response(JSON.stringify(normalized),{
        status:res.status,
        statusText:res.statusText,
        headers:{'Content-Type':'application/json'}
      });
    }catch{
      return res;
    }
  };

  // Ostatnia warstwa bezpieczeństwa: popraw także tekst już złożony przez interfejs.
  function cleanVisibleGuidance(){
    const el=document.getElementById('routeManeuver');
    if(!el)return;
    const clean=cleanGuidanceText(el.textContent);
    if(clean&&clean!==el.textContent)el.textContent=clean;
  }

  const uiTimer=setInterval(()=>{
    const el=document.getElementById('routeManeuver');
    if(!el)return;
    clearInterval(uiTimer);
    cleanVisibleGuidance();
    new MutationObserver(cleanVisibleGuidance).observe(el,{childList:true,characterData:true,subtree:true});
  },200);
  setTimeout(()=>clearInterval(uiTimer),30000);

  const speech=window.speechSynthesis;
  if(!speech||typeof speech.speak!=='function')return;
  const nativeSpeak=speech.speak.bind(speech);

  speech.speak=function(utterance){
    const original=String(utterance?.text||'').trim();
    if(/^Za 400 metrów\./i.test(original))return;
    const clean=cleanGuidanceText(original);
    if(utterance&&clean&&clean!==original){
      try{utterance.text=clean}catch{}
    }
    return nativeSpeak(utterance);
  };
})();
