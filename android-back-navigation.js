(()=>{
  const selection=document.getElementById('selectionView');
  const schedule=document.getElementById('scheduleView');
  if(!selection||!schedule)return;

  let seeded=false;
  function navVisible(){const p=document.getElementById('routeMapNav');return !!p&&!p.hidden}
  function onRoot(){return !selection.hidden&&!navVisible()}
  function onSchedule(){return !schedule.hidden&&!navVisible()}

  function seed(){
    if(seeded)return;
    seeded=true;
    try{history.replaceState({trasyLevel:'root'},'',location.href)}catch{}
  }
  function push(level){
    try{history.pushState({trasyLevel:level},'',location.href)}catch{}
  }

  seed();

  const showBtn=document.getElementById('showSchedule');
  if(showBtn){
    showBtn.addEventListener('click',()=>setTimeout(()=>{if(!schedule.hidden)push('schedule')},0));
  }

  function observeNavigationPanel(nav){
    if(!nav||nav.__backHistoryObserved)return;
    nav.__backHistoryObserved=true;
    let wasVisible=!nav.hidden;
    new MutationObserver(()=>{
      const visible=!nav.hidden;
      if(visible&&!wasVisible)push('navigation');
      wasVisible=visible;
    }).observe(nav,{attributes:true,attributeFilter:['hidden']});
  }

  observeNavigationPanel(document.getElementById('routeMapNav'));
  document.addEventListener('trasy:route-map-ready',()=>{
    observeNavigationPanel(document.getElementById('routeMapNav'));
  });

  window.addEventListener('popstate',()=>{
    if(navVisible()){
      const close=document.getElementById('routeMapClose');
      if(close){close.click();return}
    }
    if(onSchedule()){
      const back=document.getElementById('backFromSchedule');
      if(back){back.click();return}
    }
    // Na ekranie głównym nie dokładamy nowego wpisu historii:
    // kolejne systemowe Wstecz może zamknąć PWA / wrócić do systemu.
  });

  // Kliknięcia przycisków aplikacji zachowują spójność ze stosem historii.
  const backSchedule=document.getElementById('backFromSchedule');
  if(backSchedule){
    const old=backSchedule.onclick;
    backSchedule.onclick=(e)=>{
      if(history.state?.trasyLevel==='schedule'){history.back();return}
      if(typeof old==='function')old.call(backSchedule,e);
    };
  }
})();
