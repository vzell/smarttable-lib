# smarttable-lib — Project Overview

## Purpose

A reusable, site-agnostic JavaScript library that renders any structured web
page into a fully interactive HTML table. Designed to be loaded into Tampermonkey
userscripts via `@require` from a versioned jsDelivr/GitHub CDN URL.

Primary use case: multiple Bruce Springsteen fan sites, each with a completely
different DOM structure, all rendered into the same feature-rich table UI via a
thin per-site adapter.

Target sites:
- **jungleland.it** — static HTML bootleg list
- **brucespringsteen.it** — official + unofficial release database (ASP.NET)
- **archive.org** — bootleg search results (year-filtered)
- **brucebase.wikidot.com** — concert / event database

---

## Repository layout

```
smarttable-lib/
├── src/
│   ├── types.js            # JSDoc typedefs (no runtime code)
│   ├── cell-inspector.js   # Inspects raw TD/TH → CellMeta
│   ├── collapse-engine.js  # Multi-row collapse state per column
│   ├── filter-engine.js    # Four-stage filter pipeline
│   ├── sort-engine.js      # Multi-column sort + shading
│   ├── dropdown.js         # Three-section per-column filter dropdown
│   ├── resize-engine.js    # Auto-resize + manual drag resize
│   ├── table-renderer.js   # Main renderer, wires all engines
│   └── index.js            # Public API: SmartTable.render()
├── adapters/
│   ├── jungleland.js           # Adapter for jungleland.it bootleg list
│   ├── brucespringsteen-it.js  # Adapter for brucespringsteen.it releases
│   ├── archive-org.js          # Adapter for archive.org bootleg search
│   └── brucebase.js            # Adapter for brucebase.wikidot.com events
├── dist/
│   └── smarttable.min.js   # Built output (bundled, minified)
├── CHANGELOG.json
└── README.md
```

---

## Three-layer architecture

```
┌─────────────────────────────────────────────────────────────┐
│  LAYER 1 — smarttable-lib  (GitHub repo, versioned tag)     │
│  Loaded via: @require https://cdn.jsdelivr.net/gh/…         │
│                                                             │
│  TableRenderer · SortEngine · FilterEngine                  │
│  CollapseEngine · ResizeEngine · Dropdown · CellInspector   │
└─────────────────────────────────────────────────────────────┘
            ↑ NormalizedRow[] + ColumnDef[]
┌─────────────────────────────────────────────────────────────┐
│  LAYER 2 — Site adapters  (adapters/ subfolder)             │
│                                                             │
│  jungleland · brucespringsteen-it · archive-org · brucebase  │
│                                                             │
│  Each implements: { triggerSelector, columnDefs, extract() }│
└─────────────────────────────────────────────────────────────┘
            ↑ DOM scraping
┌─────────────────────────────────────────────────────────────┐
│  LAYER 3 — Userscripts  (.user.js files, one per site)      │
│                                                             │
│  @require lib URL + adapter URL                             │
│  SmartTable.render({ columns, rows, container })            │
└─────────────────────────────────────────────────────────────┘
            ↑ target site DOM
```

**Key invariant:** the library knows nothing about any specific site.
Each adapter knows nothing about filtering, sorting, or rendering.
The userscript is the only place these two layers meet.

---

## Public API

```js
// ==UserScript==
// @name         Jungleland Bootlegs Smart Table
// @match        https://www.jungleland.it/html/list.htm
// @require      https://cdn.jsdelivr.net/gh/yourname/smarttable-lib@1.2.0/dist/smarttable.min.js
// @require      https://cdn.jsdelivr.net/gh/yourname/smarttable-lib@1.2.0/adapters/jungleland.js
// @grant        GM_addStyle
// ==/UserScript==

SmartTable.render({
    columns:   JunglelandAdapter.columnDefs,
    rows:      JunglelandAdapter.extract(),
    container: document.querySelector(JunglelandAdapter.triggerSelector),
});
```

`SmartTable.render()` returns a `TableRenderer` instance for lifecycle control
(e.g. calling `.destroy()` to remove the table).

---

## Adapter interface contract

Every adapter must export an object with exactly these three members:

```js
export default {
    // CSS selector for where to inject the trigger button
    triggerSelector: '#some-nav-element',

    // Column definitions — see types.js ColumnDef
    columnDefs: [
        { key: 'date',  label: 'Date',  type: 'date'   },
        { key: 'venue', label: 'Venue', type: 'string' },
        { key: 'songs', label: 'Songs', type: 'string',
          collapsible: true, peekRows: 1 },
    ],

    // Scrapes the current page DOM and returns NormalizedRow[]
    // Values may be plain strings or string[] for multi-row cells
    extract() {
        return [...document.querySelectorAll('.show-row')].map(row => ({
            date:  row.querySelector('.date')?.textContent.trim() ?? '',
            venue: row.querySelector('.venue')?.textContent.trim() ?? '',
            songs: [...row.querySelectorAll('.song')].map(s => s.textContent.trim()),
        }));
    }
}
```

`NormalizedRow` is `Record<string, string | string[]>`.
Plain strings = single-row cell. `string[]` = collapsible multi-row cell.

---

## Versioning & @require pinning

Adapters live inside `smarttable-lib` under `adapters/` so they share the same
versioned git tag as the library. This prevents version skew between the
library and any adapter.

jsDelivr URL pattern:
```
https://cdn.jsdelivr.net/gh/{owner}/smarttable-lib@{tag}/dist/smarttable.min.js
https://cdn.jsdelivr.net/gh/{owner}/smarttable-lib@{tag}/adapters/{name}.js
```

Pin to a specific tag (`@1.2.0`) in production userscripts.
Use `@latest` only during development.
