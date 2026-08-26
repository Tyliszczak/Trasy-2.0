from pathlib import Path
import re

ROOT=Path(__file__).resolve().parents[1]

def path(name): return ROOT/name
def read(name): return path(name).read_text(encoding='utf-8')
def write(name,text): path(name).write_text(text,encoding='utf-8')
def must_replace(text,old,new,label):
    if old not in text: raise RuntimeError(f'{label}: nie znaleziono fragmentu')
    return text.replace(old,new,1)
def must_sub(text,pattern,repl,label,flags=re.S):
    result,count=re.subn(pattern,repl,text,count=1,flags=flags)
    if count!=1: raise RuntimeError(f'{label}: podmiany={count}')
    return result

# -----------------------------------------------------------------------------
# CSS: domknij statyczny UI, żeby JS nie wstrzykiwał arkuszy i cssText.
# -----------------------------------------------------------------------------
css=read('navigation.css')
css += r'''

/* Statyczny chrom nawigacji — pozycja pionowa jest tylko korygowana przez JS. */
.routeNavChromeTop{height:0!important;min-height:0!important;padding:0!important;border:0!important;background:transparent!important;overflow:visible!important;position:relative!important;z-index:50040!important}
.routeNavChromeTop>strong{display:none!important}
#routeMapClose{position:fixed;top:112px;left:10px;z-index:50100;width:38px!important;min-width:38px!important;height:38px!important;min-height:38px!important;padding:0!important;border:1px solid #fff8!important;border-radius:19px!important;background:#111d!important;color:#fff!important;font-size:32px!important;line-height:32px!important;box-shadow:0 2px 9px #000a!important;display:flex!important;align-items:center!important;justify-content:center!important}
#routeMapCenter{position:fixed;right:12px;top:112px;z-index:50100;width:42px!important;min-width:42px!important;height:42px!important;min-height:42px!important;padding:0!important;border:1px solid #fff8!important;border-radius:21px!important;background:#111d!important;color:#fff!important;box-shadow:0 2px 9px #000a!important;display:flex!important;align-items:center!important;justify-content:center!important}
#routeVoiceToggle{position:fixed;top:162px;right:14px;z-index:50100;width:38px!important;min-width:38px!important;height:38px!important;min-height:38px!important;padding:0!important;border:1px solid #fff8!important;border-radius:19px!important;background:#111d!important;color:#fff!important;font-size:19px!important;box-shadow:0 2px 9px #000a!important}
.routeNavInfoShell{padding:7px 12px!important;min-height:0!important}
.routeNavInfoRow{margin-top:0!important;justify-content:flex-start!important;align-items:center!important}
'''
write('navigation.css',css)

# -----------------------------------------------------------------------------
# GPS engine: START powrotu jest stanem trasy, nie celem GPS.
# -----------------------------------------------------------------------------
engine=read('gps-stop-engine.js')
engine=must_replace(engine,
"function selectInitial(stops,position,{emptyRun=false,speedMps=0,heading=null,headingReliable=false}={}){\n    if(!stops.length)return null;\n    if(emptyRun)return stops.length-1;",
"function selectInitial(stops,position,{emptyRun=false,speedMps=0,heading=null,headingReliable=false,minimumIndex=0}={}){\n    if(!stops.length)return null;\n    if(emptyRun)return stops.length-1;\n    const firstIndex=Math.max(0,Math.min(stops.length-1,Math.trunc(Number(minimumIndex)||0)));",
'engine select signature')
engine=must_replace(engine,"for(let i=0;i<stops.length;i+=1){","for(let i=firstIndex;i<stops.length;i+=1){",'engine moving loop')
engine=must_replace(engine,
"    const distances=stops.map(stop=>distanceMeters(position,stop.coord));\n    let nearest=0;\n    for(let i=1;i<distances.length;i+=1){\n      if(distances[i]<distances[nearest])nearest=i;\n    }\n    if(nearest>0&&distances[nearest]<=config.initialNearbyMeters&&distances[0]-distances[nearest]>=config.initialAdvantageMeters)return nearest;\n    return 0;",
"    const distances=stops.map(stop=>distanceMeters(position,stop.coord));\n    let nearest=firstIndex;\n    for(let i=firstIndex+1;i<distances.length;i+=1){\n      if(distances[i]<distances[nearest])nearest=i;\n    }\n    if(nearest>firstIndex&&distances[nearest]<=config.initialNearbyMeters&&distances[firstIndex]-distances[nearest]>=config.initialAdvantageMeters)return nearest;\n    return firstIndex;",
'engine stationary selection')
engine=must_replace(engine,
"  function update({stops,position,accuracy,speedMps=0,heading=null,headingReliable=false,emptyRun=false}){\n    if(!Array.isArray(stops)||!stops.length||!position)return{...snapshot(),changed:false,reason:'no-stops'};",
"  function update({stops,position,accuracy,speedMps=0,heading=null,headingReliable=false,emptyRun=false,minimumIndex=0}){\n    if(!Array.isArray(stops)||!stops.length||!position)return{...snapshot(),changed:false,reason:'no-stops'};\n    const firstIndex=Math.max(0,Math.min(stops.length-1,Math.trunc(Number(minimumIndex)||0)));",
'engine update signature')
engine=must_replace(engine,"    if(index===null||index<0||index>=stops.length){","    if(index===null||index<firstIndex||index>=stops.length){",'engine minimum invalid')
engine=must_replace(engine,
"      const selected=selectInitial(stops,position,{emptyRun:false,speedMps,heading,headingReliable});",
"      const selected=selectInitial(stops,position,{emptyRun:false,speedMps,heading,headingReliable,minimumIndex:firstIndex});",
'engine minimum select')
write('gps-stop-engine.js',engine)

# -----------------------------------------------------------------------------
# Tracker: sam respektuje minimalny indeks na POWROCIE, bez return-gps-mode.
# -----------------------------------------------------------------------------
tracker=read('gps-stop-tracker.js')
tracker=must_sub(tracker,r"\n  const style=document\.createElement\('style'\);.*?document\.head\.append\(style\);\n",'\n','tracker css')
tracker=must_replace(tracker,
"  function stops(){\n    return rows().map((row,index)=>({",
"  function minimumTargetIndex(){\n    return body.dataset.direction==='return'&&body.dataset.emptyRun!=='1'?1:0;\n  }\n\n  function stops(){\n    return rows().map((row,index)=>({",
'tracker min helper')
tracker=must_replace(tracker,
"      emptyRun:body.dataset.emptyRun==='1'\n    });",
"      emptyRun:body.dataset.emptyRun==='1',\n      minimumIndex:minimumTargetIndex()\n    });",
'tracker engine minimum')
tracker=must_replace(tracker,
"  function setManualIndex(index,source){\n    const routeRows=rows();\n    if(!Number.isInteger(index)||index<0||index>=routeRows.length)return;",
"  function setManualIndex(index,source){\n    const routeRows=rows();\n    const minimum=minimumTargetIndex();\n    if(!Number.isInteger(index)||index<minimum||index>=routeRows.length)return;",
'tracker manual minimum')
write('gps-stop-tracker.js',tracker)

# -----------------------------------------------------------------------------
# POWRÓT: jeden właściciel START-u, stanu origin i ostrzeżenia przed czasem.
# -----------------------------------------------------------------------------
ret=read('return-route.js')
ret=must_replace(ret,
"  const time=globalThis.__trasyTime;\n  if(!body||!controls||!routeNameEl||!forwardTimeSelect||!time)return;",
"  const time=globalThis.__trasyTime;\n  const geo=globalThis.__trasyGeo;\n  if(!body||!controls||!routeNameEl||!forwardTimeSelect||!time||!geo)return;",
'return geo')
ret=must_sub(ret,r"\n  const style=document\.createElement\('style'\);.*?document\.head\.append\(style\);\n",'\n','return css')
needle="  const parkingData=import('./parking-data.js');\n"
insert="""  const parkingData=import('./parking-data.js');

  const RETURN_START_RADIUS_M=350;
  const RETURN_START_OUTSIDE_M=450;
  const RETURN_DEPARTURE_DELTA_M=25;
  const RETURN_DEPARTURE_FIXES=2;
  const RETURN_NEXT_HEADING_MAX=85;
  const RETURN_WARNING_MS=20000;
  let returnStartArmed=false,returnMinStartDistance=Infinity,returnDepartureFixes=0;
  let returnLastPosition=null,returnDerivedHeading=null,returnWarningTimer=0;
"""
ret=must_replace(ret,needle,insert,'return guard vars')
anchor="  function add15(t){return time.addMinutesToTime(t,15)}\n"
helpers="""  function hideReturnWarning(){
    clearTimeout(returnWarningTimer);returnWarningTimer=0;
    const el=document.getElementById('returnEarlyDepartureWarning');
    if(el)el.hidden=true;
  }
  function resetReturnOriginTracking(){
    returnStartArmed=false;returnMinStartDistance=Infinity;returnDepartureFixes=0;
    returnLastPosition=null;returnDerivedHeading=null;hideReturnWarning();
  }
  function returnPlanDate(){
    const match=String(body.dataset.returnStart||'').trim().match(/^(\\d{1,2}):(\\d{2})$/);
    if(!match)return null;
    const date=new Date();date.setHours(Number(match[1]),Number(match[2]),0,0);return date;
  }
  function showReturnWarning(){
    let el=document.getElementById('returnEarlyDepartureWarning');
    if(!el){
      el=document.createElement('div');el.id='returnEarlyDepartureWarning';
      el.setAttribute('role','status');el.setAttribute('aria-live','polite');document.body.append(el);
    }
    const plan=String(body.dataset.returnStart||'').trim();
    el.innerHTML=`<div>ODJECHAŁEŚ PRZED CZASEM</div><small>Planowany start: ${plan}</small><button type=\"button\">OK</button>`;
    el.querySelector('button').onclick=hideReturnWarning;el.hidden=false;
    clearTimeout(returnWarningTimer);returnWarningTimer=setTimeout(hideReturnWarning,RETURN_WARNING_MS);
  }
  function clearReturnOrigin(reason){
    if(body.dataset.returnOriginActive!=='1')return;
    body.dataset.returnOriginActive='';
    body.dispatchEvent(new CustomEvent('return-origin-change',{bubbles:true,detail:{active:false,reason}}));
  }
  function onReturnPosition(position){
    if(direction!=='return'||emptyRun||body.dataset.returnOriginActive!=='1')return;
    const routeRows=[...body.querySelectorAll('tr:not([data-parking-row])')].filter(row=>geo.parseCoordinate(row.dataset.coordinate));
    if(routeRows.length<2)return;
    const accuracy=Number(position?.coords?.accuracy)||999;
    if(accuracy>120)return;
    const start=geo.parseCoordinate(routeRows[0].dataset.coordinate),next=geo.parseCoordinate(routeRows[1].dataset.coordinate);
    const here=[Number(position.coords.latitude),Number(position.coords.longitude)];
    if(!start||!next||!Number.isFinite(here[0])||!Number.isFinite(here[1]))return;

    const startDistance=geo.distanceMeters(here,start);
    if(!returnStartArmed){
      if(startDistance<=RETURN_START_RADIUS_M){returnStartArmed=true;returnMinStartDistance=startDistance}
      else if(startDistance>=RETURN_START_OUTSIDE_M){clearReturnOrigin('outside-start');return}
    }
    if(!returnStartArmed)return;
    returnMinStartDistance=Math.min(returnMinStartDistance,startDistance);

    let heading=Number(position.coords.heading);
    if(!Number.isFinite(heading)||heading<0){
      if(returnLastPosition&&geo.distanceMeters(returnLastPosition,here)>=6)heading=geo.bearingDegrees(returnLastPosition,here);
      else heading=returnDerivedHeading;
    }
    if(Number.isFinite(heading))returnDerivedHeading=heading;
    if(!returnLastPosition||geo.distanceMeters(returnLastPosition,here)>=2)returnLastPosition=here;

    const towardNext=Number.isFinite(returnDerivedHeading)&&geo.angleDifference(returnDerivedHeading,geo.bearingDegrees(here,next))<=RETURN_NEXT_HEADING_MAX;
    const movedAway=startDistance>=returnMinStartDistance+RETURN_DEPARTURE_DELTA_M;
    if(towardNext&&movedAway)returnDepartureFixes+=1;else returnDepartureFixes=0;
    if(returnDepartureFixes<RETURN_DEPARTURE_FIXES)return;

    const plan=returnPlanDate();
    const early=Boolean(plan&&Date.now()<plan.getTime());
    clearReturnOrigin('confirmed-departure');
    if(early)showReturnWarning();
  }

"""
ret=must_replace(ret,anchor,helpers+anchor,'return helpers')
old="""      if(emptyRun){const target=displayRows.length-1;body.dataset.returnOriginActive='';body.dataset.gpsNextStop=String(target);displayRows.forEach((row,index)=>{const active=index===target;row.hidden=!active;row.classList.toggle('gpsNextStop',active);row.classList.toggle('isActiveStop',active)})}
      else if(direction==='return'&&forceReturnOriginOnce){body.dataset.returnOriginActive='1';body.dataset.gpsNextStop='0';displayRows.forEach((row,index)=>{const active=index===0;row.classList.toggle('gpsNextStop',active);row.classList.toggle('isActiveStop',active)});forceReturnOriginOnce=false}
      else if(direction!=='return'){body.dataset.returnOriginActive='';delete body.dataset.gpsNextStop}
"""
new="""      if(emptyRun){const target=displayRows.length-1;body.dataset.returnOriginActive='';body.dataset.gpsNextStop=String(target);displayRows.forEach((row,index)=>{const active=index===target;row.hidden=!active;row.classList.toggle('gpsNextStop',active);row.classList.toggle('isActiveStop',active)})}
      else if(direction==='return'&&forceReturnOriginOnce){
        body.dataset.returnOriginActive='1';delete body.dataset.gpsNextStop;delete body.dataset.gpsNextStopKey;
        displayRows.forEach(row=>row.classList.remove('gpsNextStop','isActiveStop'));
        resetReturnOriginTracking();forceReturnOriginOnce=false;
        body.dispatchEvent(new CustomEvent('return-origin-change',{bubbles:true,detail:{active:true,reason:'return-start'}}));
      }
      else if(direction!=='return'){body.dataset.returnOriginActive='';delete body.dataset.gpsNextStop;delete body.dataset.gpsNextStopKey;resetReturnOriginTracking()}
"""
ret=must_replace(ret,old,new,'return origin target')
ret=must_replace(ret,
"  body.addEventListener('gps-next-stop-change',event=>{if(Number(event.detail?.index)>0)body.dataset.returnOriginActive=''});\n",
"",
'return remove gps clear')
ret=must_replace(ret,
"  document.addEventListener('trasy:route-data-updated',event=>{rawData=event.detail?.data??event.detail??null});",
"  document.addEventListener('trasy:route-data-updated',event=>{rawData=event.detail?.data??event.detail??null});\n  window.__trasyGps?.subscribe?.(onReturnPosition,()=>{});",
'return gps subscription')
write('return-route.js',ret)

# -----------------------------------------------------------------------------
# Nagłówek: przejmuje START powrotu; nie ma osobnego fixera.
# -----------------------------------------------------------------------------
header=read('next-stop-header.js')
header=must_sub(header,r"\n  const style=document\.createElement\('style'\);.*?document\.head\.appendChild\(style\);\n",'\n','header css')
needle="  function setStopText(data){\n    mainEl.textContent=data?.name||'';\n    planEl.textContent=data?.plan||'';\n  }\n\n"
startfn="""  function setStopText(data){
    mainEl.textContent=data?.name||'';
    planEl.textContent=data?.plan||'';
  }

  function renderReturnStart(){
    const active=body.dataset.direction==='return'&&body.dataset.emptyRun!=='1'&&body.dataset.returnOriginActive==='1';
    if(!active)return false;
    const row=rows()[0];
    const data=dataFromRow(row);
    labelEl.textContent='START TRASY POWROTNEJ';
    mainEl.textContent=data?.name||'Punkt startowy';
    const start=String(body.dataset.returnStart||'').trim();
    planEl.textContent=start?`Start ${start}`:'';
    statusEl.hidden=true;statusEl.className='nextStopStatus';statusEl.textContent='';
    guardEl.hidden=true;guardEl.textContent='';guardEl.classList.remove('approach','hold','ready','flash3');
    return true;
  }

"""
header=must_replace(header,needle,startfn,'header start function')
header=must_replace(header,
"  function render(){\n    const data=dataFromRow(activeRow());",
"  function render(){\n    if(renderReturnStart())return;\n    labelEl.textContent='Następny przystanek';\n    const data=dataFromRow(activeRow());",
'header render start')
header=must_replace(header,
"  body.addEventListener('route-mode-change',()=>{resetAlerts();render()});",
"  body.addEventListener('route-mode-change',()=>{resetAlerts();render()});\n  body.addEventListener('return-origin-change',()=>{resetAlerts();render()});",
'header origin event')
write('next-stop-header.js',header)

# -----------------------------------------------------------------------------
# ETA: tylko logika; style są w navigation.css.
# -----------------------------------------------------------------------------
eta=read('eta-status.js')
eta=must_sub(eta,r"\n  const style=document\.createElement\('style'\);.*?document\.head\.appendChild\(style\);\n",'\n','eta css')
write('eta-status.js',eta)

# -----------------------------------------------------------------------------
# Dymek: tylko struktura i widoczność. Pozycja/styl w CSS.
# -----------------------------------------------------------------------------
bubble=read('maneuver-bubble.js')
bubble=must_sub(bubble,r"\n  bubble\.style\.cssText=`.*?`;\n",'\n','bubble css')
bubble=must_sub(bubble,r"\n  maneuver\.style\.cssText=`.*?`;\n",'\n','maneuver css')
bubble=must_sub(bubble,r"\n  distance\.style\.cssText=`.*?`;\n",'\n','distance css')
bubble=must_replace(bubble,
"  if(infoPanel){\n    infoPanel.style.padding='7px 12px';\n    infoPanel.style.minHeight='0';\n  }\n  if(infoRow){\n    infoRow.style.marginTop='0';\n    infoRow.style.justifyContent='flex-start';\n    infoRow.style.alignItems='center';\n  }",
"  infoPanel?.classList.add('routeNavInfoShell');\n  infoRow?.classList.add('routeNavInfoRow');",
'bubble shell classes')
write('maneuver-bubble.js',bubble)

# -----------------------------------------------------------------------------
# Kamera: jeden właściciel. Live engine publikuje tylko dane/profil.
# -----------------------------------------------------------------------------
live=read('navigation-live-engine.js')
live=must_replace(live,
"  updateSpeed(position,here,now);\n  if(!routeModel?.points?.length)return;",
"  updateSpeed(position,here,now);\n  currentCameraProfile();\n  if(!routeModel?.points?.length)return;",
'live camera profile')
marker=live.find('\nfunction isVehicleMarker(')
if marker<0: raise RuntimeError('live marker monkey patch nie znaleziony')
live=live[:marker]+"\n"
write('navigation-live-engine.js',live)

controls=read('navigation-ui-controls.js')
controls=must_sub(controls,r"\n  const style=document\.createElement\('style'\);.*?document\.head\.appendChild\(style\);\n",'\n','controls css')
controls=must_replace(controls,
"  const top=close.parentElement;\n  const title=top?.querySelector('strong');\n  if(title)title.style.display='none';\n  if(top){\n    top.style.height='0';\n    top.style.minHeight='0';\n    top.style.padding='0';\n    top.style.border='0';\n    top.style.background='transparent';\n    top.style.overflow='visible';\n    top.style.position='relative';\n    top.style.zIndex='50040';\n  }",
"  const top=close.parentElement;\n  const title=top?.querySelector('strong');\n  top?.classList.add('routeNavChromeTop');\n  title?.classList.add('routeNavTitleHidden');",
'controls top classes')
controls=must_replace(controls,
"  close.style.cssText='position:fixed;top:112px;left:10px;z-index:50100;width:38px;height:38px;padding:0;border:1px solid #fff8;border-radius:19px;background:#111d;color:#fff;font-size:32px;line-height:32px;box-shadow:0 2px 9px #000a;display:flex;align-items:center;justify-content:center';\n\n  center.style.cssText='position:fixed;right:12px;top:112px;z-index:50100;width:42px;height:42px;padding:0;border:1px solid #fff8;border-radius:21px;background:#111d;color:#fff;box-shadow:0 2px 9px #000a;display:flex;align-items:center;justify-content:center';",
"",
'controls static button css')
controls=must_replace(controls,
"  voice.style.cssText='position:fixed;top:162px;right:14px;z-index:50100;width:38px;height:38px;padding:0;border:1px solid #fff8;border-radius:19px;background:#111d;color:#fff;font-size:19px;box-shadow:0 2px 9px #000a';\n",
"",
'controls voice css')
anchor="  const tiltedGrid='<svg viewBox=\"0 0 28 22\" width=\"25\" height=\"20\"><path d=\"M7 2h14l4 17H3L7 2Z\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.6\"/><path d=\"m11.7 2-2 17M16.3 2l2 17M5.7 7.7h16.6M4.3 13.3h19.4\" stroke=\"currentColor\"/></svg>';\n"
mergefn="""  const tiltedGrid='<svg viewBox="0 0 28 22" width="25" height="20"><path d="M7 2h14l4 17H3L7 2Z" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="m11.7 2-2 17M16.3 2l2 17M5.7 7.7h16.6M4.3 13.3h19.4" stroke="currentColor"/></svg>';

  function mergeViewControl(){
    const pitch=document.getElementById('routePitchToggle');
    const canvas=document.getElementById('routeMapCanvas');
    if(!pitch||!canvas)return false;
    const zoomGroup=[...canvas.querySelectorAll('.maplibregl-ctrl-bottom-right .maplibregl-ctrl-group')]
      .find(group=>group.querySelector('.maplibregl-ctrl-zoom-in')&&group.querySelector('.maplibregl-ctrl-zoom-out'));
    if(!zoomGroup)return false;
    const zoomIn=zoomGroup.querySelector('.maplibregl-ctrl-zoom-in');
    const oldParent=pitch.parentElement;
    if(pitch.parentElement!==zoomGroup||pitch.nextElementSibling!==zoomIn)zoomGroup.insertBefore(pitch,zoomIn);
    if(oldParent?.classList?.contains('route-view-control')&&!oldParent.children.length)oldParent.remove();
    return true;
  }
"""
controls=must_replace(controls,anchor,mergefn,'controls merge function')
controls=must_replace(controls,
"      this.map.addControl(control,'bottom-right');",
"      this.map.addControl(control,'bottom-right');\n      if(!mergeViewControl())requestAnimationFrame(()=>mergeViewControl());",
'controls merge call')
controls=must_replace(controls,
"    moveToTarget(target,duration){\n      this.map.easeTo({\n        center:target.center,\n        zoom:GUIDANCE_ZOOM,\n        bearing:this.smoothBearing(target),\n        pitch:GUIDANCE_PITCH,",
"    moveToTarget(target,duration){\n      const profile=window.__routeCameraProfile||{};\n      const zoom=Number.isFinite(Number(profile.zoom))?Number(profile.zoom):GUIDANCE_ZOOM;\n      const pitch=Number.isFinite(Number(profile.pitch))?Number(profile.pitch):GUIDANCE_PITCH;\n      this.map.easeTo({\n        center:target.center,\n        zoom,\n        bearing:this.smoothBearing(target),\n        pitch,",
'controls camera profile')
write('navigation-ui-controls.js',controls)

# -----------------------------------------------------------------------------
# nav-map: bez surowego OSM i bez własności warstw trasy. Smoothing markera lokalny.
# -----------------------------------------------------------------------------
nav=read('nav-map.js')
nav=must_replace(nav,"  let watchId=null;\n","  let watchId=null;\n  let positionAnimation=0;\n  let lastMarkerUpdateAt=0;\n",'nav marker vars')
# Map constructor block: od początku new Map do map.addControl.
start=nav.find('        map=new maplibregl.Map({')
end=nav.find('\n\n        map.addControl(',start)
if start<0 or end<0: raise RuntimeError('nav map constructor block')
replacement="""        const createMap=window.__trasyMapRuntime?.createMap;
        if(typeof createMap!=='function')throw Error('Runtime mapy nie jest gotowy.');
        map=createMap({
          container:'routeMapCanvas',
          center:[origin[1],origin[0]],
          zoom:ZOOM,
          pitch:PITCH,
          bearing:0,
          attributionControl:true,
          maxPitch:60
        });"""
nav=nav[:start]+replacement+nav[end:]
# buildRoute source/layers.
pattern=r"\n      if\(map\.getSource\('route'\)\)\{.*?\n      \}\n\n      refreshStopMarkers\("
replace="""
      const renderer=window.__trasyRouteRenderer;
      if(!renderer?.setRoute)throw Error('Renderer trasy nie jest gotowy.');
      renderer.setRoute(geo);

      refreshStopMarkers("""
nav=must_sub(nav,pattern,replace,'nav route renderer')
nav=must_replace(nav,
"        if(map.getSource('route')){\n          map.getSource('route')\n            .setData(routeGeoJSON([]));\n        }",
"        window.__trasyRouteRenderer?.clear?.();",
'nav clear renderer')
# marker smoothing owner
anchor="  function applyNavigationPosition(position){\n"
smoothing="""  function setVehiclePosition(ll,instant=false){
    if(!positionMarker)return;
    const target=[ll[1],ll[0]];
    const current=positionMarker.getLngLat?.();
    if(positionAnimation){cancelAnimationFrame(positionAnimation);positionAnimation=0}
    if(instant||!current){positionMarker.setLngLat(target);lastMarkerUpdateAt=performance.now();return}
    const from=[Number(current.lng),Number(current.lat)];
    const jump=hav([from[1],from[0]],ll);
    if(!Number.isFinite(jump)||jump>250){positionMarker.setLngLat(target);lastMarkerUpdateAt=performance.now();return}
    const now=performance.now();
    const interval=lastMarkerUpdateAt?now-lastMarkerUpdateAt:900;
    lastMarkerUpdateAt=now;
    const duration=Math.max(550,Math.min(1350,interval*1.12));
    const started=now;
    const animate=time=>{
      const t=Math.min(1,(time-started)/duration);
      positionMarker?.setLngLat([from[0]+(target[0]-from[0])*t,from[1]+(target[1]-from[1])*t]);
      if(t<1&&!panel.hidden&&positionMarker)positionAnimation=requestAnimationFrame(animate);
      else{positionAnimation=0;positionMarker?.setLngLat(target)}
    };
    positionAnimation=requestAnimationFrame(animate);
  }

"""
nav=must_replace(nav,anchor,smoothing+anchor,'nav smoothing function')
nav=must_replace(nav,"    positionMarker?.setLngLat([ll[1],ll[0]]);","    setVehiclePosition(ll,instant);",'nav marker usage')
nav=must_replace(nav,
"  function clearMarkers(){\n    if(positionMarker){",
"  function clearMarkers(){\n    if(positionAnimation){cancelAnimationFrame(positionAnimation);positionAnimation=0}\n    lastMarkerUpdateAt=0;\n    if(positionMarker){",
'nav marker clear')
write('nav-map.js',nav)

# -----------------------------------------------------------------------------
# app.js przejmuje wszystkie sprawdzenia PWA; app-update-check znika.
# -----------------------------------------------------------------------------
app=read('app.js')
app=must_replace(app,"  let updateRequested=false;\n","  let updateRequested=false;\n  const CHECK_INTERVAL_MS=10*60*1000;\n",'app update interval')
app=must_replace(app,
"    await handleWaiting();\n    reg.addEventListener('updatefound',()=>{",
"    await handleWaiting();\n    const checkForUpdate=async()=>{\n      if(!navigator.onLine)return false;\n      try{await reg.update();await handleWaiting();return true}catch(error){console.warn('Sprawdzenie aktualizacji PWA:',error);return false}\n    };\n    window.__trasyCheckForUpdate=checkForUpdate;\n    document.getElementById('showSchedule')?.addEventListener('click',()=>{checkForUpdate()});\n    setInterval(checkForUpdate,CHECK_INTERVAL_MS);\n    reg.addEventListener('updatefound',()=>{",
'app update function')
app=must_replace(app,
"    if(navigator.onLine)reg.update().catch(error=>console.warn('Sprawdzenie aktualizacji PWA:',error));",
"    if(navigator.onLine)checkForUpdate();",
'app startup update')
write('app.js',app)

# -----------------------------------------------------------------------------
# index: jeden zestaw modułów i jeden stylesheet nawigacji.
# -----------------------------------------------------------------------------
index=read('index.html')
index=re.sub(r'<style>.*?</style>','',index,count=1,flags=re.S)
index=index.replace('<link rel="stylesheet" href="./style.css?v=status-border-4">','<link rel="stylesheet" href="./style.css?v=status-border-4"><link rel="stylesheet" href="./navigation.css?v=1">',1)
index=index.replace('data-version="2.0.162"','data-version="2.0.163"',1).replace('>TEST 2.0.162<','>TEST 2.0.163<',1)
remove_scripts=[
'app-update-check.js','maplibre-route-hook.js','return-gps-mode.js','return-start-guard.js','return-start-navigation.js',
'map-day-night.js','map-night-ui.js','return-start-header-fix.js','eta-clock-ui.js'
]
for name in remove_scripts:
    index=re.sub(rf'<script\b[^>]*src="\.\/{re.escape(name)}[^\"]*"[^>]*></script>','',index)
maplibre='<script src="https://unpkg.com/maplibre-gl@5.12.0/dist/maplibre-gl.js"></script>'
index=must_replace(index,maplibre,maplibre+'<script type="module" src="./map-runtime.js?v=1"></script>','index map runtime')
index=index.replace('return-route.js?v=parking-api-3','return-route.js?v=4')
index=index.replace('gps-stop-tracker.js?v=stop-engine-10','gps-stop-tracker.js?v=stop-engine-11')
index=index.replace('nav-map.js?v=resume-4','nav-map.js?v=resume-5')
index=index.replace('route-progress-style.js?v=4','route-progress-style.js?v=5')
index=index.replace('navigation-ui-controls.js?v=25','navigation-ui-controls.js?v=26')
index=index.replace('navigation-live-engine.js?v=5','navigation-live-engine.js?v=6')
index=index.replace('eta-status.js?v=status-8','eta-status.js?v=status-9')
index=index.replace('next-stop-header.js?v=status-11','next-stop-header.js?v=status-12')
# dymek ładowany jawnie, nie przez map-night-ui.
navtag='<script src="./nav-map.js?v=resume-5"></script>'
index=must_replace(index,navtag,navtag+'<script src="./maneuver-bubble.js?v=3"></script>','index bubble')
write('index.html',index)

# -----------------------------------------------------------------------------
# Service worker: shell zgodny z index; trwałe cache offline zostają.
# -----------------------------------------------------------------------------
sw=read('sw.js')
sw=sw.replace("const APP_VERSION='2.0.162';","const APP_VERSION='2.0.163';",1)
sw=sw.replace("const CACHE_NAME='trasy-2.0-v196';","const CACHE_NAME='trasy-2.0-v197';",1)
for entry in ['./app-update-check.js','./maplibre-route-hook.js','./return-gps-mode.js','./return-start-guard.js','./return-start-navigation.js','./ptv-basemap.js','./map-day-night.js','./map-night-ui.js','./return-start-header-fix.js','./eta-clock-ui.js']:
    sw=sw.replace(f"'{entry}',",'')
sw=sw.replace("'./style.css',","'./style.css','./navigation.css',",1)
sw=sw.replace("'./wake-style.js',","'./wake-style.js','./map-runtime.js',",1)
write('sw.js',sw)

# -----------------------------------------------------------------------------
# Testy: od zachowania/architektury, nie od historycznych łatek.
# -----------------------------------------------------------------------------
write('test/audit-regressions.test.js',r'''import assert from 'node:assert/strict';
import { access,readFile } from 'node:fs/promises';
import test from 'node:test';
const read=name=>readFile(new URL(`../${name}`,import.meta.url),'utf8');

const gone=[
  'app-update-check.js','maplibre-route-hook.js','ptv-basemap.js','map-day-night.js','map-night-ui.js',
  'return-gps-mode.js','return-start-navigation.js','return-start-header-fix.js','return-start-guard.js',
  'eta-clock-ui.js','navigation-guidance-fix.js','vehicle-speed-profile-core.js'
];

test('historyczne łatki i proxy zostały fizycznie usunięte',async()=>{
  for(const name of gone)await assert.rejects(()=>access(new URL(`../${name}`,import.meta.url)));
  const html=await read('index.html');
  for(const name of gone)assert.doesNotMatch(html,new RegExp(name.replaceAll('.','\\.')));
});

test('mapa ma jednego właściciela bez Proxy konstruktora MapLibre',async()=>{
  const [runtime,nav,renderer]=await Promise.all([read('map-runtime.js'),read('nav-map.js'),read('route-progress-style.js')]);
  assert.match(runtime,/window\.__trasyMapRuntime=/);
  assert.match(runtime,/createMap/);
  assert.doesNotMatch(runtime,/new Proxy/);
  assert.match(nav,/__trasyMapRuntime\?\.createMap/);
  assert.doesNotMatch(nav,/tile\.openstreetmap\.org/);
  assert.match(nav,/__trasyRouteRenderer/);
  assert.match(renderer,/window\.__trasyRouteRenderer=/);
  assert.doesNotMatch(renderer,/map\.addSource=function|source\.setData=function|__trasyProgressRawSetData/);
});

test('kamera i marker nie są monkey-patchowane globalnie',async()=>{
  const [live,controls,nav]=await Promise.all([read('navigation-live-engine.js'),read('navigation-ui-controls.js'),read('nav-map.js')]);
  assert.doesNotMatch(live,/Marker\.prototype|proto\.setLngLat\s*=|controller\.follow\s*=|controller\.moveToTarget\s*=/);
  assert.match(live,/__routeCameraProfile/);
  assert.match(controls,/class RouteCameraController/);
  assert.match(controls,/const profile=window\.__routeCameraProfile/);
  assert.match(nav,/function setVehiclePosition/);
});

test('START powrotu ma jednego właściciela, a GPS pomija indeks zero',async()=>{
  const [route,tracker,engine,header]=await Promise.all([read('return-route.js'),read('gps-stop-tracker.js'),read('gps-stop-engine.js'),read('next-stop-header.js')]);
  assert.match(route,/returnOriginActive/);
  assert.match(route,/onReturnPosition/);
  assert.match(route,/return-origin-change/);
  assert.match(tracker,/function minimumTargetIndex/);
  assert.match(tracker,/minimumIndex:minimumTargetIndex\(\)/);
  assert.match(engine,/minimumIndex=0/);
  assert.match(header,/START TRASY POWROTNEJ/);
  assert.match(header,/returnOriginActive==='1'/);
});

test('core UI nie wstrzykuje już kolejnych arkuszy stylów w runtime',async()=>{
  for(const name of['next-stop-header.js','eta-status.js','gps-stop-tracker.js','return-route.js','navigation-ui-controls.js']){
    assert.doesNotMatch(await read(name),/createElement\(['"]style['"]\)/,name);
  }
  const html=await read('index.html');
  assert.match(html,/navigation\.css\?v=1/);
});

test('stare wyznaczanie trasy jest anulowane po zmianie celu',async()=>{
  const source=await read('nav-map.js');
  assert.match(source,/routeAbortController\?\.abort\(\)/);
  assert.match(source,/signal:controller\.signal/);
});

test('e-TOLL instaluje się zdarzeniowo bez 30-sekundowego pollingu',async()=>{
  const source=await read('etoll-overlay.js');
  assert.match(source,/trasy:route-map-ready/);
  assert.doesNotMatch(source,/setInterval/);
});

test('nawigacja odzyskuje świeżą pozycję po wybudzeniu',async()=>{
  const [gps,nav,wake]=await Promise.all([read('gps-hub.js'),read('nav-map.js'),read('wake-style.js')]);
  assert.match(gps,/function refresh/);
  assert.match(nav,/recoverNavigation/);
  assert.match(nav,/trasy:navigation-resumed/);
  assert.match(wake,/setNavigationWake/);
});
''')

write('test/map-runtime.test.js',r'''import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=path=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('PTV jest główną mapą, OpenFreeMap nocą i jako fallback',()=>{
  const source=read('map-runtime.js');
  assert.match(source,/vectormaps-resources\.myptv\.com\/styles\/latest\/standard\.json/);
  assert.match(source,/tiles\.openfreemap\.org\/styles\/liberty/);
  assert.match(source,/tiles\.openfreemap\.org\/styles\/dark/);
  assert.match(source,/FALLBACK_GRACE_MS=8000/);
  assert.match(source,/FALLBACK_CONFIRM_ATTEMPTS=3/);
  assert.match(source,/PTV_RETRY_MS=15000/);
  assert.match(source,/PTV_PROXY='\/ptv-map'/);
});

test('właściwy styl trafia bezpośrednio do konstruktora MapLibre',()=>{
  const source=read('map-runtime.js');
  assert.match(source,/const instance=new window\.maplibregl\.Map\(mapOptions\)/);
  assert.match(source,/style:styleFor\(nextTheme,nextProvider\)/);
  assert.doesNotMatch(source,/new Proxy/);
});

test('nocne barwy są częścią jednego runtime mapy',()=>{
  const source=read('map-runtime.js');
  assert.match(source,/function softenNightMap/);
  assert.match(source,/#20252a/);
  assert.match(source,/#193648/);
  assert.match(source,/#d5d9dd/);
});
''')

write('test/map-start-speed.test.js',r'''import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=path=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('nawigacja używa świeżej pozycji GPS-hub bez czekania na kolejny fix',()=>{
  const nav=read('nav-map.js');
  assert.match(nav,/function cachedPosition\(maxAgeMs=15000\)/);
  assert.match(nav,/__trasyGps\?\.current/);
  assert.match(nav,/Promise\.resolve\(cached\)/);
});

test('styl PTV jest rozgrzewany przed otwarciem mapy',()=>{
  const runtime=read('map-runtime.js');
  const html=read('index.html');
  assert.match(runtime,/__trasyPtvStyleWarmup=fetch\(PTV_STYLE/);
  assert.match(runtime,/cache:'force-cache'/);
  assert.ok(html.includes('rel="preconnect" href="https://vectormaps-resources.myptv.com"'));
});
''')

write('test/return-start-warning.test.js',r'''import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const source=fs.readFileSync(new URL('../return-route.js',import.meta.url),'utf8');
const css=fs.readFileSync(new URL('../navigation.css',import.meta.url),'utf8');

test('wczesny wyjazd z punktu START jest częścią return-route',()=>{
  assert.match(source,/RETURN_WARNING_MS=20000/);
  assert.match(source,/ODJECHAŁEŚ PRZED CZASEM/);
  assert.match(source,/confirmed-departure/);
  assert.match(source,/return-origin-change/);
  assert.match(css,/#returnEarlyDepartureWarning/);
});
''')

write('test/return-target.test.js',r'''import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const tracker=fs.readFileSync(new URL('../gps-stop-tracker.js',import.meta.url),'utf8');
const engine=fs.readFileSync(new URL('../gps-stop-engine.js',import.meta.url),'utf8');

test('punkt START na powrocie nigdy nie jest celem GPS',()=>{
  assert.match(tracker,/direction==='return'&&body\.dataset\.emptyRun!=='1'\?1:0/);
  assert.match(tracker,/minimumIndex:minimumTargetIndex\(\)/);
  assert.match(engine,/firstIndex/);
});
''')

write('test/next-stop-header-stability.test.js',r'''import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=path=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('planowa godzina ma własną stałą linię w górnej belce',()=>{
  const source=read('next-stop-header.js'),css=read('navigation.css');
  assert.match(source,/nextStopPlan/);
  assert.match(source,/planEl\.textContent=data\?\.plan\|\|''/);
  assert.match(css,/nextStopPlan\{display:block;min-height:14px/);
  assert.match(css,/nextStopPlan:empty\{visibility:hidden\}/);
});

test('ETA powrotu nie usuwa planowej godziny z komórki harmonogramu',()=>{
  const source=read('eta-status.js');
  assert.match(source,/appendChild\(infoEl\)/);
  assert.doesNotMatch(source,/replaceChildren\(info\)/);
});

test('START powrotu jest renderowany przez ten sam nagłówek',()=>{
  const source=read('next-stop-header.js');
  assert.match(source,/function renderReturnStart/);
  assert.match(source,/START TRASY POWROTNEJ/);
  assert.match(source,/planEl\.textContent=start\?`Start \$\{start\}`:''/);
});
''')

write('test/maneuver-bubble.test.js',r'''import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const bubble=fs.readFileSync(new URL('../maneuver-bubble.js',import.meta.url),'utf8');
const css=fs.readFileSync(new URL('../navigation.css',import.meta.url),'utf8');
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');

test('manewr jest stałym elementem okna, nie markerem mapy',()=>{
  assert.match(bubble,/document\.body\.appendChild\(bubble\)/);
  assert.doesNotMatch(bubble,/maplibregl|setLngLat|__trasyGps|requestAnimationFrame/);
  assert.match(css,/#routeManeuverBubble\{position:fixed;left:50%;top:73dvh/);
});

test('dymek jest ładowany jawnie raz i cacheowany przez PWA',()=>{
  const sw=fs.readFileSync(new URL('../sw.js',import.meta.url),'utf8');
  assert.equal((html.match(/maneuver-bubble\.js/g)||[]).length,1);
  assert.match(sw,/\.\/maneuver-bubble\.js/);
});
''')

offline=read('test/offline-navigation.test.js')
offline=offline.replace('TEST 2.0.162','TEST 2.0.163').replace('2\\.0\\.162','2\\.0\\.163')
write('test/offline-navigation.test.js',offline)

write('test/update-check-schedule.test.js',r'''import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
const read=name=>readFile(new URL(`../${name}`,import.meta.url),'utf8');

test('app.js jest jedynym właścicielem sprawdzania aktualizacji PWA',async()=>{
  const [app,index,sw]=await Promise.all([read('app.js'),read('index.html'),read('sw.js')]);
  assert.match(app,/CHECK_INTERVAL_MS=10\*60\*1000/);
  assert.match(app,/setInterval\(checkForUpdate,CHECK_INTERVAL_MS\)/);
  assert.match(app,/getElementById\('showSchedule'\)\?\.addEventListener\('click'/);
  assert.match(app,/await reg\.update\(\)/);
  assert.doesNotMatch(index,/app-update-check\.js/);
  assert.doesNotMatch(sw,/app-update-check\.js/);
});
''')

# app-shell: dwa testy były przywiązane do CSS w JS / starego SpeedMax.
shell=read('test/app-shell.test.js')
shell=must_sub(shell,
r"test\('status punktualności ma zielony tekst w mapie i harmonogramie, a kolor niesie kropka'.*?\n\}\);\n\n(?=test\('kamera ma jeden jawny kontroler)",
r'''test('status punktualności ma zielony tekst, a kolor niesie kropka',async()=>{
  const [html,header,eta,css]=await Promise.all([
    readSource('index.html'),readSource('next-stop-header.js'),readSource('eta-status.js'),readSource('navigation.css')
  ]);
  assert.doesNotMatch(html,/punctuality-text-color-fix\.js/);
  assert.match(header,/statusEl\.textContent=status\.text/);
  assert.match(eta,/info\.textContent=punctuality\.text/);
  assert.match(css,/nextStopStatus\.early:before\{background:#ffd60a!important\}/);
  assert.match(css,/etaPunctuality\.late:before\{background:#ff3b30\}/);
});

''','app shell punctuality')
shell=must_sub(shell,
r"test\('informacje o prędkości używają jednego zdarzenia limitu drogi'.*?\n\}\);\n\n(?=test\('uwagi nawigacyjne)",
r'''test('SpeedMax ma jedno aktywne źródło PTV Map Matching',async()=>{
  const [speed,limit]=await Promise.all([readSource('speed-display.js'),readSource('road-speed-limit.js')]);
  assert.match(speed,/trasy:road-speed-limit/);
  assert.match(limit,/trasy:road-speed-limit/);
  assert.match(limit,/source: hasLimit \? 'ptv-map-matching' : ''/);
  assert.doesNotMatch(limit,/Overpass|openstreetmap|effectiveVehicleSpeedLimit/);
});

''','app shell speed')
write('test/app-shell.test.js',shell)

# Obsolete tests/files.
for name in[
  'test/ptv-basemap.test.js','test/map-day-night.test.js','test/return-gps-mode.test.js','test/eta-clock-ui.test.js','test/vehicle-speed-profile-core.test.js'
]:
    p=path(name)
    if p.exists(): p.unlink()

for name in[
  'app-update-check.js','maplibre-route-hook.js','ptv-basemap.js','map-day-night.js','map-night-ui.js',
  'return-gps-mode.js','return-start-navigation.js','return-start-header-fix.js','return-start-guard.js',
  'eta-clock-ui.js','navigation-guidance-fix.js','vehicle-speed-profile-core.js'
]:
    p=path(name)
    if p.exists(): p.unlink()

# Skrypt i workflow są tylko narzędziem migracji; nie zostają w docelowej gałęzi.
for name in['scripts/refactor_finalize.py','.github/workflows/refactor-audit.yml']:
    p=path(name)
    if p.exists(): p.unlink()
