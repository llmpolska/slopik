# Wdrożenie na Cloudflare

1. Zaloguj CLI: `npx wrangler login`.
2. Utwórz widget Turnstile w trybie Managed dla swojej domeny.
3. W `wrangler.jsonc` ustaw domenę w `routes`, publiczny `TURNSTILE_SITE_KEY` oraz `ALLOWED_HOSTNAME` bez protokołu i ścieżki. Przy wielu kontach wybierz właściwe przez zmienną `CLOUDFLARE_ACCOUNT_ID`.
4. Dodaj sekrety. CLI poprosi o każdą wartość, więc nie wpisuj kluczy w treść poleceń.

```sh
npx wrangler secret put JEV_API_KEY
npx wrangler secret put TURNSTILE_SECRET_KEY
npx wrangler secret put SESSION_SECRET
```

`SESSION_SECRET` powinien być osobnym losowym ciągiem co najmniej 32 znaków. Nie używaj klucza Jev jako sekretu sesji. Sekrety można też dodać w panelu Workera jako typ **Secret**.

5. Zbuduj i wdróż aplikację:

```sh
npm run deploy
```

Next tworzy statyczną stronę w `out/`. Ten sam Worker serwuje pliki i API. Build dodaje hashe skryptów Next do polityki CSP, bez dopuszczania dowolnych skryptów inline.

6. Sprawdź w przeglądarce weryfikację, zwykłe pytanie, pomysł oraz obraz. Sprawdź też zapis i usunięcie historii oraz działanie po odświeżeniu.

W produkcji nie używaj testowych kluczy Turnstile. Nie dodawaj sekretów do publicznych zmiennych Next ani plików w Git. Publiczny klucz widgetu Turnstile jest przeznaczony dla przeglądarki i może znajdować się w konfiguracji.

Po obróceniu `SESSION_SECRET` dotychczasowe sesje przestaną działać i użytkownicy ponownie przejdą weryfikację. Nie trzeba przechowywać ich w bazie.

Źródła: [sekrety Workers](https://developers.cloudflare.com/workers/configuration/secrets/), [Turnstile Siteverify](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/), [domeny Workers](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/).
