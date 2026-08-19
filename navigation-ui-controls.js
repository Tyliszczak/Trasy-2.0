(()=>{
  const AUTO_RESUME_MS=15000;

  function init(){
    const root=document.getElementById('routeNavRoot');
    const close=document.getElementById('routeMapClose');
    const center=document.getElementById('routeMapCenter');
    const maneuver=document.getElementById('routeManeuver');
    if(!root||!close||!center||!maneuver)return false;
    if(root.dataset.compactNavUi==='3')return true;
    root.dataset.compactNavUi='3';

    const style=document.createElement('style');
    style.textContent='.maplibregl-ctrl-compass{display:none!important}';
    document.head.appendChild(style);

    const top=close.parentElement;
    const title=top?.querySelector('strong');
    if(title)title.style.display='none';
    if(top){
      top.style.height='0';top.style.minHeight='0';top.style.padding='0';top.style.border='0';
      top.style.background='transparent';top.style.overflow='visible';top.style.position='relative';top.style.zIndex='50040';
    }

    close.textContent='‹';
    close.setAttribute('aria-label','Zamknij nawigację');
    close.title='Wróć do harmonogramu';
    close.style.cssText='position:fixed;top:112px;left:10px;z-index:50100;width:38px;height:38px;min-width:38px;min-height:38px;padding:0;border:1px solid #fff8;border-radius:19px;background:#111d;color:#fff;font-size:32px;line-height:32px;box-shadow:0 2px 9px #000a';

    const originalCenter=center.onclick;
    center.textContent='N';
    center.setAttribute('aria-label','Widok na północ');
    center.title='Widok na północ';
    center.style.cssText='position:fixed;right:12px;top:112px;z-index:50100;width:38px;height:38px;min-width:38px;min-height:38px;padding:0;border:1px solid #fff8;border-radius:19px;background:#111d;color:#fff;font-size:18px;font-weight:900;line-height:38px;box-shadow:0 2px 9px #000a';

    let voice=document.getElementById('routeVoiceToggle');
    if(!voice){voice=document.createElement('button');voice.id='routeVoiceToggle';voice.type='button';root.appendChild(voice)}
    voice.style.cssText='position:fixed;top:112px;left:56px;z-index:50100;width:38px;height:38px;min-width:38px;min-height:38px;padding:0;border:1px solid #fff8;border-radius:19px;background:#111d;color:#fff;font-size:19px;line-height:38px;box-shadow:0 2px 9px #000a';

    window.__routeVoiceMuted=window.__routeVoiceMuted===true;
    const speech=window.speechSynthesis;
    if(speech&&typeof speech.speak==='function'&&!speech.__routeMuteWrapped){
      speech.__routeMuteWrapped=true;
      const nativeSpeak=speech.speak.bind(speech);
      speech.speak=function(utterance){if(window.__routeVoiceMuted)return;return nativeSpeak(utterance)};
    }
    function updateVoice(){
      const muted=window.__routeVoiceMuted===true;
      voice.textContent=muted?'🔇':'🔊';
      voice.setAttribute('aria-label',muted?'Włącz komunikaty głosowe':'Wycisz komunikaty głosowe');
      voice.title=muted?'Włącz komunikaty głosowe':'Wycisz komunikaty głosowe';
      voice.style.opacity=muted?'.72':'1';
    }
    voice.onclick=()=>{window.__routeVoiceMuted=!window.__routeVoiceMuted;if(window.__routeVoiceMuted){try{speech?.cancel?.()}catch{}}updateVoice()};
    updateVoice();

    let overview=false;
    let resumeTimer=0;
    function clearResume(){if(resumeTimer){clearTimeout(resumeTimer);resumeTimer=0}}
    function setOverview(on){
      overview=!!on;
      if(overview){center.textContent='➤';center.setAttribute('aria-label','Wróć do prowadzenia');center.title='Wróć do prowadzenia'}
      else{center.textContent='N';center.setAttribute('aria-label','Widok na północ');center.title='Widok na północ'}
    }
    function resumeNavigation(){
      clearResume();if(!overview)return;
      window.__routeManualView=false;setOverview(false);
      if(typeof originalCenter==='function')originalCenter.call(center);
    }
    function scheduleResume(){clearResume();resumeTimer=setTimeout(resumeNavigation,AUTO_RESUME_MS)}
    function enterNorthView(){
      const map=window.__routeMap;if(!map)return;
      window.__routeManualView=true;setOverview(true);scheduleResume();
      try{map.easeTo({bearing:0,pitch:0,zoom:Math.min(map.getZoom(),14.8),duration:500,essential:true})}catch{}
    }
    center.onclick=()=>{if(!overview)enterNorthView();else resumeNavigation()};

    const markManual=()=>{window.__routeManualView=true;setOverview(true);scheduleResume()};
    const mapTimer=setInterval(()=>{
      const map=window.__routeMap;if(!map||map.__compactUiGestures)return;
      map.__compactUiGestures=true;
      map.on('dragstart',markManual);map.on('zoomstart',markManual);map.on('rotatestart',markManual);map.on('pitchstart',markManual);
      clearInterval(mapTimer);
    },250);
    setTimeout(()=>clearInterval(mapTimer),30000);
    return true;
  }

  const timer=setInterval(()=>{if(init())clearInterval(timer)},150);
  setTimeout(()=>clearInterval(timer),30000);
})();
