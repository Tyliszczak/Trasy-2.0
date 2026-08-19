(()=>{
  const nativeFetch=window.fetch.bind(window);

  function angleDiff(a,b){
    if(!Number.isFinite(a)||!Number.isFinite(b))return null;
    return Math.abs(((b-a+540)%360)-180);
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
            // Przy zmianie kierunku poniżej 25° traktujemy manewr jako jazdę prosto.
            if(
              (type==='turn'||type==='fork'||type==='new name')&&
              /left|right/i.test(mod)&&
              realTurn!==null&&realTurn<25
            ){
              m.type='continue';
              m.modifier='straight';
            }

            // Na rondzie modifier (np. "right") nie opisuje wiarygodnie kierunku wyjazdu.
            // Zachowujemy typ ronda i używamy wyłącznie numeru zjazdu, jeśli dostawca go podał.
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

  const speech=window.speechSynthesis;
  if(!speech||typeof speech.speak!=='function')return;
  const nativeSpeak=speech.speak.bind(speech);

  speech.speak=function(utterance){
    const text=String(utterance?.text||'').trim();
    if(/^Za 400 metrów\./i.test(text))return;
    return nativeSpeak(utterance);
  };
})();
