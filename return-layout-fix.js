(()=>{
  const style=document.createElement('style');
  style.textContent=`
    #scheduleView .scheduleTitleBlock{
      display:grid!important;
      grid-template-columns:minmax(0,1fr) minmax(145px,42%)!important;
      grid-template-rows:auto auto!important;
      align-items:center!important;
      gap:8px 12px!important;
      width:100%!important;
    }
    #scheduleView #scheduleRouteName{
      grid-column:1!important;
      grid-row:1!important;
      align-self:end!important;
      margin:0!important;
      text-align:left!important;
    }
    #scheduleView .scheduleControls{
      display:contents!important;
    }
    #scheduleView .scheduleTimeSelect:not([hidden]),
    #scheduleView #returnStartLabel{
      grid-column:1!important;
      grid-row:2!important;
      justify-self:start!important;
      margin:0!important;
    }
    #scheduleView .scheduleClock{
      grid-column:1!important;
      grid-row:3!important;
      justify-self:start!important;
      color:#63d7ff!important;
      margin-top:2px!important;
    }
    #scheduleView #scheduleVehicleButton{
      grid-column:2!important;
      grid-row:1!important;
      justify-self:stretch!important;
      align-self:stretch!important;
      width:100%!important;
      max-width:none!important;
      min-height:48px!important;
      margin:0!important;
    }
    #scheduleView .returnRouteSwitchLabel{
      grid-column:2!important;
      grid-row:2 / span 2!important;
      justify-self:stretch!important;
      align-self:stretch!important;
      display:flex!important;
      align-items:center!important;
      justify-content:center!important;
      gap:9px!important;
      margin:0!important;
      padding:10px 8px!important;
      border:1px solid #555!important;
      border-radius:8px!important;
      background:#222!important;
      font-size:.9rem!important;
    }
    #scheduleView #returnStartLabel{
      overflow:hidden;
      text-overflow:ellipsis;
      white-space:nowrap;
    }
    @media(max-width:520px){
      #scheduleView .scheduleTitleBlock{
        grid-template-columns:minmax(0,1fr) minmax(132px,44%)!important;
        gap:7px 9px!important;
      }
      #scheduleView #scheduleRouteName{
        font-size:1.18rem!important;
      }
      #scheduleView #scheduleVehicleButton{
        font-size:.72rem!important;
        padding:7px 8px!important;
      }
      #scheduleView .returnRouteSwitchLabel{
        padding:8px 5px!important;
        font-size:.78rem!important;
      }
    }
  `;
  document.head.appendChild(style);
})();
