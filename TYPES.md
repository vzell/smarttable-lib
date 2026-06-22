# Type System

All types are defined as JSDoc `@typedef` in `src/types.js`.
No TypeScript build step is required; IDEs infer types from JSDoc.

---

## ImageMeta

Metadata extracted from a single `<img>` element inside a table cell.

```
ImageMeta {
    src:    string | null   // resolved src attribute, or null if absent
    alt:    string | null   // alt attribute, or null if absent
    title:  string | null   // title attribute, or null if absent
    broken: boolean         // true if the image fired an error event
}
```

`broken` is detected two ways:
- Synchronously: `img.complete && img.naturalWidth === 0`
- Asynchronously: one-time `error` event listener (no polling)

---

## CellMeta

Normalised representation of one table cell's full content.
Produced by `cell-inspector.js · inspectCell(el)`.

```
CellMeta {
    text:         string | null    // visible trimmed text, or null if none
    images:       ImageMeta[]      // all <img> elements in the cell
    nonTextNodes: string[]         // tag names of non-text non-img nodes
                                   // e.g. ["SVG", "CANVAS", "VIDEO"]
    isEmpty:      boolean          // text null AND images empty AND nonTextNodes empty
    rawElement:   HTMLElement      // the original TD/TH element
}
```

`nonTextNodes` includes: `SVG`, `CANVAS`, `VIDEO`, `AUDIO`, `OBJECT`, `EMBED`, `IFRAME`.

---

## ColumnDef

Supplied by the adapter. Drives all column behaviour.

```
ColumnDef {
    key:          string               // unique, matches NormalizedRow keys
    label:        string               // display label in header
    type?:        'string'             // default
                | 'number'
                | 'date'              // used by SortEngine comparators
    collapsible?: boolean              // default false
    peekRows?:    number               // sub-rows visible when collapsed (default 1)
    filterable?:  boolean              // default true
    sortable?:    boolean              // default true
    width?:       string               // CSS value e.g. '120px', '20%'
    minWidth?:    number               // px, default 60 (enforced by ResizeEngine)
    maxWidth?:    number               // px, default none
    derivedFrom?: string               // key of source column to derive value from
    derive?:      (src: string)        // transform fn; receives source cell's first
                    => string          // string value, returns this column's value
}
```

### Derived columns

A column with `derivedFrom` + `derive` is computed automatically by the renderer.
The adapter's `extract()` does not need to include the derived key in `NormalizedRow` —
values are pre-computed once in the `TableRenderer` constructor before any sort,
filter, or collapse engine sees the data.

**Example** — splitting a date string into year / month / day columns:

```js
columnDefs: [
    { key: 'date',  label: 'Date',  type: 'date'   },
    { key: 'year',  label: 'YYYY',  type: 'number',
      derivedFrom: 'date', derive: v => v.slice(0, 4) },
    { key: 'month', label: 'MM',    type: 'number',
      derivedFrom: 'date', derive: v => v.slice(5, 7) },
    { key: 'day',   label: 'DD',    type: 'number',
      derivedFrom: 'date', derive: v => v.slice(8, 10) },
    { key: 'monthName', label: 'Month', type: 'string',
      derivedFrom: 'date',
      derive: v => new Date(v).toLocaleString('en', { month: 'long' }) },
]
```

All derived columns participate in sort, filter, and collapse just like any
other column. If a source column is array-valued (collapsible), `derive`
receives only the first element.

---

## NormalizedRow

```
NormalizedRow = Record<string, string | string[]>
```

Plain `string` → single-row cell.
`string[]` → collapsible multi-row cell (requires `ColumnDef.collapsible: true`).

---

## CollapseState

Tracked per collapsible column by `CollapseEngine`.

```
CollapseState {
    columnCollapsed:  boolean              // master flag, default true
    cellOverrides:    Map<rowIdx, boolean> // per-row overrides
                                           // cleared on column header toggle
    collapsibleCount: number               // cells with > peekRows sub-rows
    totalRows:        number               // total rows in current render
}
```

**Resolution rule** (`isCellCollapsed(colKey, rowIdx)`):
1. If `cellOverrides.has(rowIdx)` → return override value
2. Otherwise → return `columnCollapsed`

**Column header toggle always wins:** calls `cellOverrides.clear()` before
flipping `columnCollapsed`. Any surviving override is always valid.

---

## SortEntry

One entry in the multi-column sort priority stack.

```
SortEntry {
    colKey:    string         // column being sorted
    direction: 'asc' | 'desc'
    priority:  number         // 0 = primary sort, renumbered on every push/remove
}
```

---

## ColumnFilter

Per-column filter descriptor inside `FilterState`.

```
ColumnFilter {
    colKey:       string     // column this filter applies to
    metaEntries:  string[]   // selected meta predicate keys (OR within column)
    valueEntries: string[]   // selected unique text values (OR within column)
    regex:        string     // column-level regex (empty = inactive)
    regexExclude: boolean    // true = exclusion filter
    regexCase:    boolean    // true = case-sensitive
}
```

---

## FilterState

Global filter state passed to `FilterEngine.filter()`.

```
FilterState {
    globalRegex:        string          // global regex (empty = inactive)
    globalRegexExclude: boolean
    globalRegexCase:    boolean
    columnFilters:      ColumnFilter[]  // one per column
}
```

---

## TableOptions

Passed as `options` to `SmartTable.render()`.

```
TableOptions {
    tableClass?:        string    // CSS class on <table>, default 'st-table'
    theme?:             string    // reserved: 'light' | 'dark'
    shadingEnabled?:    boolean   // default true
    shadingDurationMs?: number    // default 600
    stickyHeader?:      boolean   // default true
}
```
