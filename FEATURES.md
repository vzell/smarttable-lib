# Feature Specifications

---

## 1. Multi-column sort with value shading

**Trigger:** click on a column header label.

**Behaviour:**
- First click: column added to sort stack as primary sort, direction `asc`.
- Subsequent clicks on same column: flip direction `asc` ↔ `desc`.
- Clicking a different column: push onto stack as next priority.
- Sort priority badge shows the stack position number (1 = primary).
- Direction arrow shows `▲` for asc, `▼` for desc.

**Stack management (`SortEngine`):**
- `pushSort(colKey)` — adds or flips.
- `removeSort(colKey)` — removes one column from stack.
- `clearSort()` — resets to natural row order.
- Priority numbers are renumbered after every push/remove.

**Multi-column comparison:**
- Comparators dispatch by `ColumnDef.type`: `string` (localeCompare),
  `number` (parseFloat, NaN sorts last), `date` (Date.parse, invalid sorts last).
- Primary sort first; ties broken by next sort entry in stack.
- Sort key for multi-row cells: first sub-row string only.

**Value-group shading:**
- When a sort is active, each `<tr>` receives either `st-shade-a` (white) or
  `st-shade-b` (light blue) based on the primary sort column's value.
- Consecutive rows sharing the same value stay in the same shade group.
- The group alternates whenever the primary sort column's value changes between
  adjacent rows — visually grouping, e.g., all 1966 rows and all 1967 rows.
- Classes are re-computed on every re-render; no timer or animation involved.
- Disabled when `TableOptions.shadingEnabled` is `false`.

---

## 2. Global and column-level filtering

### Global filter bar (above the table)
- Free-text regex input, live on every keystroke.
- "Exclude" toggle: matching rows are hidden instead of shown.
- "Case" toggle: case-sensitive matching.
- Tests all column text values for each row (any column match = row passes).

### Permanent filter row (second header row)
A second `<tr>` in `<thead>` is always visible, immediately below the column
headers. It contains one `<input>` per filterable column (`filterable !== false`).

- Typing updates `ColumnFilter.regex` on every keystroke and re-renders.
- Focus and cursor position are restored after each re-render so typing is seamless.
- Default mode: **plain-text substring** — the input value is escaped before
  being compiled as a `RegExp`, so characters like `(`, `.`, `*` are treated
  literally.
- **`.*` toggle button** per column: switches to full **regex mode**
  (`ColumnFilter.isRegex = true`). The button turns blue when regex mode is on.
- The filter row is sticky together with the header row (both share `<thead>`).

### Per-column filter dropdown (three sections)
Opened by clicking the filter icon `⧨` / `⧩` in the column header.
The icon becomes `⧩` and the header gets class `st-th--filter-active`
when any filter is active on that column.

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
When `ColumnFilter.isRegex` is `false` (default), the column filter text is
escaped with `escapeRegex()` before compilation, enabling safe literal matching.
When `true`, the text is compiled as a raw `RegExp`. Invalid patterns are silently
ignored (treated as empty). The global filter bar is always regex mode.

### Filter match highlighting

When any filter is active (column or global), matching substrings in cell text
are wrapped in `<mark class="st-highlight">` (yellow background).

- Both column-level and global filter patterns contribute highlights.
- Overlapping match ranges are merged before rendering.
- Cells with a `ColumnDef.render` callback are **not highlighted** — the
  custom DOM is rendered as-is.
- Highlight patterns are pre-computed once at the start of each `_buildTbody()`
  call so the overhead per cell is minimal.

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

### Column header toggle
Each collapsible column header shows a badge:

```
▲ 3 / 120
│   │   └─ total rows in current render
│   └───── cells with more sub-rows than peekRows
└───────── arrow: ▲ = currently collapsed, ▼ = currently expanded
```

Clicking the badge:
1. Clears all `cellOverrides` for the column.
2. Flips `columnCollapsed`.
3. **Column toggle always wins** — any per-cell expansions are reset.

### Per-cell toggle glyph
Shown immediately before the peek row content.

| State     | Glyph      | Meaning                              |
|-----------|------------|--------------------------------------|
| Collapsed | `▲ +4`     | 4 sub-rows hidden; click to expand   |
| Expanded  | `▼ -4`     | 4 extra sub-rows visible; click to collapse |

Arrow points in the direction of the action, not the current state.

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
   a. Measure header label width + `HEADER_CHROME_PX` (56px budget for badges/icons).
   b. For every visible (filtered+sorted) row, measure each sub-row string.
      For multi-row cells, **the longest sub-row wins** — auto-size always fits
      the fully expanded content so expanding a cell never causes layout shift.
   c. `optimalWidth = max(header, allSubRows) + CELL_PADDING_PX (24px)`.
   d. Clamp to `[ColumnDef.minWidth ?? 60, ColumnDef.maxWidth ?? ∞]`.
3. Write all widths to `<col>` elements in a `<colgroup>`.
4. Set `table-layout: fixed` on `<table>` (auto-size switches the layout model).

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
- Written to `<col>` on every `mousemove` (no throttle needed; browser paints async).
- `userSelect: none` on `document.body` prevents text selection during drag.

### Column width application
Widths are applied **exclusively via `<colgroup>/<col>` elements** — never by
setting `style.width` on `<th>` or `<td>` elements directly.
`table-layout: fixed` is set on `<table>` after the first resize operation.
This gives exact, browser-consistent column widths.

---

## 5. Table injection trigger button

A "Show table" / "Hide table" toggle button is injected into the
`adapter.triggerSelector` element on the host page.

- First click: builds the full table wrapper (global bar + table DOM).
- Subsequent clicks: toggles `display: none` on the wrapper.
- Table state (sort, filter, collapse, column widths) is preserved across hide/show.
- Calling `renderer.destroy()` removes the wrapper; the trigger button remains.
