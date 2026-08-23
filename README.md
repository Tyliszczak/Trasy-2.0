# Trasy 2.0

Statyczna aplikacja PWA do prezentowania rozkładów tras pracowniczych. Dane w `routes.js` pochodzą z `BAZA_TRAS.xlsx`.

## Parkingi dla trybu POWRÓT + NA PUSTO

Źródło danych Google może zawierać zakładkę `PARKINGI` z kolumnami:

- `NAZWA` — nazwa widoczna dla kierowcy,
- `LOKALIZACJA` — współrzędne `szerokość, długość`,
- `TRASA` — opcjonalna nazwa trasy; puste pole lub `*` udostępnia parking wszystkim trasom.

Jeden dostępny parking jest wybierany automatycznie. Przy kilku parkingach kierowca wybiera cel przed uruchomieniem powrotu na pusto.

## Uruchomienie lokalne

Otwórz katalog przez dowolny serwer HTTP, a następnie wejdź na `index.html`. Test danych uruchomisz poleceniem `npm test` (nie wymaga dodatkowych pakietów).

## Aktualizacja tras

Na ten moment dane są zapisane lokalnie, aby aplikacja działała również offline. Kolejny etap to podłączenie importu z arkusza lub Google Apps Script po uzyskaniu dostępu do skryptu.
