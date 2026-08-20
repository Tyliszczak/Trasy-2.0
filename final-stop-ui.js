(()=>{
  const body=document.getElementById('scheduleBody');
  if(!body)return;

  const style=document.createElement('style');
  style.textContent=`
    #scheduleBody td.finalStopTime{vertical-align:middle}
    #scheduleBody .finalStopLabel{display:block;color:#fff;font-size:.82rem;font-weight:1000;letter-spacing:.035em;white-space:nowrap}
    #scheduleBody .finalStopPlan{display:block;margin-top:2px;color:#aaa;font-size:.68rem;font-weight:700;line-height:1.05;white-space:nowrap}
    #scheduleBody tr.gpsNextStop .finalStopLabel{color:#fff!important}
  `;
  document.head.append(style);

  let applying=false;
  function rows(){return [...body.querySelectorAll('tr')].filter(r=>r.dataset.coordinate)}
  function restore(row){
    const cell=row?.children?.[1];
    if(!cell||cell.dataset.finalStopPlan==null)return;
    const plan=cell.dataset.finalStopPlan;
    cell.classList.remove('finalStopTime');
    cell.textContent=plan;
    delete cell.dataset.finalStopPlan;
  }
  function mark(row){
    const cell=row?.children?.[1];
    if(!cell||cell.classList.contains('finalStopTime'))return;
    const plan=String(cell.textContent||'').trim();
    cell.dataset.finalStopPlan=plan;
    cell.classList.add('finalStopTime');
    cell.replaceChildren();
    const label=document.createElement('span');label.className='finalStopLabel';label.textContent='KONIEC TRASY';cell.append(label);
    if(plan){const small=document.createElement('small');small.className='finalStopPlan';small.textContent=plan;cell.append(small)}
  }
  function refresh(){
    if(applying)return;
    applying=true;
    try{
      const rs=rows();
      rs.forEach((r,i)=>{if(i===rs.length-1)mark(r);else restore(r)});
    }finally{applying=false}
  }
  let queued=false;
  function queueRefresh(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;refresh()})}
  new MutationObserver(mutations=>{
    if(applying)return;
    if(mutations.some(m=>[...m.addedNodes,...m.removedNodes].some(n=>n.nodeType===1&&((n.matches?.('tr'))||n.querySelector?.('tr')))))queueRefresh();
  }).observe(body,{childList:true,subtree:true});
  body.addEventListener('schedule-rendered',refresh);
  body.addEventListener('route-direction-change',queueRefresh);
  setTimeout(refresh,100);
})();
