(()=>{
  if(window.__trasyGps||!navigator.geolocation)return;

  const listeners=new Map();
  let nativeWatch=null,nextId=1,lastPosition=null;

  function start(){
    if(nativeWatch!==null||!listeners.size)return;
    nativeWatch=navigator.geolocation.watchPosition(
      position=>{
        lastPosition=position;
        listeners.forEach(listener=>{
          try{listener.success(position)}catch(error){console.error('Odbiornik GPS:',error)}
        });
      },
      error=>listeners.forEach(listener=>{
        try{listener.error?.(error)}catch(callbackError){console.error('Obsługa błędu GPS:',callbackError)}
      }),
      {enableHighAccuracy:true,maximumAge:500,timeout:15000}
    );
  }

  function stop(){
    if(nativeWatch===null||listeners.size)return;
    navigator.geolocation.clearWatch(nativeWatch);
    nativeWatch=null;
  }

  window.__trasyGps={
    subscribe(success,error){
      if(typeof success!=='function')throw new TypeError('Brak funkcji odbierającej pozycję GPS.');
      const id=nextId++;
      listeners.set(id,{success,error});
      if(lastPosition)queueMicrotask(()=>{if(listeners.has(id))success(lastPosition)});
      start();
      return id;
    },
    unsubscribe(id){listeners.delete(id);stop()},
    current(){return lastPosition},
    subscriberCount(){return listeners.size}
  };
})();
