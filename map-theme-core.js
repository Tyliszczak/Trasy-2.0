const RAD=Math.PI/180;
const DEG=180/Math.PI;

function normalizedDegrees(value){
  return ((value%360)+360)%360;
}

export function solarElevationDeg(date,latitude,longitude){
  const time=date instanceof Date?date.getTime():Number.NaN;
  const lat=Number(latitude),lon=Number(longitude);
  if(!Number.isFinite(time)||!Number.isFinite(lat)||!Number.isFinite(lon)||lat<-90||lat>90||lon<-180||lon>180)return Number.NaN;

  const julianDay=time/86400000+2440587.5;
  const days=julianDay-2451545.0;
  const meanLongitude=normalizedDegrees(280.46+0.9856474*days);
  const meanAnomaly=normalizedDegrees(357.528+0.9856003*days)*RAD;
  const eclipticLongitude=(meanLongitude+1.915*Math.sin(meanAnomaly)+0.020*Math.sin(2*meanAnomaly))*RAD;
  const obliquity=(23.439-0.0000004*days)*RAD;
  const rightAscension=Math.atan2(Math.cos(obliquity)*Math.sin(eclipticLongitude),Math.cos(eclipticLongitude))*DEG;
  const declination=Math.asin(Math.sin(obliquity)*Math.sin(eclipticLongitude));
  const sidereal=normalizedDegrees(280.46061837+360.98564736629*days+lon);
  let hourAngle=(sidereal-rightAscension)*RAD;
  if(hourAngle>Math.PI)hourAngle-=2*Math.PI;
  if(hourAngle<-Math.PI)hourAngle+=2*Math.PI;
  const latitudeRad=lat*RAD;
  const elevation=Math.asin(
    Math.sin(latitudeRad)*Math.sin(declination)+
    Math.cos(latitudeRad)*Math.cos(declination)*Math.cos(hourAngle)
  );
  return elevation*DEG;
}

export function isNightAt(date,latitude,longitude){
  const elevation=solarElevationDeg(date,latitude,longitude);
  return Number.isFinite(elevation)&&elevation<=-0.833;
}
