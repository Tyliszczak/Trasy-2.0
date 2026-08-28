import assert from'node:assert/strict';
import{readFile}from'node:fs/promises';
import test from'node:test';
import vm from'node:vm';

const source=await readFile(new URL('../i18n.js',import.meta.url),'utf8');

function translator(language){
  const context={
    localStorage:{getItem:()=>language,setItem:()=>{}},
    document:{documentElement:{},readyState:'loading',addEventListener:()=>{}},
    MutationObserver:class{observe(){}},
    console
  };
  context.window=context;
  vm.runInNewContext(source,context,{filename:'i18n.js'});
  return context.TrasyI18n;
}

test('angielski tłumaczy ekran, status czasu i komunikat głosowy',()=>{
  const i18n=translator('en');
  assert.equal(i18n.translateText('Wybierz trasę'),'Choose a route');
  assert.equal(i18n.translateText('17 min opóźnienia'),'17 min late');
  assert.equal(i18n.translateText('Trasa 32 km • 46 min • ruch +4 min'),'Route 32 km • 46 min • traffic +4 min');
  assert.equal(i18n.t('turnRoad',{direction:'left',road:' onto Main Street'}),'Turn left onto Main Street');
  assert.equal(i18n.speechLanguage(),'en-GB');
  assert.equal(i18n.translateText('Nie udało się zablokować wygaszania. Sprawdź oszczędzanie baterii i ustawienia przeglądarki.'),'Could not keep the screen on. Check battery saving and browser settings.');
});

test('ukraiński tłumaczy ekran, status czasu i komunikat głosowy',()=>{
  const i18n=translator('uk');
  assert.equal(i18n.translateText('Język aplikacji'),'Мова застосунку');
  assert.equal(i18n.translateText('17 min za wcześnie'),'17 хв раніше');
  assert.equal(i18n.translateText('KONIEC TRASY'),'КІНЕЦЬ МАРШРУТУ');
  assert.equal(i18n.t('inMeters',{distance:150,instruction:'Поверніть праворуч'}),'Через 150 метрів. Поверніть праворуч');
  assert.equal(i18n.speechLanguage(),'uk-UA');
  assert.equal(i18n.translateText('Nie udało się zablokować wygaszania. Sprawdź oszczędzanie baterii i ustawienia przeglądarki.'),'Не вдалося заблокувати вимкнення екрана. Перевірте режим енергозбереження та налаштування браузера.');
});
