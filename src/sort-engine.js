/**
 * @file sort-engine.js
 * @description Multi-column sort with a priority stack and per-cell previous-value
 *   tracking for shading. Comparators are dispatched by ColumnDef.type.
 *   Shading state is maintained across renders so the renderer can diff
 *   old vs new positions and apply CSS transition classes.
 * @version 1.0.1
 */

// ---------------------------------------------------------------------------
// CHANGELOG
// ---------------------------------------------------------------------------
// 1.0.0 — initial release
//         SortEngine class with sort(), pushSort(), removeSort(), clearSort(),
//         getShadingClass() defined.
// 1.0.1 — fix: shading never fired on the first sort click because _currValues
//          was empty, making _prevValues empty after the snapshot copy, causing
//          getShadingClass() to short-circuit (undefined check). Fix: seed
//          _currValues from the pre-sort positions for any column not yet
//          tracked before copying into _prevValues.
// ---------------------------------------------------------------------------

/**
 * @typedef {import('./types.js').ColumnDef}    ColumnDef
 * @typedef {import('./types.js').NormalizedRow} NormalizedRow
 * @typedef {import('./types.js').SortEntry}    SortEntry
 */

// ---------------------------------------------------------------------------
// Comparators by type
// ---------------------------------------------------------------------------

/** @type {Object.<string, function(string, string): number>} */
const COMPARATORS = {
    string: (a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }),

    number: (a, b) => {
        const na = parseFloat(a);
        const nb = parseFloat(b);
        const aNum = isNaN(na);
        const bNum = isNaN(nb);
        if (aNum && bNum) return 0;
        if (aNum) return 1;
        if (bNum) return -1;
        return na - nb;
    },

    date: (a, b) => {
        const da = Date.parse(a);
        const db = Date.parse(b);
        const aInv = isNaN(da);
        const bInv = isNaN(db);
        if (aInv && bInv) return 0;
        if (aInv) return 1;
        if (bInv) return -1;
        return da - db;
    },
};

// ---------------------------------------------------------------------------
// SortEngine
// ---------------------------------------------------------------------------

export class SortEngine {
    /**
     * @param {ColumnDef[]} columnDefs
     */
    constructor(columnDefs) {
        /** @type {Map<string, ColumnDef>} */
        this._defs = new Map(columnDefs.map(d => [d.key, d]));

        /**
         * Active sort stack; index 0 = primary sort.
         * @type {SortEntry[]}
         */
        this._stack = [];

        /**
         * Previous cell text values before the last sort, keyed as "colKey:rowIdx".
         * Used by getShadingClass() to detect value changes.
         * @type {Map<string, string>}
         */
        this._prevValues = new Map();

        /**
         * Current cell text values, keyed as "colKey:rowIdx".
         * @type {Map<string, string>}
         */
        this._currValues = new Map();
    }

    // -------------------------------------------------------------------------
    // Sort stack management
    // -------------------------------------------------------------------------

    /**
     * Pushes a sort entry onto the stack (or flips direction if already present).
     * Called when the user clicks a column header.
     *
     * @param {string} colKey
     * @returns {SortEntry[]} Updated sort stack.
     */
    pushSort(colKey) {
        const existing = this._stack.findIndex(e => e.colKey === colKey);
        if (existing !== -1) {
            const entry = this._stack[existing];
            entry.direction = entry.direction === 'asc' ? 'desc' : 'asc';
        } else {
            this._stack.push({
                colKey,
                direction: 'asc',
                priority: this._stack.length,
            });
        }
        this._renumberPriorities();
        return this._stack.slice();
    }

    /**
     * Removes a column from the sort stack.
     *
     * @param {string} colKey
     * @returns {SortEntry[]} Updated sort stack.
     */
    removeSort(colKey) {
        this._stack = this._stack.filter(e => e.colKey !== colKey);
        this._renumberPriorities();
        return this._stack.slice();
    }

    /**
     * Clears the entire sort stack (returns to natural row order).
     *
     * @returns {void}
     */
    clearSort() {
        this._stack = [];
        this._prevValues.clear();
        this._currValues.clear();
    }

    /** @returns {SortEntry[]} */
    getStack() {
        return this._stack.slice();
    }

    // -------------------------------------------------------------------------
    // Sort execution
    // -------------------------------------------------------------------------

    /**
     * Sorts an array of row indices according to the current sort stack.
     * Also snapshots current cell values for shading comparison on the
     * next render cycle.
     *
     * @param {number[]}        rowIdxs  - Indices into the rows array.
     * @param {NormalizedRow[]} rows     - Full row dataset.
     * @returns {number[]} Sorted indices (new array, input unchanged).
     */
    sort(rowIdxs, rows) {
        if (this._stack.length === 0) {
            return rowIdxs.slice();
        }

        // Seed _currValues for any sort-stack column not yet tracked
        // (first sort, or first time a column is added to the stack) so the
        // shading diff can fire on the very first click of a column header.
        rowIdxs.forEach((origIdx, pos) => {
            for (const entry of this._stack) {
                const key = `${entry.colKey}:${pos}`;
                if (!this._currValues.has(key)) {
                    this._currValues.set(key, this._cellText(rows[origIdx], entry.colKey));
                }
            }
        });

        // Snapshot current → becomes previous before we re-sort
        this._prevValues = new Map(this._currValues);

        const sorted = rowIdxs.slice().sort((ai, bi) => {
            for (const entry of this._stack) {
                const def  = this._defs.get(entry.colKey);
                const type = def?.type ?? 'string';
                const cmp  = COMPARATORS[type] ?? COMPARATORS.string;

                const aText = this._cellText(rows[ai], entry.colKey);
                const bText = this._cellText(rows[bi], entry.colKey);

                const result = cmp(aText, bText);
                if (result !== 0) {
                    return entry.direction === 'asc' ? result : -result;
                }
            }
            return 0;
        });

        // Snapshot new values after sort, keyed by display position
        this._currValues.clear();
        sorted.forEach((origIdx, displayPos) => {
            for (const entry of this._stack) {
                const key  = `${entry.colKey}:${displayPos}`;
                const text = this._cellText(rows[origIdx], entry.colKey);
                this._currValues.set(key, text);
            }
        });

        return sorted;
    }

    // -------------------------------------------------------------------------
    // Shading
    // -------------------------------------------------------------------------

    /**
     * Returns a CSS class name to apply to a cell based on whether its value
     * changed position relative to the previous sort.
     *
     * @param {string} colKey
     * @param {number} displayPos - Current display row position (0-based).
     * @returns {'st-shading-changed'|''} Class name or empty string.
     */
    getShadingClass(colKey, displayPos) {
        const key  = `${colKey}:${displayPos}`;
        const prev = this._prevValues.get(key);
        const curr = this._currValues.get(key);
        if (prev === undefined || curr === undefined) {
            return '';
        }
        return prev !== curr ? 'st-shading-changed' : '';
    }

    // -------------------------------------------------------------------------
    // Private helpers
    // -------------------------------------------------------------------------

    /** @returns {void} */
    _renumberPriorities() {
        this._stack.forEach((e, i) => { e.priority = i; });
    }

    /**
     * Returns the primary text value for a cell (first sub-row for multi-row cells).
     *
     * @param {NormalizedRow} row
     * @param {string}        colKey
     * @returns {string}
     */
    _cellText(row, colKey) {
        const value = row[colKey];
        if (Array.isArray(value)) {
            return String(value[0] ?? '');
        }
        return String(value ?? '');
    }
}
