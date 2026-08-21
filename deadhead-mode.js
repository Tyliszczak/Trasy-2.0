(()=>{
  const controls=document.querySelector('#scheduleView .scheduleControls');
  if(!controls)return;

  const label=document.createElement('label');
  label.className='deadheadRouteSwitchLabel';
  label.innerHTML='<span>NA PUSTO</span><span class="returnSwitch"><input id="deadheadRouteSwitch" type="checkbox" role="switch" aria-label="Na pusto"><span class="returnSlider"></span></span>';
  controls.append(label);
})();
