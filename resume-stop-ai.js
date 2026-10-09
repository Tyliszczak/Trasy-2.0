import{angleDifference,bearingDegrees,distanceMeters}from'./gps-stop-engine.js';

(()=>{
  const body=document.getElementById('scheduleBody');
  const geo=globalThis.__trasyGeo;
  if(!body||!geo)return;
  let pending=null;

  const coord=value=>geo.parseCoordinate(value);
  const rows=()=>[...body.querySelectorAll('tr')].filter(row=>coord(row.dataset.coordinate));

  function showDecision(decision,apply){
    let notice=document.getElementById('aiResumeStopNotice');
    if(!notice){
      notice=document.createElement('div');notice.id='aiResumeStopNotice';notice.setAttribute('role','status');
      notice.style.cssText='position:fixed;left:12px;right:12px;bottom:calc(70px + env(safe-area-inset-bottom));z-index:100500;padding:12px;border-radius:12px;background:#18243a;color:#fff;box-shadow:0 6px 22px #0009;font:700 14px/1.3 Arial,sans-serif';
      document.body.append(notice);
    }
    const applyButton=document.createElement('button');applyButton.type='button';applyButton.textContent=decision.auto?'COFNIJ':'ZASTOSUJ';
    applyButton.style.cssText='float:right;margin-left:10px;padding:8px 10px;border:0;border-radius:8px;background:#ccff33;color:#111;font-weight:900';
    notice.replaceChildren(document.createTextNode(decision.auto?'AI wybrało kolejny przystanek po wznowieniu.':'AI proponuje następny przystanek po wznowieniu.'),applyButton);
    applyButton.onclick=()=>{applyButton.disabled=true;apply();notice.remove()};
    setTimeout(()=>notice?.isConnected&&notice.remove(),12000);
  }

  function candidateSummary(position){
    const current=Number(body.dataset.gpsNextStop);
    const routeRows=rows();
    if(!Number.isInteger(current)||!routeRows[current])return null;
    const here=[Number(position.coords.latitude),Number(position.coords.longitude)];
    if(!Number.isFinite(here[0])||!Number.isFinite(here[1]))return null;
    const heading=Number(position.coords.heading);
    const headingReliable=Number.isFinite(heading)&&heading>=0&&Number(position.coords.speed)>=1.5;
    const candidates=[];
    for(let index=current;index<Math.min(routeRows.length,current+5);index+=1){
      const target=coord(routeRows[index].dataset.coordinate);if(!target)continue;
      const bearing=bearingDegrees(here,target);
      candidates.push({
        index,distanceMeters:Math.round(distanceMeters(here,target)),
        headingDifference:headingReliable?Math.round(angleDifference(heading,bearing)):null
      });
    }
    return{currentIndex:current,accuracyMeters:Math.round(Number(position.coords.accuracy)||0),speedKmh:Math.round(Math.max(0,Number(position.coords.speed)||0)*3.6),headingReliable,candidates};
  }

  document.addEventListener('trasy:navigation-resumed',event=>{
    const position=event.detail?.position;
    const hiddenAt=Number(event.detail?.hiddenAt)||0;
    const inactiveSeconds=hiddenAt?Math.max(0,Math.round((Date.now()-hiddenAt)/1000)):0;
    if(!position||inactiveSeconds<20||body.dataset.direction==='return'||body.dataset.emptyRun==='1')return;
    const summary=candidateSummary(position);if(!summary||summary.candidates.length<2)return;
    const resumeId=`${Date.now()}-${summary.currentIndex}`;
    pending={resumeId,fromIndex:summary.currentIndex,candidates:summary.candidates.map(item=>item.index)};
    window.__trasyDiagnostics?.record?.('resume-candidates',{resumeId,inactiveSeconds,...summary});
    window.__trasyDiagnostics?.uploadNow?.();
  });

  document.addEventListener('trasy:diagnostics-uploaded',event=>{
    const recommendation=event.detail?.resumeRecommendation;
    if(!pending||!recommendation||recommendation.resumeId!==pending.resumeId)return;
    const target=Number(recommendation.targetIndex);
    if(!pending.candidates.includes(target)||target<pending.fromIndex)return;
    const apply=()=>body.dispatchEvent(new CustomEvent('gps-skip-stop',{detail:{index:target,source:'ai-resume'}}));
    const undo=()=>body.dispatchEvent(new CustomEvent('gps-skip-stop',{detail:{index:pending.fromIndex,source:'ai-resume-undo'}}));
    const auto=Boolean(recommendation.confidence>=85&&target>pending.fromIndex);
    if(auto){apply();showDecision({auto:true},undo)}
    else showDecision({auto:false},apply);
    document.dispatchEvent(new CustomEvent('trasy:ai-resume-decision',{detail:{...recommendation,auto}}));
    pending=null;
  });
})();
