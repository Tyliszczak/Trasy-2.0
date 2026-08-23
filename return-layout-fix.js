(()=>{
  const style=document.createElement('style');
  style.id='scheduleHeaderLayoutV2';
  style.textContent=`
    #scheduleView .scheduleHeading{
      display:grid!important;
      grid-template-columns:38px minmax(88px,1fr) minmax(0,auto) minmax(118px,auto)!important;
      grid-template-rows:auto auto auto!important;
      align-items:center!important;
      gap:3px 10px!important;
    }
    #scheduleView #backFromSchedule{
      grid-column:1!important;
      grid-row:1 / 4!important;
      align-self:start!important;
    }
    #scheduleView .scheduleTitleBlock,
    #scheduleView .scheduleControls{
      display:contents!important;
    }
    #scheduleView #scheduleRouteName{
      grid-column:2 / 4!important;
      grid-row:1!important;
      justify-self:start!important;
      min-width:0!important;
      margin:0!important;
      text-align:left!important;
      line-height:1.12!important;
    }
    #scheduleView .scheduleTimeSelect:not([hidden]),
    #scheduleView #returnStartLabel:not([hidden]){
      grid-column:2!important;
      grid-row:2!important;
      justify-self:start!important;
      min-width:0!important;
      margin:0!important;
    }
    #scheduleView .scheduleClock{
      grid-column:2!important;
      grid-row:3!important;
      justify-self:start!important;
      min-width:0!important;
      margin:0!important;
      color:#63d7ff!important;
    }
    #scheduleView #scheduleSpeedBox{
      grid-column:4!important;
      grid-row:1!important;
      align-self:center!important;
      justify-self:end!important;
      margin:0!important;
    }
    #scheduleView .routeModeSwitches{
      grid-column:4!important;
      grid-row:2!important;
      align-self:center!important;
      justify-self:end!important;
      margin:0!important;
      padding:2px 0!important;
      border:0!important;
      background:transparent!important;
      box-shadow:none!important;
    }
    #scheduleView #scheduleVehicle{
      grid-column:4!important;
      grid-row:3!important;
      align-self:end!important;
      justify-self:end!important;
      min-width:0!important;
      margin:0!important;
    }
    #scheduleView #scheduleVehicleButton{
      width:auto!important;
      max-width:min(42vw,240px)!important;
      min-width:0!important;
      min-height:0!important;
      height:auto!important;
      margin:0!important;
      padding:2px 0!important;
      border:0!important;
      background:transparent!important;
      box-shadow:none!important;
      text-align:right!important;
      line-height:1.15!important;
    }
    #scheduleView #returnStartLabel{
      overflow:hidden!important;
      text-overflow:ellipsis!important;
      white-space:nowrap!important;
    }
    @media(max-width:520px){
      #scheduleView .scheduleHeading{
        grid-template-columns:38px minmax(62px,1fr) minmax(0,auto) minmax(108px,auto)!important;
        gap:2px 7px!important;
      }
      #scheduleView #scheduleRouteName{font-size:1.12rem!important}
      #scheduleView .scheduleTimeSelect:not([hidden]),
      #scheduleView #returnStartLabel:not([hidden]){
        width:100%!important;
        max-width:100%!important;
      }
      #scheduleView .routeModeSwitches{gap:8px!important}
      #scheduleView #scheduleVehicleButton{
        max-width:38vw!important;
        font-size:.7rem!important;
      }
      #scheduleView .scheduleClock{font-size:.94rem!important}
    }
  `;
  document.head.appendChild(style);
})();
