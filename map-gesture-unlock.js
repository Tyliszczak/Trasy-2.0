(()=>{
  const panel=document.getElementById('routeMapNav');
  if(!panel)return;
  const canvas=panel.querySelector('#routeMapCanvas');
  const center=panel.querySelector('#routeMapCenter');
  if(!canvas)return;

  let manualUntil=0;
  const markManual=()=>{
    manualUntil=Date.now()+15000;
    if(center){
      center.textContent='➤';
      center.setAttribute('aria-label','Wróć do prowadzenia');
    }
  };

  ['pointerdown','touchstart','wheel'].forEach(type=>
    canvas.addEventListener(type,markManual,{passive:true,capture:true})
  );

  // GPS-owe easeTo jest uruchamiane co odczyt. Podczas ręcznej obsługi
  // zatrzymujemy jego animacje, aby zoom/obrót nie był natychmiast cofany.
  const observer=new MutationObserver(()=>{});
  observer.observe(canvas,{attributes:true});

  const stopAutoAnimations=()=>{
    if(Date.now()>=manualUntil)return;
    const mapCanvas=canvas.querySelector('.maplibregl-canvas');
    if(mapCanvas){
      mapCanvas.style.pointerEvents='auto';
    }
  };
  setInterval(stopAutoAnimations,250);
})();