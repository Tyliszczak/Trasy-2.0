(()=>{
  const body=document.getElementById('scheduleBody');
  if(!body)return;

  const style=document.createElement('style');
  style.textContent=`
    #scheduleBody td.routeRoleTime{vertical-align:middle}
    #scheduleBody .routeRoleLabel{display:block;color:#fff;font-size:.82rem;font-weight:1000;letter-spacing:.035em;white-space:nowrap}
    #scheduleBody .routeRolePlan{display:block;margin-top:2px;color:#aaa;font-size:.68rem;font-weight:700;line-height:1.05;white-space:nowrap}
    #scheduleBody .routeRoleLabel.start{color:#ccff33}
    #scheduleBody tr.gpsNextStop .routeRoleLabel{color:#fff!important}
    #scheduleBody tr.gpsNextStop .routeRoleLabel.start{color:#ccff33!important}
  `;
  document.head.append(style);

  let applying=false;
  function rows(){return [...body.querySelectorAll('tr')].filter(r=>r.dataset.coordinate)}
  function restore(row){
    const cell=row?.children?.[1];
    if(!cell||!cell.dataset.routeRole)return;
    const plan=cell.dataset.routeRolePlan||'';
    cell.classList.remove('routeRoleTime','finalStopTime');
    cell.textContent=plan;
    delete cell.dataset.routeRole;
    delete cell.dataset.routeRolePlan;
    delete cell.dataset.finalStopPlan;
  }
  function mark(row,label,role){
    const cell=row?.children?.[1];
    if(!cell)return;
    if(cell.dataset.routeRole===role&&cell.querySelector('.routeRoleLabel'))return;
    let plan='';
    if(cell.dataset.routeRole&&cell.querySelector('.routeRoleLabel'))plan=cell.dataset.routeRolePlan||'';
    else plan=String(cell.textContent||'').trim();
    cell.dataset.routeRole=role;
    cell.dataset.routeRolePlan=plan;
    cell.classList.remove('finalStopTime');
    cell.classList.add('routeRoleTime');
    cell.replaceChildren();
    const roleLabel=document.createElement('span');
    roleLabel.className=`routeRoleLabel ${role==='start'?'start':'end'}`;
    roleLabel.textContent=label;
    cell.append(roleLabel);
    if(plan){const small=document.createElement('small');small.className='routeRolePlan';small.textContent=plan;cell.append(small)}
  }
  function refresh(){
    if(applying)return;
    applying=true;
    try{
      const rs=rows();
      if(!rs.length)return;
      const isReturn=body.dataset.direction==='return';
      rs.forEach((r,i)=>{
        if(isReturn&&i===0)mark(r,'START','start');
        else if(i===rs.length-1)mark(r,'KONIEC TRASY','end');
        else restore(r);
      });
    }finally{applying=false}
  }
  let queued=false;
  function queueRefresh(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;refresh()})}
  new MutationObserver(mutations=>{
    if(applying)return;
    if(mutations.some(m=>[...m.addedNodes,...m.removedNodes].some(n=>n.nodeType===1&&((n.matches?.('tr'))||n.querySelector?.('tr')))))queueRefresh();
  }).observe(body,{childList:true,subtree:true});
  body.addEventListener('schedule-rendered',refresh);
  body.addEventListener('route-direction-change',()=>setTimeout(refresh,0));
  setTimeout(refresh,100);
})();
