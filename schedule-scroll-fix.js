(()=>{
  if(window.__scheduleScrollFix)return;
  window.__scheduleScrollFix=true;

  const nativeScrollIntoView=Element.prototype.scrollIntoView;
  let lastAutoRow=null;
  let lastAllowedAt=0;

  Element.prototype.scrollIntoView=function(options){
    const row=this?.matches?.('#scheduleBody tr')?this:null;

    if(!row){
      return nativeScrollIntoView.call(this,options);
    }

    // Harmonogram może sam przewinąć listę tylko wtedy, gdy faktycznie
    // zmienił się aktywny przystanek. Powtarzane centrowanie tego samego
    // wiersza (co sekundę / po odświeżeniu ETA) jest blokowane.
    const isActive=row.classList.contains('isActiveStop')||
      row.classList.contains('gpsNextStop');

    if(!isActive){
      return nativeScrollIntoView.call(this,options);
    }

    if(row===lastAutoRow){
      return;
    }

    // Ochrona przed krótkim miganiem dwóch mechanizmów wyboru aktywnego
    // przystanku. Zmiana musi utrzymać się chwilę zanim przewiniemy ekran.
    const candidate=row;
    setTimeout(()=>{
      const stillActive=candidate.classList.contains('isActiveStop')||
        candidate.classList.contains('gpsNextStop');
      if(!stillActive||candidate===lastAutoRow)return;

      lastAutoRow=candidate;
      lastAllowedAt=Date.now();
      nativeScrollIntoView.call(candidate,{
        behavior:'smooth',
        block:'nearest',
        inline:'nearest'
      });
    },350);
  };

  // Przy zmianie całego harmonogramu pozwalamy pierwszemu właściwemu
  // aktywnemu przystankowi ustawić pozycję listy od nowa.
  const body=document.getElementById('scheduleBody');
  if(body){
    new MutationObserver(mutations=>{
      const replaced=mutations.some(m=>m.type==='childList'&&m.target===body);
      if(replaced){
        lastAutoRow=null;
        lastAllowedAt=0;
      }
    }).observe(body,{childList:true});
  }
})();