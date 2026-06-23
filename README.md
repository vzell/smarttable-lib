# smarttable-lib

A pure JavaScript library for Tampermonkey userscripts. Point it at any
structured web page, give it column definitions, and it renders a fully
interactive HTML table with multi-column sort, layered filtering, collapsible
multi-row cells, and drag-to-resize columns — all without touching the host
page beyond a single injected trigger button.

Zero runtime dependencies. No framework. No Shadow DOM. Loads via a single
`@require` line.

---

## Features

- **Multi-column sort** — click any header to sort; Shift+click to add a
  secondary sort. Priority badges and direction arrows update live.
- **Value-change shading** — cells that moved position after a sort flash
  yellow so you can track what changed.
- **Global filter** — regex input above the table tests all columns at once;
  Exclude and Case toggles available.
- **Per-column filter dropdown** — three sections: meta predicates (isEmpty,
  hasImage, brokenSrc, …), a quick-search input that live-filters the value
  list, and a scrollable checklist of every distinct value with occurrence
  counts. All filters AND across columns, OR within a column.
- **Collapsible multi-row cells** — any column can hold `string[]` values.
  Cells collapse to a configurable peek count; per-cell and per-column
  toggles both available.
- **Column resize** — drag the right edge of any header or click "Auto-size
  columns" to fit all visible content. Widths survive filter/sort/collapse
  re-renders and are applied exclusively via `<colgroup>/<col>`.
- **Derived columns** — declare a column as `derivedFrom` another key and
  provide a `derive(src)` function; the renderer pre-computes values once
  before any engine sees the data.
- **Trigger button** — a Show/Hide button is injected into the host page; the
  table is built lazily on first click and all state is preserved across
  hide/show cycles.

---

## Quick start

### 1. Load via `@require`

```js
// ==UserScript==
// @name         My Smart Table
// @match        https://example.com/data
// @require      https://cdn.jsdelivr.net/gh/{owner}/smarttable-lib@1.0.0/dist/smarttable.min.js
// @require      https://cdn.jsdelivr.net/gh/{owner}/smarttable-lib@1.0.0/adapters/jungleland.js
// @grant        none
// ==/UserScript==

SmartTable.render({
    columns:   JunglelandAdapter.columnDefs,
    rows:      JunglelandAdapter.extract(),
    container: document.querySelector(JunglelandAdapter.triggerSelector),
});
```

`dist/smarttable.min.js` bundles the default stylesheet and injects it
automatically — no separate `GM_addStyle` call is needed.

### 2. Async adapters (archive.org)

The archive.org adapter fetches data from a JSON API instead of scraping the
DOM. Its `extract()` returns a `Promise`:

```js
// ==UserScript==
// @name         Archive.org Bootleg Search
// @match        https://archive.org/search*
// @require      https://cdn.jsdelivr.net/gh/{owner}/smarttable-lib@1.0.0/dist/smarttable.min.js
// @require      https://cdn.jsdelivr.net/gh/{owner}/smarttable-lib@1.0.0/adapters/archive-org.js
// @grant        GM_xmlhttpRequest
// ==/UserScript==

ArchiveOrgAdapter.extract().then(rows => {
    SmartTable.render({
        columns:   ArchiveOrgAdapter.columnDefs,
        rows,
        container: document.querySelector(ArchiveOrgAdapter.triggerSelector),
    });
});
```

---

## Bundled adapters

| Adapter global | File | Target site |
|---|---|---|
| `JunglelandAdapter` | `adapters/jungleland.js` | jungleland.it — static HTML bootleg list |
| `BrucespringsteenitAdapter` | `adapters/brucespringsteen-it.js` | brucespringsteen.it — official + unofficial releases |
| `ArchiveOrgAdapter` | `adapters/archive-org.js` | archive.org — bootleg search (async, JSON API) |
| `BrucebaseAdapter` | `adapters/brucebase.js` | brucebase.wikidot.com — concert event database |

Each adapter is a separate file so you only `@require` what you use.

---

## Writing a custom adapter

An adapter is a plain object with three members:

```js
const MyAdapter = {
    // CSS selector for the element that receives the trigger button
    triggerSelector: '#content',

    // Column definitions
    columnDefs: [
        { key: 'date',  label: 'Date',  type: 'date'   },
        { key: 'venue', label: 'Venue', type: 'string' },
        { key: 'songs', label: 'Songs', type: 'string',
          collapsible: true, peekRows: 2 },
    ],

    // Scrape the page, return NormalizedRow[]
    extract() {
        return [...document.querySelectorAll('.show-row')].map(row => ({
            date:  row.querySelector('.date')?.textContent.trim() ?? '',
            venue: row.querySelector('.venue')?.textContent.trim() ?? '',
            songs: [...row.querySelectorAll('.song')].map(s => s.textContent.trim()),
        }));
    }
};

// Required: expose as a window global so @require loading works
if (typeof window !== 'undefined') window.MyAdapter = MyAdapter;
```

`NormalizedRow` values are `string` (single cell) or `string[]` (multi-row
cell, requires `collapsible: true` on the column).

---

## ColumnDef reference

| Field | Type | Default | Description |
|---|---|---|---|
| `key` | `string` | required | Unique key; must match `NormalizedRow` property names |
| `label` | `string` | required | Header text |
| `type` | `'string' \| 'number' \| 'date'` | `'string'` | Controls sort comparator |
| `collapsible` | `boolean` | `false` | Allow multi-row `string[]` values |
| `peekRows` | `number` | `1` | Sub-rows visible when collapsed |
| `filterable` | `boolean` | `true` | Show filter button in header |
| `sortable` | `boolean` | `true` | Make header label clickable for sort |
| `width` | `string` | — | Initial column width in px, e.g. `'120px'` |
| `minWidth` | `number` | `60` | Minimum px width enforced during resize |
| `maxWidth` | `number` | — | Maximum px width enforced during resize |
| `derivedFrom` | `string` | — | Key of the source column to derive this column's value from |
| `derive` | `(src: string) => string` | — | Transform applied to the source column's first string value |
| `render` | `(value: string, row: NormalizedRow) => Node \| string` | — | Custom sub-row renderer. Return a DOM Node to append or a string for textContent. Sort and filter always use the raw data value regardless. |

### Derived columns

```js
columnDefs: [
    { key: 'date',  label: 'Date',  type: 'date' },
    { key: 'year',  label: 'YYYY',  type: 'number',
      derivedFrom: 'date', derive: v => v.slice(0, 4) },
    { key: 'month', label: 'MM',    type: 'number',
      derivedFrom: 'date', derive: v => v.slice(5, 7) },
    { key: 'day',   label: 'DD',    type: 'number',
      derivedFrom: 'date', derive: v => v.slice(8, 10) },
]
```

The adapter's `extract()` only needs to return `{ date }`. The renderer fills
in `year`, `month`, and `day` before sort, filter, or collapse sees the data.

---

## TableOptions

```js
SmartTable.render({
    columns, rows, container,
    options: {
        tableClass:        'st-table',  // CSS class on <table>
        shadingEnabled:    true,         // flash cells that changed sort position
        shadingDurationMs: 600,          // ms; also controls the CSS transition
        stickyHeader:      true,         // position:sticky on thead
    }
});
```

---

## API

### `SmartTable.render(params) → TableRenderer`

| Parameter | Type | Description |
|---|---|---|
| `columns` | `ColumnDef[]` | Column definitions from the adapter |
| `rows` | `NormalizedRow[]` | Extracted row data from the adapter |
| `container` | `HTMLElement` | Element that receives the trigger button |
| `options` | `TableOptions` | Optional; see above |

### `TableRenderer`

The object returned by `SmartTable.render()`.

| Method | Description |
|---|---|
| `destroy()` | Removes the table wrapper and cleans up event listeners. The trigger button remains so the user can re-render. |

---

## Development

```sh
npm install          # install esbuild (only dev dependency)
npm run build        # → dist/smarttable.min.js (minified IIFE, ~32 kB)
npm run build:dev    # → dist/smarttable.js (unminified, inline source maps)
npm run watch        # rebuild dist/smarttable.js on every file save
```

---

## Releasing a new version

```sh
# 1. Make changes, bump version in package.json
# 2. Rebuild and commit the updated dist
npm run build
git add package.json dist/smarttable.min.js
git commit -m "Release v1.1.0"

# 3. Tag — the GitHub Actions workflow fires automatically
git tag v1.1.0
git push origin main --tags
```

The workflow (`.github/workflows/release.yml`) verifies that `dist/smarttable.min.js`
matches the source at the tag, then creates a GitHub Release and attaches the
built file as a downloadable asset.

jsDelivr CDN URL pattern (available within minutes of the release):

```
https://cdn.jsdelivr.net/gh/{owner}/smarttable-lib@{tag}/dist/smarttable.min.js
https://cdn.jsdelivr.net/gh/{owner}/smarttable-lib@{tag}/adapters/{name}.js
```

---

## License

MIT
