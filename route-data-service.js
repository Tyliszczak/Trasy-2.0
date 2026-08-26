(()=>{
  if(window.__trasyRouteDataService)return;

  // Upstream arkusza Trasy 2.0 za proxy Cloudflare:
  // https://script.google.com/macros/s/AKfycbyQcnU6xvvrUZNVUJRhQ293L47hZwlvsc6i3n9s9hiYqhLUAoKSqGbPohe_lSB0apfUcw/exec
  const SOURCE_URL='/trasy-data';
  const STORAGE_KEY='trasy2.sheetRawRouteData.v2';
  const REQUIRED_SHEETS=['SAS Sulechów','APT - Krężoły','SAS Świebodzin','TopPoint','POJAZDY'];
  let cached=null,inflight=null;

  function readStored(){try{return JSON.parse(localStorage.getItem(STORAGE_KEY)||'null')}catch{return null}}
  function store(data){
    try{localStorage.setItem(STORAGE_KEY,JSON.stringify(data))}catch{}
    document.dispatchEvent(new CustomEvent('trasy:route-data-updated',{detail:data}));
    return data;
  }
  function validatePayload(payload){
    const data=payload?.data??payload;
    if(!data||Array.isArray(data)||typeof data!=='object')throw new Error('Arkusz Trasy 2.0 zwrócił nieprawidłowe dane.');
    const missing=REQUIRED_SHEETS.filter(name=>!Array.isArray(data[name]));
    if(missing.length)throw new Error(`Arkusz Trasy 2.0 nie zawiera wymaganych kart: ${missing.join(', ')}`);
    return data;
  }

  async function request(){
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),12000);
    try{
      const url=new URL(SOURCE_URL,location.origin);
      url.searchParams.set('_',String(Date.now()));
      const response=await fetch(url.href,{method:'GET',cache:'no-store',credentials:'same-origin',signal:controller.signal});
      if(!response.ok)throw new Error(`Arkusz Trasy 2.0 odpowiedział kodem ${response.status}.`);
      const payload=await response.json();
      if(payload?.status==='error')throw new Error(payload.message||'Nie udało się pobrać arkusza Trasy 2.0.');
      return validatePayload(payload);
    }finally{clearTimeout(timer)}
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
    url:SOURCE_URL
  };
})();
