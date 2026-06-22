# Architecture Diagrams

All diagrams are in Mermaid syntax, readable by Claude Code and renderable
in GitHub, VS Code (with Mermaid extension), and most markdown previewers.

---

## Diagram 1 — Three-layer project architecture

```mermaid
graph TB
    subgraph LIB["smarttable-lib (GitHub repo · versioned tag)"]
        TR[TableRenderer]
        SE[SortEngine]
        FE[FilterEngine]
        CE[CollapseEngine]
        RE[ResizeEngine]
        DD[Dropdown]
        CI[CellInspector]
        TR --> SE
        TR --> FE
        TR --> CE
        TR --> RE
        TR --> DD
        TR --> CI
    end

    subgraph ADAPTERS["Site adapters (adapters/ subfolder)"]
        A1[setlistfm-adapter]
        A2[brucebase-adapter]
        A3[backstreets-adapter]
    end

    subgraph CONTRACT["Adapter interface contract"]
        C1["extract() → NormalizedRow[]"]
        C2["columnDefs: ColumnDef[]"]
        C3["triggerSelector: string"]
    end

    subgraph SCRIPTS["Userscripts (.user.js)"]
        S1[setlistfm.user.js]
        S2[brucebase.user.js]
        S3[backstreets.user.js]
    end

    DOM["Target site DOM"]

    A1 --> CONTRACT
    A2 --> CONTRACT
    A3 --> CONTRACT

    CONTRACT --> S1
    CONTRACT --> S2
    CONTRACT --> S3

    LIB -->|"@require via jsDelivr"| S1
    LIB -->|"@require via jsDelivr"| S2
    LIB -->|"@require via jsDelivr"| S3

    S1 --> DOM
    S2 --> DOM
    S3 --> DOM
```

---

## Diagram 2 — CellMeta object model

```mermaid
classDiagram
    class CellMeta {
        +string|null text
        +ImageMeta[] images
        +string[] nonTextNodes
        +boolean isEmpty
        +HTMLElement rawElement
    }

    class ImageMeta {
        +string|null src
        +string|null alt
        +string|null title
        +boolean broken
    }

    CellMeta "1" --> "0..*" ImageMeta

    note for CellMeta "nonTextNodes: tag names only\nSVG · CANVAS · VIDEO\nAUDIO · OBJECT · EMBED"
    note for ImageMeta "broken detected via:\n1. img.complete && naturalWidth==0\n2. one-time error listener"
```

---

## Diagram 3 — Column filter dropdown sections

```mermaid
graph TD
    subgraph DROP["Per-column filter dropdown"]
        subgraph A["Section A — Meta entries (always first)"]
            A1["☐ Empty cells"]
            A2["☐ Has image"]
            A3["☐ No src / broken src"]
            A4["☐ Has alt / metadata"]
            A5["☐ Has non-image node"]
        end
        subgraph B["Section B — Quick filter"]
            B1["[ search input      ]"]
            B2["live filter as type"]
            B3["Enter → confirm all visible"]
            B4["Esc → clear"]
        end
        subgraph C["Section C — Unique values"]
            C1["☐ Thunder Road (42)"]
            C2["☐ Born to Run (38)"]
            C3["☐ Badlands (31)"]
            C4["☐ …"]
        end
    end

    B1 -->|"filters"| C

    note1["Meta entries only shown\nif ≥1 row matches predicate"]
    note2["Values sorted: freq desc\nthen alpha"]
```

---

## Diagram 4 — Filter pipeline

```mermaid
flowchart LR
    IN["All rows"]
    M["Stage 1\nMeta filter\nper-column · OR within"]
    V["Stage 2\nValue filter\nper-column · OR within"]
    CR["Stage 3\nColumn regex\nper-column · AND across"]
    GR["Stage 4\nGlobal regex\nall columns · AND"]
    OUT["Visible rows"]

    IN --> M --> V --> CR --> GR --> OUT
```

**Combining rules:**
- Meta selections within one column: OR
- Value selections within one column: OR
- All column filters across columns: AND
- Global regex: AND with everything

---

## Diagram 5 — CollapseState and resolution

```mermaid
classDiagram
    class CollapseState {
        +boolean columnCollapsed
        +Map~rowIdx_bool~ cellOverrides
        +number collapsibleCount
        +number totalRows
    }

    class CollapseEngine {
        +initColumn(colDef, rows)
        +toggleColumn(colKey) bool
        +toggleCell(colKey, rowIdx) bool
        +isCellCollapsed(colKey, rowIdx) bool
        +getHeaderLabel(colKey) string
        +getCellGlyph(colKey, rowIdx, subRowCount) string
    }

    CollapseEngine "1" --> "*" CollapseState

    note for CollapseEngine "toggleColumn() always wins:\nclears cellOverrides THEN flips columnCollapsed\n\nisCellCollapsed():\n  cellOverrides.has(idx) → override\n  else → columnCollapsed"
```

---

## Diagram 6 — Column header anatomy

```
┌─────────────────────────────────────────────────────┐
│  Song title        1▲    ▲ 3/120      ⧩             │
│  │                 │ │   │            │              │
│  column label      │ │   collapse     filter button  │
│                    │ │   badge        (⧩ = active)   │
│               sort │ sort                            │
│             priority direction                       │
└─────────────────────────────────────────────────────┘
                                        ◄──6px──►
                                        drag handle zone
```

---

## Diagram 7 — Data cell anatomy (collapsed vs expanded)

```
COLLAPSED:
┌─────────────────────────────┐
│ ▲ +4  Thunder Road          │
│ │  │  │                     │
│ │  │  peek row (sub-row 0)  │
│ │  └─ hidden count          │
│ └──── toggle (click=expand) │
└─────────────────────────────┘

EXPANDED:
┌─────────────────────────────┐
│ ▼ -4  Thunder Road          │
│        Born to Run          │
│        Badlands             │
│        The Promised Land    │
│ │  │                        │
│ │  └─ collapse count        │
│ └──── toggle (click=collapse)│
└─────────────────────────────┘

Single-row cell (no toggle, no glyph):
┌─────────────────────────────┐
│  Thunder Road               │
└─────────────────────────────┘
```

**Glyph convention:** arrow points in direction of action (not current state).
`▲ +4` = "4 rows hidden, click to expand upward"

---

## Diagram 8 — Resize drag state machine

```mermaid
stateDiagram-v2
    [*] --> IDLE

    IDLE --> DRAG_READY : mouseenter handle zone\n(offsetX > thWidth - 6)
    DRAG_READY --> IDLE : mouseleave handle
    DRAG_READY --> DRAGGING : mousedown\nstores colKey · startX · startWidth\ncursor = col-resize\nbody userSelect = none

    DRAGGING --> IDLE : mouseup\nor window mouseleave\nbody userSelect = ''

    DRAGGING --> DRAGGING : mousemove\nδx = clientX - startX\nnewW = clamp(startW + δx)
```

---

## Diagram 9 — Auto-resize measurement flow

```mermaid
flowchart TD
    BTN["User clicks\n'Auto-size columns'"]
    RULER["Off-screen ruler span\nfont = table computed style\nwhite-space: nowrap\nvisibility: hidden"]

    BTN --> RULER

    RULER --> H["Measure header label\n+ HEADER_CHROME_PX (56)"]
    RULER --> D["For each visible row:\n  for each sub-row string:\n    measure text\n    + CELL_PADDING_PX (24)\n  longest sub-row wins"]

    H --> MAX["max(header, all cells)"]
    D --> MAX

    MAX --> CLAMP["Clamp to\n[minWidth ?? 60, maxWidth ?? ∞]"]
    CLAMP --> COL["Write px to <col> element\nin <colgroup>"]
    COL --> FIXED["table-layout: fixed"]
```

**Key rule:** auto-resize measures **all sub-rows** even in collapsed cells.
Column width always fits fully expanded content — expanding a cell never
causes a layout shift.

---

## Diagram 10 — Engine wiring inside TableRenderer

```mermaid
graph LR
    subgraph TR["TableRenderer"]
        CE2[CollapseEngine]
        SE2[SortEngine]
        FE2[FilterEngine]
        RE2[ResizeEngine]
        DD2[Dropdown]
    end

    ROWS["NormalizedRow[]"] --> FE2
    ROWS --> SE2
    ROWS --> RE2

    FE2 -->|"filtered indices"| SE2
    SE2 -->|"sorted display indices"| BUILD["buildTbody()"]
    CE2 -->|"collapse state"| BUILD
    RE2 -->|"col widths → colgroup"| TABLE["&lt;table&gt;"]
    DD2 -->|"ColumnFilter updates"| FE2
    BUILD --> TABLE

    FE2 -.->|"CellMeta cache"| DD2
```
