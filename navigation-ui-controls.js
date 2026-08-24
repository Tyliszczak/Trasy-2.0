(()=>{
  const AUTO_RESUME_MS=15000;
  const GUIDANCE_PITCH=58;
  const GUIDANCE_ZOOM=17.2;
  const CAMERA_DURATION_MS=760;
  const STATIONARY_RADIUS_M=7;
  const HEADING_MOVE_M=9;

  const root=document.getElementById('routeNavRoot');
  const close=document.getElementById('routeMapClose');
  const center=document.getElementById('routeMapCenter');
  const maneuver=document.getElementById('routeManeuver');
  if(!root||!close||!center||!maneuver)return;

  root.dataset.compactNavUi='21';

  const style=document.createElement('style');
  style.textContent=`
    .maplibregl-ctrl-compass{display:none!important}
    .route-view-control{box-shadow:0 0 0 2px rgba(0,0,0,.1)}
    #routePitchToggle{box-sizing:border-box;width:34px;height:48px;padding:2px 1px 1px;border:0;background:#fff;color:#333;display:flex;flex-direction:column;align-items:center;justify-content:center;font:700 9px/1 Arial,sans-serif;cursor:pointer}
    #routePitchToggle svg{display:block}
    #routePitchToggle:hover{background:#f2f2f2}
  `;
  document.head.appendChild(style);

  const top=close.parentElement;
  const title=top?.querySelector('strong');
  if(title)title.style.display='none';
  if(top){
    top.style.height='0';
    top.style.minHeight='0';
    top.style.padding='0';
    top.style.border='0';
    top.style.background='transparent';
    top.style.overflow='visible';
    top.style.position='relative';
    top.style.zIndex='50040';
  }

  close.textContent='‹';
  close.setAttribute('aria-label','Wróć');
  close.title='Wróć';
  close.style.cssText='position:fixed;top:112px;left:10px;z-index:50100;width:38px;height:38px;padding:0;border:1px solid #fff8;border-radius:19px;background:#111d;color:#fff;font-size:32px;line-height:32px;box-shadow:0 2px 9px #000a;display:flex;align-items:center;justify-content:center';

  center.style.cssText='position:fixed;right:12px;top:112px;z-index:50100;width:42px;height:42px;padding:0;border:1px solid #fff8;border-radius:21px;background:#111d;color:#fff;box-shadow:0 2px 9px #000a;display:flex;align-items:center;justify-content:center';

  let voice=document.getElementById('routeVoiceToggle');
  if(!voice){
    voice=document.createElement('button');
    voice.id='routeVoiceToggle';
    voice.type='button';
    root.appendChild(voice);
  }
  voice.style.cssText='position:fixed;top:162px;right:14px;z-index:50100;width:38px;height:38px;padding:0;border:1px solid #fff8;border-radius:19px;background:#111d;color:#fff;font-size:19px;box-shadow:0 2px 9px #000a';
  window.__routeVoiceMuted=window.__routeVoiceMuted===true;
  const speech=window.speechSynthesis;
  function updateVoice(){
    const muted=window.__routeVoiceMuted===true;
    voice.textContent=muted?'🔇':'🔊';
    voice.title=muted?'Włącz komunikaty głosowe':'Wycisz komunikaty głosowe';
  }
  voice.onclick=()=>{
    window.__routeVoiceMuted=!window.__routeVoiceMuted;
    if(window.__routeVoiceMuted){
      try{speech?.cancel?.()}catch{}
    }
    updateVoice();
  };
  updateVoice();

  const infoPanel=maneuver.parentElement;
  function repositionControls(){
    if(!infoPanel)return;
    const rect=infoPanel.getBoundingClientRect();
    const controlTop=Math.max(10,Math.ceil(rect.bottom)+10);
    close.style.top=`${controlTop}px`;
    center.style.top=`${controlTop}px`;
    voice.style.top=`${controlTop+50}px`;
  }
  if('ResizeObserver'in window){
    const observer=new ResizeObserver(repositionControls);
    observer.observe(infoPanel);
  }
  window.addEventListener('resize',repositionControls,{passive:true});
  document.addEventListener('trasy:route-map-ready',repositionControls);
  requestAnimationFrame(repositionControls);

  const navIcon='<svg viewBox="0 0 32 32" width="29" height="29"><path d="M27.4 4.7 17.8 27c-.7 1.7-3.1 1.5-3.5-.3l-1.9-8.8-8.8-1.9c-1.8-.4-2-2.8-.3-3.5L25.6 3c1.2-.5 2.3.6 1.8 1.7Z" fill="#fff"/><path d="m13.2 17.1 7.8-7.8" stroke="#111" stroke-width="2.4"/></svg>';
  const flatGrid='<svg viewBox="0 0 28 22" width="25" height="20"><rect x="3" y="2" width="22" height="17" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M10.3 2v17M17.7 2v17M3 7.7h22M3 13.3h22" stroke="currentColor"/></svg>';
  const tiltedGrid='<svg viewBox="0 0 28 22" width="25" height="20"><path d="M7 2h14l4 17H3L7 2Z" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="m11.7 2-2 17M16.3 2l2 17M5.7 7.7h16.6M4.3 13.3h19.4" stroke="currentColor"/></svg>';
  center.innerHTML=navIcon;
  center.title='Wróć do nawigacji';

  function distanceMetres(a,b){
    if(!a||!b)return Infinity;
    const R=6371000;
    const p=Math.PI/180;
    const dLat=(b[1]-a[1])*p;
    const dLon=(b[0]-a[0])*p;
    const x=Math.sin(dLat/2)**2+Math.cos(a[1]*p)*Math.cos(b[1]*p)*Math.sin(dLon/2)**2;
    return 2*R*Math.asin(Math.sqrt(x));
  }

  class RouteCameraController{
    constructor(map){
      this.map=map;
      this.state='following';
      this.resumeTimer=0;
      this.transitionTimer=0;
      this.latestTarget=null;
      this.lastNavCenter=null;
      this.stableBearing=Number.isFinite(map.getBearing?.())?map.getBearing():0;
      this.pitchButton=null;
      this.installControl();
      this.installGestureListeners();
      this.render();
    }

    installControl(){
      const controller=this;
      const control={
        onAdd(){
          const group=document.createElement('div');
          group.className='maplibregl-ctrl maplibregl-ctrl-group route-view-control';
          const button=document.createElement('button');
          button.id='routePitchToggle';
          button.type='button';
          button.setAttribute('aria-label','Zmień widok mapy');
          button.onclick=event=>{
            event.preventDefault();
            event.stopPropagation();
            controller.togglePitch();
          };
          group.appendChild(button);
          controller.pitchButton=button;
          controller.render();
          return group;
        },
        onRemove(){
          controller.pitchButton?.parentElement?.remove();
          controller.pitchButton=null;
        }
      };
      this.map.addControl(control,'bottom-right');
    }

    installGestureListeners(){
      const manual=event=>{
        if(!event?.trasyCamera)this.enterManual();
      };
      this.map.on('dragstart',manual);
      this.map.on('zoomstart',manual);
      this.map.on('rotatestart',manual);
      this.map.on('pitchstart',manual);
      this.map.on('moveend',()=>this.finishTransition());
      this.map.on('pitchend',()=>this.render());
      this.map.on('zoomend',()=>this.render());
      this.map.on('rotateend',()=>this.render());
    }

    clearTimers(){
      if(this.resumeTimer){
        clearTimeout(this.resumeTimer);
        this.resumeTimer=0;
      }
      if(this.transitionTimer){
        clearTimeout(this.transitionTimer);
        this.transitionTimer=0;
      }
    }

    scheduleResume(){
      if(this.resumeTimer)clearTimeout(this.resumeTimer);
      this.resumeTimer=setTimeout(()=>this.resume(),AUTO_RESUME_MS);
    }

    startGuidance(){
      this.clearTimers();
      this.state='following';
      window.__routeManualView=false;
      this.render();
    }

    enterManual(){
      this.state='manual';
      window.__routeManualView=true;
      this.scheduleResume();
      this.render();
    }

    follow(target){
      this.latestTarget={
        center:target.center.slice(),
        bearing:Number(target.bearing)||0,
        offset:Array.isArray(target.offset)?target.offset.slice():[0,0],
        instant:target.instant===true
      };
      if(this.state==='manual')return;
      this.state='following';
      window.__routeManualView=false;
      this.moveToTarget(this.latestTarget,this.latestTarget.instant?0:CAMERA_DURATION_MS);
    }

    smoothBearing(target){
      const center=target.center;
      const moved=this.lastNavCenter?distanceMetres(this.lastNavCenter,center):Infinity;
      const requested=Number(target.bearing)||0;
      if(!this.lastNavCenter||moved>=HEADING_MOVE_M){
        const delta=((requested-this.stableBearing+540)%360)-180;
        this.stableBearing=(this.stableBearing+delta*.42+360)%360;
        this.lastNavCenter=center.slice();
      }else if(moved>STATIONARY_RADIUS_M){
        const delta=((requested-this.stableBearing+540)%360)-180;
        this.stableBearing=(this.stableBearing+delta*.16+360)%360;
      }
      return this.stableBearing;
    }

    moveToTarget(target,duration){
      this.map.easeTo({
        center:target.center,
        zoom:GUIDANCE_ZOOM,
        bearing:this.smoothBearing(target),
        pitch:GUIDANCE_PITCH,
        offset:target.offset,
        duration,
        easing:t=>1-Math.pow(1-t,3),
        essential:true
      },{trasyCamera:true});
    }

    resume(){
      this.clearTimers();
      this.state='transition';
      window.__routeManualView=false;
      const target=this.latestTarget||{
        center:this.map.getCenter().toArray(),
        bearing:this.map.getBearing(),
        offset:[0,0]
      };
      this.moveToTarget(target,650);
      this.transitionTimer=setTimeout(()=>this.finishTransition(),800);
      this.render();
    }

    finishTransition(){
      if(this.state!=='transition')return;
      if(this.transitionTimer){
        clearTimeout(this.transitionTimer);
        this.transitionTimer=0;
      }
      this.state='following';
      window.__routeManualView=false;
      this.render();
    }

    togglePitch(){
      if(Number(this.map.getPitch())>20){
        this.enterManual();
        this.map.easeTo({pitch:0,duration:400,essential:true},{trasyCamera:true});
      }else{
        this.resume();
      }
      this.render();
    }

    render(){
      center.hidden=this.state!=='manual';
      if(!this.pitchButton)return;
      const pitched=Number(this.map.getPitch())>20;
      this.pitchButton.innerHTML=(pitched?flatGrid:tiltedGrid)+`<span>${pitched?'2D':'3D'}</span>`;
      this.pitchButton.title=pitched?'Widok 2D z góry':'Widok 3D pochylony';
    }
  }

  function attach(map){
    if(!map||window.__routeCameraController?.map===map)return;
    const controller=new RouteCameraController(map);
    window.__routeCameraController=controller;
    window.__routeEnterManualView=()=>controller.enterManual();
    window.__routeResumeNavigation=()=>controller.resume();
    center.onclick=()=>controller.resume();
  }

  document.addEventListener('trasy:route-map-ready',event=>attach(event.detail?.map));
  if(window.__routeMap)attach(window.__routeMap);
})();
