(()=>{
  let lastBase='';

  function trafficSuffix(){
    if(!window.__routeTrafficAvailable)return '';
    const seconds=Math.max(0,Number(window.__routeTrafficDelaySeconds||0));
    if(seconds<60)return ' • ruch bez opóźnień';
    return ` • ruch +${Math.max(1,Math.round(seconds/60))} min`;
  }

  function refresh(){
    const nav=document.getElementById('routeMapNav');
    const status=document.getElementById('routeMapStatus');
    if(!nav||nav.hidden||!status)return;

    const current=String(status.textContent||'');
    if(!current.startsWith('Trasa '))return;

    const base=current.replace(/ • ruch(?: bez opóźnień| \+\d+ min)$/,'');
    lastBase=base;
    status.textContent=base+trafficSuffix();
  }

  document.addEventListener('route-traffic-update',()=>setTimeout(refresh,0));
  setInterval(refresh,1000);
})();
