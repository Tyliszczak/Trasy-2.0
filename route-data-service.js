(()=>{
  if(window.__trasyRouteDataService)return;

  const platform=window.__trasyPlatform;
  const STORAGE_KEY=platform?.storageKey('trasy2.routeData.v3')||'trasy2.routeData.v3.unassigned';
  let cached=null,inflight=null;

  function readStored(){try{return JSON.parse(localStorage.getItem(STORAGE_KEY)||'null')}catch{return null}}
  function store(data){
    try{localStorage.setItem(STORAGE_KEY,JSON.stringify(data))}catch{}
    document.dispatchEvent(new CustomEvent('trasy:route-data-updated',{detail:data}));
    return data;
  }
  function validatePayload(payload){
    const data=payload?.routes??payload?.data??payload;
    if(Array.isArray(data)){
      if(!data.every(route=>route&&typeof route==='object'))throw new Error('Panel kierowcy zwrócił nieprawidłową listę tras.');
      return data;
    }
    if(!data||typeof data!=='object')throw new Error('Źródło danych zwróciło nieprawidłowe dane tras.');
    return data;
  }
  async function request(){
    platform?.assertReady();
    return validatePayload(await platform.routes({fresh:true}));
  }

  window.__trasyRouteDataService={
    async load({fresh=false}={}){
      if(cached&&!fresh)return cached;
      if(!fresh){const stored=readStored();if(stored){try{cached=validatePayload(stored);return cached}catch{}}}
      if(inflight)return inflight;
      inflight=request().then(data=>(cached=store(data),data)).finally(()=>{inflight=null});
      return inflight;
    },
    peek(){return cached},
    stored:readStored,
    invalidate(){cached=null},
    source:'platform',
    storageKey:STORAGE_KEY
  };
})();
