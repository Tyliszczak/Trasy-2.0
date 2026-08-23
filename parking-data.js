export function normalizeCoordinate(value){
  const match=String(value||'').match(/^\s*(-?\d+(?:\.\d+)?)\s*[,; ]\s*(-?\d+(?:\.\d+)?)\s*$/);
  if(!match)return'';
  const latitude=+match[1],longitude=+match[2];
  return latitude>=-90&&latitude<=90&&longitude>=-180&&longitude<=180
    ?`${latitude}, ${longitude}`
    :'';
}

export function getParkingOptions(data,routeName){
  if(!data||Array.isArray(data))return[];
  const key=Object.keys(data).find(name=>String(name).trim().toUpperCase()==='PARKINGI');
  const table=key?data[key]:null;
  if(!Array.isArray(table)||!Array.isArray(table[0]))return[];

  const headers=table[0].map(value=>String(value??'').trim().toUpperCase());
  const nameIndex=headers.findIndex(value=>value.includes('NAZWA'));
  const coordinateIndex=headers.findIndex(value=>value.includes('LOKALIZACJA')||value.includes('WSPÓŁRZ')||value.includes('GPS'));
  const routeIndex=headers.findIndex(value=>value.includes('TRASA'));
  if(coordinateIndex<0)return[];

  const normalizedRoute=String(routeName||'').trim().toLowerCase();
  const found=table.slice(1).map((row,index)=>{
    const assigned=routeIndex>=0?String(row?.[routeIndex]??'').trim():'';
    if(assigned&&assigned!=='*'&&assigned.toLowerCase()!==normalizedRoute)return null;
    const coordinates=normalizeCoordinate(row?.[coordinateIndex]);
    if(!coordinates)return null;
    const name=String(nameIndex>=0?row?.[nameIndex]??'':'').trim()||`Parking ${index+1}`;
    return{name,coordinates};
  }).filter(Boolean);

  return found.filter((parking,index)=>found.findIndex(other=>other.coordinates===parking.coordinates)===index);
}
