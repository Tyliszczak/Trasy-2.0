import {readFile,writeFile} from 'node:fs/promises';

async function edit(path,transform){
  const source=await readFile(path,'utf8');
  const next=transform(source);
  if(next===source)throw new Error(`Brak oczekiwanej zmiany w ${path}`);
  await writeFile(path,next);
}

function once(source,before,after,label){
  const index=source.indexOf(before);
  if(index<0)throw new Error(`Nie znaleziono wzorca: ${label}`);
  if(source.indexOf(before,index+before.length)>=0)throw new Error(`Wzorzec nie jest jednoznaczny: ${label}`);
  return source.slice(0,index)+after+source.slice(index+before.length);
}

function regexOnce(source,pattern,replacement,label){
  const matches=[...source.matchAll(new RegExp(pattern.source,pattern.flags.includes('g')?pattern.flags:pattern.flags+'g'))];
  if(matches.length!==1)throw new Error(`Wzorzec ${label}: oczekiwano 1, znaleziono ${matches.length}`);
  return source.replace(pattern,replacement);
}

await edit('google-routes-provider.js',source=>once(
  source,
  '  window.fetch=async function(input,init){',
  '  window.__trasyRouteFetch=async function(input,init){',
  'dedykowany route fetch'
));

await edit('navigation-guidance-fix.js',source=>{
  source=once(source,'  const nativeFetch=window.fetch.bind(window);\n\n','', 'native fetch guidance');
  source=regexOnce(
    source,
    /\n  window\.fetch=async function\(input,init\)\{[\s\S]*?\n  \};\n\n  \/\/ Ostatnia warstwa bezpieczeństwa/,
    '\n  window.__trasyNormalizeRouteResponse=normalizeRouteResponse;\n\n  // Ostatnia warstwa bezpieczeństwa',
    'global fetch guidance'
  );
  source=regexOnce(
    source,
    /\n  const speech=window\.speechSynthesis;[\s\S]*?\n  \};\n\}\)\(\);\s*$/,
    '\n  window.__trasyCleanGuidanceText=cleanGuidanceText;\n})();\n',
    'global speech guidance'
  );
  return source;
});

await edit('navigation-live-engine.js',source=>regexOnce(
  source,
  /\nconst previousFetch=window\.fetch\.bind\(window\);[\s\S]*?\n\};\n\nfunction activeRow/,
  '\nwindow.__trasyCaptureRoute=captureRoute;\n\nfunction activeRow',
  'global fetch live engine'
));

await edit('navigation-ui-controls.js',source=>regexOnce(
  source,
  /  const speech=window\.speechSynthesis;\n  if\(speech&&typeof speech\.speak==='function'&&!speech\.__routeMuteWrapped\)\{[\s\S]*?\n  \}\n  function updateVoice/,
  "  const speech=window.speechSynthesis;\n  function updateVoice",
  'global speech mute wrapper'
));

await edit('nav-map.js',source=>{
  source=once(
    source,
    '  let routeBuildInFlight=false;\n  let offRouteFixes=0;',
    '  let routeBuildInFlight=false;\n  let routeRequestGeneration=0;\n  let routeAbortController=null;\n  let offRouteFixes=0;',
    'route request state'
  );
  source=once(
    source,
    "  function speak(step,text,d){\n    if(!isVoiceManeuver(step))return;\n\n    const bucket=",
    "  function speak(step,text,d){\n    if(!isVoiceManeuver(step)||window.__routeVoiceMuted===true)return;\n\n    const bucket=",
    'voice mute in nav map'
  );
  source=once(
    source,
    "    if(!bucket)return;\n\n    const key=",
    "    if(!bucket)return;\n    if(bucket==='400')return;\n\n    const cleanText=window.__trasyCleanGuidanceText?.(text)||text;\n\n    const key=",
    '400m guidance suppression'
  );
  source=once(
    source,
    "          bucket==='now'\n            ?text\n            :`Za ${bucket==='150'?'150':'400'} metrów. ${text}`",
    "          bucket==='now'\n            ?cleanText\n            :`Za ${bucket==='150'?'150':'400'} metrów. ${cleanText}`",
    'clean spoken guidance'
  );
  source=once(
    source,
    "  async function buildRoute(origin,stops){\n    if(\n      !stops.length||\n      routeBuildInFlight\n    )return;\n\n    routeBuildInFlight=true;\n    lastRouteBuildAt=Date.now();\n    legStartAt=Date.now();",
    "  async function buildRoute(origin,stops){\n    if(!stops.length)return;\n\n    routeAbortController?.abort();\n    const requestId=++routeRequestGeneration;\n    const controller=new AbortController();\n    routeAbortController=controller;\n    routeBuildInFlight=true;\n    lastRouteBuildAt=Date.now();\n    legStartAt=Date.now();",
    'route request generation'
  );
  source=once(
    source,
    "      const res=await fetch(\n        `https://router.project-osrm.org/route/v1/driving/${coords}`+\n        `?overview=full&geometries=geojson&steps=true&annotations=duration,distance`,\n        {cache:'no-store'}\n      );\n\n      if(!res.ok){\n        throw Error(`HTTP ${res.status}`);\n      }\n\n      const data=await res.json();\n      const route=data.routes?.[0];",
    "      const routeUrl=\n        `https://router.project-osrm.org/route/v1/driving/${coords}`+\n        `?overview=full&geometries=geojson&steps=true&annotations=duration,distance`;\n      const routeFetch=window.__trasyRouteFetch||window.fetch.bind(window);\n      const res=await routeFetch(routeUrl,{cache:'no-store',signal:controller.signal});\n\n      if(requestId!==routeRequestGeneration||controller.signal.aborted)return;\n      if(!res.ok){\n        throw Error(`HTTP ${res.status}`);\n      }\n\n      const rawData=await res.json();\n      if(requestId!==routeRequestGeneration||controller.signal.aborted)return;\n      const data=window.__trasyNormalizeRouteResponse?.(rawData)||rawData;\n      window.__trasyCaptureRoute?.(routeUrl,data);\n      const route=data.routes?.[0];",
    'route fetch pipeline'
  );
  source=once(
    source,
    "    }finally{\n      routeBuildInFlight=false;\n    }",
    "    }catch(error){\n      if(error?.name==='AbortError'||requestId!==routeRequestGeneration)return;\n      throw error;\n    }finally{\n      if(requestId===routeRequestGeneration){\n        routeBuildInFlight=false;\n        if(routeAbortController===controller)routeAbortController=null;\n      }\n    }",
    'route request finalizer'
  );
  source=once(
    source,
    '      if(lastGpsPoint&&!routeBuildInFlight){',
    '      if(lastGpsPoint){',
    'target change starts new request'
  );
  return source;
});

await edit('test/audit-regressions.test.js',source=>{
  source=source.replace(/test\('TODO etap 5: ([^']+)',\{todo:true\},async\(\)=>\{/g,"test('$1',async()=>{");
  if(source.includes('TODO etap 5:'))throw new Error('Pozostał TODO etapu 5');
  source=once(
    source,
    "  assert.match(source,/AbortController/);\n  assert.match(source,/requestId|generation|routeRequest/i);",
    "  assert.match(source,/AbortController/);\n  assert.match(source,/requestId|generation|routeRequest/i);\n  assert.match(source,/\.abort\(\)/);\n  assert.match(source,/signal:controller\.signal/);",
    'route cancellation assertions'
  );
  return source;
});

await edit('index.html',source=>{
  source=once(source,'TEST 2.0.93','TEST 2.0.94','test version');
  source=once(source,'google-routes-provider.js?v=traffic-aware-4','google-routes-provider.js?v=traffic-aware-5','google provider cache key');
  source=once(source,'navigation-guidance-fix.js?v=5','navigation-guidance-fix.js?v=6','guidance cache key');
  source=once(source,'nav-map.js?v=status-2','nav-map.js?v=status-3','nav map cache key');
  source=once(source,'navigation-ui-controls.js?v=21','navigation-ui-controls.js?v=22','ui controls cache key');
  source=once(source,'navigation-live-engine.js?v=1','navigation-live-engine.js?v=2','live engine cache key');
  return source;
});

await edit('sw.js',source=>once(source,"const CACHE_NAME='trasy-2.0-v127';","const CACHE_NAME='trasy-2.0-v128';",'service worker cache'));

console.log('Etap 5 patch zastosowany.');
