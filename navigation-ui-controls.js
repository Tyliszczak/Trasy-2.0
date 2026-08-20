(()=>{
  const AUTO_RESUME_MS=15000;
  function init(){
    const root=document.getElementById('routeNavRoot'),close=document.getElementById('routeMapClose'),center=document.getElementById('routeMapCenter'),maneuver=document.getElementById('routeManeuver');
    if(!root||!close||!center||!maneuver)return false;
    if(root.dataset.compactNavUi==='11')return true;
    root.dataset.compactNavUi='11';

    const style=document.createElement('style');
    style.textContent='.maplibregl-ctrl-compass{display:none!important}';
    document.head.appendChild(style);

    const top=close.parentElement,title=top?.querySelector('strong');
    if(title)title.style.display='none';
    if(top){top.style.height='0';top.style.minHeight='0';top.style.padding='0';top.style.border='0';top.style.background='transparent';top.style.overflow='visible';top.style.position='relative';top.style.zIndex='50040'}

    close.textContent='‹';close.setAttribute('aria-label','Zamknij nawigację');close.title='Wróć do harmonogramu';
    close.style.cssText='position:fixed;top:112px;left:10px;z-index:50100;width:38px;height:38px;min-width:38px;min-height:38px;padding:0;border:1px solid #fff8;border-radius:19px;background:#111d;color:#fff;font-size:32px;line-height:32px;box-shadow:0 2px 9px #000a';

    const originalCenter=center.onclick;
    center.style.cssText='position:fixed;right:12px;top:112px;z-index:50100;width:42px;height:42px;min-width:42px;min-height:42px;padding:0;border:1px solid #fff8;border-radius:21px;background:#111d;color:#fff;box-shadow:0 2px 9px #000a;display:flex;align-items:center;justify-content:center';

    let voice=document.getElementById('routeVoiceToggle');
    if(!voice){voice=document.createElement('button');voice.id='routeVoiceToggle';voice.type='button';root.appendChild(voice)}
    voice.style.cssText='position:fixed;top:112px;left:56px;z-index:50100;width:38px;height:38px;min-width:38px;min-height:38px;padding:0;border:1px solid #fff8;border-radius:19px;background:#111d;color:#fff;font-size:19px;line-height:38px;box-shadow:0 2px 9px #000a';
    window.__routeVoiceMuted=window.__routeVoiceMuted===true;
    const speech=window.speechSynthesis;
    if(speech&&typeof speech.speak==='function'&&!speech.__routeMuteWrapped){speech.__routeMuteWrapped=true;const nativeSpeak=speech.speak.bind(speech);speech.speak=function(u){if(window.__routeVoiceMuted)return;return nativeSpeak(u)}}
    function updateVoice(){const m=window.__routeVoiceMuted===true;voice.textContent=m?'🔇':'🔊';voice.setAttribute('aria-label',m?'Włącz komunikaty głosowe':'Wycisz komunikaty głosowe');voice.title=m?'Włącz komunikaty głosowe':'Wycisz komunikaty głosowe';voice.style.opacity=m?'.72':'1'}
    voice.onclick=()=>{window.__routeVoiceMuted=!window.__routeVoiceMuted;if(window.__routeVoiceMuted){try{speech?.cancel?.()}catch{}}updateVoice()};
    updateVoice();

    let overview=false,resumeTimer=0;
    const compassIcon='<span style="position:relative;width:28px;height:31px;display:block"><span style="position:absolute;top:0;left:50%;transform:translateX(-50%);font-size:11px;line-height:11px;color:#fff;font-weight:1000">N</span><span style="position:absolute;top:9px;left:50%;transform:translateX(-50%);width:0;height:0;border-left:7px solid transparent;border-right:7px solid transparent;border-bottom:13px solid #ff3b30"></span><span style="position:absolute;top:21px;left:50%;transform:translateX(-50%);width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-top:8px solid #eee"></span></span>';
    const navIcon='<span style="display:block;width:25px;height:29px;position:relative"><span style="position:absolute;left:50%;top:1px;transform:translateX(-50%);width:0;height:0;border-left:10px solid transparent;border-right:10px solid transparent;border-bottom:24px solid #fff;filter:drop-shadow(0 1px 2px #0008)"></span><span style="position:absolute;left:50%;top:9px;transform:translateX(-50%);width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-bottom:12px solid #111d"></span></span>';

    function clearResume(){if(resumeTimer){clearTimeout(resumeTimer);resumeTimer=0}}
    function renderState(){
      if(overview){center.innerHTML=navIcon;center.setAttribute('aria-label','Wróć do widoku prowadzenia');center.title='Wróć do nawigacji'}
      else{center.innerHTML=compassIcon;center.setAttribute('aria-label','Pokaż trasę z góry');center.title='Widok trasy z góry'}
    }
    function resumeNavigation(){
      clearResume();
      overview=false;
      window.__routeManualView=false;
      renderState();
      if(typeof originalCenter==='function')originalCenter.call(center);
    }
    function scheduleResume(){clearResume();resumeTimer=setTimeout(resumeNavigation,AUTO_RESUME_MS)}
    function markManual(){overview=true;window.__routeManualView=true;renderState();scheduleResume()}
    window.__routeEnterManualView=markManual;
    window.__routeResumeNavigation=resumeNavigation;

    function parseCoord(v){const m=String(v||'').match(/(-?\d+(?:\.\d+)?)\s*[,; ]\s*(-?\d+(?:\.\d+)?)/);return m?[+m[1],+m[2]]:null}
    function routeBounds(){
      const points=[...document.querySelectorAll('#scheduleBody tr[data-coordinate]')].map(r=>parseCoord(r.dataset.coordinate)).filter(Boolean);
      if(!points.length)return null;
      let minLat=points[0][0],maxLat=points[0][0],minLng=points[0][1],maxLng=points[0][1];
      points.forEach(([lat,lng])=>{minLat=Math.min(minLat,lat);maxLat=Math.max(maxLat,lat);minLng=Math.min(minLng,lng);maxLng=Math.max(maxLng,lng)});
      return [[minLng,minLat],[maxLng,maxLat]];
    }
    function enterOverview(){
      const map=window.__routeMap;if(!map)return;
      markManual();
      const bounds=routeBounds();
      try{
        if(bounds){map.fitBounds(bounds,{padding:{top:175,bottom:85,left:55,right:55},bearing:0,pitch:0,duration:550,essential:true,maxZoom:15})}
        else{map.easeTo({bearing:0,pitch:0,zoom:Math.min(map.getZoom(),14.8),duration:500,essential:true})}
      }catch{}
    }

    renderState();
    center.onclick=()=>{if(overview)resumeNavigation();else enterOverview()};

    const mapTimer=setInterval(()=>{
      const map=window.__routeMap;if(!map||map.__compactUiGesturesV11)return;
      map.__compactUiGesturesV11=true;
      map.on('dragstart',markManual);map.on('zoomstart',markManual);map.on('rotatestart',markManual);map.on('pitchstart',markManual);
      const canvas=map.getCanvasContainer?.()||map.getCanvas?.()?.parentElement;
      if(canvas&&!canvas.__routeManualGestureCaptureV11){canvas.__routeManualGestureCaptureV11=true;
        const manualPointer=e=>{if(e.target===center||center.contains(e.target))return;markManual()};
        canvas.addEventListener('pointerdown',manualPointer,{passive:true,capture:true});
        canvas.addEventListener('touchstart',manualPointer,{passive:true,capture:true});
        canvas.addEventListener('wheel',manualPointer,{passive:true,capture:true});
      }
      clearInterval(mapTimer)
    },250);
    setTimeout(()=>clearInterval(mapTimer),30000);
    return true;
  }
  const timer=setInterval(()=>{if(init())clearInterval(timer)},150);
  setTimeout(()=>clearInterval(timer),30000);
})();
