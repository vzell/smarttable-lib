# Feature Specifications

---

## 1. Multi-column sort with value shading

**Trigger:** three sort-icon buttons in every sortable column header.

Each sortable column header contains three always-visible clickable buttons in the
left zone of the header flex layout:

| Button | Action |
|--------|--------|
| `⇅` | Remove this column from the sort stack (restore natural order for this column) |
| `▲` | Sort this column ascending |
| `▼` | Sort this column descending |

The active button (the one matching the current sort direction) is visually
highlighted: green text + yellow background (class `st-sort-icon-active`). A Unicode
superscript priority digit is appended to the active button's text to show its
position in the sort stack: `▲¹`, `▼²`, `▲³`, … (up to `⁹`).

**Stack management (`SortEngine`):**
- `pushSort(colKey, direction?)` — if `direction` is `'asc'` or `'desc'`, sets that
  direction directly; if omitted, toggles the current direction (legacy path).
- `removeSort(colKey)` — removes one column from the stack; called by the ⇅ button.
- `clearSort()` — resets to natural row order.
- Priority numbers are renumbered after every push/remove.

**Multi-column comparison:**
- Comparators dispatch by `ColumnDef.type`: `string` (localeCompare),
  `number` (parseFloat, NaN sorts last), `date` (Date.parse, invalid sorts last).
- Primary sort first; ties broken by next sort entry in stack.
- Sort key for multi-row cells: first sub-row string only.
- The sort comparator is compiled into a single closure before `Array.sort()` runs,
  so the stack is not accessed on every row-pair comparison.

**Value-group shading (per sorted column, per priority):**
- When one or more sorts are active, each sorted column's TDs receive a semi-transparent
  tint class based on the column's priority and current value-group.
- 8 hue families are assigned in priority order, each with two shades (a/b):

  | Priority | Hue | a (0.22 α) | b (0.44 α) |
  |----------|-----|------------|------------|
  | 0 | Amber    | `st-mscol-0a` | `st-mscol-0b` |
  | 1 | Sky-blue | `st-mscol-1a` | `st-mscol-1b` |
  | 2 | Mint     | `st-mscol-2a` | `st-mscol-2b` |
  | 3 | Mauve    | `st-mscol-3a` | `st-mscol-3b` |
  | 4 | Peach    | `st-mscol-4a` | `st-mscol-4b` |
  | 5 | Teal     | `st-mscol-5a` | `st-mscol-5b` |
  | 6 | Lavender | `st-mscol-6a` | `st-mscol-6b` |
  | 7 | Vanilla  | `st-mscol-7a` | `st-mscol-7b` |

- Within a priority column, the shade alternates (a→b) each time the cell value
  changes between consecutive displayed rows — visually grouping equal values.
- The corresponding `<th>` header cell receives a solid 60 % tint of the same hue
  (`st-mscol-hdr-0` … `st-mscol-hdr-7`).
- All sorted columns are tinted simultaneously; styles use `!important` so they
  override any base row background.
- Disabled when `TableOptions.shadingEnabled` is `false`.

---

## 2. Global and column-level filtering

### Global filter bar (above the table)

Free-text input, live on every keystroke, plus three checkbox modifiers:

| Checkbox | Label | Meaning |
|----------|-------|---------|
| `Cc` | Case sensitive | Matching is case-sensitive when checked |
| `Rx` | Regex mode | Input is compiled as a `RegExp`; unchecked = literal text |
| `Ex` | Exclude | Matching rows are **hidden** instead of shown |

- A `✕` button is inset at the right edge of the input; clicking it clears the input.
- Pressing `Escape` while the input is focused also clears it.
- Tests all column text values for each row (any column match = row passes).

### Permanent filter row (second header row)

A second `<tr>` in `<thead>` is always visible, immediately below the column
headers. It contains one `<input>` per filterable column (`filterable !== false`),
also with `Cc`, `Rx`, and `Ex` checkbox modifiers.

- Typing updates `ColumnFilter.regex` on every keystroke and re-renders.
- Focus and cursor position are restored after each re-render so typing is seamless.
- `Rx` unchecked (default): column filter value is escaped before compilation
  (`ColumnFilter.isRegex = false`) — characters like `(`, `.`, `*` are treated
  literally.
- `Rx` checked: raw `RegExp` mode (`ColumnFilter.isRegex = true`). Invalid patterns
  are silently ignored (treated as empty).
- `Cc` wires to `ColumnFilter.regexCase`; `Ex` wires to `ColumnFilter.regexExclude`.
- A `✕` button is inset at the right edge of each column filter input.
- Pressing `Escape` while a column filter input is focused clears that input.
- The filter row is sticky together with the header row (both share `<thead>`).

### Per-column filter dropdown (three sections)

Opened by clicking the `{N}📊` badge in the column header (see §5).

#### Section A — Meta entries
Shown only for columns where at least one row matches the predicate.
Selections within section A are OR-combined.

| Key             | Predicate                                          |
|-----------------|----------------------------------------------------|
| `isEmpty`       | `cell.isEmpty === true`                            |
| `hasImage`      | `cell.images.length > 0`                           |
| `brokenSrc`     | `cell.images.some(i => !i.src \|\| i.broken)`      |
| `hasAltOrMeta`  | `cell.images.some(i => i.alt \|\| i.title)`        |
| `hasNonImageNode` | `cell.nonTextNodes.some(t => t !== 'IMG')`       |

#### Section B — Quick filter input
- Live-filters the unique values list (Section C) as the user types.
- Enter: confirms — selects all currently visible (matched) unique values.
- Esc: clears the input, restores full unique-values list.
- Input does not hide Section A; meta entries always remain reachable.

#### Section C — Unique values
- All distinct text values for the column, sorted by frequency desc, then alpha.
- Each entry shows the value and its occurrence count.
- Selections within Section C are OR-combined.

### Filter pipeline order

```
Meta filter → Value filter → Column text/regex → Global regex
```

Each stage receives only rows that passed the previous stage.
Filtering across columns is AND-combined.
Empty column filters (no regex, no meta, no value entries) are skipped without
building a `RegExp` or walking rows.

### Filter match highlighting

When any filter is active (column or global), matching substrings in cell text are
wrapped in `<mark>` elements. **Two distinct colours** distinguish the source:

| Source | Class | Background |
|--------|-------|------------|
| Global filter | `st-highlight` | Yellow (`#FFD700`) |
| Column filter | `st-col-highlight` | Light blue (`#add8e6`) |

- Overlapping match ranges are merged before rendering.
- Cells with a `ColumnDef.render` callback are **not highlighted**.
- Patterns are pre-computed once at the start of each `_buildTbody()` call.

### Toolbar action buttons (global bar)

Four additional buttons sit in the global bar alongside the filter input:

| Button | Class | Action |
|--------|-------|--------|
| **Expand/Collapse ALL** | `st-btn-expand-all` | Expands all collapsible columns if any are collapsed; otherwise collapses all |
| **Toggle ALL highlighting** | `st-btn-toggle-hl` | Shows/hides `<mark>` highlights without re-running the filter |
| **Clear ALL column filters** | `st-btn-clear-col-filters` | Resets every `ColumnFilter` to its empty state |
| **Clear ALL filters** | `st-btn-clear-all-filters` | Also resets the global filter input and its checkboxes |

---

## 3. Collapsible multi-row cells

### Overview
Any column with `ColumnDef.collapsible: true` can hold `string[]` values.
Each element of the array is a sub-row rendered as a separate line inside the cell.
Cells with only one sub-row (or `≤ peekRows` sub-rows) render no toggle — no noise.

### Default state
All collapsible cells start **collapsed** when the table first renders.

### What stays visible when collapsed
The first `ColumnDef.peekRows` sub-rows (default: 1). This is the "peek row".

### Column header layout (three flex zones)

Each `<th>` uses a flex container (`st-th-inner`) with three explicit zones:

```
┌──────────────────────────────────────────────────────┐
│  [Left]               [Centre]              [Right]  │
│  Label ⇅ ▲ ▼          ▶/N/▤              {count}📊  │
└──────────────────────────────────────────────────────┘
```

- **Left:** column label text + three sort-icon buttons (all sortable columns).
- **Centre:** column-level collapse toggle (collapsible columns only).
  Format: `▶/N/▤` when column is collapsed, `◀/N/▤` when expanded.
  N = number of cells in this column that have more sub-rows than `peekRows`.
  Clicking the centre zone: clears all `cellOverrides`, flips `columnCollapsed`.
  **Column toggle always wins** — any per-cell expansions are reset.
- **Right:** `{count}📊` unique-values badge (all filterable columns); see §5.

Visible spacing separates all three zones, ensuring readability even when column
data is narrower than the combined header content.

### Per-cell collapse toggle glyph

Shown right-aligned after the cell content (last child of the `st-td-inner` flex
container, pushed right via `margin-left: auto`).

| State     | Glyph      | Meaning                              |
|-----------|------------|--------------------------------------|
| Collapsed | `▶/N/▤`   | N sub-rows; click to expand this cell |
| Expanded  | `◀/N/▤`   | N sub-rows; click to collapse this cell |

N = total sub-rows in **this specific cell**.

The toggle is not absolute-positioned; it flows as the last element of the inner
div and is right-aligned by the flex layout.

### State resolution (`isCellCollapsed(colKey, rowIdx)`)
```
if cellOverrides.has(rowIdx) → return override
else → return columnCollapsed
```

`cellOverrides` is keyed on the stable original row index (survives re-sorts).

---

## 4. Column resizing

### Auto-resize (global button)
A single "Auto-size columns" button sits in the global bar above the table.
Clicking it measures all visible rows and sets every column to its optimal width.

**Measurement strategy (off-screen ruler):**
1. Create one `<span>` element: `position:absolute; visibility:hidden; white-space:nowrap`.
   Font is copied from the table's computed style so measurements match rendering.
2. For each column:
   a. Measure header label width + `HEADER_CHROME_PX` (~90 px budget for sort icons,
      collapse toggle, and 📊 badge in the three-zone header).
   b. For every **visible** (filtered+sorted, `display !== 'none'`) row, measure each
      sub-row string. Hidden (filtered-out) rows are skipped to avoid inflating widths.
      For multi-row cells, **the longest sub-row wins**.
   c. `optimalWidth = max(header, allSubRows) + CELL_PADDING_PX (24px)`.
   d. Clamp to `[ColumnDef.minWidth ?? 60, ColumnDef.maxWidth ?? ∞]`.
3. Write all widths to `<col>` elements in a `<colgroup>`.
4. Set `table-layout: fixed` on `<table>`.
5. The bodyRows snapshot is hoisted once before the column loop (not re-queried
   per column) to avoid O(columns × rows) DOM walks.

### Manual drag resize
**Draggable zone:** rightmost 6px of the `<th>` element (detected via `e.offsetX`).

**Three-state machine:**

```
IDLE ──[enter handle zone]──→ DRAG_READY ──[mousedown]──→ DRAGGING
 ↑                                │                           │
 └──────[mouseleave handle]────────┘                           │
 ↑                                                             │
 └──────────────────[mouseup / window mouseleave]──────────────┘
```

In `DRAG_READY`:
- Cursor set to `col-resize` on the `<th>`.
- Stores: `colKey`, `startX = e.clientX`, `startWidth = current col width`.

In `DRAGGING`:
- `δx = e.clientX − startX`
- `newWidth = clamp(startWidth + δx, minWidth, maxWidth)`
- Written to `<col>` on every `mousemove`.
- `userSelect: none` on `document.body` prevents text selection during drag.

### Column width application
Widths are applied **exclusively via `<colgroup>/<col>` elements** — never by
setting `style.width` on `<th>` or `<td>` elements directly.

---

## 5. Unique-values badge (📊)

Each filterable column header shows a `{count}📊` badge right-aligned in the header
(the right zone of the three-zone flex layout):

- **count** = number of distinct text values across all rows for this column.
- Clicking the badge opens the per-column filter dropdown (same as the old ⧨/⧩ button).
- The badge text is stripped from header `textContent` before any sort or resize
  name-comparison so the glyph does not pollute column identification.
- The `{count}` is computed lazily (deferred via `setTimeout`) for large tables to
  avoid blocking the UI on initial render.

---

## 6. Table injection trigger button

A "Show table" / "Hide table" toggle button is injected into the
`adapter.triggerSelector` element on the host page.

- First click: builds the full table wrapper (global bar + table DOM).
- Subsequent clicks: toggles `display: none` on the wrapper.
- Table state (sort, filter, collapse, column widths) is preserved across hide/show.
- Calling `renderer.destroy()` removes the wrapper; the trigger button remains.

---

## 7. Performance

The library is optimised for tables with thousands of rows:

**Rendering:**
- `_buildTbody()` builds all `<tr>` elements into a `DocumentFragment` and appends
  the fragment in a single operation, avoiding per-row layout reflows.
- Unique-count badge updates are deferred via `setTimeout(fn, 0)` so the table
  appears immediately even for 8k+ row datasets.

**Filtering:**
- `FilterEngine.filter()` skips columns whose `ColumnFilter` is fully empty (no
  regex, no meta entries, no value entries) without building a `RegExp` or walking rows.
- A `_lastKey`/`_lastResult` cache allows `filter()` to return a cached result when
  the serialised filter state is unchanged between calls.

**Sorting:**
- `SortEngine.sort()` compiles the sort stack into a single comparator closure before
  calling `Array.sort()`, avoiding per-pair stack traversal.

**Auto-resize:**
- `ResizeEngine.autoResize()` hoists the tbody row snapshot once before the column
  loop; hidden rows are skipped during measurement.

**Event handling:**
- Cell-toggle clicks are handled via a single delegated listener on `<tbody>` keyed
  by `data-colkey` and `data-origidx` attributes on the toggle button — not per-button
  `addEventListener` calls. This is critical for tables with 1k+ rows.
