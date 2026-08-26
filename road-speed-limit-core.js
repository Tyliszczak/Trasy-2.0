export function normalizePtvSpeedLimit(response,{maxMatchDistance=80}={}){
  const attributes=response?.segmentAttributes||{};
  const speed=Number(attributes.speedLimit);
  const matchDistance=Number(response?.matchDistance);
  const angleDifference=Number(response?.angleDifference);

  if(Number.isFinite(matchDistance)&&matchDistance>maxMatchDistance)return null;
  if(!Number.isFinite(speed)||speed<=0||speed>250)return null;

  return{
    maxspeed:Math.round(speed),
    matchDistance:Number.isFinite(matchDistance)?matchDistance:null,
    angleDifference:Number.isFinite(angleDifference)?angleDifference:null,
    builtUpArea:attributes.builtUpArea===true,
    matchedLatitude:Number.isFinite(Number(response?.latitude))?Number(response.latitude):null,
    matchedLongitude:Number.isFinite(Number(response?.longitude))?Number(response.longitude):null
  };
}

export function distanceMeters(a,b){
  const lat1=Number(a?.lat),lon1=Number(a?.lon),lat2=Number(b?.lat),lon2=Number(b?.lon);
  if(![lat1,lon1,lat2,lon2].every(Number.isFinite))return Infinity;
  const p=Math.PI/180,R=6371000;
  const dLat=(lat2-lat1)*p,dLon=(lon2-lon1)*p;
  const h=Math.sin(dLat/2)**2+Math.cos(lat1*p)*Math.cos(lat2*p)*Math.sin(dLon/2)**2;
  return 2*R*Math.asin(Math.sqrt(h));
}

export function bearingDegrees(a,b){
  const lat1=Number(a?.lat),lon1=Number(a?.lon),lat2=Number(b?.lat),lon2=Number(b?.lon);
  if(![lat1,lon1,lat2,lon2].every(Number.isFinite))return null;
  const p=Math.PI/180;
  const y=Math.sin((lon2-lon1)*p)*Math.cos(lat2*p);
  const x=Math.cos(lat1*p)*Math.sin(lat2*p)-Math.sin(lat1*p)*Math.cos(lat2*p)*Math.cos((lon2-lon1)*p);
  return(Math.atan2(y,x)*180/Math.PI+360)%360;
}
