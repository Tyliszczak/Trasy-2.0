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
    #finalCourseDialog[hidden]{display:none!important}
    #finalCourseDialog{position:fixed;inset:0;z-index:120000;display:flex;align-items:center;justify-content:center;padding:18px;background:#000d}
    .finalCourseCard{width:min(100%,480px);padding:20px 18px;border:2px solid #ccff33;border-radius:16px;background:#202020;box-shadow:0 14px 44px #000;text-align:center}
    .finalCourseCard h2{margin:0 0 8px;color:#ccff33;font-size:1.35rem}
    .finalCourseCard p{margin:0 0 18px;color:#ddd;font-size:.95rem;line-height:1.35}
    .finalCourseActions{display:grid;gap:10px}
    .finalCourseActions button{min-height:52px;margin:0;padding:9px 12px;border:1px solid #666;border-radius:8px;background:#333;color:#fff;font-size:1rem;font-weight:1000}
    .finalCourseActions .returnAction{background:#ccff33;color:#101010;border-color:#ccff33}
    .finalCourseActions .emptyAction{background:#315b37;color:#fff;border-color:#4d8757}
    .finalCourseActions .closeAction{background:#4b2525;color:#fff;border-color:#7b3a3a}
    #appClosedScreen[hidden]{display:none!important}
    #appClosedScreen{position:fixed;inset:0;z-index:130000;display:grid;place-items:center;padding:24px;background:#171717;color:#fff;text-align:center}
    #appClosedScreen strong{display:block;color:#ccff33;font-size:1.45rem;margin-bottom:8px}
    #appClosedScreen span{color:#bbb;font-size:.95rem;line-height:1.35}
  `;
  document.head.append(style);

  let applying=false;
  let handledArrivalKey='';

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

  function ensureDialog(){
    let dialog=document.getElementById('finalCourseDialog');
    if(dialog)return dialog;
    dialog=document.createElement('div');
    dialog.id='finalCourseDialog';
    dialog.hidden=true;
    dialog.innerHTML=`
      <div class="finalCourseCard" role="dialog" aria-modal="true" aria-labelledby="finalCourseTitle">
        <h2 id="finalCourseTitle">KONIEC TRASY</h2>
        <p>Dojechałeś do ostatniego punktu. Wybierz dalszą czynność.</p>
        <div class="finalCourseActions">
          <button type="button" class="returnAction">USTAW TRASĘ POWROTNĄ</button>
          <button type="button" class="emptyAction">POWRÓT NA PUSTO</button>
          <button type="button" class="closeAction">ZAMKNIJ APLIKACJĘ</button>
        </div>
      </div>`;
    document.body.append(dialog);
    return dialog;
  }

  function setReturnMode(empty=false){
    const returnSwitch=document.getElementById('returnRouteSwitch');
    const emptySwitch=document.getElementById('emptyRouteSwitch');
    if(!returnSwitch)return false;

    if(!returnSwitch.checked){
      returnSwitch.checked=true;
      returnSwitch.dispatchEvent(new Event('change',{bubbles:true}));
    }

    if(empty&&emptySwitch&&!emptySwitch.checked){
      queueMicrotask(()=>{
        emptySwitch.checked=true;
        emptySwitch.dispatchEvent(new Event('change',{bubbles:true}));
      });
    }
    return true;
  }

  function fallbackClosedScreen(){
    if(document.visibilityState==='hidden')return;
    let screen=document.getElementById('appClosedScreen');
    if(!screen){
      screen=document.createElement('div');
      screen.id='appClosedScreen';
      screen.innerHTML='<div><strong>TRASY 2.0 ZAKOŃCZONE</strong><span>System nie pozwolił stronie samodzielnie zamknąć okna. Możesz teraz zamknąć aplikację przyciskiem systemowym.</span></div>';
      document.body.append(screen);
    }
    screen.hidden=false;
  }

  function closeApplication(){
    try{window.__trasyWakeLock?.setNavigation(false)}catch{}
    try{window.close()}catch{}
    setTimeout(fallbackClosedScreen,300);
  }

  function showFinalChoice(arrival){
    const dialog=ensureDialog();
    const returnButton=dialog.querySelector('.returnAction');
    const emptyButton=dialog.querySelector('.emptyAction');
    const closeButton=dialog.querySelector('.closeAction');

    returnButton.onclick=()=>{
      dialog.hidden=true;
      setReturnMode(false);
    };
    emptyButton.onclick=()=>{
      dialog.hidden=true;
      setReturnMode(true);
    };
    closeButton.onclick=()=>{
      dialog.hidden=true;
      closeApplication();
    };

    dialog.hidden=false;
    returnButton.focus();
    document.dispatchEvent(new CustomEvent('trasy:final-course-choice-open',{detail:arrival||{}}));
  }

  function handleFinalArrival(arrival){
    if(!arrival?.final)return;
    if(arrival.direction==='return'||arrival.emptyRun)return;
    const key=String(arrival.key||`${arrival.index}:${arrival.coordinate||''}`);
    if(handledArrivalKey===key)return;
    handledArrivalKey=key;

    /* Zatrzymaj aktywną nawigację dokładnie tą samą ścieżką co przycisk ZAKOŃCZ. */
    const navClose=document.getElementById('routeMapClose');
    if(navClose&&document.getElementById('routeMapNav')?.hidden===false)navClose.click();
    try{speechSynthesis?.cancel?.()}catch{}
    setTimeout(()=>showFinalChoice(arrival),0);
  }

  let queued=false;
  function queueRefresh(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;refresh()})}
  new MutationObserver(mutations=>{
    if(applying)return;
    if(mutations.some(m=>[...m.addedNodes,...m.removedNodes].some(n=>n.nodeType===1&&((n.matches?.('tr'))||n.querySelector?.('tr')))))queueRefresh();
  }).observe(body,{childList:true,subtree:true});
  body.addEventListener('schedule-rendered',()=>{handledArrivalKey='';refresh()});
  body.addEventListener('route-direction-change',()=>{handledArrivalKey='';setTimeout(refresh,0)});
  body.addEventListener('gps-stop-arrival',event=>handleFinalArrival(event.detail));
  setTimeout(refresh,100);
})();
