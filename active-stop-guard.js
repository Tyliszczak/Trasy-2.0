(()=>{
  const body=document.getElementById('scheduleBody');
  if(!body)return;

  let syncing=false;
  function sync(){
    if(syncing)return;
    syncing=true;
    try{
      const target=body.querySelector('tr.gpsNextStop');
      body.querySelectorAll('tr.isActiveStop').forEach(row=>{
        if(row!==target)row.classList.remove('isActiveStop');
      });
      if(target&&!target.classList.contains('isActiveStop'))target.classList.add('isActiveStop');
    }finally{
      syncing=false;
    }
  }

  ['gps-next-stop-change','schedule-rendered','route-direction-change','route-mode-change'].forEach(type=>{
    body.addEventListener(type,()=>queueMicrotask(sync));
  });

  const observer=new MutationObserver(mutations=>{
    if(syncing)return;
    const needsSync=mutations.some(mutation=>
      mutation.type==='childList'||
      (mutation.type==='attributes'&&mutation.attributeName==='class')
    );
    if(needsSync)queueMicrotask(sync);
  });
  observer.observe(body,{subtree:true,childList:true,attributes:true,attributeFilter:['class']});
  sync();
})();