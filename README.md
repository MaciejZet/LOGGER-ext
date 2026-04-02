# Log Filter

**English:** VS Code extension that filters `.log` files by level — **DEBUG**, **INFO**, **WARNING**, **ERROR** — from a small side panel. Opens a **preview tab** with only the lines that match the chosen level (or all lines for **ALL**).

**Polski:** Rozszerzenie do VS Code, które pozwala przeglądać pliki `.log` według poziomu logowania. W panelu bocznym wybierasz poziom; otwiera się **nowa karta** z przefiltrowaną treścią (wyszukiwanie i kopiowanie działają jak w zwykłym edytorze).

## Wymagania

- Visual Studio Code **1.85** lub nowszy (Cursor / VSCodium z kompatybilnym API).

## Instalacja

- Z **Marketplace:** wyszukaj „Log Filter” (wydawca: `maciejzmitrukiewicz`) i zainstaluj.
- Z pliku **`.vsix`:** `Ctrl+Shift+P` → **Extensions: Install from VSIX…** → wybierz plik wygenerowany przez `npx @vscode/vsce package` (np. `mz-log-filter-0.1.1.vsix`).

## Użycie

1. Otwórz plik z rozszerzeniem **`.log`** (język `log` jest przypisany automatycznie).
2. Na **pasku aktywności** wybierz ikonę **Log Filter**.
3. W widoku **Level filter** kliknij np. **WARNING** — otworzy się podgląd tylko z liniami zawierającymi słowo `WARNING` (wzorzec rozpoznaje też `[INFO]`, `level=DEBUG` itp.).
4. **ALL** pokazuje cały plik w podglądzie.
5. Opcjonalnie: na pasku tytułu edytora (przy otwartym `.log`) użyj akcji **Log Filter: Open filtered view** — używa ostatnio wybranego poziomu z panelu.

Po **zapisie** lub edycji pliku `.log` podgląd jest odświeżany (edycja z krótkim opóźnieniem).

## Rozwój (dla autorów)

```bash
npm install
npm run compile
```

Uruchomienie w **Extension Development Host:** `F5` w tym repozytorium (konfiguracja w `.vscode/launch.json`).

Paczka do Marketplace:

```bash
npm run compile
npx @vscode/vsce package
```

## Licencja

MIT — zobacz plik [LICENSE](LICENSE).
