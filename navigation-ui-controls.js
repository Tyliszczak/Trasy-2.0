(()=>{
  const AUTO_RESUME_MS=15000;
  function init(){
    const root=document.getElementById('routeNavRoot'),close=document.getElementById('routeMapClose'),center=document.getElementById('routeMapCenter'),maneuver=document.getElementById('routeManeuver');
    if(!root||!close||!center||!maneuver)return false;if(root.dataset.compactNavUi==='8')return true;root.dataset.compactNavUi='8';
    const style=document.createElement('style');style.textContent='.maplibregl-ctrl-compass{display:none!important}';document.head.appendChild(style);
    const top=close.parentElement,title=top?.querySelector('strong');if(title)title.style.display='none';if(top){top.style.height='0';top.style.minHeight='0';top.style.padding='0';top.style.border='0';top.style.background='transparent';top.style.overflow='visible';top.style.position='relative';top.style.zIndex='50040'}
    close.textContent='‹';close.setAttribute('aria-label','Zamknij nawigację');close.title='Wróć do harmonogramu';close.style.cssText='position:fixed;top:112px;left:10px;z-index:50100;width:38px;height:38px;min-width:38px;min-height:38px;padding:0;border:1px solid #fff8;border-radius:19px;background:#111d;color:#fff;font-size:32px;line-height:32px;box-shadow:0 2px 9px #000a';
    const originalCenter=center.onclick;center.style.cssText='position:fixed;right:12px;top:112px;z-index:50100;width:38px;height:38px;min-width:38px;min-height:38px;padding:0;border:1px solid #fff8;border-radius:19px;background:#111d;color:#fff;box-shadow:0 2px 9px #000a;display:flex;align-items:center;justify-content:center';
    let voice=document.getElementById('routeVoiceToggle');if(!voice){voice=document.createElement('button');voice.id='routeVoiceToggle';voice.type='button';root.appendChild(voice)}voice.style.cssText='position:fixed;top:112px;left:56px;z-index:50100;width:38px;height:38px;min-width:38px;min-height:38px;padding:0;border:1px solid #fff8;border-radius:19px;background:#111d;color:#fff;font-size:19px;line-height:38px;box-shadow:0 2px 9px #000a';
    window.__routeVoiceMuted=window.__routeVoiceMuted===true;const speech=window.speechSynthesis;if(speech&&typeof speech.speak==='function'&&!speech.__routeMuteWrapped){speech.__routeMuteWrapped=true;const nativeSpeak=speech.speak.bind(speech);speech.speak=function(u){if(window.__routeVoiceMuted)return;return nativeSpeak(u)}}
    function updateVoice(){const m=window.__routeVoiceMuted===true;voice.textContent=m?'🔇':'🔊';voice.setAttribute('aria-label',m?'Włącz komunikaty głosowe':'Wycisz komunikaty głosowe');voice.title=m?'Włącz komunikaty głosowe':'Wycisz komunikaty głosowe';voice.style.opacity=m?'.72':'1'}voice.onclick=()=>{window.__routeVoiceMuted=!window.__routeVoiceMuted;if(window.__routeVoiceMuted){try{speech?.cancel?.()}catch{}}updateVoice()};updateVoice();
    let northView=false,resumeTimer=0;
    const compassIcon='<span style="position:relative;width:24px;height:28px;display:block"><span style="position:absolute;top:0;left:50%;transform:translateX(-50%);font-size:10px;line-height:10px;color:#fff;font-weight:900">N</span><span style="position:absolute;top:9px;left:50%;transform:translateX(-50%);width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-bottom:12px solid #ff3b30"></span><span style="position:absolute;top:20px;left:50%;transform:translateX(-50%);width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-top:8px solid #eee"></span></span>';
    const navIcon='<span style="display:block;font-size:28px;line-height:28px;font-weight:900;color:#fff">➤</span>';
    function clearResume(){if(resumeTimer){clearTimeout(resumeTimer);resumeTimer=0}}
    function renderState(){if(northView){center.innerHTML=navIcon;center.setAttribute('aria-label','Wróć do nawigacji');center.title='Wróć do nawigacji'}else{center.innerHTML=compassIcon;center.setAttribute('aria-label','Widok na północ');center.title='Widok na północ'}}
    function resumeNavigation(){clearResume();if(!northView)return;northView=false;window.__routeManualView=false;renderState();if(typeof originalCenter==='function')originalCenter.call(center)}
    function scheduleResume(){clearResume();resumeTimer=setTimeout(resumeNavigation,AUTO_RESUME_MS)}
    function markManual(){northView=true;window.__routeManualView=true;renderState();scheduleResume()}
    function enterNorthView(){const map=window.__routeMap;if(!map)return;markManual();try{map.easeTo({bearing:0,pitch:0,zoom:Math.min(map.getZoom(),14.8),duration:500,essential:true})}catch{}}
    renderState();
    center.onclick=()=>{if(northView)resumeNavigation();else enterNorthView()};
    const mapTimer=setInterval(()=>{const map=window.__routeMap;if(!map||map.__compactUiGestures)return;map.__compactUiGestures=true;
      map.on('dragstart',markManual);map.on('zoomstart',markManual);map.on('rotatestart',markManual);map.on('pitchstart',markManual);
      const canvas=map.getCanvasContainer?.()||map.getCanvas?.()?.parentElement;
      if(canvas&&!canvas.__routeManualGestureCapture){canvas.__routeManualGestureCapture=true;
        const manualPointer=e=>{if(e.target===center||center.contains(e.target))return;markManual()};
        canvas.addEventListener('pointerdown',manualPointer,{passive:true,capture:true});
        canvas.addEventListener('touchstart',manualPointer,{passive:true,capture:true});
        canvas.addEventListener('wheel',manualPointer,{passive:true,capture:true});
      }
      clearInterval(mapTimer)},250);setTimeout(()=>clearInterval(mapTimer),30000);return true;
  }
  const timer=setInterval(()=>{if(init())clearInterval(timer)},150);setTimeout(()=>clearInterval(timer),30000);
})();