(()=>{
  const body=document.getElementById('scheduleBody');
  const gps=window.__trasyGps;
  const geo=window.__trasyGeo;
  if(!body||!gps?.subscribe||!geo?.parseCoordinate||!geo?.distanceMeters)return;

  let lastForcedKey='';

  function routeRows(){
    return[...body.querySelectorAll('tr')].filter(row=>geo.parseCoordinate(row.dataset.coordinate));
  }

  function nearestRealStop(position){
    const rows=routeRows();
    if(rows.length<2)return null;
    const here=[Number(position?.coords?.latitude),Number(position?.coords?.longitude)];
    if(!Number.isFinite(here[0])||!Number.isFinite(here[1]))return null;

    let bestIndex=1;
    let bestDistance=Infinity;
    for(let index=1;index<rows.length;index+=1){
      const target=geo.parseCoordinate(rows[index].dataset.coordinate);
      if(!target)continue;
      const distance=geo.distanceMeters(here,target);
      if(Number.isFinite(distance)&&distance<bestDistance){
        bestIndex=index;
        bestDistance=distance;
      }
    }
    return Number.isFinite(bestDistance)?{index:bestIndex,distance:bestDistance,row:rows[bestIndex]}:null;
  }

  function fix(position){
    if(body.dataset.direction!=='return'||body.dataset.emptyRun==='1')return;
    const current=Number(body.dataset.gpsNextStop);
    if(Number.isInteger(current)&&current>0)return;

    const target=nearestRealStop(position);
    if(!target)return;
    const key=target.row?.dataset.stopId||`${target.index}:${target.row?.dataset.coordinate||''}`;
    if(lastForcedKey===key&&Number(body.dataset.gpsNextStop)===target.index)return;
    lastForcedKey=key;

    body.dispatchEvent(new CustomEvent('gps-skip-stop',{
      bubbles:true,
      detail:{
        index:target.index,
        source:'return-start-excluded',
        distance:target.distance
      }
    }));
  }

  function reset(){lastForcedKey=''}
  body.addEventListener('route-direction-change',reset);
  body.addEventListener('route-mode-change',reset);
  body.addEventListener('schedule-rendered',reset);
  gps.subscribe(fix,()=>{});
})();
