(()=>{
  const API_URL='https://script.google.com/macros/s/AKfycbzdG_ARbbPgMdlPteqFLakZHR5EEkT4Lb3YFDbXW_I_OyrDKo8l0_KrQLjnncxj_M9q/exec';
  const CACHE_KEY='trasy2.vehicles.v2';
  const SELECTED_KEY='trasy2.selectedVehicle.v2';
  let vehicles=[];
  let bypassNextClick=false;

  function num(v){
    const n=Number(String(v??'').replace(',','.').replace(/[^0-9.\-]/g,''));
    return Number.isFinite(n)?n:null;
  }

  function parseVehicles(data){
    const rows=data?.POJAZDY;
    if(!Array.isArray(rows)||rows.length<2)return[];
    return rows.slice(1).map((row,index)=>{
      const name=String(row?.[0]??'').trim();
      const registration=String(row?.[1]??'').trim();
      if(!name&&!registration)return null;
      return {
        id:String(index+2),
        name,
        registration,
        type:String(row?.[2]??'').trim(),
        height:num(row?.[3]),
        width:num(row?.[4]),
        length:num(row?.[5]),
        weight:num(row?.[6]),
        axleLoad:num(row?.[7]),
        notes:String(row?.[8]??'').trim()
      };
    }).filter(Boolean);
  }

  function vehicleKey(v){
    return `${v.name}|${v.registration}`;
  }

  function vehicleLabel(v){
    if(v.name&&v.registration)return `${v.name} — ${v.registration}`;
    return v.name||v.registration||'Pojazd';
  }

  function saveCache(){
    try{localStorage.setItem(CACHE_KEY,JSON.stringify(vehicles))}catch{}
  }

  function loadCache(){
    try{return JSON.parse(localStorage.getItem(CACHE_KEY)||'[]')||[]}catch{return[]}
  }

  async function syncVehicles(){
    try{
      const res=await fetch(`${API_URL}?t=${Date.now()}`,{cache:'no-store'});
      if(!res.ok)throw Error(`HTTP ${res.status}`);
      const payload=await res.json();
      vehicles=parseVehicles(payload?.data??payload);
      saveCache();
      window.__trasyVehicles=vehicles;
      document.dispatchEvent(new CustomEvent('trasy:vehicles-updated',{detail:vehicles}));
      return true;
    }catch(e){
      console.warn('Pojazdy: nie udało się pobrać danych',e);
      vehicles=loadCache();
      window.__trasyVehicles=vehicles;
      return false;
    }
  }

  function ensureDialog(){
    let dlg=document.getElementById('vehicleSelectDialog');
    if(dlg)return dlg;
    dlg=document.createElement('dialog');
    dlg.id='vehicleSelectDialog';
    dlg.style.cssText='border:0;border-radius:16px;padding:0;max-width:520px;width:calc(100% - 28px);background:#181818;color:#fff;box-shadow:0 16px 60px #000a';
    dlg.innerHTML=`
      <form method="dialog" style="padding:18px">
        <h2 style="margin:0 0 12px;color:#ccff33;text-align:center">Wybierz pojazd</h2>
        <p style="margin:0 0 12px;color:#ddd;text-align:center">Którym pojazdem jedziesz?</p>
        <div id="vehicleChoices" style="display:grid;gap:9px"></div>
        <button value="cancel" type="submit" style="margin-top:14px;width:100%;padding:12px;border-radius:10px;border:1px solid #666;background:#2b2b2b;color:#fff;font-weight:800">ANULUJ</button>
      </form>`;
    document.body.append(dlg);
    return dlg;
  }

  function chooseVehicle(){
    return new Promise(resolve=>{
      const dlg=ensureDialog();
      const box=dlg.querySelector('#vehicleChoices');
      box.replaceChildren();
      const previous=localStorage.getItem(SELECTED_KEY)||'';

      if(!vehicles.length){
        const p=document.createElement('p');
        p.textContent='Brak pojazdów w karcie POJAZDY. Uzupełnij ją w Arkuszu Google.';
        p.style.cssText='margin:4px 0 8px;padding:12px;background:#2a2a2a;border-radius:10px;color:#ffcf66';
        box.append(p);
      }else{
        vehicles.forEach(v=>{
          const btn=document.createElement('button');
          btn.type='button';
          const key=vehicleKey(v);
          btn.style.cssText=`text-align:left;padding:13px;border-radius:11px;border:2px solid ${key===previous?'#ccff33':'#444'};background:#242424;color:#fff`;
          btn.innerHTML=`<strong style="display:block;font-size:17px">${escapeHtml(vehicleLabel(v))}</strong>`;
          btn.onclick=()=>{
            localStorage.setItem(SELECTED_KEY,key);
            window.__selectedVehicle=v;
            dlg.close('selected');
            resolve(v);
          };
          box.append(btn);
        });
      }

      const onClose=()=>{
        dlg.removeEventListener('close',onClose);
        if(dlg.returnValue!=='selected')resolve(null);
      };
      dlg.addEventListener('close',onClose);
      dlg.showModal();
    });
  }

  function escapeHtml(s){
    return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  document.addEventListener('click',async e=>{
    const link=e.target.closest?.('.routeLink');
    if(!link)return;
    if(bypassNextClick){bypassNextClick=false;return}
    e.preventDefault();
    e.stopImmediatePropagation();
    const selected=await chooseVehicle();
    if(!selected)return;
    bypassNextClick=true;
    link.click();
  },true);

  vehicles=loadCache();
  window.__trasyVehicles=vehicles;
  const lastKey=localStorage.getItem(SELECTED_KEY)||'';
  window.__selectedVehicle=vehicles.find(v=>vehicleKey(v)===lastKey)||null;
  syncVehicles();
  window.addEventListener('online',syncVehicles);
})();