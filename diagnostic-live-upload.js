(()=>{
  const root=document.body;
  const version=document.getElementById('globalTestVersion');
  if(!root||root.dataset.testDiagnostics!=='enabled'||!/^TEST\b/i.test(version?.textContent||''))return;

  const DB_NAME='trasy2-test-diagnostics';
  const DB_VERSION=2;
  const STORE='events';
  const INSTALLATION_KEY='trasy2.diagnostics.installation';
  const DEVICE_NAME_KEY='trasy2.diagnostics.deviceName.v1';
  const CONSENT_KEY='trasy2.diagnostics.consent.v1';
  const UPLOAD_ENDPOINT='/test-diagnostics';
  const UPLOAD_INTERVAL_MS=5*60*1000;
  const START_DELAY_MS=20*1000;
  const UPLOAD_BATCH_SIZE=500;
  const UPLOAD_MAX_BYTES=460*1024;
  const UPLOAD_MAX_PARTS=32;
  let uploadInFlight=null;
  let timer=0;

  function installationId(){
    return String(localStorage.getItem(INSTALLATION_KEY)||'');
  }

  function deviceLabel(){
    const configured=String(localStorage.getItem(DEVICE_NAME_KEY)||'')
      .replace(/[\u0000-\u001F\u007F]/g,' ').replace(/\s+/g,' ').trim().slice(0,80);
    if(configured)return configured;
    const userAgent=navigator.userAgent||'';
    const platform=/iPhone/i.test(userAgent)?'iPhone Safari':
      /iPad/i.test(userAgent)?'iPad Safari':
      /Android/i.test(userAgent)?'Android Chrome':
      /Windows/i.test(userAgent)?'Windows':
      /Macintosh/i.test(userAgent)?'Mac':'Inne urządzenie';
    const width=Math.max(0,Math.round(Number(screen.width)||0));
    const height=Math.max(0,Math.round(Number(screen.height)||0));
    return [platform,width&&height?`${width}x${height}`:''].filter(Boolean).join(' ').slice(0,80);
  }

  function openDb(){
    return new Promise((resolve,reject)=>{
      const request=indexedDB.open(DB_NAME,DB_VERSION);
      request.onsuccess=()=>resolve(request.result);
      request.onerror=()=>reject(request.error||new Error('Nie można otworzyć pamięci diagnostycznej.'));
      request.onupgradeneeded=()=>{
        // Bazę i indeksy tworzy diagnostic-recorder.js ładowany przed tym modułem.
        request.transaction.abort();
      };
    });
  }

  async function pendingEvents(limit=UPLOAD_BATCH_SIZE){
    const db=await openDb();
    try{
      return await new Promise((resolve,reject)=>{
        const transaction=db.transaction(STORE,'readonly');
        const request=transaction.objectStore(STORE).index('uploadState').getAll(IDBKeyRange.only(0),limit);
        request.onsuccess=()=>resolve(request.result||[]);
        request.onerror=()=>reject(request.error);
      });
    }finally{db.close()}
  }

  async function markUploaded(events){
    if(!events.length)return;
    const db=await openDb();
    try{
      await new Promise((resolve,reject)=>{
        const transaction=db.transaction(STORE,'readwrite');
        const store=transaction.objectStore(STORE);
        events.forEach(event=>{
          const request=store.get(event.id);
          request.onsuccess=()=>{
            const stored=request.result;
            if(stored){stored.uploadState=1;store.put(stored)}
          };
        });
        transaction.oncomplete=resolve;
        transaction.onerror=()=>reject(transaction.error);
      });
    }finally{db.close()}
  }

  function payloadFor(events){
    const first=events[0],last=events[events.length-1];
    return{
      batchId:`${installationId()}:${first.id}-${last.id}`,
      installationId:installationId(),
      deviceLabel:deviceLabel(),
      appVersion:version?.dataset.version||'',
      sessionId:first.sessionId,
      events:events.map(({uploadState,...event})=>event)
    };
  }

  function boundedBatch(events){
    if(!events.length)return[];
    const sameSession=events.filter(event=>event.sessionId===events[0].sessionId);
    while(sameSession.length>1&&new TextEncoder().encode(JSON.stringify(payloadFor(sameSession))).byteLength>UPLOAD_MAX_BYTES)sameSession.pop();
    return sameSession;
  }

  async function uploadBatch(events){
    const response=await fetch(UPLOAD_ENDPOINT,{
      method:'POST',cache:'no-store',credentials:'same-origin',
      headers:{'Content-Type':'application/json'},body:JSON.stringify(payloadFor(events))
    });
    const result=await response.json().catch(()=>({}));
    if(!response.ok||result?.status!=='success')throw new Error(result?.message||`HTTP ${response.status}`);
  }

  async function uploadNow(){
    if(uploadInFlight||!navigator.onLine||localStorage.getItem(CONSENT_KEY)!=='approved')return uploadInFlight;
    uploadInFlight=(async()=>{
      try{
        for(let part=0;part<UPLOAD_MAX_PARTS;part++){
          const pending=await pendingEvents();
          if(!pending.length)break;
          const events=boundedBatch(pending);
          if(!events.length)break;
          await uploadBatch(events);
          await markUploaded(events);
        }
      }catch(error){
        console.warn('Bieżąca wysyłka diagnostyki:',error);
      }finally{uploadInFlight=null}
    })();
    return uploadInFlight;
  }

  function schedule(delay=UPLOAD_INTERVAL_MS){
    clearTimeout(timer);
    timer=setTimeout(async()=>{
      timer=0;
      await uploadNow();
      schedule();
    },delay);
  }

  window.addEventListener('online',()=>schedule(1500));
  document.addEventListener('visibilitychange',()=>{
    if(document.visibilityState==='hidden')uploadNow();
  });
  window.addEventListener('pagehide',()=>uploadNow());

  schedule(START_DELAY_MS);
})();
