# Trasy 2.0

Trasy 2.0 to statyczna aplikacja PWA dla kierowcy: pokazuje harmonogram kursu, prowadzi po trasie i pilnuje następnego przystanku oraz punktualności.

## Dane i synchronizacja

Dane tras są pobierane przez `route-data-service.js` z uwierzytelnionego kontraktu `KURSY_DRIVER_API`, który przekazuje panel kierowcy po sprawdzeniu sesji, urządzenia i licencji. Główna aplikacja nie wywołuje już starego publicznego adresu Apps Script, który zwracał 403. `routes.js` pozostaje źródłem testowym i zapasowym, dlatego wersja internetowa od razu pozwala sprawdzić harmonogram oraz nawigację także przed podłączeniem panelu kierowcy.

Źródło danych może zawierać zakładkę `PARKINGI` z kolumnami:

- `NAZWA` — nazwa widoczna dla kierowcy,
- `LOKALIZACJA` — współrzędne `szerokość, długość`,
- `TRASA` — opcjonalna nazwa trasy; puste pole lub `*` udostępnia parking wszystkim trasom.

Po potwierdzonym przez GPS dotarciu do końca trasy powrotnej aplikacja tworzy osobny odcinek do Bazy/Parkingu. Jeden dostępny punkt jest wybierany automatycznie. Przy kilku punktach kierowca wybiera cel. Ręczny przełącznik `NA PUSTO` nadal pozwala uruchomić przejazd bez pasażerów w obu kierunkach.

Docelowy panel administratora korzysta z operacji `loadParkings` i `saveParkings`, a kierowca z `driverParkings`. Backend zapisuje punkty w osobnej karcie `PARKINGI`, zawsze z identyfikatorem firmy. Lokalny `parking-admin.html` pozostaje ekranem roboczym do czasu osadzenia nowej wersji Tras 2.0 w module administratora.

## Nawigacja

- mapa: MapLibre + kafle OpenStreetMap,
- geometria i manewry: OSRM,
- czasy z ruchem: Google Routes przez backend,
- odświeżenie danych o ruchu podczas nawigacji: standardowo co 3 minuty,
- pomiędzy odświeżeniami ETA jest lokalnie korygowane na podstawie postępu GPS po aktualnej trasie,
- limit prędkości jest odczytywany z danych OpenStreetMap, jeśli dla bieżącej drogi istnieje wiarygodne `maxspeed`.
- dopasowanie drogi uwzględnia kierunek jazdy i ciągłość poprzedniego odcinka, aby ograniczyć pomyłki na skrzyżowaniach i drogach równoległych,
- gdy brakuje profilu pojazdu, aplikacja nadal pokazuje znane ograniczenie ogólne z dopiskiem `BRAK DANYCH POJAZDU`; brak danych drogi jest oznaczany osobno i nie jest zastępowany zgadywaną wartością,
- dla autobusu limit jest dodatkowo ograniczany profilem pojazdu; tryb BUS 100 wymaga jawnego potwierdzenia dopuszczenia oraz braku miejsc stojących,
- kamera po uruchomieniu przyjmuje kierunek pierwszego odcinka trasy i szybciej reaguje na wiarygodną zmianę kierunku GPS,
- po ręcznym obróceniu mapy poza kierunek jazdy pojawia się oznaczenie `N` ze strzałką wskazującą północ; znika po powrocie do prowadzenia.
- podczas prowadzenia aplikacja automatycznie prosi o utrzymanie włączonego ekranu,
- po odblokowaniu telefonu lub powrocie do aplikacji obserwacja GPS jest uruchamiana ponownie, pobierana jest świeża pozycja, a prowadzenie jest dopasowywane do aktualnego miejsca bez ponownego wybierania trasy; jeśli pojazd zjechał z zapisanej trasy, przebieg jest przeliczany.

Aplikacja nie zgaduje ograniczenia prędkości, gdy danych nie ma.

Przeglądarkowa PWA nie może zagwarantować ciągłego GPS i komunikatów głosowych przy wygaszonym ekranie. Pełna nawigacja działająca w tle wymaga wersji Android z usługą lokalizacji działającą na pierwszym planie i stałym powiadomieniem systemowym.

Opcjonalne kolumny profilu w karcie `POJAZDY`: `BUS 100`, `MIEJSCA STOJĄCE`, `OGRANICZNIK KMH` i `LIMIT POJAZDU KMH`. Brak tych kolumn nie zatrzymuje harmonogramu ani nawigacji — uruchamia opisany wyżej tryb bezpieczny.

## PWA i cache

`sw.js` utrzymuje APP_SHELL potrzebny do uruchomienia aplikacji. Nowa wersja service workera nie przełącza się samoczynnie w czasie jazdy — użytkownik dostaje informację o dostępnej aktualizacji i może ją zastosować świadomie.

## Testy

Uruchomienie lokalne:

```bash
npm test
```

Testy obejmują m.in. GPS i potwierdzanie postoju, przejście przez północ, ETA i punktualność, anulowanie starych żądań trasy, e-TOLL, limit prędkości oraz spójność APP_SHELL.

Repozytorium ma również workflow GitHub Actions uruchamiający `npm test` dla zmian i `main`.

## Edytor lokalizacji

`map-editor.html` jest osobnym narzędziem do ustawiania współrzędnych przystanków i zapisu ich do backendu. Nie jest częścią głównego ekranu kierowcy.
