# Implementation Status

## Completed files

| File | Status | Notes |
|------|--------|-------|
| `src/types.js` | ✅ Done | All typedefs defined |
| `src/cell-inspector.js` | ✅ Done | `inspectCell()`, `inspectCells()` |
| `src/collapse-engine.js` | ✅ Done | Full CollapseEngine class |
| `src/filter-engine.js` | ✅ Done | META_PREDICATES, FilterEngine, four-stage pipeline |
| `src/sort-engine.js` | ✅ Done | Multi-column sort, shading snapshot |
| `src/dropdown.js` | ✅ Done | Three-section dropdown, Dropdown class, `emptyColumnFilter()` |
| `src/resize-engine.js` | ✅ Done | ResizeEngine, off-screen ruler, drag state machine |
| `src/table-renderer.js` | ⚠️ Partial | ResizeEngine integration was in progress — see TODO below |
| `src/index.js` | ✅ Done | `SmartTable.render()` public API |

---

## TODO — table-renderer.js integration of ResizeEngine

The following changes to `src/table-renderer.js` were started but not fully
applied when the session ended. These are the remaining integration tasks:

### 1. Import already applied ✅
```js
import { ResizeEngine } from './resize-engine.js';
```

### 2. Constructor already updated ✅
```js
this._resize = new ResizeEngine(columns);
```

### 3. destroy() already updated ✅
```js
this._resize.detach();
```

### 4. BTN_AUTO_RESIZE constant already added ✅
```js
BTN_AUTO_RESIZE: 'st-btn-auto-resize',
```

### 5. TODO — attach ResizeEngine after table is built in _buildTable()
After the `<table>` element is created and appended to the DOM,
call:
```js
// After table is in the DOM (inside _buildWrapper, after appendChild):
this._resize.attach(this._tableEl);
```

### 6. TODO — add "Auto-size columns" button to _buildGlobalBar()
```js
const autoSizeBtn = document.createElement('button');
autoSizeBtn.className = C.BTN_AUTO_RESIZE;
autoSizeBtn.textContent = 'Auto-size columns';
autoSizeBtn.addEventListener('click', () => {
    const displayRows = this._displayIdxs.map(i => this._rows[i]);
    this._resize.autoResize(this._rows, displayRows);
});
bar.appendChild(autoSizeBtn);
```

### 7. TODO — attach drag handlers to each <th> in _buildTh()
At the end of `_buildTh(col)`, before `return th`:
```js
this._resize.attachDragHandlers(th, col.key);
```

### 8. TODO — re-attach ResizeEngine colgroup after _rerender()
After `_rerender()` replaces the `<thead>`, call `_ensureColgroup()` internally
via a new public method on ResizeEngine, or just re-attach:
```js
// At end of _rerender():
this._resize.attach(this._tableEl);
```
Note: `ResizeEngine.attach()` calls `_ensureColgroup()` which replaces the
existing colgroup — this is safe and idempotent. Stored widths in
`this._widths` are preserved across re-attaches, so column widths survive
filter/sort/collapse re-renders.

---

## CSS stylesheet — ✅ Done

`src/styles.js` — exports `STYLES` string constant and auto-injects a
`<style id="st-styles">` element when loaded via `@require`.

### CSS classes inventory

| Class | Element | Purpose |
|-------|---------|---------|
| `st-wrapper` | div | Outer container for global bar + table |
| `st-global-bar` | div | Bar above table: global filter + auto-size button |
| `st-global-input` | input | Global regex input |
| `st-toggle` | button | Exclude / Case toggles; `data-active="true"` when on |
| `st-btn-trigger` | button | Show/hide table trigger on host page |
| `st-btn-auto-resize` | button | Auto-size columns button |
| `st-table` | table | Main table |
| `st-thead` | thead | Table head (sticky by default) |
| `st-th` | th | Header cell |
| `st-th-label` | span | Column label text (cursor:pointer when sortable) |
| `st-th-sort-badge` | span | Sort priority number |
| `st-th-sort-dir` | span | Sort direction arrow |
| `st-th-collapse` | button | Column collapse toggle badge |
| `st-th-filter-btn` | button | Column filter open button |
| `st-th--sort-active` | th modifier | Applied when column is in sort stack |
| `st-th--filter-active` | th modifier | Applied when column has active filter |
| `st-tbody` | tbody | Table body |
| `st-tr` | tr | Data row |
| `st-td` | td | Data cell |
| `st-td-inner` | div | Inner wrapper for sub-rows + toggle |
| `st-subrow` | div | One sub-row line inside a cell |
| `st-subrow--hidden` | div modifier | Hidden when cell is collapsed |
| `st-cell-toggle` | button | Per-cell collapse/expand toggle |
| `st-shading-changed` | td modifier | Applied on sort value change, auto-removed |
| `st-dropdown` | div | Filter dropdown root |
| `st-dropdown-section` | div | One section within dropdown |
| `st-dropdown-section-head` | div | Section heading label |
| `st-dropdown-quick-input` | input | Quick filter search input |
| `st-dropdown-item` | div | One checkable item (role=checkbox) |
| `st-dropdown-item--checked` | div modifier | Applied when item is checked |
| `st-dropdown-item--meta` | div modifier | Applied to meta entry items |
| `st-dropdown-checkbox` | span | ☐ / ☑ glyph |
| `st-dropdown-item-label` | span | Item text label |
| `st-dropdown-count` | span | Occurrence count in unique values list |
| `st-dropdown-no-results` | div | Shown when quick filter matches nothing |
| `st-dropdown-divider` | hr | Divider between sections |

---

## TODO — adapters

No adapter files exist yet. Each needs to implement the interface contract:

```js
// adapters/jungleland.js
export default {
    triggerSelector: '…',
    columnDefs: [ /* ColumnDef[] */ ],
    extract() { /* return NormalizedRow[] */ }
}
```

Sites to implement:
- [ ] `adapters/jungleland.js` — https://www.jungleland.it/html/list.htm
- [ ] `adapters/brucespringsteen-it.js` — https://www.brucespringsteen.it/DB/records.aspx (official + unofficial, distinguished by `tipe` query param)
- [ ] `adapters/archive-org.js` — https://archive.org/search (bootleg search, year-filtered)
- [ ] `adapters/brucebase.js` — http://brucebase.wikidot.com/YYYY (events by year)

---

## Build pipeline — ✅ Done

`package.json` + esbuild configured. Commands:

| Script | Output | Purpose |
|--------|--------|---------|
| `npm run build` | `dist/smarttable.min.js` (31.5 kB) | Production IIFE, minified, no comments |
| `npm run build:dev` | `dist/smarttable.js` (241 kB) | Unminified with inline source maps |
| `npm run watch` | `dist/smarttable.js` | Rebuilds on save during development |

`src/index.js` imports `styles.js` as a side-effect so styles are bundled
and auto-inject on first load (idempotent).

Release workflow: `.github/workflows/release.yml` — ✅ Done

---

## TODO — CHANGELOG.json

Initial structure:
```json
[
  {
    "version": "1.0.0",
    "date": "TBD",
    "changes": [
      "Initial release",
      "TableRenderer, SortEngine, FilterEngine, CollapseEngine, ResizeEngine, Dropdown"
    ]
  }
]
```
