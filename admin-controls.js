(()=>{
  const $=s=>document.querySelector(s);

  function ensureDialog(){
    let root=$('#adminChoiceDialog');
    if(root)return root;
    root=document.createElement('div');
    root.id='adminChoiceDialog';
    root.hidden=true;
    root.innerHTML=`<div class="adminChoiceBackdrop"><div class="adminChoiceBox"><h2 id="adminChoiceTitle"></h2><div id="adminChoiceBody"></div><div class="adminChoiceActions"><button id="adminChoiceCancel" class="secondary" type="button">ANULUJ</button><button id="adminChoiceOk" class="primary" type="button">OK</button></div></div></div>`;
    const st=document.createElement('style');
    st.textContent=`#adminChoiceDialog{position:fixed;inset:0;z-index:60000}#adminChoiceDialog[hidden]{display:none!important}.adminChoiceBackdrop{position:absolute;inset:0;background:#000b;display:flex;align-items:center;justify-content:center;padding:18px}.adminChoiceBox{width:min(440px,100%);background:#202020;border:1px solid #555;border-radius:14px;padding:18px;box-shadow:0 8px 30px #000}.adminChoiceBox h2{margin:0 0 14px;text-align:center}.adminChoiceBox select,.adminChoiceBox input{width:100%;box-sizing:border-box;font-size:20px;padding:12px;margin:6px 0 12px;background:#111;color:#fff;border:1px solid #666;border-radius:8px}.adminChoiceActions{display:flex;gap:10px}.adminChoiceActions button{flex:1}.adminChoiceRow{display:grid;grid-template-columns:1fr 1fr;gap:10px}.adminChoiceHint{margin:0 0 10px;text-align:center;color:#ddd}`;
    document.head.append(st);document.body.append(root);return root;
  }

  function dialog(title,html,getValue,okText='OK'){
    const root=ensureDialog(),body=root.querySelector('#adminChoiceBody'),ok=root.querySelector('#adminChoiceOk'),cancel=root.querySelector('#adminChoiceCancel');
    root.querySelector('#adminChoiceTitle').textContent=title;body.innerHTML=html;ok.textContent=okText;root.hidden=false;
    return new Promise(resolve=>{
      const done=v=>{root.hidden=true;ok.onclick=null;cancel.onclick=null;resolve(v)};
      cancel.onclick=()=>done(null);ok.onclick=()=>done(getValue(body));
    });
  }

  function confirmDialog(title,text,okText='USUŃ'){
    return dialog(title,`<p class="adminChoiceHint">${String(text).replace(/[&<>]/g,s=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[s]))}</p>`,()=>true,okText);
  }

  async function runOriginalWithPrompt(button,value,confirmValue=true){
    const fn=button.__adminOriginalOnclick||button.onclick;if(typeof fn!=='function')return;
    const oldPrompt=window.prompt,oldConfirm=window.confirm;
    window.prompt=()=>value;window.confirm=()=>confirmValue;
    try{return await fn.call(button,new MouseEvent('click',{bubbles:true,cancelable:true}))}finally{window.prompt=oldPrompt;window.confirm=oldConfirm}
  }

  function installButtonDialogs(){
    const addCourse=$('#addCourse'),removeCourse=$('#removeCourse'),addRoute=$('#addRoute');
    if(addCourse&&typeof addCourse.onclick==='function'&&!addCourse.dataset.choiceBound){
      addCourse.dataset.choiceBound='1';addCourse.__adminOriginalOnclick=addCourse.onclick;
      addCourse.onclick=async e=>{
        e?.preventDefault();
        const opts=Array.from({length:24},(_,i)=>`<option value="${String(i).padStart(2,'0')}">${String(i).padStart(2,'0')}</option>`).join('');
        const mins=Array.from({length:60},(_,i)=>`<option value="${String(i).padStart(2,'0')}">${String(i).padStart(2,'0')}</option>`).join('');
        const v=await dialog('Dodaj kurs',`<p class="adminChoiceHint">Wybierz godzinę rozpoczęcia kursu.</p><div class="adminChoiceRow"><select id="choiceHour">${opts}</select><select id="choiceMinute">${mins}</select></div>`,b=>`${b.querySelector('#choiceHour').value}:${b.querySelector('#choiceMinute').value}`,'DODAJ');
        if(v)await runOriginalWithPrompt(addCourse,v,true);
      };
    }
    if(removeCourse&&typeof removeCourse.onclick==='function'&&!removeCourse.dataset.choiceBound){
      removeCourse.dataset.choiceBound='1';removeCourse.__adminOriginalOnclick=removeCourse.onclick;
      removeCourse.onclick=async e=>{
        e?.preventDefault();
        const times=[...($('#routeEditHead')?.querySelectorAll('th')||[])].map(x=>x.textContent.trim()).filter(x=>/^\d{1,2}:\d{2}$/.test(x));
        if(!times.length){$('#adminEditMessage').textContent='Ta trasa nie ma jeszcze kursów.';return}
        const html=`<p class="adminChoiceHint">Wybierz kurs do usunięcia.</p><select id="choiceCourse">${times.map(t=>`<option value="${t}">${t}</option>`).join('')}</select>`;
        const v=await dialog('Usuń kurs',html,b=>b.querySelector('#choiceCourse').value,'USUŃ');
        if(v)await runOriginalWithPrompt(removeCourse,v,true);
      };
    }
    if(addRoute&&typeof addRoute.onclick==='function'&&!addRoute.dataset.choiceBound){
      addRoute.dataset.choiceBound='1';addRoute.__adminOriginalOnclick=addRoute.onclick;
      addRoute.onclick=async e=>{
        e?.preventDefault();
        const v=await dialog('Dodaj trasę','<p class="adminChoiceHint">Wpisz nazwę nowej trasy.</p><input id="choiceRouteName" type="text" autocomplete="off">',b=>b.querySelector('#choiceRouteName').value.trim(),'DODAJ');
        if(v)await runOriginalWithPrompt(addRoute,v,true);
      };
    }
  }

  document.addEventListener('click',async e=>{
    const btn=e.target.closest?.('button');if(!btn)return;
    const isRouteDelete=btn.classList.contains('danger')&&btn.closest('#adminRouteList');
    const isStopDelete=btn.classList.contains('danger')&&btn.closest('#routeEditBody');
    if((isRouteDelete||isStopDelete)&&!btn.dataset.confirmPass){
      e.preventDefault();e.stopImmediatePropagation();
      const label=isRouteDelete?btn.closest('.adminCard')?.querySelector('.adminCardTitle')?.textContent.trim():btn.closest('tr')?.querySelector('.stopNameButton')?.textContent.trim();
      const ok=await confirmDialog(isRouteDelete?'Usuń trasę':'Usuń przystanek',`Czy na pewno usunąć „${label||''}”?`,'USUŃ');
      if(ok){btn.dataset.confirmPass='1';const old=window.confirm;window.confirm=()=>true;try{btn.click()}finally{window.confirm=old;delete btn.dataset.confirmPass}}
    }
  },true);

  const apply=$('#applyStopEdit');if(apply)apply.textContent='ZASTOSUJ W TABELI';
  const timer=setInterval(installButtonDialogs,100);setTimeout(()=>clearInterval(timer),10000);installButtonDialogs();
})();