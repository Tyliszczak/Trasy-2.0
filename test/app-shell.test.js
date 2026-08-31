import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { getParkingOptions,getParkingRecords,normalizeCoordinate } from '../parking-data.js';
import { getRoute,getSchedule,mapUrl } from '../schedule.js';

const readSource=name=>readFile(new URL(`../${name}`,import.meta.url),'utf8');

function localScripts(html){
  return [...html.matchAll(/<script\b[^>]*\bsrc=["']\.\/([^"']+)["'][^>]*><\/script>/gi)]
    .map(match=>`./${match[1].split('?')[0]}`);
}

function bootstrapScripts(source){
  return [...source.matchAll(/\[['"](\.\/[^?'"]+)(?:\?[^'"]*)?['"]/g)].map(match=>match[1]);
}

async function applicationScripts(){
  const [html,bootstrap]=await Promise.all([readSource('index.html'),readSource('driver-access-bootstrap.js')]);
  return [...localScripts(html),...bootstrapScripts(bootstrap)];
}

function shellEntries(sw){
  const match=sw.match(/const APP_SHELL=\[(.*?)\];/s);
  assert.ok(match,'Brak APP_SHELL w sw.js');
  return [...match[1].matchAll(/["'](\.\/[^"']+)["']/g)].map(item=>item[1]);
}

test('główny ekran używa MapLibre i nie ładuje Leafleta',async()=>{
  const [html,bootstrap]=await Promise.all([readSource('index.html'),readSource('driver-access-bootstrap.js')]);
  assert.doesNotMatch(html+bootstrap,/leaflet/i);
  assert.match(bootstrap,/vendor\/maplibre-gl\/5\.12\.0\/maplibre-gl\.js/);
  assert.doesNotMatch(html+bootstrap,/unpkg\.com/);
});

test('każdy lokalny skrypt głównej aplikacji jest ładowany tylko raz',async()=>{
  const scripts=await applicationScripts();
  assert.equal(new Set(scripts).size,scripts.length,`Powtórzone skrypty: ${scripts.filter((item,index)=>scripts.indexOf(item)!==index).join(', ')}`);
});

test('każdy lokalny skrypt uruchamiany przez index znajduje się w cache PWA',async()=>{
  const [scripts,sw]=await Promise.all([applicationScripts(),readSource('sw.js')]);
  const shell=new Set(shellEntries(sw));
  const missing=scripts.filter(script=>!shell.has(script));
  assert.deepEqual(missing,[],'Skrypt z index.html nie jest objęty APP_SHELL');
  assert.match(sw,/const CACHE_NAME='trasy-2\.0-v\d+'/);
});

test('kierowca może przełączyć polski, angielski i ukraiński na ekranie wyboru trasy',async()=>{
  const [html,bootstrap,i18n,nav,feedback]=await Promise.all([
    readSource('index.html'),readSource('driver-access-bootstrap.js'),readSource('i18n.js'),readSource('nav-map.js'),readSource('navigation-feedback.js')
  ]);
  assert.match(html,/id="languageButton"/);
  assert.match(html,/🌐/);
  assert.ok(bootstrap.indexOf('./i18n.js')<bootstrap.indexOf('./app.js'),'Tłumaczenia muszą uruchomić się przed aplikacją');
  assert.match(i18n,/SUPPORTED=\['pl','en','uk'\]/);
  assert.match(i18n,/trasy2\.language/);
  assert.match(i18n,/speechLanguage/);
  assert.match(nav,/TrasyI18n\?\.t/);
  assert.match(nav,/speechLanguage\?\.\(\)/);
  assert.match(feedback,/recognition\.lang=window\.TrasyI18n/);
});

test('service worker przełącza wersję dopiero po działaniu kierowcy',async()=>{
  const [app,sw]=await Promise.all([readSource('app.js'),readSource('sw.js')]);
  const installHandler=sw.split('\n').find(line=>line.includes("addEventListener('install'"))||'';
  assert.doesNotMatch(installHandler,/skipWaiting/);
  assert.match(sw,/type==='SKIP_WAITING'/);
  assert.match(app,/if\(!reg\.waiting\)return/);
  assert.match(app,/updateRequested=true/);
  assert.match(app,/if\(updateRequested\)location\.reload\(\)/);
});

test('tylko gps-hub utrzymuje fizyczny watchPosition dla głównej aplikacji',async()=>{
  const scripts=(await applicationScripts()).map(path=>path.slice(2)).filter(name=>name.endsWith('.js')&&!name.startsWith('vendor/'));
  const sources=await Promise.all(scripts.map(async name=>[name,await readSource(name)]));
  const owners=sources.filter(([,source])=>/\bwatchPosition\s*\(/.test(source)).map(([name])=>name);
  assert.deepEqual(owners,['gps-hub.js']);
});

test('blokadą wygaszania zarządza tylko wake-style',async()=>{
  const [app,wake]=await Promise.all([readSource('app.js'),readSource('wake-style.js')]);
  assert.doesNotMatch(app,/wakeLock\.request/);
  assert.match(wake,/wakeLock\.request\('screen'\)/);
});

test('dane tras używają wyłącznie bezpiecznego kontraktu przypisanego do firmy',async()=>{
  const [service,app,returnRoute,bridge,profile]=await Promise.all([
    readSource('route-data-service.js'),readSource('app.js'),readSource('return-route.js'),readSource('platform-bridge.js'),readSource('deployment-profile.js')
  ]);
  assert.match(service,/platform\.routes/);
  assert.doesNotMatch(service,/trasy-data|LEGACY_TEST_URL|REQUIRED_SHEETS|fetch\(/);
  assert.match(bridge,/KURSY_DRIVER_API/);
  assert.match(bridge,/driverRoutes/);
  assert.match(profile,/production:\{/);
  assert.match(profile,/allowLegacySheet:false/);
  assert.match(profile,/allowFallbackRoutes:false/);
  assert.doesNotMatch(app,/FALLBACK_ROUTES|routes\.js/);
  assert.match(app,/__trasyRouteDataService/);
  assert.match(returnRoute,/__trasyPlatform/);
});

test('pojazdy są pobierane z bezpiecznego kontraktu tej samej firmy',async()=>{
  const [app,vehicles,service,provider]=await Promise.all([
    readSource('app.js'),readSource('vehicles.js'),readSource('route-data-service.js'),readSource('google-routes-provider.js')
  ]);
  assert.doesNotMatch(app,/profile\.allowFallbackRoutes|Tryb testowy|FALLBACK_ROUTES/);
  assert.match(vehicles,/platform\.vehicles/);
  assert.match(vehicles,/data\?\.data\?\.POJAZDY/);
  assert.match(vehicles,/__trasyRouteDataService/);
  assert.doesNotMatch(vehicles,/standaloneTestVehicle/);
  for(const source of [app,vehicles,provider,service])assert.doesNotMatch(source,/AKfycbzdG_ARbbPgMdlPteqFLakZHR5EEkT4Lb3YFDbXW_I_OyrDKo8l0_KrQLjnncxj_M9q/);
});

test('wybór najbliższego przyszłego kursu ma jedno źródło w time-core',async()=>{
  const [app,returnRoute,timeCore]=await Promise.all([
    readSource('app.js'),readSource('return-route.js'),readSource('time-core.js')
  ]);
  assert.match(app,/nearestFutureTime/);
  assert.match(returnRoute,/time\.nearestFutureTime/);
  assert.match(timeCore,/waitSeconds=\(courseSeconds-nowSeconds\+DAY_SECONDS\)%DAY_SECONDS/);
  assert.doesNotMatch(returnRoute,/Math\.abs\(a\.m-current\)/);
});

test('status punktualności ma zielony tekst, a kolor niesie kropka',async()=>{
  const [html,header,eta,css]=await Promise.all([
    readSource('index.html'),readSource('next-stop-header.js'),readSource('eta-status.js'),readSource('navigation.css')
  ]);
  assert.doesNotMatch(html,/punctuality-text-color-fix\.js/);
  assert.match(header,/statusEl\.textContent=status\.text/);
  assert.match(eta,/info\.textContent=punctuality\.text/);
  assert.match(css,/nextStopStatus\.early:before\{background:#ffd60a!important\}/);
  assert.match(css,/etaPunctuality\.late:before\{background:#ff3b30\}/);
});

test('kamera ma jeden jawny kontroler i wraca do prowadzenia po 15 sekundach',async()=>{
  const [html,controls,worker]=await Promise.all([
    readSource('index.html'),readSource('navigation-ui-controls.js'),readSource('sw.js')
  ]);
  assert.doesNotMatch(html,/navigation-smoothing\.js/);
  assert.doesNotMatch(worker,/navigation-smoothing\.js/);
  assert.match(controls,/AUTO_RESUME_MS=15000/);
  assert.match(controls,/this\.resumeTimer=setTimeout\(\(\)=>this\.resume\(\),AUTO_RESUME_MS\)/);
  assert.match(controls,/if\(this\.state===['"]manual['"]\)return/);
});

test('przycisk 2D/3D pozostaje kontrolką MapLibre, a północ pokazuje się tylko po ręcznym obrocie',async()=>{
  const controls=await readSource('navigation-ui-controls.js');
  assert.match(controls,/this\.map\.addControl\(control,['"]bottom-right['"]\)/);
  assert.doesNotMatch(controls,/compassIcon|Kompas \/ widok prowadzenia|routePitchFallback/);
  assert.match(controls,/routeNorthIndicator/);
  assert.match(controls,/this\.state!==['"]manual['"]\|\|difference<8/);
  assert.match(controls,/rotate\(\$\{-mapBearing\}deg\)/);
});

test('kamera ustawia pierwszy kierunek od razu i płynnie reaguje na jazdę',async()=>{
  const [map,controls]=await Promise.all([readSource('nav-map.js'),readSource('navigation-ui-controls.js')]);
  assert.match(map,/headingFromRoute\(origin\)/);
  assert.match(map,/currentHeading\+d\*\.68/);
  assert.match(map,/const heading=headingFromPosition\(position,ll\)/);
  assert.doesNotMatch(map,/lastGpsPoint=ll;\s*\n\s*if\(positionMarker\)/);
  assert.match(controls,/CAMERA_MIN_DURATION_MS=550/);
  assert.match(controls,/CAMERA_MAX_DURATION_MS=1350/);
  assert.match(controls,/CAMERA_INTERVAL_FACTOR=1\.12/);
  assert.match(controls,/delta\*\.78/);
});

test('SpeedMax używa wyłącznie OSM przez proxy i cache urządzenia',async()=>{
  const [speed,limit,offline]=await Promise.all([readSource('speed-display.js'),readSource('road-speed-limit.js'),readSource('offline-vmax-cache.js')]);
  assert.match(speed,/trasy:road-speed-limit/);
  assert.match(limit,/trasy:road-speed-limit/);
  assert.match(limit,/OSM_PROXY='\/osm-vmax'/);
  assert.match(limit,/source:'openstreetmap'/);
  assert.doesNotMatch(limit,/PTV_PROXY|ptvFallback|ptv-map-matching/i);
  assert.match(limit,/readVmaxCache/);
  assert.match(limit,/writeVmaxCache/);
  assert.match(offline,/MAX_ENTRIES=250/);
  assert.doesNotMatch(limit,/overpass-api\.de|overpass\.kumi|effectiveVehicleSpeedLimit/);
});

test('brak GPS kończy ładowanie i pokazuje bezpieczne ponowienie',async()=>{
  const [map,css]=await Promise.all([readSource('nav-map.js'),readSource('navigation.css')]);
  assert.match(map,/id="routeGpsRetry"/);
  assert.match(map,/function showNavigationError/);
  assert.match(map,/Nawigacja niedostępna/);
  assert.match(map,/Brak dostępu do lokalizacji/);
  assert.match(map,/startMapNav\(\)/);
  assert.match(css,/#routeMapStatus\[data-state="error"\]/);
});

test('uwagi nawigacyjne nie zapisują nagrań głosowych',async()=>{
  const feedback=await readSource('navigation-feedback.js');
  assert.match(feedback,/SpeechRecognition\|\|window\.webkitSpeechRecognition/);
  assert.match(feedback,/localStorage\.setItem\(STORAGE_KEY/);
  assert.match(feedback,/Dodaj zgłoszenie/);
  assert.match(feedback,/Zgłoś usterkę/);
  assert.match(feedback,/Zgłoś niewłaściwą prędkość/);
  assert.match(feedback,/Zgłoś zamknięty odcinek/);
  assert.match(feedback,/categoryLabel/);
  assert.doesNotMatch(feedback,/Przekaż uwagę o nawigacji/);
  assert.doesNotMatch(feedback,/MediaRecorder|getUserMedia|audio\/webm/);
});

test('zgłoszenia kierowcy trafiają przez bezpieczny kontrakt do panelu i zachowują kolejkę offline',async()=>{
  const feedback=await readSource('navigation-feedback.js');
  assert.match(feedback,/platform\.feedback\(record\)/);
  assert.match(feedback,/deliveryStatus:'pending'/);
  assert.match(feedback,/deliveryStatus:'sent'/);
  assert.match(feedback,/window\.addEventListener\('online',flushPending\)/);
  assert.match(feedback,/panelu administratora i na ustawiony przez niego adres e-mail/);
  assert.doesNotMatch(feedback,/feedbackEmail|adminEmail/);
  assert.doesNotMatch(feedback,/WhatsApp|WHATSAPP|sms:|navigator\.share|navigator\.clipboard|INNA APLIKACJA/);
  assert.doesNotMatch(feedback,/temporaryFeedbackEmail|TEMP_TEST_FEEDBACK_EMAIL|mailto:/);
  assert.match(feedback,/body\.routeFeedbackNavigation #routeFeedbackButton\{position:fixed;right:auto;bottom:auto\}/);
  assert.match(feedback,/button\.style\.top=`\$\{Math\.round\(backRect\.bottom\+10\)\}px`/);
  assert.match(feedback,/new MutationObserver\(updatePosition\)\.observe\(navigationBack,\{attributes:true,attributeFilter:\['style'\]\}\)/);
  assert.doesNotMatch(feedback,/const target=navVisible&&canvas\?canvas:document\.body/);
  assert.match(feedback,/if\(!panelConnected\(\)\)/);
  assert.match(feedback,/pl\.tyli\.trasy2\.feedback-archive/);
  assert.match(feedback,/Trasy2_archiwum_\$\{deviceCode\}_\$\{exportedAt\.slice\(0,10\)\}\.trasy2\.json/);
  assert.match(feedback,/deliveryStatus!=='sent'/);
  assert.doesNotMatch(feedback,/driverSessionToken|refreshToken|activationToken|latitude|longitude/);
});

test('publiczny pakiet nie zawiera wspólnych tras żadnej firmy',async()=>{
  const [app,worker,bootstrap]=await Promise.all([readSource('app.js'),readSource('sw.js'),readSource('driver-access-bootstrap.js')]);
  assert.doesNotMatch(app+worker+bootstrap,/SAS Sulechów|APT - Krężoły|SAS Świebodzin|TopPoint/);
  assert.doesNotMatch(worker,/\.\/routes\.js/);
});

test('parkingi wspólne i przypisane do trasy są poprawnie wybierane',()=>{
  const data={PARKINGI:[
    ['NAZWA','LOKALIZACJA','TRASA'],
    ['Baza','51.10, 15.20','*'],
    ['Sulechów','51.20;15.30','SAS Sulechów'],
    ['Inna trasa','51.30, 15.40','TopPoint'],
    ['Duplikat','51.10, 15.20','']
  ]};
  assert.deepEqual(getParkingOptions(data,'SAS Sulechów'),[
    {name:'Baza',coordinates:'51.1, 15.2'},
    {name:'Sulechów',coordinates:'51.2, 15.3'}
  ]);
  assert.deepEqual(getParkingRecords(data).map(record=>record.route),['*','SAS Sulechów','TopPoint']);
  assert.deepEqual(getParkingOptions({parkings:[
    {name:'Baza API',coordinates:'51.4,15.5',routeName:'SAS Sulechów'},
    {name:'Wspólny API',coordinates:'51.5,15.6',routeName:'*'}
  ]},'SAS Sulechów'),[
    {name:'Baza API',coordinates:'51.4, 15.5'},
    {name:'Wspólny API',coordinates:'51.5, 15.6'}
  ]);
  assert.equal(normalizeCoordinate('91, 15'),'');
});

test('lokalizacja POWRÓT przechodzi z kontraktu API do wiersza harmonogramu',async()=>{
  const [app,returnRoute]=await Promise.all([readSource('app.js'),readSource('return-route.js')]);
  assert.match(app,/returnCoordinates/);
  assert.match(app,/dataset\.returnCoordinate=s\.returnCoordinates\|\|s\.coordinates/);
  assert.match(returnRoute,/row\.dataset\.returnCoordinate\|\|row\.dataset\.forwardCoordinate/);
});

test('koniec trasy powrotnej uruchamia osobny odcinek do Bazy lub Parkingu',async()=>{
  const [tracker,returnRoute]=await Promise.all([readSource('gps-stop-tracker.js'),readSource('return-route.js')]);
  assert.match(tracker,/gps-stop-arrival/);
  assert.match(tracker,/final:currentIndex===routeRows\.length-1/);
  assert.match(returnRoute,/startParkingLegAfterReturn/);
  assert.match(returnRoute,/reason:'return-completed'/);
  assert.match(returnRoute,/options\.length===1\?options\[0\]:await parkingDialog/);
  assert.match(returnRoute,/showModeNotice\('Brak Bazy\/Parkingu/);
  assert.doesNotMatch(returnRoute,/alert\('Administrator nie wprowadził lokalizacji/);
});

test('edycja Bazy i Parkingu jest dostępna wyłącznie w zabezpieczonym panelu administratora',async()=>{
  const [html,mapEditor,returnRoute]=await Promise.all([
    readSource('parking-admin.html'),readSource('map-editor.html'),readSource('return-route.js')
  ]);
  assert.match(html,/Bazy i parkingi/);
  assert.match(html,/https:\/\/app\.tyli\.pl\//);
  assert.doesNotMatch(html,/adminPassword|Leaflet|upsertParking/);
  assert.match(mapEditor,/https:\/\/app\.tyli\.pl\//);
  assert.match(returnRoute,/platform\.parkings\(\)/);
});

test('link mapy zachowuje współrzędne',()=>{
  const coordinates='51.123, 15.456';
  assert.equal(new URL(mapUrl(coordinates)).searchParams.get('query'),coordinates);
});
