(()=>{
  const body=document.getElementById('scheduleBody');
  const controls=document.querySelector('#scheduleView .scheduleControls');
  const routeNameEl=document.getElementById('scheduleRouteName');
  if(!body||!controls||!routeNameEl)return;

  const API_URL='https://script.google.com/macros/s/AKfycbzdG_ARbbPgMdlPteqFLakZHR5EEkT4Lb3YFDbXW_I_OyrDKo8l0_KrQLjnncxj_M9q/exec';
  let rawData=null,direction='forward',loading=null,applying=false;

  const select=document.createElement('select');
  select.id='routeDirectionSelect';
  select.className='scheduleTimeSelect';
  select.setAttribute('aria-label','Kierunek trasy');
  select.innerHTML='<option value="forward">PRZÓD</option><option value="return">POWRÓT</option>';
  controls.prepend(select);

  const style=document.createElement('style');
  style.textContent='#routeDirectionSelect{min-width:112px;font-weight:900}';
  document.head.append(style);

  function normalizeTime(v){const s=String(v??'').trim();const m=s.match(/(?:^|\s)(\d{1,2}):(\d{2})(?:$|:\d{2}|\s)/);return m?`${m[1].padStart(2,'0')}:${m[2]}`:''}
  function jsonpGet(){return new Promise((resolve,reject)=>{const cb=`__trasyReturn_${Date.now()}_${Math.random().toString(36).slice(2)}`,script=document.createElement('script');let done=false;const clean=()=>{delete window[cb];script.remove()};const timer=setTimeout(()=>{if(done)return;done=true;clean();reject(Error('timeout'))},12000);window[cb]=d=>{if(done)return;done=true;clearTimeout(timer);clean();resolve(d)};script.onerror=()=>{if(done)return;done=true;clearTimeout(timer);clean();reject(Error('jsonp'))};script.src=`${API_URL}?callback=${encodeURIComponent(cb)}&t=${Date.now()}`;document.head.append(script)})}
  async function loadRaw(){if(rawData)return rawData;if(loading)return loading;loading=(async()=>{try{const r=await fetch(`${API_URL}?t=${Date.now()}`,{cache:'no-store',redirect:'follow'});if(!r.ok)throw Error(`HTTP ${r.status}`);rawData=await r.json()}catch{rawData=await jsonpGet()}return rawData?.data??rawData})().finally(()=>loading=null);return loading}

  function tableForRoute(data,name){
    if(!data||!name)return null;
    if(Array.isArray(data))return null;
    const exact=data[name];if(Array.isArray(exact)&&Array.isArray(exact[0]))return exact;
    const key=Object.keys(data).find(k=>String(k).trim().toLowerCase()===String(name).trim().toLowerCase());
    return key&&Array.isArray(data[key])&&Array.isArray(data[key][0])?data[key]:null;
  }
  function returnMapFromTable(table){
    if(!table?.length)return new Map();
    const h=table[0].map(x=>String(x??'').trim().toUpperCase());
    let nameCol=h.findIndex(x=>x.includes('PRZYSTANEK'));
    let returnCol=h.findIndex(x=>x.includes('LOKALIZACJA')&&x.includes('POWR'));
    if(nameCol<0)nameCol=0;if(returnCol<0)returnCol=3;
    const map=new Map();
    table.slice(1).forEach(row=>{const n=String(row?.[nameCol]??'').trim(),c=String(row?.[returnCol]??'').trim();if(n&&c)map.set(n.toLowerCase(),c)});
    return map;
  }
  function rowName(row){return row.querySelector('td:first-child .stopMapButton span:last-child')?.textContent.trim()||row.querySelector('td:first-child')?.innerText.trim()||''}

  async function enrichRows(){
    if(applying)return;
    const rows=[...body.querySelectorAll('tr')];if(!rows.length)return;
    rows.forEach((r,i)=>{if(r.dataset.routeOrder==null)r.dataset.routeOrder=String(i);if(!r.dataset.forwardCoordinate)r.dataset.forwardCoordinate=r.dataset.coordinate||''});
    try{
      const data=await loadRaw(),table=tableForRoute(data,routeNameEl.textContent.trim()),ret=returnMapFromTable(table);
      rows.forEach(r=>{const c=ret.get(rowName(r).toLowerCase());if(c)r.dataset.returnCoordinate=c});
    }catch(e){console.warn('Nie udało się pobrać punktów powrotnych:',e)}
    applyDirection();
  }

  function applyDirection(){
    if(applying)return;applying=true;
    try{
      const rows=[...body.querySelectorAll('tr')];if(!rows.length)return;
      const ordered=rows.slice().sort((a,b)=>(+a.dataset.routeOrder||0)-(+b.dataset.routeOrder||0));
      if(direction==='return')ordered.reverse();
      ordered.forEach(r=>{
        r.dataset.coordinate=direction==='return'?(r.dataset.returnCoordinate||r.dataset.forwardCoordinate||''):(r.dataset.forwardCoordinate||'');
        body.append(r);
      });
      body.dataset.direction=direction;
      body.dispatchEvent(new CustomEvent('route-direction-change',{bubbles:true,detail:{direction}}));
    }finally{applying=false}
  }

  select.addEventListener('change',()=>{direction=select.value;applyDirection()});
  new MutationObserver(m=>{if(applying)return;if(m.some(x=>x.type==='childList'))setTimeout(enrichRows,60)}).observe(body,{childList:true});
  setTimeout(enrichRows,200);
})();