(()=>{
  const body=document.getElementById('scheduleBody');
  const controls=document.querySelector('#scheduleView .scheduleControls');
  const routeNameEl=document.getElementById('scheduleRouteName');
  const forwardTimeSelect=document.getElementById('scheduleTimeSelect');
  if(!body||!controls||!routeNameEl)return;

  const API_URL='https://script.google.com/macros/s/AKfycbzdG_ARbbPgMdlPteqFLakZHR5EEkT4Lb3YFDbXW_I_OyrDKo8l0_KrQLjnncxj_M9q/exec';
  const RETURN_STARTS=['06:15','14:15','22:15'];
  let rawData=null,direction='forward',loading=null,applying=false;

  const switchLabel=document.createElement('label');
  switchLabel.id='returnRouteSwitchLabel';
  switchLabel.className='returnRouteSwitchLabel';
  switchLabel.innerHTML='<span>POWRÓT</span><span class="returnSwitch"><input id="returnRouteSwitch" type="checkbox" role="switch" aria-label="Powrót"><span class="returnSlider"></span></span>';
  controls.prepend(switchLabel);
  const returnSwitch=switchLabel.querySelector('#returnRouteSwitch');

  const returnTimeSelect=document.createElement('select');
  returnTimeSelect.id='returnStartSelect';
  returnTimeSelect.className='scheduleTimeSelect';
  returnTimeSelect.setAttribute('aria-label','Godzina startu powrotu');
  RETURN_STARTS.forEach(t=>returnTimeSelect.add(new Option(t,t)));
  returnTimeSelect.hidden=true;
  switchLabel.after(returnTimeSelect);

  const style=document.createElement('style');
  style.textContent='.returnRouteSwitchLabel{display:inline-flex;align-items:center;gap:8px;font-weight:900;white-space:nowrap}.returnSwitch{position:relative;display:inline-block;width:52px;height:30px}.returnSwitch input{opacity:0;width:0;height:0}.returnSlider{position:absolute;inset:0;border-radius:999px;background:#555;cursor:pointer;transition:.2s}.returnSlider:before{content:"";position:absolute;width:24px;height:24px;left:3px;top:3px;border-radius:50%;background:#fff;transition:.2s;box-shadow:0 1px 4px #0008}.returnSwitch input:checked+.returnSlider{background:#22c55e}.returnSwitch input:checked+.returnSlider:before{transform:translateX(22px)}#returnStartSelect{min-width:92px;font-weight:900}';
  document.head.append(style);

  function chooseReturnStart(){const n=new Date(),now=n.getHours()*60+n.getMinutes();const parsed=RETURN_STARTS.map(t=>({t,m:+t.slice(0,2)*60 + +t.slice(3)}));return (parsed.find(x=>x.m>=now-30)||parsed[0]).t}
  returnTimeSelect.value=chooseReturnStart();
  function jsonpGet(){return new Promise((resolve,reject)=>{const cb=`__trasyReturn_${Date.now()}_${Math.random().toString(36).slice(2)}`,script=document.createElement('script');let done=false;const clean=()=>{delete window[cb];script.remove()};const timer=setTimeout(()=>{if(done)return;done=true;clean();reject(Error('timeout'))},12000);window[cb]=d=>{if(done)return;done=true;clearTimeout(timer);clean();resolve(d)};script.onerror=()=>{if(done)return;done=true;clearTimeout(timer);clean();reject(Error('jsonp'))};script.src=`${API_URL}?callback=${encodeURIComponent(cb)}&t=${Date.now()}`;document.head.append(script)})}
  async function loadRaw(){if(rawData)return rawData;if(loading)return loading;loading=(async()=>{try{const r=await fetch(`${API_URL}?t=${Date.now()}`,{cache:'no-store',redirect:'follow'});if(!r.ok)throw Error(`HTTP ${r.status}`);rawData=await r.json()}catch{rawData=await jsonpGet()}return rawData?.data??rawData})().finally(()=>loading=null);return loading}
  function tableForRoute(data,name){if(!data||!name||Array.isArray(data))return null;const exact=data[name];if(Array.isArray(exact)&&Array.isArray(exact[0]))return exact;const key=Object.keys(data).find(k=>String(k).trim().toLowerCase()===String(name).trim().toLowerCase());return key&&Array.isArray(data[key])&&Array.isArray(data[key][0])?data[key]:null}
  function returnMapFromTable(table){if(!table?.length)return new Map();const h=table[0].map(x=>String(x??'').trim().toUpperCase());let nameCol=h.findIndex(x=>x.includes('PRZYSTANEK')),returnCol=h.findIndex(x=>x.includes('LOKALIZACJA')&&x.includes('POWR'));if(nameCol<0)nameCol=0;if(returnCol<0)returnCol=3;const map=new Map();table.slice(1).forEach(row=>{const n=String(row?.[nameCol]??'').trim(),c=String(row?.[returnCol]??'').trim();if(n&&c)map.set(n.toLowerCase(),c)});return map}
  function rowName(row){return row.querySelector('td:first-child .stopMapButton span:last-child')?.textContent.trim()||row.querySelector('td:first-child')?.innerText.trim()||''}
  function timeCell(row){return row.children[1]||null}
  function rememberForwardTime(row){const c=timeCell(row);if(!c)return;if(row.dataset.forwardTime==null)row.dataset.forwardTime=(c.firstChild?.textContent||c.textContent||'').trim()}
  function setPlainTime(row,text){const c=timeCell(row);if(!c)return;c.querySelectorAll('.punctualityLamp,.etaPunctuality').forEach(x=>x.remove());c.textContent=text}
  async function enrichRows(){if(applying)return;const rows=[...body.querySelectorAll('tr')];if(!rows.length)return;rows.forEach((r,i)=>{if(r.dataset.routeOrder==null)r.dataset.routeOrder=String(i);if(!r.dataset.forwardCoordinate)r.dataset.forwardCoordinate=r.dataset.coordinate||'';rememberForwardTime(r)});try{const data=await loadRaw(),table=tableForRoute(data,routeNameEl.textContent.trim()),ret=returnMapFromTable(table);rows.forEach(r=>{const c=ret.get(rowName(r).toLowerCase());if(c)r.dataset.returnCoordinate=c})}catch(e){console.warn('Nie udało się pobrać punktów powrotnych:',e)}applyDirection()}
  function applyDirection(){if(applying)return;applying=true;try{const rows=[...body.querySelectorAll('tr')];if(!rows.length)return;rows.forEach(rememberForwardTime);const ordered=rows.slice().sort((a,b)=>(+a.dataset.routeOrder||0)-(+b.dataset.routeOrder||0));if(direction==='return')ordered.reverse();ordered.forEach((r,i)=>{r.dataset.coordinate=direction==='return'?(r.dataset.returnCoordinate||r.dataset.forwardCoordinate||''):(r.dataset.forwardCoordinate||'');if(direction==='return')setPlainTime(r,i===0?returnTimeSelect.value:'');else setPlainTime(r,r.dataset.forwardTime||'');body.append(r)});if(forwardTimeSelect)forwardTimeSelect.hidden=direction==='return';returnTimeSelect.hidden=direction!=='return';body.dataset.direction=direction;body.dataset.returnStart=direction==='return'?returnTimeSelect.value:'';body.dispatchEvent(new CustomEvent('route-direction-change',{bubbles:true,detail:{direction,returnStart:returnTimeSelect.value}}))}finally{applying=false}}
  returnSwitch.addEventListener('change',()=>{direction=returnSwitch.checked?'return':'forward';if(direction==='return')returnTimeSelect.value=chooseReturnStart();applyDirection()});
  returnTimeSelect.addEventListener('change',applyDirection);
  new MutationObserver(m=>{if(applying)return;if(m.some(x=>x.type==='childList'))setTimeout(enrichRows,60)}).observe(body,{childList:true});
  setTimeout(enrichRows,200);
})();