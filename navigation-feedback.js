(()=>{
  const STORAGE_KEY='trasy2.navigationFeedback.v1';
  const MAX_SAVED_NOTES=50;
  const MAX_NOTE_LENGTH=2000;
  const FEEDBACK_PHONE='+48603666921';

  const style=document.createElement('style');
  style.textContent=`
    #routeFeedbackButton{position:fixed;right:16px;bottom:calc(18px + env(safe-area-inset-bottom));z-index:80500;width:46px;height:46px;padding:0;border:1px solid #fff8;border-radius:23px;background:#ccff33;color:#111;box-shadow:0 3px 12px #0009;display:flex;align-items:center;justify-content:center;cursor:pointer}
    #routeFeedbackButton svg{width:25px;height:25px;display:block}
    body.routeFeedbackNavigation #routeFeedbackButton{top:212px;right:12px;bottom:auto}
    #routeFeedbackDialog{position:fixed;inset:0;z-index:95000;padding:14px;background:#000b;display:flex;align-items:flex-end;justify-content:center;box-sizing:border-box}
    #routeFeedbackDialog[hidden]{display:none!important}
    .routeFeedbackCard{width:min(100%,520px);max-height:calc(100dvh - 28px);overflow:auto;box-sizing:border-box;padding:16px;border:1px solid #666;border-radius:16px;background:#1c1c1c;color:#fff;box-shadow:0 10px 35px #000c}
    .routeFeedbackHead{display:flex;align-items:center;gap:10px}.routeFeedbackHead h2{flex:1;margin:0;color:#ccff33;font-size:21px}.routeFeedbackClose{width:38px;height:38px;padding:0;border-radius:19px;background:#333;color:#fff;font-size:24px}
    #routeFeedbackText{display:block;width:100%;min-height:128px;margin-top:13px;padding:12px;box-sizing:border-box;resize:vertical;border:1px solid #777;border-radius:10px;background:#101010;color:#fff;font:16px/1.4 Arial,sans-serif}
    .routeFeedbackVoice{display:flex;align-items:center;gap:9px;margin-top:10px}.routeFeedbackVoice button{width:46px;height:46px;padding:0;border-radius:23px;font-size:22px}.routeFeedbackVoice button.listening{background:#e53935;color:#fff;animation:routeFeedbackPulse 1.2s infinite}.routeFeedbackVoice span{font-size:13px;color:#ccc}
    .routeFeedbackInfo{margin:11px 0 0;color:#bbb;font-size:12px;line-height:1.35}.routeFeedbackActions{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-top:14px}.routeFeedbackActions button{padding:12px 8px;font-weight:900}.routeFeedbackActions .primary{background:#ccff33;color:#111}.routeFeedbackActions .whatsapp{background:#25d366;color:#071d0f}.routeFeedbackActions .sms{background:#3a86ff;color:#fff}.routeFeedbackMessage{min-height:18px;margin-top:9px;color:#ccff33;font-size:13px}
    @keyframes routeFeedbackPulse{50%{box-shadow:0 0 0 7px #e5393544}}
    @media(max-width:420px){.routeFeedbackActions{grid-template-columns:1fr}}
  `;
  document.head.appendChild(style);

  const button=document.createElement('button');
  button.id='routeFeedbackButton';
  button.type='button';
  button.title='Przekaż uwagę o nawigacji';
  button.setAttribute('aria-label','Przekaż uwagę o nawigacji');
  button.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4.8h16v11.4H9l-5 3V4.8Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M7.5 9h9M7.5 12.5h6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';

  const dialog=document.createElement('div');
  dialog.id='routeFeedbackDialog';
  dialog.hidden=true;
  dialog.setAttribute('role','dialog');
  dialog.setAttribute('aria-modal','true');
  dialog.setAttribute('aria-labelledby','routeFeedbackTitle');
  dialog.innerHTML=`
    <section class="routeFeedbackCard">
      <div class="routeFeedbackHead">
        <h2 id="routeFeedbackTitle">Uwaga o nawigacji</h2>
        <button class="routeFeedbackClose" type="button" aria-label="Zamknij">×</button>
      </div>
      <textarea id="routeFeedbackText" maxlength="${MAX_NOTE_LENGTH}" placeholder="Napisz, co działa źle lub co warto poprawić…"></textarea>
      <div class="routeFeedbackVoice">
        <button id="routeFeedbackMic" type="button" aria-label="Dyktuj uwagę" title="Dyktuj uwagę">🎤</button>
        <span id="routeFeedbackVoiceStatus">Możesz napisać lub podyktować uwagę.</span>
      </div>
      <p class="routeFeedbackInfo">Uwaga zostanie zapisana na tym urządzeniu. Możesz wysłać ją przez WhatsApp lub SMS na numer +48 603 666 921. Jeśli WhatsApp nie jest dostępny, telefon automatycznie przejdzie do SMS. Wiadomość wyślesz samodzielnie.</p>
      <div class="routeFeedbackActions">
        <button id="routeFeedbackSave" type="button">ZAPISZ</button>
        <button id="routeFeedbackWhatsApp" class="whatsapp" type="button">WHATSAPP</button>
        <button id="routeFeedbackSms" class="sms" type="button">SMS</button>
        <button id="routeFeedbackShare" class="primary" type="button">INNA APLIKACJA</button>
      </div>
      <div id="routeFeedbackMessage" class="routeFeedbackMessage" aria-live="polite"></div>
    </section>
  `;

  document.body.append(button,dialog);

  const textarea=dialog.querySelector('#routeFeedbackText');
  const closeButton=dialog.querySelector('.routeFeedbackClose');
  const micButton=dialog.querySelector('#routeFeedbackMic');
  const voiceStatus=dialog.querySelector('#routeFeedbackVoiceStatus');
  const saveButton=dialog.querySelector('#routeFeedbackSave');
  const whatsAppButton=dialog.querySelector('#routeFeedbackWhatsApp');
  const smsButton=dialog.querySelector('#routeFeedbackSms');
  const shareButton=dialog.querySelector('#routeFeedbackShare');
  const message=dialog.querySelector('#routeFeedbackMessage');
  let recognition=null;
  let listening=false;

  function navigationVisible(){
    const nav=document.getElementById('routeMapNav');
    return Boolean(nav&&!nav.hidden);
  }

  function updatePosition(){
    document.body.classList.toggle('routeFeedbackNavigation',navigationVisible());
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
    const record={id:`feedback_${Date.now()}_${Math.random().toString(36).slice(2,8)}`,text:note,...currentContext()};
    const notes=readNotes();
    notes.push(record);
    localStorage.setItem(STORAGE_KEY,JSON.stringify(notes.slice(-MAX_SAVED_NOTES)));
    document.dispatchEvent(new CustomEvent('trasy:navigation-feedback-saved',{detail:record}));
    return record;
  }

  function formatRecord(record){
    const details=[
      `Ekran: ${record.screen}`,
      record.route&&`Trasa: ${record.route}`,
      record.shift&&`Zmiana: ${record.shift}`,
      record.vehicle&&`Pojazd: ${record.vehicle}`,
      record.nextStop&&`Następny przystanek: ${record.nextStop}`,
      record.version&&`Wersja: ${record.version}`,
      `Czas: ${record.createdAt}`
    ].filter(Boolean).join('\n');
    return `Trasy 2.0\n\n${record.text}\n\n${details}`;
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
    message.textContent='';
    button.focus();
  }

  function open(){
    dialog.hidden=false;
    message.textContent='';
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

  saveButton.onclick=()=>{
    try{
      saveNote(textarea.value);
      textarea.value='';
      message.textContent='Uwaga została zapisana na tym urządzeniu.';
    }catch(error){message.textContent=error.message}
  };

  function openWhatsAppOrSms(text){
    const phone=FEEDBACK_PHONE.replace(/\D/g,'');
    const encoded=encodeURIComponent(text);
    const whatsAppUrl=`whatsapp://send?phone=${phone}&text=${encoded}`;
    const smsUrl=`sms:${FEEDBACK_PHONE}?body=${encoded}`;
    let fallbackTimer=0;
    const cancelFallback=()=>{
      if(fallbackTimer){clearTimeout(fallbackTimer);fallbackTimer=0}
    };
    const onVisibility=()=>{
      if(document.visibilityState==='hidden')cancelFallback();
    };
    document.addEventListener('visibilitychange',onVisibility,{once:true});
    window.addEventListener('pagehide',cancelFallback,{once:true});
    fallbackTimer=setTimeout(()=>{
      fallbackTimer=0;
      if(document.visibilityState!=='hidden')window.location.assign(smsUrl);
    },2200);
    window.location.assign(whatsAppUrl);
  }

  whatsAppButton.onclick=()=>{
    try{
      const record=saveNote(textarea.value);
      const text=formatRecord(record);
      openWhatsAppOrSms(text);
      textarea.value='';
      message.textContent='Otwieram WhatsApp. Jeśli nie jest dostępny, otworzę SMS.';
    }catch(error){message.textContent=error.message||'Nie udało się otworzyć WhatsApp.'}
  };

  smsButton.onclick=()=>{
    try{
      const record=saveNote(textarea.value);
      const text=formatRecord(record);
      window.location.href=`sms:${FEEDBACK_PHONE}?body=${encodeURIComponent(text)}`;
      textarea.value='';
      message.textContent='Uwaga została zapisana. Dokończ wysyłanie w aplikacji Wiadomości.';
    }catch(error){message.textContent=error.message||'Nie udało się otworzyć wiadomości SMS.'}
  };

  shareButton.onclick=async()=>{
    try{
      const record=saveNote(textarea.value);
      const text=formatRecord(record);
      if(typeof navigator.share==='function'){
        await navigator.share({title:'Uwaga o nawigacji Trasy 2.0',text});
        message.textContent='Uwaga została zapisana i udostępniona.';
      }else if(navigator.clipboard?.writeText){
        await navigator.clipboard.writeText(text);
        message.textContent='Uwaga została zapisana i skopiowana. Możesz ją wkleić do wiadomości.';
      }else{
        message.textContent='Uwaga została zapisana na tym urządzeniu.';
      }
      textarea.value='';
    }catch(error){
      if(error?.name!=='AbortError')message.textContent=error.message||'Nie udało się udostępnić uwagi.';
    }
  };

  const nav=document.getElementById('routeMapNav');
  if(nav)new MutationObserver(updatePosition).observe(nav,{attributes:true,attributeFilter:['hidden']});
  updatePosition();

  window.__trasyNavigationFeedback={
    open,
    list:readNotes
  };
})();
