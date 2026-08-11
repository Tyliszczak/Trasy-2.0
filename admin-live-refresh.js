(()=>{
  const DATA_KEY='trasy2.routes';
  const addButton=document.getElementById('addRoute');
  const list=document.getElementById('adminRouteList');
  const loginButton=document.getElementById('adminLoginButton');
  const routeSelect=document.getElementById('routeSelect');
  if(!addButton||!list||!loginButton||!routeSelect)return;

  function cachedRoutes(){
    try{
      const data=JSON.parse(localStorage.getItem(DATA_KEY)||'[]');
      return Array.isArray(data)?data:[];
    }catch{return []}
  }

  function hasRoute(name){
    return cachedRoutes().some(r=>String(r?.name||'').trim()===name);
  }

  function refreshDriverRouteList(){
    const data=cachedRoutes();
    const current=routeSelect.value;
    const existing=new Set([...routeSelect.options].map(o=>o.value));
    for(const route of data){
      const name=String(route?.name||'').trim();
      if(!name||existing.has(name))continue;
      routeSelect.add(new Option(name,name));
      existing.add(name);
    }
    if(current&&existing.has(current))routeSelect.value=current;
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
      refreshDriverRouteList();
      if(hasRoute(name)){
        clearInterval(timer);
        const pending=list.querySelector(`[data-pending-route="${CSS.escape(name)}"]`);
        pending?.remove();
        loginButton.click();
        refreshDriverRouteList();
      }else if(Date.now()-started>15000){
        clearInterval(timer);
      }
    },800);
  }

  const routeObserver=new MutationObserver(()=>setTimeout(refreshDriverRouteList,0));
  routeObserver.observe(routeSelect,{childList:true});
  window.addEventListener('focus',()=>setTimeout(refreshDriverRouteList,250));
  window.addEventListener('storage',e=>{if(e.key===DATA_KEY)refreshDriverRouteList()});
  setInterval(refreshDriverRouteList,1500);
  refreshDriverRouteList();

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

  if(!document.querySelector('script[data-admin-controls]')){
    const s=document.createElement('script');
    s.src='./admin-controls.js?v=1';
    s.dataset.adminControls='1';
    document.body.appendChild(s);
  }
})();