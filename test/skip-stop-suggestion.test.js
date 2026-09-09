import test from'node:test';
import assert from'node:assert/strict';
import fs from'node:fs';
const read=path=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('pytanie o pominięcie ma prostą formę POMIŃ / ANULUJ',()=>{
  const source=read('skip-stop-suggestion.js');
  assert.match(source,/>Pominąć przystanek\?<\/div>/);
  assert.match(source,/id="skipStopSuggestionName"/);
  assert.match(source,/>POMIŃ<\/button>/);
  assert.match(source,/>ANULUJ<\/button>/);
  assert.doesNotMatch(source,/NIE, JADĘ OBJAZDEM/);
  assert.doesNotMatch(source,/POTWIERDŹ POMINIĘCIE/);
});

test('sugestia wymaga kilku zgodnych odczytów: aktualny punkt z tyłu, następny z przodu',()=>{
  const source=read('skip-stop-suggestion.js');
  assert.match(source,/const CONFIRM_FIXES=3/);
  assert.match(source,/const CURRENT_BEHIND_DEG=120/);
  assert.match(source,/const NEXT_AHEAD_DEG=75/);
  assert.match(source,/currentDistance>=MIN_CURRENT_DISTANCE_M/);
  assert.match(source,/currentAngle>=CURRENT_BEHIND_DEG/);
  assert.match(source,/nextAngle<=NEXT_AHEAD_DEG/);
  assert.match(source,/currentDistance>=candidateClosest\+MIN_AWAY_GROWTH_M/);
});

test('dla przystanku z planem pytanie nie pojawia się, gdy kierowca jest za wcześnie',()=>{
  const source=read('skip-stop-suggestion.js');
  assert.match(source,/if\(!plan\)return true/);
  assert.match(source,/\['late','onTime','arrived'\]\.includes/);
  assert.doesNotMatch(source,/\['early','late','onTime'/);
});

test('POMIŃ pomija bieżący przystanek, a ANULUJ zapamiętuje odmowę dla tego punktu',()=>{
  const source=read('skip-stop-suggestion.js');
  assert.match(source,/new CustomEvent\('gps-skip-current-stop'/);
  assert.match(source,/source:'skip-suggestion-confirmed'/);
  assert.match(source,/declinedKey=rowKey\(row,index\)/);
  assert.match(source,/declinedKey===key/);
});

test('automatyczne odzyskanie następnego celu jest cofane do decyzji kierowcy',()=>{
  const source=read('skip-stop-suggestion.js');
  assert.match(source,/detail\.reason==='reacquired-target'/);
  assert.match(source,/new CustomEvent\('gps-skip-stop'/);
  assert.match(source,/source:'skip-suggestion-hold'/);
  assert.match(source,/queueMicrotask\(\(\)=>openDialog\(previousIndex\)\)/);
});

test('ręczne pominięcie po kliknięciu POMIŃ pokazuje tylko POTWIERDŹ i ANULUJ',()=>{
  const source=read('skip-stop-control.js');
  assert.match(source,/title\.hidden=true/);
  assert.match(source,/meta\.hidden=true/);
  assert.match(source,/showSegment\.hidden=true/);
  assert.match(source,/previous\.hidden=true/);
  assert.match(source,/skip\.textContent='POTWIERDŹ'/);
  assert.match(source,/cancel\.textContent='ANULUJ'/);
  assert.doesNotMatch(source,/Nawigacja natychmiast przejdzie/);
  assert.doesNotMatch(source,/POTWIERDŹ POMINIĘCIE/);
});

test('moduł pytania jest ładowany i dostępny offline bez zmiany numeru wersji',()=>{
  const html=read('index.html');
  const sw=read('sw.js');
  assert.match(html,/skip-stop-suggestion\.js\?v=1/);
  assert.match(sw,/'\.\/skip-stop-suggestion\.js'/);
  assert.match(html,/data-version="2\.0\.215"/);
  assert.match(sw,/APP_VERSION='2\.0\.215'/);
});
