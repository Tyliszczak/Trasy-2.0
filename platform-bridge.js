(()=>{
  if(window.__trasyPlatform)return;

  const CONTRACT_VERSION='1.0';
  const profile=window.__trasyDeploymentProfile||Object.freeze({mode:'production',requirePlatform:true});
  const SESSION_ERRORS=new Set([
    'UNAUTHORIZED','DRIVER_UNAUTHORIZED','DRIVER_SESSION_EXPIRED','DRIVER_REFRESH_EXPIRED',
    'DRIVER_SESSION_DEVICE_MISMATCH','DRIVER_DEVICE_RELEASED','DRIVER_DEVICE_MISMATCH',
    'DRIVER_BLOCKED','DRIVER_ACCESS_DENIED','COMPANY_BLOCKED','LICENSE_EXPIRED'
  ]);
  const clean=value=>String(value??'').trim().slice(0,160);
  const safePart=value=>clean(value).toLowerCase().replace(/[^a-z0-9_-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,80);

  function rawContext(){
    const value=window.KURSY_DRIVER_CONTEXT;
    return value&&typeof value==='object'?value:{};
  }
  function context(){
    const value=rawContext();
    const result={
      companyId:clean(value.companyId),driverId:clean(value.driverId),deviceId:clean(value.deviceId),
      deploymentMode:profile.mode,contractVersion:CONTRACT_VERSION
    };
    return Object.freeze(result);
  }
  function connected(){
    const api=window.KURSY_DRIVER_API;
    return Boolean(api&&typeof api.driverRoutes==='function'&&typeof api.driverVehicles==='function');
  }
  function scope(){
    const value=context();
    const parts=[value.companyId,value.driverId,value.deviceId].map(safePart).filter(Boolean);
    if(parts.length===3)return parts.join('.');
    return profile.mode==='test'?'tyliszczak-test.standalone.local':'unassigned';
  }
  function storageKey(base){return `${clean(base)}.${scope()}`}
  function errorCode(error){return clean(error?.code||error?.message||'PLATFORM_ERROR').toUpperCase()}
  function handleError(error){
    const code=errorCode(error);
    if([...SESSION_ERRORS].some(item=>code.includes(item))){
      document.dispatchEvent(new CustomEvent('trasy:platform-session-expired',{detail:{code}}));
    }
    throw error;
  }
  function apiMethod(name,required=true){
    const method=window.KURSY_DRIVER_API?.[name];
    if(typeof method==='function')return method.bind(window.KURSY_DRIVER_API);
    if(!required)return null;
    const error=new Error('Aplikacja nie została połączona z panelem kierowcy.');
    error.code='PLATFORM_NOT_CONNECTED';
    throw error;
  }
  async function call(name,...args){
    try{return await apiMethod(name)(...args)}catch(error){return handleError(error)}
  }
  function capabilities(){
    const api=window.KURSY_DRIVER_API||{};
    return Object.freeze({
      routes:typeof api.driverRoutes==='function',vehicles:typeof api.driverVehicles==='function',
      parkings:typeof api.driverParkings==='function',routing:typeof api.driverComputeRoute==='function',
      feedback:typeof api.driverFeedback==='function',punctuality:typeof api.recordPunctuality==='function'
    });
  }
  function assertReady(){
    if(connected())return true;
    if(profile.requirePlatform){
      const error=new Error('Uruchom aplikację z linku aktywacyjnego otrzymanego z panelu firmy.');
      error.code='PLATFORM_REQUIRED';
      throw error;
    }
    return false;
  }
  async function purgeScopedData(){
    const suffix=`.${scope()}`;
    try{
      const keys=[];
      for(let index=0;index<localStorage.length;index+=1){const key=localStorage.key(index);if(key&&key.endsWith(suffix))keys.push(key)}
      keys.forEach(key=>localStorage.removeItem(key));
    }catch{}
    try{
      if(globalThis.caches?.keys){const names=await caches.keys();await Promise.all(names.filter(name=>name.endsWith(`-${scope()}`)).map(name=>caches.delete(name)))}
    }catch{}
    document.dispatchEvent(new CustomEvent('trasy:platform-data-purged',{detail:{scope:scope()}}));
  }

  window.__trasyPlatform=Object.freeze({
    contractVersion:CONTRACT_VERSION,profile,context,scope,storageKey,connected,capabilities,assertReady,purgeScopedData,
    routes:(options={})=>call('driverRoutes',options),
    vehicles:(options={})=>call('driverVehicles',options),
    parkings:(options={})=>call('driverParkings',options),
    computeRoute:(coordinates,options={})=>call('driverComputeRoute',coordinates,options),
    feedback:(record,options={})=>call('driverFeedback',record,options),
    punctuality:(event,options={})=>call('recordPunctuality',event,options)
  });
  document.dispatchEvent(new CustomEvent('trasy:platform-ready',{detail:{
    connected:connected(),context:context(),capabilities:capabilities(),contractVersion:CONTRACT_VERSION
  }}));
  function publishServiceWorkerScope(){
    const message={type:'SET_DATA_SCOPE',scope:scope()};
    try{navigator.serviceWorker?.controller?.postMessage(message)}catch{}
    navigator.serviceWorker?.ready?.then(registration=>registration.active?.postMessage(message)).catch(()=>{});
  }
  publishServiceWorkerScope();
  navigator.serviceWorker?.addEventListener?.('controllerchange',publishServiceWorkerScope);
  document.addEventListener('kursy:driver-deactivated',()=>{purgeScopedData()});
})();
