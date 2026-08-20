(()=>{
  const SOURCE_ID='etoll-lubuskie';
  const LAYER_ID='etoll-lubuskie-line';
  const CACHE_KEY='trasy2.etollLubuskieGeojson.v1';
  const CACHE_MAX_AGE=7*24*60*60*1000;
  const OVERPASS_ENDPOINTS=[
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter'
  ];

  // Oficjalny wykaz e-TOLL od 1.02.2026 r. + geometria OSM.
  // Dla Lubuskiego cała A18, S3 i DK24 znajdująca się w województwie jest warstwą e-TOLL.
  // DK92 oznaczamy od Boczowa na wschód; zachodni fragment województwa nie występuje w oficjalnym wykazie.
  const QUERY=`[out:json][timeout:35];
    rel["boundary"="administrative"]["admin_level"="4"]["name"~"lubuskie",i];
    map_to_area->.lub;
    way(area.lub)["highway"]["ref"~"^(A ?18|S ?3|DK ?24|24|DK ?92|92)$",i];
    out geom;`;

  function normalizeRef(v){
    return String(v||'').toUpperCase().replace(/\s+/g,'').replace(/^DK/,'');
  }

  function wayToFeature(w){
    const ref=normalizeRef(w?.tags?.ref);
    if(!['A18','S3','24','92'].includes(ref))return null;
    const coords=(w.geometry||[]).map(p=>[Number(p.lon),Number(p.lat)]).filter(p=>Number.isFinite(p[0])&&Number.isFinite(p[1]));
    if(coords.length<2)return null;

    if(ref==='92'){
      const avgLng=coords.reduce((s,p)=>s+p[0],0)/coords.length;
      // Boczów leży ok. 15.28E. Pozostawiamy tylko oficjalnie wymieniony ciąg na wschód od Boczowa.
      if(avgLng<15.27)return null;
    }

    return {
      type:'Feature',
      properties:{
        etoll:true,
        region:'lubuskie',
        road:ref==='24'?'DK24':ref==='92'?'DK92':ref,
        osmWay:w.id,
        source:'e-TOLL 1.02.2026 + OpenStreetMap geometry'
      },
      geometry:{type:'LineString',coordinates:coords}
    };
  }

  function toGeoJson(data){
    return {
      type:'FeatureCollection',
      name:'e-TOLL Lubuskie',
      properties:{
        effectiveFrom:'2026-02-01',
        scope:'województwo lubuskie',
        note:'Warstwa testowa. Geometria OSM, zakres wg oficjalnego wykazu e-TOLL.'
      },
      features:(data?.elements||[]).map(wayToFeature).filter(Boolean)
    };
  }

  async function fetchOverpass(){
    const body='data='+encodeURIComponent(QUERY);
    let lastError;
    for(const endpoint of OVERPASS_ENDPOINTS){
      try{
        const controller=new AbortController();
        const timer=setTimeout(()=>controller.abort(),18000);
        const res=await fetch(endpoint,{
          method:'POST',
          headers:{'Content-Type':'application/x-www-form-urlencoded;charset=UTF-8'},
          body,
          cache:'no-store',
          signal:controller.signal
        });
        clearTimeout(timer);
        if(!res.ok)throw Error(`Overpass HTTP ${res.status}`);
        const json=await res.json();
        const geo=toGeoJson(json);
        if(!geo.features.length)throw Error('Brak geometrii e-TOLL');
        try{localStorage.setItem(CACHE_KEY,JSON.stringify({at:Date.now(),geo}))}catch{}
        return geo;
      }catch(e){lastError=e}
    }
    throw lastError||Error('Overpass niedostępny');
  }

  function cachedGeoJson(){
    try{
      const cached=JSON.parse(localStorage.getItem(CACHE_KEY)||'null');
      if(cached?.geo?.features?.length&&Date.now()-Number(cached.at||0)<CACHE_MAX_AGE)return cached.geo;
    }catch{}
    return null;
  }

  function addLayer(map,geo){
    if(!map||!geo?.features?.length)return;
    try{
      if(map.getSource(SOURCE_ID)){
        map.getSource(SOURCE_ID).setData(geo);
      }else{
        map.addSource(SOURCE_ID,{type:'geojson',data:geo});
      }
      if(!map.getLayer(LAYER_ID)){
        map.addLayer({
          id:LAYER_ID,
          type:'line',
          source:SOURCE_ID,
          layout:{'line-cap':'round','line-join':'round'},
          paint:{
            'line-color':'#ff5a36',
            'line-width':['interpolate',['linear'],['zoom'],7,2.2,12,4.5,16,6],
            'line-opacity':0.78,
            'line-dasharray':[1.35,0.75]
          }
        });
      }
      window.__etollLubuskieGeoJson=geo;
      document.dispatchEvent(new CustomEvent('etoll-layer-ready',{detail:{features:geo.features.length}}));
    }catch(e){console.warn('Warstwa e-TOLL:',e)}
  }

  async function install(){
    const map=window.__routeMap;
    if(!map||map.__etollLubuskieInstalled)return false;
    map.__etollLubuskieInstalled=true;

    const show=async()=>{
      const cached=cachedGeoJson();
      if(cached)addLayer(map,cached);
      try{
        const fresh=await fetchOverpass();
        addLayer(map,fresh);
      }catch(e){
        if(!cached)console.warn('Nie udało się pobrać warstwy e-TOLL Lubuskie:',e);
      }
    };

    if(map.loaded?.())show();else map.once('load',show);
    map.on('styledata',()=>{
      const geo=window.__etollLubuskieGeoJson;
      if(geo&&!map.getLayer(LAYER_ID))addLayer(map,geo);
    });
    return true;
  }

  const timer=setInterval(()=>{if(install())clearInterval(timer)},250);
  setTimeout(()=>clearInterval(timer),30000);
})();
