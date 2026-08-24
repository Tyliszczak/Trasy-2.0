(()=>{
  const style=document.createElement('style');
  style.id='punctualityTextColorFix';
  style.textContent=`
    #routeNextStop .nextStopStatus,
    #routeNextStop .nextStopStatus.early,
    #routeNextStop .nextStopStatus.onTime,
    #routeNextStop .nextStopStatus.late,
    #scheduleBody .etaPunctuality,
    #scheduleBody .etaPunctuality.early,
    #scheduleBody .etaPunctuality.onTime,
    #scheduleBody .etaPunctuality.late,
    #scheduleBody .etaPunctuality.neutral,
    #scheduleBody .etaPunctuality.arrived{
      color:#39ff69!important;
    }
  `;
  document.head.appendChild(style);
})();
