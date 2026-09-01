(()=>{
  if(globalThis.__trasyGeo)return;

  const EARTH_RADIUS_M=6371000;

  function parseCoordinate(value){
    const match=String(value||'').match(/^\s*(-?\d+(?:\.\d+)?)\s*[,; ]\s*(-?\d+(?:\.\d+)?)\s*$/);
    if(!match)return null;
    const latitude=Number(match[1]);
    const longitude=Number(match[2]);
    if(!Number.isFinite(latitude)||latitude<-90||latitude>90||!Number.isFinite(longitude)||longitude<-180||longitude>180)return null;
    return[latitude,longitude];
  }

  function distanceMeters(a,b){
    if(!a||!b)return Infinity;
    const p=Math.PI/180;
    const lat1=Number(a[0])*p;
    const lat2=Number(b[0])*p;
    const dLat=(Number(b[0])-Number(a[0]))*p;
    const dLon=(Number(b[1])-Number(a[1]))*p;
    if(![lat1,lat2,dLat,dLon].every(Number.isFinite))return Infinity;
    const h=Math.sin(dLat/2)**2+Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLon/2)**2;
    return 2*EARTH_RADIUS_M*Math.asin(Math.sqrt(h));
  }

  function bearingDegrees(a,b){
    if(!a||!b)return null;
    const p=Math.PI/180;
    const lat1=Number(a[0])*p;
    const lat2=Number(b[0])*p;
    const dLon=(Number(b[1])-Number(a[1]))*p;
    if(![lat1,lat2,dLon].every(Number.isFinite))return null;
    const y=Math.sin(dLon)*Math.cos(lat2);
    const x=Math.cos(lat1)*Math.sin(lat2)-Math.sin(lat1)*Math.cos(lat2)*Math.cos(dLon);
    return(Math.atan2(y,x)*180/Math.PI+360)%360;
  }

  function angleDifference(a,b){
    const first=Number(a),second=Number(b);
    if(!Number.isFinite(first)||!Number.isFinite(second))return Infinity;
    return Math.abs(((first-second+540)%360)-180);
  }

  function osrmStartDirectionQuery({
    heading,
    speedMps,
    headingAgeMs,
    waypointCount,
    tolerance=55
  }={}){
    const direction=heading===null||heading===undefined||heading===''?NaN:Number(heading);
    const speed=Number(speedMps);
    const age=Number(headingAgeMs);
    const count=Number(waypointCount);
    if(!Number.isFinite(direction)||direction<0||!Number.isFinite(speed)||speed<1.5||!Number.isFinite(age)||age<0||age>10000||!Number.isInteger(count)||count<2)return'';
    const normalized=Math.round((direction%360+360)%360);
    const range=Math.max(30,Math.min(90,Math.round(Number(tolerance)||55)));
    return`&bearings=${normalized},${range}${';'.repeat(count-1)}&continue_straight=true`;
  }

  globalThis.__trasyGeo=Object.freeze({
    parseCoordinate,
    distanceMeters,
    bearingDegrees,
    angleDifference,
    osrmStartDirectionQuery
  });
})();
