# CLAUDE.md — smarttable-lib project context

This file is read automatically by Claude Code at session start.

---

## What this project is

`smarttable-lib` is a **pure JavaScript library** (no framework, no build-time
dependencies for consumers) that renders structured web pages into an
interactive HTML table via Tampermonkey userscripts.

Primary consumer: userscripts targeting Bruce Springsteen fan sites.
Each site has a completely different DOM. The library is site-agnostic;
adapters bridge the gap.

Target sites:
- `jungleland.it/html/list.htm` — bootleg list (static HTML table)
- `brucespringsteen.it/DB/records.aspx` — official + unofficial releases (ASP.NET grid)
- `archive.org/search` — archive.org bootleg search results (year-filtered)
- `brucebase.wikidot.com` — concert/event database (wiki tables)

Full design documentation is in the `docs/` folder:
- `docs/OVERVIEW.md` — architecture, public API, adapter contract
- `docs/TYPES.md` — all JSDoc typedefs explained
- `docs/FEATURES.md` — detailed feature specifications
- `docs/DIAGRAMS.md` — Mermaid architecture and flow diagrams
- `docs/IMPLEMENTATION_STATUS.md` — what is done, what is TODO
- `docs/SITE_ADAPTERS.md` — site adapter reference

---

## Code conventions (always follow these)

- **Language:** plain ES2020 JavaScript (no TypeScript, no JSX)
- **Types:** JSDoc `@typedef` and `@param`/`@returns` tags throughout — no
  TypeScript syntax ever
- **Indentation:** 4 spaces, never tabs
- **Trailing whitespace:** none
- **Line endings:** LF
- **Module system:** ES modules (`import`/`export`) in `src/`; the built
  `dist/smarttable.min.js` is a single IIFE that sets `window.SmartTable`
- **Naming:** camelCase for functions/variables, PascalCase for classes,
  SCREAMING_SNAKE for module-level constants
- **Private methods:** prefixed with `_` (single underscore)
- **Function documentation:** every exported function and class method must
  have a JSDoc block with `@param`, `@returns`, and a description
- **Changelog:** every file has a `// CHANGELOG` block at the top listing
  version changes; bump the `@version` tag in the `@file` JSDoc on every edit
- **CSS classes:** all prefixed `st-` (smarttable). Full inventory in
  `docs/IMPLEMENTATION_STATUS.md`

---

## File responsibilities (one sentence each)

| File | Responsibility |
|------|---------------|
| `src/types.js` | JSDoc typedefs only — no runtime code |
| `src/cell-inspector.js` | Walk a raw TD/TH element → return CellMeta |
| `src/collapse-engine.js` | Track columnCollapsed + cellOverrides per column |
| `src/filter-engine.js` | Four-stage filter pipeline + dropdown data builders |
| `src/sort-engine.js` | Multi-column sort stack + shading snapshot |
| `src/dropdown.js` | Three-section filter dropdown DOM component |
| `src/resize-engine.js` | Off-screen ruler measurement + drag state machine |
| `src/table-renderer.js` | Wire all engines → build interactive table DOM |
| `src/index.js` | `SmartTable.render()` public API + window export |
| `adapters/jungleland.js` | jungleland.it bootleg list |
| `adapters/brucespringsteen-it.js` | brucespringsteen.it official + unofficial records |
| `adapters/archive-org.js` | archive.org bootleg search (year-filtered) |
| `adapters/brucebase.js` | brucebase.wikidot.com event database |

---

## Key design invariants

1. **The library is site-agnostic.** No site-specific code anywhere in `src/`.
2. **Adapters are rendering-agnostic.** No filter/sort/collapse logic in adapters.
3. **Column widths via `<col>` only.** Never set `style.width` on `<th>` or `<td>`.
4. **`table-layout: fixed` after any resize.** Set by ResizeEngine automatically.
5. **Column header toggle always wins.** `toggleColumn()` clears `cellOverrides`
   before flipping `columnCollapsed`. No exceptions.
6. **Stable row indices.** Sort and filter operate on original indices, not DOM
   positions. `cellOverrides` is keyed on original row index so state survives re-sorts.
7. **CellMeta is cached by FilterEngine.** `filter.setCellMeta(colKey, origIdx, meta)`
   is called from the renderer during `_buildTd()`. Dropdown reads it back via
   `filter.getCellMeta()` and `filter.buildMetaEntries()`.
8. **Auto-resize measures all sub-rows.** Even collapsed cells are measured at
   full height so expanding never causes layout shift.
9. **Off-screen ruler font matches table.** `ruler.style.font = getComputedStyle(table).font`
   must be called before any measurement.
10. **Derived column values are pre-computed once.** `_expandRow()` runs in the
    `TableRenderer` constructor before any engine is initialised. Sort, filter,
    and collapse all see the computed values in `_rows`. Adapters must not
    include derived column keys in `NormalizedRow`; the renderer fills them in.

---

## Remaining work (see IMPLEMENTATION_STATUS.md for detail)

- [ ] Complete `table-renderer.js` ResizeEngine integration (5 small TODO items)
- [ ] Write `src/styles.js` or `src/styles.css` for all `st-` CSS classes
- [ ] Write `adapters/jungleland.js`
- [ ] Write `adapters/brucespringsteen-it.js`
- [ ] Write `adapters/archive-org.js`
- [ ] Write `adapters/brucebase.js`
- [ ] Configure bundler (`esbuild` recommended) → `dist/smarttable.min.js`
- [ ] Write `package.json`
- [ ] Write GitHub Actions release workflow
- [ ] Create `CHANGELOG.json`

---

## What NOT to do

- Do not add any framework dependencies (React, Vue, etc.)
- Do not use Shadow DOM (breaks host page CSS inheritance)
- Do not use `localStorage` or `sessionStorage` (Tampermonkey context)
- Do not set widths on `<th>` or `<td>` — only on `<col>` elements
- Do not use `innerHTML` with user-supplied data (XSS risk)
- Do not add TypeScript syntax — JSDoc only
