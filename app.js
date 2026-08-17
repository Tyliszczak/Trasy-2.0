import { ROUTES as FALLBACK_ROUTES } from './routes.js';
import { getRoute,getSchedule,mapUrl } from './schedule.js';

const API_URL='https://script.google.com/macros/s/AKfycbzdG_ARbbPgMdlPteqFLakZHR5EEkT4Lb3YFDbXW_I_OyrDKo8l0_KrQLjnncxj_M9q/exec';
const DATA_KEY='trasy2.routes',SYNC_KEY='trasy2.lastSuccessfulSync',FAIL_KEY='trasy2.firstFailedSync',THREE_DAYS=259200000;
const $=s=>document.querySelector(s);
const routeSelect=$('#routeSelect'),message=$('#formMessage'),connectionStatus=$('#connectionStatus'),staleWarning=$('#staleWarning');
let routes=[],syncing=false,offline=true,wakeLock=null,wakeWanted=false;

function showView(id){$('#selectionView').hidden=id!=='#selectionView';$('#scheduleView').hidden=id!=='#scheduleView';scrollTo(0,0)}
function normalizeTime(v){const s=String(v??'');const iso=s.match(/T(\d{2}):(\d{2})/);if(iso)return `${iso[1]}:${iso[2]}`;const m=s.match(/(?:^|\s)(\d{1,2}):(\d{2})(?:$|:\d{2}|\s)/);return m?`${m[1].padStart(2,'0')}:${m[2]}`:''}
function nextCourseTime(r){if(!r?.times?.length)return '';const now=new Date(),minutes=now.getHours()*60+now.getMinutes();const sorted=r.times.map(t=>({t,m:(+t.slice(0,2))*60+(+t.slice(3,5))})).filter(x=>Number.isFinite(x.m)).sort((a,b)=>a.m-b.m);return (sorted.find(x=>x.m>=minutes)||sorted[0])?.t||''}
function updateScheduleClock(){const el=$('#scheduleClock');if(!el)return;const now=new Date();el.textContent=`🕒 ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`}
updateScheduleClock();setInterval(updateScheduleClock,1000);
function renderSchedule(r,t){if(!r||!t)return;$('#scheduleRouteName').textContent=r.name;const sel=$('#scheduleTimeSelect');sel.replaceChildren(...r.times.map(x=>new Option(x,x)));sel.value=t;$('#scheduleBody').replaceChildren(...getSchedule(r,t).map(stopRow));updateScheduleClock();lastActiveStop=null;setTimeout(()=>{updateSchedulePosition();keepActiveStopVisible(true)},160)}

const scheduleStyle=document.createElement('style');
scheduleStyle.textContent=`
#scheduleBody .punctualityLamp{display:inline-flex;align-items:center;justify-content:center;margin-left:8px;padding:4px 7px;border-radius:999px;font-size:.67rem;font-weight:1000;letter-spacing:.04em;white-space:nowrap;color:#111}
#scheduleBody .punctualityLamp.onTime{background:#55ef61;box-shadow:0 0 7px #55ef61,0 0 15px #55ef61}
#scheduleBody .punctualityLamp.early{background:#ffd83d;box-shadow:0 0 7px #ffd83d,0 0 15px #ffd83d}
#scheduleBody .punctualityLamp.late{background:#ff4d4d;color:#fff;box-shadow:0 0 7px #ff4d4d,0 0 15px #ff4d4d}
#scheduleBody tr.gpsSelectedStop{outline:2px solid rgba(255,255,255,.16);outline-offset:-2px}
`;
document.head.append(scheduleStyle);

let lastActiveStop=null,activeScrollTimer=0,userScrollPauseUntil=0,recenterAfterUserTimer=0,autoScrollUntil=0;
let scheduleGpsWatch=null,lastScheduleGps=null;
function timeMinutes(v){const m=String(v||'').trim().match(/^(\d{1,2}):(\d{2})$/);return m?+m[1]*60+ +m[2]:null}
function coordValue(v){const m=String(v||'').match(/(-?\d+(?:\.\d+)?)\s*[,; ]\s*(-?\d+(?:\.\d+)?)/);return m?[+m[1],+m[2]]:null}
function distanceMeters(a,b){const R=6371000,p=Math.PI/180,dLat=(b[0]-a[0])*p,dLon=(b[1]-a[1])*p,x=Math.sin(dLat/2)**2+Math.cos(a[0]*p)*Math.cos(b[0]*p)*Math.sin(dLon/2)**2;return 2*R*Math.asin(Math.sqrt(x))}
function nowMinutes(){const n=new Date();return n.getHours()*60+n.getMinutes()+n.getSeconds()/60}
function markUserScheduleScroll(){if($('#scheduleView')?.hidden)return;userScrollPauseUntil=Date.now()+10000;clearTimeout(recenterAfterUserTimer);recenterAfterUserTimer=setTimeout(()=>{userScrollPauseUntil=0;keepActiveStopVisible(true)},10050)}
window.addEventListener('wheel',markUserScheduleScroll,{passive:true});
window.addEventListener('touchmove',markUserScheduleScroll,{passive:true});
window.addEventListener('pointerdown',e=>{if(e.pointerType==='touch'&&e.target.closest?.('#scheduleView .tableWrap'))markUserScheduleScroll()},{passive:true});
window.addEventListener('scroll',()=>{if(Date.now()>autoScrollUntil&&Date.now()>userScrollPauseUntil&& !$('#scheduleView')?.hidden)markUserScheduleScroll()},{passive:true});

function keepActiveStopVisible(force=false){
  const view=$('#scheduleView');if(!view||view.hidden)return;
  if(!force&&Date.now()<userScrollPauseUntil)return;
  const active=$('#scheduleBody tr.isActiveStop');if(!active)return;
  const rect=active.getBoundingClientRect(),vh=window.innerHeight||document.documentElement.clientHeight;
  const fullyVisible=rect.top>=Math.max(110,vh*.22)&&rect.bottom<=vh*.78;
  if(force||active!==lastActiveStop||!fullyVisible){autoScrollUntil=Date.now()+900;active.scrollIntoView({behavior:force?'smooth':'smooth',block:'center',inline:'nearest'});lastActiveStop=active}
}
function scheduleActiveStopCheck(force=false){clearTimeout(activeScrollTimer);activeScrollTimer=setTimeout(()=>keepActiveStopVisible(force),100)}

function setPunctualityLamp(row,diff){
  document.querySelectorAll('#scheduleBody .punctualityLamp').forEach(x=>x.remove());
  if(!row||!Number.isFinite(diff))return;
  const cell=row.children[1];if(!cell)return;
  const lamp=document.createElement('span');lamp.className='punctualityLamp';
  if(diff>2){lamp.classList.add('late');lamp.textContent=diff>=3?`+${Math.round(diff)} MIN`:'SPÓŹNIENIE'}
  else if(diff<-2){lamp.classList.add('early');lamp.textContent=Math.abs(diff)>=3?`${Math.round(Math.abs(diff))} MIN WCZEŚNIE`:'ZA WCZEŚNIE'}
  else{lamp.classList.add('onTime');lamp.textContent='O CZASIE'}
  cell.append(lamp)
}
function updateSchedulePosition(){
  const view=$('#scheduleView');if(!view||view.hidden)return;
  const rows=[...document.querySelectorAll('#scheduleBody tr')];if(!rows.length)return;
  const now=nowMinutes();
  let timeIndex=rows.findIndex(r=>{const t=timeMinutes(r.children[1]?.firstChild?.textContent||r.children[1]?.textContent);return t!==null&&t>=now});
  if(timeIndex<0)timeIndex=rows.length-1;
  let chosen=timeIndex,gpsChosen=false,chosenDistance=Infinity;
  if(lastScheduleGps&&lastScheduleGps.accuracy<=150){
    const here=[lastScheduleGps.lat,lastScheduleGps.lng];
    rows.forEach((r,i)=>{const c=coordValue(r.dataset.coordinate),t=timeMinutes(r.children[1]?.firstChild?.textContent||r.children[1]?.textContent);if(!c||t===null)return;const timeGap=Math.abs(t-now);if(timeGap>25)return;const d=distanceMeters(here,c);if(d<chosenDistance){chosenDistance=d;chosen=i}});
    if(chosenDistance<=700)gpsChosen=true;else chosen=timeIndex;
  }
  rows.forEach((r,i)=>{r.classList.toggle('isActiveStop',i===chosen);r.classList.toggle('gpsSelectedStop',gpsChosen&&i===chosen)});
  const active=rows[chosen],scheduled=timeMinutes(active?.children[1]?.firstChild?.textContent||active?.children[1]?.textContent);
  if(gpsChosen&&scheduled!==null)setPunctualityLamp(active,now-scheduled);else setPunctualityLamp(null,NaN);
  scheduleActiveStopCheck(active!==lastActiveStop)
}
function startScheduleGps(){
  if(scheduleGpsWatch!==null||!navigator.geolocation)return;
  scheduleGpsWatch=navigator.geolocation.watchPosition(p=>{lastScheduleGps={lat:p.coords.latitude,lng:p.coords.longitude,accuracy:p.coords.accuracy||999};updateSchedulePosition()},()=>{}, {enableHighAccuracy:true,maximumAge:1500,timeout:15000})
}
function stopScheduleGps(){if(scheduleGpsWatch!==null){navigator.geolocation.clearWatch(scheduleGpsWatch);scheduleGpsWatch=null}lastScheduleGps=null;document.querySelectorAll('#scheduleBody .punctualityLamp').forEach(x=>x.remove())}
const scheduleBodyObserverTarget=$('#scheduleBody');
if(scheduleBodyObserverTarget){new MutationObserver(mutations=>{if(mutations.some(m=>m.type==='childList'))setTimeout(updateSchedulePosition,40)}).observe(scheduleBodyObserverTarget,{childList:true,subtree:true});setInterval(()=>{updateSchedulePosition();keepActiveStopVisible(false)},1000)}

$('#scheduleTimeSelect').onchange=()=>{const r=getRoute(routes,routeSelect.value),t=$('#scheduleTimeSelect').value;if(!r||!t)return;renderSchedule(r,t)};
routeSelect.onchange=()=>{message.textContent=''};
$('#showSchedule').onclick=()=>{const r=getRoute(routes,routeSelect.value);if(!r){message.textContent='Wybierz trasę.';return}const t=nextCourseTime(r);if(!t){message.textContent='Ta trasa nie ma dostępnych godzin.';return}renderSchedule(r,t);showView('#scheduleView');startScheduleGps();setTimeout(()=>{updateSchedulePosition();keepActiveStopVisible(true)},180)};
$('#backFromSchedule').onclick=()=>{stopScheduleGps();showView('#selectionView')};
const wakeBtn=$('#wakeLockButton'),wakeLabel=$('#wakeLockLabel');wakeBtn.onclick=async()=>{wakeWanted=!wakeWanted;if(wakeWanted&&'wakeLock'in navigator){try{wakeLock=await navigator.wakeLock.request('screen')}catch{}}else if(wakeLock){try{await wakeLock.release()}catch{}wakeLock=null}wakeLabel.textContent=wakeWanted?'EKRAN ON':'EKRAN OFF'};
document.addEventListener('visibilitychange',async()=>{if(document.visibilityState==='visible'&&wakeWanted&&'wakeLock'in navigator){try{wakeLock=await navigator.wakeLock.request('screen')}catch{}}});
function normalize(data){if(!data||typeof data!=='object')return[];if(!Array.isArray(data)){const sheetRoutes=Object.entries(data).map(([name,rows])=>{if(!Array.isArray(rows)||!Array.isArray(rows[0]))return null;const headers=rows[0].map(v=>String(v??'').trim()),courseCols=[];for(let c=3;c<headers.length;c++){const t=normalizeTime(headers[c]);if(t)courseCols.push([c,t])}const times=courseCols.map(x=>x[1]);const stops=rows.slice(1).map(row=>{const stopName=String(row?.[0]??'').trim();if(!stopName)return null;const stopTimes={};courseCols.forEach(([c,t])=>{const v=normalizeTime(row?.[c]);if(v)stopTimes[t]=v});return{name:stopName,coordinates:String(row?.[1]??'').trim(),times:stopTimes}}).filter(Boolean);return{name:String(name).trim(),times,stops}}).filter(r=>r?.name);if(sheetRoutes.length)return sheetRoutes}const arr=Array.isArray(data)?data:Object.entries(data).map(([name,v])=>({...v,name:v.name??name}));return arr.map(v=>{const name=String(v.name??v.nazwa??'').trim(),raw=v.stops??v.przystanki??[],times=[...new Set((v.times??v.godziny??[]).map(String).filter(Boolean))];const stops=raw.map(s=>{const o={},src=s.times??s.godziny??{};if(Array.isArray(src))times.forEach((t,i)=>o[t]=src[i]??null);else Object.entries(src).forEach(([k,val])=>o[String(k)]=val??null);return{name:String(s.name??s.nazwa??s.przystanek??s[0]??''),coordinates:String(s.coordinates??s.lokalizacja??s.coords??s[1]??''),times:o}}).filter(s=>s.name);return{name,times,stops}}).filter(r=>r?.name)}
function valid(r){return r?.name&&r.times?.length&&r.stops?.length}

function jsonpGet(){return new Promise((resolve,reject)=>{const callback=`__trasy2_${Date.now()}_${Math.random().toString(36).slice(2)}`;const script=document.createElement('script');let done=false;const cleanup=()=>{delete window[callback];script.remove()};const timer=setTimeout(()=>{if(done)return;done=true;cleanup();reject(new Error('Przekroczono czas oczekiwania na API'))},12000);window[callback]=data=>{if(done)return;done=true;clearTimeout(timer);cleanup();resolve(data)};script.onerror=()=>{if(done)return;done=true;clearTimeout(timer);cleanup();reject(new Error('Nie udało się pobrać danych przez JSONP'))};script.src=`${API_URL}?callback=${encodeURIComponent(callback)}&t=${Date.now()}`;document.head.append(script)})}
async function fetchApiData(){let lastError;try{const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),12000);try{const res=await fetch(`${API_URL}?t=${Date.now()}`,{cache:'no-store',redirect:'follow',signal:controller.signal});if(!res.ok)throw new Error(`HTTP ${res.status}`);const data=await res.json();if(data?.status==='error')throw new Error(data.message||'API zwróciło błąd');return data}finally{clearTimeout(timer)}}catch(e){lastError=e;console.warn('Zwykłe połączenie z API nie powiodło się, próbuję JSONP:',e)}try{return await jsonpGet()}catch(e){console.error('JSONP również nie zadziałał:',e);throw lastError??e}}

async function syncRoutes(){if(syncing)return false;syncing=true;try{const p=await fetchApiData();const fresh=normalize(p?.data??p).filter(valid);if(!fresh.length)throw Error('Brak poprawnych tras w odpowiedzi API');routes=fresh;localStorage.setItem(DATA_KEY,JSON.stringify(routes));localStorage.setItem(SYNC_KEY,Date.now());localStorage.removeItem(FAIL_KEY);offline=false;renderRoutes();return true}catch(e){console.error('Synchronizacja tras:',e);offline=true;if(!localStorage.getItem(FAIL_KEY))localStorage.setItem(FAIL_KEY,Date.now());return false}finally{syncing=false;updateStatus()}}
function loadCached(){try{return JSON.parse(localStorage.getItem(DATA_KEY))}catch{return null}}
function renderRoutes(){const old=routeSelect.value;routeSelect.replaceChildren(new Option('Wybierz trasę',''));routes.filter(valid).forEach(r=>routeSelect.add(new Option(r.name,r.name)));if(routes.some(r=>valid(r)&&r.name===old))routeSelect.value=old}
function updateStatus(){connectionStatus.hidden=!offline;connectionStatus.textContent='Offline';const ref=+localStorage.getItem(SYNC_KEY)||+localStorage.getItem(FAIL_KEY)||0;staleWarning.hidden=!offline||!ref||Date.now()-ref<THREE_DAYS}
function stopRow(s){const tr=document.createElement('tr');tr.dataset.coordinate=s.coordinates||'';for(const v of [s.name,s.time??'Koniec trasy']){const td=document.createElement('td');td.textContent=v;tr.append(td)}const td=document.createElement('td'),u=mapUrl(s.coordinates);if(u){const a=document.createElement('a');a.href=u;a.className='routeLink';a.textContent='TRASA';a.setAttribute('role','button');a.setAttribute('aria-label',`Uruchom nawigację od przystanku ${s.name}`);td.append(a)}tr.append(td);return tr}
async function startApp(){const cached=loadCached();if(cached?.length){routes=cached;renderRoutes();message.textContent=''}else{routeSelect.disabled=true;message.textContent='Pobieranie aktualnych danych…'}const ok=await syncRoutes();if(!ok&&!routes.length){routes=FALLBACK_ROUTES;renderRoutes();message.textContent='Nie udało się pobrać świeżych danych. Używam zapisanej kopii.'}else if(ok)message.textContent='';routeSelect.disabled=false}
startApp();setInterval(updateStatus,60000);window.addEventListener('online',syncRoutes);window.addEventListener('focus',()=>{if(document.visibilityState==='visible'){syncRoutes();if(!$('#scheduleView')?.hidden){startScheduleGps();setTimeout(()=>{updateSchedulePosition();keepActiveStopVisible(true)},180)}}});
let promptInstall=null;window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();promptInstall=e;$('#installBanner').hidden=false});$('#installButton').onclick=async()=>{if(promptInstall){promptInstall.prompt();$('#installBanner').hidden=true}};$('#rejectInstall').onclick=()=>$('#installBanner').hidden=true;
if('serviceWorker'in navigator)window.addEventListener('load',async()=>{const reg=await navigator.serviceWorker.register('./sw.js');reg.update();$('#updateAppButton').onclick=()=>reg.waiting?.postMessage({type:'SKIP_WAITING'});navigator.serviceWorker.addEventListener('controllerchange',()=>location.reload())});