# Trasy 2.0 — architektura po audycie

Celem refaktoru jest usunięcie warstwowych poprawek powstałych podczas testów i pozostawienie jednego właściciela dla każdego stanu aplikacji.

## Zasady

1. GPS: tylko `gps-hub.js` posiada natywny `watchPosition`.
2. Postęp po przystankach: `gps-stop-engine.js` + `gps-stop-tracker.js`.
3. Kierunek TAM/POWRÓT i START powrotu: `return-route.js`; tracker zna jedynie minimalny dozwolony indeks celu.
4. Wyznaczanie trasy: `nav-map.js` + jawny adapter cache OSRM. Nie nadpisujemy `window.fetch`.
5. Mapa bazowa: jeden `map-runtime.js` wybiera PTV, nocny OpenFreeMap i fallback; żadnego Proxy na `maplibregl.Map`.
6. Rysowanie trasy: jeden `route-progress-style.js`; bez podmieniania `map.addSource` i `source.setData`.
7. Kamera: jeden `RouteCameraController`; profil prędkości jest danymi, nie monkey-patchem metod kontrolera.
8. ETA: nawigacja publikuje ETA, `eta-status.js` odpowiada za prezentację harmonogramu.
9. Górna belka: `next-stop-header.js`; logika START powrotu jest częścią tego modułu, nie osobnym fixem.
10. CSS interfejsu nawigacji: `navigation.css`; moduły nie wstrzykują kolejnych arkuszy stylów w runtime.
11. PWA: rejestracja, sprawdzanie i aktywacja aktualizacji mają jednego właściciela w `app.js`.
12. Offline: OpenFreeMap i geometrie OSRM są cache'owane jawnie; service worker rzeczywiście obsługuje żądania OpenFreeMap z CacheStorage.

## Problemy wykryte w audycie 2.0.162

- Initial style mapy był podmieniany przez Proxy `maplibregl.Map`, a następnie ponownie kontrolowany przez `ptv-basemap.js`, `map-day-night.js` i `map-night-ui.js`.
- Te same warstwy trasy były tworzone/odtwarzane przez `nav-map.js`, `route-progress-style.js`, `ptv-basemap.js` i `map-day-night.js`.
- `route-progress-style.js` monkey-patchował `map.addSource` i `source.setData`.
- `navigation-live-engine.js` monkey-patchował `Marker.prototype.setLngLat` oraz metody kontrolera kamery.
- START powrotu był rozdzielony między `return-route.js`, `return-gps-mode.js`, `return-start-navigation.js`, `return-start-header-fix.js`, `return-start-guard.js` i wyjątki w ETA.
- `app-update-check.js` mieszał sprawdzanie aktualizacji z poprawką układu CSS, mimo że `app.js` już obsługiwał service workera.
- CSS był równocześnie w `style.css`, `index.html` oraz wstrzykiwany przez wiele modułów JS.
- `eta-clock-ui.js` i `navigation-guidance-fix.js` były historycznymi pustymi/kompatybilnościowymi plikami.
- Pakiet OpenFreeMap był zapisywany do CacheStorage, ale service worker ignorował żądania cross-origin `tiles.openfreemap.org`, więc sam zapis nie gwarantował działania offline.
- Część testów sprawdzała tekst komentarzy/starych implementacji zamiast zachowania, co utrwalało historyczne obejścia.

## Inwarianty po refaktorze

- PTV jest główną mapą dzienną.
- OpenFreeMap jest mapą nocną i fallbackiem/offline.
- Fallback nie uruchamia się po pojedynczym błędzie PTV.
- Zielona trasa jest pod symbolami i numerami dróg.
- Postęp nie może przeskoczyć na równoległy odcinek używany wiele kilometrów później.
- Pierwszy punkt POWROTU jest START-em, nigdy celem GPS ani ETA `Dojazd`.
- TAM wybiera najbliższy przyszły kurs; POWRÓT korzysta z najbliższego kursu w czasie.
- SpeedMax pochodzi wyłącznie z PTV Map Matching; brak wartości ukrywa znak, prędkościomierz zostaje.
- Dymek manewru jest elementem okna, niezależnym od ruchu mapy.
