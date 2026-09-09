(()=>{
  const root=document.body;
  const version=document.getElementById('globalTestVersion');
  if(!root||root.dataset.testDiagnostics!=='enabled'||!/^TEST\b/i.test(version?.textContent||''))return;

  const DB_NAME='trasy2-test-diagnostics';
  const DB_VERSION=2;
  const STORE='events';
  const ACTIVE_KEY='trasy2.diagnostics.active';
  const SESSION_KEY='trasy2.diagnostics.session';
  const INSTALLATION_KEY='trasy2.diagnostics.installation';
  const DEVICE_NAME_KEY='trasy2.diagnostics.deviceName.v1';
  const LEGACY_LAST_UPLOADED_KEY='trasy2.diagnostics.lastUploadedId';
  const LEGACY_SESSION_UPLOAD_CURSORS_KEY='trasy2.diagnostics.sessionUploadCursors.v1';
  const UPLOAD_WINDOW_KEY='trasy2.diagnostics.uploadWindow.v1';
  const CONSENT_KEY='trasy2.diagnostics.consent.v1';
  const FIRST_USE_PROMPT_KEY='trasy2.diagnostics.firstUsePrompt.v1';
  const UPLOAD_ENDPOINT='/test-diagnostics';
  const UPLOAD_CHECK_INTERVAL_MS=15*60*1000;
  const UPLOAD_BATCH_SIZE=500;
  const UPLOAD_MAX_BYTES=460*1024;
  const UPLOAD_MAX_PARTS=32;
  const MAX_EVENTS=50000;
  const GPS_MIN_INTERVAL_MS=900;
  let dbPromise=null;
  let queue=[];
  let flushTimer=0;
  let writtenSincePrune=0;
  let lastGpsAt=0;
  let active=localStorage.getItem(ACTIVE_KEY)==='1';
  let sessionId=localStorage.getItem(SESSION_KEY)||'';
  let uploadTimer=0,uploadInFlight=null,lastSyncMessage='';
  let useEndRecorded=false;
  const eventPolicyState=new Map();
  const EVENT_MIN_INTERVAL_MS={
    'eta-status-change':10000,
    'nav-eta-update':10000,
    'stop-guard-change':30000
  };

  function randomId(){
    if(crypto.randomUUID)return crypto.randomUUID();
    const bytes=new Uint8Array(16);crypto.getRandomValues(bytes);
    return Array.from(bytes,value=>value.toString(16).padStart(2,'0')).join('');
  }

  function installationId(){
    let id=localStorage.getItem(INSTALLATION_KEY)||'';
    if(!/^[A-Za-z0-9._-]{16,100}$/.test(id)){
      id=randomId();localStorage.setItem(INSTALLATION_KEY,id);
    }
    return id;
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

  function newSessionId(){
    return `${new Date().toISOString().replace(/[:.]/g,'-')}-${randomId()}`;
  }

  function openDb(){
    if(dbPromise)return dbPromise;
    dbPromise=new Promise((resolve,reject)=>{
      const request=indexedDB.open(DB_NAME,DB_VERSION);
      request.onupgradeneeded=event=>{
        const db=request.result;
        const store=db.objectStoreNames.contains(STORE)
          ?request.transaction.objectStore(STORE)
          :db.createObjectStore(STORE,{keyPath:'id',autoIncrement:true});
        if(!store.indexNames.contains('sessionId')){
          store.createIndex('sessionId','sessionId');
        }
        if(!store.indexNames.contains('at')){
          store.createIndex('at','at');
        }
        if(!store.indexNames.contains('uploadState')){
          store.createIndex('uploadState','uploadState');
        }
        if(event.oldVersion<2){
          const globalCursor=Math.max(0,Number(localStorage.getItem(LEGACY_LAST_UPLOADED_KEY))||0);
          let sessionCursors={};
          try{sessionCursors=JSON.parse(localStorage.getItem(LEGACY_SESSION_UPLOAD_CURSORS_KEY)||'{}')||{}}catch{}
          const cursorRequest=store.openCursor();
          cursorRequest.onsuccess=()=>{
            const cursor=cursorRequest.result;
            if(!cursor)return;
            const event=cursor.value;
            const sessionCursor=Math.max(0,Number(sessionCursors[event.sessionId])||0);
            event.uploadState=Number(event.id)<=Math.max(globalCursor,sessionCursor)?1:0;
            cursor.update(event);
            cursor.continue();
          };
        }
      };
      request.onsuccess=()=>{
        localStorage.removeItem(LEGACY_LAST_UPLOADED_KEY);
        localStorage.removeItem(LEGACY_SESSION_UPLOAD_CURSORS_KEY);
        resolve(request.result);
      };
      request.onerror=()=>reject(request.error||new Error('Nie można otworzyć pamięci diagnostycznej.'));
    });
    return dbPromise;
  }

  function safe(value,depth=0){
    if(depth>4)return'[depth]';
    if(value===null||value===undefined||typeof value==='string'||typeof value==='number'||typeof value==='boolean')return value;
    if(value instanceof Error)return{name:value.name,message:value.message,stack:String(value.stack||'').slice(0,3000)};
    if(Array.isArray(value))return value.slice(0,80).map(item=>safe(item,depth+1));
    if(typeof value==='object'){
      if(value.coords&&Number.isFinite(Number(value.coords.latitude))&&Number.isFinite(Number(value.coords.longitude))){
        return{timestamp:Number(value.timestamp)||0,coords:{latitude:Number(value.coords.latitude),longitude:Number(value.coords.longitude),accuracy:Number(value.coords.accuracy),speed:Number(value.coords.speed),heading:Number(value.coords.heading)}};
      }
      const result={};
      for(const [key,item] of Object.entries(value).slice(0,80)){
        if(typeof item!=='function'&&key!=='target'&&key!=='currentTarget')result[key]=safe(item,depth+1);
      }
      return result;
    }
    return String(value);
  }

  function currentSnapshot(){
    const body=document.getElementById('scheduleBody');
    const row=body?.querySelector('tr.gpsNextStop');
    return{
      route:document.getElementById('scheduleRouteName')?.textContent?.trim()||'',
      shift:document.getElementById('scheduleTimeSelect')?.value||'',
      direction:body?.dataset.direction||'forward',
      emptyRun:body?.dataset.emptyRun==='1',
      targetIndex:Number.isInteger(Number(body?.dataset.gpsNextStop))?Number(body.dataset.gpsNextStop):null,
      targetKey:body?.dataset.gpsNextStopKey||'',
      targetName:row?.querySelector('td:first-child')?.childNodes?.[0]?.textContent?.trim()||row?.querySelector('td:first-child')?.textContent?.trim()||'',
      transitionReason:body?.dataset.gpsTransitionReason||'',
      navigationVisible:document.getElementById('routeMapNav')?.hidden===false,
      visibility:document.visibilityState,
      online:navigator.onLine
    };
  }

  function eventFingerprint(type,detail){
    if(type==='eta-status-change'||type==='nav-eta-update')return String(detail?.kind||'');
    if(type==='stop-guard-change')return [detail?.state||'',detail?.message||'',detail?.index??'',detail?.plan||''].join('|');
    return'';
  }

  function shouldRecord(type,detail,now){
    if(type==='trasy:gps-speed')return false; // prędkość jest już w każdym gps-fix
    const interval=EVENT_MIN_INTERVAL_MS[type];
    if(!interval)return true;
    const fingerprint=eventFingerprint(type,detail);
    const previous=eventPolicyState.get(type);
    if(previous&&previous.fingerprint===fingerprint&&now-previous.at<interval)return false;
    eventPolicyState.set(type,{fingerprint,at:now});
    return true;
  }

  function record(type,detail={}){
    if(!active)return;
    const now=Date.now();
    if(!shouldRecord(type,detail,now))return;
    queue.push({
      sessionId,
      at:new Date().toISOString(),
      elapsedMs:Math.round(performance.now()),
      type,
      snapshot:currentSnapshot(),
      detail:safe(detail)
    });
    if(queue.length>=20)flush();
    else if(!flushTimer)flushTimer=setTimeout(flush,1200);
    updateUi();
  }

  async function prune(db){
    if(writtenSincePrune<500)return;
    writtenSincePrune=0;
    const count=await new Promise((resolve,reject)=>{
      const request=db.transaction(STORE,'readonly').objectStore(STORE).count();
      request.onsuccess=()=>resolve(request.result);
      request.onerror=()=>reject(request.error);
    });
    let remove=Math.max(0,count-MAX_EVENTS);
    if(!remove)return;
    const removeUploaded=await new Promise((resolve,reject)=>{
      const transaction=db.transaction(STORE,'readwrite');
      const request=transaction.objectStore(STORE).index('uploadState').openCursor(IDBKeyRange.only(1));
      request.onsuccess=()=>{
        const cursor=request.result;
        if(!cursor||remove<=0)return;
        cursor.delete();remove-=1;cursor.continue();
      };
      transaction.oncomplete=()=>resolve(remove);
      transaction.onerror=()=>reject(transaction.error);
    });
    remove=removeUploaded;
    if(!remove)return;
    await new Promise((resolve,reject)=>{
      const transaction=db.transaction(STORE,'readwrite');
      const request=transaction.objectStore(STORE).openCursor();
      request.onsuccess=()=>{
        const cursor=request.result;
        if(!cursor||remove<=0)return;
        cursor.delete();remove-=1;cursor.continue();
      };
      transaction.oncomplete=resolve;
      transaction.onerror=()=>reject(transaction.error);
    });
  }

  async function flush(){
    clearTimeout(flushTimer);flushTimer=0;
    if(!queue.length)return;
    const batch=queue.splice(0,queue.length);
    try{
      const db=await openDb();
      await new Promise((resolve,reject)=>{
        const transaction=db.transaction(STORE,'readwrite');
        const store=transaction.objectStore(STORE);
        batch.forEach(item=>store.add({...item,uploadState:0}));
        transaction.oncomplete=resolve;
        transaction.onerror=()=>reject(transaction.error);
      });
      writtenSincePrune+=batch.length;
      await prune(db);
    }catch(error){
      console.error('Zapis diagnostyki:',error);
      queue.unshift(...batch.slice(-200));
    }
  }

  async function pendingEvents(limit=UPLOAD_BATCH_SIZE){
    await flush();
    const db=await openDb();
    return new Promise((resolve,reject)=>{
      const request=db.transaction(STORE,'readonly').objectStore(STORE)
        .index('uploadState').getAll(IDBKeyRange.only(0),limit);
      request.onsuccess=()=>resolve(request.result||[]);
      request.onerror=()=>reject(request.error);
    });
  }

  async function pendingSessionEvents(targetSessionId,limit=UPLOAD_BATCH_SIZE){
    await flush();
    const db=await openDb();
    return new Promise((resolve,reject)=>{
      const events=[];
      const request=db.transaction(STORE,'readonly').objectStore(STORE)
        .index('sessionId').openCursor(IDBKeyRange.only(targetSessionId));
      request.onsuccess=()=>{
        const cursor=request.result;
        if(!cursor||events.length>=limit){resolve(events);return}
        if(cursor.value?.uploadState!==1)events.push(cursor.value);
        if(events.length>=limit){resolve(events);return}
        cursor.continue();
      };
      request.onerror=()=>reject(request.error);
    });
  }

  async function markEventsUploaded(events){
    if(!events.length)return;
    const db=await openDb();
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
  }

  async function clearEvents(){
    queue=[];
    const db=await openDb();
    await new Promise((resolve,reject)=>{
      const request=db.transaction(STORE,'readwrite').objectStore(STORE).clear();
      request.onsuccess=resolve;
      request.onerror=()=>reject(request.error);
    });
    localStorage.removeItem(LEGACY_LAST_UPLOADED_KEY);
    localStorage.removeItem(LEGACY_SESSION_UPLOAD_CURSORS_KEY);
    localStorage.removeItem(UPLOAD_WINDOW_KEY);
    updateUi('Dane diagnostyczne zostały usunięte.');
  }

  function scheduleUpload(delay=1000){
    clearTimeout(uploadTimer);
    uploadTimer=setTimeout(()=>{
      uploadTimer=0;
      runScheduledUpload().catch(error=>console.warn('Harmonogram wysyłki diagnostyki:',error));
    },delay);
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
    const sameSession=events.filter(event=>event.sessionId===events[0]?.sessionId);
    while(sameSession.length>1&&new TextEncoder().encode(JSON.stringify(payloadFor(sameSession))).byteLength>UPLOAD_MAX_BYTES)sameSession.pop();
    return sameSession;
  }

  async function uploadPending(){
    if(uploadInFlight||!navigator.onLine)return uploadInFlight;
    uploadInFlight=(async()=>{
      let sent=0;
      try{
        await flush();
        if(sessionId){
          for(let part=0;part<8;part++){
            const pending=await pendingSessionEvents(sessionId);
            if(!pending.length)break;
            const events=boundedBatch(pending);
            if(!events.length)throw new Error('Nie można przygotować bieżącej paczki diagnostycznej.');
            await uploadBatch(events);
            await markEventsUploaded(events);
            sent+=events.length;
          }
        }
        for(let part=8;part<UPLOAD_MAX_PARTS;part++){
          const pending=await pendingEvents();
          if(!pending.length)break;
          const events=boundedBatch(pending);
          if(!events.length)throw new Error('Nie można przygotować paczki diagnostycznej.');
          await uploadBatch(events);
          await markEventsUploaded(events);
          sent+=events.length;
        }
        const complete=(await pendingEvents(1)).length===0;
        lastSyncMessage=sent
          ?`Wysłano ${sent} nowych zdarzeń i scalono je z plikami sesji${complete?'.':'; pozostałe wyśle kolejne okno.'}`
          :'Wszystkie zapisane dane są wysłane.';
        return{sent,complete};
      }catch(error){
        lastSyncMessage=navigator.onLine?'Wysyłka nie powiodła się — aplikacja ponowi ją automatycznie.':'Brak internetu — dane czekają bezpiecznie na telefonie.';
        console.warn('Automatyczna wysyłka diagnostyki:',error);
        return{sent,complete:false,error:true};
      }finally{
        uploadInFlight=null;updateUi();
      }
    })();
    return uploadInFlight;
  }

  async function uploadBatch(events){
    const payload=payloadFor(events);
    const response=await fetch(UPLOAD_ENDPOINT,{
      method:'POST',cache:'no-store',credentials:'same-origin',
      headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)
    });
    const result=await response.json().catch(()=>({}));
    if(!response.ok||result?.status!=='success')throw new Error(result?.message||`HTTP ${response.status}`);
    return result;
  }

  function dueUploadWindow(now=new Date()){
    const boundary=new Date(now);
    let name='wieczór';
    if(now.getHours()>=18){boundary.setHours(18,0,0,0)}
    else if(now.getHours()>=12){name='południe';boundary.setHours(12,0,0,0)}
    else{boundary.setDate(boundary.getDate()-1);boundary.setHours(18,0,0,0)}
    const day=[boundary.getFullYear(),String(boundary.getMonth()+1).padStart(2,'0'),String(boundary.getDate()).padStart(2,'0')].join('-');
    return{key:`${day}:${name}`,boundary};
  }

  async function runScheduledUpload(){
    if(!navigator.onLine||localStorage.getItem(CONSENT_KEY)!=='approved')return;
    const due=dueUploadWindow();
    if(localStorage.getItem(UPLOAD_WINDOW_KEY)===due.key)return;
    const oldest=(await pendingEvents(1))[0];
    if(!oldest||new Date(oldest.at)>due.boundary){
      localStorage.setItem(UPLOAD_WINDOW_KEY,due.key);
      return;
    }
    const result=await uploadPending();
    if(result?.complete)localStorage.setItem(UPLOAD_WINDOW_KEY,due.key);
  }

  function setActive(next){
    active=Boolean(next);
    if(active){
      eventPolicyState.clear();
      sessionId=newSessionId();
      localStorage.setItem(ACTIVE_KEY,'1');
      localStorage.setItem(SESSION_KEY,sessionId);
      localStorage.setItem(CONSENT_KEY,'approved');
      localStorage.setItem(FIRST_USE_PROMPT_KEY,'shown');
      useEndRecorded=false;
      record('recording-started',{
        appVersion:version?.dataset.version||'',
        userAgent:navigator.userAgent,
        language:navigator.language,
        screen:{width:screen.width,height:screen.height,pixelRatio:devicePixelRatio}
      });
    }else{
      record('recording-stopped');
      active=false;
      localStorage.removeItem(ACTIVE_KEY);
      flush();
    }
    root.classList.toggle('diagnosticRecording',active);
    updateUi(active?'Rejestrowanie jest włączone. Wykonaj przejazd testowy.':'Rejestrowanie zostało zatrzymane.');
  }

  function makeDialog(){
    let dialog=document.getElementById('diagnosticDialog');
    if(dialog)return dialog;
    dialog=document.createElement('dialog');
    dialog.id='diagnosticDialog';
    dialog.className='diagnosticDialog';
    dialog.innerHTML=`<form method="dialog">
      <div class="diagnosticDialogHead"><span aria-hidden="true">●</span><h2 id="diagnosticTitle">Zgoda na diagnostykę</h2></div>
      <p class="diagnosticPrivacy">Dane pomagają wykrywać i naprawiać błędy harmonogramu, prowadzenia do przystanków oraz GPS podczas rzeczywistych przejazdów.</p>
      <p class="diagnosticPrivacy diagnosticConsentInfo">Po wyrażeniu zgody aplikacja będzie zapisywać sposób działania i dokładną lokalizację. Dane zostaną automatycznie przesłane do prywatnego folderu diagnostycznego najwyżej dwa razy dziennie. Rejestrowanie można później wyłączyć.</p>
      <label class="diagnosticDeviceLabel" for="diagnosticDeviceName">Nazwa telefonu (opcjonalnie)
        <input id="diagnosticDeviceName" type="text" maxlength="80" autocomplete="off" placeholder="np. Telefon Krzysztofa">
      </label>
      <small class="diagnosticDeviceHint">Ułatwia rozpoznanie plików z różnych urządzeń.</small>
      <p id="diagnosticState" class="diagnosticState"></p>
      <p id="diagnosticSync" class="diagnosticSync"></p>
      <div class="diagnosticActions">
        <button id="diagnosticToggle" type="button" class="primary"></button>
        <button id="diagnosticClear" type="button" class="danger">USUŃ ZAPISANE DANE</button>
        <button id="diagnosticClose" type="submit" class="secondary"></button>
      </div>
    </form>`;
    document.body.append(dialog);
    const deviceName=dialog.querySelector('#diagnosticDeviceName');
    deviceName.value=localStorage.getItem(DEVICE_NAME_KEY)||'';
    deviceName.addEventListener('change',()=>{
      const value=String(deviceName.value||'').replace(/[\u0000-\u001F\u007F]/g,' ').replace(/\s+/g,' ').trim().slice(0,80);
      deviceName.value=value;
      if(value)localStorage.setItem(DEVICE_NAME_KEY,value);
      else localStorage.removeItem(DEVICE_NAME_KEY);
      updateUi(value?`Zapisano nazwę urządzenia: ${value}.`:'Będzie używana automatyczna nazwa urządzenia.');
    });
    dialog.querySelector('#diagnosticToggle').onclick=()=>{
      const accepting=localStorage.getItem(CONSENT_KEY)!=='approved'&&!active;
      setActive(!active);
      if(accepting&&active)dialog.close();
    };
    dialog.querySelector('#diagnosticClear').onclick=async()=>{
      if(confirm('Usunąć wszystkie zapisane dane diagnostyczne z telefonu?'))await clearEvents();
    };
    dialog.addEventListener('close',()=>localStorage.setItem(FIRST_USE_PROMPT_KEY,'shown'));
    return dialog;
  }

  function updateUi(message=''){
    root.classList.toggle('diagnosticRecording',active);
    const dialog=document.getElementById('diagnosticDialog');
    if(!dialog)return;
    const toggle=dialog.querySelector('#diagnosticToggle');
    const state=dialog.querySelector('#diagnosticState');
    const sync=dialog.querySelector('#diagnosticSync');
    const title=dialog.querySelector('#diagnosticTitle');
    const clear=dialog.querySelector('#diagnosticClear');
    const close=dialog.querySelector('#diagnosticClose');
    const approved=localStorage.getItem(CONSENT_KEY)==='approved';
    title.textContent=approved?'Diagnostyka testowa':'Zgoda na diagnostykę';
    toggle.textContent=active?'ZATRZYMAJ REJESTROWANIE':approved?'ROZPOCZNIJ REJESTROWANIE':'WYRAŻAM ZGODĘ';
    toggle.classList.toggle('diagnosticStop',active);
    state.hidden=!approved;
    sync.hidden=!approved;
    clear.hidden=!approved;
    close.textContent=approved?'ZAMKNIJ':'NIE TERAZ';
    state.textContent=message||(active?'Rejestrowanie włączone.':'Rejestrowanie wyłączone.');
    sync.textContent=lastSyncMessage;
  }

  function detailListener(type){return event=>record(type,event.detail||{})}
  function finishUse(reason){
    if(!active||useEndRecorded)return;
    useEndRecorded=true;
    record('application-use-ended',{reason});
    flush();
  }
  [
    'trasy:stop-transition','trasy:route-build','trasy:navigation-resumed',
    'trasy:gps-speed','gps-next-stop-change','gps-stop-skipped','gps-stop-arrival',
    'stop-guard-change','nav-eta-update','eta-status-change','route-direction-change',
    'route-mode-change','return-origin-change','schedule-rendered'
  ].forEach(type=>(type.startsWith('trasy:')?document:document.getElementById('scheduleBody'))?.addEventListener(type,detailListener(type)));

  window.addEventListener('error',event=>record('window-error',{message:event.message,filename:event.filename,line:event.lineno,column:event.colno,error:event.error}));
  window.addEventListener('unhandledrejection',event=>record('unhandled-rejection',{reason:event.reason}));
  window.addEventListener('online',()=>{record('network-online');scheduleUpload(500)});
  window.addEventListener('offline',()=>record('network-offline'));
  document.addEventListener('visibilitychange',()=>{
    record('visibility-change',{state:document.visibilityState});
    if(document.visibilityState==='hidden')finishUse('hidden');
    else if(useEndRecorded&&active){useEndRecorded=false;record('application-use-resumed')}
  });
  window.addEventListener('pagehide',()=>finishUse('pagehide'));
  document.addEventListener('click',event=>{
    const control=event.target.closest?.('button,a,select,input');
    if(!control)return;
    const id=control.id||control.closest?.('[id]')?.id||'';
    if(!id&&!control.classList.contains('routeLink'))return;
    record('control-action',{id,tag:control.tagName,type:control.type||'',checked:control.checked,value:control.tagName==='SELECT'?control.value:undefined,text:String(control.textContent||'').trim().slice(0,120)});
  },true);

  window.__trasyGps?.subscribe?.(position=>{
    if(!active)return;
    const now=Number(position.timestamp)||Date.now();
    if(now-lastGpsAt<GPS_MIN_INTERVAL_MS)return;
    lastGpsAt=now;
    record('gps-fix',{
      timestamp:now,
      latitude:Number(position.coords.latitude),
      longitude:Number(position.coords.longitude),
      accuracy:Number(position.coords.accuracy),
      speed:Number(position.coords.speed),
      heading:Number(position.coords.heading),
      altitude:Number(position.coords.altitude)
    });
  },error=>record('gps-error',{code:error?.code,message:error?.message}));

  document.getElementById('diagnosticButton')?.addEventListener('click',()=>{
    const dialog=makeDialog();updateUi();dialog.showModal();
  });
  version?.addEventListener('click',()=>{
    const dialog=makeDialog();updateUi();dialog.showModal();
  });
  root.classList.toggle('diagnosticRecording',active);
  if(active){
    sessionId=newSessionId();
    localStorage.setItem(SESSION_KEY,sessionId);
    record('recording-restored',{appVersion:version?.dataset.version||''});
  }
  setInterval(()=>{
    if(active)flush();
    runScheduledUpload().catch(error=>console.warn('Harmonogram wysyłki diagnostyki:',error));
  },UPLOAD_CHECK_INTERVAL_MS);
  if(navigator.onLine)scheduleUpload(1500);
  if(!active&&localStorage.getItem(FIRST_USE_PROMPT_KEY)!=='shown'){
    setTimeout(()=>{
      const dialog=makeDialog();
      updateUi('Przy pierwszym użyciu możesz od razu zatwierdzić automatyczne rejestrowanie testu. Dane nie są zbierane przed Twoją zgodą.');
      if(!dialog.open)dialog.showModal();
    },0);
  }
})();
