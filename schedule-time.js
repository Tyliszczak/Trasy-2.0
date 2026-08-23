const DAY_MS=24*60*60*1000;

function timeParts(row){
  const text=String(
    row?.children?.[1]?.firstChild?.textContent||
    row?.children?.[1]?.textContent||''
  ).trim();
  const match=text.match(/^(\d{1,2}):(\d{2})/);
  if(!match)return null;
  return{hours:Number(match[1]),minutes:Number(match[2])};
}

export function planDateForRow(rows,row,now=new Date()){
  const list=Array.from(rows||[]);
  const targetIndex=list.indexOf(row);
  if(targetIndex<0)return null;

  let dayOffset=0;
  let previousMinutes=null;
  let target=null;

  for(let i=0;i<=targetIndex;i++){
    const parts=timeParts(list[i]);
    if(!parts)continue;
    const minutes=parts.hours*60+parts.minutes;
    if(previousMinutes!==null&&minutes<previousMinutes-12*60)dayOffset+=1;
    previousMinutes=minutes;
    if(i===targetIndex){
      target=new Date(now);
      target.setHours(parts.hours,parts.minutes,0,0);
      target.setDate(target.getDate()+dayOffset);
    }
  }

  if(!target)return null;
  while(target.getTime()-now.getTime()>12*60*60*1000){
    target=new Date(target.getTime()-DAY_MS);
  }
  while(now.getTime()-target.getTime()>18*60*60*1000){
    target=new Date(target.getTime()+DAY_MS);
  }
  return target;
}
