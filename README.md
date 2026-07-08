# Spreadsheets on Continuum

A Google-Sheets-style spreadsheet app built as a showcase of
[Continuum](https://github.com/denislibs/continuum) — the classic-FRP UI
framework where **change is data**: the whole app is one stream of actions
folded into state.

**Live demo:** https://denislibs.github.io/spreadsheets-continuum-js/

## What's inside

- Formula engine: `=A1*B2`, `SUM`/`AVG`/`MIN`/`MAX`/`COUNT`/`SUMPRODUCT`,
  ranges, cycle detection, `#DIV/0!`-style error codes — plus **column
  formulas**: `=A#*B#` fills every row that has data, including future ones
- Multi-document home page (localStorage registry) on `@continuum-js/router`
- Undo/redo, persistence and **cross-tab sync** — each is one more fold or
  mirror of the same action stream, the reducer never changes
- Structured tables (Sheets' «Таблицы»): templates, dark header bands that
  **pin while scrolling**, typed columns, status chips with an options
  editor, per-column menus (change type / sort / insert / delete), the «+»
  add-column chip
- Range selection with live SUM/AVG/COUNT, resizable columns and rows,
  cell formatting (bold/italic/colors/borders/number formats/wrap), CSV
  export, hyperlink cells (Ctrl+K)
- ~2 500 cells × 3 pinpoint bindings each, **no re-renders**; the whole app
  is ~21 kB gzip

## Architecture

```
actions ──accum──▶ sheet state (cells + formats + tables + undo history)
           └──────▶ persistence (a mirror of the folded value)
           └──────▶ cross-tab sync (the `storage` event dispatches back)
```

- `src/model/` — pure: formula parser/evaluator, reducer, table ops
- `src/composables/` — `createX`: own live state and subscriptions
- `src/lib/` — pure factories (formatting, keyboard)
- `src/components/` — rendering

## Development

```bash
npm install
npm run dev    # http://localhost:5173
npm test       # 93 tests
npm run build
```
