(()=>{
  if(window.__trasyRouteDataService)return;

  const API_URL='https://script.google.com/macros/s/AKfycbzdG_ARbbPgMdlPteqFLakZHR5EEkT4Lb3YFDbXW_I_OyrDKo8l0_KrQLjnncxj_M9q/exec';
  const STORAGE_KEY='trasy2.rawRouteData';
  let cached=null,inflight=null;

  function readStored(){try{return JSON.parse(localStorage.getItem(STORAGE_KEY)||'null')}catch{return null}}
  function store(data){
    try{localStorage.setItem(STORAGE_KEY,JSON.stringify(data))}catch{}
    document.dispatchEvent(new CustomEvent('trasy:route-data-updated',{detail:data}));
    return data;
  }

  function jsonp(){
    return new Promise((resolve,reject)=>{
      const callback=`__trasyData_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const script=document.createElement('script');
      let done=false;
      const cleanup=()=>{delete window[callback];script.remove()};
      const finish=(fn,value)=>{if(done)return;done=true;clearTimeout(timer);cleanup();fn(value)};
      const timer=setTimeout(()=>finish(reject,new Error('Przekroczono czas oczekiwania na dane tras.')),12000);
      window[callback]=data=>finish(resolve,data);
      script.onerror=()=>finish(reject,new Error('Nie udało się pobrać danych tras przez JSONP.'));
      script.src=`${API_URL}?callback=${encodeURIComponent(callback)}&t=${Date.now()}`;
      document.head.append(script);
    });
  }

  async function request(){
    let directError;
    try{
      const controller=new AbortController();
      const timer=setTimeout(()=>controller.abort(),12000);
      try{
        const response=await fetch(`${API_URL}?t=${Date.now()}`,{cache:'no-store',redirect:'follow',signal:controller.signal});
        if(!response.ok)throw new Error(`HTTP ${response.status}`);
        const data=await response.json();
        if(data?.status==='error')throw new Error(data.message||'API zwróciło błąd.');
        return data;
      }finally{clearTimeout(timer)}
    }catch(error){directError=error}
    try{return await jsonp()}catch(error){throw directError||error}
  }

  window.__trasyRouteDataService={
    async load({fresh=false}={}){
      if(cached&&!fresh)return cached;
      if(!fresh){const stored=readStored();if(stored){cached=stored;return stored}}
      if(inflight)return inflight;
      inflight=request().then(data=>(cached=store(data),data)).finally(()=>{inflight=null});
      return inflight;
    },
    peek(){return cached},
    stored:readStored,
    invalidate(){cached=null},
    url:API_URL
  };
})();
