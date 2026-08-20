(()=>{
  const STATIONARY_RADIUS_M=7;
  const HEADING_MOVE_M=9;
  const CAMERA_DURATION_MS=760;
  const INSTALL_TIMEOUT_MS=30000;

  function hav(a,b){
    if(!a||!b)return Infinity;
    const R=6371000,p=Math.PI/180;
    const dLat=(b[1]-a[1])*p;
    const dLon=(b[0]-a[0])*p;
    const x=Math.sin(dLat/2)**2+Math.cos(a[1]*p)*Math.cos(b[1]*p)*Math.sin(dLon/2)**2;
    return 2*R*Math.asin(Math.sqrt(x));
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
      const looksLikeNavigationCamera=
        center&&
        Number.isFinite(Number(o.bearing))&&
        Number(o.pitch)>=50&&
        Number(o.zoom)>=16;

      if(looksLikeNavigationCamera){
        const moved=lastNavCenter?hav(lastNavCenter,center):Infinity;
        const requestedBearing=Number(o.bearing);

        if(!lastNavCenter||moved>=HEADING_MOVE_M){
          const delta=((requestedBearing-stableBearing+540)%360)-180;
          stableBearing=(stableBearing+delta*.42+360)%360;
          lastNavCenter=center.slice();
        }else if(moved<=STATIONARY_RADIUS_M){
          o.bearing=stableBearing;
        }else{
          const delta=((requestedBearing-stableBearing+540)%360)-180;
          stableBearing=(stableBearing+delta*.16+360)%360;
          o.bearing=stableBearing;
        }

        if(moved>=HEADING_MOVE_M)o.bearing=stableBearing;
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
