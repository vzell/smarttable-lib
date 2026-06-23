/**
 * @file types.js
 * @description Shared type definitions and JSDoc typedefs for smarttable-lib.
 *   All public APIs are typed via JSDoc so consumers get IDE intellisense
 *   without requiring a TypeScript build step.
 * @version 1.3.0
 */

// ---------------------------------------------------------------------------
// CHANGELOG
// ---------------------------------------------------------------------------
// 1.0.0 — initial release
//         CellMeta, ImageMeta, ColumnDef, NormalizedRow, TableOptions,
//         CollapseState, FilterState, SortEntry defined.
// 1.1.0 — ColumnDef gains derivedFrom and derive for computed columns.
// 1.2.0 — ColumnDef gains render callback for custom cell DOM output.
// 1.3.0 — ColumnFilter gains isRegex; when false the regex field is treated as
//          a literal substring (escaped before pattern compilation).
// ---------------------------------------------------------------------------

/**
 * Metadata extracted from a single <img> element found inside a table cell.
 *
 * @typedef {Object} ImageMeta
 * @property {string|null} src    - Resolved src attribute value, or null if absent.
 * @property {string|null} alt    - alt attribute value, or null if absent.
 * @property {string|null} title  - title attribute value, or null if absent.
 * @property {boolean}     broken - True if the image fired an error event (broken src).
 */

/**
 * Normalised representation of a single table cell's content.
 * Produced by cell-inspector.js; consumed by filter-engine and dropdown.
 *
 * @typedef {Object} CellMeta
 * @property {string|null}   text          - Visible text content (trimmed), or null if none.
 * @property {ImageMeta[]}   images        - All <img> elements found in the cell.
 * @property {string[]}      nonTextNodes  - Tag names of non-text, non-img child nodes
 *                                          (e.g. "SVG", "CANVAS", "VIDEO", "OBJECT").
 * @property {boolean}       isEmpty       - True when text is blank AND images is empty
 *                                          AND nonTextNodes is empty.
 * @property {HTMLElement}   rawElement    - The original TD/TH element.
 */

/**
 * Definition for a single table column supplied by an adapter.
 *
 * @typedef {Object} ColumnDef
 * @property {string}   key              - Unique identifier matching keys in NormalizedRow.
 * @property {string}   label            - Display label shown in the column header.
 * @property {'string'|'number'|'date'} [type='string']
 *                                       - Value type used by SortEngine for comparisons.
 * @property {boolean}  [collapsible=false]
 *                                       - Whether cells in this column can have multiple
 *                                         sub-rows that collapse/expand.
 * @property {number}   [peekRows=1]     - How many sub-rows remain visible when collapsed.
 * @property {boolean}  [filterable=true] - Include this column in filter UI.
 * @property {boolean}  [sortable=true]   - Include this column in sort UI.
 * @property {string}   [width]          - Optional CSS width value (e.g. '120px', '20%').
 * @property {string}   [derivedFrom]    - Key of the source column to derive this column's value
 *                                         from. The renderer pre-computes derived values once in
 *                                         the constructor so all engines (sort, filter, collapse)
 *                                         see the computed value. Requires `derive` to be set.
 * @property {function(string): string} [derive]
 *                                       - Transform function called with the source column's cell
 *                                         value (first sub-row string for array-valued cells).
 *                                         Must return a plain string. Required when derivedFrom
 *                                         is set.
 * @property {function(string, NormalizedRow): (Node|string)} [render]
 *                                       - Custom renderer for a single sub-row. Called once per
 *                                         sub-row string with (value, fullRow). Return a DOM Node
 *                                         to append inside the sub-row div, or a string to set as
 *                                         textContent. When omitted, textContent is used.
 *                                         Does NOT affect sort or filter — those always operate on
 *                                         the raw data value.
 */

/**
 * A single data row supplied by an adapter's extract() method.
 * Values are plain strings; the library wraps them into CellMeta internally.
 * For collapsible columns the value may be an array of strings (sub-rows).
 *
 * @typedef {Object.<string, string|string[]>} NormalizedRow
 */

/**
 * Collapse state tracked per column by CollapseEngine.
 *
 * @typedef {Object} CollapseState
 * @property {boolean}          columnCollapsed  - Master collapsed flag for the column.
 * @property {Map<number,boolean>} cellOverrides  - Per-row overrides (rowIdx → collapsed).
 *                                                  Cleared whenever the column header is toggled.
 * @property {number}           collapsibleCount - Count of cells with more than peekRows sub-rows.
 * @property {number}           totalRows        - Total row count in the current render.
 */

/**
 * A single active sort entry in the multi-column sort stack.
 *
 * @typedef {Object} SortEntry
 * @property {string}      colKey    - Column key being sorted.
 * @property {'asc'|'desc'} direction - Sort direction.
 * @property {number}      priority  - Lower = higher priority (0 = primary sort).
 */

/**
 * A single active filter descriptor for one column.
 *
 * @typedef {Object} ColumnFilter
 * @property {string}   colKey       - Column key this filter applies to.
 * @property {string[]} metaEntries  - Selected meta predicates, e.g. ['isEmpty', 'brokenSrc'].
 * @property {string[]} valueEntries - Selected unique text values.
 * @property {string}   regex        - Column-level filter string (may be empty).
 * @property {boolean}  [isRegex=false] - If false (default), regex is escaped and matched
 *                                        literally as a substring. If true, it is compiled
 *                                        as a JavaScript regular expression.
 * @property {boolean}  regexExclude - If true, regex is an exclusion filter.
 * @property {boolean}  regexCase    - If true, regex is case-sensitive.
 */

/**
 * Global filter state passed to FilterEngine.
 *
 * @typedef {Object} FilterState
 * @property {string}         globalRegex        - Global regex string (may be empty).
 * @property {boolean}        globalRegexExclude - If true, global regex excludes matches.
 * @property {boolean}        globalRegexCase    - If true, global regex is case-sensitive.
 * @property {ColumnFilter[]} columnFilters      - Per-column filter descriptors.
 */

/**
 * Top-level options passed to SmartTable.render().
 *
 * @typedef {Object} TableOptions
 * @property {string}  [tableClass='st-table']  - CSS class applied to the <table> element.
 * @property {string}  [theme='light']          - Reserved for future theming ('light'|'dark').
 * @property {boolean} [shadingEnabled=true]    - Enable value-change shading on sort.
 * @property {number}  [shadingDurationMs=600]  - Duration of the shading CSS transition.
 * @property {boolean} [stickyHeader=true]      - Apply position:sticky to the <thead> row.
 */

export {};
