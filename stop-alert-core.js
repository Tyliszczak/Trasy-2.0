export function formatCountdown(seconds){
  const value=Math.max(0,Math.ceil(Number(seconds)||0));
  return`${Math.floor(value/60)}:${String(value%60).padStart(2,'0')}`;
}

export function stopGuardState({eligible=true,direction='forward',arrived=false,seconds=0,planText=''}){
  if(!eligible||direction==='return'||!arrived)return{state:'',message:''};
  if(Number(seconds)>0){
    return{
      state:'hold',
      message:`NIE ODJEDŻAJ • ${formatCountdown(seconds)}${planText?` • plan ${planText}`:''}`
    };
  }
  return{state:'ready',message:'MOŻESZ JECHAĆ'};
}
