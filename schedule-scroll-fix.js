(()=>{
  if(window.__scheduleScrollFix)return;
  window.__scheduleScrollFix=true;

  const nativeScrollIntoView=Element.prototype.scrollIntoView;
  let lastAutoRow=null;

  function isReallyActive(row){
    const body=document.getElementById('scheduleBody');
    if(!body)return false;
    if(body.dataset.direction==='return'){
      return row.classList.contains('gpsNextStop');
    }
    return row.classList.contains('gpsNextStop')||row.classList.contains('isActiveStop');
  }

  Element.prototype.scrollIntoView=function(options){
    const row=this?.matches?.('#scheduleBody tr')?this:null;
    if(!row)return nativeScrollIntoView.call(this,options);
    if(!isReallyActive(row))return;
    if(row===lastAutoRow)return;

    const candidate=row;
    setTimeout(()=>{
      if(!isReallyActive(candidate)||candidate===lastAutoRow)return;
      lastAutoRow=candidate;
      nativeScrollIntoView.call(candidate,{
        behavior:'smooth',
        block:'nearest',
        inline:'nearest'
      });
    },450);
  };

  const body=document.getElementById('scheduleBody');
  if(body){
    new MutationObserver(mutations=>{
      const replaced=mutations.some(m=>m.type==='childList'&&m.target===body);
      if(replaced)lastAutoRow=null;
    }).observe(body,{childList:true});
  }
})();