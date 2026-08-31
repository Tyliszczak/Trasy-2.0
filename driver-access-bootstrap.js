(()=>{
  const IDENTITY_KEY='kursy.device.identity.v1';
  const SESSION_KEY='trasy2.driver.session.v1';
  const ACTIVATION_KEY='trasy2.pending.activation.v1';
  const gate=document.getElementById('driverAccessGate');
  const title=document.getElementById('driverAccessTitle');
  const message=document.getElementById('driverAccessMessage');
  const activateButton=document.getElementById('driverActivateButton');
  const shell=document.getElementById('driverAppShell');
  let activationToken='';

  const scripts=[
    ['./deployment-profile.js?v=2'],['./platform-bridge.js?v=2'],['./i18n.js?v=2'],['./time-core.js?v=3'],
    ['./geo-core.js?v=1'],['./eta-core.js?v=1'],['./route-data-service.js?v=6'],['./gps-hub.js?v=resume-1'],
    ['./app.js?v=secure-data-5','module'],['./wake-style.js?v=navigation-wake-3'],['./schedule-enhancer.js?v=1'],
    ['./offline-map-cache.js?v=1'],['./offline-route-cache.js?v=1'],['./vendor/maplibre-gl/5.12.0/maplibre-gl.js'],
    ['./map-runtime.js?v=2','module'],['./vehicles.js?v=sheet-data-2'],['./return-route.js?v=parking-notice-1'],
    ['./speed-display.js?v=road-only-1'],['./road-speed-limit.js?v=osm-only-1','module'],
    ['./gps-stop-tracker.js?v=stop-engine-12','module'],['./active-stop-guard.js?v=1'],
    ['./google-routes-provider.js?v=secure-api-1'],['./nav-map.js?v=i18n-1'],['./maneuver-bubble.js?v=3'],
    ['./route-progress-style.js?v=6','module'],['./traffic-delay-ui.js?v=1'],['./navigation-ui-controls.js?v=27'],
    ['./navigation-compass.js?v=2'],['./navigation-live-engine.js?v=6','module'],['./navigation-feedback.js?v=i18n-1'],
    ['./android-back-navigation.js?v=2'],['./etoll-overlay.js?v=2'],['./skip-stop-control.js?v=5'],
    ['./skip-detection.js?v=resume-validation-1'],['./final-stop-ui.js?v=4'],['./stop-map-links.js?v=1'],
    ['./eta-status.js?v=status-9','module'],['./next-stop-header.js?v=status-13'],['./visual-stop-alert.js?v=1']
  ];

  const randomId=prefix=>`${prefix}_${Array.from(crypto.getRandomValues(new Uint32Array(4)),value=>value.toString(36)).join('')}`;
  function readJson(storage,key){try{return JSON.parse(storage.getItem(key)||'null')}catch{return null}}
  function identity(){
    const saved=readJson(localStorage,IDENTITY_KEY);
    if(saved?.deviceId&&saved?.fingerprint)return saved;
    const created={deviceId:randomId('device'),fingerprint:randomId('fp'),createdAt:new Date().toISOString()};
    localStorage.setItem(IDENTITY_KEY,JSON.stringify(created));
    return created;
  }
  function tokenFromUrl(){
    const url=new URL(location.href),hash=new URLSearchParams(url.hash.replace(/^#/,''));
    const token=hash.get('activate')||url.searchParams.get('token')||'';
    if(token){sessionStorage.setItem(ACTIVATION_KEY,token);url.hash='';url.searchParams.delete('token');history.replaceState(null,'',url.href)}
    return token||sessionStorage.getItem(ACTIVATION_KEY)||'';
  }
  async function api(action,payload={}){
    const response=await fetch('/api',{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,payload})});
    const data=await response.json().catch(()=>({ok:false,code:'INVALID_RESPONSE',message:'Serwer zwrócił nieprawidłową odpowiedź.'}));
    if(!response.ok||data?.ok===false){const error=new Error(data?.message||'Operacja nie powiodła się.');error.code=data?.code||`HTTP_${response.status}`;throw error}
    return data;
  }
  function payload(extra={}){const current=identity();return {deviceId:current.deviceId,fingerprint:current.fingerprint,...extra}}
  function sessionContext(status){
    const stored=readJson(localStorage,SESSION_KEY)||{};
    const context={companyId:String(status?.company?.id||stored.companyId||''),driverId:String(status?.driver?.id||stored.driverId||''),deviceId:identity().deviceId};
    if(!context.companyId||!context.driverId)throw Object.assign(new Error('Nie można ustalić firmy lub kierowcy.'),{code:'INVALID_DRIVER_CONTEXT'});
    localStorage.setItem(SESSION_KEY,JSON.stringify({...context,companyName:String(status?.company?.name||''),expiresAt:String(status?.driverSession?.expiresAt||stored.expiresAt||''),updatedAt:new Date().toISOString()}));
    return context;
  }
  function installPlatform(status){
    const context=sessionContext(status),base=extra=>payload(extra);
    window.KURSY_DRIVER_CONTEXT=Object.freeze(context);
    window.KURSY_DRIVER_API=Object.freeze({
      driverRoutes:options=>api('driverRoutes',base(options)),
      driverVehicles:options=>api('driverVehicles',base(options)),
      driverParkings:options=>api('driverParkings',base(options)),
      driverComputeRoute:(coordinates,options={})=>api('driverComputeRoute',base({...options,coordinates})),
      driverFeedback:(record,options={})=>api('driverFeedback',base({...options,...record})),
      recordPunctuality:(event,options={})=>api('recordPunctuality',base({...options,...event}))
    });
  }
  async function refresh(){
    const refreshed=await api('refreshDriverSession',payload());
    return api('driverStatus',payload()).then(status=>({...status,driverSession:refreshed.driverSession}));
  }
  async function statusFromSession(){
    try{return await api('driverStatus',payload())}catch(error){
      if(!['DRIVER_SESSION_EXPIRED','DRIVER_UNAUTHORIZED'].includes(error.code))throw error;
      return refresh();
    }
  }
  function setGate(heading,text,{canActivate=false,busy=false}={}){
    title.textContent=heading;message.textContent=text;activateButton.hidden=!canActivate;activateButton.disabled=busy;
  }
  async function loadScripts(){
    gate.hidden=true;shell.hidden=false;
    for(const [src,type] of scripts)await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=src;script.async=false;if(type)script.type=type;script.onload=resolve;script.onerror=()=>reject(new Error(`Nie udało się załadować ${src}`));document.body.append(script)});
  }
  async function openApp(status){installPlatform(status);sessionStorage.removeItem(ACTIVATION_KEY);await loadScripts()}
  async function activate(){
    setGate('Aktywacja urządzenia','Trwa bezpieczna aktywacja urządzenia…',{canActivate:true,busy:true});
    try{const status=await api('activateDriverDevice',payload({activationToken}));await openApp(status)}
    catch(error){setGate('Nie udało się aktywować',error.message||'Sprawdź link aktywacyjny i połączenie.',{canActivate:true})}
  }
  async function start(){
    activationToken=tokenFromUrl();activateButton.addEventListener('click',activate);
    const stored=readJson(localStorage,SESSION_KEY);
    if(stored?.companyId&&stored?.driverId){
      try{const status=await statusFromSession();if(status.mayUse){await openApp(status);return}}
      catch(error){if(!activationToken){setGate('Brak dostępu',error.message||'Poproś administratora firmy o nowy link aktywacyjny.');return}}
    }
    if(!activationToken){setGate('Otwórz link od administratora','Ta aplikacja nie zawiera wspólnych tras. Użyj osobistego linku aktywacyjnego otrzymanego z panelu swojej firmy.');return}
    try{
      const status=await api('driverStatus',payload({activationToken}));
      const company=status?.company?.name?` Firma: ${status.company.name}.`:'';
      setGate('Aktywuj urządzenie',`Aktywacja przypisze to urządzenie do kierowcy.${company} Pierwsza aktywacja w firmie może rozpocząć okres próbny.`,{canActivate:true});
    }catch(error){setGate('Link jest nieaktywny',error.message||'Poproś administratora firmy o nowy link aktywacyjny.')}
  }

  start().catch(error=>setGate('Nie można uruchomić aplikacji',error.message||'Spróbuj ponownie później.'));
})();
