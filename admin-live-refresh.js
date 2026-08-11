(()=>{
  const DATA_KEY='trasy2.routes';
  const addButton=document.getElementById('addRoute');
  const list=document.getElementById('adminRouteList');
  const loginButton=document.getElementById('adminLoginButton');
  if(!addButton||!list||!loginButton)return;

  function hasRoute(name){
    try{
      const data=JSON.parse(localStorage.getItem(DATA_KEY)||'[]');
      return Array.isArray(data)&&data.some(r=>String(r?.name||'').trim()===name);
    }catch{return false}
  }

  function addPlaceholder(name){
    if([...list.querySelectorAll('.adminCardTitle')].some(el=>el.textContent.trim()===name))return;
    const card=document.createElement('div');
    card.className='adminCard';
    card.dataset.pendingRoute=name;
    card.innerHTML='<div class="adminCardTitle"></div><div class="cardActions"><button class="editButton" disabled>EDYTUJ TRASĘ</button><button class="danger" disabled>USUŃ TRASĘ</button></div>';
    card.querySelector('.adminCardTitle').textContent=name;
    list.append(card);
  }

  function waitForRoute(name){
    const started=Date.now();
    const timer=setInterval(()=>{
      window.dispatchEvent(new Event('focus'));
      if(hasRoute(name)){
        clearInterval(timer);
        const pending=list.querySelector(`[data-pending-route="${CSS.escape(name)}"]`);
        pending?.remove();
        loginButton.click();
      }else if(Date.now()-started>15000){
        clearInterval(timer);
      }
    },800);
  }

  const hook=setInterval(()=>{
    const original=addButton.onclick;
    if(typeof original!=='function'||original.__liveRefreshWrapped)return;
    clearInterval(hook);
    const wrapped=async function(event){
      let entered='';
      const nativePrompt=window.prompt;
      window.prompt=(text,def)=>{
        const value=nativePrompt.call(window,text,def);
        if(String(text||'').startsWith('Nazwa nowej trasy'))entered=String(value||'').trim();
        return value;
      };
      try{
        await original.call(this,event);
      }finally{
        window.prompt=nativePrompt;
      }
      if(entered){
        addPlaceholder(entered);
        waitForRoute(entered);
      }
    };
    wrapped.__liveRefreshWrapped=true;
    addButton.onclick=wrapped;
  },100);
})();