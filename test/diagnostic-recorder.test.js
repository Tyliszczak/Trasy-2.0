import test from'node:test';
import assert from'node:assert/strict';
import fs from'node:fs';
import vm from'node:vm';

const read=name=>fs.readFileSync(new URL(`../${name}`,import.meta.url),'utf8');

test('rejestrator diagnostyczny jest ograniczony do oznaczonej wersji testowej',()=>{
  const source=read('diagnostic-recorder.js');
  const html=read('index.html');
  assert.doesNotThrow(()=>new vm.Script(source));
  assert.match(html,/<body data-test-diagnostics="enabled">/);
  assert.match(source,/dataset\.testDiagnostics!=='enabled'/);
  assert.match(source,/\/\^TEST\\b\/i/);
});

test('diagnostyka zapisuje lokalnie GPS i zdarzenia wyboru przystanku',()=>{
  const source=read('diagnostic-recorder.js');
  assert.match(source,/indexedDB\.open/);
  assert.match(source,/gps-fix/);
  assert.match(source,/trasy:stop-transition/);
  assert.match(source,/trasy:route-build/);
  assert.match(source,/visibility-change/);
});

test('aktywna diagnostyka automatycznie wysyła kolejkowane paczki przez Cloudflare',()=>{
  const source=read('diagnostic-recorder.js');
  assert.match(source,/UPLOAD_ENDPOINT='\/test-diagnostics'/);
  assert.match(source,/index\('uploadState'\)/);
  assert.match(source,/markEventsUploaded/);
  assert.match(source,/keepalive:true/);
  assert.match(source,/visibilityState==='hidden'/);
  assert.match(source,/window\.addEventListener\('pagehide'/);
  assert.match(source,/application-use-ended/);
  assert.match(source,/finishUse\('hidden'\)/);
  assert.match(source,/pendingSessionEvents/);
  assert.match(source,/UPLOAD_WINDOW_KEY/);
  assert.match(source,/dueUploadWindow/);
  assert.match(source,/getHours\(\)>=12/);
  assert.match(source,/getHours\(\)>=18/);
  assert.match(source,/deviceLabel:deviceLabel\(\)/);
  assert.match(source,/DEVICE_NAME_KEY/);
  assert.match(source,/id="diagnosticDeviceName"/);
  assert.match(source,/runScheduledUpload\(\)/);
  assert.match(source,/UPLOAD_MAX_ATTEMPTS=3/);
  assert.match(source,/Błąd wysyłki danych diagnostycznych/);
  assert.doesNotMatch(source,/new Notification\(/);
  assert.doesNotMatch(source,/id='diagnosticUploadError'/);
  assert.doesNotMatch(source,/event\.returnValue/);
  assert.match(source,/__trasyDiagnosticsClose/);
  assert.match(source,/uploadErrors/);
  assert.match(source,/diagnostics-alert/);
  assert.match(source,/failedReports/);
  assert.match(source,/courseKey/);
  assert.doesNotMatch(source,/UPLOAD_INTERVAL_MS=60000/);
  assert.doesNotMatch(source,/DIAGNOSTICS_SHARED_SECRET/);
});

test('okno zgody wyjaśnia cel i nie pokazuje ręcznej wysyłki ani zapisu pliku',()=>{
  const source=read('diagnostic-recorder.js');
  assert.match(source,/wykrywać i naprawiać błędy harmonogramu, prowadzenia do przystanków oraz GPS/);
  assert.match(source,/dokładną lokalizację/);
  assert.match(source,/prywatnego folderu diagnostycznego/);
  assert.match(source,/Rejestrowanie można później wyłączyć/);
  assert.match(source,/WYRAŻAM ZGODĘ/);
  assert.match(source,/NIE TERAZ/);
  assert.match(source,/clear\.hidden=!approved/);
  assert.doesNotMatch(source,/diagnosticSend|diagnosticDownload|exportDiagnostics|downloadFile|mailto:/);
});

test('skrypt diagnostyczny jest częścią powłoki offline PWA',()=>{
  const html=read('index.html');
  const sw=read('sw.js');
  assert.match(html,/src="\.\/diagnostic-recorder\.js\?v=14"/);
  assert.match(html,/src="\.\/resume-stop-ai\.js\?v=2"/);
  assert.match(sw,/'\.\/diagnostic-recorder\.js'/);
  assert.match(sw,/'\.\/resume-stop-ai\.js'/);
});

test('pierwsze użycie samo otwiera zgodę, a zatwierdzenie uruchamia rejestrowanie',()=>{
  const source=read('diagnostic-recorder.js');
  assert.match(source,/FIRST_USE_PROMPT_KEY/);
  assert.match(source,/CONSENT_KEY/);
  assert.match(source,/WYRAŻAM ZGODĘ/);
  assert.match(source,/Dane nie są zbierane przed Twoją zgodą/);
  assert.match(source,/if\(!active&&localStorage\.getItem\(FIRST_USE_PROMPT_KEY\)!=='shown'\)/);
  assert.match(source,/localStorage\.setItem\(CONSENT_KEY,'approved'\)/);
  assert.match(source,/if\(accepting&&active\)dialog\.close\(\)/);
  assert.match(source,/event\.oldVersion<2/);
});

test('pełne paczki diagnostyczne trafiają do prywatnego folderu, a arkusz przechowuje indeks',()=>{
  const backend=read('TEST_DIAGNOSTICS_APPS_SCRIPT.gs.txt');
  const recorder=read('diagnostic-recorder.js');
  assert.doesNotThrow(()=>new vm.Script(backend));
  assert.match(backend,/getProperty\('DIAGNOSTICS_FOLDER_ID'\)/);
  assert.match(backend,/getDiagnosticsJsonRoot_\(properties\)/);
  assert.match(backend,/getFoldersByName\('Pliki JSON'\)/);
  assert.match(backend,/getDiagnosticsDeviceFolder_/);
  assert.match(backend,/deviceFolder\.createFile\(/);
  assert.match(backend,/trasy-2\.0-test-diagnostics-session/);
  assert.match(backend,/file\.setContent\(serialized\)/);
  assert.match(backend,/file\.setName\(diagnosticsSessionFileName_/);
  assert.match(backend,/Utilities\.formatDate/);
  assert.match(backend,/archive\.deviceLabel/);
  assert.match(backend,/isDiagnosticsEventSeen_/);
  assert.match(backend,/acceptedEvents/);
  assert.doesNotMatch(backend,/createTextFinder\(batchId\)/);
  assert.match(backend,/'URZĄDZENIE'/);
  assert.match(backend,/'PLIK_JSON'/);
  assert.doesNotMatch(backend,/'DANE_JSON'/);
  assert.match(recorder,/prywatnego folderu diagnostycznego/);
});

test('zakresy wysłanych zdarzeń są scalane i blokują częściowe duplikaty',()=>{
  const backend=read('TEST_DIAGNOSTICS_APPS_SCRIPT.gs.txt');
  const context={};
  vm.runInNewContext(backend,context);
  const ranges=context.normalizeDiagnosticsRanges_([[10,20],[1,5],[5,9],[30,30]]);
  assert.deepEqual(JSON.parse(JSON.stringify(ranges)),[[1,20],[30,30]]);
  assert.equal(context.isDiagnosticsEventSeen_(ranges,15),true);
  assert.equal(context.isDiagnosticsEventSeen_(ranges,25),false);
  context.addDiagnosticsSeenEvents_(ranges,[{id:21},{id:22},{id:29}]);
  assert.deepEqual(JSON.parse(JSON.stringify(ranges)),[[1,22],[29,30]]);
});

test('nazwa pliku sesji zawiera czas i czytelną nazwę telefonu',()=>{
  const backend=read('TEST_DIAGNOSTICS_APPS_SCRIPT.gs.txt');
  const context={
    Session:{getScriptTimeZone:()=>'Europe/Warsaw'},
    Utilities:{formatDate:date=>date.toISOString().slice(0,19).replace('T','_').replaceAll(':','-')}
  };
  vm.runInNewContext(backend,context);
  const archive={
    installationId:'83592448-5fc1-452c-a22f-94ca7ff54789',
    deviceLabel:'Telefon Krzysztofa',
    channel:'TEST',
    events:[
      {at:'2026-09-09T06:12:25.000Z',snapshot:{route:'SAS Sulechów'}},
      {at:'2026-09-09T08:31:34.000Z',snapshot:{route:'SAS Sulechów'}}
    ]
  };
  assert.equal(
    context.diagnosticsSessionFileName_(archive,'1234567890abcdef',1),
    'SAS-Sulechów_2026-09-09_06-12-25_Telefon-Krzysztofa_TEST.json'
  );
});

test('diagnostyka ogranicza powtarzalne statusy i zachowuje dane pozycji po wznowieniu',()=>{
  const source=read('diagnostic-recorder.js');
  assert.match(source,/EVENT_MIN_INTERVAL_MS/);
  assert.match(source,/'eta-status-change':10000/);
  assert.match(source,/'stop-guard-change':30000/);
  assert.match(source,/type==='trasy:gps-speed'\)return false/);
  assert.match(source,/value\.coords&&Number\.isFinite/);
  assert.match(source,/trasy:gps-stale/);
  assert.match(source,/trasy:gps-refresh-failed/);
});

test('wersja testowa ma pełny profil diagnostyczny, ale nie omija zgody użytkownika',()=>{
  const source=read('diagnostic-recorder.js');
  assert.match(source,/const FULL_TEST_CAPTURE=true/);
  assert.match(source,/GPS_MIN_INTERVAL_MS=FULL_TEST_CAPTURE\?0:900/);
  assert.match(source,/MAX_EVENTS=FULL_TEST_CAPTURE\?200000:50000/);
  assert.match(source,/FULL_TEST_CAPTURE\?uploadPending\(\):runScheduledUpload\(\)/);
  assert.match(source,/localStorage\.getItem\(CONSENT_KEY\)!=='approved'/);
});

test('wynik oceny AI zapisuje się jako zdarzenie diagnostyczne i jest widoczny po wysyłce',()=>{
  const source=read('diagnostic-recorder.js');
  assert.match(source,/record\('diagnostics-quality',quality,true\)/);
  assert.match(source,/Ocena \$\{quality\.source==='workers-ai'\?'AI':'techniczna'\}/);
});

test('decyzja AI o wznowieniu jest rejestrowana do późniejszej oceny użyteczności',()=>{
  const source=read('diagnostic-recorder.js');
  const resumeAi=read('resume-stop-ai.js');
  assert.match(source,/trasy:ai-resume-decision/);
  assert.match(resumeAi,/resume-candidates/);
  assert.match(resumeAi,/confidence>=85/);
  assert.match(resumeAi,/source:'ai-resume-undo'/);
});

test('każdy kurs ma pełny, rozdzielny kontekst przystanków',()=>{
  const recorder=read('diagnostic-recorder.js');
  const tracker=read('gps-stop-tracker.js');
  assert.match(recorder,/type:'course-context'/);
  assert.match(recorder,/courseId/);
  assert.match(recorder,/routeStops\(\)/);
  assert.match(recorder,/forwardCoordinate/);
  assert.match(recorder,/returnCoordinate/);
  assert.match(recorder,/uploadSessionId\(events\)/);
  assert.match(tracker,/function stopName\(row\)/);
  assert.match(tracker,/stopName\(target\)/);
  assert.match(tracker,/stopName\(skippedRow\)/);
  assert.doesNotMatch(tracker,/target\.children\[0\]\?\.innerText/);
});
