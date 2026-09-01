(()=>{
  const AUTO_RESUME_MS=15000;
  const GUIDANCE_PITCH=58;
  const GUIDANCE_ZOOM=17.2;
  const CAMERA_MIN_DURATION_MS=550;
  const CAMERA_MAX_DURATION_MS=1350;
  const CAMERA_INTERVAL_FACTOR=1.12;
  const STATIONARY_RADIUS_M=3;
  const HEADING_MOVE_M=4;

  const root=document.getElementById('routeNavRoot');
  const close=document.getElementById('routeMapClose');
  const center=document.getElementById('routeMapCenter');
  const maneuver=document.getElementById('routeManeuver');
  if(!root||!close||!center||!maneuver)return;

  root.dataset.compactNavUi='23';

  const top=close.parentElement;
  const title=top?.querySelector('strong');
  top?.classList.add('routeNavChromeTop');
  title?.classList.add('routeNavTitleHidden');

  close.textContent='‹';
  close.setAttribute('aria-label','Wróć');
  close.title='Wróć';

  let voice=document.getElementById('routeVoiceToggle');
  if(!voice){
    voice=document.createElement('button');
    voice.id='routeVoiceToggle';
    voice.type='button';
    root.appendChild(voice);
  }

  const northIndicator=document.createElement('div');
  northIndicator.id='routeNorthIndicator';
  northIndicator.hidden=true;
  northIndicator.setAttribute('aria-label','Kierunek północny');
  northIndicator.innerHTML='<span>N</span><span class="northArrow" aria-hidden="true">↑</span>';
  root.appendChild(northIndicator);

  const layoutStyle=document.createElement('style');
  layoutStyle.textContent=`
    #routeFunctionStack{
      position:fixed;
      left:12px;
      top:112px;
      z-index:50120;
      display:flex;
      flex-direction:column;
      align-items:center;
      gap:7px;
      width:42px;
      pointer-events:none;
    }
    #routeFunctionStack>#routeMapClose,
    #routeFunctionStack>#routeMapCenter,
    #routeFunctionStack>#routeVoiceToggle,
    #routeFunctionStack>.maplibregl-ctrl-group,
    #routeFunctionStack>#routeNorthIndicator{
      position:static!important;
      top:auto!important;
      right:auto!important;
      bottom:auto!important;
      left:auto!important;
      margin:0!important;
      pointer-events:auto;
      flex:0 0 auto;
    }
    #routeFunctionStack>#routeMapClose,
    #routeFunctionStack>#routeMapCenter,
    #routeFunctionStack>#routeVoiceToggle{
      transform:none!important;
    }
    #routeFunctionStack>.maplibregl-ctrl-group{
      display:flex!important;
      flex-direction:column!important;
      align-items:stretch!important;
      overflow:hidden;
      border-radius:5px!important;
      box-shadow:0 1px 6px #0008!important;
    }
    #routeFunctionStack>.maplibregl-ctrl-group button,
    #routeFunctionStack>#routePitchToggle{
      margin:0!important;
    }
    #routeFunctionStack>#routeNorthIndicator{
      width:42px!important;
      height:42px!important;
    }
  `;
  document.head.appendChild(layoutStyle);

  function ensureFunctionStack(){
    let stack=document.getElementById('routeFunctionStack');
    if(!stack){
      stack=document.createElement('div');
      stack.id='routeFunctionStack';
      stack.setAttribute('aria-label','Funkcje nawigacji');
      root.appendChild(stack);
    }
    if(close.parentElement!==stack)stack.appendChild(close);
    if(center.parentElement!==stack)stack.appendChild(center);
    if(voice.parentElement!==stack)stack.appendChild(voice);
    return stack;
  }

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
    const stack=ensureFunctionStack();
    if(!infoPanel)return;
    const rect=infoPanel.getBoundingClientRect();
    const controlTop=Math.max(10,Math.ceil(rect.bottom)+10);
    stack.style.top=`${controlTop}px`;
    mergeViewControl();
  }
  if('ResizeObserver'in window){
    const observer=new ResizeObserver(repositionControls);
    observer.observe(infoPanel);
  }
  window.addEventListener('resize',repositionControls,{passive:true});
  document.addEventListener('trasy:route-map-ready',repositionControls);

  const navIcon='<svg viewBox="0 0 32 32" width="29" height="29"><path d="M27.4 4.7 17.8 27c-.7 1.7-3.1 1.5-3.5-.3l-1.9-8.8-8.8-1.9c-1.8-.4-2-2.8-.3-3.5L25.6 3c1.2-.5 2.3.6 1.8 1.7Z" fill="#fff"/><path d="m13.2 17.1 7.8-7.8" stroke="#111" stroke-width="2.4"/></svg>';
  const flatGrid='<svg viewBox="0 0 28 22" width="25" height="20"><rect x="3" y="2" width="22" height="17" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M10.3 2v17M17.7 2v17M3 7.7h22M3 13.3h22" stroke="currentColor"/></svg>';
  const tiltedGrid='<svg viewBox="0 0 28 22" width="25" height="20"><path d="M7 2h14l4 17H3L7 2Z" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="m11.7 2-2 17M16.3 2l2 17M5.7 7.7h16.6M4.3 13.3h19.4" stroke="currentColor"/></svg>';

  function mergeViewControl(){
    const pitch=document.getElementById('routePitchToggle');
    const canvas=document.getElementById('routeMapCanvas');
    const stack=ensureFunctionStack();
    if(!pitch||!canvas)return false;
    const groups=[...stack.querySelectorAll('.maplibregl-ctrl-group'),...canvas.querySelectorAll('.maplibregl-ctrl-group')];
    const zoomGroup=groups.find(group=>group.querySelector('.maplibregl-ctrl-zoom-in')&&group.querySelector('.maplibregl-ctrl-zoom-out'));
    if(!zoomGroup)return false;
    const zoomIn=zoomGroup.querySelector('.maplibregl-ctrl-zoom-in');
    const oldParent=pitch.parentElement;
    if(pitch.parentElement!==zoomGroup||pitch.nextElementSibling!==zoomIn)zoomGroup.insertBefore(pitch,zoomIn);
    if(oldParent?.classList?.contains('route-view-control')&&!oldParent.children.length)oldParent.remove();
    if(zoomGroup.parentElement!==stack)stack.appendChild(zoomGroup);
    if(northIndicator.parentElement!==stack)stack.appendChild(northIndicator);
    return true;
  }

  ensureFunctionStack();
  center.innerHTML=navIcon;
  center.title='Wróć do nawigacji';
  requestAnimationFrame(repositionControls);

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
      this.lastFollowAt=0;
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
      if(!mergeViewControl())requestAnimationFrame(()=>mergeViewControl());
      requestAnimationFrame(repositionControls);
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
      this.map.on('rotate',()=>this.renderNorthIndicator());
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
      this.lastNavCenter=null;
      this.lastFollowAt=0;
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

      const now=performance.now();
      const interval=this.lastFollowAt?now-this.lastFollowAt:900;
      this.lastFollowAt=now;
      const duration=this.latestTarget.instant
        ?0
        :Math.max(
            CAMERA_MIN_DURATION_MS,
            Math.min(CAMERA_MAX_DURATION_MS,interval*CAMERA_INTERVAL_FACTOR)
          );

      this.moveToTarget(this.latestTarget,duration,true);
    }

    smoothBearing(target){
      const center=target.center;
      const moved=this.lastNavCenter?distanceMetres(this.lastNavCenter,center):Infinity;
      const requested=Number(target.bearing)||0;
      if(!this.lastNavCenter){
        this.stableBearing=(requested+360)%360;
        this.lastNavCenter=center.slice();
      }else if(moved>=HEADING_MOVE_M){
        const delta=((requested-this.stableBearing+540)%360)-180;
        this.stableBearing=(this.stableBearing+delta*.78+360)%360;
        this.lastNavCenter=center.slice();
      }else if(moved>STATIONARY_RADIUS_M){
        const delta=((requested-this.stableBearing+540)%360)-180;
        this.stableBearing=(this.stableBearing+delta*.42+360)%360;
      }
      return this.stableBearing;
    }

    moveToTarget(target,duration,continuous=false){
      const profile=window.__routeCameraProfile||{};
      const zoom=Number.isFinite(Number(profile.zoom))?Number(profile.zoom):GUIDANCE_ZOOM;
      const pitch=Number.isFinite(Number(profile.pitch))?Number(profile.pitch):GUIDANCE_PITCH;
      this.map.easeTo({
        center:target.center,
        zoom,
        bearing:this.smoothBearing(target),
        pitch,
        offset:target.offset,
        duration,
        easing:continuous?(t=>t):(t=>1-Math.pow(1-t,3)),
        essential:true
      },{trasyCamera:true});
    }

    resume(){
      this.clearTimers();
      this.state='transition';
      this.lastFollowAt=0;
      window.__routeManualView=false;
      const target=this.latestTarget||{
        center:this.map.getCenter().toArray(),
        bearing:this.map.getBearing(),
        offset:[0,0]
      };
      this.stableBearing=((Number(target.bearing)||0)+360)%360;
      this.lastNavCenter=target.center.slice();
      this.moveToTarget(target,650,false);
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
      this.renderNorthIndicator();
      if(!this.pitchButton)return;
      const pitched=Number(this.map.getPitch())>20;
      this.pitchButton.innerHTML=`<span>${pitched?'2D':'3D'}</span>`+(pitched?flatGrid:tiltedGrid);
      this.pitchButton.title=pitched?'Widok 2D z góry':'Widok 3D pochylony';
    }

    renderNorthIndicator(){
      const mapBearing=Number(this.map.getBearing?.())||0;
      const guidanceBearing=Number(this.latestTarget?.bearing);
      const difference=Number.isFinite(guidanceBearing)
        ?Math.abs(((mapBearing-guidanceBearing+540)%360)-180)
        :0;
      northIndicator.hidden=this.state!=='manual'||difference<8;
      northIndicator.querySelector('.northArrow').style.transform=`rotate(${-mapBearing}deg)`;
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