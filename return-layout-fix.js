(()=>{
  const heading=document.querySelector('#scheduleView .scheduleHeading');
  const titleBlock=document.querySelector('#scheduleView .scheduleTitleBlock');
  const controls=document.querySelector('#scheduleView .scheduleControls');
  const timeSelect=document.getElementById('scheduleTimeSelect');
  const clock=document.getElementById('scheduleClock');
  const returnStart=document.getElementById('returnStartLabel');
  const returnSwitch=document.querySelector('#scheduleView .returnRouteSwitchLabel');

  if(!heading||!titleBlock||!controls||!timeSelect||!clock||!returnStart||!returnSwitch)return;

  let primaryTime=controls.querySelector('.schedulePrimaryTime');
  if(!primaryTime){
    primaryTime=document.createElement('div');
    primaryTime.className='schedulePrimaryTime';
  }

  primaryTime.replaceChildren(timeSelect,returnStart);
  controls.classList.add('scheduleControlBlock');
  controls.replaceChildren(primaryTime,clock,returnSwitch);

  const style=document.createElement('style');
  style.id='scheduleControlLayoutV2';
  style.textContent=`
    #scheduleView .scheduleHeading{
      display:grid!important;
      grid-template-columns:38px minmax(0,1fr) minmax(126px,32%)!important;
      grid-template-rows:auto auto!important;
      align-items:start!important;
      gap:7px 10px!important;
    }
    #scheduleView #backFromSchedule{
      grid-column:1!important;
      grid-row:1 / span 2!important;
      align-self:start!important;
    }
    #scheduleView .scheduleTitleBlock{display:contents!important}
    #scheduleView #scheduleRouteName{
      grid-column:2!important;
      grid-row:1!important;
      align-self:center!important;
      justify-self:start!important;
      min-width:0!important;
      margin:0!important;
      text-align:left!important;
      line-height:1.12!important;
    }
    #scheduleView #scheduleVehicle{
      grid-column:3!important;
      grid-row:1!important;
      align-self:center!important;
      justify-self:stretch!important;
      min-width:0!important;
      margin:0!important;
    }
    #scheduleView #scheduleVehicleButton{
      width:100%!important;
      max-width:none!important;
      min-width:0!important;
      min-height:0!important;
      height:auto!important;
      margin:0!important;
      padding:4px 0!important;
      border:0!important;
      background:transparent!important;
      box-shadow:none!important;
      text-align:right!important;
      line-height:1.15!important;
    }
    #scheduleView .scheduleControlBlock{
      grid-column:2 / 4!important;
      grid-row:2!important;
      display:grid!important;
      grid-template-columns:minmax(0,1fr) auto!important;
      grid-template-rows:auto auto!important;
      align-items:center!important;
      gap:2px 14px!important;
      width:100%!important;
      min-width:0!important;
      margin:0!important;
      padding:7px 9px!important;
      border:1px solid #4d4d4d!important;
      border-radius:8px!important;
      background:#242424!important;
    }
    #scheduleView .schedulePrimaryTime{
      grid-column:1!important;
      grid-row:1!important;
      display:flex!important;
      align-items:center!important;
      min-width:0!important;
    }
    #scheduleView .scheduleTimeSelect:not([hidden]){
      display:block!important;
      width:auto!important;
      min-width:88px!important;
      min-height:34px!important;
      margin:0!important;
      padding-top:0!important;
      padding-bottom:0!important;
    }
    #scheduleView #returnStartLabel:not([hidden]){
      display:block!important;
      min-width:0!important;
      margin:0!important;
      overflow:hidden!important;
      text-overflow:ellipsis!important;
      white-space:nowrap!important;
    }
    #scheduleView .scheduleClock{
      grid-column:1!important;
      grid-row:2!important;
      justify-self:start!important;
      min-width:0!important;
      margin:0!important;
      color:#63d7ff!important;
      line-height:1.15!important;
    }
    #scheduleView .returnRouteSwitchLabel{
      grid-column:2!important;
      grid-row:1 / span 2!important;
      align-self:center!important;
      justify-self:end!important;
      display:inline-flex!important;
      align-items:center!important;
      justify-content:flex-end!important;
      gap:7px!important;
      min-width:0!important;
      margin:0!important;
      padding:4px 0 4px 12px!important;
      border:0!important;
      border-left:1px solid #555!important;
      border-radius:0!important;
      background:transparent!important;
      box-shadow:none!important;
      font-size:.86rem!important;
      line-height:1!important;
      white-space:nowrap!important;
    }
    #scheduleView .returnSwitch{
      width:34px!important;
      height:20px!important;
      flex:0 0 34px!important;
    }
    #scheduleView .returnSlider:before{
      width:16px!important;
      height:16px!important;
    }
    #scheduleView .returnSwitch input:checked + .returnSlider:before{
      transform:translateX(14px)!important;
    }
    @media(max-width:520px){
      #scheduleView .scheduleHeading{
        grid-template-columns:38px minmax(0,1fr) minmax(108px,36%)!important;
        gap:6px 8px!important;
        align-items:start!important;
      }
      #scheduleView #scheduleRouteName{font-size:1.12rem!important}
      #scheduleView #scheduleVehicleButton{
        padding:2px 0!important;
        font-size:.7rem!important;
      }
      #scheduleView .scheduleControlBlock{
        gap:2px 9px!important;
        padding:6px 8px!important;
      }
      #scheduleView .returnRouteSwitchLabel{
        gap:6px!important;
        padding-left:9px!important;
        font-size:.76rem!important;
      }
      #scheduleView .scheduleClock{font-size:.94rem!important}
    }
  `;
  document.head.appendChild(style);
})();
