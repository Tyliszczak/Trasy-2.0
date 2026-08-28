(()=>{
  const STORAGE_KEY='trasy2.language';
  const SUPPORTED=['pl','en','uk'];
  const SPEECH_LANG={pl:'pl-PL',en:'en-GB',uk:'uk-UA'};
  const LANGUAGE_NAMES={pl:'Polski',en:'English',uk:'Українська'};

  const MESSAGES={
    pl:{
      appLanguage:'Język aplikacji',chooseLanguage:'Wybierz język aplikacji',close:'Zamknij',back:'Wróć',cancel:'ANULUJ',
      directionLeft:'w lewo',directionRight:'w prawo',directionSlightLeft:'lekko w lewo',directionSlightRight:'lekko w prawo',directionSharpLeft:'ostro w lewo',directionSharpRight:'ostro w prawo',directionStraight:'prosto',directionUturn:'zawróć',
      roadName:' w {name}',departDirection:'Rusz {direction}',departStraight:'Rusz prosto',arrivePoint:'Dojeżdżasz do punktu',roundabout:'Wjedź na rondo',roundaboutExit:'Wjedź na rondo i wybierz {exit}. zjazd',merge:'Włącz się {direction}',fork:'Na rozwidleniu trzymaj się {direction}',onRamp:'Wjedź na zjazd {direction}',offRamp:'Zjedź {direction}',endOfRoad:'Na końcu drogi skręć {direction}{road}',continueRoad:'Jedź {direction}{road}',turnRoad:'Skręć {direction}{road}',driveRoad:'Jedź {direction}{road}',inMeters:'Za {distance} metrów. {instruction}'
    },
    en:{
      appLanguage:'App language',chooseLanguage:'Choose app language',close:'Close',back:'Back',cancel:'CANCEL',
      directionLeft:'left',directionRight:'right',directionSlightLeft:'slightly left',directionSlightRight:'slightly right',directionSharpLeft:'sharply left',directionSharpRight:'sharply right',directionStraight:'straight ahead',directionUturn:'make a U-turn',
      roadName:' onto {name}',departDirection:'Set off {direction}',departStraight:'Set off straight ahead',arrivePoint:'You are approaching the destination',roundabout:'Enter the roundabout',roundaboutExit:'Enter the roundabout and take exit {exit}',merge:'Merge {direction}',fork:'At the fork keep {direction}',onRamp:'Take the ramp {direction}',offRamp:'Exit {direction}',endOfRoad:'At the end of the road turn {direction}{road}',continueRoad:'Continue {direction}{road}',turnRoad:'Turn {direction}{road}',driveRoad:'Drive {direction}{road}',inMeters:'In {distance} metres. {instruction}'
    },
    uk:{
      appLanguage:'Мова застосунку',chooseLanguage:'Виберіть мову застосунку',close:'Закрити',back:'Назад',cancel:'СКАСУВАТИ',
      directionLeft:'ліворуч',directionRight:'праворуч',directionSlightLeft:'трохи ліворуч',directionSlightRight:'трохи праворуч',directionSharpLeft:'різко ліворуч',directionSharpRight:'різко праворуч',directionStraight:'прямо',directionUturn:'розверніться',
      roadName:' на {name}',departDirection:'Рушайте {direction}',departStraight:'Рушайте прямо',arrivePoint:'Ви наближаєтеся до пункту призначення',roundabout:'В’їдьте на кільце',roundaboutExit:'В’їдьте на кільце та оберіть {exit}-й з’їзд',merge:'Перелаштуйтеся {direction}',fork:'На розвилці тримайтеся {direction}',onRamp:'Заїдьте на з’їзд {direction}',offRamp:'З’їдьте {direction}',endOfRoad:'У кінці дороги поверніть {direction}{road}',continueRoad:'Продовжуйте рух {direction}{road}',turnRoad:'Поверніть {direction}{road}',driveRoad:'Рухайтеся {direction}{road}',inMeters:'Через {distance} метрів. {instruction}'
    }
  };

  const EXACT={
    'Język aplikacji':['App language','Мова застосунку'],
    'Wybierz język aplikacji':['Choose app language','Виберіть мову застосунку'],
    'ANULUJ':['CANCEL','СКАСУВАТИ'],
    'Zamknij':['Close','Закрити'],
    'Zamknij komunikat':['Close message','Закрити повідомлення'],
    'START':['START','ПОЧАТОК'],
    'KONIEC TRASY':['END OF ROUTE','КІНЕЦЬ МАРШРУТУ'],
    'Nowa wersja aplikacji jest gotowa.':['A new version of the app is ready.','Доступна нова версія застосунку.'],
    'ODŚWIEŻ':['REFRESH','ОНОВИТИ'],
    'Sprawdź działanie programu. Nie masz połączenia z bazą danych od ponad 3 dni.':['Check the app. There has been no connection to the database for more than 3 days.','Перевірте роботу застосунку. З’єднання з базою даних відсутнє понад 3 дні.'],
    'Wybierz trasę':['Choose a route','Виберіть маршрут'],
    'Wybierz trasę.':['Choose a route.','Виберіть маршрут.'],
    'Trasa':['Route','Маршрут'],
    'POKAŻ HARMONOGRAM':['SHOW SCHEDULE','ПОКАЗАТИ РОЗКЛАД'],
    'Wróć':['Back','Назад'],
    'Blokada wygaszania ekranu':['Keep screen on','Не вимикати екран'],
    'Ta przeglądarka nie obsługuje blokady wygaszania. Otwórz aplikację w aktualnej przeglądarce Chrome lub Safari.':['This browser does not support keeping the screen on. Open the app in an up-to-date Chrome or Safari browser.','Цей браузер не підтримує блокування вимкнення екрана. Відкрийте застосунок в оновленому Chrome або Safari.'],
    'Telefon zwolnił blokadę wygaszania. Próbuję włączyć ją ponownie.':['The phone released the screen lock. Trying to keep the screen on again.','Телефон скасував блокування вимкнення екрана. Спробую ввімкнути його знову.'],
    'Nie udało się zablokować wygaszania. Sprawdź oszczędzanie baterii i ustawienia przeglądarki.':['Could not keep the screen on. Check battery saving and browser settings.','Не вдалося заблокувати вимкнення екрана. Перевірте режим енергозбереження та налаштування браузера.'],
    'EKRAN':['SCREEN','ЕКРАН'],
    'Przystanek':['Stop','Зупинка'],
    'Godzina':['Time','Час'],
    'Aktualna godzina':['Current time','Поточний час'],
    'Godzina kursu':['Service time','Час рейсу'],
    'Chcesz zainstalować aplikację TRASY 2.0?':['Would you like to install the TRASY 2.0 app?','Бажаєте встановити застосунок TRASY 2.0?'],
    'ZAINSTALUJ':['INSTALL','ВСТАНОВИТИ'],
    'ODRZUĆ':['NOT NOW','НЕ ЗАРАЗ'],
    'Ta trasa nie ma dostępnych godzin.':['This route has no available service times.','Для цього маршруту немає доступних рейсів.'],
    'Koniec trasy':['End of route','Кінець маршруту'],
    'Pokaż trasę':['Show route','Показати маршрут'],
    'Tryb testowy — trwa sprawdzanie aktualnych danych firmy.':['Test mode — checking the current company data.','Тестовий режим — перевіряємо актуальні дані компанії.'],
    'Tryb testowy — bezpieczne dane firmy pojawią się po uruchomieniu z panelu kierowcy.':['Test mode — secure company data will appear after launch from the driver panel.','Тестовий режим — захищені дані компанії з’являться після запуску з панелі водія.'],
    'Pojazd':['Vehicle','Транспортний засіб'],
    'Pojazd:':['Vehicle:','Транспорт:'],
    'Wybierz pojazd':['Choose a vehicle','Виберіть транспорт'],
    'Zmień pojazd':['Change vehicle','Змінити транспорт'],
    'Którym pojazdem jedziesz?':['Which vehicle are you driving?','На якому транспорті ви їдете?'],
    'Lista pojazdów jest chwilowo niedostępna. Harmonogram możesz uruchomić bez wyboru pojazdu.':['The vehicle list is temporarily unavailable. You can open the schedule without selecting a vehicle.','Список транспортних засобів тимчасово недоступний. Розклад можна відкрити без вибору транспорту.'],
    'Wybierz pojazd przed otwarciem harmonogramu.':['Choose a vehicle before opening the schedule.','Виберіть транспорт перед відкриттям розкладу.'],
    'POWRÓT':['RETURN','ПОВЕРНЕННЯ'],
    'Powrót':['Return','Повернення'],
    'NA PUSTO':['EMPTY RUN','БЕЗ ПАСАЖИРІВ'],
    'Na pusto':['Empty run','Без пасажирів'],
    'ODJECHAŁEŚ PRZED CZASEM':['YOU LEFT EARLY','ВИ ВИЇХАЛИ ЗАРАНО'],
    'WYBIERZ BAZĘ / PARKING':['CHOOSE BASE / PARKING','ВИБЕРІТЬ БАЗУ / ПАРКОВКУ'],
    'Brak Bazy/Parkingu dla tej firmy lub trasy. Poproś administratora o uzupełnienie lokalizacji.':['No base/parking is configured for this company or route. Ask the administrator to add the location.','Для цієї компанії або маршруту не налаштовано базу/парковку. Попросіть адміністратора додати місцезнаходження.'],
    'Nie udało się pobrać parkingów. Sprawdź połączenie i spróbuj ponownie.':['Unable to load parking locations. Check the connection and try again.','Не вдалося завантажити парковки. Перевірте з’єднання та спробуйте ще раз.'],
    'PARKING':['PARKING','ПАРКОВКА'],
    'NAWIGUJ':['NAVIGATE','НАВІГАЦІЯ'],
    'ZAKOŃCZ':['END','ЗАВЕРШИТИ'],
    'NAWIGACJA':['NAVIGATION','НАВІГАЦІЯ'],
    'Pobieranie trasy…':['Loading route…','Завантаження маршруту…'],
    'Pobieranie pozycji…':['Getting location…','Визначення місцезнаходження…'],
    'Pobieranie pozycji telefonu…':['Getting phone location…','Визначення місцезнаходження телефону…'],
    'SPRÓBUJ PONOWNIE':['TRY AGAIN','СПРОБУВАТИ ЩЕ РАЗ'],
    'Nawigacja niedostępna':['Navigation unavailable','Навігація недоступна'],
    'Brak dostępu do lokalizacji. Włącz lokalizację dla tej aplikacji.':['Location access is unavailable. Enable location access for this app.','Немає доступу до геолокації. Увімкніть геолокацію для цього застосунку.'],
    'Nie można ustalić pozycji GPS. Sprawdź, czy lokalizacja jest włączona.':['Unable to determine GPS position. Check that location is enabled.','Не вдалося визначити GPS-позицію. Перевірте, чи ввімкнено геолокацію.'],
    'Oczekiwanie na pozycję GPS trwało zbyt długo.':['Waiting for a GPS position took too long.','Очікування GPS-позиції тривало надто довго.'],
    'Mapa nie jest jeszcze gotowa. Spróbuj ponownie.':['The map is not ready yet. Try again.','Карта ще не готова. Спробуйте ще раз.'],
    'Nie udało się pobrać przebiegu trasy.':['Unable to load the route.','Не вдалося завантажити маршрут.'],
    'Nie udało się uruchomić nawigacji.':['Unable to start navigation.','Не вдалося запустити навігацію.'],
    'Sprawdź ustawienia lokalizacji i spróbuj ponownie.':['Check location settings and try again.','Перевірте налаштування геолокації та спробуйте ще раз.'],
    'Sprawdź połączenie z internetem i spróbuj ponownie.':['Check your internet connection and try again.','Перевірте з’єднання з інтернетом і спробуйте ще раз.'],
    'Pobieranie przebiegu trasy…':['Loading route…','Завантаження маршруту…'],
    'Aktualizuję pozycję po wznowieniu…':['Updating location after resume…','Оновлення місцезнаходження після відновлення…'],
    'Pozycja zaktualizowana • używam dotychczasowej trasy':['Location updated • using the current route','Місцезнаходження оновлено • використовується поточний маршрут'],
    'Czekam na świeżą pozycję GPS…':['Waiting for a fresh GPS position…','Очікування нової GPS-позиції…'],
    'Mapa nie została załadowana. Sprawdź połączenie z internetem.':['The map did not load. Check your internet connection.','Карту не завантажено. Перевірте з’єднання з інтернетом.'],
    'Brak pozostałych punktów trasy.':['There are no remaining route points.','На маршруті не залишилося пунктів.'],
    'Poza trasą — sprawdzam zjazd…':['Off route — checking a new path…','Поза маршрутом — перевіряємо новий шлях…'],
    'Następny przystanek':['Next stop','Наступна зупинка'],
    'START TRASY POWROTNEJ':['START OF RETURN ROUTE','ПОЧАТОК ЗВОРОТНОГО МАРШРУТУ'],
    'Punkt startowy':['Starting point','Початковий пункт'],
    'JESTEŚ ZA WCZEŚNIE — POCZEKAJ':['YOU ARE EARLY — WAIT','ВИ ПРИЇХАЛИ ЗАРАНО — ЗАЧЕКАЙТЕ'],
    'Brak danych o ograniczeniu prędkości':['No speed-limit data','Немає даних про обмеження швидкості'],
    'Ograniczenie prędkości':['Speed limit','Обмеження швидкості'],
    'Prędkość i ograniczenie prędkości':['Speed and speed limit','Швидкість та її обмеження'],
    'Wróć do nawigacji':['Return to navigation','Повернутися до навігації'],
    'Kierunek północny':['North direction','Напрямок на північ'],
    'Włącz komunikaty głosowe':['Turn on voice guidance','Увімкнути голосові підказки'],
    'Wycisz komunikaty głosowe':['Mute voice guidance','Вимкнути голосові підказки'],
    'Zmień widok mapy':['Change map view','Змінити вигляд карти'],
    'Widok 2D z góry':['Top-down 2D view','Вигляд 2D зверху'],
    'Widok 3D pochylony':['Tilted 3D view','Нахилений вигляд 3D'],
    'Dodaj zgłoszenie':['Add report','Додати повідомлення'],
    'Wróć do rodzajów zgłoszeń':['Back to report types','Назад до типів повідомлень'],
    'Zgłoś usterkę':['Report a fault','Повідомити про несправність'],
    'Zgłoś niewłaściwą prędkość':['Report an incorrect speed limit','Повідомити про неправильне обмеження швидкості'],
    'Zgłoś zamknięty odcinek':['Report a road closure','Повідомити про перекриту ділянку'],
    'Opisz zgłoszenie…':['Describe the issue…','Опишіть проблему…'],
    'Opisz, co nie działa i na którym ekranie…':['Describe what is not working and on which screen…','Опишіть, що не працює і на якому екрані…'],
    'Podaj prawidłowe ograniczenie i opisz miejsce…':['Enter the correct speed limit and describe the location…','Вкажіть правильне обмеження швидкості та опишіть місце…'],
    'Opisz zamknięty odcinek lub przeszkodę na drodze…':['Describe the closed section or road obstruction…','Опишіть перекриту ділянку або перешкоду на дорозі…'],
    'Dyktuj uwagę':['Dictate a note','Продиктувати повідомлення'],
    'Możesz napisać lub podyktować uwagę.':['You can type or dictate a note.','Ви можете написати або продиктувати повідомлення.'],
    'WYŚLIJ':['SEND','НАДІСЛАТИ'],
    'WYŚLIJ TESTOWO E-MAILEM':['SEND TEST E-MAIL','НАДІСЛАТИ ТЕСТОВИМ E-MAIL'],
    'ZAPISZ PLIK ARCHIWUM':['SAVE ARCHIVE FILE','ЗБЕРЕГТИ ФАЙЛ АРХІВУ'],
    'Panel administratora nie jest jeszcze połączony. Zgłoszenie zostanie zapisane na tym urządzeniu, a następnie otworzy się gotowa wiadomość e-mail. Po nadaniu dostępu z panelu ten tymczasowy sposób zostanie automatycznie wyłączony.':['The administrator panel is not connected yet. The report will be saved on this device, then a prepared e-mail will open. This temporary method will be disabled automatically after access is granted from the panel.','Панель адміністратора ще не під’єднана. Повідомлення буде збережено на цьому пристрої, після чого відкриється готовий e-mail. Після надання доступу з панелі цей тимчасовий спосіб буде автоматично вимкнено.'],
    'Zgłoszenie zostanie wysłane do panelu administratora i na ustawiony przez niego adres e-mail.':['The report will be sent to the administrator panel and to the configured e-mail address.','Повідомлення буде надіслано до панелі адміністратора та на вказану ним адресу e-mail.'],
    'Na tym urządzeniu nie ma oczekujących zgłoszeń do zapisania.':['There are no pending reports to save on this device.','На цьому пристрої немає повідомлень, що очікують збереження.'],
    'Zgłoszenie zapisano lokalnie. Dokończ wysyłanie w otwartej aplikacji pocztowej.':['The report was saved locally. Finish sending it in the opened e-mail app.','Повідомлення збережено локально. Завершіть надсилання у відкритій поштовій програмі.'],
    'Zgłoszenie wysłano do panelu administratora i przekazano do wysyłki e-mail.':['The report was sent to the administrator panel and queued for e-mail delivery.','Повідомлення надіслано до панелі адміністратора та передано для відправлення e-mail.'],
    'Zatrzymaj dyktowanie':['Stop dictation','Зупинити диктування'],
    'Słucham… dotknij ponownie, aby zakończyć.':['Listening… tap again to finish.','Слухаю… торкніться ще раз, щоб завершити.'],
    'Brak zgody na użycie mikrofonu.':['Microphone permission was not granted.','Немає дозволу на використання мікрофона.'],
    'Nie udało się rozpoznać głosu. Możesz wpisać uwagę.':['Speech could not be recognised. You can type the note.','Не вдалося розпізнати мовлення. Ви можете ввести повідомлення.'],
    'To urządzenie nie obsługuje dyktowania w przeglądarce.':['This device does not support browser dictation.','Цей пристрій не підтримує диктування у браузері.'],
    'Wybierz rodzaj zgłoszenia.':['Choose a report type.','Виберіть тип повідомлення.'],
    'POMINĄŁEŚ PRZYSTANEK':['YOU MISSED A STOP','ВИ ПРОПУСТИЛИ ЗУПИНКУ'],
    'POKAŻ ODCINEK DO PRZYSTANKU':['SHOW SECTION TO STOP','ПОКАЗАТИ ДІЛЯНКУ ДО ЗУПИНКИ'],
    'WRÓĆ DO POPRZEDNIEGO PRZYSTANKU':['RETURN TO PREVIOUS STOP','ПОВЕРНУТИСЯ ДО ПОПЕРЕДНЬОЇ ЗУПИНКИ'],
    'MOŻLIWE POMINIĘCIE PRZYSTANKU':['POSSIBLE MISSED STOP','МОЖЛИВО ПРОПУЩЕНО ЗУПИНКУ'],
    'NIE — JADĘ DO PRZYSTANKU':['NO — I AM DRIVING TO THE STOP','НІ — Я ЇДУ ДО ЗУПИНКИ'],
    'POMIŃ NASTĘPNY':['SKIP NEXT','ПРОПУСТИТИ НАСТУПНУ'],
    'POMIŃ WSZYSTKIE':['SKIP ALL','ПРОПУСТИТИ ВСІ'],
    'POMIŃ PRZYSTANEK':['SKIP STOP','ПРОПУСТИТИ ЗУПИНКУ'],
    'TRASY 2.0 ZAKOŃCZONE':['TRASY 2.0 FINISHED','TRASY 2.0 ЗАВЕРШЕНО'],
    'Dojechałeś do ostatniego punktu. Wybierz dalszą czynność.':['You have reached the last point. Choose what to do next.','Ви прибули до останнього пункту. Виберіть подальшу дію.'],
    'USTAW TRASĘ POWROTNĄ':['SET RETURN ROUTE','ВСТАНОВИТИ ЗВОРОТНИЙ МАРШРУТ'],
    'POWRÓT NA PUSTO':['EMPTY RETURN RUN','ПОВЕРНЕННЯ БЕЗ ПАСАЖИРІВ'],
    'ZAMKNIJ APLIKACJĘ':['CLOSE APP','ЗАКРИТИ ЗАСТОСУНОК'],
    'System nie pozwolił stronie samodzielnie zamknąć okna. Możesz teraz zamknąć aplikację przyciskiem systemowym.':['The system did not allow the page to close its window. You can now close the app using the system button.','Система не дозволила сторінці закрити вікно. Тепер застосунок можна закрити системною кнопкою.'],
    ' • ruch bez opóźnień':[' • traffic flowing normally',' • рух без затримок']
  };

  const languageFromStorage=()=>{
    try{const value=localStorage.getItem(STORAGE_KEY);return SUPPORTED.includes(value)?value:'pl'}catch{return'pl'}
  };
  let language=languageFromStorage();
  const template=(value,vars={})=>String(value??'').replace(/\{(\w+)\}/g,(_,key)=>String(vars[key]??''));
  const t=(key,vars)=>template(MESSAGES[language]?.[key]??MESSAGES.pl[key]??key,vars);

  function translatePattern(text){
    if(language==='pl')return text;
    const en=language==='en';
    let match;
    if((match=text.match(/^(\d+) min za wcześnie$/)))return en?`${match[1]} min early`:`${match[1]} хв раніше`;
    if((match=text.match(/^(\d+) min opóźnienia$/)))return en?`${match[1]} min late`:`${match[1]} хв запізнення`;
    if((match=text.match(/^Dojazd (.+)$/)))return en?`Arrival ${match[1]}`:`Прибуття ${match[1]}`;
    if((match=text.match(/^Plan: (.+)$/)))return en?`Scheduled: ${match[1]}`:`За розкладом: ${match[1]}`;
    if((match=text.match(/^Planowany odjazd: (.+)$/)))return en?`Scheduled departure: ${match[1]}`:`Відправлення за розкладом: ${match[1]}`;
    if((match=text.match(/^Planowany start: (.+)$/)))return en?`Scheduled start: ${match[1]}`:`Початок за розкладом: ${match[1]}`;
    if((match=text.match(/^START (.+)$/)))return en?`START ${match[1]}`:`ПОЧАТОК ${match[1]}`;
    if((match=text.match(/^Start (.+)$/)))return en?`Start ${match[1]}`:`Початок ${match[1]}`;
    if((match=text.match(/^POMIŃ NASTĘPNY: (.+)$/)))return en?`SKIP NEXT: ${match[1]}`:`ПРОПУСТИТИ НАСТУПНУ: ${match[1]}`;
    if((match=text.match(/^POMIŃ WSZYSTKIE \((\d+)\)$/)))return en?`SKIP ALL (${match[1]})`:`ПРОПУСТИТИ ВСІ (${match[1]})`;
    if((match=text.match(/^Otwórz (.+) na mapie$/)))return en?`Open ${match[1]} on the map`:`Відкрити ${match[1]} на карті`;
    if((match=text.match(/^Uruchom nawigację od przystanku (.+)$/)))return en?`Start navigation from stop ${match[1]}`:`Почати навігацію від зупинки ${match[1]}`;
    if((match=text.match(/^Nawiguj do parkingu (.+)$/)))return en?`Navigate to parking ${match[1]}`:`Навігація до парковки ${match[1]}`;
    if((match=text.match(/^Uruchom nawigację do parkingu (.+)$/)))return en?`Start navigation to parking ${match[1]}`:`Почати навігацію до парковки ${match[1]}`;
    if((match=text.match(/^Zapisano archiwum (.+) zawierające (\d+) zgłoszeń. Zachowaj plik w folderze Pobrane.$/)))return en?`Archive ${match[1]} with ${match[2]} reports was saved. Keep the file in your Downloads folder.`:`Архів ${match[1]} із ${match[2]} повідомленнями збережено. Залиште файл у папці «Завантаження».`;
    if((match=text.match(/^Ograniczenie prędkości (\d+) kilometrów na godzinę$/)))return en?`Speed limit ${match[1]} kilometres per hour`:`Обмеження швидкості ${match[1]} кілометрів на годину`;
    if((match=text.match(/^Trasa (.+) • (\d+) min • ruch bez opóźnień$/)))return en?`Route ${match[1]} • ${match[2]} min • traffic flowing normally`:`Маршрут ${match[1]} • ${match[2]} хв • рух без затримок`;
    if((match=text.match(/^Trasa (.+) • (\d+) min • ruch \+(\d+) min$/)))return en?`Route ${match[1]} • ${match[2]} min • traffic +${match[3]} min`:`Маршрут ${match[1]} • ${match[2]} хв • затримка руху +${match[3]} хв`;
    if((match=text.match(/^Trasa (.+) • (\d+) min$/)))return en?`Route ${match[1]} • ${match[2]} min`:`Маршрут ${match[1]} • ${match[2]} хв`;
    if((match=text.match(/^ • ruch \+(\d+) min$/)))return en?` • traffic +${match[1]} min`:` • затримка руху +${match[1]} хв`;
    if((match=text.match(/^Trasa (.+)$/)))return en?`Route ${match[1]}`:`Маршрут ${match[1]}`;
    if((match=text.match(/^Po wznowieniu nawigacji wygląda na to, że minąłeś przystanek „(.+)”. Czy chcesz go pominąć\?$/)))return en?`After resuming navigation, it looks like you passed “${match[1]}”. Skip this stop?`:`Після відновлення навігації схоже, що ви проїхали зупинку «${match[1]}». Пропустити її?`;
    if((match=text.match(/^Wygląda na to, że omijasz przystanek „(.+)”. Czy chcesz go pominąć\?$/)))return en?`It looks like you are bypassing “${match[1]}”. Skip this stop?`:`Схоже, ви оминаєте зупинку «${match[1]}». Пропустити її?`;
    if((match=text.match(/^Po wznowieniu nawigacji wygląda na to, że minąłeś (\d+) przystanki. Wybierz, co zrobić:$/)))return en?`After resuming navigation, it looks like you passed ${match[1]} stops. Choose what to do:`:`Після відновлення навігації схоже, що ви проїхали ${match[1]} зупинки. Виберіть дію:`;
    if((match=text.match(/^Wygląda na to, że obecny kierunek jazdy omija (\d+) przystanki. Wybierz, co zrobić:$/)))return en?`Your current direction appears to bypass ${match[1]} stops. Choose what to do:`:`Схоже, поточний напрямок руху оминає ${match[1]} зупинки. Виберіть дію:`;
    return text;
  }

  function translateText(value){
    const raw=String(value??'');
    const leading=raw.match(/^\s*/)?.[0]||'',trailing=raw.match(/\s*$/)?.[0]||'';
    const text=raw.slice(leading.length,raw.length-trailing.length||undefined);
    if(!text)return raw;
    const pair=EXACT[text];
    const translated=pair?(language==='en'?pair[0]:language==='uk'?pair[1]:text):translatePattern(text);
    return leading+translated+trailing;
  }

  const textSource=new WeakMap(),textOutput=new WeakMap(),attributeState=new WeakMap();
  const ATTRIBUTES=['aria-label','title','placeholder'];
  let translating=false;
  function translateTextNode(node,external=false){
    const current=node.nodeValue||'';
    if(external&&current!==textOutput.get(node))textSource.set(node,current);
    const source=textSource.has(node)?textSource.get(node):current;
    textSource.set(node,source);
    const output=translateText(source);
    textOutput.set(node,output);
    if(current!==output)node.nodeValue=output;
  }
  function translateAttributes(element,externalAttribute){
    let state=attributeState.get(element);if(!state){state={};attributeState.set(element,state)}
    for(const name of ATTRIBUTES){
      if(!element.hasAttribute?.(name))continue;
      const current=element.getAttribute(name)||'',item=state[name]||{};
      if(!item.source||externalAttribute===name&&current!==item.output)item.source=current;
      item.output=translateText(item.source);state[name]=item;
      if(current!==item.output)element.setAttribute(name,item.output);
    }
  }
  function apply(root=document){
    translating=true;
    try{
      if(root.nodeType===Node.TEXT_NODE)translateTextNode(root);
      else{
        if(root.nodeType===Node.ELEMENT_NODE)translateAttributes(root);
        const walker=document.createTreeWalker(root,NodeFilter.SHOW_ELEMENT|NodeFilter.SHOW_TEXT);
        while(walker.nextNode())walker.currentNode.nodeType===Node.TEXT_NODE?translateTextNode(walker.currentNode):translateAttributes(walker.currentNode);
      }
      document.documentElement.lang=language;
    }finally{translating=false}
  }

  function setLanguage(next){
    if(!SUPPORTED.includes(next))return;
    language=next;
    try{localStorage.setItem(STORAGE_KEY,next)}catch{}
    apply(document);
    document.dispatchEvent(new CustomEvent('trasy:languagechange',{detail:{language:next}}));
  }

  const api={get language(){return language},supported:SUPPORTED.slice(),languageNames:{...LANGUAGE_NAMES},t,translateText,setLanguage,apply,speechLanguage:()=>SPEECH_LANG[language]};
  window.TrasyI18n=api;
  const nativeAlert=window.alert?.bind(window),nativeConfirm=window.confirm?.bind(window);
  if(nativeAlert)window.alert=message=>nativeAlert(translateText(message));
  if(nativeConfirm)window.confirm=message=>nativeConfirm(translateText(message));

  function languageDialog(){
    let dialog=document.getElementById('languageDialog');
    if(dialog)return dialog;
    dialog=document.createElement('dialog');dialog.id='languageDialog';dialog.className='languageDialog';
    dialog.innerHTML='<form method="dialog"><div class="languageDialogHead"><span aria-hidden="true">🌐</span><h2>Wybierz język aplikacji</h2></div><div class="languageChoices"></div><button class="languageCancel" value="cancel" type="submit">ANULUJ</button></form>';
    const choices=dialog.querySelector('.languageChoices');
    for(const code of SUPPORTED){
      const button=document.createElement('button');button.type='button';button.dataset.language=code;button.lang=code;button.textContent=LANGUAGE_NAMES[code];
      button.onclick=()=>{setLanguage(code);dialog.close('selected')};choices.append(button);
    }
    document.body.append(dialog);apply(dialog);return dialog;
  }
  function bindLanguageButton(){
    const button=document.getElementById('languageButton');if(!button||button.dataset.bound)return;
    button.dataset.bound='1';button.onclick=()=>languageDialog().showModal();
  }

  const observer=new MutationObserver(mutations=>{
    if(translating)return;
    translating=true;
    try{
      for(const mutation of mutations){
        if(mutation.type==='characterData')translateTextNode(mutation.target,true);
        else if(mutation.type==='attributes')translateAttributes(mutation.target,mutation.attributeName);
        else for(const node of mutation.addedNodes){
          if(node.nodeType===Node.TEXT_NODE)translateTextNode(node,true);
          else if(node.nodeType===Node.ELEMENT_NODE)apply(node);
        }
      }
    }finally{translating=false}
  });
  observer.observe(document.documentElement,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:ATTRIBUTES});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{apply(document);bindLanguageButton()},{once:true});
  else{apply(document);bindLanguageButton()}
})();
