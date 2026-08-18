(()=>{
  const body=document.getElementById('scheduleBody');
  if(!body)return;

  const style=document.createElement('style');
  style.textContent=`
    #routeSkipStop{
      position:fixed;
      left:50%;
      bottom:76px;
      transform:translateX(-50%);
      z-index:50150;
      width:auto;
      min-width:190px;
      min-height:44px;
      padding:8px 16px;
      border:1px solid #fff8;
      border-radius:22px;
      background:#b3261e;
      color:#fff;
      box-shadow:0 3px 12px #000a;
      font-size:13px;
      font-weight:900;
    }
  `;
  document.head.appendChild(style);

  const button=document.createElement('button');
  button.id='routeSkipStop';
  button.type='button';
  button.textContent='POMIŃ TEN PRZYSTANEK';
  button.hidden=true;
  document.body.appendChild(button);

  function rows(){
    return [...body.querySelectorAll('tr')]
      .filter(r=>r.dataset.coordinate);
  }

  function currentIndex(){
    const rs=rows();
    let idx=Number(body.dataset.gpsNextStop);
    if(Number.isInteger(idx)&&idx>=0&&idx<rs.length)return idx;
    idx=rs.findIndex(r=>r.classList.contains('gpsNextStop'));
    return idx>=0?idx:0;
  }

  function overviewActive(){
    const nav=document.getElementById('routeMapNav');
    if(!nav||nav.hidden)return false;
    const center=document.getElementById('routeMapCenter');
    return !!center && center.getAttribute('aria-label')==='Wróć do prowadzenia';
  }

  function refresh(){
    const rs=rows();
    const idx=currentIndex();
    button.hidden=!(overviewActive()&&rs[idx]&&rs[idx+1]);
  }

  button.addEventListener('click',()=>{
    const rs=rows();
    const idx=currentIndex();
    if(!rs[idx+1])return;

    body.dataset.gpsNextStop=String(idx+1);
    rs.forEach((r,i)=>{
      r.classList.toggle('gpsNextStop',i===idx+1);
      r.classList.toggle('isActiveStop',i===idx+1);
    });

    const target=rs[idx+1];
    body.dispatchEvent(new CustomEvent('gps-skip-stop',{
      bubbles:true,
      detail:{index:idx+1}
    }));
    body.dispatchEvent(new CustomEvent('gps-next-stop-change',{
      bubbles:true,
      detail:{
        index:idx+1,
        name:target.children[0]?.innerText.trim()||''
      }
    }));

    button.hidden=true;
  });

  document.addEventListener('click',()=>setTimeout(refresh,0),true);
  body.addEventListener('gps-next-stop-change',()=>setTimeout(refresh,0));
  setInterval(refresh,500);
})();