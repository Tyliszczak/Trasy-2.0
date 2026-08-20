(()=>{
  const style=document.createElement('style');
  style.textContent=`
    #scheduleView .scheduleTitleBlock{
      display:grid!important;
      grid-template-columns:minmax(0,1fr) minmax(128px,40%)!important;
      grid-template-rows:auto auto auto!important;
      align-items:center!important;
      column-gap:10px!important;
      row-gap:3px!important;
      width:100%!important;
    }
    #scheduleView #scheduleRouteName{
      grid-column:1!important;
      grid-row:1!important;
      align-self:center!important;
      margin:0!important;
      text-align:left!important;
    }
    #scheduleView .scheduleControls{display:contents!important}
    #scheduleView .scheduleTimeSelect:not([hidden]),
    #scheduleView #returnStartLabel{
      grid-column:1!important;
      grid-row:2!important;
      justify-self:start!important;
      align-self:center!important;
      margin:0!important;
    }
    #scheduleView .scheduleClock{
      grid-column:1!important;
      grid-row:3!important;
      justify-self:start!important;
      align-self:center!important;
      color:#63d7ff!important;
      margin:0!important;
    }
    #scheduleView #scheduleVehicleButton{
      grid-column:2!important;
      grid-row:1!important;
      justify-self:stretch!important;
      align-self:center!important;
      width:100%!important;
      max-width:none!important;
      min-height:0!important;
      height:auto!important;
      margin:0!important;
      padding:5px 7px!important;
      border:0!important;
      background:transparent!important;
      box-shadow:none!important;
      text-align:right!important;
    }
    #scheduleView .returnRouteSwitchLabel{
      grid-column:2!important;
      grid-row:2 / span 2!important;
      justify-self:end!important;
      align-self:center!important;
      display:flex!important;
      align-items:center!important;
      justify-content:flex-end!important;
      gap:7px!important;
      margin:0!important;
      padding:3px 0!important;
      border:0!important;
      border-radius:0!important;
      background:transparent!important;
      box-shadow:none!important;
      font-size:.9rem!important;
    }
    #scheduleView #returnStartLabel{
      overflow:hidden;
      text-overflow:ellipsis;
      white-space:nowrap;
    }
    @media(max-width:520px){
      #scheduleView .scheduleTitleBlock{
        grid-template-columns:minmax(0,1fr) minmax(120px,42%)!important;
        column-gap:8px!important;
        row-gap:2px!important;
      }
      #scheduleView #scheduleRouteName{font-size:1.18rem!important}
      #scheduleView #scheduleVehicleButton{
        font-size:.72rem!important;
        padding:3px 0!important;
      }
      #scheduleView .returnRouteSwitchLabel{
        padding:2px 0!important;
        font-size:.78rem!important;
      }
    }
  `;
  document.head.appendChild(style);
})();
