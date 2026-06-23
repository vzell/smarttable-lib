/**
 * @file table-renderer.js
 * @description Main table renderer. Wires CollapseEngine, SortEngine,
 *   FilterEngine, and Dropdown together into a fully interactive HTML table.
 *
 *   Rendering lifecycle:
 *     1. inject() — create table skeleton + inject trigger button on the page
 *     2. render() — build thead/tbody from current data + filter/sort/collapse state
 *     3. re-render() — called after any state change (filter, sort, collapse toggle)
 * @version 1.6.4
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
// 1.2.0 — derived column support
//         _expandRow() pre-computes ColumnDef.derive(sourceValue) values.
// 1.3.x — ColumnDef.render callback; permanent filter row; match highlighting;
//          full ResizeEngine wiring; type="button" on every created button.
// 1.4.0 — permanent filter row + match highlighting
// 1.5.0 — value-group shading (st-shade-a/b) replaces position-change flash.
// 1.6.2 — Bug fixes: (1) sort icons wrapped in st-sort-icons group so ⇅▲▼
//          render with no gap between them; (2) dropdown re-positioned using
//          position:absolute + scrollX/Y so it anchors to the badge on pages
//          with CSS transform on ancestors (which breaks position:fixed).
// 1.6.4 — Bug fix: _buildTh() adds st-th-inner--collapsible modifier class only
//          on collapsible columns so the CSS grid (1fr auto 1fr) for centred
//          toggle is not applied to non-collapsible columns (which would cause
//          the left zone to lose half its space and clip the column label).
// 1.6.3 — Bug fixes: (1) Toggle highlights button text changes between
//          "Hide highlights" / "Show highlights" to reflect current state.
//          (2) Cell collapse toggle is now inline with the FIRST sub-row
//          (inside st-cell-first-row flex wrapper) instead of a separate row
//          below all content.
//          (3) ▲/▼ sort click now clears the entire sort stack before adding
//          the clicked column; Shift+click retains multi-sort behaviour.
//          (4) _makeSortIcon() forwards the MouseEvent to the callback.
// 1.6.1 — Bug fixes: (1) auto-size on initial render so headers always show
//          optimal widths; (2) Auto-size button is now a toggle between optimal
//          widths and natural browser widths; (3) all interactive elements have
//          descriptive, state-aware title (tooltip) attributes; (4) dropdown
//          positioned via position:fixed + viewport coords so viewport never
//          jumps when opening the 📊 unique-values dropdown.
// 1.6.0 — ShowAllEntityData-inspired UI overhaul:
//          Three-zone header flex layout (st-th-inner / left / centre / right).
//          Three sort-icon buttons per header (⇅ ▲ ▼); active button gets
//          st-sort-icon-active + Unicode superscript priority; ⇅ removes column.
//          Per-priority per-column TD shading (st-mscol-{P}a/b) replaces old
//          TR-level st-shade-a / st-shade-b. Header TH tinted by priority.
//          {count}📊 badge (st-uniq-badge) in right zone replaces ⧨/⧩ button.
//          Collapse toggle moved to centre zone; glyph format ▶/N/▤ / ◀/N/▤.
//          Data cell toggle moved to bottom-right flex row (st-cell-toggle-row).
//          Event delegation on <table> for all cell-toggle clicks (one listener).
//          Cc/Rx/Ex checkbox modifiers on global bar and per-column filter row.
//          ✕ clear button + Escape key on all filter inputs.
//          Four toolbar action buttons: Expand/Collapse ALL, Toggle HL,
//          Clear ALL column filters, Clear ALL filters.
//          DocumentFragment batching in _buildTbody().
//          _applyHighlight() two-color: st-highlight (global) vs st-col-highlight
//          (column); character-level Uint8Array marks global-wins priority.
//          FilterState.globalIsRegex respected (default false = literal).
//          st-wrapper.st-no-highlight CSS hook hides marks without rerender.
// ---------------------------------------------------------------------------

import { CollapseEngine }                          from './collapse-engine.js';
import { FilterEngine, buildHighlightPattern }     from './filter-engine.js';
import { SortEngine, SUPERSCRIPT_DIGITS }          from './sort-engine.js';
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
    TH_COLLAPSE:    'st-th-collapse',
    TBODY:          'st-tbody',
    TR:             'st-tr',
    TD:             'st-td',
    TD_INNER:       'st-td-inner',
    SUBROW:         'st-subrow',
    SUBROW_HIDDEN:  'st-subrow--hidden',
    CELL_TOGGLE:    'st-cell-toggle',
    FILTER_ACTIVE:  'st-th--filter-active',
    SORT_ACTIVE:    'st-th--sort-active',
    BTN_TRIGGER:    'st-btn-trigger',
    BTN_AUTO_RESIZE:'st-btn-auto-resize',
    WRAPPER:        'st-wrapper',
    GLOBAL_BAR:     'st-global-bar',
    FILTER_ROW:     'st-filter-row',
    FILTER_TH:      'st-filter-th',
    FILTER_INPUT:   'st-filter-input',
};

// 8 hue pairs for per-priority TD tinting (a = 0.22 α, b = 0.44 α)
const SHADE_PAIRS = [
    ['st-mscol-0a', 'st-mscol-0b'],
    ['st-mscol-1a', 'st-mscol-1b'],
    ['st-mscol-2a', 'st-mscol-2b'],
    ['st-mscol-3a', 'st-mscol-3b'],
    ['st-mscol-4a', 'st-mscol-4b'],
    ['st-mscol-5a', 'st-mscol-5b'],
    ['st-mscol-6a', 'st-mscol-6b'],
    ['st-mscol-7a', 'st-mscol-7b'],
];

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
            tableClass:     C.TABLE,
            shadingEnabled: true,
            stickyHeader:   true,
            ...options,
        };

        this._collapse = new CollapseEngine();
        this._sort     = new SortEngine(columns);
        this._filter   = new FilterEngine(columns);
        this._resize   = new ResizeEngine(columns);

        // Pre-compute derived column values so all engines see them
        this._rows = rows.map(row => this._expandRow(row));

        /** @type {FilterState} */
        this._filterState = {
            globalRegex:        '',
            globalIsRegex:      false,
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

        // DOM references for the persistent global bar controls
        /** @type {HTMLInputElement|null} */
        this._globalInput = null;
        /** @type {HTMLInputElement|null} */
        this._globalCcCb = null;
        /** @type {HTMLInputElement|null} */
        this._globalRxCb = null;
        /** @type {HTMLInputElement|null} */
        this._globalExCb = null;
        /** @type {HTMLButtonElement|null} */
        this._autoSizeBtn = null;
        /** True when optimal column widths are currently applied. */
        this._autoSized = false;

        // Pre-compute unique value counts (stable — rows never change after construction)
        /** @type {Map<string, number>} */
        this._uniqueCounts = new Map(
            columns
                .filter(c => c.filterable !== false)
                .map(c => [c.key, this._filter.buildUniqueValues(this._rows, c.key).length])
        );

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
     *
     * @returns {void}
     */
    inject() {
        const btn = document.createElement('button');
        btn.type = 'button';
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

        // Single delegated listener on the table for ALL cell-toggle clicks.
        // Lives on this._tableEl (not tbody) so it survives rerenders.
        this._tableEl.addEventListener('click', (e) => {
            const btn = /** @type {HTMLElement|null} */ (
                e.target instanceof HTMLElement
                    ? e.target.closest(`.${C.CELL_TOGGLE}`)
                    : null
            );
            if (!btn) return;
            const colKey  = btn.dataset.colkey;
            const origIdx = parseInt(btn.dataset.origidx ?? '', 10);
            if (colKey && !isNaN(origIdx)) {
                this._collapse.toggleCell(colKey, origIdx);
                this._rerender();
            }
        });

        // Attach after wrapper is in DOM so ruler inherits CSS context
        this._resize.attach(this._tableEl);

        // Seed any explicit widths declared on column definitions
        for (const col of this._columns) {
            if (col.width) {
                const px = parseFloat(col.width);
                if (px > 0) {
                    this._resize.setColWidth(col.key, px);
                }
            }
        }

        // Auto-size immediately so every column starts at optimal width
        const displayRows = this._displayIdxs.map(i => this._rows[i]);
        this._resize.autoResize(this._rows, displayRows);
        this._autoSized = true;
        if (this._autoSizeBtn) {
            this._autoSizeBtn.textContent = 'Reset width';
            this._autoSizeBtn.title = 'Revert to natural column widths (browser-computed)';
        }
    }

    /**
     * Builds the global filter bar shown above the table.
     * Stores checkbox DOM references on `this` for later reset operations.
     *
     * @returns {HTMLElement}
     */
    _buildGlobalBar() {
        const bar = document.createElement('div');
        bar.className = C.GLOBAL_BAR;

        // ---- Input + inset ✕ ----
        const inputWrap = document.createElement('div');
        inputWrap.className = 'st-input-wrap';

        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = 'Filter…';
        input.className = 'st-global-input';
        input.setAttribute('aria-label', 'Global filter');
        input.title = 'Filter all columns — press Escape to clear';
        input.value = this._filterState.globalRegex;
        this._globalInput = input;

        const clearBtn = document.createElement('button');
        clearBtn.type = 'button';
        clearBtn.className = 'st-clear-btn';
        clearBtn.textContent = '✕';
        clearBtn.title = 'Clear global filter';
        clearBtn.addEventListener('click', () => {
            input.value = '';
            this._filterState.globalRegex = '';
            this._rerender();
        });

        input.addEventListener('input', () => {
            this._filterState.globalRegex = input.value;
            this._rerender();
        });

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                input.value = '';
                this._filterState.globalRegex = '';
                this._rerender();
            }
        });

        inputWrap.appendChild(input);
        inputWrap.appendChild(clearBtn);

        // ---- Cc / Rx / Ex checkboxes ----
        const { element: ccEl, checkbox: ccCb } = this._makeCheckbox(
            'Cc', 'Case-sensitive matching — when checked, uppercase and lowercase are treated as distinct',
            this._filterState.globalRegexCase,
            (val) => { this._filterState.globalRegexCase = val; this._rerender(); }
        );
        this._globalCcCb = ccCb;

        const { element: rxEl, checkbox: rxCb } = this._makeCheckbox(
            'Rx', 'Regex mode — when checked, the filter text is compiled as a JavaScript regular expression; when unchecked, it is matched literally',
            this._filterState.globalIsRegex ?? false,
            (val) => { this._filterState.globalIsRegex = val; this._rerender(); }
        );
        this._globalRxCb = rxCb;

        const { element: exEl, checkbox: exCb } = this._makeCheckbox(
            'Ex', 'Exclude mode — when checked, rows that match the filter are hidden instead of shown',
            this._filterState.globalRegexExclude,
            (val) => { this._filterState.globalRegexExclude = val; this._rerender(); }
        );
        this._globalExCb = exCb;

        // ---- Auto-size toggle button ----
        const autoSizeBtn = document.createElement('button');
        autoSizeBtn.type = 'button';
        autoSizeBtn.className = C.BTN_AUTO_RESIZE;
        autoSizeBtn.textContent = 'Auto-size';
        autoSizeBtn.title = 'Fit each column to its widest content';
        this._autoSizeBtn = autoSizeBtn;
        autoSizeBtn.addEventListener('click', () => {
            if (this._autoSized) {
                this._resize.resetWidths();
                this._autoSized = false;
                autoSizeBtn.textContent = 'Auto-size';
                autoSizeBtn.title = 'Fit each column to its widest content';
            } else {
                const displayRows = this._displayIdxs.map(i => this._rows[i]);
                this._resize.autoResize(this._rows, displayRows);
                this._autoSized = true;
                autoSizeBtn.textContent = 'Reset width';
                autoSizeBtn.title = 'Revert to natural column widths (browser-computed)';
            }
        });

        // ---- Expand / Collapse ALL ----
        const expandAllBtn = document.createElement('button');
        expandAllBtn.type = 'button';
        expandAllBtn.className = 'st-btn-expand-all';
        const _updateExpandBtn = () => {
            const collapsed = this._anyCollapsed();
            expandAllBtn.textContent = collapsed ? 'Expand all' : 'Collapse all';
            expandAllBtn.title = collapsed
                ? 'Expand all multi-row cells in every collapsible column'
                : 'Collapse all multi-row cells in every collapsible column';
        };
        _updateExpandBtn();
        expandAllBtn.addEventListener('click', () => {
            const shouldExpand = this._anyCollapsed();
            const wantCollapsed = !shouldExpand;
            for (const col of this._columns) {
                if (!col.collapsible) continue;
                const state = this._collapse.getState(col.key);
                if (state && state.columnCollapsed !== wantCollapsed) {
                    this._collapse.toggleColumn(col.key);
                }
            }
            _updateExpandBtn();
            this._rerender();
        });

        // ---- Toggle ALL highlighting ----
        const toggleHlBtn = document.createElement('button');
        toggleHlBtn.type = 'button';
        toggleHlBtn.className = 'st-btn-toggle-hl';
        const _updateHlBtn = (hidden) => {
            toggleHlBtn.textContent = hidden ? 'Show highlights' : 'Hide highlights';
            toggleHlBtn.title = hidden
                ? 'Highlights are hidden — click to show match marks again'
                : 'Hide all filter match highlights without re-running the filter';
        };
        _updateHlBtn(false);  // initial: highlights on
        toggleHlBtn.addEventListener('click', () => {
            this._wrapper?.classList.toggle('st-no-highlight');
            _updateHlBtn(this._wrapper?.classList.contains('st-no-highlight') ?? false);
        });

        // ---- Clear ALL column filters ----
        const clearColBtn = document.createElement('button');
        clearColBtn.type = 'button';
        clearColBtn.className = 'st-btn-clear-col-filters';
        clearColBtn.textContent = 'Clear col filters';
        clearColBtn.title = 'Reset every column-level filter input and dropdown selection';
        clearColBtn.addEventListener('click', () => {
            this._filterState.columnFilters = this._columns.map(c => emptyColumnFilter(c.key));
            this._rerender();
        });

        // ---- Clear ALL filters ----
        const clearAllBtn = document.createElement('button');
        clearAllBtn.type = 'button';
        clearAllBtn.className = 'st-btn-clear-all-filters';
        clearAllBtn.textContent = 'Clear all filters';
        clearAllBtn.title = 'Reset all filters — global input, Cc/Rx/Ex checkboxes, and all column filters';
        clearAllBtn.addEventListener('click', () => {
            this._filterState.globalRegex        = '';
            this._filterState.globalIsRegex      = false;
            this._filterState.globalRegexCase    = false;
            this._filterState.globalRegexExclude = false;
            this._filterState.columnFilters      = this._columns.map(c => emptyColumnFilter(c.key));
            // Reset the persistent global bar controls directly
            if (this._globalInput)  this._globalInput.value  = '';
            if (this._globalCcCb)   this._globalCcCb.checked = false;
            if (this._globalRxCb)   this._globalRxCb.checked = false;
            if (this._globalExCb)   this._globalExCb.checked = false;
            this._rerender();
        });

        bar.appendChild(inputWrap);
        bar.appendChild(ccEl);
        bar.appendChild(rxEl);
        bar.appendChild(exEl);
        bar.appendChild(autoSizeBtn);
        bar.appendChild(expandAllBtn);
        bar.appendChild(toggleHlBtn);
        bar.appendChild(clearColBtn);
        bar.appendChild(clearAllBtn);
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
     * Builds the permanent filter row: a second <tr> in <thead> with a text input,
     * Cc/Rx/Ex checkboxes, and ✕/Escape clear per filterable column.
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

                // Input + ✕ wrap
                const inputWrap = document.createElement('div');
                inputWrap.className = 'st-input-wrap';

                const input = document.createElement('input');
                input.type = 'text';
                input.className = C.FILTER_INPUT;
                input.dataset.colkey = col.key;
                input.placeholder = col.label;
                input.title = `Filter ${col.label} — press Escape to clear`;
                input.value = cf.regex;

                const colClearBtn = document.createElement('button');
                colClearBtn.type = 'button';
                colClearBtn.className = 'st-clear-btn';
                colClearBtn.textContent = '✕';
                colClearBtn.title = `Clear ${col.label} filter`;
                colClearBtn.addEventListener('click', () => {
                    this._setColumnFilter({
                        ...this._getColumnFilter(col.key),
                        regex: '',
                    });
                    this._rerender();
                });

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

                input.addEventListener('keydown', (e) => {
                    if (e.key === 'Escape') {
                        this._setColumnFilter({
                            ...this._getColumnFilter(col.key),
                            regex: '',
                        });
                        this._rerender();
                    }
                });

                inputWrap.appendChild(input);
                inputWrap.appendChild(colClearBtn);

                // Cc / Rx / Ex modifier checkboxes
                const mods = document.createElement('div');
                mods.className = 'st-filter-mods';

                const { element: ccEl } = this._makeCheckbox(
                    'Cc', `Case-sensitive — when checked, ${col.label} filter distinguishes uppercase from lowercase`,
                    cf.regexCase ?? false,
                    (val) => {
                        this._setColumnFilter({
                            ...this._getColumnFilter(col.key),
                            regexCase: val,
                        });
                        this._rerender();
                    }
                );

                const { element: rxEl } = this._makeCheckbox(
                    'Rx', `Regex mode — when checked, ${col.label} filter text is compiled as a JavaScript regular expression`,
                    cf.isRegex ?? false,
                    (val) => {
                        this._setColumnFilter({
                            ...this._getColumnFilter(col.key),
                            isRegex: val,
                        });
                        this._rerender();
                    }
                );

                const { element: exEl } = this._makeCheckbox(
                    'Ex', `Exclude mode — when checked, rows matching the ${col.label} filter are hidden`,
                    cf.regexExclude ?? false,
                    (val) => {
                        this._setColumnFilter({
                            ...this._getColumnFilter(col.key),
                            regexExclude: val,
                        });
                        this._rerender();
                    }
                );

                mods.appendChild(ccEl);
                mods.appendChild(rxEl);
                mods.appendChild(exEl);

                th.appendChild(inputWrap);
                th.appendChild(mods);
            }

            tr.appendChild(th);
        }

        return tr;
    }

    /**
     * Builds a single <th> element using the three-zone flex layout.
     * Left: column label + sort icons. Centre: collapse toggle. Right: 📊 badge.
     *
     * @param {ColumnDef} col
     * @returns {HTMLTableCellElement}
     */
    _buildTh(col) {
        const th = document.createElement('th');
        th.className = C.TH;

        const sortStack  = this._sort.getStack();
        const sortEntry  = sortStack.find(e => e.colKey === col.key);
        const cf         = this._getColumnFilter(col.key);
        const hasFilter  = cf.metaEntries.length > 0
            || cf.valueEntries.length > 0
            || cf.regex.trim() !== '';

        if (sortEntry) {
            th.classList.add(C.SORT_ACTIVE);
            if (this._options.shadingEnabled !== false) {
                th.classList.add(`st-mscol-hdr-${sortEntry.priority % 8}`);
            }
        }
        if (hasFilter) th.classList.add(C.FILTER_ACTIVE);

        // Three-zone container: grid for collapsible columns (centres the toggle),
        // plain flex for all others (left zone gets the full remaining width)
        const inner = document.createElement('div');
        inner.className = col.collapsible
            ? 'st-th-inner st-th-inner--collapsible'
            : 'st-th-inner';

        // ---- LEFT zone: label + sort icons ----
        const left = document.createElement('div');
        left.className = 'st-th-left';

        const labelEl = document.createElement('span');
        labelEl.className = C.TH_LABEL;
        labelEl.textContent = col.label;
        left.appendChild(labelEl);

        if (col.sortable !== false) {
            const priSuffix = sortEntry
                ? (SUPERSCRIPT_DIGITS[sortEntry.priority] ?? '')
                : '';
            const priLabel = sortEntry
                ? ` (priority ${sortEntry.priority + 1})`
                : '';

            const clearSortTitle = sortEntry
                ? `Remove ${col.label} from sort${priLabel}`
                : `${col.label} is not currently sorted`;
            const clearSortBtn = this._makeSortIcon('⇅', clearSortTitle, (_e) => {
                this._sort.removeSort(col.key);
                this._rerender();
            });

            const ascActive = sortEntry?.direction === 'asc';
            const ascTitle = ascActive
                ? `${col.label}: sorting ascending${priLabel} — click to re-sort; Shift+click to add to multi-sort`
                : `Sort ${col.label} ascending (Shift+click to add to multi-sort)`;
            const ascBtn = this._makeSortIcon(
                '▲' + (ascActive ? priSuffix : ''),
                ascTitle,
                (e) => {
                    if (!e.shiftKey) this._sort.clearSort();
                    this._sort.pushSort(col.key, 'asc');
                    this._rerender();
                }
            );
            if (ascActive) ascBtn.classList.add('st-sort-icon-active');

            const descActive = sortEntry?.direction === 'desc';
            const descTitle = descActive
                ? `${col.label}: sorting descending${priLabel} — click to re-sort; Shift+click to add to multi-sort`
                : `Sort ${col.label} descending (Shift+click to add to multi-sort)`;
            const descBtn = this._makeSortIcon(
                '▼' + (descActive ? priSuffix : ''),
                descTitle,
                (e) => {
                    if (!e.shiftKey) this._sort.clearSort();
                    this._sort.pushSort(col.key, 'desc');
                    this._rerender();
                }
            );
            if (descActive) descBtn.classList.add('st-sort-icon-active');

            // Wrap the three icons in a tight group (no gap between ⇅ ▲ ▼)
            const sortGroup = document.createElement('span');
            sortGroup.className = 'st-sort-icons';
            sortGroup.appendChild(clearSortBtn);
            sortGroup.appendChild(ascBtn);
            sortGroup.appendChild(descBtn);
            left.appendChild(sortGroup);
        }

        inner.appendChild(left);

        // ---- CENTRE zone: column-level collapse toggle ----
        if (col.collapsible) {
            const centre = document.createElement('div');
            centre.className = 'st-th-centre';

            const collapseLabel = this._collapse.getHeaderLabel(col.key);
            if (collapseLabel) {
                const collapseState = this._collapse.getState(col.key);
                const collapseBtn = document.createElement('button');
                collapseBtn.type = 'button';
                collapseBtn.className = C.TH_COLLAPSE;
                const isColCollapsed = collapseState?.columnCollapsed;
                collapseBtn.title = isColCollapsed
                    ? `Expand all multi-row cells in ${col.label}`
                    : `Collapse all multi-row cells in ${col.label} to peek rows only`;
                collapseBtn.setAttribute('aria-label',
                    `Toggle collapse for column ${col.label}`);
                collapseBtn.textContent = collapseLabel;
                collapseBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this._collapse.toggleColumn(col.key);
                    this._rerender();
                });
                centre.appendChild(collapseBtn);
            }

            inner.appendChild(centre);
        }

        // ---- RIGHT zone: unique-values badge ----
        if (col.filterable !== false) {
            const right = document.createElement('div');
            right.className = 'st-th-right';

            const uniqueCount = this._uniqueCounts.get(col.key) ?? 0;
            const badge = document.createElement('button');
            badge.type = 'button';
            badge.className = 'st-uniq-badge';
            badge.title = `Open value-filter dropdown for ${col.label} (${uniqueCount} unique value${uniqueCount === 1 ? '' : 's'})`;
            badge.setAttribute('aria-label',
                `Filter column ${col.label} — ${uniqueCount} unique values`);
            badge.textContent = `${uniqueCount}📊`;
            badge.addEventListener('click', (e) => {
                e.stopPropagation();
                this._toggleDropdown(col, e);
            });

            right.appendChild(badge);
            inner.appendChild(right);
        }

        th.appendChild(inner);
        this._resize.attachDragHandlers(th, col.key);
        return th;
    }

    // -------------------------------------------------------------------------
    // Tbody
    // -------------------------------------------------------------------------

    /**
     * Builds the <tbody> for the current display indices.
     * Uses a DocumentFragment for a single DOM append operation.
     * Calls _applyColumnShading() after all TRs are built.
     *
     * @returns {HTMLTableSectionElement}
     */
    _buildTbody() {
        // Pre-compute highlight patterns once
        this._globalPattern = buildHighlightPattern(
            this._filterState.globalRegex,
            this._filterState.globalIsRegex ?? false,
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

        // Filter then sort
        const filtered = this._filter.filter(
            this._rows,
            this._allIdxs,
            this._filterState
        );
        this._displayIdxs = this._sort.sort(filtered, this._rows);

        const tbody = document.createElement('tbody');
        tbody.className = C.TBODY;
        const frag = document.createDocumentFragment();

        // Build all rows into a fragment, collecting TD references for shading
        const rowData = this._displayIdxs.map((origIdx) => {
            const row = this._rows[origIdx];
            const tr  = document.createElement('tr');
            tr.className = C.TR;
            tr.dataset.origIdx = String(origIdx);

            const tds = this._columns.map(col => {
                const td = this._buildTd(col, row, origIdx);
                tr.appendChild(td);
                return td;
            });

            frag.appendChild(tr);
            return { row, tds };
        });

        // Apply per-column per-priority TD shading
        if (this._options.shadingEnabled !== false) {
            this._applyColumnShading(rowData);
        }

        tbody.appendChild(frag);
        return tbody;
    }

    /**
     * Applies per-column per-priority TD tint classes (st-mscol-{P}a/b).
     * For each sorted column (in stack priority order), walks the TD column
     * and alternates shade on value changes.
     *
     * @param {Array<{row: NormalizedRow, tds: HTMLTableCellElement[]}>} rowData
     * @returns {void}
     */
    _applyColumnShading(rowData) {
        const stack = this._sort.getStack();
        if (!stack.length || !rowData.length) return;

        const colIdxMap = new Map(this._columns.map((c, i) => [c.key, i]));

        stack.forEach((entry, priorityIdx) => {
            const colIdx = colIdxMap.get(entry.colKey);
            if (colIdx === undefined) return;

            const [classA, classB] = SHADE_PAIRS[priorityIdx % SHADE_PAIRS.length];
            let shadeGroup = 0;
            const SENTINEL = {};
            let prevValue = /** @type {any} */ (SENTINEL);

            for (const { row, tds } of rowData) {
                const td = tds[colIdx];
                if (!td) continue;
                const rawVal = row[entry.colKey];
                const value  = Array.isArray(rawVal)
                    ? String(rawVal[0] ?? '')
                    : String(rawVal ?? '');
                if (prevValue !== SENTINEL && value !== prevValue) {
                    shadeGroup = 1 - shadeGroup;
                }
                prevValue = value;
                td.classList.add(shadeGroup === 0 ? classA : classB);
            }
        });
    }

    /**
     * Builds a single <td> element.
     * For collapsible multi-row cells, the collapse toggle is placed last
     * (in a flex row pushed to the right) rather than first, and uses
     * data attributes for event delegation instead of a per-button listener.
     *
     * @param {ColumnDef}    col
     * @param {NormalizedRow} row
     * @param {number}       origIdx    - Stable original row index.
     * @returns {HTMLTableCellElement}
     */
    _buildTd(col, row, origIdx) {
        const td = document.createElement('td');
        td.className = C.TD;

        // Inspect cell for FilterEngine meta cache
        const rawEl = document.createElement('div');
        rawEl.textContent = this._subRows(row, col.key).join(' ');
        const meta = inspectCell(rawEl);
        this._filter.setCellMeta(col.key, origIdx, meta);

        const inner = document.createElement('div');
        inner.className = C.TD_INNER;

        const subRows = this._subRows(row, col.key);

        if (!col.collapsible || subRows.length <= (col.peekRows ?? 1)) {
            for (const text of subRows) {
                inner.appendChild(this._makeSubrow(text, false, col, row));
            }
        } else {
            const collapsed = this._collapse.isCellCollapsed(col.key, origIdx);
            const peekRows  = col.peekRows ?? 1;
            const glyph     = this._collapse.getCellGlyph(
                col.key, origIdx, subRows.length
            );

            // Build the toggle button once (used inline with first sub-row)
            /** @type {HTMLButtonElement|null} */
            const toggleBtn = glyph ? (() => {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = C.CELL_TOGGLE;
                btn.setAttribute('aria-label', collapsed ? 'Expand cell' : 'Collapse cell');
                btn.textContent = glyph;
                btn.dataset.colkey  = col.key;
                btn.dataset.origidx = String(origIdx);
                return btn;
            })() : null;

            // Sub-rows: first row gets the toggle button inline at its right edge
            subRows.forEach((text, i) => {
                const hidden = collapsed && i >= peekRows;
                const subDiv = this._makeSubrow(text, hidden, col, row);

                if (i === 0 && toggleBtn) {
                    // Wrap first sub-row + toggle in a flex row so the toggle
                    // sits at the end of the first line of content
                    const firstRow = document.createElement('div');
                    firstRow.className = 'st-cell-first-row';
                    firstRow.appendChild(subDiv);
                    firstRow.appendChild(toggleBtn);
                    inner.appendChild(firstRow);
                } else {
                    inner.appendChild(subDiv);
                }
            });
        }

        td.appendChild(inner);
        return td;
    }

    // -------------------------------------------------------------------------
    // Re-render
    // -------------------------------------------------------------------------

    /**
     * Replaces thead and tbody with freshly built ones.
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

        // Re-attach so colgroup is rebuilt; stored widths are re-applied.
        this._resize.attach(this._tableEl);
    }

    // -------------------------------------------------------------------------
    // Dropdown management
    // -------------------------------------------------------------------------

    /**
     * Opens the filter dropdown for a column (or closes it if already open).
     * Positioned using document-absolute coordinates (getBoundingClientRect +
     * window.scrollY/X) so it works correctly even on pages that use CSS
     * `transform` on ancestors (which would break `position: fixed`).
     *
     * @param {ColumnDef} col
     * @param {MouseEvent} event - The click event from the 📊 badge button.
     * @returns {void}
     */
    _toggleDropdown(col, event) {
        if (this._openDropdown) {
            this._openDropdown.destroy();
            this._openDropdown = null;
            if (this._openDropdownColKey === col.key) {
                this._openDropdownColKey = null;
                return;
            }
        }

        const cf           = this._getColumnFilter(col.key);
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

        // Get the viewport rect of the badge button (event.currentTarget) —
        // more precise than the full <th> and always the element actually clicked.
        // Convert to document-absolute coordinates by adding window scroll offsets.
        // Using position:absolute (not fixed) avoids breakage on pages that apply
        // CSS transform to <body> or ancestor containers.
        const anchor = /** @type {HTMLElement} */ (event.currentTarget ?? event.target);
        const rect   = anchor.getBoundingClientRect();
        const scrollX = window.pageXOffset ?? window.scrollX ?? 0;
        const scrollY = window.pageYOffset ?? window.scrollY ?? 0;

        const dropEl = dropdown.build(document.body);
        dropEl.style.position = 'absolute';
        dropEl.style.top      = `${rect.bottom + scrollY + 2}px`;
        dropEl.style.left     = `${rect.left   + scrollX}px`;
        dropEl.style.zIndex   = '99999';

        this._openDropdown       = dropdown;
        this._openDropdownColKey = col.key;

        const closeHandler = (e) => {
            if (!dropEl.contains(e.target)) {
                dropdown.destroy();
                this._openDropdown       = null;
                this._openDropdownColKey = null;
                document.removeEventListener('click', closeHandler);
            }
        };
        setTimeout(() => document.addEventListener('click', closeHandler), 0);
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
     * Returns true if any collapsible column is currently collapsed.
     * Used by the Expand/Collapse ALL button to determine its action.
     *
     * @returns {boolean}
     */
    _anyCollapsed() {
        return this._columns.some(col => {
            if (!col.collapsible) return false;
            const state = this._collapse.getState(col.key);
            return state ? state.columnCollapsed : false;
        });
    }

    /**
     * Creates a sort icon <button> (⇅, ▲, or ▼).
     * The event is forwarded to the callback so callers can inspect modifiers
     * (e.g. Shift+click to add to multi-sort rather than replacing it).
     *
     * @param {string}                    glyph
     * @param {string}                    title
     * @param {function(MouseEvent): void} onClick
     * @returns {HTMLButtonElement}
     */
    _makeSortIcon(glyph, title, onClick) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'st-sort-icon';
        btn.title = title;
        btn.setAttribute('aria-label', title);
        btn.textContent = glyph;
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            onClick(e);
        });
        return btn;
    }

    /**
     * Creates a labelled checkbox widget (label element + checkbox input).
     * Returns both so callers can store the checkbox reference for reset.
     *
     * @param {string}               label
     * @param {string}               title
     * @param {boolean}              initial
     * @param {function(boolean): void} onChange
     * @returns {{ element: HTMLLabelElement, checkbox: HTMLInputElement }}
     */
    _makeCheckbox(label, title, initial, onChange) {
        const lab = document.createElement('label');
        lab.className = 'st-filter-checkbox';
        lab.title = title;

        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = initial;
        cb.addEventListener('change', () => onChange(cb.checked));

        lab.appendChild(cb);
        lab.appendChild(document.createTextNode(' ' + label));

        return { element: lab, checkbox: cb };
    }

    /**
     * Creates a sub-row element. Uses col.render when defined (display-only;
     * sort and filter operate on raw values). Otherwise highlights filter
     * matches with two distinct colors: st-highlight (global) and
     * st-col-highlight (column).
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
            const globalPat = this._globalPattern ?? null;
            const colPat    = col ? (this._colPatterns?.get(col.key) ?? null) : null;

            if (globalPat || colPat) {
                this._applyHighlight(div, text, globalPat, colPat);
            } else {
                div.textContent = text;
            }
        }

        return div;
    }

    /**
     * Appends text content to div, wrapping matched substrings in <mark>
     * elements with two priority levels:
     *   2 → st-highlight (global match, yellow)
     *   1 → st-col-highlight (column match, light blue)
     * Global matches take priority over column matches in overlapping regions.
     * Uses a character-level Uint8Array for correct overlap handling.
     *
     * @param {HTMLElement}  div
     * @param {string}       text
     * @param {RegExp|null}  globalPattern - /g flag required; may be null.
     * @param {RegExp|null}  colPattern    - /g flag required; may be null.
     * @returns {void}
     */
    _applyHighlight(div, text, globalPattern, colPattern) {
        if (!text.length) {
            div.textContent = '';
            return;
        }

        const n = text.length;
        const marks = new Uint8Array(n);
        let anyMark = false;

        const scan = (re, val) => {
            if (!re) return;
            re.lastIndex = 0;
            let m;
            while ((m = re.exec(text)) !== null) {
                if (m[0].length === 0) { re.lastIndex++; continue; }
                for (let k = m.index; k < m.index + m[0].length; k++) {
                    if (marks[k] < val) { marks[k] = val; anyMark = true; }
                }
            }
        };

        scan(colPattern, 1);
        scan(globalPattern, 2);

        if (!anyMark) {
            div.textContent = text;
            return;
        }

        let i = 0;
        while (i < n) {
            const v = marks[i];
            let j = i + 1;
            while (j < n && marks[j] === v) j++;
            const chunk = text.slice(i, j);
            if (v === 0) {
                div.appendChild(document.createTextNode(chunk));
            } else {
                const el = document.createElement('mark');
                el.className = v === 2 ? 'st-highlight' : 'st-col-highlight';
                el.textContent = chunk;
                div.appendChild(el);
            }
            i = j;
        }
    }
}
