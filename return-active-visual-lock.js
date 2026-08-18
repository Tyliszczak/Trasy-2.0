(()=>{
  const style=document.createElement('style');
  style.textContent=`
    #scheduleBody[data-direction="return"] tr:not(.gpsNextStop){
      transform:scale(.955)!important;
      opacity:.74!important;
      background:transparent!important;
      box-shadow:none!important;
    }
    #scheduleBody[data-direction="return"] tr:not(.gpsNextStop) td{
      padding-top:10px!important;
      padding-bottom:10px!important;
      font-weight:400!important;
    }
    #scheduleBody[data-direction="return"] tr:not(.gpsNextStop) td:first-child{
      color:inherit!important;
      font-size:inherit!important;
      padding-left:8px!important;
    }
    #scheduleBody[data-direction="return"] tr:not(.gpsNextStop) td:first-child::before{
      display:none!important;
    }
    #scheduleBody[data-direction="return"] tr.gpsNextStop{
      position:relative;
      z-index:3;
      transform:none!important;
      opacity:1!important;
      background:#303030!important;
      box-shadow:0 5px 14px #0009!important;
    }
    #scheduleBody[data-direction="return"] tr.gpsNextStop td{
      padding-top:13px!important;
      padding-bottom:13px!important;
      border-bottom-color:transparent!important;
      font-weight:800!important;
    }
    #scheduleBody[data-direction="return"] tr.gpsNextStop td:first-child{
      position:relative;
      color:#fff!important;
      font-size:1.06rem!important;
      padding-left:14px!important;
    }
    #scheduleBody[data-direction="return"] tr.gpsNextStop td:first-child::before{
      content:"";
      position:absolute;
      display:block!important;
      left:0;
      top:5px;
      bottom:5px;
      width:5px;
      border-radius:4px;
      background:var(--gps-status-color,#fff);
    }
  `;
  document.head.appendChild(style);
})();