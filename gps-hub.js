(()=>{
  if(window.__trasyGps)return;
  const quality=globalThis.__trasyGpsQuality;
  const geolocation=navigator.geolocation;
  const listeners=new Map();
  const WATCH_OPTIONS={enableHighAccuracy:true,maximumAge:500,timeout:15000};
  const FRESH_OPTIONS={enableHighAccuracy:true,maximumAge:0,timeout:15000};
  let nativeWatch=null,nextId=1,lastPosition=null,refreshRequest=null;
  let generation=0,notBefore=0,expiryTimer=null,permissionDenied=false;
  let status={state:geolocation&&quality?'waiting':'unavailable',reason:geolocation&&quality?'initial':'unsupported',ageMs:null,accuracy:null};

  function setStatus(state,reason,assessment={}){
    const changed=status.state!==state||status.reason!==reason;
    status={state,reason,ageMs:assessment.ageMs??null,accuracy:assessment.accuracy??null};
    if(changed)window.dispatchEvent(new CustomEvent('trasy:gps-status',{detail:{...status}}));
  }

  function assess(position){return quality.evaluate(position,{notBefore})}
  function statusFor(assessment){
    if(assessment.usable)return 'ready';
    if(assessment.reason==='stale')return 'stale';
    if(assessment.reason==='poor-accuracy')return 'poor';
    if(assessment.reason==='before-resume'||assessment.reason==='missing-position')return 'waiting';
    return 'unavailable';
  }
  function clearExpiry(){if(expiryTimer!==null){clearTimeout(expiryTimer);expiryTimer=null}}
  function invalidate(reason='waiting'){
    clearExpiry();
    lastPosition=null;
    setStatus(permissionDenied?'denied':'waiting',permissionDenied?'permission-denied':reason);
  }
  function current(){
    if(!lastPosition||document.visibilityState!=='visible'||!quality)return null;
    const assessment=assess(lastPosition);
    setStatus(statusFor(assessment),assessment.reason,assessment);
    return assessment.usable?lastPosition:null;
  }
  function getStatus(){current();return {...status}}
  function deliver(listener,position){
    try{listener.success(position)}catch(error){console.error('Odbiornik GPS:',error)}
  }
  function publish(position,sourceGeneration){
    if(sourceGeneration!==generation||document.visibilityState!=='visible')return null;
    const assessment=assess(position);
    lastPosition=position;
    clearExpiry();
    setStatus(statusFor(assessment),assessment.reason,assessment);
    if(assessment.usable){
      expiryTimer=setTimeout(()=>{
        expiryTimer=null;
        if(sourceGeneration===generation)current();
      },Math.max(1,position.timestamp+quality.MAX_AGE_MS-Date.now()+1));
    }
    listeners.forEach(listener=>{
      if(assessment.usable||listener.includeUnreliable)deliver(listener,position);
    });
    return assessment;
  }

  function abortError(){return Object.assign(new Error('Żądanie GPS zostało zastąpione.'),{name:'AbortError'})}
  function stopNative(){
    generation+=1;
    if(nativeWatch!==null){geolocation?.clearWatch(nativeWatch);nativeWatch=null}
    if(refreshRequest){const request=refreshRequest;refreshRequest=null;request.reject(abortError())}
  }
  function publishError(error,sourceGeneration=generation){
    if(sourceGeneration!==generation)return;
    clearExpiry();
    lastPosition=null;
    if(error.code===1){
      permissionDenied=true;
      stopNative();
      setStatus('denied','permission-denied');
    }else setStatus('unavailable',error.code===3?'timeout':'position-unavailable');
    listeners.forEach(listener=>{
      try{listener.error?.(error)}catch(callbackError){console.error('Obsługa błędu GPS:',callbackError)}
    });
  }

  function start(){
    if(nativeWatch!==null||!listeners.size||permissionDenied||document.visibilityState!=='visible')return;
    if(!geolocation||!quality){setStatus('unavailable','unsupported');return}
    const sourceGeneration=generation;
    nativeWatch=-1;
    try{
      const id=geolocation.watchPosition(position=>publish(position,sourceGeneration),error=>publishError(error,sourceGeneration),WATCH_OPTIONS);
      if(sourceGeneration===generation)nativeWatch=id;
      else geolocation.clearWatch(id);
    }catch(error){nativeWatch=null;publishError(error,sourceGeneration)}
  }

  function refresh({restartWatch=true}={}){
    if(refreshRequest)return refreshRequest.promise;
    if(document.visibilityState!=='visible')return Promise.reject(abortError());
    if(!geolocation||!quality){setStatus('unavailable','unsupported');return Promise.reject(new Error('GPS jest niedostępny.'))}
    const wasDenied=permissionDenied;
    permissionDenied=false;
    if(restartWatch)stopNative();
    invalidate('refresh');
    if(restartWatch||wasDenied)start();
    if(permissionDenied)return Promise.reject(Object.assign(new Error('Brak uprawnień do lokalizacji.'),{code:1}));
    const sourceGeneration=generation;
    let resolveRequest,rejectRequest;
    const promise=new Promise((resolve,reject)=>{resolveRequest=resolve;rejectRequest=reject});
    const request={promise,reject:rejectRequest};
    refreshRequest=request;
    function finish(callback,value){
      if(refreshRequest===request)refreshRequest=null;
      callback(value);
    }
    try{
      geolocation.getCurrentPosition(position=>{
        if(sourceGeneration!==generation)return;
        const assessment=publish(position,sourceGeneration);
        if(assessment?.usable)finish(resolveRequest,position);
        else finish(rejectRequest,Object.assign(new Error('Oczekiwanie na wiarygodną pozycję GPS.'),{reason:assessment?.reason}));
      },error=>{
        if(sourceGeneration!==generation)return;
        finish(rejectRequest,error);
        publishError(error,sourceGeneration);
      },FRESH_OPTIONS);
    }catch(error){finish(rejectRequest,error);publishError(error,sourceGeneration)}
    return promise;
  }

  window.__trasyGps={
    subscribe(success,error,{includeUnreliable=false}={}){
      if(typeof success!=='function')throw new TypeError('Brak funkcji odbierającej pozycję GPS.');
      const id=nextId++;
      const listener={success,error,includeUnreliable};
      listeners.set(id,listener);
      const replay=lastPosition,sourceGeneration=generation;
      if(replay)queueMicrotask(()=>{
        if(listeners.has(id)&&sourceGeneration===generation&&document.visibilityState==='visible'&&
          (includeUnreliable||assess(replay).usable))deliver(listener,replay);
      });
      start();
      return id;
    },
    unsubscribe(id){
      listeners.delete(id);
      if(!listeners.size){stopNative();invalidate('inactive')}
    },
    current,
    getStatus,
    refresh,
    subscriberCount(){return listeners.size}
  };

  function resume(){
    notBefore=Date.now();
    stopNative();
    invalidate('resume');
    if(listeners.size&&!permissionDenied){start();refresh({restartWatch:false}).catch(()=>{})}
  }
  document.addEventListener('visibilitychange',()=>{
    if(document.visibilityState==='visible')resume();
    else{notBefore=Date.now();stopNative();invalidate('hidden')}
  });
  window.addEventListener('pageshow',event=>{
    if(event.persisted&&document.visibilityState==='visible')resume();
  });
  navigator.permissions?.query?.({name:'geolocation'}).then(permission=>{
    const changed=()=>{
      if(permission.state==='denied'){
        permissionDenied=true;
        stopNative();
        invalidate();
      }else if(permission.state==='granted'&&permissionDenied){
        permissionDenied=false;
        resume();
      }
    };
    if(permission.addEventListener)permission.addEventListener('change',changed);
    else permission.onchange=changed;
    changed();
  }).catch(()=>{});
})();
