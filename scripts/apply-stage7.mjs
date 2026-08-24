import {readFile,writeFile,unlink} from 'node:fs/promises';

async function edit(path,transform){
  const source=await readFile(path,'utf8');
  const next=transform(source);
  if(next===source)throw new Error(`Brak oczekiwanej zmiany w ${path}`);
  await writeFile(path,next);
}
function once(source,before,after,label){
  const index=source.indexOf(before);
  if(index<0)throw new Error(`Nie znaleziono wzorca: ${label}`);
  if(source.indexOf(before,index+before.length)>=0)throw new Error(`Wzorzec niejednoznaczny: ${label}`);
  return source.slice(0,index)+after+source.slice(index+before.length);
}
function regexOnce(source,pattern,replacement,label){
  const flags=pattern.flags.includes('g')?pattern.flags:pattern.flags+'g';
  const matches=[...source.matchAll(new RegExp(pattern.source,flags))];
  if(matches.length!==1)throw new Error(`${label}: oczekiwano 1 dopasowania, znaleziono ${matches.length}`);
  return source.replace(pattern,replacement);
}

await edit('style.css',source=>source+`

/* Docelowy układ harmonogramu — przeniesiony z dawnych modułów fix/lock. */
#scheduleView .scheduleHeading{display:grid!important;grid-template-columns:42px minmax(88px,1fr) minmax(0,auto) minmax(118px,auto)!important;grid-template-rows:auto auto auto!important;align-items:center!important;gap:3px 10px!important}
#scheduleView .scheduleBackStack{grid-column:1!important;grid-row:1 / 4!important;align-self:start!important;display:flex!important;flex-direction:column!important;align-items:center!important;gap:7px!important}
#scheduleView .scheduleBackStack #wakeLockButton.wakeLockButton{width:38px!important;min-width:38px!important;min-height:62px!important}
#scheduleView .scheduleBackStack #wakeLockButton .wakeTopRow{flex-direction:column!important;gap:0!important}
#scheduleView .scheduleBackStack #wakeLockButton .wakeBulb{font-size:1.45rem!important}
#scheduleView .scheduleBackStack #wakeLockLabel{min-width:0!important;font-size:.68rem!important;text-align:center!important}
#scheduleView .scheduleBackStack #wakeLockButton .wakeScreenLabel{margin-top:1px!important;font-size:.5rem!important}
#scheduleView .scheduleTitleBlock,#scheduleView .scheduleControls{display:contents!important}
#scheduleView #scheduleRouteName{grid-column:2 / 4!important;grid-row:1!important;justify-self:start!important;min-width:0!important;margin:0!important;text-align:left!important;line-height:1.12!important}
#scheduleView .scheduleTimeSelect:not([hidden]),#scheduleView #returnStartLabel:not([hidden]){grid-column:2!important;grid-row:2!important;justify-self:start!important;min-width:0!important;margin:0!important}
#scheduleView .scheduleClock{grid-column:2!important;grid-row:3!important;justify-self:start!important;min-width:0!important;margin:0!important;color:#63d7ff!important}
#scheduleView #scheduleSpeedBox{grid-column:4!important;grid-row:1!important;align-self:center!important;justify-self:end!important;margin:0!important}
#scheduleView .routeModeSwitches{grid-column:4!important;grid-row:2!important;align-self:center!important;justify-self:end!important;margin:0!important;padding:2px 0!important;border:0!important;background:transparent!important;box-shadow:none!important}
#scheduleView #scheduleVehicle{grid-column:4!important;grid-row:3!important;align-self:end!important;justify-self:end!important;min-width:0!important;margin:0!important}
#scheduleView #scheduleVehicleButton{width:auto!important;max-width:min(42vw,240px)!important;min-width:0!important;min-height:0!important;height:auto!important;margin:0!important;padding:2px 0!important;border:0!important;background:transparent!important;box-shadow:none!important;text-align:right!important;line-height:1.15!important}
#scheduleView #returnStartLabel{overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important}
#scheduleBody[data-direction="return"] tr:not(.gpsNextStop){transform:scale(.955)!important;opacity:.74!important;background:transparent!important;box-shadow:none!important}
#scheduleBody[data-direction="return"] tr:not(.gpsNextStop) td{padding-top:10px!important;padding-bottom:10px!important;font-weight:400!important}
#scheduleBody[data-direction="return"] tr:not(.gpsNextStop) td:first-child{color:inherit!important;font-size:inherit!important;padding-left:8px!important}
#scheduleBody[data-direction="return"] tr:not(.gpsNextStop) td:first-child::before{display:none!important}
#scheduleBody[data-direction="return"] tr.gpsNextStop{position:relative;z-index:3;transform:none!important;opacity:1!important;background:#303030!important;box-shadow:0 5px 14px #0009!important}
#scheduleBody[data-direction="return"] tr.gpsNextStop td{padding-top:13px!important;padding-bottom:13px!important;border-bottom-color:transparent!important;font-weight:800!important}
#scheduleBody[data-direction="return"] tr.gpsNextStop td:first-child{position:relative;color:#fff!important;font-size:1.06rem!important;padding-left:14px!important}
#scheduleBody[data-direction="return"] tr.gpsNextStop td:first-child::before{content:"";position:absolute;display:block!important;left:0;top:5px;bottom:5px;width:5px;border-radius:4px;background:var(--gps-status-color,#fff)}
@media(max-width:520px){#scheduleView .scheduleHeading{grid-template-columns:42px minmax(62px,1fr) minmax(0,auto) minmax(108px,auto)!important;gap:2px 7px!important}#scheduleView #scheduleRouteName{font-size:1.12rem!important}#scheduleView .scheduleTimeSelect:not([hidden]),#scheduleView #returnStartLabel:not([hidden]){width:100%!important;max-width:100%!important}#scheduleView .routeModeSwitches{gap:8px!important}#scheduleView #scheduleVehicleButton{max-width:38vw!important;font-size:.7rem!important}#scheduleView .scheduleClock{font-size:.94rem!important}}
`);

await edit('next-stop-header.js',source=>{
  source=source.replace("  document.getElementById('offscreenText')?.closest('button')?.remove();\n",'');
  source=once(source,'    #routeNextStop .nextStopStatus.early{color:#ffd60a}\n    #routeNextStop .nextStopStatus.onTime{color:#34c759}\n    #routeNextStop .nextStopStatus.late{color:#ff3b30}', '    #routeNextStop .nextStopStatus.early,\n    #routeNextStop .nextStopStatus.onTime,\n    #routeNextStop .nextStopStatus.late{color:#39ff69}', 'kolor statusu następnego przystanku');
  return source;
});

await edit('navigation-ui-controls.js',source=>once(source,
  '  updateVoice();\n\n  const navIcon=',
  `  updateVoice();

  const infoPanel=maneuver.parentElement;
  function repositionControls(){
    if(!infoPanel)return;
    const rect=infoPanel.getBoundingClientRect();
    const controlTop=Math.max(10,Math.ceil(rect.bottom)+10);
    close.style.top=\`${'${controlTop}'}px\`;
    center.style.top=\`${'${controlTop}'}px\`;
    voice.style.top=\`${'${controlTop+50}'}px\`;
  }
  if('ResizeObserver'in window){
    const observer=new ResizeObserver(repositionControls);
    observer.observe(infoPanel);
  }
  window.addEventListener('resize',repositionControls,{passive:true});
  document.addEventListener('trasy:route-map-ready',repositionControls);
  requestAnimationFrame(repositionControls);

  const navIcon=`,
  'pozycjonowanie kontrolek nawigacji'
));

await edit('nav-map.js',source=>{
  source=regexOnce(source,/\n  let guardState=\{[\s\S]*?\n  \};\n/,'\n','guardState');
  source=regexOnce(source,/\n  const nextStopEl=\n    panel\.querySelector\('#routeNextStop'\);\n/,'\n','lokalny stary nagłówek');
  source=regexOnce(source,/\n  \/\* =========================================================\n     PANEL ETA POZA EKRANEM[\s\S]*?\n  \/\* =========================================================\n     PODSTAWOWE/,'\n\n  /* =========================================================\n     PODSTAWOWE','panel ETA poza ekranem');
  source=regexOnce(source,/\n  function deltaText\(diff\)\{[\s\S]*?\n  function dispatchEta\(\)\{/,'\n\n  function dispatchEta(){','stare funkcje tekstu ETA');
  source=regexOnce(source,/\n  function activeStopElement\(number\)\{[\s\S]*?\n  function refreshStopMarkers\(stops,legs\)\{/,
`\n  function activeStopElement(number){
    const dot=ordinaryStopElement(number,false);
    dot.style.width='32px';
    dot.style.height='32px';
    return{element:dot,badge:null,dot};
  }

  function updatePunctualityUi(){
    dispatchEta();
  }

  function refreshStopMarkers(stops,legs){`,
  'aktywny marker bez dymka');
  source=once(source,'\n    updateActiveBubble();\n    updateActiveStopVisibility();\n  }\n\n\n  /* =========================================================\n     AKTYWNY PRZYSTANEK POZA EKRANEM', '\n  }\n\n\n  /* =========================================================\n     AKTYWNY PRZYSTANEK POZA EKRANEM', 'wywołania starego dymka');
  source=regexOnce(source,/\n  \/\* =========================================================\n     AKTYWNY PRZYSTANEK POZA EKRANEM[\s\S]*?\n  \/\* =========================================================\n     INSTRUKCJE/,'\n\n  /* =========================================================\n     INSTRUKCJE','obsługa dymka poza ekranem');
  source=regexOnce(source,/\n  \/\* =========================================================\n     KOMUNIKAT NIE ODJEDŻAJ[\s\S]*?\n  \/\* =========================================================\n     PRZYCISKI/,'\n\n  /* =========================================================\n     PRZYCISKI','stary konsument guard');
  source=source.replace("    nextStopEl.textContent='';\n",'');
  source=regexOnce(source,/\n        map\.on\('move',\(\)=>\{\n          updateActiveStopVisibility\(\);\n          updateOffscreenArrow\(\);\n        \}\);\n/,'\n','map move starego dymka');
  source=once(source,"      status.textContent=\n        'Pobieranie przebiegu trasy…';", "      if(!routeCoords.length){\n        status.textContent='Pobieranie przebiegu trasy…';\n      }", 'ochrona statusu trasy u źródła');
  for(const forbidden of['offscreenText','offscreenPanel','updateActiveStopVisibility','updateOffscreenArrow','updateActiveBubble','nextStopEl.textContent','function deltaText','function activeEtaData','guardState']){
    if(source.includes(forbidden))throw new Error(`nav-map nadal zawiera: ${forbidden}`);
  }
  return source;
});

await edit('eta-status.js',source=>once(source,
  "  body.addEventListener('gps-next-stop-change',event=>{if(Number(event.detail?.index)>0)body.dataset.returnOriginActive='';lastTarget=null;etaSeconds=null;etaMeasuredAt=0;clearInfo();refreshEta(true).then(render)});",
  "  body.addEventListener('gps-next-stop-change',()=>{lastTarget=null;etaSeconds=null;etaMeasuredAt=0;clearInfo();refreshEta(true).then(render)});",
  'ETA nie zapisuje stanu POWROTU'
));

await edit('test/audit-regressions.test.js',source=>{
  source=source.replace(/test\('TODO etap 7: ([^']+)',\{todo:true\},async\(\)=>\{/g,"test('$1',async()=>{");
  if(source.includes('TODO etap 7:'))throw new Error('Pozostał TODO etapu 7');
  source=once(source,
    "  assert.doesNotMatch(source,/function deltaText|function activeEtaData/);",
    "  assert.doesNotMatch(source,/function deltaText|function activeEtaData/);\n  assert.doesNotMatch(source,/offscreenPanel|activeStopEtaBubble/);\n  assert.doesNotMatch(source,/nextStopEl\\.textContent/);",
    'wzmocnienie testu starego UI'
  );
  source=once(source,
    "  const owners=[route,gps,startNav].filter(source=>/returnOriginActive/.test(source));\n  assert.equal(owners.length,1);",
    "  const eta=await readSource('eta-status.js');\n  const writers=[route,gps,startNav,eta].filter(source=>/dataset\\.returnOriginActive\\s*=/.test(source));\n  assert.equal(writers.length,1);",
    'wzmocnienie właściciela POWROTU'
  );
  return source;
});

await edit('index.html',source=>{
  source=once(source,'TEST 2.0.95','TEST 2.0.96','wersja testowa');
  source=once(source,'style.css?v=status-border-3','style.css?v=status-border-4','cache CSS');
  source=once(source,'nav-map.js?v=status-3','nav-map.js?v=status-4','cache nav-map');
  source=once(source,'navigation-ui-controls.js?v=22','navigation-ui-controls.js?v=23','cache kontrolek');
  source=once(source,'next-stop-header.js?v=status-8','next-stop-header.js?v=status-9','cache nagłówka');
  for(const tag of[
    '<script src="./return-layout-fix.js?v=5"></script>',
    '<script src="./return-active-visual-lock.js?v=1"></script>',
    '<script src="./nav-control-position-fix.js?v=1"></script>',
    '<script src="./route-status-guard.js?v=1"></script>',
    '<script src="./punctuality-text-color-fix.js?v=1"></script>'
  ])source=once(source,tag,'',`usunięcie ${tag}`);
  return source;
});

await edit('sw.js',source=>{
  source=once(source,"const CACHE_NAME='trasy-2.0-v129';","const CACHE_NAME='trasy-2.0-v130';",'cache PWA');
  for(const entry of[
    "'./return-layout-fix.js',",
    "'./return-active-visual-lock.js',",
    "'./nav-control-position-fix.js',",
    "'./route-status-guard.js',",
    "'./punctuality-text-color-fix.js',"
  ])source=once(source,entry,'',`app shell ${entry}`);
  return source;
});

for(const path of['return-layout-fix.js','return-active-visual-lock.js','nav-control-position-fix.js','route-status-guard.js','punctuality-text-color-fix.js'])await unlink(path);

console.log('Etap 7 patch zastosowany.');
