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

await edit('google-routes-provider.js',source=>{
  source=once(source,
    '  async function googleTrafficData(coords){\n    const controller=new AbortController();\n    const timeout=setTimeout(()=>controller.abort(),GOOGLE_ROUTE_TIMEOUT_MS);',
    "  async function googleTrafficData(coords,externalSignal){\n    const controller=new AbortController();\n    const abortFromExternal=()=>controller.abort();\n    if(externalSignal?.aborted)controller.abort();\n    else externalSignal?.addEventListener('abort',abortFromExternal,{once:true});\n    const timeout=setTimeout(()=>controller.abort(),GOOGLE_ROUTE_TIMEOUT_MS);",
    'external abort for Google Traffic'
  );
  source=once(source,
    "    }catch(err){\n      if(err?.name==='AbortError')throw Error('Google Traffic timeout');\n      throw err;\n    }finally{\n      clearTimeout(timeout);\n    }",
    "    }catch(err){\n      if(err?.name==='AbortError'){\n        if(externalSignal?.aborted)throw err;\n        throw Error('Google Traffic timeout');\n      }\n      throw err;\n    }finally{\n      clearTimeout(timeout);\n      externalSignal?.removeEventListener?.('abort',abortFromExternal);\n    }",
    'Google abort cleanup'
  );
  source=source.replaceAll('googleTrafficData(coords)','googleTrafficData(coords,init?.signal)');
  return source;
});

await edit('nav-map.js',source=>once(
  source,
  "    if(oldIndex>0){\n      currentStops=\n        currentStops.slice(oldIndex);\n\n      legDurations=\n        legDurations.slice(oldIndex);",
  "    if(oldIndex>0){\n      if(routeBuildInFlight&&lastGpsPoint){\n        currentStops=remaining;\n        legDurations=[];\n        legStartAt=Date.now();\n        buildRoute(lastGpsPoint,currentStops).catch(\n          error=>console.warn('Zmiana przystanku:',error)\n        );\n        return;\n      }\n\n      currentStops=\n        currentStops.slice(oldIndex);\n\n      legDurations=\n        legDurations.slice(oldIndex);",
  'in-flight target change cancellation'
));

console.log('Etap 5 follow-up zastosowany.');
