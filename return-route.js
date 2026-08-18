(()=>{
  const body=document.getElementById('scheduleBody');
  const controls=document.querySelector('#scheduleView .scheduleControls');
  const routeNameEl=document.getElementById('scheduleRouteName');
  const forwardTimeSelect=document.getElementById('scheduleTimeSelect');
  if(!body||!controls||!routeNameEl||!forwardTimeSelect)return;

  const API_URL='https://script.google.com/macros/s/AKfycbzdG_ARbbPgMdlPteqFLakZHR5EEkT4Lb3YFDbXW_I_OyrDKo8l0_KrQLjnncxj_M9q/exec';
  let rawData=null,direction='forward',loading=null,applying=false,forwardCourseTime='';
  let forceReturnOriginOnce=false;
  let suppressObserverUntil=0;

  const switchLabel=document.createElement('label');
  switchLabel.className='returnRouteSwitchLabel';
  switchLabel.innerHTML='<span>POWRÓT</span><span class="returnSwitch"><input id="returnRouteSwitch" type="checkbox" role="switch" aria-label="Powrót"><span class="returnSlider"></span></span>';
  controls.prepend(switchLabel);
  const returnSwitch=switchLabel.querySelector('#returnRouteSwitch');
  const returnStartLabel=document.createElement('span');
  returnStartLabel.id='returnStartLabel';returnStartLabel.hidden=true;switchLabel.after(returnStartLabel);

  const style=document.createElement('style');style.textContent='.returnRouteSwitchLabel{display:inline-flex;align-items:center;gap:5px;font-weight:900;white-space:nowrap;font-size:.82rem}.returnSwitch{position:relative;display:inline-block;width:28px;height:16px;flex:0 0 28px}.returnSwitch input{opacity:0;width:0;height:0}.returnSlider{position:absolute;inset:0;border-radius:999px;background:#555;cursor:pointer;transition:.2s}.returnSlider:before{content:"";position:absolute;width:12px;height:12px;left:2px;top:2px;border-radius:50%;background:#fff;transition:.2s;box-shadow:0 1px 3px #0008}.returnSwitch input:checked+.returnSlider{background:#22c55e}.returnSwitch input:checked+.returnSlider:before{transform:translateX(12px)}#returnStartLabel{font-weight:900;color:#ccff33;white-space:nowrap}';document.head.append(style);

  function add15(t){const m=String(t||'').match(/^(\d{1,2}):(\d{2})$/);if(!m)return'';let x=(+m[1]*60 + +m[2]+15)%(24*60);return`${String(Math.floor(x/60)).padStart(2,'0')}:${String(x%60).padStart(2,'0')}`}
  function minutesOf(t){const m=String(t||'').match(/^(\d{1,2}):(\d{2})$/);return m?+m[1]*60 + +m[2]:null}
  function resolveOutboundCourse(){const now=new Date(),current=now.getHours()*60+now.getMinutes()+now.getSeconds()/60;const times=[...forwardTimeSelect.options].map(o=>o.value).filter(Boolean).map(t=>({t,m:minutesOf(t)})).filter(x=>x.m!==null);if(!times.length)return forwardCourseTime||forwardTimeSelect.value||'';times.sort((a,b)=>Math.abs(a.m-current)-Math.abs(b.m-current)||a.m-b.m);return times[0].t}
  function jsonpGet(){return new Promise((resolve,reject)=>{const cb=`__trasyReturn_${Date.now()}_${Math.random().toString(36).slice(2)}`,script=document.createElement('script');let done=false;const clean=()=>{delete window[cb];script.remove()};const timer=setTimeout(()=>{if(done)return;done=true;clean();reject(Error('timeout'))},12000);window[cb]=d=>{if(done)return;done=true;clearTimeout(timer);clean();resolve(d)};script.onerror=()=>{if(done)return;done=true;clearTimeout(timer);clean();reject(Error('jsonp'))};script.src=`${API_URL}?callback=${encodeURIComponent(cb)}&t=${Date.now()}`;document.head.append(script)})}
  async function loadRaw(){if(rawData)return rawData;if(loading)return loading;loading=(async()=>{try{const r=await fetch(`${API_URL}?t=${Date.now()}`,{cache:'no-store',redirect:'follow'});if(!r.ok)throw Error();rawData=await r.json()}catch{rawData=await jsonpGet()}return rawData?.data??rawData})().finally(()=>loading=null);return loading}
  function tableForRoute(data,name){if(!data||!name||Array.isArray(data))return null;const exact=data[name];if(Array.isArray(exact)&&Array.isArray(exact[0]))return exact;const key=Object.keys(data).find(k=>String(k).trim().toLowerCase()===String(name).trim().toLowerCase());return key&&Array.isArray(data[key])?data[key]:null}
  function returnMapFromTable(table){if(!table?.length)return new Map();const h=table[0].map(x=>String(x??'').trim().toUpperCase());let nc=h.findIndex(x=>x.includes('PRZYSTANEK')),rc=h.findIndex(x=>x.includes('LOKALIZACJA')&&x.includes('POWR'));if(nc<0)nc=0;if(rc<0)rc=3;const map=new Map();table.slice(1).forEach(row=>{const n=String(row?.[nc]??'').trim(),c=String(row?.[rc]??'').trim();if(n&&c)map.set(n.toLowerCase(),c)});return map}
  function rowName(r){return r.querySelector('td:first-child .stopMapButton span:last-child')?.textContent.trim()||r.querySelector('td:first-child')?.innerText.trim()||''}
  function remember(r){if(r.dataset.forwardTime==null)r.dataset.forwardTime=(r.children[1]?.firstChild?.textContent||r.children[1]?.textContent||'').trim()}
  function setTime(r,t){const c=r.children[1];if(!c)return;c.querySelectorAll('.punctualityLamp,.etaPunctuality').forEach(x=>x.remove());c.textContent=t}

  async function enrichRows(){if(applying)return;const rows=[...body.querySelectorAll('tr')];if(!rows.length)return;rows.forEach((r,i)=>{if(r.dataset.routeOrder==null)r.dataset.routeOrder=String(i);if(!r.dataset.forwardCoordinate)r.dataset.forwardCoordinate=r.dataset.coordinate||'';remember(r)});try{const table=tableForRoute(await loadRaw(),routeNameEl.textContent.trim()),ret=returnMapFromTable(table);rows.forEach(r=>{const c=ret.get(rowName(r).toLowerCase());if(c)r.dataset.returnCoordinate=c})}catch(e){console.warn('Punkty powrotne:',e)}applyDirection()}

  function applyDirection(){if(applying)return;applying=true;suppressObserverUntil=Date.now()+500;try{const rows=[...body.querySelectorAll('tr')];if(!rows.length)return;rows.forEach(remember);const ordered=rows.slice().sort((a,b)=>(+a.dataset.routeOrder||0)-(+b.dataset.routeOrder||0));if(direction==='return')ordered.reverse();const start=add15(forwardCourseTime||resolveOutboundCourse());ordered.forEach((r,i)=>{r.dataset.coordinate=direction==='return'?(r.dataset.returnCoordinate||r.dataset.forwardCoordinate||''):(r.dataset.forwardCoordinate||'');setTime(r,direction==='return'?(i===0?start:''):(r.dataset.forwardTime||''));body.append(r)});forwardTimeSelect.hidden=direction==='return';returnStartLabel.hidden=direction!=='return';returnStartLabel.textContent=direction==='return'?`START ${start}`:'';body.dataset.direction=direction;body.dataset.returnStart=direction==='return'?start:'';body.dataset.outboundCourse=direction==='return'?forwardCourseTime:'';if(direction==='return'&&forceReturnOriginOnce){body.dataset.returnOriginActive='1';body.dataset.gpsNextStop='0';ordered.forEach((r,i)=>{const active=i===0;r.classList.toggle('gpsNextStop',active);r.classList.toggle('isActiveStop',active)});forceReturnOriginOnce=false}else if(direction!=='return'){body.dataset.returnOriginActive='';delete body.dataset.gpsNextStop}body.dispatchEvent(new CustomEvent('route-direction-change',{bubbles:true,detail:{direction,returnStart:start,outboundCourse:forwardCourseTime,returnOriginActive:body.dataset.returnOriginActive==='1'}}))}finally{applying=false}}

  returnSwitch.addEventListener('change',()=>{direction=returnSwitch.checked?'return':'forward';if(direction==='return'){forwardCourseTime=resolveOutboundCourse();forceReturnOriginOnce=true}applyDirection()});
  forwardTimeSelect.addEventListener('change',()=>{if(direction==='forward')forwardCourseTime=forwardTimeSelect.value});
  new MutationObserver(m=>{if(applying||Date.now()<suppressObserverUntil)return;if(m.some(x=>x.type==='childList'))setTimeout(enrichRows,60)}).observe(body,{childList:true});
  setTimeout(enrichRows,200);
})();