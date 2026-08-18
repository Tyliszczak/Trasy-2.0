(()=>{
  function setup(){
    const root=document.getElementById('routeNavRoot');
    if(!root)return false;

    const close=root.querySelector('#routeMapClose');
    const center=root.querySelector('#routeMapCenter');
    const canvas=root.querySelector('#routeMapCanvas');
    if(!close||!center||!canvas)return false;

    const topbar=close.parentElement;
    const title=[...topbar.children].find(x=>x.tagName==='STRONG');
    if(title)title.remove();

    topbar.style.position='absolute';
    topbar.style.left='8px';
    topbar.style.top='8px';
    topbar.style.zIndex='50040';
    topbar.style.padding='0';
    topbar.style.background='transparent';
    topbar.style.border='0';

    close.textContent='←';
    close.setAttribute('aria-label','Zakończ nawigację');
    close.title='Zakończ nawigację';
    close.style.cssText='width:42px;min-width:42px;height:42px;min-height:42px;padding:0;border-radius:50%;background:#111d;color:#fff;font-size:28px;line-height:42px;box-shadow:0 2px 8px #0008';

    center.style.display='none';

    const toggle=document.createElement('button');
    toggle.type='button';
    toggle.id='routeViewToggle';
    toggle.textContent='⌖';
    toggle.title='Pokaż mapę z góry';
    toggle.setAttribute('aria-label','Pokaż mapę z góry');
    toggle.style.cssText='position:absolute;right:14px;bottom:86px;z-index:50050;width:48px;height:48px;min-height:48px;padding:0;border-radius:50%;background:#111e;color:#fff;border:1px solid #fff7;font-size:25px;box-shadow:0 3px 10px #0009';
    root.appendChild(toggle);

    let overview=false;
    toggle.onclick=()=>{
      const compass=canvas.querySelector('.maplibregl-ctrl-compass');
      if(!overview){
        overview=true;
        center.click();
        if(compass)compass.click();
        const pitchButton=canvas.querySelector('.maplibregl-ctrl-pitch');
        if(pitchButton)pitchButton.click();
        toggle.textContent='➤';
        toggle.title='Wróć do prowadzenia';
        toggle.setAttribute('aria-label','Wróć do prowadzenia');
      }else{
        overview=false;
        center.click();
        toggle.textContent='⌖';
        toggle.title='Pokaż mapę z góry';
        toggle.setAttribute('aria-label','Pokaż mapę z góry');
      }
    };

    const observer=new MutationObserver(()=>{
      if(root.closest('#routeMapNav')?.hidden)return;
      if(!overview)return;
      // Ręczne wznowienie przez ukryty mechanizm centrujący przywraca tryb prowadzenia.
    });
    observer.observe(root,{attributes:true,subtree:true});
    return true;
  }

  if(!setup()){
    const timer=setInterval(()=>{if(setup())clearInterval(timer)},100);
    setTimeout(()=>clearInterval(timer),10000);
  }
})();
