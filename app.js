import { ROUTES as FALLBACK_ROUTES } from './routes.js';
import { getRoute,getSchedule,mapUrl } from './schedule.js';

const API_URL='https://script.google.com/macros/s/AKfycbzdG_ARbbPgMdlPteqFLakZHR5EEkT4Lb3YFDbXW_I_OyrDKo8l0_KrQLjnncxj_M9q/exec';
const DATA_KEY='trasy2.routes',SYNC_KEY='trasy2.lastSuccessfulSync',FAIL_KEY='trasy2.firstFailedSync',THREE_DAYS=259200000;
const $=s=>document.querySelector(s);
const routeSelect=$('#routeSelect'),timeSelect=$('#timeSelect'),message=$('#formMessage'),connectionStatus=$('#connectionStatus'),staleWarning=$('#staleWarning');
let routes=[],syncing=false,offline=true,wakeLock=null,wakeWanted=false;

function showView(id){
  $('#selectionView').hidden=id!=='#selectionView';
  $('#scheduleView').hidden=id!=='#scheduleView';
  scrollTo(0,0);
}

function normalizeTime(v){
  const s=String(v??'');
  const iso=s.match(/T(\d{2}):(\d{2})/);
  if(iso)return `${iso[1]}:${iso[2]}`;
  const m=s.match(/(?:^|\s)(\d{1,2}):(\d{2})(?:$|:\d{2}|\s)/);
  return m?`${m[1].padStart(2,'0')}:${m[2]}`:'';
}

function updateScheduleClock(){
  const el=$('#scheduleClock');
  if(!el)return;
  const now=new Date();
  el.textContent=`🕒 ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
}
updateScheduleClock();
setInterval(updateScheduleClock,1000);

function renderSchedule(r,t){
  if(!r||!t)return;
  $('#scheduleRouteName').textContent=r.name;
  const sel=$('#scheduleTimeSelect');
  sel.replaceChildren(...r.times.map(x=>new Option(x,x)));
  sel.value=t;
  $('#scheduleBody').replaceChildren(...getSchedule(r,t).map(stopRow));
  updateScheduleClock();
}

$('#scheduleTimeSelect').onchange=()=>{
  const r=getRoute(routes,routeSelect.value),t=$('#scheduleTimeSelect').value;
  if(!r||!t)return;
  timeSelect.value=t;
  renderSchedule(r,t);
};

routeSelect.onchange=()=>{
  const r=getRoute(routes,routeSelect.value);
  timeSelect.replaceChildren(new Option(r?'Wybierz godzinę':'Najpierw wybierz trasę',''));
  timeSelect.disabled=!r;
  r?.times.forEach(t=>timeSelect.add(new Option(t,t)));
};

$('#showSchedule').onclick=()=>{
  const r=getRoute(routes,routeSelect.value),t=timeSelect.value;
  if(!r||!t){message.textContent='Wybierz trasę i godzinę zmiany.';return}
  renderSchedule(r,t);
  showView('#scheduleView');
};
$('#backFromSchedule').onclick=()=>showView('#selectionView');

const wakeBtn=$('#wakeLockButton'),wakeLabel=$('#wakeLockLabel');
wakeBtn.onclick=async()=>{
  wakeWanted=!wakeWanted;
  if(wakeWanted&&'wakeLock'in navigator){
    try{wakeLock=await navigator.wakeLock.request('screen')}catch{}
  }else if(wakeLock){
    try{await wakeLock.release()}catch{}
    wakeLock=null;
  }
  wakeLabel.textContent=wakeWanted?'EKRAN ON':'EKRAN OFF';
};

document.addEventListener('visibilitychange',async()=>{
  if(document.visibilityState==='visible'&&wakeWanted&&'wakeLock'in navigator){
    try{wakeLock=await navigator.wakeLock.request('screen')}catch{}
  }
});

function normalize(data){
  if(!data||typeof data!=='object')return[];
  if(!Array.isArray(data)){
    const sheetRoutes=Object.entries(data).map(([name,rows])=>{
      if(!Array.isArray(rows)||!Array.isArray(rows[0]))return null;
      const headers=rows[0].map(v=>String(v??'').trim());
      const courseCols=[];
      for(let c=3;c<headers.length;c++){
        const t=normalizeTime(headers[c]);
        if(t)courseCols.push([c,t]);
      }
      const times=courseCols.map(x=>x[1]);
      const stops=rows.slice(1).map(row=>{
        const stopName=String(row?.[0]??'').trim();
        if(!stopName)return null;
        const stopTimes={};
        courseCols.forEach(([c,t])=>{
          const v=normalizeTime(row?.[c]);
          if(v)stopTimes[t]=v;
        });
        return {name:stopName,coordinates:String(row?.[1]??'').trim(),times:stopTimes};
      }).filter(Boolean);
      return {name:String(name).trim(),times,stops};
    }).filter(r=>r?.name);
    if(sheetRoutes.length)return sheetRoutes;
  }
  const arr=Array.isArray(data)?data:Object.entries(data).map(([name,v])=>({...v,name:v.name??name}));
  return arr.map(v=>{
    const name=String(v.name??v.nazwa??'').trim(),raw=v.stops??v.przystanki??[],times=[...new Set((v.times??v.godziny??[]).map(String).filter(Boolean))];
    const stops=raw.map(s=>{
      const o={},src=s.times??s.godziny??{};
      if(Array.isArray(src))times.forEach((t,i)=>o[t]=src[i]??null);
      else Object.entries(src).forEach(([k,val])=>o[String(k)]=val??null);
      return {name:String(s.name??s.nazwa??s.przystanek??s[0]??''),coordinates:String(s.coordinates??s.lokalizacja??s.coords??s[1]??''),times:o};
    }).filter(s=>s.name);
    return {name,times,stops};
  }).filter(r=>r?.name);
}

function valid(r){return r?.name&&r.times?.length&&r.stops?.length}

async function syncRoutes(){
  if(syncing)return false;
  syncing=true;
  try{
    const res=await fetch(`${API_URL}?t=${Date.now()}`,{cache:'no-store'});
    if(!res.ok)throw Error(`HTTP ${res.status}`);
    const p=await res.json(),fresh=normalize(p?.data??p);
    if(!fresh.length)throw Error('Brak poprawnych tras w odpowiedzi API');
    routes=fresh;
    localStorage.setItem(DATA_KEY,JSON.stringify(routes));
    localStorage.setItem(SYNC_KEY,Date.now());
    localStorage.removeItem(FAIL_KEY);
    offline=false;
    renderRoutes();
    return true;
  }catch(e){
    console.error('Synchronizacja tras:',e);
    offline=true;
    if(!localStorage.getItem(FAIL_KEY))localStorage.setItem(FAIL_KEY,Date.now());
    return false;
  }finally{
    syncing=false;
    updateStatus();
  }
}

function loadCached(){
  try{return JSON.parse(localStorage.getItem(DATA_KEY))}catch{return null}
}

function renderRoutes(){
  const old=routeSelect.value;
  routeSelect.replaceChildren(new Option('Wybierz trasę',''));
  routes.filter(valid).forEach(r=>routeSelect.add(new Option(r.name,r.name)));
  if(routes.some(r=>valid(r)&&r.name===old))routeSelect.value=old;
}

function updateStatus(){
  connectionStatus.hidden=!offline;
  connectionStatus.textContent='Offline';
  const ref=+localStorage.getItem(SYNC_KEY)||+localStorage.getItem(FAIL_KEY)||0;
  staleWarning.hidden=!offline||!ref||Date.now()-ref<THREE_DAYS;
}

function stopRow(s){
  const tr=document.createElement('tr');
  for(const v of [s.name,s.time??'Koniec trasy']){
    const td=document.createElement('td');
    td.textContent=v;
    tr.append(td);
  }
  const td=document.createElement('td'),u=mapUrl(s.coordinates);
  if(u){
    const a=document.createElement('a');
    a.href=u;
    a.target='_blank';
    a.textContent='MAPA';
    td.append(a);
  }
  tr.append(td);
  return tr;
}

async function startApp(){
  const cached=loadCached();
  if(cached?.length){routes=cached;renderRoutes();message.textContent=''}
  else{routeSelect.disabled=true;timeSelect.disabled=true;message.textContent='Pobieranie aktualnych danych…'}
  const ok=await syncRoutes();
  if(!ok&&!routes.length){routes=FALLBACK_ROUTES;renderRoutes();message.textContent='Nie udało się pobrać świeżych danych. Używam zapisanej kopii.'}
  else if(ok)message.textContent='';
  routeSelect.disabled=false;
}
startApp();
setInterval(updateStatus,60000);
window.addEventListener('online',syncRoutes);

let promptInstall=null;
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();promptInstall=e;$('#installBanner').hidden=false});
$('#installButton').onclick=async()=>{if(promptInstall){promptInstall.prompt();$('#installBanner').hidden=true}};
$('#rejectInstall').onclick=()=>$('#installBanner').hidden=true;

if('serviceWorker'in navigator)window.addEventListener('load',async()=>{
  const reg=await navigator.serviceWorker.register('./sw.js');
  reg.update();
  $('#updateAppButton').onclick=()=>reg.waiting?.postMessage({type:'SKIP_WAITING'});
  navigator.serviceWorker.addEventListener('controllerchange',()=>location.reload());
});