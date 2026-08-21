(()=>{
  const body=document.getElementById('scheduleBody');
  const controls=document.querySelector('#scheduleView .scheduleControls');
  const showSchedule=document.getElementById('showSchedule');
  if(!body||!controls)return;

  const label=document.createElement('label');
  label.className='deadheadRouteSwitchLabel';
  label.innerHTML='<span>NA PUSTO</span><span class="returnSwitch"><input id="deadheadRouteSwitch" type="checkbox" role="switch" aria-label="Na pusto"><span class="returnSlider"></span></span>';
  controls.append(label);

  const input=label.querySelector('#deadheadRouteSwitch');

  function restoreCoordinates(){
    body.querySelectorAll('tr').forEach(row=>{
      if(row.dataset.deadheadCoordinate===undefined)return;
      row.dataset.coordinate=row.dataset.deadheadCoordinate;
      delete row.dataset.deadheadCoordinate;
    });
  }

  function applyMode(){
    const active=input.checked;
    restoreCoordinates();

    const rows=[...body.querySelectorAll('tr')].filter(row=>row.dataset.coordinate);
    const destination=rows.at(-1);
    if(active&&destination){
      rows.forEach(row=>{
        row.classList.toggle('gpsNextStop',row===destination);
        row.classList.toggle('isActiveStop',row===destination);
      });
      body.dataset.gpsNextStop='0';
    }else{
      delete body.dataset.gpsNextStop;
      body.querySelectorAll('tr').forEach(row=>{
        row.classList.remove('gpsNextStop','isActiveStop');
      });
    }

    body.dataset.serviceMode=active?'deadhead':'regular';
    label.classList.toggle('isActive',active);
    body.dispatchEvent(new CustomEvent('deadhead-mode-change',{
      bubbles:true,
      detail:{
        active,
        serviceMode:body.dataset.serviceMode,
        destination:destination?.querySelector('td:first-child')?.innerText.trim()||''
      }
    }));
  }

  input.addEventListener('change',applyMode);
  body.addEventListener('route-direction-change',()=>{
    setTimeout(()=>{
      if(input.checked)applyMode();
    },0);
  });
  showSchedule?.addEventListener('click',()=>{
    input.checked=false;
    applyMode();
  });
  applyMode();
})();
