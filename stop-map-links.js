(()=>{
  const body=document.getElementById('scheduleBody');
  if(!body)return;

  const style=document.createElement('style');
  style.textContent=`
    #scheduleBody td:first-child{cursor:pointer}
    #scheduleBody td:first-child:hover{text-decoration:underline;text-decoration-color:#777;text-underline-offset:3px}
  `;
  document.head.append(style);

  function parseCoord(v){
    const m=String(v||'').match(/(-?\d+(?:\.\d+)?)\s*[,; ]\s*(-?\d+(?:\.\d+)?)/);
    return m?[+m[1],+m[2]]:null;
  }

  body.addEventListener('click',e=>{
    const cell=e.target.closest?.('td:first-child');
    if(!cell||!body.contains(cell))return;
    if(e.target.closest?.('.etaPunctuality,.stopGuardNotice,button,a,input,select'))return;
    const row=cell.closest('tr');
    const c=parseCoord(row?.dataset.coordinate);
    if(!c)return;
    const url=`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${c[0]},${c[1]}`)}`;
    window.open(url,'_blank','noopener,noreferrer');
  });
})();
