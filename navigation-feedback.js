(()=>{
  const STORAGE_KEY='trasy2.navigationFeedback.v1';
  const MAX_SAVED_NOTES=50;
  const MAX_NOTE_LENGTH=2000;
  const TEMP_TEST_FEEDBACK_EMAIL='kswiderski70@gmail.com';
  const ARCHIVE_FORMAT='pl.tyli.trasy2.feedback-archive';
  const ARCHIVE_DEVICE_KEY='trasy2.feedbackArchiveDeviceCode.v1';

  const style=document.createElement('style');
  style.textContent=`
    #routeFeedbackButton{position:fixed;right:16px;bottom:calc(18px + env(safe-area-inset-bottom));z-index:80500;width:46px;height:46px;padding:0;border:1px solid #fff8;border-radius:23px;background:#ccff33;color:#111;box-shadow:0 3px 12px #0009;display:flex;align-items:center;justify-content:center;cursor:pointer}
    #routeFeedbackButton svg{width:25px;height:25px;display:block}
    body.routeFeedbackNavigation #routeFeedbackButton{position:fixed;left:6px;right:auto;top:158px;bottom:auto}
    #routeFeedbackDialog{position:fixed;inset:0;z-index:95000;padding:14px;background:#000b;display:flex;align-items:flex-end;justify-content:center;box-sizing:border-box}
    #routeFeedbackDialog[hidden]{display:none!important}
    .routeFeedbackCard{width:min(100%,520px);max-height:calc(100dvh - 28px);overflow:auto;box-sizing:border-box;padding:16px;border:1px solid #666;border-radius:16px;background:#1c1c1c;color:#fff;box-shadow:0 10px 35px #000c}
    .routeFeedbackHead{display:flex;align-items:center;gap:10px}.routeFeedbackHead h2{flex:1;margin:0;color:#ccff33;font-size:21px}.routeFeedbackClose{width:38px;height:38px;padding:0;border-radius:19px;background:#333;color:#fff;font-size:24px}
    .routeFeedbackBack{width:38px;height:38px;padding:0;border-radius:19px;background:#333;color:#fff;font-size:24px}.routeFeedbackBack[hidden]{display:none!important}.routeFeedbackCategories{display:grid;gap:10px;margin-top:16px}.routeFeedbackCategory{display:flex;align-items:center;gap:12px;width:100%;padding:14px;border:1px solid #666;border-radius:12px;background:#292929;color:#fff;text-align:left;font:800 16px/1.2 Arial,sans-serif}.routeFeedbackCategory:hover,.routeFeedbackCategory:focus-visible{border-color:#ccff33}.routeFeedbackCategoryIcon{display:flex;width:38px;height:38px;flex:0 0 38px;align-items:center;justify-content:center;border-radius:19px;background:#ccff33;color:#111;font-size:21px}.routeFeedbackForm[hidden],.routeFeedbackCategories[hidden]{display:none!important}
    #routeFeedbackText{display:block;width:100%;min-height:128px;margin-top:13px;padding:12px;box-sizing:border-box;resize:vertical;border:1px solid #777;border-radius:10px;background:#101010;color:#fff;font:16px/1.4 Arial,sans-serif}
    .routeFeedbackVoice{display:flex;align-items:center;gap:9px;margin-top:10px}.routeFeedbackVoice button{width:46px;height:46px;padding:0;border-radius:23px;font-size:22px}.routeFeedbackVoice button.listening{background:#e53935;color:#fff;animation:routeFeedbackPulse 1.2s infinite}.routeFeedbackVoice span{font-size:13px;color:#ccc}
    .routeFeedbackInfo{margin:11px 0 0;color:#bbb;font-size:12px;line-height:1.35}.routeFeedbackActions{display:grid;grid-template-columns:1fr;gap:9px;margin-top:14px}.routeFeedbackActions button{padding:12px 8px;font-weight:900}.routeFeedbackActions .primary{background:#ccff33;color:#111}.routeFeedbackMessage{min-height:18px;margin-top:9px;color:#ccff33;font-size:13px}
    @keyframes routeFeedbackPulse{50%{box-shadow:0 0 0 7px #e5393544}}
    @media(max-width:420px){.routeFeedbackActions{grid-template-columns:1fr}}
  `;
  document.head.appendChild(style);

  const button=document.createElement('button');
  button.id='routeFeedbackButton';
  button.type='button';
  button.title='Dodaj zgłoszenie';
  button.setAttribute('aria-label','Dodaj zgłoszenie');
  button.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 7v10M7 12h10" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>';

  const dialog=document.createElement('div');
  dialog.id='routeFeedbackDialog';
  dialog.hidden=true;
  dialog.setAttribute('role','dialog');
  dialog.setAttribute('aria-modal','true');
  dialog.setAttribute('aria-labelledby','routeFeedbackTitle');
  dialog.innerHTML=`
    <section class="routeFeedbackCard">
      <div class="routeFeedbackHead">
        <button class="routeFeedbackBack" type="button" aria-label="Wróć do rodzajów zgłoszeń" hidden>‹</button>
        <h2 id="routeFeedbackTitle">Dodaj zgłoszenie</h2>
        <button class="routeFeedbackClose" type="button" aria-label="Zamknij">×</button>
      </div>
      <div class="routeFeedbackCategories">
        <button class="routeFeedbackCategory" type="button" data-category="fault"><span class="routeFeedbackCategoryIcon">⚠</span><span>Zgłoś usterkę</span></button>
        <button class="routeFeedbackCategory" type="button" data-category="speed"><span class="routeFeedbackCategoryIcon">50</span><span>Zgłoś niewłaściwą prędkość</span></button>
        <button class="routeFeedbackCategory" type="button" data-category="closure"><span class="routeFeedbackCategoryIcon">⛔</span><span>Zgłoś zamknięty odcinek</span></button>
      </div>
      <div class="routeFeedbackForm" hidden>
        <textarea id="routeFeedbackText" maxlength="${MAX_NOTE_LENGTH}" placeholder="Opisz zgłoszenie…"></textarea>
        <div class="routeFeedbackVoice">
          <button id="routeFeedbackMic" type="button" aria-label="Dyktuj uwagę" title="Dyktuj uwagę">🎤</button>
          <span id="routeFeedbackVoiceStatus">Możesz napisać lub podyktować uwagę.</span>
        </div>
        <p id="routeFeedbackInfo" class="routeFeedbackInfo"></p>
        <div class="routeFeedbackActions">
          <button id="routeFeedbackSave" type="button">WYŚLIJ</button>
          <button id="routeFeedbackArchive" type="button">ZAPISZ PLIK ARCHIWUM</button>
        </div>
        <div id="routeFeedbackMessage" class="routeFeedbackMessage" aria-live="polite"></div>
      </div>
    </section>
  `;

  document.body.append(button,dialog);

  const textarea=dialog.querySelector('#routeFeedbackText');
  const title=dialog.querySelector('#routeFeedbackTitle');
  const categories=dialog.querySelector('.routeFeedbackCategories');
  const form=dialog.querySelector('.routeFeedbackForm');
  const backButton=dialog.querySelector('.routeFeedbackBack');
  const closeButton=dialog.querySelector('.routeFeedbackClose');
  const micButton=dialog.querySelector('#routeFeedbackMic');
  const voiceStatus=dialog.querySelector('#routeFeedbackVoiceStatus');
  const saveButton=dialog.querySelector('#routeFeedbackSave');
  const archiveButton=dialog.querySelector('#routeFeedbackArchive');
  const deliveryInfo=dialog.querySelector('#routeFeedbackInfo');
  const message=dialog.querySelector('#routeFeedbackMessage');
  let recognition=null;
  let listening=false;
  let selectedCategory=null;
  const categoryDetails={
    fault:{label:'Zgłoś usterkę',placeholder:'Opisz, co nie działa i na którym ekranie…'},
    speed:{label:'Zgłoś niewłaściwą prędkość',placeholder:'Podaj prawidłowe ograniczenie i opisz miejsce…'},
    closure:{label:'Zgłoś zamknięty odcinek',placeholder:'Opisz zamknięty odcinek lub przeszkodę na drodze…'}
  };

  function navigationVisible(){
    const nav=document.getElementById('routeMapNav');
    return Boolean(nav&&!nav.hidden);
  }

  function updatePosition(){
    const navVisible=navigationVisible();
    document.body.classList.toggle('routeFeedbackNavigation',navVisible);
    if(button.parentElement!==document.body)document.body.append(button);
  }

  function currentContext(){
    const route=document.getElementById('scheduleRouteName')?.textContent?.trim()||document.getElementById('routeSelect')?.selectedOptions?.[0]?.textContent?.trim()||'';
    const shift=document.getElementById('scheduleTimeSelect')?.value||'';
    const vehicle=window.__selectedVehicle;
    const vehicleName=vehicle?.name||vehicle?.registration||vehicle?.label||'';
    const nextStop=document.getElementById('routeNextStop')?.textContent?.trim()||'';
    const screen=navigationVisible()?'nawigacja':document.getElementById('scheduleView')?.hidden===false?'harmonogram':'wybór trasy';
    const version=document.getElementById('globalTestVersion')?.textContent?.trim()||'';
    return {createdAt:new Date().toISOString(),screen,route,shift,vehicle:vehicleName,nextStop,version};
  }

  function readNotes(){
    try{
      const notes=JSON.parse(localStorage.getItem(STORAGE_KEY)||'[]');
      return Array.isArray(notes)?notes:[];
    }catch{return []}
  }

  function saveNote(text){
    const note=String(text||'').trim().slice(0,MAX_NOTE_LENGTH);
    if(!note)throw new Error('Wpisz lub podyktuj uwagę.');
    if(!selectedCategory||!categoryDetails[selectedCategory])throw new Error('Wybierz rodzaj zgłoszenia.');
    const record={id:`feedback_${Date.now()}_${Math.random().toString(36).slice(2,8)}`,category:selectedCategory,categoryLabel:categoryDetails[selectedCategory].label,text:note,deliveryStatus:'pending',...currentContext()};
    const notes=readNotes();
    notes.push(record);
    localStorage.setItem(STORAGE_KEY,JSON.stringify(notes.slice(-MAX_SAVED_NOTES)));
    document.dispatchEvent(new CustomEvent('trasy:navigation-feedback-saved',{detail:record}));
    return record;
  }

  function updateNote(id,patch){
    const notes=readNotes(),index=notes.findIndex(note=>note.id===id);
    if(index<0)return;
    notes[index]={...notes[index],...patch};
    localStorage.setItem(STORAGE_KEY,JSON.stringify(notes.slice(-MAX_SAVED_NOTES)));
  }

  function archiveDeviceCode(){
    let code=localStorage.getItem(ARCHIVE_DEVICE_KEY)||'';
    if(!/^[A-Z0-9]{6}$/.test(code)){
      const bytes=new Uint8Array(6);crypto.getRandomValues(bytes);
      code=[...bytes].map(value=>'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[value%32]).join('');
      localStorage.setItem(ARCHIVE_DEVICE_KEY,code);
    }
    return code;
  }

  function archiveId(){
    return `archive_${crypto.randomUUID?.()||`${Date.now()}_${Math.random().toString(36).slice(2,12)}`}`;
  }

  function exportArchive(){
    const records=readNotes().filter(note=>note.deliveryStatus!=='sent');
    if(!records.length){message.textContent='Na tym urządzeniu nie ma oczekujących zgłoszeń do zapisania.';return}
    const deviceCode=archiveDeviceCode(),exportedAt=new Date().toISOString();
    const archive={format:ARCHIVE_FORMAT,schemaVersion:1,archiveId:archiveId(),deviceCode,exportedAt,sourceVersion:document.getElementById('globalTestVersion')?.textContent?.trim()||'',records:records.map(record=>({id:record.id,category:record.category,categoryLabel:record.categoryLabel,text:record.text,createdAt:record.createdAt,screen:record.screen,route:record.route,shift:record.shift,vehicle:record.vehicle,nextStop:record.nextStop,version:record.version}))};
    const blob=new Blob([JSON.stringify(archive,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),link=document.createElement('a');
    link.href=url;link.download=`Trasy2_archiwum_${deviceCode}_${exportedAt.slice(0,10)}.trasy2.json`;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
    message.textContent=`Zapisano archiwum ${deviceCode} zawierające ${records.length} zgłoszeń. Zachowaj plik w folderze Pobrane.`;
  }

  function panelConnected(){
    return typeof window.KURSY_DRIVER_API?.driverFeedback==='function';
  }

  function updateDeliveryUi(){
    if(panelConnected()){
      saveButton.textContent='WYŚLIJ';
      deliveryInfo.textContent='Zgłoszenie zostanie wysłane do panelu administratora i na ustawiony przez niego adres e-mail.';
      return;
    }
    saveButton.textContent='WYŚLIJ TESTOWO E-MAILEM';
    deliveryInfo.textContent='Panel administratora nie jest jeszcze połączony. Zgłoszenie zostanie zapisane na tym urządzeniu, a następnie otworzy się gotowa wiadomość e-mail. Po nadaniu dostępu z panelu ten tymczasowy sposób zostanie automatycznie wyłączony.';
  }

  function temporaryEmailUrl(record){
    const details=[
      `Rodzaj: ${record.categoryLabel}`,
      `Ekran: ${record.screen}`,
      record.route&&`Trasa: ${record.route}`,
      record.shift&&`Zmiana: ${record.shift}`,
      record.vehicle&&`Pojazd: ${record.vehicle}`,
      record.nextStop&&`Następny przystanek: ${record.nextStop}`,
      record.version&&`Wersja: ${record.version}`,
      `Czas: ${record.createdAt}`
    ].filter(Boolean).join('\n');
    const subject=`Trasy 2.0 — ${record.categoryLabel}`;
    const body=`${record.text.slice(0,1600)}\n\n${details}\n\nId zgłoszenia: ${record.id}`;
    return `mailto:${TEMP_TEST_FEEDBACK_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

  async function deliverRecord(record){
    const api=window.KURSY_DRIVER_API;
    if(!api||typeof api.driverFeedback!=='function')throw new Error('Panel administratora nie jest jeszcze połączony z tą wersją aplikacji. Zgłoszenie pozostaje bezpiecznie zapisane na urządzeniu.');
    await api.driverFeedback(record);
    updateNote(record.id,{deliveryStatus:'sent',deliveredAt:new Date().toISOString(),lastDeliveryError:''});
  }

  let flushing=false;
  async function flushPending(){
    if(flushing||!navigator.onLine)return;
    const api=window.KURSY_DRIVER_API;
    if(!api||typeof api.driverFeedback!=='function')return;
    flushing=true;
    try{
      for(const record of readNotes().filter(note=>note.deliveryStatus!=='sent')){
        try{await deliverRecord(record)}catch(error){updateNote(record.id,{lastDeliveryError:String(error?.message||'Błąd wysyłania').slice(0,200)});break}
      }
    }finally{flushing=false}
  }

  function setListening(active){
    listening=active;
    micButton.classList.toggle('listening',active);
    micButton.textContent=active?'■':'🎤';
    micButton.title=active?'Zatrzymaj dyktowanie':'Dyktuj uwagę';
    micButton.setAttribute('aria-label',micButton.title);
    voiceStatus.textContent=active?'Słucham… dotknij ponownie, aby zakończyć.':'Możesz napisać lub podyktować uwagę.';
  }

  function stopListening(){
    if(listening)try{recognition?.stop()}catch{}
    setListening(false);
  }

  function close(){
    stopListening();
    dialog.hidden=true;
    showCategories();
    message.textContent='';
    button.focus();
  }

  function open(){
    dialog.hidden=false;
    message.textContent='';
    updateDeliveryUi();
    showCategories();
    requestAnimationFrame(()=>dialog.querySelector('.routeFeedbackCategory')?.focus());
  }

  function showCategories(){
    stopListening();
    selectedCategory=null;
    categories.hidden=false;
    form.hidden=true;
    backButton.hidden=true;
    title.textContent='Dodaj zgłoszenie';
    message.textContent='';
  }

  function chooseCategory(category){
    const details=categoryDetails[category];
    if(!details)return;
    selectedCategory=category;
    categories.hidden=true;
    form.hidden=false;
    backButton.hidden=false;
    title.textContent=details.label;
    textarea.placeholder=details.placeholder;
    message.textContent='';
    updateDeliveryUi();
    requestAnimationFrame(()=>textarea.focus());
  }

  function prepareRecognition(){
    if(recognition)return true;
    const Recognition=window.SpeechRecognition||window.webkitSpeechRecognition;
    if(!Recognition)return false;
    recognition=new Recognition();
    recognition.lang='pl-PL';
    recognition.continuous=true;
    recognition.interimResults=false;
    recognition.onresult=event=>{
      let spoken='';
      for(let i=event.resultIndex;i<event.results.length;i++){
        if(event.results[i].isFinal)spoken+=event.results[i][0].transcript+' ';
      }
      if(spoken)textarea.value=`${textarea.value.trim()} ${spoken.trim()}`.trim().slice(0,MAX_NOTE_LENGTH);
    };
    recognition.onerror=event=>{
      setListening(false);
      voiceStatus.textContent=event.error==='not-allowed'?'Brak zgody na użycie mikrofonu.':'Nie udało się rozpoznać głosu. Możesz wpisać uwagę.';
    };
    recognition.onend=()=>setListening(false);
    return true;
  }

  button.onclick=open;
  categories.addEventListener('click',event=>chooseCategory(event.target.closest?.('[data-category]')?.dataset.category));
  backButton.onclick=showCategories;
  closeButton.onclick=close;
  dialog.addEventListener('click',event=>{if(event.target===dialog)close()});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!dialog.hidden)close()});

  micButton.onclick=()=>{
    if(listening){stopListening();return}
    if(!prepareRecognition()){
      voiceStatus.textContent='To urządzenie nie obsługuje dyktowania w przeglądarce.';
      return;
    }
    try{recognition.start();setListening(true)}catch{setListening(false)}
  };

  saveButton.onclick=async()=>{
    try{
      saveButton.disabled=true;
      const record=saveNote(textarea.value);
      if(!panelConnected()){
        updateNote(record.id,{temporaryEmailOpenedAt:new Date().toISOString()});
        textarea.value='';
        message.textContent='Zgłoszenie zapisano lokalnie. Dokończ wysyłanie w otwartej aplikacji pocztowej.';
        window.location.href=temporaryEmailUrl(record);
        return;
      }
      await deliverRecord(record);
      textarea.value='';
      message.textContent='Zgłoszenie wysłano do panelu administratora i przekazano do wysyłki e-mail.';
    }catch(error){
      textarea.value='';
      message.textContent=`Zgłoszenie zapisano lokalnie. Zostanie wysłane automatycznie po połączeniu z panelem administratora.${error?.message?` (${error.message})`:''}`;
    }finally{saveButton.disabled=false}
  };
  archiveButton.onclick=exportArchive;

  const nav=document.getElementById('routeMapNav');
  if(nav)new MutationObserver(updatePosition).observe(nav,{attributes:true,attributeFilter:['hidden']});
  updatePosition();
  window.addEventListener('online',flushPending);
  setTimeout(flushPending,1000);

  window.__trasyNavigationFeedback={
    open,
    list:readNotes,
    flush:flushPending
  };
})();
