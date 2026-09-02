(()=>{
  const root=document.body;
  const version=document.getElementById('globalTestVersion');
  if(!root||root.dataset.testDiagnostics!=='enabled'||!/^TEST\b/i.test(version?.textContent||''))return;

  const EMAIL='kswiderski.de@gmail.com';
  const DB_NAME='trasy2-test-diagnostics';
  const DB_VERSION=1;
  const STORE='events';
  const ACTIVE_KEY='trasy2.diagnostics.active';
  const SESSION_KEY='trasy2.diagnostics.session';
  const MAX_EVENTS=50000;
  const GPS_MIN_INTERVAL_MS=900;
  let dbPromise=null;
  let queue=[];
  let flushTimer=0;
  let writtenSincePrune=0;
  let lastGpsAt=0;
  let active=localStorage.getItem(ACTIVE_KEY)==='1';
  let sessionId=localStorage.getItem(SESSION_KEY)||'';

  function newSessionId(){
    return `${new Date().toISOString().replace(/[:.]/g,'-')}-${Math.random().toString(36).slice(2,8)}`;
  }

  function openDb(){
    if(dbPromise)return dbPromise;
    dbPromise=new Promise((resolve,reject)=>{
      const request=indexedDB.open(DB_NAME,DB_VERSION);
      request.onupgradeneeded=()=>{
        const db=request.result;
        if(!db.objectStoreNames.contains(STORE)){
          const store=db.createObjectStore(STORE,{keyPath:'id',autoIncrement:true});
          store.createIndex('sessionId','sessionId');
          store.createIndex('at','at');
        }
      };
      request.onsuccess=()=>resolve(request.result);
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

  function record(type,detail={}){
    if(!active)return;
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
        batch.forEach(item=>store.add(item));
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

  async function allEvents(){
    await flush();
    const db=await openDb();
    return new Promise((resolve,reject)=>{
      const request=db.transaction(STORE,'readonly').objectStore(STORE).getAll();
      request.onsuccess=()=>resolve(request.result||[]);
      request.onerror=()=>reject(request.error);
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
    updateUi('Dane diagnostyczne zostały usunięte.');
  }

  function setActive(next){
    active=Boolean(next);
    if(active){
      sessionId=newSessionId();
      localStorage.setItem(ACTIVE_KEY,'1');
      localStorage.setItem(SESSION_KEY,sessionId);
      record('recording-started',{
        appVersion:version?.dataset.version||'',
        userAgent:navigator.userAgent,
        language:navigator.language,
        screen:{width:screen.width,height:screen.height,pixelRatio:devicePixelRatio},
        recipient:EMAIL
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
      <div class="diagnosticDialogHead"><span aria-hidden="true">●</span><h2>Diagnostyka testowa</h2></div>
      <p class="diagnosticPrivacy">Plik zawiera przebieg działania aplikacji oraz dokładne pozycje GPS. Dane są zapisywane tylko na tym telefonie do chwili eksportu lub usunięcia.</p>
      <p id="diagnosticState" class="diagnosticState"></p>
      <div class="diagnosticActions">
        <button id="diagnosticToggle" type="button" class="primary"></button>
        <button id="diagnosticSend" type="button">WYŚLIJ E-MAIL</button>
        <button id="diagnosticDownload" type="button">ZAPISZ PLIK</button>
        <button id="diagnosticClear" type="button" class="danger">USUŃ DANE</button>
        <button type="submit" class="secondary">ZAMKNIJ</button>
      </div>
      <small class="diagnosticRecipient">Odbiorca: ${EMAIL}</small>
    </form>`;
    document.body.append(dialog);
    dialog.querySelector('#diagnosticToggle').onclick=()=>setActive(!active);
    dialog.querySelector('#diagnosticSend').onclick=()=>exportDiagnostics('email');
    dialog.querySelector('#diagnosticDownload').onclick=()=>exportDiagnostics('download');
    dialog.querySelector('#diagnosticClear').onclick=async()=>{
      if(confirm('Usunąć wszystkie zapisane dane diagnostyczne z telefonu?'))await clearEvents();
    };
    return dialog;
  }

  function updateUi(message=''){
    root.classList.toggle('diagnosticRecording',active);
    const dialog=document.getElementById('diagnosticDialog');
    if(!dialog)return;
    const toggle=dialog.querySelector('#diagnosticToggle');
    const state=dialog.querySelector('#diagnosticState');
    toggle.textContent=active?'ZATRZYMAJ REJESTROWANIE':'ROZPOCZNIJ REJESTROWANIE';
    toggle.classList.toggle('diagnosticStop',active);
    state.textContent=message||(active?'Rejestrowanie włączone.':'Rejestrowanie wyłączone.');
  }

  function downloadFile(file){
    const url=URL.createObjectURL(file);
    const link=document.createElement('a');
    link.href=url;link.download=file.name;document.body.append(link);link.click();link.remove();
    setTimeout(()=>URL.revokeObjectURL(url),30000);
  }

  async function exportDiagnostics(target='download'){
    try{
      record('diagnostics-export-requested',{target});
      const events=await allEvents();
      if(!events.length){updateUi('Brak zapisanych danych do eksportu.');return}
      const exportedAt=new Date().toISOString();
      const archive={
        format:'trasy-2.0-test-diagnostics',
        schemaVersion:1,
        exportedAt,
        intendedRecipient:EMAIL,
        appVersion:version?.dataset.version||'',
        locationDataIncluded:true,
        events
      };
      const name=`trasy-2.0-diagnostyka-${exportedAt.replace(/[:.]/g,'-')}.json`;
      const file=new File([JSON.stringify(archive,null,2)],name,{type:'application/json'});
      if(target==='email'){
        downloadFile(file);
        updateUi(`Plik zapisany. Dołącz go do wiadomości na ${EMAIL}.`);
        const subject=encodeURIComponent('Diagnostyka Trasy 2.0');
        const body=encodeURIComponent(`W załączniku przesyłam plik diagnostyczny ${name}. Plik został zapisany w folderze Pobrane i należy dołączyć go do tej wiadomości.`);
        setTimeout(()=>{location.href=`mailto:${EMAIL}?subject=${subject}&body=${body}`},500);
      }else{
        downloadFile(file);
        updateUi(`Plik zapisany. Dołącz go do wiadomości na ${EMAIL}.`);
      }
    }catch(error){
      if(error?.name!=='AbortError'){
        console.error('Eksport diagnostyki:',error);
        updateUi(`Nie udało się wyeksportować danych: ${error?.message||error}`);
      }
    }
  }

  function detailListener(type){return event=>record(type,event.detail||{})}
  [
    'trasy:stop-transition','trasy:route-build','trasy:navigation-resumed',
    'trasy:gps-speed','gps-next-stop-change','gps-stop-skipped','gps-stop-arrival',
    'stop-guard-change','nav-eta-update','eta-status-change','route-direction-change',
    'route-mode-change','return-origin-change','schedule-rendered'
  ].forEach(type=>(type.startsWith('trasy:')?document:document.getElementById('scheduleBody'))?.addEventListener(type,detailListener(type)));

  window.addEventListener('error',event=>record('window-error',{message:event.message,filename:event.filename,line:event.lineno,column:event.colno,error:event.error}));
  window.addEventListener('unhandledrejection',event=>record('unhandled-rejection',{reason:event.reason}));
  window.addEventListener('online',()=>record('network-online'));
  window.addEventListener('offline',()=>record('network-offline'));
  document.addEventListener('visibilitychange',()=>record('visibility-change',{state:document.visibilityState}));
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
  if(active)record('recording-restored',{appVersion:version?.dataset.version||''});
})();
