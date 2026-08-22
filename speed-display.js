(()=>{
  const controls=document.querySelector('#scheduleView .scheduleControls');
  if(!controls)return;
  const style=document.createElement('style');style.textContent=`
    #scheduleSpeedBox{display:inline-flex;align-items:center;gap:8px;margin-left:auto;margin-right:2px;white-space:nowrap}
    #scheduleSpeedLimit{width:40px;height:40px;border:4px solid #e11d2e;border-radius:50%;background:#fff;color:#111;display:flex;align-items:center;justify-content:center;font:1000 17px/1 Arial,sans-serif;box-sizing:border-box}
    #scheduleCurrentSpeed{min-width:58px;text-align:center;font:1000 22px/1 Arial,sans-serif;color:#fff}
    #scheduleCurrentSpeed small{display:block;margin-top:2px;font-size:8px;color:#aaa;letter-spacing:.05em}
    #scheduleCurrentSpeed.over{color:#ff453a}
    @media(max-width:520px){#scheduleSpeedBox{gap:5px}#scheduleSpeedLimit{width:36px;height:36px;font-size:15px;border-width:3px}#scheduleCurrentSpeed{min-width:48px;font-size:19px}}
  `;document.head.append(style);
  const box=document.createElement('div');box.id='scheduleSpeedBox';box.setAttribute('aria-label','Prędkość i ograniczenie prędkości');box.innerHTML='<span id="scheduleSpeedLimit" title="Aktualne ograniczenie prędkości">—</span><span id="scheduleCurrentSpeed" title="Aktualna prędkość">0<small>km/h</small></span>';
  const returnLabel=controls.querySelector('.returnRouteSwitchLabel');if(returnLabel)controls.insertBefore(box,returnLabel);else controls.append(box);
  const limitEl=box.querySelector('#scheduleSpeedLimit'),speedEl=box.querySelector('#scheduleCurrentSpeed');
  function effectiveLimit(){const road=Number(window.__routeRoadSpeedLimitKmh);if(!Number.isFinite(road)||road<=0)return null;const v=window.__selectedVehicle;let vehicleCap=Infinity;if(v&&/bus|autobus/i.test(String(v.type||''))){const cls=String(window.__routeRoadClass||'').toLowerCase();if(cls==='motorway'||cls==='trunk'||window.__routeHighSpeedRoad===true)vehicleCap=v.bus100?100:80}return Math.min(road,vehicleCap)}
  function render(){const speed=Math.max(0,Number(window.__routeCurrentSpeedKmh)||0),limit=effectiveLimit();limitEl.textContent=limit?String(Math.round(limit)):'—';speedEl.innerHTML=`${Math.round(speed)}<small>km/h</small>`;speedEl.classList.toggle('over',!!limit&&speed>limit+2);limitEl.title=limit?`Limit dla wybranego pojazdu: ${Math.round(limit)} km/h`:'Brak wiarygodnego limitu dla tego odcinka';}
  document.addEventListener('trasy:gps-speed',render);document.addEventListener('trasy:selected-vehicle-change',render);document.addEventListener('trasy:road-speed-limit',e=>{const d=e.detail||{};window.__routeRoadSpeedLimitKmh=Number(d.maxspeed)||null;window.__routeRoadClass=d.roadClass||'';window.__routeHighSpeedRoad=!!d.highSpeedRoad;render()});setInterval(render,1000);render();
})();