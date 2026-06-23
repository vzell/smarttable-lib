# Implementation Status

## Completed files

| File | Status | Notes |
|------|--------|-------|
| `src/types.js` | ✅ Done | All typedefs defined |
| `src/cell-inspector.js` | ✅ Done | `inspectCell()`, `inspectCells()` |
| `src/collapse-engine.js` | ✅ Done | Full CollapseEngine class |
| `src/filter-engine.js` | ✅ Done | META_PREDICATES, FilterEngine, four-stage pipeline; `escapeRegex()`, `buildHighlightPattern()` exported |
| `src/sort-engine.js` | ✅ Done | Multi-column sort, shading snapshot; first-sort shading bug fixed |
| `src/dropdown.js` | ✅ Done | Three-section dropdown, Dropdown class, `emptyColumnFilter()` |
| `src/resize-engine.js` | ✅ Done | ResizeEngine, off-screen ruler, drag state machine |
| `src/table-renderer.js` | ✅ Done | ResizeEngine fully wired; derived column support; `ColumnDef.render` callback; permanent filter row; match highlighting |
| `src/index.js` | ✅ Done | `SmartTable.render()` public API |

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
| `st-filter-row` | tr | Second header row (permanent filter inputs) |
| `st-filter-th` | th | Cell in the filter row |
| `st-filter-input` | input | Per-column text filter input; `data-colkey` attribute used for focus-restore after re-render |
| `st-filter-regex-btn` | button | Plain-text ↔ regex toggle; `data-active="true"` when regex mode is on |
| `st-highlight` | mark | Wraps matching substrings in filtered cell text (yellow background) |

---

## Adapters — ✅ Done

| File | Status | Notes |
|------|--------|-------|
| `adapters/jungleland.js` | ✅ Done | `JunglelandAdapter`; sets `window.JunglelandAdapter` global |
| `adapters/brucespringsteen-it.js` | ✅ Done | `BrucespringsteenitAdapter`; dual-mode via `tipe` query param |
| `adapters/archive-org.js` | ✅ Done | `ArchiveOrgAdapter`; async `extract()` using `advancedsearch.php` JSON API |
| `adapters/brucebase.js` | ✅ Done | `BrucebaseAdapter`; splits `#page-content` on `<HR>` elements |

All adapters expose a `window.XxxAdapter` global (not ES module `export default`)
for Tampermonkey `@require` compatibility.

## Userscripts

| File | Type | Notes |
|------|------|-------|
| `userscripts/jungleland-it.user.js` | Production | `@require` via raw.githubusercontent.com |
| `userscripts/brucespringsteen-it.user.js` | Production | |
| `userscripts/archive-org.user.js` | Production | `@grant GM_xmlhttpRequest` |
| `userscripts/brucebase.user.js` | Production | pathname guard `/^\\/\\d{4}$/` |
| `userscripts/jungleland-it.dev.user.js` | Dev | `@require file:///V:/…` (Windows WSL2 path) |
| `userscripts/brucespringsteen-it.dev.user.js` | Dev | |
| `userscripts/archive-org.dev.user.js` | Dev | |
| `userscripts/brucebase.dev.user.js` | Dev | |

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

## CHANGELOG.json — ✅ Done

`CHANGELOG.json` — array of release objects with `version`, `date`, `summary`,
`added[]`, and `notes[]` fields. Current entry: v1.0.0 (2026-06-23).
