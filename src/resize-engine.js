/**
 * @file resize-engine.js
 * @description Manages column width state for smarttable-lib.
 *
 *   Two resize modes:
 *     1. Auto-resize  — measures all cell text via an off-screen ruler,
 *                       picks the maximum per column (header vs all sub-rows),
 *                       clamps to [minWidth, maxWidth], writes to <col> elements.
 *     2. Manual drag  — header-border drag-to-resize using a three-state
 *                       machine: IDLE → DRAG_READY → DRAGGING.
 *
 *   Column widths are stored in a Map<colKey, number> (pixels) and applied
 *   exclusively via <colgroup>/<col> elements so that <td> cells are never
 *   touched directly.
 *
 *   Requires table-layout:fixed on the <table> element once any explicit
 *   width has been set; the engine sets this automatically.
 *
 * @version 1.4.0
 */

// ---------------------------------------------------------------------------
// CHANGELOG
// ---------------------------------------------------------------------------
// 1.0.0 — initial release
//         ResizeEngine class with autoResize(), attachDragHandlers(),
//         getColWidth(), setColWidth(), applyWidths() defined.
//         Off-screen ruler singleton created per engine instance.
//         Drag state machine: IDLE / DRAG_READY / DRAGGING.
// 1.0.1 — attach() now calls _applyWidths() after _ensureColgroup() so that
//         stored widths survive table-renderer re-renders (which replace thead
//         and tbody but keep the same table element and ResizeEngine instance).
// 1.1.0 — HEADER_CHROME_PX increased from 56 to 90 to budget for the
//         three-zone header (sort icons + collapse toggle + 📊 badge).
// 1.2.0 — resetWidths() public method: clears all stored widths and reverts
//         table to table-layout:auto (used by the Auto-size toggle button).
// 1.3.0 — HEADER_CHROME_PX increased from 90 to 120 so short-label columns
//         (Date, MM, DD) always show their full column name after auto-size.
//         Added COLLAPSE_CHROME_PX = 70 for the centre-zone collapse toggle;
//         autoResize() adds it when ColumnDef.collapsible is set.
// 1.4.0 — MAX_MEASURE_ROWS = 300: autoResize() now samples at most 300
//         display rows to prevent synchronous offsetWidth-reflow hangs on
//         large datasets (e.g. jungleland.it with 5000+ bootleg entries).
// ---------------------------------------------------------------------------

/**
 * @typedef {import('./types.js').ColumnDef}    ColumnDef
 * @typedef {import('./types.js').NormalizedRow} NormalizedRow
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Width of the drag handle zone at the right edge of each <th> (px). */
const HANDLE_ZONE_PX = 6;

/** Minimum column width enforced unless ColumnDef.minWidth overrides it. */
const DEFAULT_MIN_WIDTH = 60;

/** Extra padding added to measured text width (accounts for cell padding). */
const CELL_PADDING_PX = 24;

/**
 * Extra width budget added to the measured column-label text to arrive at the
 * minimum header width. Covers: 3 sort-icon buttons (~42 px at 11 px font) +
 * left-zone gaps (~12 px) + 📊 badge (~46 px) + inter-zone gap (6 px) = ~106 px.
 * Set to 120 px to leave a comfortable buffer for varying host-page font metrics.
 */
const HEADER_CHROME_PX = 120;

/**
 * Extra width budget for the centre-zone collapse toggle (▶/N/▤ or ◀/N/▤)
 * present only in collapsible columns: toggle widget (~56 px) + zone gap (6 px).
 */
const COLLAPSE_CHROME_PX = 70;

/**
 * Maximum number of display rows sampled during autoResize().
 * Each measurement forces a synchronous browser layout reflow (offsetWidth).
 * Capping at 300 keeps auto-resize fast even on large datasets (jungleland.it
 * has 5000+ entries; uncapped that would be 35 000 reflows → visible hang).
 * The first 300 rows are a good statistical sample for finding the widest cell.
 */
const MAX_MEASURE_ROWS = 300;

/** Drag states. */
const STATE = /** @type {const} */ ({
    IDLE:        'IDLE',
    DRAG_READY:  'DRAG_READY',
    DRAGGING:    'DRAGGING',
});

// ---------------------------------------------------------------------------
// ResizeEngine
// ---------------------------------------------------------------------------

export class ResizeEngine {
    /**
     * @param {ColumnDef[]} columnDefs
     */
    constructor(columnDefs) {
        /** @type {ColumnDef[]} */
        this._defs = columnDefs;

        /** @type {Map<string, number>} colKey → width in px */
        this._widths = new Map();

        /** @type {HTMLElement|null} Off-screen text ruler */
        this._ruler = null;

        /** @type {HTMLTableElement|null} */
        this._tableEl = null;

        /** @type {HTMLTableColElement[]|null} One per column */
        this._colEls = null;

        // Drag state
        this._dragState = STATE.IDLE;

        /** @type {string|null} colKey being dragged */
        this._dragColKey = null;

        /** @type {number} clientX at drag start */
        this._dragStartX = 0;

        /** @type {number} column width at drag start (px) */
        this._dragStartWidth = 0;

        // Bound event handlers (stored so they can be removed)
        this._onMouseMove = this._handleMouseMove.bind(this);
        this._onMouseUp   = this._handleMouseUp.bind(this);
    }

    // -------------------------------------------------------------------------
    // Attach to a rendered table
    // -------------------------------------------------------------------------

    /**
     * Attaches the engine to a rendered <table> element.
     * Creates a <colgroup> with one <col> per column and sets table-layout:auto
     * initially (switches to fixed after first resize).
     *
     * @param {HTMLTableElement} tableEl
     * @returns {void}
     */
    attach(tableEl) {
        this._tableEl = tableEl;
        this._ensureColgroup();
        this._ensureRuler(tableEl);
        this._applyWidths();
    }

    /**
     * Detaches the engine, removes global event listeners and the ruler.
     *
     * @returns {void}
     */
    detach() {
        this._cleanupDragListeners();
        this._ruler?.remove();
        this._ruler = null;
        this._tableEl = null;
        this._colEls = null;
    }

    // -------------------------------------------------------------------------
    // Auto-resize
    // -------------------------------------------------------------------------

    /**
     * Measures all column content and sets each column to its optimal width.
     * For multi-row cells the longest sub-row string wins.
     * Clamps to [ColumnDef.minWidth ?? DEFAULT_MIN_WIDTH, ColumnDef.maxWidth].
     *
     * @param {NormalizedRow[]} rows        - Full (unfiltered) row data.
     * @param {NormalizedRow[]} displayRows - Currently visible rows (filtered + sorted).
     *   Measurement uses displayRows so auto-size matches what the user sees.
     * @returns {void}
     */
    autoResize(rows, displayRows) {
        if (!this._ruler || !this._tableEl) {
            return;
        }

        // Match ruler font to the table's computed style
        const tableStyle = window.getComputedStyle(this._tableEl);
        this._ruler.style.font = tableStyle.font;

        // Cap the sample to avoid thousands of synchronous offsetWidth reflows
        // on large datasets.  First MAX_MEASURE_ROWS rows are a reliable sample
        // for finding the widest content in most real-world datasets.
        const sampleRows = displayRows.length > MAX_MEASURE_ROWS
            ? displayRows.slice(0, MAX_MEASURE_ROWS)
            : displayRows;

        for (const def of this._defs) {
            const minW = def.minWidth ?? DEFAULT_MIN_WIDTH;
            const maxW = def.maxWidth ?? Infinity;

            // Measure header text + chrome (sort icons, badge, optional collapse toggle)
            const collapseExtra = def.collapsible ? COLLAPSE_CHROME_PX : 0;
            let maxPx = this._measureText(def.label) + HEADER_CHROME_PX + collapseExtra;

            // Measure sampled cell sub-rows
            for (const row of sampleRows) {
                const subRows = this._subRows(row, def.key);
                for (const text of subRows) {
                    const w = this._measureText(text) + CELL_PADDING_PX;
                    if (w > maxPx) {
                        maxPx = w;
                    }
                }
            }

            const clamped = Math.min(Math.max(maxPx, minW), maxW);
            this._widths.set(def.key, clamped);
        }

        this._applyWidths();
    }

    // -------------------------------------------------------------------------
    // Manual drag resize — header event attachment
    // -------------------------------------------------------------------------

    /**
     * Attaches drag-resize handlers to a single <th> element.
     * The draggable zone is the rightmost HANDLE_ZONE_PX of the header cell.
     *
     * @param {HTMLTableCellElement} thEl
     * @param {string}               colKey
     * @returns {void}
     */
    attachDragHandlers(thEl, colKey) {
        thEl.addEventListener('mousemove', (e) => {
            if (this._dragState === STATE.DRAGGING) {
                return;
            }
            if (this._isInHandleZone(e, thEl)) {
                thEl.style.cursor = 'col-resize';
                this._dragState  = STATE.DRAG_READY;
                this._dragColKey = colKey;
            } else {
                if (this._dragState === STATE.DRAG_READY
                        && this._dragColKey === colKey) {
                    thEl.style.cursor = '';
                    this._dragState  = STATE.IDLE;
                    this._dragColKey = null;
                }
            }
        });

        thEl.addEventListener('mouseleave', () => {
            if (this._dragState === STATE.DRAG_READY) {
                thEl.style.cursor = '';
                this._dragState  = STATE.IDLE;
                this._dragColKey = null;
            }
        });

        thEl.addEventListener('mousedown', (e) => {
            if (this._dragState !== STATE.DRAG_READY) {
                return;
            }
            e.preventDefault();

            this._dragState      = STATE.DRAGGING;
            this._dragStartX     = e.clientX;
            this._dragStartWidth = this._widths.get(colKey)
                ?? thEl.offsetWidth;

            document.addEventListener('mousemove', this._onMouseMove);
            document.addEventListener('mouseup',   this._onMouseUp);

            // Prevent text selection during drag
            document.body.style.userSelect = 'none';
        });
    }

    // -------------------------------------------------------------------------
    // Width accessors
    // -------------------------------------------------------------------------

    /**
     * Returns the stored width for a column in px, or null if not yet set.
     *
     * @param {string} colKey
     * @returns {number|null}
     */
    getColWidth(colKey) {
        return this._widths.get(colKey) ?? null;
    }

    /**
     * Sets a column width explicitly and applies it immediately.
     *
     * @param {string} colKey
     * @param {number} widthPx
     * @returns {void}
     */
    setColWidth(colKey, widthPx) {
        const def  = this._defs.find(d => d.key === colKey);
        const minW = def?.minWidth ?? DEFAULT_MIN_WIDTH;
        const maxW = def?.maxWidth ?? Infinity;
        this._widths.set(colKey, Math.min(Math.max(widthPx, minW), maxW));
        this._applyWidths();
    }

    /**
     * Clears all stored column widths and reverts the table to
     * table-layout:auto so the browser recomputes natural widths.
     * Used by the Auto-size toggle button to restore the initial layout.
     *
     * @returns {void}
     */
    resetWidths() {
        this._widths.clear();
        if (this._tableEl) {
            this._tableEl.style.tableLayout = 'auto';
        }
        if (this._colEls) {
            for (const col of this._colEls) {
                col.style.width = '';
            }
        }
    }

    // -------------------------------------------------------------------------
    // Colgroup management
    // -------------------------------------------------------------------------

    /**
     * Re-applies stored widths to the <col> elements.
     * Switches the table to table-layout:fixed on first call.
     *
     * @returns {void}
     */
    _applyWidths() {
        if (!this._tableEl || !this._colEls) {
            return;
        }

        this._tableEl.style.tableLayout = 'fixed';

        this._defs.forEach((def, i) => {
            const w = this._widths.get(def.key);
            if (w !== undefined && this._colEls) {
                this._colEls[i].style.width = `${w}px`;
            }
        });
    }

    /**
     * Creates (or replaces) a <colgroup> inside the table with one <col>
     * per column definition.
     *
     * @returns {void}
     */
    _ensureColgroup() {
        if (!this._tableEl) {
            return;
        }

        const existing = this._tableEl.querySelector('colgroup');
        if (existing) {
            existing.remove();
        }

        const colgroup = document.createElement('colgroup');
        this._colEls = this._defs.map(() => {
            const col = document.createElement('col');
            colgroup.appendChild(col);
            return col;
        });

        // Insert before <thead>
        const thead = this._tableEl.querySelector('thead');
        this._tableEl.insertBefore(colgroup, thead ?? null);
    }

    // -------------------------------------------------------------------------
    // Off-screen ruler
    // -------------------------------------------------------------------------

    /**
     * Creates the off-screen ruler element and appends it to the table's
     * parent so it inherits the same CSS context.
     *
     * @param {HTMLTableElement} tableEl
     * @returns {void}
     */
    _ensureRuler(tableEl) {
        if (this._ruler) {
            return;
        }

        const ruler = document.createElement('span');
        ruler.setAttribute('aria-hidden', 'true');
        ruler.style.cssText = [
            'position:absolute',
            'visibility:hidden',
            'white-space:nowrap',
            'pointer-events:none',
            'top:-9999px',
            'left:-9999px',
        ].join(';');

        (tableEl.parentElement ?? document.body).appendChild(ruler);
        this._ruler = ruler;
    }

    /**
     * Measures the rendered pixel width of a text string using the ruler.
     *
     * @param {string} text
     * @returns {number} Width in px.
     */
    _measureText(text) {
        if (!this._ruler) {
            return 0;
        }
        this._ruler.textContent = text;
        return this._ruler.offsetWidth;
    }

    // -------------------------------------------------------------------------
    // Drag handlers
    // -------------------------------------------------------------------------

    /**
     * @param {MouseEvent} e
     * @returns {void}
     */
    _handleMouseMove(e) {
        if (this._dragState !== STATE.DRAGGING || !this._dragColKey) {
            return;
        }

        const delta    = e.clientX - this._dragStartX;
        const newWidth = this._dragStartWidth + delta;
        this.setColWidth(this._dragColKey, newWidth);
    }

    /**
     * @returns {void}
     */
    _handleMouseUp() {
        if (this._dragState !== STATE.DRAGGING) {
            return;
        }

        this._dragState  = STATE.IDLE;
        this._dragColKey = null;
        document.body.style.userSelect = '';
        this._cleanupDragListeners();
    }

    /**
     * @returns {void}
     */
    _cleanupDragListeners() {
        document.removeEventListener('mousemove', this._onMouseMove);
        document.removeEventListener('mouseup',   this._onMouseUp);
    }

    // -------------------------------------------------------------------------
    // Private helpers
    // -------------------------------------------------------------------------

    /**
     * Returns true if the mouse event is within the rightmost HANDLE_ZONE_PX
     * of the given <th> element.
     *
     * @param {MouseEvent}           e
     * @param {HTMLTableCellElement} thEl
     * @returns {boolean}
     */
    _isInHandleZone(e, thEl) {
        return e.offsetX > thEl.offsetWidth - HANDLE_ZONE_PX;
    }

    /**
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
}
