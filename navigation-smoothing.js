(()=>{
  const STATIONARY_RADIUS_M=14;
  const HEADING_MOVE_M=12;
  const CAMERA_DURATION_MS=760;
  const INSTALL_TIMEOUT_MS=30000;
  const STOP_SPEED_MS=1.3;
  const RESUME_SPEED_MS=2.4;
  const RESUME_MOVE_M=12;
  const RESUME_FIXES=2;

  let stationary=true;
  let gpsAnchor=null;
  let lastGps=null;
  let movingFixes=0;

  function hav(a,b){
    if(!a||!b)return Infinity;
    const R=6371000,p=Math.PI/180;
    const dLat=(b[1]-a[1])*p;
    const dLon=(b[0]-a[0])*p;
    const x=Math.sin(dLat/2)**2+Math.cos(a[1]*p)*Math.cos(b[1]*p)*Math.sin(dLon/2)**2;
    return 2*R*Math.asin(Math.sqrt(x));
  }

  if(navigator.geolocation){
    navigator.geolocation.watchPosition(p=>{
      const pt=[p.coords.longitude,p.coords.latitude];
      const speed=Number(p.coords.speed);
      const accuracy=Number(p.coords.accuracy)||999;
      if(accuracy>100)return;

      if(!gpsAnchor)gpsAnchor=pt.slice();
      const fromAnchor=hav(gpsAnchor,pt);
      const step=lastGps?hav(lastGps,pt):0;
      lastGps=pt.slice();

      const speedSaysStopped=Number.isFinite(speed)&&speed>=0&&speed<STOP_SPEED_MS;
      const speedSaysMoving=Number.isFinite(speed)&&speed>=RESUME_SPEED_MS;
      const positionSaysMoving=fromAnchor>=RESUME_MOVE_M&&step>=5;

      if(speedSaysStopped||fromAnchor<=STATIONARY_RADIUS_M){
        stationary=true;
        movingFixes=0;
        if(fromAnchor>STATIONARY_RADIUS_M*.75)gpsAnchor=pt.slice();
        return;
      }

      if(speedSaysMoving||positionSaysMoving){
        movingFixes++;
        if(movingFixes>=RESUME_FIXES){
          stationary=false;
          gpsAnchor=pt.slice();
          movingFixes=0;
        }
      }else{
        movingFixes=0;
      }
    },()=>{}, {enableHighAccuracy:true,maximumAge:700,timeout:15000});
  }

  function install(){
    const map=window.__routeMap;
    if(!map||map.__routeSmoothingInstalled)return false;
    map.__routeSmoothingInstalled=true;

    const nativeEaseTo=map.easeTo.bind(map);
    let lastNavCenter=null;
    let stableBearing=Number.isFinite(map.getBearing?.())?map.getBearing():0;

    map.easeTo=function(options={},eventData){
      const o={...options};
      const center=Array.isArray(o.center)?o.center:null;
      const looksLikeNavigationCamera=center&&Number.isFinite(Number(o.bearing))&&Number(o.pitch)>=50&&Number(o.zoom)>=16;

      if(looksLikeNavigationCamera){
        const moved=lastNavCenter?hav(lastNavCenter,center):Infinity;
        const requestedBearing=Number(o.bearing);

        if(stationary){
          o.bearing=stableBearing;
        }else if(!lastNavCenter||moved>=HEADING_MOVE_M){
          const delta=((requestedBearing-stableBearing+540)%360)-180;
          stableBearing=(stableBearing+delta*.36+360)%360;
          lastNavCenter=center.slice();
          o.bearing=stableBearing;
        }else{
          o.bearing=stableBearing;
        }

        if(!lastNavCenter)lastNavCenter=center.slice();
        if(o.duration!==0)o.duration=Math.max(Number(o.duration)||0,CAMERA_DURATION_MS);
        o.easing=t=>1-Math.pow(1-t,3);
      }

      return nativeEaseTo(o,eventData);
    };

    return true;
  }

  const timer=setInterval(()=>{if(install())clearInterval(timer)},200);
  setTimeout(()=>clearInterval(timer),INSTALL_TIMEOUT_MS);
})();
