# Jednorazowe przeniesienie tras firmy testowej

Plik migracyjny jest przechowywany lokalnie w ignorowanym przez Git katalogu:

`.private-import/tyliszczak-travel-routes.json`

Zawiera cztery dotychczasowe trasy i nie zostanie opublikowany w GitHub ani Cloudflare Pages.

Po wdrożeniu panelu testowego:

1. Zaloguj się do panelu firmy testowej.
2. Otwórz **Moje trasy** → **Wczytaj dane lokalne**.
3. Wskaż powyższy plik i potwierdź import czterech tras.
4. Wybierz **Wyślij do bazy danych**. Dopiero ten krok zapisze trasy w rekordach firmy przypisanej do zalogowanej sesji.
5. W panelu właściciela nadaj tej firmie **tryb bez limitu**.
6. Utwórz nowy link kierowcy i sprawdź, że prowadzi do `https://trasy.tyli.pl/#activate=…`.

Nie importuj tego pliku do firmy utworzonej w celu próby sprzedażowej. Nowe firmy mają pozostać puste.
