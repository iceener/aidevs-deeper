![AI_devs 3](https://cloud.overment.com/aidevs_3-1720683722.png)

Niniejsze repozytorium to aplikacja, którą wykorzystaliśmy na potrzeby DEMO podczas live AI_devs 3: Reloaded na temat ["Deep Action"](https://www.youtube.com/watch?v=HDHDntk1nis). W porównaniu do prezentacji live kod został zmieniony pod kątem czytelności, ale z zachowaniem oryginalnych funkcjonalności. Zmianie ulega także katalog `knowledge` który podczas prezentacji zawierał faktyczne lekcje szkolenia AI_devs 3.

## Słowem wstępu

Aplikacja stanowi przykład implementacji Deep Search / Deep Research (choć przyglądając się szczegółom, nie spełnia pełnych ich definicji, aczkolwiek te również są interpretowane na różne sposoby). Opracowałem ją w taki sposób, aby rysowała możliwie najlepszy obraz rzeczywistej aplikacji, której elementy mogą zostać wdrożone produkcyjnie, ale raczej w celu zastosowań wewnątrz organizacji. 

Listę zależności ograniczyłem do minimum, choć zdecydowałem się na skorzystanie z Vercel AI SDK, które występuje jedynie w ekosystemie JavaScriptu. Nie stanowi to jednak dużej rozbieżności względem innych technologii, a jedynie zwiększa czytelność kodu pod kątem zastosowania Structured Output oraz (własnej implementacji) Function Calling. 

W roli bazy danych również występuje SQLite, więc konfiguracja jest ograniczona do minimum.

## Przegląd bez instalacji

W głównym katalogu umieściłem kilka plików Markdown, które zostały wygenerowane na moim komputerze. Możesz przejrzeć ich zawartość, aby uniknąć konieczności instalowania i uruchamiania aplikacji.

⚠️ UWAGA: Projekt wykorzystuje modele OpenAI oraz Gemini. W przypadku Gemini jest to bezpłatna wersja modelu 2.5 Pro Experimental, która w przyszłości może zostać wyłączona. Uruchomienie agenta może zatem generować istotne koszty. Upewnij się zatem, że na koncie OpenAI masz ustawione limity wydatków. W przypadku Gemini **w momencie pisania tych słów nie ma takiej opcji**, dlatego korzystamy z modelu bezpłatnego.

## Instalacja

Aby uruchomić projekt na swoim komputerze:

- zainstaluj node.js v22.11.0 ([pobierz](https://nodejs.org/en))
- pobierz to repozytorium
- zmień nazwę pliku .env.example na .env
- dodaj klucz API do usługi OpenAI oraz Gemini. Opcjonalnie: langfuse.com w celu monitorowania aplikacji
- wygeneruj strukturę bazy danych poleceniem `bun db:push`
- uzupełnij bazę danych przykładowymi danymi `bun db:seed`
- zainstaluj zależności z pomocą `bun` (opis instalacji: https://bun.sh/docs/installation)

``` bash
git clone https://github.com/iceener/aidevs-deep-action.git
bun install
bun db:push
bun db:seed
bun dev
```

## Dodatkowy komentarz

- Aplikacja potrafi generować jakościowe treści tylko w sytuacji gdy w źródłach znajdują się wartościowe informacje powiązane z tematem. Dlatego w katalogu `knowledge` pozostawiam pliki z dokumentacją OpenAI oraz Firecrawl. Dodatkowo ze względu na niedeterministyczną naturę modeli językowych, replikacja dokładnie tych samych rezultatów nie jest możliwa. 
- W celu uniknięcia konieczności dodawania klucza Firecrawl, zewnętrzne źródła wiedzy pozostawiam **zakomentowane**, więc odpowiedzi będą generowane wyłącznie na podstawie lokalnych plików.
- Dodanie klucza Langfuse jest opcjonalne, ale rekomendowane (wystarczy bezpłatne konto)

## Uruchomienie

Agent domyślnie zadziała na localhost:3000. Jeśli chcesz zmienić port, zrób to w pliku `.env`. Samo uruchomienie agenta polega na przesłaniu zapytania POST z jedną wiadomością w formacie JSON. 

⚠️ API_SECRET_KEY musi odpowiadać wartości z pliku `.env`. Możesz ustawić ją na dowolny ciąg znaków. 

```
curl --request POST \
  --url http://localhost:3000/api/chat \
  --header 'Content-Type: application/json' \
  --header 'Authorization: Bearer $API_SECRET_KEY'
  --data '{
    "messages": [
      {
        "role": "user",
        "content": "Describe how can I use OpenAI API to ask questions about given URL"
      }
    ]
  }'
```

Czas wykonania zapytania wynosi około 2-4 minut. Odpowiedź jest strumieniowana, ale końcowy rezultat zostaje zapisany w katalogu: ./documents/[data]/[unikatowy identyfikator]/task_result.md

## Dołącz do AI_devs 3: Reloaded

Jeśli chcesz dowiedzieć się więcej na temat projektowania agentów AI, ich możliwości oraz ograniczeń, dołącz do nas na [AI_devs 3: Reloaded](https://aidevs.pl).

Startujemy 12 maja 2025. Do zobaczenia!