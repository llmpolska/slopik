# Wydajność Slopika na telefonie

Pomiar z 5 listopada 2026. Porównanie referencji `c0e9943` z produkcyjnym buildem gałęzi `perf/android-polish` z PR #1. Późniejsze maskotki reakcyjne i zmiany ekranu wyniku nie są objęte tą serią pomiarów.

W tym teście mediana LCP, czyli czasu pojawienia się największego elementu treści, spadła z 5920 ms do 1656 ms, o 72,0%. Formularz był gotowy wcześniej, a główny wątek renderera wykonywał mniej pracy podczas animacji tła. To wynik emulacji na komputerze, nie pomiar fizycznego Androida.

## Jak mierzono

- 10 przejść w kolejności A1, B1, A2, B2, A3, B3, A4, B4, A5, B5. Każde w nowym kontekście Chromium. A to zamrożony wcześniejszy build, B to build po zmianach.
- Widok 390×844, DPR 2, CPU spowolnione 4 razy, pobieranie 200000 B/s, czyli 1,6 Mb/s, wysyłanie 93750 B/s, opóźnienie 150 ms. Cache HTTP wyłączony i czyszczony przed mierzoną nawigacją.
- Skrypt pomiarowy uruchamia się po wejściu na adres strony. Mierzona jest kolejna nawigacja w tym świeżym kontekście. Nie jest to pomiar pierwszego uruchomienia nowego procesu przeglądarki.
- Każde przejście obejmuje ładowanie do co najmniej 15 sekund, 10 sekund animowanego tła bez działań użytkownika, wpisanie pytania, otwarcie i zamknięcie historii oraz prywatności, a następnie krótki werdykt.
- API ma kontrolowane odpowiedzi testowe. Werdykt czeka 200 ms. Nie mierzono rzeczywistego Turnstile ani czasu odpowiedzi Jev. Nie wysyłano tych pytań do modelu.
- Komputer miał 16 rdzeni. Obciążenie przed serią wynosiło około 2,42, a podczas serii wzrosło przejściowo do około 8,7; na końcu wynosiło około 4,9. Kolejność naprzemienna ogranicza wpływ zmieniającego się obciążenia. W trakcie serii nie uruchamialiśmy dodatkowych buildów ani kodowania mediów.

## Wyniki

Każda komórka zawiera medianę oraz zakres `[minimum; maksimum]` z pięciu przejść. MB oznacza 1000000 bajtów.

| Metryka                                  |                   Przed |                      Po |
| ---------------------------------------- | ----------------------: | ----------------------: |
| LCP w ms                                 |       5920 [5888; 5988] |       1656 [1612; 1716] |
| Gotowy formularz w ms                    |       4980 [4808; 5219] |       2979 [2908; 3208] |
| Transfer zgłoszony przez Chrome w MB     |       5,53 [5,43; 5,68] |       1,52 [1,47; 1,64] |
| CDP TaskDuration w 10 s tła, sekundy     |    2,036 [1,665; 2,606] |    0,541 [0,440; 1,108] |
| Najdłuższa interakcja laboratoryjna w ms |          200 [168; 248] |            80 [72; 152] |
| Klatki rAF dłuższe niż 50 ms w 10 s      |              10 [5; 12] |                0 [0; 1] |
| 95. percentyl odstępu rAF w ms           |       33,4 [33,3; 33,4] |       16,8 [16,8; 16,8] |
| CLS                                      | 0,0009 [0,0009; 0,0009] | 0,0009 [0,0009; 0,0009] |

Wszystkie 10 przejść zakończyło się poprawnie. Każde wywołało dokładnie jeden testowy werdykt. Nie wystąpiły błędy strony, błędne odpowiedzi HTTP ani nieoczekiwane błędy żądań.

TaskDuration to licznik czasu zadań renderera, nie zużycie baterii ani procent CPU całego urządzenia.

Transfer liczony jest do zakończenia tego samego scenariusza, łącznie z zasobami pobranymi przy otwieraniu modali. Nie oznacza rozmiaru całej strony po pełnym pobraniu ani rachunku za transfer.

W końcowej serii zakresy czasu interakcji nie nakładają się, ale to nadal mała próbka jednego scenariusza. Najdłuższa interakcja jest próbką Event Timing z tego scenariusza. Nie jest terenowym INP. rAF opisuje działanie tej przeglądarki. W tym scenariuszu było mniej odstępów dłuższych niż 50 ms; to nie dowodzi stałej płynności na każdym telefonie.

## Pojedyncze przejścia

A oznacza wcześniejszy build, B wersję po zmianach. W tabeli zachowano kolejność wykonania.

| Przejście | LCP, ms | Formularz gotowy, ms | Transfer, MB | TaskDuration w 10 s, s | Najdłuższa interakcja, ms |
| --------- | ------: | -------------------: | -----------: | ---------------------: | ------------------------: |
| A1        |    5980 |                 5123 |        5,677 |                  1,665 |                       208 |
| B1        |    1716 |                 3026 |        1,524 |                  0,884 |                        80 |
| A2        |    5988 |                 4808 |        5,488 |                  2,606 |                       176 |
| B2        |    1644 |                 2965 |        1,474 |                  1,108 |                       152 |
| A3        |    5888 |                 5219 |        5,594 |                  1,925 |                       248 |
| B3        |    1612 |                 2908 |        1,474 |                  0,541 |                        80 |
| A4        |    5920 |                 4980 |        5,526 |                  2,439 |                       168 |
| B4        |    1656 |                 3208 |        1,643 |                  0,440 |                        72 |
| A5        |    5900 |                 4825 |        5,434 |                  2,036 |                       200 |
| B5        |    1704 |                 2979 |        1,640 |                  0,440 |                       104 |

Wszystkie przejścia obejmowały tę samą sekwencję. Wolniejsze i szybsze próby pozostawiono w wynikach; nie wybierano najlepszych przebiegów.

## Co było kosztowne

Osobny profil wcześniejszego buildu wskazał film tła jako końcowy element LCP. Nagłówek był kandydatem przy 608 ms, a film przy 5888 ms. Film miał 4,67 MB i 1280×720 przy 24 fps. Wcześniejsza strona pobierała go od początku, równolegle z zasobami potrzebnymi do formularza.

Po zmianach telefon otrzymuje mniejszy film i poster. Film zaczyna ładować się po pierwszym użytecznym widoku oraz przejściu weryfikacji. Tło zatrzymuje się przy modalach i w niewidocznej karcie. Uproszczono też kosztowne efekty graficzne. Logo zachowało oryginalne rysunki i ręczne ustawienia każdej klatki.

## Media faktycznie działały

- Przed: film obecny i odtwarzany w 5/5 przejść. Liczba zdekodowanych klatek przy odczycie od 331 do 356, odrzuconych od 37 do 46. `currentTime` był dodatni w każdym przejściu. Żądania kierowały do `assets/oracle.mp4`; zakończone pobrania 3/5.
- Po: film obecny i odtwarzany w 5/5 przejść. Liczba zdekodowanych klatek przy odczycie od 283 do 294, odrzuconych od 0 do 0. `currentTime` był dodatni w każdym przejściu. Żądania kierowały do `assets/oracle-mobile.mp4`; zakończone pobrania 5/5.

Liczby klatek filmu nie są bezpośrednim porównaniem szybkości: film wcześniej miał 24 fps, po zmianie ma 12 fps. Celem tej kontroli jest potwierdzenie, że mniejszy transfer nie wynikał z wyłączenia filmu w teście.

## Rozmiary plików

| Zasób                | Przed, B |   Po, B | Mniej |
| -------------------- | -------: | ------: | ----: |
| Logo animowane       |   243182 |  133524 | 45,1% |
| Logo statyczne       |    35148 |   33530 |  4,6% |
| Film na laptopie     |  4665343 | 1850868 | 60,3% |
| Film na telefonie    |  4665343 |  852630 | 81,7% |
| Poster na laptopie   |   440757 |  101722 | 76,9% |
| Poster na telefonie  |   440757 |   43120 | 90,2% |
| Outfit, TTF → WOFF2  |   110884 |   45148 | 59,3% |
| DM Sans, TTF → WOFF2 |   240164 |   89116 | 62,9% |

Logo ma 350×350, 12 oryginalnych klatek i niezmienione 6 fps. Kanał alfa każdej klatki jest identyczny z zatwierdzonym plikiem. Zmieniono kompresję kolorów RGB, bez ponownego rysowania liter i bez zmiany położenia.

Procenty fontów w tabeli dotyczą plików. Stare TTF były już kompresowane przez HTTP. Mediana transferu fontów zgłoszona przez Chrome wyniosła 169691 B przed i 136208 B po zmianie. Zachowano polskie znaki, mapowania glifów, osie fontów zmiennych i licencje OFL.

## Powtórzenie testu

Zbuduj osobno obie porównywane wersje i udostępnij ich produkcyjne eksporty na dwóch adresach lokalnych. Dla każdego pojedynczego przejścia otwórz nowy kontekst i zamknij go po pomiarze:

```sh
npm exec --yes --package=@playwright/cli -- playwright-cli -s=mobile-perf open http://localhost:8787/?runs=1
npm exec --yes --package=@playwright/cli -- playwright-cli -s=mobile-perf run-code --filename=tests/mobile-perf-browser.js
npm exec --yes --package=@playwright/cli -- playwright-cli -s=mobile-perf close
```

Przeplataj adres wersji wcześniejszej i nowej, aż zbierzesz pięć poprawnych przejść na każdą stronę. Skrypt pobiera adres bazowy z otwartej strony. Nie uruchamiaj równolegle kodowania filmów, buildów ani dodatkowych audytów w przeglądarce. Błąd scenariusza należy wyjaśnić i naprawić przed porównaniem, zamiast traktować nieudaną próbę jako szybkie ładowanie.

## Układ i ograniczenia

Kontrola 27 stanów interfejsu objęła laptop oraz widoki 390×844 i 320×568. Nie wykryto przewijania całego dokumentu poza ekran. Krótki werdykt ma teraz wysokość wynikającą z treści, zamiast rozciągania pustej dolnej części. Długie wyniki nadal przewijają się wewnątrz panelu, a przyciski są osiągalne.

Nie podłączono fizycznego telefonu. Emulacja CPU i sieci nie odtwarza układu graficznego Androida, temperatury urządzenia, ograniczeń pamięci ani prawdziwej sieci komórkowej. Wyniki nie potwierdzają stałych 60 fps na każdym telefonie. Narzędzia pomiarowe również dodają niewielki narzut.

Pomiar można powtórzyć za pomocą `tests/mobile-perf-browser.js`, uruchamiając go w świeżym kontekście Playwright na produkcyjnym buildzie. Pliki surowe i kolejność przejść zachowano lokalnie w `.audit/mobile-polish/`.
