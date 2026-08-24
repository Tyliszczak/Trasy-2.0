(()=>{
  if(window.__trasyRouteDataService)return;

  const STORAGE_KEY='trasy2.rawRouteData';
  let cached=null,inflight=null;

  function readStored(){try{return JSON.parse(localStorage.getItem(STORAGE_KEY)||'null')}catch{return null}}
  function store(data){
    try{localStorage.setItem(STORAGE_KEY,JSON.stringify(data))}catch{}
    document.dispatchEvent(new CustomEvent('trasy:route-data-updated',{detail:data}));
    return data;
  }

  async function request(){
    const api=window.KURSY_DRIVER_API;
    if(!api||typeof api.driverRoutes!=='function')throw new Error('Bezpieczne źródło tras nie jest jeszcze podłączone do panelu kierowcy.');
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),12000);
    try{
      const result=await api.driverRoutes({signal:controller.signal});
      const routes=result?.routes??result?.data?.routes??result?.data??result;
      if(!Array.isArray(routes))throw new Error('Backend zwrócił nieprawidłowe dane tras.');
      return routes;
    }finally{clearTimeout(timer)}
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
    url:''
  };
})();
