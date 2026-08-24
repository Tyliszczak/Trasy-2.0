function bool(value){
  if(value===true||value===false)return value;
  const normalized=String(value??'').trim().toLowerCase();
  if(['tak','yes','true','1','x'].includes(normalized))return true;
  if(['nie','no','false','0'].includes(normalized))return false;
  return null;
}

function positiveNumber(value){
  const number=Number(String(value??'').replace(',','.').replace(/[^0-9.\-]/g,''));
  return Number.isFinite(number)&&number>0?number:null;
}

function categoryFrom(vehicle){
  const raw=[vehicle?.category,vehicle?.vehicleCategory,vehicle?.type].filter(Boolean).join(' ').toLowerCase();
  if(/autobus|autokar|\bbus\b/.test(raw))return'bus';
  if(/ciężar|ciezar|truck|lorry/.test(raw))return'truck';
  if(/osobow|passenger|car/.test(raw))return'car';
  if(/dostaw|van/.test(raw))return'van';
  return'';
}

export function normalizeVehicleSpeedProfile(vehicle){
  if(!vehicle)return{category:'',missing:true,bus100Approved:null,standingPassengers:null,individualLimitKmh:null,limiterKmh:null};
  const category=categoryFrom(vehicle);
  return{
    category,
    missing:!category,
    bus100Approved:bool(vehicle.bus100Approved??vehicle.bus100??vehicle.bus100Certificate),
    standingPassengers:bool(vehicle.standingPassengers??vehicle.allowsStandingPassengers),
    individualLimitKmh:positiveNumber(vehicle.individualLimitKmh??vehicle.vehicleMaxspeed),
    limiterKmh:positiveNumber(vehicle.limiterKmh??vehicle.speedLimiterKmh)
  };
}

function cap(limit,...caps){
  return caps.reduce((value,item)=>Number.isFinite(item)&&item>0?Math.min(value,item):value,limit);
}

export function effectiveVehicleSpeedLimit({roadLimit,roadClass='',highSpeedRoad=false,vehicle=null}={}){
  const general=positiveNumber(roadLimit);
  if(!general)return{limit:null,generalLimit:null,status:'road-missing',statusText:'BRAK DANYCH DROGI',personalized:false};

  const profile=normalizeVehicleSpeedProfile(vehicle);
  if(profile.missing){
    return{limit:general,generalLimit:general,status:'vehicle-missing',statusText:'BRAK DANYCH POJAZDU',personalized:false};
  }

  if(profile.category==='bus'){
    const road=String(roadClass||'');
    const fast=highSpeedRoad||['motorway','motorway_link','trunk','trunk_link'].includes(road);
    const certified=profile.bus100Approved===true&&profile.standingPassengers===false;
    const statutoryCap=fast?(certified?100:80):70;
    const limit=cap(general,statutoryCap,profile.individualLimitKmh,profile.limiterKmh);
    if(profile.bus100Approved===null){
      return{limit,generalLimit:general,status:'bus100-unconfirmed',statusText:'BUS • BRAK POTWIERDZENIA 100',personalized:true};
    }
    if(profile.bus100Approved===true&&profile.standingPassengers===null){
      return{limit,generalLimit:general,status:'vehicle-incomplete',statusText:'BUS • BRAK DANYCH MIEJSC',personalized:true};
    }
    return{limit,generalLimit:general,status:'vehicle-applied',statusText:certified?'BUS 100':'BUS',personalized:true};
  }

  const limit=cap(general,profile.individualLimitKmh,profile.limiterKmh);
  const complete=!!(profile.individualLimitKmh||profile.limiterKmh);
  return{
    limit,
    generalLimit:general,
    status:complete?'vehicle-applied':'vehicle-incomplete',
    statusText:complete?'POJAZD':'BRAK PEŁNYCH DANYCH POJAZDU',
    personalized:complete
  };
}
