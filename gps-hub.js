(()=>{
  if(window.__trasyGps||!navigator.geolocation)return;

  const listeners=new Map();
  const WATCH_OPTIONS={enableHighAccuracy:true,maximumAge:500,timeout:15000};
  const FRESH_OPTIONS={enableHighAccuracy:true,maximumAge:0,timeout:15000};
  const REPLAY_MAX_AGE_MS=15000;
  let nativeWatch=null,nextId=1,lastPosition=null,refreshPromise=null;

  function publish(position){
    lastPosition=position;
    listeners.forEach(listener=>{
      try{listener.success(position)}catch(error){console.error('Odbiornik GPS:',error)}
    });
  }

  function publishError(error){
    listeners.forEach(listener=>{
      try{listener.error?.(error)}catch(callbackError){console.error('Obsługa błędu GPS:',callbackError)}
    });
  }

  function start(){
    if(nativeWatch!==null||!listeners.size)return;
    nativeWatch=navigator.geolocation.watchPosition(publish,publishError,WATCH_OPTIONS);
  }

  function restart(){
    if(nativeWatch!==null){navigator.geolocation.clearWatch(nativeWatch);nativeWatch=null}
    start();
  }

  function stop(){
    if(nativeWatch===null||listeners.size)return;
    navigator.geolocation.clearWatch(nativeWatch);
    nativeWatch=null;
  }

  function refresh({restartWatch=true}={}){
    if(restartWatch)restart();
    if(refreshPromise)return refreshPromise;
    refreshPromise=new Promise((resolve,reject)=>{
      navigator.geolocation.getCurrentPosition(
        position=>{publish(position);resolve(position)},
        error=>{publishError(error);reject(error)},
        FRESH_OPTIONS
      );
    }).finally(()=>{refreshPromise=null});
    return refreshPromise;
  }

  window.__trasyGps={
    subscribe(success,error){
      if(typeof success!=='function')throw new TypeError('Brak funkcji odbierającej pozycję GPS.');
      const id=nextId++;
      listeners.set(id,{success,error});
      const age=Date.now()-Number(lastPosition?.timestamp||0);
      if(lastPosition&&age<=REPLAY_MAX_AGE_MS)queueMicrotask(()=>{if(listeners.has(id))success(lastPosition)});
      start();
      return id;
    },
    unsubscribe(id){listeners.delete(id);stop()},
    current(){return lastPosition},
    refresh,
    subscriberCount(){return listeners.size}
  };

  document.addEventListener('visibilitychange',()=>{
    if(document.visibilityState==='visible'&&listeners.size)refresh().catch(()=>{});
  });
  window.addEventListener('pageshow',event=>{
    if(event.persisted&&listeners.size)refresh().catch(()=>{});
  });
})();
