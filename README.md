# Trasy 2.0

Trasy 2.0 to statyczna aplikacja PWA dla kierowcy: pokazuje harmonogram kursu, prowadzi po trasie i pilnuje następnego przystanku oraz punktualności.

## Dane i synchronizacja

Dane tras są pobierane przez `route-data-service.js` z backendu Google Apps Script. `routes.js` pozostaje źródłem zapasowym, dzięki czemu podstawowy harmonogram może działać również wtedy, gdy bieżąca synchronizacja nie jest dostępna.

Źródło danych może zawierać zakładkę `PARKINGI` z kolumnami:

- `NAZWA` — nazwa widoczna dla kierowcy,
- `LOKALIZACJA` — współrzędne `szerokość, długość`,
- `TRASA` — opcjonalna nazwa trasy; puste pole lub `*` udostępnia parking wszystkim trasom.

Po potwierdzonym przez GPS dotarciu do końca trasy powrotnej aplikacja tworzy osobny odcinek do Bazy/Parkingu. Jeden dostępny punkt jest wybierany automatycznie. Przy kilku punktach kierowca wybiera cel. Ręczny przełącznik `NA PUSTO` nadal pozwala uruchomić przejazd bez pasażerów w obu kierunkach.

Administrator wprowadza punkty przez `parking-admin.html`. Może wskazać miejsce na mapie, użyć lokalizacji urządzenia oraz przypisać punkt do wszystkich albo do jednej trasy. Backend musi obsługiwać autoryzowaną akcję `upsertParking` zgodnie z plikiem `PARKING_BACKEND_PATCH.gs.txt`. Akcji nie wolno udostępniać przed weryfikacją administratora.

## Nawigacja

- mapa: MapLibre + kafle OpenStreetMap,
- geometria i manewry: OSRM,
- czasy z ruchem: Google Routes przez backend,
- odświeżenie danych o ruchu podczas nawigacji: standardowo co 3 minuty,
- pomiędzy odświeżeniami ETA jest lokalnie korygowane na podstawie postępu GPS po aktualnej trasie,
- limit prędkości jest odczytywany z danych OpenStreetMap, jeśli dla bieżącej drogi istnieje wiarygodne `maxspeed`.
- kamera po uruchomieniu przyjmuje kierunek pierwszego odcinka trasy i szybciej reaguje na wiarygodną zmianę kierunku GPS,
- po ręcznym obróceniu mapy poza kierunek jazdy pojawia się oznaczenie `N` ze strzałką wskazującą północ; znika po powrocie do prowadzenia.

Aplikacja nie zgaduje ograniczenia prędkości, gdy danych nie ma.

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
