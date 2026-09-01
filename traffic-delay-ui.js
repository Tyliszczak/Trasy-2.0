(()=>{
  function trafficSuffix(){
    if(!window.__routeTrafficAvailable)return '';
    const seconds=Math.max(0,Number(window.__routeTrafficDelaySeconds||0));
    if(seconds<60)return ' • ruch bez opóźnień';
    const minutes=Math.max(1,Math.round(seconds/60));
    const duration=window.__trasyEta?.formatMinutes?.(minutes)||`${minutes} min`;
    return ` • ruch +${duration}`;
  }

  function refresh(){
    const nav=document.getElementById('routeMapNav');
    const status=document.getElementById('routeMapStatus');
    if(!nav||nav.hidden||!status)return;

    if(status.dataset.state!=='ready')return;
    const base=String(status.dataset.routeBase||'');
    if(!base.startsWith('Trasa '))return;
    status.textContent=base+trafficSuffix();
  }

  document.addEventListener('route-traffic-update',()=>setTimeout(refresh,0));
  setInterval(refresh,1000);
})();
