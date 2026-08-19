(()=>{
  const style=document.createElement('style');
  style.textContent=`
    #scheduleView .scheduleControls{
      width:100%;
      min-width:0;
      max-width:100%;
      flex-wrap:wrap;
      justify-content:center;
      row-gap:6px;
      column-gap:8px;
    }
    #scheduleView .returnRouteSwitchLabel,
    #scheduleView #returnStartLabel,
    #scheduleView .scheduleClock{
      flex:0 1 auto;
      min-width:0;
      max-width:100%;
    }
    #scheduleView .returnRouteSwitchLabel{
      margin-left:auto;
      justify-self:end;
    }
    #scheduleView #returnStartLabel{
      overflow:hidden;
      text-overflow:ellipsis;
    }
    @media(max-width:520px){
      #scheduleView .scheduleControls{
        width:100%;
        display:grid;
        grid-template-columns:auto auto;
        align-items:center;
        justify-content:center;
        gap:6px 10px;
      }
      #scheduleView .returnRouteSwitchLabel{
        margin:0 0 0 auto;
        grid-column:2;
        grid-row:1;
        justify-self:end;
      }
      #scheduleView #returnStartLabel{
        margin:0;
        grid-column:1;
        grid-row:1;
        justify-self:start;
        text-align:left;
        white-space:nowrap;
      }
      #scheduleView .scheduleClock{
        grid-column:1 / -1;
        justify-self:center;
      }
      #scheduleView .scheduleTimeSelect:not([hidden]){
        grid-column:1 / -1;
        justify-self:center;
      }
    }
  `;
  document.head.appendChild(style);
})();
