/**
 * @file collapse-engine.js
 * @description Manages multi-row collapse state for collapsible columns.
 *   Tracks per-column master state and per-cell overrides.
 *   Column header toggle always wins: it clears all cell overrides.
 *   Cell toggles only write to the overrides map.
 * @version 1.0.0
 */

// ---------------------------------------------------------------------------
// CHANGELOG
// ---------------------------------------------------------------------------
// 1.0.0 — initial release
//         CollapseEngine class defined with initColumn(), toggleColumn(),
//         toggleCell(), isCellCollapsed(), getHeaderLabel() methods.
// ---------------------------------------------------------------------------

/**
 * @typedef {import('./types.js').CollapseState} CollapseState
 * @typedef {import('./types.js').ColumnDef} ColumnDef
 * @typedef {import('./types.js').NormalizedRow} NormalizedRow
 */

export class CollapseEngine {
    constructor() {
        /** @type {Map<string, CollapseState>} */
        this._states = new Map();

        /** @type {Map<string, ColumnDef>} */
        this._defs = new Map();
    }

    // -------------------------------------------------------------------------
    // Initialisation
    // -------------------------------------------------------------------------

    /**
     * Initialises (or re-initialises) collapse state for one column.
     * Called by the renderer whenever the data set changes.
     *
     * @param {ColumnDef} colDef
     * @param {NormalizedRow[]} rows
     * @returns {void}
     */
    initColumn(colDef, rows) {
        if (!colDef.collapsible) {
            return;
        }

        const peekRows = colDef.peekRows ?? 1;

        const collapsibleCount = rows.reduce((count, row) => {
            const value = row[colDef.key];
            const subRows = Array.isArray(value) ? value : [value ?? ''];
            return subRows.length > peekRows ? count + 1 : count;
        }, 0);

        /** @type {CollapseState} */
        const state = {
            columnCollapsed: true,
            cellOverrides: new Map(),
            collapsibleCount,
            totalRows: rows.length,
        };

        this._states.set(colDef.key, state);
        this._defs.set(colDef.key, colDef);
    }

    // -------------------------------------------------------------------------
    // Toggle actions
    // -------------------------------------------------------------------------

    /**
     * Toggles the column-level collapse state and clears all cell overrides.
     * This is the "always wins" behaviour: any per-cell expansions are reset.
     *
     * @param {string} colKey
     * @returns {boolean} The new columnCollapsed value.
     */
    toggleColumn(colKey) {
        const state = this._requireState(colKey);
        state.cellOverrides.clear();
        state.columnCollapsed = !state.columnCollapsed;
        return state.columnCollapsed;
    }

    /**
     * Toggles one cell's collapsed state as an override on top of the column default.
     *
     * @param {string} colKey
     * @param {number} rowIdx - Stable row index (pre-sort original index).
     * @returns {boolean} The new collapsed value for this cell.
     */
    toggleCell(colKey, rowIdx) {
        const state = this._requireState(colKey);
        const current = this.isCellCollapsed(colKey, rowIdx);
        state.cellOverrides.set(rowIdx, !current);
        return !current;
    }

    // -------------------------------------------------------------------------
    // Queries
    // -------------------------------------------------------------------------

    /**
     * Resolves the effective collapsed state for one cell.
     * Cell override takes precedence only when the column header has NOT been
     * toggled since the override was set — but since toggleColumn() clears all
     * overrides, any surviving override is always valid.
     *
     * @param {string} colKey
     * @param {number} rowIdx
     * @returns {boolean}
     */
    isCellCollapsed(colKey, rowIdx) {
        const state = this._states.get(colKey);
        if (!state) {
            return false;
        }
        if (state.cellOverrides.has(rowIdx)) {
            return /** @type {boolean} */ (state.cellOverrides.get(rowIdx));
        }
        return state.columnCollapsed;
    }

    /**
     * Returns true if the column is configured as collapsible.
     *
     * @param {string} colKey
     * @returns {boolean}
     */
    isCollapsible(colKey) {
        return this._states.has(colKey);
    }

    /**
     * Returns the CollapseState for a column, or null if not collapsible.
     *
     * @param {string} colKey
     * @returns {CollapseState|null}
     */
    getState(colKey) {
        return this._states.get(colKey) ?? null;
    }

    /**
     * Builds the header badge text: "▲ N / T" or "▼ N / T"
     * where N = collapsibleCount and T = totalRows.
     *
     * @param {string} colKey
     * @returns {string|null} Null if column is not collapsible.
     */
    getHeaderLabel(colKey) {
        const state = this._states.get(colKey);
        if (!state) {
            return null;
        }
        const arrow = state.columnCollapsed ? '▲' : '▼';
        return `${arrow} ${state.collapsibleCount} / ${state.totalRows}`;
    }

    /**
     * Builds the cell glyph text for a multi-row cell.
     * Returns null for single-row cells (no glyph needed).
     *
     * @param {string} colKey
     * @param {number} rowIdx
     * @param {number} subRowCount  - Total sub-rows in this cell.
     * @returns {string|null}
     */
    getCellGlyph(colKey, rowIdx, subRowCount) {
        const def = this._defs.get(colKey);
        if (!def) {
            return null;
        }
        const peekRows = def.peekRows ?? 1;
        const hiddenCount = subRowCount - peekRows;
        if (hiddenCount <= 0) {
            return null;
        }
        const collapsed = this.isCellCollapsed(colKey, rowIdx);
        return collapsed
            ? `▲ +${hiddenCount}`
            : `▼ -${hiddenCount}`;
    }

    // -------------------------------------------------------------------------
    // Private
    // -------------------------------------------------------------------------

    /**
     * @param {string} colKey
     * @returns {CollapseState}
     */
    _requireState(colKey) {
        const state = this._states.get(colKey);
        if (!state) {
            throw new Error(`CollapseEngine: column "${colKey}" is not initialised.`);
        }
        return state;
    }
}
