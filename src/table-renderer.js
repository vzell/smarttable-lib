/**
 * @file table-renderer.js
 * @description Main table renderer. Wires CollapseEngine, SortEngine,
 *   FilterEngine, and Dropdown together into a fully interactive HTML table.
 *
 *   Rendering lifecycle:
 *     1. inject() — create table skeleton + inject trigger button on the page
 *     2. render() — build thead/tbody from current data + filter/sort/collapse state
 *     3. re-render() — called after any state change (filter, sort, collapse toggle)
 * @version 1.4.0
 */

// ---------------------------------------------------------------------------
// CHANGELOG
// ---------------------------------------------------------------------------
// 1.0.0 — initial release
//         TableRenderer class with inject(), render(), destroy() defined.
//         Header: label + sort priority badge + collapse badge + filter icon.
//         Cell: collapse toggle glyph + peek/full sub-row rendering.
//         Shading: st-shading-changed class applied on sort changes.
// 1.1.0 — column resize support
//         ResizeEngine integrated: <colgroup> management, off-screen ruler,
//         drag-to-resize on header border, auto-resize global button.
//         _rerender() re-attaches ResizeEngine after thead replacement.
//         _buildGlobalBar() gains "Auto-size columns" button.
// 1.2.0 — derived column support
//         _expandRow() pre-computes ColumnDef.derive(sourceValue) values into
//         each row at construction time so sort/filter/collapse see them.
// 1.3.2 — ColumnDef.render callback support
//         _makeSubrow() accepts (text, hidden, col, row); if col.render is set,
//         its return value is appended as a Node or set as textContent.
//         Sort and filter are unaffected — they use raw data values only.
// 1.3.1 — set type="button" on every created <button> element so none of them
//         accidentally submit a host-page <form> (HTML default is type="submit").
// 1.3.0 — complete ResizeEngine wiring
//         _buildWrapper(): attach ResizeEngine after table enters DOM; apply
//           initial col.width values via setColWidth() (not th.style.width).
//         _buildGlobalBar(): "Auto-size columns" button added.
//         _buildTh(): attachDragHandlers() called per column; th.style.width
//           removed (invariant: widths via <col> only, never on <th>/<td>).
//         _rerender(): re-attach ResizeEngine so colgroup tracks new thead.
// 1.4.0 — permanent filter row + match highlighting
//         _buildThead() now produces two rows: column headers + filter row.
//         _buildHeaderRow() extracted from old _buildThead() body.
//         _buildFilterRow() adds a text input + regex toggle per filterable column.
//         Typing in the filter row updates ColumnFilter.regex; the .* button
//         toggles ColumnFilter.isRegex. Focus and cursor are restored after
//         each re-render so typing feels seamless.
//         _buildTbody() pre-computes highlight patterns; _makeSubrow() wraps
//         matches in <mark class="st-highlight"> via _applyHighlight().
//         Cells with a col.render callback are not highlighted.
//         stickyHeader inline styles moved from _buildTable() into _buildThead().
// ---------------------------------------------------------------------------

import { CollapseEngine }                          from './collapse-engine.js';
import { FilterEngine, buildHighlightPattern }     from './filter-engine.js';
import { SortEngine }                              from './sort-engine.js';
import { Dropdown, emptyColumnFilter }             from './dropdown.js';
import { inspectCell }                             from './cell-inspector.js';
import { ResizeEngine }                            from './resize-engine.js';

/**
 * @typedef {import('./types.js').ColumnDef}    ColumnDef
 * @typedef {import('./types.js').NormalizedRow} NormalizedRow
 * @typedef {import('./types.js').TableOptions} TableOptions
 * @typedef {import('./types.js').FilterState}  FilterState
 * @typedef {import('./types.js').ColumnFilter} ColumnFilter
 */

// ---------------------------------------------------------------------------
// CSS class constants
// ---------------------------------------------------------------------------

const C = {
    TABLE:          'st-table',
    THEAD:          'st-thead',
    TH:             'st-th',
    TH_LABEL:       'st-th-label',
    TH_SORT_BADGE:  'st-th-sort-badge',
    TH_SORT_DIR:    'st-th-sort-dir',
    TH_COLLAPSE:    'st-th-collapse',
    TH_FILTER_BTN:  'st-th-filter-btn',
    TBODY:          'st-tbody',
    TR:             'st-tr',
    TD:             'st-td',
    TD_INNER:       'st-td-inner',
    SUBROW:         'st-subrow',
    SUBROW_HIDDEN:  'st-subrow--hidden',
    CELL_TOGGLE:    'st-cell-toggle',
    SHADING:        'st-shading-changed',
    FILTER_ACTIVE:  'st-th--filter-active',
    SORT_ACTIVE:    'st-th--sort-active',
    BTN_TRIGGER:      'st-btn-trigger',
    BTN_AUTO_RESIZE:  'st-btn-auto-resize',
    WRAPPER:          'st-wrapper',
    GLOBAL_BAR:       'st-global-bar',
    FILTER_ROW:       'st-filter-row',
    FILTER_TH:        'st-filter-th',
    FILTER_INPUT:     'st-filter-input',
    FILTER_REGEX_BTN: 'st-filter-regex-btn',
};

export class TableRenderer {
    /**
     * @param {object}         params
     * @param {ColumnDef[]}    params.columns
     * @param {NormalizedRow[]} params.rows
     * @param {HTMLElement}    params.container
     * @param {TableOptions}   [params.options]
     */
    constructor({ columns, rows, container, options = {} }) {
        this._columns   = columns;
        this._container = container;
        this._options   = {
            tableClass:         C.TABLE,
            shadingEnabled:     true,
            shadingDurationMs:  600,
            stickyHeader:       true,
            ...options,
        };

        this._collapse = new CollapseEngine();
        this._sort     = new SortEngine(columns);
        this._filter   = new FilterEngine(columns);
        this._resize   = new ResizeEngine(columns);

        // Pre-compute derived column values so all engines (sort, filter, collapse) see them
        this._rows = rows.map(row => this._expandRow(row));

        /** @type {FilterState} */
        this._filterState = {
            globalRegex:        '',
            globalRegexExclude: false,
            globalRegexCase:    false,
            columnFilters:      columns.map(c => emptyColumnFilter(c.key)),
        };

        /** @type {Dropdown|null} */
        this._openDropdown = null;

        /** @type {HTMLElement|null} */
        this._wrapper = null;

        /** Stable original indices for all rows */
        this._allIdxs = this._rows.map((_, i) => i);

        /** Current sorted+filtered indices (display order) */
        this._displayIdxs = this._allIdxs.slice();

        this._initEngines();
    }

    // -------------------------------------------------------------------------
    // Initialisation
    // -------------------------------------------------------------------------

    /**
     * Initialises collapse and cell-meta state for the current data set.
     *
     * @returns {void}
     */
    _initEngines() {
        for (const col of this._columns) {
            if (col.collapsible) {
                this._collapse.initColumn(col, this._rows);
            }
        }
    }

    // -------------------------------------------------------------------------
    // Public lifecycle
    // -------------------------------------------------------------------------

    /**
     * Injects the trigger button into the host page and renders the table.
     * The trigger button is appended to this._container; the table wrapper
     * is inserted after the button.
     *
     * @returns {void}
     */
    inject() {
        const btn = document.createElement('button');
        btn.type = 'button'; // prevent form submission when injected inside a <form>
        btn.className = C.BTN_TRIGGER;
        btn.textContent = 'Show table';
        btn.addEventListener('click', () => {
            if (this._wrapper) {
                const visible = this._wrapper.style.display !== 'none';
                this._wrapper.style.display = visible ? 'none' : '';
                btn.textContent = visible ? 'Show table' : 'Hide table';
            } else {
                this._buildWrapper();
                btn.textContent = 'Hide table';
            }
        });

        this._container.appendChild(btn);
    }

    /**
     * Destroys the table wrapper and cleans up event listeners.
     * The trigger button is left in place so the user can re-render.
     *
     * @returns {void}
     */
    destroy() {
        this._openDropdown?.destroy();
        this._resize.detach();
        this._wrapper?.remove();
        this._wrapper = null;
    }

    // -------------------------------------------------------------------------
    // Wrapper + global bar
    // -------------------------------------------------------------------------

    /**
     * @returns {void}
     */
    _buildWrapper() {
        const wrapper = document.createElement('div');
        wrapper.className = C.WRAPPER;

        wrapper.appendChild(this._buildGlobalBar());
        wrapper.appendChild(this._buildTable());

        this._container.appendChild(wrapper);
        this._wrapper = wrapper;

        // Attach after wrapper is in the DOM so the ruler inherits CSS context
        this._resize.attach(this._tableEl);

        // Seed any initial widths declared on column definitions
        for (const col of this._columns) {
            if (col.width) {
                const px = parseFloat(col.width);
                if (px > 0) {
                    this._resize.setColWidth(col.key, px);
                }
            }
        }
    }

    /**
     * Builds the global regex filter bar shown above the table.
     *
     * @returns {HTMLElement}
     */
    _buildGlobalBar() {
        const bar = document.createElement('div');
        bar.className = C.GLOBAL_BAR;

        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = 'Global filter (regex)…';
        input.className = 'st-global-input';
        input.setAttribute('aria-label', 'Global regex filter');

        const excludeToggle = this._makeToggle('Exclude', false, (val) => {
            this._filterState.globalRegexExclude = val;
            this._rerender();
        });

        const caseToggle = this._makeToggle('Case', false, (val) => {
            this._filterState.globalRegexCase = val;
            this._rerender();
        });

        input.addEventListener('input', () => {
            this._filterState.globalRegex = input.value;
            this._rerender();
        });

        const autoSizeBtn = document.createElement('button');
        autoSizeBtn.type = 'button';
        autoSizeBtn.className = C.BTN_AUTO_RESIZE;
        autoSizeBtn.textContent = 'Auto-size columns';
        autoSizeBtn.addEventListener('click', () => {
            const displayRows = this._displayIdxs.map(i => this._rows[i]);
            this._resize.autoResize(this._rows, displayRows);
        });

        bar.appendChild(input);
        bar.appendChild(excludeToggle);
        bar.appendChild(caseToggle);
        bar.appendChild(autoSizeBtn);
        return bar;
    }

    // -------------------------------------------------------------------------
    // Table construction
    // -------------------------------------------------------------------------

    /**
     * Builds the full <table> element with thead and tbody.
     *
     * @returns {HTMLTableElement}
     */
    _buildTable() {
        const table = document.createElement('table');
        table.className = this._options.tableClass ?? C.TABLE;

        const thead = this._buildThead();
        const tbody = this._buildTbody();

        table.appendChild(thead);
        table.appendChild(tbody);

        this._tableEl = table;
        this._tbodyEl = tbody;
        return table;
    }

    /**
     * Builds the <thead> with two rows: column headers + filter inputs.
     *
     * @returns {HTMLTableSectionElement}
     */
    _buildThead() {
        const thead = document.createElement('thead');
        thead.className = C.THEAD;

        thead.appendChild(this._buildHeaderRow());
        thead.appendChild(this._buildFilterRow());

        if (this._options.stickyHeader) {
            thead.style.position = 'sticky';
            thead.style.top = '0';
        }

        return thead;
    }

    /**
     * Builds the primary header <tr> with one <th> per column.
     * Extracted from the old _buildThead() body.
     *
     * @returns {HTMLTableRowElement}
     */
    _buildHeaderRow() {
        const tr = document.createElement('tr');
        for (const col of this._columns) {
            tr.appendChild(this._buildTh(col));
        }
        return tr;
    }

    /**
     * Builds the permanent filter row: a second <tr> in <thead> with a text
     * input per filterable column. Each input also has a regex toggle button.
     *
     * @returns {HTMLTableRowElement}
     */
    _buildFilterRow() {
        const tr = document.createElement('tr');
        tr.className = C.FILTER_ROW;

        for (const col of this._columns) {
            const th = document.createElement('th');
            th.className = C.FILTER_TH;

            if (col.filterable !== false) {
                const cf = this._getColumnFilter(col.key);

                const input = document.createElement('input');
                input.type = 'text';
                input.className = C.FILTER_INPUT;
                input.dataset.colkey = col.key;
                input.placeholder = col.label;
                input.value = cf.regex;

                input.addEventListener('input', () => {
                    const sel = [input.selectionStart, input.selectionEnd];
                    this._setColumnFilter({
                        ...this._getColumnFilter(col.key),
                        regex: input.value,
                    });
                    this._rerender();
                    const restored = this._tableEl.querySelector(
                        `.${C.FILTER_INPUT}[data-colkey="${col.key}"]`
                    );
                    if (restored instanceof HTMLInputElement) {
                        restored.focus();
                        restored.setSelectionRange(sel[0], sel[1]);
                    }
                });

                const regexBtn = document.createElement('button');
                regexBtn.type = 'button';
                regexBtn.className = C.FILTER_REGEX_BTN;
                regexBtn.textContent = '.*';
                regexBtn.title = 'Toggle regex mode';
                regexBtn.dataset.active = String(cf.isRegex ?? false);

                regexBtn.addEventListener('click', () => {
                    this._setColumnFilter({
                        ...this._getColumnFilter(col.key),
                        isRegex: !(this._getColumnFilter(col.key).isRegex ?? false),
                    });
                    this._rerender();
                });

                th.appendChild(input);
                th.appendChild(regexBtn);
            }

            tr.appendChild(th);
        }

        return tr;
    }

    /**
     * Builds a single <th> element for a column header.
     * Contains: label | sort badge | collapse badge | filter button.
     *
     * @param {ColumnDef} col
     * @returns {HTMLTableCellElement}
     */
    _buildTh(col) {
        const th = document.createElement('th');
        th.className = C.TH;

        // Label
        const label = document.createElement('span');
        label.className = C.TH_LABEL;
        label.textContent = col.label;
        th.appendChild(label);

        // Sort badge (priority number + direction arrow)
        const sortEntry = this._sort.getStack().find(e => e.colKey === col.key);
        if (sortEntry) {
            const badge = document.createElement('span');
            badge.className = C.TH_SORT_BADGE;
            badge.textContent = `${sortEntry.priority + 1}`;
            th.appendChild(badge);

            const dir = document.createElement('span');
            dir.className = C.TH_SORT_DIR;
            dir.textContent = sortEntry.direction === 'asc' ? ' ▲' : ' ▼';
            th.appendChild(dir);

            th.classList.add(C.SORT_ACTIVE);
        }

        // Sort click handler
        if (col.sortable !== false) {
            label.style.cursor = 'pointer';
            label.addEventListener('click', () => {
                this._sort.pushSort(col.key);
                this._rerender();
            });
        }

        // Collapse badge: "▲ N / T" or "▼ N / T"
        if (col.collapsible) {
            const collapseLabel = this._collapse.getHeaderLabel(col.key);
            if (collapseLabel) {
                const badge = document.createElement('button');
                badge.type = 'button';
                badge.className = C.TH_COLLAPSE;
                badge.setAttribute('aria-label',
                    `Toggle collapse for column ${col.label}`);
                badge.textContent = collapseLabel;
                badge.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this._collapse.toggleColumn(col.key);
                    this._rerender();
                });
                th.appendChild(badge);
            }
        }

        // Filter button
        if (col.filterable !== false) {
            const cf = this._getColumnFilter(col.key);
            const hasFilter = cf.metaEntries.length > 0
                || cf.valueEntries.length > 0
                || cf.regex.trim() !== '';

            const filterBtn = document.createElement('button');
            filterBtn.type = 'button';
            filterBtn.className = C.TH_FILTER_BTN;
            filterBtn.setAttribute('aria-label', `Filter column ${col.label}`);
            filterBtn.textContent = hasFilter ? '⧩' : '⧨';
            if (hasFilter) {
                th.classList.add(C.FILTER_ACTIVE);
            }
            filterBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this._toggleDropdown(col, th);
            });
            th.appendChild(filterBtn);
        }

        this._resize.attachDragHandlers(th, col.key);
        return th;
    }

    // -------------------------------------------------------------------------
    // Tbody
    // -------------------------------------------------------------------------

    /**
     * Builds the <tbody> for the current display indices.
     *
     * @returns {HTMLTableSectionElement}
     */
    _buildTbody() {
        // Pre-compute highlight patterns once so _makeSubrow can mark matches
        this._globalPattern = buildHighlightPattern(
            this._filterState.globalRegex,
            true,
            this._filterState.globalRegexCase
        );
        this._colPatterns = new Map();
        for (const cf of this._filterState.columnFilters) {
            if (cf.regex.trim()) {
                this._colPatterns.set(
                    cf.colKey,
                    buildHighlightPattern(cf.regex, cf.isRegex ?? false, cf.regexCase)
                );
            }
        }

        // Apply filter then sort
        const filtered = this._filter.filter(
            this._rows,
            this._allIdxs,
            this._filterState
        );
        this._displayIdxs = this._sort.sort(filtered, this._rows);

        const tbody = document.createElement('tbody');
        tbody.className = C.TBODY;

        this._displayIdxs.forEach((origIdx, displayPos) => {
            const row = this._rows[origIdx];
            const tr  = document.createElement('tr');
            tr.className = C.TR;
            tr.dataset.origIdx = String(origIdx);

            for (const col of this._columns) {
                tr.appendChild(
                    this._buildTd(col, row, origIdx, displayPos)
                );
            }

            tbody.appendChild(tr);
        });

        return tbody;
    }

    /**
     * Builds a single <td> element, including sub-row rendering and
     * collapse toggle glyph for collapsible columns.
     *
     * @param {ColumnDef}    col
     * @param {NormalizedRow} row
     * @param {number}       origIdx    - Stable original row index.
     * @param {number}       displayPos - Current display position (for shading).
     * @returns {HTMLTableCellElement}
     */
    _buildTd(col, row, origIdx, displayPos) {
        const td = document.createElement('td');
        td.className = C.TD;

        // Shading class (value changed position since last sort)
        if (this._options.shadingEnabled) {
            const shadingClass = this._sort.getShadingClass(col.key, displayPos);
            if (shadingClass) {
                td.classList.add(C.SHADING);
                if (this._options.shadingDurationMs) {
                    td.style.transition =
                        `background-color ${this._options.shadingDurationMs}ms ease`;
                }
                // Remove shading class after transition so it can re-trigger
                setTimeout(() => td.classList.remove(C.SHADING),
                    this._options.shadingDurationMs ?? 600);
            }
        }

        // Inspect cell for FilterEngine meta cache
        const rawEl = document.createElement('div');
        rawEl.innerHTML = this._cellHTML(row, col.key);
        const meta = inspectCell(rawEl);
        this._filter.setCellMeta(col.key, origIdx, meta);

        // Build cell inner content
        const inner = document.createElement('div');
        inner.className = C.TD_INNER;

        const subRows = this._subRows(row, col.key);

        if (!col.collapsible || subRows.length <= (col.peekRows ?? 1)) {
            // Single-row or non-collapsible: render all sub-rows, no toggle
            for (const text of subRows) {
                inner.appendChild(this._makeSubrow(text, false, col, row));
            }
        } else {
            // Multi-row collapsible cell
            const collapsed = this._collapse.isCellCollapsed(col.key, origIdx);
            const peekRows  = col.peekRows ?? 1;
            const glyph     = this._collapse.getCellGlyph(
                col.key, origIdx, subRows.length
            );

            // Toggle glyph button (before the peek row)
            if (glyph) {
                const toggleBtn = document.createElement('button');
                toggleBtn.type = 'button';
                toggleBtn.className = C.CELL_TOGGLE;
                toggleBtn.setAttribute('aria-label',
                    collapsed ? 'Expand cell' : 'Collapse cell');
                toggleBtn.textContent = glyph;
                toggleBtn.addEventListener('click', () => {
                    this._collapse.toggleCell(col.key, origIdx);
                    this._rerender();
                });
                inner.appendChild(toggleBtn);
            }

            subRows.forEach((text, i) => {
                const hidden = collapsed && i >= peekRows;
                inner.appendChild(this._makeSubrow(text, hidden, col, row));
            });
        }

        td.appendChild(inner);
        return td;
    }

    // -------------------------------------------------------------------------
    // Re-render
    // -------------------------------------------------------------------------

    /**
     * Replaces the tbody with a freshly built one, preserving the thead.
     * Called after every state change.
     *
     * @returns {void}
     */
    _rerender() {
        if (!this._tableEl || !this._tbodyEl) {
            return;
        }

        const newThead = this._buildThead();
        const newTbody = this._buildTbody();

        this._tableEl.replaceChild(newThead, this._tableEl.querySelector('thead'));
        this._tableEl.replaceChild(newTbody, this._tbodyEl);
        this._tbodyEl = newTbody;

        // Re-attach so the colgroup is rebuilt before the new thead; stored widths
        // are re-applied to the fresh <col> elements by attach() → _applyWidths().
        this._resize.attach(this._tableEl);
    }

    // -------------------------------------------------------------------------
    // Dropdown management
    // -------------------------------------------------------------------------

    /**
     * Opens the dropdown for a column (or closes it if already open for that column).
     *
     * @param {ColumnDef}    col
     * @param {HTMLElement}  thEl - The header cell element (used for positioning).
     * @returns {void}
     */
    _toggleDropdown(col, thEl) {
        if (this._openDropdown) {
            this._openDropdown.destroy();
            this._openDropdown = null;
            if (this._openDropdownColKey === col.key) {
                this._openDropdownColKey = null;
                return;
            }
        }

        const cf          = this._getColumnFilter(col.key);
        const uniqueValues = this._filter.buildUniqueValues(this._rows, col.key);
        const metaEntryKeys = this._filter.buildMetaEntries(
            this._rows, col.key, this._allIdxs
        );

        const dropdown = new Dropdown(
            col,
            { metaEntryKeys, uniqueValues },
            cf,
            (updatedFilter) => {
                this._setColumnFilter(updatedFilter);
                this._rerender();
            }
        );

        const container = this._wrapper ?? document.body;
        dropdown.build(container);

        // Position below the header cell
        const rect = thEl.getBoundingClientRect();
        const wrapRect = container.getBoundingClientRect();
        const dropEl = container.querySelector('.st-dropdown');
        if (dropEl instanceof HTMLElement) {
            dropEl.style.position = 'absolute';
            dropEl.style.top  = `${rect.bottom - wrapRect.top}px`;
            dropEl.style.left = `${rect.left   - wrapRect.left}px`;
        }

        this._openDropdown    = dropdown;
        this._openDropdownColKey = col.key;

        // Close when clicking outside
        const closeHandler = (e) => {
            if (!container.querySelector('.st-dropdown')?.contains(e.target)) {
                dropdown.destroy();
                this._openDropdown = null;
                this._openDropdownColKey = null;
                document.removeEventListener('click', closeHandler);
            }
        };
        setTimeout(() =>
            document.addEventListener('click', closeHandler), 0
        );
    }

    // -------------------------------------------------------------------------
    // Filter state helpers
    // -------------------------------------------------------------------------

    /**
     * @param {string} colKey
     * @returns {ColumnFilter}
     */
    _getColumnFilter(colKey) {
        return this._filterState.columnFilters.find(f => f.colKey === colKey)
            ?? emptyColumnFilter(colKey);
    }

    /**
     * @param {ColumnFilter} cf
     * @returns {void}
     */
    _setColumnFilter(cf) {
        const idx = this._filterState.columnFilters.findIndex(
            f => f.colKey === cf.colKey
        );
        if (idx !== -1) {
            this._filterState.columnFilters[idx] = cf;
        }
    }

    // -------------------------------------------------------------------------
    // Row expansion
    // -------------------------------------------------------------------------

    /**
     * Returns a new row with derived column values pre-computed.
     * For each ColumnDef that has both `derivedFrom` and `derive` set, the
     * source column's first string value is passed through `derive` and stored
     * under this column's key. Array-valued source cells use their first element.
     *
     * @param {NormalizedRow} row
     * @returns {NormalizedRow}
     */
    _expandRow(row) {
        const expanded = { ...row };
        for (const col of this._columns) {
            if (col.derivedFrom && typeof col.derive === 'function') {
                const src = row[col.derivedFrom];
                const srcStr = Array.isArray(src) ? (src[0] ?? '') : String(src ?? '');
                expanded[col.key] = col.derive(srcStr);
            }
        }
        return expanded;
    }

    // -------------------------------------------------------------------------
    // DOM helpers
    // -------------------------------------------------------------------------

    /**
     * Returns the sub-row string array for a cell.
     *
     * @param {NormalizedRow} row
     * @param {string}        colKey
     * @returns {string[]}
     */
    _subRows(row, colKey) {
        const value = row[colKey];
        if (Array.isArray(value)) {
            return value.map(v => String(v ?? ''));
        }
        return [String(value ?? '')];
    }

    /**
     * Returns raw HTML string for a cell (single-value or joined sub-rows).
     * Used to seed the inspectCell DOM walker.
     *
     * @param {NormalizedRow} row
     * @param {string}        colKey
     * @returns {string}
     */
    _cellHTML(row, colKey) {
        return this._subRows(row, colKey).join(' ');
    }

    /**
     * Creates a sub-row element, optionally using ColumnDef.render for custom output.
     * Sort and filter always operate on the raw `text` value — render is display-only.
     *
     * @param {string}          text
     * @param {boolean}         hidden
     * @param {ColumnDef|null}  [col]
     * @param {NormalizedRow|null} [row]
     * @returns {HTMLElement}
     */
    _makeSubrow(text, hidden, col = null, row = null) {
        const div = document.createElement('div');
        div.className = hidden
            ? `${C.SUBROW} ${C.SUBROW_HIDDEN}`
            : C.SUBROW;

        if (col?.render) {
            const result = col.render(text, row);
            if (result instanceof Node) {
                div.appendChild(result);
            } else {
                div.textContent = String(result ?? text);
            }
        } else {
            const patterns = [
                this._colPatterns?.get(col?.key),
                this._globalPattern,
            ].filter(Boolean);

            if (patterns.length > 0) {
                this._applyHighlight(div, text, /** @type {RegExp[]} */ (patterns));
            } else {
                div.textContent = text;
            }
        }

        return div;
    }

    /**
     * Appends text content to div, wrapping matched substrings in
     * <mark class="st-highlight">. Handles multiple overlapping patterns.
     *
     * @param {HTMLElement} div
     * @param {string}      text
     * @param {RegExp[]}    patterns - All active highlight regexes (/g flag required).
     * @returns {void}
     */
    _applyHighlight(div, text, patterns) {
        // Collect all [start, end) match ranges across all patterns
        /** @type {number[][]} */
        const ranges = [];
        for (const re of patterns) {
            re.lastIndex = 0;
            let m;
            while ((m = re.exec(text)) !== null) {
                if (m[0].length === 0) {
                    re.lastIndex++;
                    continue;
                }
                ranges.push([m.index, m.index + m[0].length]);
            }
        }

        if (ranges.length === 0) {
            div.textContent = text;
            return;
        }

        // Sort and merge overlapping ranges
        ranges.sort((a, b) => a[0] - b[0]);
        const merged = [ranges[0].slice()];
        for (let i = 1; i < ranges.length; i++) {
            const last = merged[merged.length - 1];
            if (ranges[i][0] <= last[1]) {
                last[1] = Math.max(last[1], ranges[i][1]);
            } else {
                merged.push(ranges[i].slice());
            }
        }

        // Build DOM: plain TextNodes interleaved with <mark> elements
        let pos = 0;
        for (const [start, end] of merged) {
            if (pos < start) {
                div.appendChild(document.createTextNode(text.slice(pos, start)));
            }
            const mark = document.createElement('mark');
            mark.className = 'st-highlight';
            mark.textContent = text.slice(start, end);
            div.appendChild(mark);
            pos = end;
        }
        if (pos < text.length) {
            div.appendChild(document.createTextNode(text.slice(pos)));
        }
    }

    /**
     * Creates a labelled toggle button.
     *
     * @param {string}               label
     * @param {boolean}              initial
     * @param {function(boolean): void} onChange
     * @returns {HTMLElement}
     */
    _makeToggle(label, initial, onChange) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'st-toggle';
        btn.textContent = label;
        btn.setAttribute('aria-pressed', String(initial));
        btn.dataset.active = String(initial);

        btn.addEventListener('click', () => {
            const next = btn.dataset.active !== 'true';
            btn.dataset.active = String(next);
            btn.setAttribute('aria-pressed', String(next));
            onChange(next);
        });

        return btn;
    }
}
