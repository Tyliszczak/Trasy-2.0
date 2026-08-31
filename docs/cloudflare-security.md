# Ochrona wdrożenia Cloudflare

Kod aplikacji wymusza nagłówki bezpieczeństwa dla plików statycznych i odpowiedzi Functions. Klucz `PTV_API_KEY` pozostaje sekretem projektu Pages.

W panelu Cloudflare należy dodatkowo ustawić:

1. `TRASY_ALLOWED_HOSTS` na listę hostów danego wdrożenia, np. `trasy.tyli.pl,trasy-2-0.pages.dev`.
2. Regułę ograniczenia szybkości dla `/ptv-map/*` i `/osm-vmax/*`, osobno dla każdego adresu IP. Limity należy dobrać po tygodniu obserwacji rzeczywistego ruchu, aby nie blokować aktywnej nawigacji.
3. Regułę WAF blokującą metody inne niż `GET` dla `/ptv-map/*` i `/osm-vmax/*`; endpoint `/api` dopuszcza wyłącznie `POST` z tej samej domeny.
4. Cloudflare Access dla roboczych ekranów administracyjnych i podglądów, jeżeli pozostaną dostępne pod osobną domeną.
5. Alert wykorzystania funkcji i PTV, aby wykryć nietypowy wzrost zapytań.

## Zmienne i sekrety projektu Pages

W projekcie `trasy-2-0` dla środowiska Production ustaw:

- `APP_ORIGIN=https://trasy.tyli.pl`
- `UPSTREAM_API_URL` — adres aktywnego wdrożenia Web App centralnego Apps Script,
- `GATEWAY_SHARED_SECRET` — sekret o długości co najmniej 32 bajtów, identyczny jak właściwość skryptu o tej nazwie,
- `PTV_API_KEY` tylko wtedy, gdy mapa PTV pozostaje włączona.

`GATEWAY_SHARED_SECRET` i `PTV_API_KEY` muszą mieć typ Secret. Po zmianie zmiennych trzeba utworzyć nowe wdrożenie Pages. Podglądy `pages.dev` nie uzyskują dostępu do sesji produkcyjnej, ponieważ `/api` sprawdza dokładny `APP_ORIGIN`.

Endpoint `/api` udostępnia tylko operacje kierowcy. Nie pozwala na zapis tras, zarządzanie firmą ani działania właściciela. Tokeny sesji są przechowywane w ciasteczkach `Secure`, `HttpOnly`, `SameSite=Strict` i nie wracają do kodu JavaScript.
