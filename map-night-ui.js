(()=>{
  const root=document.documentElement;
  let map=window.__routeMap||null;

  const style=document.createElement('style');
  style.textContent=`
    /* + / - / 2D-3D jako jedna, nieco większa pionowa belka. */
    #routeMapCanvas .maplibregl-ctrl-group:has(.maplibregl-ctrl-zoom-in) button,
    #routePitchToggle{
      width:34px!important;
      min-width:34px!important;
      height:34px!important;
      min-height:34px!important;
      margin:0!important;
      border-radius:0!important;
      box-shadow:none!important;
    }
    #routePitchToggle{
      padding:1px 0 2px!important;
      border:0!important;
      background:#fff!important;
      color:#333!important;
      display:flex!important;
      flex-direction:column!important;
      align-items:center!important;
      justify-content:center!important;
      gap:1px!important;
      font:900 10px/10px Arial,sans-serif!important;
    }
    #routePitchToggle span{display:block!important;height:10px!important;line-height:10px!important;order:0!important}
    #routePitchToggle svg{width:19px!important;height:14px!important;margin:0!important;display:block!important;order:1!important}
    #routePitchToggle:hover{background:#f2f2f2!important}
    .route-view-control:empty,.route-view-control-anchor{display:none!important}

    /* Nocą żadna kontrolka MapLibre ani dymek informacyjny nie ma białego tła. */
    html[data-map-theme="night"] #routeMapCanvas .maplibregl-ctrl-group,
    html[data-map-theme="night"] #routeMapCanvas .maplibregl-ctrl-group button,
    html[data-map-theme="night"] #routePitchToggle{
      background:#24282d!important;
      color:#f1f3f4!important;
    }
    html[data-map-theme="night"] #routeMapCanvas .maplibregl-ctrl-group button,
    html[data-map-theme="night"] #routePitchToggle{
      border-color:#454b52!important;
    }
    html[data-map-theme="night"] #routeMapCanvas .maplibregl-ctrl-group button:hover,
    html[data-map-theme="night"] #routePitchToggle:hover{
      background:#343a40!important;
    }
    html[data-map-theme="night"] #routeMapCanvas .maplibregl-ctrl-icon{
      filter:invert(1) brightness(1.35)!important;
    }
    html[data-map-theme="night"] #routeMapCanvas .maplibregl-popup-content{
      background:#25292e!important;
      color:#f1f3f4!important;
      border:1px solid #4a5057!important;
      box-shadow:0 3px 14px #000a!important;
    }
    html[data-map-theme="night"] #routeMapCanvas .maplibregl-popup-tip{
      border-top-color:#25292e!important;
      border-bottom-color:#25292e!important;
    }
    html[data-map-theme="night"] #routeMapCanvas .maplibregl-popup-close-button{
      color:#f1f3f4!important;
      background:transparent!important;
    }
    html[data-map-theme="night"] #routeMapCanvas .maplibregl-ctrl-attrib,
    html[data-map-theme="night"] #routeMapCanvas .maplibregl-ctrl-attrib.maplibregl-compact-show{
      background:rgba(31,35,39,.9)!important;
      color:#d8dde2!important;
    }
    html[data-map-theme="night"] #routeMapCanvas .maplibregl-ctrl-attrib a{
      color:#d8dde2!important;
    }
  `;
  document.head.append(style);

  function mergeViewControl(){
    const pitch=document.getElementById('routePitchToggle');
    if(!pitch)return false;
    const canvas=document.getElementById('routeMapCanvas');
    const groups=[...(canvas||document).querySelectorAll('.maplibregl-ctrl-bottom-right .maplibregl-ctrl-group')];
    const zoomGroup=groups.find(group=>group.querySelector('.maplibregl-ctrl-zoom-in')&&group.querySelector('.maplibregl-ctrl-zoom-out'));
    if(!zoomGroup)return false;
    if(pitch.parentElement!==zoomGroup){
      const oldParent=pitch.parentElement;
      zoomGroup.appendChild(pitch);
      if(oldParent?.classList?.contains('route-view-control')&&!oldParent.children.length)oldParent.remove();
    }
    return true;
  }

  let mergeTimer=0;
  function scheduleMerge(){
    clearTimeout(mergeTimer);
    let tries=0;
    const run=()=>{
      tries+=1;
      if(mergeViewControl()||tries>=20)return;
      mergeTimer=setTimeout(run,100);
    };
    run();
  }

  function idText(layer){
    return `${layer?.id||''} ${layer?.['source-layer']||''}`.toLowerCase();
  }

  function safePaint(layerId,property,value){
    try{map?.setPaintProperty?.(layerId,property,value)}catch{}
  }

  function softenNightMap(){
    if(!map||root.dataset.mapTheme!=='night')return;
    const layers=map.getStyle?.()?.layers||[];
    for(const layer of layers){
      const id=layer.id;
      const text=idText(layer);
      if(!id||/route|etoll/.test(text))continue;

      if(layer.type==='background'){
        safePaint(id,'background-color','#20252a');
        safePaint(id,'background-opacity',1);
        continue;
      }

      if(layer.type==='fill'){
        let color='#292e33';
        if(/water|river|lake|ocean|sea/.test(text))color='#193648';
        else if(/park|forest|wood|grass|green|landcover|nature/.test(text))color='#263a30';
        else if(/building/.test(text))color='#343a40';
        safePaint(id,'fill-color',color);
        safePaint(id,'fill-opacity',.94);
        continue;
      }

      if(layer.type==='line'){
        let color='#59616a';
        let opacity=.82;
        if(/motorway|trunk|primary|highway|major/.test(text))color='#7b848e';
        else if(/secondary|tertiary|street|road/.test(text))color='#68717a';
        else if(/path|track|service|minor/.test(text)){color='#50575e';opacity=.72}
        else if(/water|river|stream/.test(text))color='#31566d';
        else if(/boundary|admin/.test(text)){color='#646b73';opacity=.58}
        safePaint(id,'line-color',color);
        safePaint(id,'line-opacity',opacity);
        continue;
      }

      if(layer.type==='symbol'){
        safePaint(id,'text-color','#d5d9dd');
        safePaint(id,'text-halo-color','#20252a');
        safePaint(id,'text-halo-width',1.2);
        safePaint(id,'text-halo-blur',.4);
      }
    }

    /* Trasa pozostaje wyraźna, ale tło nie jest już czarną plamą. */
    safePaint('route-outline','line-color','#1b1f22');
    safePaint('route-outline','line-opacity',.82);
    safePaint('route-line','line-color','#ccff33');
    safePaint('route-line','line-opacity',1);
  }

  function attach(nextMap){
    if(nextMap)map=nextMap;
    if(!map)return;
    map.on?.('style.load',()=>{
      setTimeout(()=>{
        softenNightMap();
        scheduleMerge();
      },0);
    });
    scheduleMerge();
    softenNightMap();
  }

  document.addEventListener('trasy:route-map-ready',event=>attach(event.detail?.map||window.__routeMap));
  document.addEventListener('trasy:map-theme-change',event=>{
    if(event.detail?.theme==='night')setTimeout(softenNightMap,0);
    scheduleMerge();
  });
  new MutationObserver(scheduleMerge).observe(document.documentElement,{childList:true,subtree:true});
  if(map)attach(map);
})();
