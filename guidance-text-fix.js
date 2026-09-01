(()=>{
  const previousCleaner=window.__trasyCleanGuidanceText;

  function normalize(text){
    let value=typeof previousCleaner==='function'?previousCleaner(text):text;
    value=String(value??'');
    value=value.replace(/^Skręć\s+prosto\b/i,'Jedź prosto');
    value=value.replace(/^Turn\s+straight\s+ahead\b/i,'Continue straight ahead');
    value=value.replace(/^Поверніть\s+прямо\b/i,'Рухайтеся прямо');
    return value;
  }

  window.__trasyCleanGuidanceText=normalize;

  function attach(){
    const el=document.getElementById('routeManeuver');
    if(!el||el.__straightGuidanceFix)return false;
    el.__straightGuidanceFix=true;
    let applying=false;
    const apply=()=>{
      if(applying)return;
      const current=el.textContent||'';
      const next=normalize(current);
      if(next===current)return;
      applying=true;
      el.textContent=next;
      applying=false;
    };
    new MutationObserver(apply).observe(el,{childList:true,characterData:true,subtree:true});
    apply();
    return true;
  }

  if(!attach()){
    const timer=setInterval(()=>{if(attach())clearInterval(timer)},100);
    setTimeout(()=>clearInterval(timer),30000);
  }
})();