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

#### Layout and global bar

| Class | Element | Purpose |
|-------|---------|---------|
| `st-wrapper` | div | Outer container for global bar + table |
| `st-global-bar` | div | Bar above table: global filter + action buttons |
| `st-global-input` | input | Global filter text input |
| `st-filter-checkbox` | label | `Cc` / `Rx` / `Ex` checkbox label in global or filter-row bar |
| `st-btn-trigger` | button | Show/hide table trigger on host page |
| `st-btn-auto-resize` | button | Auto-size columns button |
| `st-btn-expand-all` | button | Expand/Collapse ALL multi-row cells toggle |
| `st-btn-toggle-hl` | button | Toggle ALL highlighting on/off |
| `st-btn-clear-col-filters` | button | Clear ALL column filters |
| `st-btn-clear-all-filters` | button | Clear ALL filters (column + global) |
| `st-clear-btn` | button | `✕` clear button inset inside a filter input |

#### Table structure

| Class | Element | Purpose |
|-------|---------|---------|
| `st-table` | table | Main table |
| `st-thead` | thead | Table head (sticky by default) |
| `st-th` | th | Header cell |
| `st-th-inner` | div | Three-zone flex container inside `<th>` (left/centre/right) |
| `st-th-left` | div | Left zone: column label + sort icons |
| `st-th-centre` | div | Centre zone: column-level collapse toggle (collapsible cols only) |
| `st-th-right` | div | Right zone: unique-values badge |
| `st-th-label` | span | Column label text |
| `st-sort-icon` | button | One of the three sort-icon buttons (⇅ / ▲ / ▼) |
| `st-sort-icon-active` | button modifier | Applied to the active sort direction button (green + yellow bg) |
| `st-th-collapse` | button | Column-level collapse toggle in centre zone |
| `st-uniq-badge` | button | `{count}📊` unique-values badge in right zone |
| `st-th--sort-active` | th modifier | Applied when column is in sort stack |
| `st-th--filter-active` | th modifier | Applied when column has active filter |
| `st-mscol-hdr-0` … `st-mscol-hdr-7` | th modifier | Solid 60 % hue tint by sort priority (amber→vanilla) |
| `st-tbody` | tbody | Table body |
| `st-tr` | tr | Data row |
| `st-td` | td | Data cell |
| `st-td-inner` | div | Inner flex wrapper for sub-rows + cell toggle |
| `st-subrow` | div | One sub-row line inside a cell |
| `st-subrow--hidden` | div modifier | Hidden when cell is collapsed |
| `st-cell-toggle-row` | div | Flex row containing the per-cell toggle, pushed right via `margin-left:auto` |
| `st-cell-toggle` | button | Per-cell collapse/expand toggle (`▶/N/▤` or `◀/N/▤`) |

#### Shading (per sorted column, per priority)

| Class | Applied to | Purpose |
|-------|-----------|---------|
| `st-mscol-0a` / `st-mscol-0b` | td | Amber tint, light / dark (priority 0) |
| `st-mscol-1a` / `st-mscol-1b` | td | Sky-blue tint (priority 1) |
| `st-mscol-2a` / `st-mscol-2b` | td | Mint tint (priority 2) |
| `st-mscol-3a` / `st-mscol-3b` | td | Mauve tint (priority 3) |
| `st-mscol-4a` / `st-mscol-4b` | td | Peach tint (priority 4) |
| `st-mscol-5a` / `st-mscol-5b` | td | Teal tint (priority 5) |
| `st-mscol-6a` / `st-mscol-6b` | td | Lavender tint (priority 6) |
| `st-mscol-7a` / `st-mscol-7b` | td | Vanilla tint (priority 7) |

_Note: `st-shade-a` / `st-shade-b` (TR-level, primary-only shading) are **removed** in v1.2.0 and replaced by the per-column TD tinting above._

#### Filter row and dropdown

| Class | Element | Purpose |
|-------|---------|---------|
| `st-filter-row` | tr | Second header row (permanent filter inputs) |
| `st-filter-th` | th | Cell in the filter row |
| `st-filter-input` | input | Per-column text filter input; `data-colkey` for focus-restore |
| `st-highlight` | mark | Global filter match (yellow `#FFD700` background) |
| `st-col-highlight` | mark | Column filter match (light blue `#add8e6` background) |
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
