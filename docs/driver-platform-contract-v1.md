# DriverPlatformBridge v1

Trasy 2.0 nie otrzymują tokenów aktywacyjnych ani sesyjnych. Moduł hostujący aplikację po poprawnej aktywacji tworzy dwa zamrożone obiekty przed załadowaniem `app.js`:

```js
window.KURSY_DRIVER_CONTEXT = Object.freeze({
  companyId: 'company-id',
  driverId: 'driver-id',
  deviceId: 'device-id'
});

window.KURSY_DRIVER_API = Object.freeze({
  driverRoutes: options => Promise.resolve({routes: []}),
  driverVehicles: options => Promise.resolve({data: {POJAZDY: []}}),
  driverParkings: options => Promise.resolve({parkings: []}),
  driverComputeRoute: (coordinates, options) => Promise.resolve({google: {}}),
  driverFeedback: (feedback, options) => Promise.resolve({ok: true}),
  recordPunctuality: (event, options) => Promise.resolve({ok: true})
});
```

`platform-bridge.js` waliduje dostępne możliwości, rozdziela pamięć według `companyId`, `driverId` i `deviceId`, normalizuje błędy sesji oraz udostępnia aplikacji jeden kontrakt `window.__trasyPlatform`.

## Wymagania hosta

- Sesja kierowcy jest utrzymywana po stronie bramy API, najlepiej przez ciasteczko `HttpOnly`, `Secure`, `SameSite=Strict`.
- `companyId`, `driverId` i `deviceId` pochodzą z odpowiedzi uwierzytelnionego backendu, nigdy z parametrów podanych przez kierowcę.
- Każda operacja backendu ponownie sprawdza sesję, urządzenie, blokadę firmy i licencję.
- Odpowiedzi błędów zawierają stabilne pole `code`, np. `DRIVER_SESSION_EXPIRED`, `DRIVER_DEVICE_RELEASED` albo `COMPANY_BLOCKED`.
- Po dezaktywacji host wysyła `document.dispatchEvent(new CustomEvent('kursy:driver-deactivated'))`. Trasy 2.0 usuwają wtedy pamięć przypisaną do tej aktywacji.

## Profile wdrożenia

Host może ustawić przed `deployment-profile.js`:

```js
window.TRASY_DEPLOYMENT_CONFIG = Object.freeze({mode: 'pilot'});
```

Dozwolone tryby to `test`, `pilot` i `production`. Tylko `test` dopuszcza dotychczasowy arkusz testowy, zapasowe trasy oraz tymczasowy adres e-mail. `pilot` i `production` wymagają bezpiecznego API panelu.

## Zgodność z modułem Kursy

Istniejący `Kursy-cloudflare-integration/driver-app/access-gate.js` udostępnia wymagane metody i kontekst. Po osadzeniu aktualnych plików Tras 2.0 należy wczytać `deployment-profile.js` i `platform-bridge.js` przed pozostałymi modułami aplikacji.

