import { ROUTES as FALLBACK_ROUTES } from './routes.js';
import { getRoute,getSchedule,mapUrl } from './schedule.js';
import { normalizeClockTime,nearestFutureTime } from './schedule-time.js';

const DATA_KEY='trasy2.routes',SYNC_KEY='trasy2.lastSuccessfulSync',FAIL_KEY='trasy2.firstFailedSync',THREE_DAYS=259200000;
const $=s=>document.querySelector(s);
const routeSelect=$('#routeSelect'),message=$('#formMessage'),connectionStatus=$('#connectionStatus'),staleWarning=$('#staleWarning');
let routes=[],syncing=false,offline=true;

function showView(id){$('#selectionView').hidden=id!=='#selectionView';$('#scheduleView').hidden=id!=='#scheduleView';scrollTo(0,0)}
const normalizeTime=normalizeClockTime;
function nextCourseTime(r){return nearestFutureTime(r?.times||[],new Date())}
function renderSchedule(r,t){if(!r||!t)return;$('#scheduleRouteName').textContent=r.name;const sel=$('#scheduleTimeSelect');sel.replaceChildren(...r.times.map(x=>new Option(x,x)));sel.value=t;$('#scheduleBody').replaceChildren(...getSchedule(r,t).map(stopRow));lastActiveStop=null;setTimeout(()=>$('#scheduleBody').dispatchEvent(new CustomEvent('schedule-rendered',{bubbles:true})),0)}

let lastActiveStop=null;
function keepActiveStopVisible(){const view=$('#scheduleView'),active=$('#scheduleBody tr.gpsNextStop');if(!view||view.hidden||!active||active===lastActiveStop)return;lastActiveStop=active;active.scrollIntoView({behavior:'smooth',block:'center',inline:'nearest'})}
$('#scheduleBody').addEventListener('gps-next-stop-change',keepActiveStopVisible);
$('#scheduleTimeSelect').onchange=()=>{const r=getRoute(routes,routeSelect.value),t=$('#scheduleTimeSelect').value;if(!r||!t)return;renderSchedule(r,t)};
routeSelect.onchange=()=>{message.textContent=''};
$('#showSchedule').onclick=()=>{const r=getRoute(routes,routeSelect.value);if(!r){message.textContent='Wybierz trasę.';return}const t=nextCourseTime(r);if(!t){message.textContent='Ta trasa nie ma dostępnych godzin.';return}renderSchedule(r,t);showView('#scheduleView')};
$('#backFromSchedule').onclick=()=>{showView('#selectionView')};
function normalize(data){if(!data||typeof data!=='object')return[];if(!Array.isArray(data)){const sheetRoutes=Object.entries(data).map(([name,rows])=>{if(!Array.isArray(rows)||!Array.isArray(rows[0]))return null;const headers=rows[0].map(v=>String(v??'').trim()),courseCols=[];for(let c=3;c<headers.length;c++){const t=normalizeTime(headers[c]);if(t)courseCols.push([c,t])}const times=courseCols.map(x=>x[1]);const stops=rows.slice(1).map((row,index)=>{const stopName=String(row?.[0]??'').trim();if(!stopName)return null;const stopTimes={};courseCols.forEach(([c,t])=>{const v=normalizeTime(row?.[c]);if(v)stopTimes[t]=v});return{id:String(index),name:stopName,coordinates:String(row?.[1]??'').trim(),returnCoordinates:String(row?.[2]??row?.[1]??'').trim(),times:stopTimes}}).filter(Boolean);return{name:String(name).trim(),times,stops}}).filter(r=>r?.name);if(sheetRoutes.length)return sheetRoutes}const arr=Array.isArray(data)?data:Object.entries(data).map(([name,v])=>({...v,name:v.name??name}));return arr.map(v=>{const name=String(v.name??v.nazwa??'').trim(),raw=v.stops??v.przystanki??[],times=[...new Set((v.times??v.godziny??[]).map(String).filter(Boolean))];const stops=raw.map((s,index)=>{const o={},src=s.times??s.godziny??{};if(Array.isArray(src))times.forEach((t,i)=>o[t]=src[i]??null);else Object.entries(src).forEach(([k,val])=>o[String(k)]=val??null);const coordinates=String(s.coordinates??s.lokalizacja??s.coords??s[1]??'');return{id:String(s.id??s.stopId??s.kod??index),name:String(s.name??s.nazwa??s.przystanek??s[0]??''),coordinates,returnCoordinates:String(s.returnCoordinates??s.locationReturn??s.lokalizacjaPowrot??coordinates),times:o}}).filter(s=>s.name);return{id:String(v.id??''),name,times,stops}}).filter(r=>r?.name)}
function valid(r){return r?.name&&r.times?.length&&r.stops?.length}
function fetchApiData(){return window.__trasyRouteDataService.load({fresh:true})}
async function syncRoutes(){if(syncing)return false;syncing=true;try{const p=await fetchApiData();const fresh=normalize(p?.data??p).filter(valid);if(!fresh.length)throw Error('Brak poprawnych tras w odpowiedzi API');routes=fresh;localStorage.setItem(DATA_KEY,JSON.stringify(routes));localStorage.setItem(SYNC_KEY,Date.now());localStorage.removeItem(FAIL_KEY);offline=false;renderRoutes();return true}catch(e){console.error('Synchronizacja tras:',e);offline=true;if(!localStorage.getItem(FAIL_KEY))localStorage.setItem(FAIL_KEY,Date.now());return false}finally{syncing=false;updateStatus()}}
function loadCached(){try{return JSON.parse(localStorage.getItem(DATA_KEY))}catch{return null}}
function renderRoutes(){const old=routeSelect.value;routeSelect.replaceChildren(new Option('Wybierz trasę',''));routes.filter(valid).forEach(r=>routeSelect.add(new Option(r.name,r.name)));if(routes.some(r=>valid(r)&&r.name===old))routeSelect.value=old}
function updateStatus(){connectionStatus.hidden=!offline;connectionStatus.textContent='Offline';const ref=+localStorage.getItem(SYNC_KEY)||+localStorage.getItem(FAIL_KEY)||0;staleWarning.hidden=!offline||!ref||Date.now()-ref<THREE_DAYS}
function routeIcon(){const span=document.createElement('span');span.className='stopRouteIcon';span.setAttribute('aria-hidden','true');span.innerHTML='<svg viewBox="0 0 32 26"><path d="M7 4c-2.5 0-4.5 2-4.5 4.5C2.5 12 7 16 7 16s4.5-4 4.5-7.5C11.5 6 9.5 4 7 4Z"/><circle cx="7" cy="8.5" r="1.5"/><path d="M9.5 16.5c3.5 2.5 6.5-2.5 9.5 0s4.5 1.5 5.5-.5"/><path d="M25 10c-2.5 0-4.5 2-4.5 4.5C20.5 18 25 22 25 22s4.5-4 4.5-7.5C29.5 12 27.5 10 25 10Z"/><circle cx="25" cy="14.5" r="1.5"/></svg>';return span}
function stopRow(s){const tr=document.createElement('tr');tr.dataset.coordinate=s.coordinates||'';tr.dataset.returnCoordinate=s.returnCoordinates||s.coordinates||'';tr.dataset.stopId=String(s.id??'');for(const v of [s.name,s.time??'Koniec trasy']){const td=document.createElement('td');td.textContent=v;tr.append(td)}const td=document.createElement('td'),u=mapUrl(s.coordinates);if(u){const a=document.createElement('a');a.href=u;a.className='routeLink routeIconLink';a.title='Pokaż trasę';a.setAttribute('role','button');a.setAttribute('aria-label',`Uruchom nawigację od przystanku ${s.name}`);a.append(routeIcon());td.append(a)}tr.append(td);return tr}
async function startApp(){const cached=loadCached();if(cached?.length){routes=cached;renderRoutes();message.textContent=''}else{routes=FALLBACK_ROUTES.filter(valid);renderRoutes();message.textContent='Tryb testowy — trwa sprawdzanie aktualnych danych firmy.'}routeSelect.disabled=false;const ok=await syncRoutes();if(!ok){if(!routes.length){routes=FALLBACK_ROUTES.filter(valid);renderRoutes()}message.textContent='Tryb testowy — bezpieczne dane firmy pojawią się po uruchomieniu z panelu kierowcy.'}else message.textContent=''}
startApp();setInterval(updateStatus,60000);window.addEventListener('online',syncRoutes);window.addEventListener('focus',()=>{if(document.visibilityState==='visible')syncRoutes()});
let promptInstall=null;window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();promptInstall=e;$('#installBanner').hidden=false});$('#installButton').onclick=async()=>{if(promptInstall){promptInstall.prompt();$('#installBanner').hidden=true}};$('#rejectInstall').onclick=()=>$('#installBanner').hidden=true;
if('serviceWorker'in navigator)window.addEventListener('load',async()=>{
  const notice=$('#updateNotice');
  const updateButton=$('#updateAppButton');
  let updateRequested=false;
  try{
    const reg=await navigator.serviceWorker.register('./sw.js');
    const showUpdate=()=>{
      if(reg.waiting)notice.hidden=false;
    };
    showUpdate();
    reg.addEventListener('updatefound',()=>{
      const worker=reg.installing;
      worker?.addEventListener('statechange',()=>{
        if(worker.state==='installed'&&navigator.serviceWorker.controller)showUpdate();
      });
    });
    updateButton.onclick=()=>{
      if(!reg.waiting)return;
      updateRequested=true;
      updateButton.disabled=true;
      reg.waiting.postMessage({type:'SKIP_WAITING'});
    };
    navigator.serviceWorker.addEventListener('controllerchange',()=>{
      if(updateRequested)location.reload();
    });
    if(navigator.onLine)reg.update().catch(error=>console.warn('Sprawdzenie aktualizacji PWA:',error));
  }catch(error){
    console.warn('Uruchomienie PWA:',error);
  }
});
