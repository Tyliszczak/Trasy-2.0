(()=>{
  const body=document.getElementById('scheduleBody');
  if(!body)return;

  function activeRow(){
    const rows=[...body.querySelectorAll('tr')].filter(r=>r.dataset.coordinate);
    let idx=Number(body.dataset.gpsNextStop);
    if(!Number.isInteger(idx)||idx<0||idx>=rows.length){
      idx=rows.findIndex(r=>r.classList.contains('gpsNextStop'));
    }
    return rows[idx>=0?idx:0]||null;
  }

  function rowData(){
    const row=activeRow();
    if(!row)return null;
    const name=row.querySelector('td:first-child')?.childNodes[0]?.textContent?.trim()
      ||row.querySelector('td:first-child')?.innerText?.trim()
      ||'Przystanek';
    const plan=String(row.children[1]?.firstChild?.textContent||row.children[1]?.textContent||'').trim();
    return{name,plan};
  }

  function refresh(){
    const data=rowData();
    if(!data)return;
    const text=data.plan?`${data.name} • ${data.plan}`:data.name;

    document.querySelectorAll('.activeStopEtaBubble').forEach(el=>{
      if(el.textContent!==text)el.textContent=text;
    });

    const off=document.getElementById('offscreenText');
    if(off&&off.textContent!==text)off.textContent=text;
  }

  const observer=new MutationObserver(()=>queueMicrotask(refresh));
  observer.observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['class','data-gps-next-stop']});
  body.addEventListener('gps-next-stop-change',refresh);
  body.addEventListener('stop-guard-change',()=>setTimeout(refresh,0));
  setInterval(refresh,500);
  refresh();
})();
