import{getParkingRecords,normalizeCoordinate}from'./parking-data.js';

const service=window.__trasyRouteDataService;
const nameInput=document.getElementById('parkingName');
const routeSelect=document.getElementById('parkingRoute');
const coordinatesInput=document.getElementById('parkingCoordinates');
const passwordInput=document.getElementById('adminPassword');
const message=document.getElementById('parkingMessage');
const recordsBox=document.getElementById('parkingRecords');
const defaultPoint=[52.0,15.5];

const map=L.map('parkingMap').setView(defaultPoint,10);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap contributors'}).addTo(map);
const marker=L.marker(defaultPoint,{draggable:true}).addTo(map);

function setMessage(text,error=false){message.textContent=text;message.style.color=error?'#ff9a9a':'#ccff33'}
function setPoint(lat,lng,{center=true}={}){
  const normalized=normalizeCoordinate(`${lat}, ${lng}`);
  if(!normalized)return false;
  coordinatesInput.value=normalized;
  const point=normalized.split(',').map(Number);
  marker.setLatLng(point);
  if(center)map.setView(point,Math.max(map.getZoom(),16));
  return true;
}
function rawData(payload){return payload?.data??payload}
function routeNames(data){
  if(!data||Array.isArray(data))return[];
  return Object.entries(data)
    .filter(([key,value])=>!['PARKINGI','POJAZDY'].includes(String(key).trim().toUpperCase())&&Array.isArray(value))
    .map(([key])=>String(key).trim()).filter(Boolean).sort((a,b)=>a.localeCompare(b,'pl'));
}
function renderRoutes(data){
  const selected=routeSelect.value||'*';
  routeSelect.replaceChildren(new Option('Wszystkie trasy','*'));
  routeNames(data).forEach(route=>routeSelect.add(new Option(route,route)));
  if([...routeSelect.options].some(option=>option.value===selected))routeSelect.value=selected;
}
function chooseRecord(record){
  nameInput.value=record.name;
  routeSelect.value=[...routeSelect.options].some(option=>option.value===record.route)?record.route:'*';
  const [lat,lng]=record.coordinates.split(',').map(Number);
  setPoint(lat,lng);
}
function renderRecords(data){
  const records=getParkingRecords(data);
  recordsBox.replaceChildren(...records.map(record=>{
    const button=document.createElement('button');
    button.type='button';
    button.className='record';
    const title=document.createElement('span');title.textContent=record.name;
    const detail=document.createElement('small');detail.textContent=`${record.route==='*'?'Wszystkie trasy':record.route} • ${record.coordinates}`;
    button.append(title,detail);
    button.onclick=()=>chooseRecord(record);
    return button;
  }));
  if(!records.length){const empty=document.createElement('p');empty.className='hint';empty.textContent='Nie zapisano jeszcze żadnej Bazy ani Parkingu.';recordsBox.append(empty)}
}
async function loadData({fresh=true}={}){
  try{
    const payload=await service.load({fresh});
    const data=rawData(payload);
    renderRoutes(data);renderRecords(data);
    return data;
  }catch(error){
    const stored=rawData(service.stored?.());
    if(stored){renderRoutes(stored);renderRecords(stored);setMessage('Brak połączenia — pokazuję ostatnio pobrane dane.',true);return stored}
    setMessage('Nie udało się pobrać listy parkingów i tras.',true);
    return null;
  }
}
async function post(data){
  const response=await fetch(service.url,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(data),cache:'no-store'});
  const result=await response.json();
  if(!response.ok||result?.status!=='success')throw new Error(result?.message||`HTTP ${response.status}`);
  return result;
}

map.on('click',event=>setPoint(event.latlng.lat,event.latlng.lng,{center:false}));
marker.on('dragend',()=>{const point=marker.getLatLng();setPoint(point.lat,point.lng,{center:false})});
coordinatesInput.addEventListener('change',()=>{const normalized=normalizeCoordinate(coordinatesInput.value);if(!normalized){setMessage('Wpisz poprawne współrzędne: szerokość, długość.',true);return}const [lat,lng]=normalized.split(',').map(Number);setPoint(lat,lng)});
document.getElementById('centerMap').onclick=()=>{const normalized=normalizeCoordinate(coordinatesInput.value);if(!normalized){setMessage('Najpierw wpisz poprawną lokalizację.',true);return}const [lat,lng]=normalized.split(',').map(Number);setPoint(lat,lng)};
document.getElementById('useLocation').onclick=()=>{
  if(!navigator.geolocation){setMessage('To urządzenie nie udostępnia lokalizacji.',true);return}
  setMessage('Pobieranie lokalizacji…');
  navigator.geolocation.getCurrentPosition(position=>{setPoint(position.coords.latitude,position.coords.longitude);setMessage(`Pobrano lokalizację z dokładnością ±${Math.round(position.coords.accuracy||0)} m.`)},error=>setMessage(error.message||'Nie udało się pobrać lokalizacji.',true),{enableHighAccuracy:true,timeout:15000,maximumAge:0});
};
document.getElementById('saveParking').onclick=async()=>{
  const name=String(nameInput.value||'').trim();
  const coordinates=normalizeCoordinate(coordinatesInput.value);
  const route=routeSelect.value||'*';
  const password=passwordInput.value;
  if(!name){setMessage('Wpisz nazwę Bazy lub Parkingu.',true);nameInput.focus();return}
  if(!coordinates){setMessage('Wskaż poprawną lokalizację na mapie.',true);coordinatesInput.focus();return}
  if(!password){setMessage('Wpisz hasło administratora.',true);passwordInput.focus();return}
  const button=document.getElementById('saveParking');button.disabled=true;setMessage('Zapisywanie…');
  try{
    await post({action:'login',password});
    await post({action:'upsertParking',password,name,coordinates,route});
    service.invalidate();
    await loadData({fresh:true});
    setMessage('Zapisano Bazę/Parking. Trasy 2.0 pobiorą tę lokalizację przy synchronizacji.');
  }catch(error){setMessage(error.message||'Nie udało się zapisać parkingu.',true)}
  finally{button.disabled=false}
};

loadData();
