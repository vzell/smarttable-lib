/**
 * @file filter-engine.js
 * @description Four-stage filter pipeline: meta predicates → value selection
 *   → per-column regex → global regex. Each stage receives only rows that
 *   passed the previous stage.
 *
 *   Meta selections within a column are OR-combined.
 *   Value selections within a column are OR-combined.
 *   Meta + value + regex filters across columns are AND-combined.
 *   Global regex is AND-combined with all column results.
 * @version 1.1.0
 */

// ---------------------------------------------------------------------------
// CHANGELOG
// ---------------------------------------------------------------------------
// 1.0.0 — initial release
//         META_PREDICATES map, FilterEngine class with filter(), buildUniqueValues(),
//         buildMetaEntries() defined.
// 1.1.0 — ColumnFilter.isRegex support: when false, filter text is escaped so
//          it matches literally (no special regex characters). Added exported
//          helpers escapeRegex() and buildHighlightPattern() used by the renderer
//          to mark filter matches in cell text.
// ---------------------------------------------------------------------------

/**
 * @typedef {import('./types.js').CellMeta}     CellMeta
 * @typedef {import('./types.js').ColumnDef}    ColumnDef
 * @typedef {import('./types.js').NormalizedRow} NormalizedRow
 * @typedef {import('./types.js').FilterState}  FilterState
 * @typedef {import('./types.js').ColumnFilter} ColumnFilter
 */

// ---------------------------------------------------------------------------
// Shared regex helpers (also used by TableRenderer for highlighting)
// ---------------------------------------------------------------------------

/**
 * Escapes all regex special characters in a string so it can be used as a
 * literal pattern inside RegExp().
 *
 * @param {string} s
 * @returns {string}
 */
export function escapeRegex(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Builds a RegExp with the /g flag, suitable for iterating all matches during
 * highlighting. Returns null for empty input or invalid regex.
 *
 * @param {string}  text          - The filter input text.
 * @param {boolean} isRegex       - If false, text is escaped before compiling.
 * @param {boolean} caseSensitive - If true, the /i flag is omitted.
 * @returns {RegExp|null}
 */
export function buildHighlightPattern(text, isRegex, caseSensitive) {
    if (!text.trim()) {
        return null;
    }
    try {
        const src = isRegex ? text : escapeRegex(text);
        return new RegExp(src, caseSensitive ? 'g' : 'gi');
    } catch {
        return null;
    }
}

// ---------------------------------------------------------------------------
// Meta predicate registry
// ---------------------------------------------------------------------------

/**
 * Maps a meta entry key to a predicate function over CellMeta.
 * Each predicate returns true if the cell matches the meta condition.
 *
 * @type {Object.<string, function(CellMeta): boolean>}
 */
export const META_PREDICATES = {
    isEmpty: (cell) => cell.isEmpty,

    hasImage: (cell) => cell.images.length > 0,

    brokenSrc: (cell) =>
        cell.images.some(img => !img.src || img.broken),

    hasAltOrMeta: (cell) =>
        cell.images.some(img => (img.alt !== null && img.alt !== '')
            || (img.title !== null && img.title !== '')),

    hasNonImageNode: (cell) =>
        cell.nonTextNodes.some(tag => tag !== 'IMG'),
};

/**
 * Human-readable labels for each meta predicate key.
 * Used by the dropdown to render section A entries.
 *
 * @type {Object.<string, string>}
 */
export const META_LABELS = {
    isEmpty:         'Empty cells',
    hasImage:        'Has image',
    brokenSrc:       'No src / broken src',
    hasAltOrMeta:    'Has alt / metadata',
    hasNonImageNode: 'Has non-image node',
};

// ---------------------------------------------------------------------------
// FilterEngine class
// ---------------------------------------------------------------------------

export class FilterEngine {
    /**
     * @param {ColumnDef[]} columnDefs
     */
    constructor(columnDefs) {
        /** @type {ColumnDef[]} */
        this._defs = columnDefs;

        /**
         * CellMeta cache: colKey → rowIdx → CellMeta.
         * Populated by setCellMeta() before filtering.
         * @type {Map<string, Map<number, CellMeta>>}
         */
        this._metaCache = new Map();
    }

    // -------------------------------------------------------------------------
    // CellMeta cache
    // -------------------------------------------------------------------------

    /**
     * Stores the CellMeta for one cell. Called by the renderer after it
     * has inspected each cell.
     *
     * @param {string} colKey
     * @param {number} rowIdx
     * @param {CellMeta} meta
     * @returns {void}
     */
    setCellMeta(colKey, rowIdx, meta) {
        if (!this._metaCache.has(colKey)) {
            this._metaCache.set(colKey, new Map());
        }
        /** @type {Map<number, CellMeta>} */
        (this._metaCache.get(colKey)).set(rowIdx, meta);
    }

    /**
     * @param {string} colKey
     * @param {number} rowIdx
     * @returns {CellMeta|null}
     */
    getCellMeta(colKey, rowIdx) {
        return this._metaCache.get(colKey)?.get(rowIdx) ?? null;
    }

    // -------------------------------------------------------------------------
    // Main filter pipeline
    // -------------------------------------------------------------------------

    /**
     * Runs the four-stage filter pipeline and returns the subset of rows that
     * pass all stages.
     *
     * Stage order:
     *   1. Meta filter   (per-column, OR within column)
     *   2. Value filter  (per-column, OR within column)
     *   3. Column regex  (per-column, AND across columns)
     *   4. Global regex  (across all columns of each row)
     *
     * @param {NormalizedRow[]} rows     - Full unfiltered row set.
     * @param {number[]}        rowIdxs  - Stable original indices for each row.
     * @param {FilterState}     state    - Current filter state.
     * @returns {number[]} Indices (into rows[]) of rows that passed all stages.
     */
    filter(rows, rowIdxs, state) {
        let passing = rowIdxs.slice();

        const colFilterMap = new Map(
            state.columnFilters.map(f => [f.colKey, f])
        );

        // Stage 1 + 2 + 3: per-column (applied together for one pass per column)
        for (const def of this._defs) {
            const cf = colFilterMap.get(def.key);
            if (!cf) {
                continue;
            }

            const hasMetaFilter  = cf.metaEntries.length > 0;
            const hasValueFilter = cf.valueEntries.length > 0;
            const hasRegex       = cf.regex.trim() !== '';

            if (!hasMetaFilter && !hasValueFilter && !hasRegex) {
                continue;
            }

            passing = passing.filter(i => {
                const row     = rows[i];
                const origIdx = rowIdxs[i] ?? i;
                const cell    = this.getCellMeta(def.key, origIdx);
                const text    = this._cellText(row, def.key);

                // Stage 1: meta filter (OR within column)
                if (hasMetaFilter) {
                    const metaPass = cf.metaEntries.some(key => {
                        const pred = META_PREDICATES[key];
                        return pred && cell ? pred(cell) : false;
                    });
                    if (!metaPass) {
                        return false;
                    }
                }

                // Stage 2: value filter (OR within column)
                if (hasValueFilter) {
                    const valuePass = cf.valueEntries.includes(text);
                    if (!valuePass) {
                        return false;
                    }
                }

                // Stage 3: column text/regex filter
                if (hasRegex) {
                    const pat = (cf.isRegex ?? false) ? cf.regex : escapeRegex(cf.regex);
                    const re  = this._buildRegex(pat, cf.regexCase);
                    if (!re) {
                        return false;
                    }
                    const matches = re.test(text);
                    const pass    = cf.regexExclude ? !matches : matches;
                    if (!pass) {
                        return false;
                    }
                }

                return true;
            });
        }

        // Stage 4: global regex (tests all column texts for each row)
        if (state.globalRegex.trim() !== '') {
            const re = this._buildRegex(state.globalRegex, state.globalRegexCase);
            if (re) {
                passing = passing.filter(i => {
                    const row = rows[i];
                    const anyMatch = this._defs.some(def =>
                        re.test(this._cellText(row, def.key))
                    );
                    return state.globalRegexExclude ? !anyMatch : anyMatch;
                });
            }
        }

        return passing;
    }

    // -------------------------------------------------------------------------
    // Dropdown data builders
    // -------------------------------------------------------------------------

    /**
     * Builds the list of unique text values for a column's dropdown section C,
     * sorted by descending frequency then alphabetically.
     *
     * @param {NormalizedRow[]} rows
     * @param {string}          colKey
     * @returns {Array<{value: string, count: number}>}
     */
    buildUniqueValues(rows, colKey) {
        /** @type {Map<string, number>} */
        const freq = new Map();

        for (const row of rows) {
            const subRows = this._subRows(row, colKey);
            for (const text of subRows) {
                const t = text.trim();
                if (t !== '') {
                    freq.set(t, (freq.get(t) ?? 0) + 1);
                }
            }
        }

        return Array.from(freq.entries())
            .sort(([aVal, aCount], [bVal, bCount]) => {
                if (bCount !== aCount) {
                    return bCount - aCount;
                }
                return aVal.localeCompare(bVal);
            })
            .map(([value, count]) => ({ value, count }));
    }

    /**
     * Builds the list of meta entry keys that are relevant for a column,
     * i.e. at least one row matches the predicate.
     * Only entries with matches are included so the dropdown isn't cluttered
     * with irrelevant options.
     *
     * @param {NormalizedRow[]} rows
     * @param {string}          colKey
     * @param {number[]}        rowIdxs - Stable original indices.
     * @returns {string[]} Ordered meta entry keys.
     */
    buildMetaEntries(rows, colKey, rowIdxs) {
        const keys = Object.keys(META_PREDICATES);
        return keys.filter(key => {
            const pred = META_PREDICATES[key];
            return rowIdxs.some(i => {
                const cell = this.getCellMeta(colKey, i);
                return cell ? pred(cell) : false;
            });
        });
    }

    // -------------------------------------------------------------------------
    // Private helpers
    // -------------------------------------------------------------------------

    /**
     * Resolves the display text for a cell, joining sub-rows with a space.
     *
     * @param {NormalizedRow} row
     * @param {string}        colKey
     * @returns {string}
     */
    _cellText(row, colKey) {
        return this._subRows(row, colKey).join(' ');
    }

    /**
     * Returns all sub-row string values for a cell.
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
     * Compiles a regex string, returning null on invalid input.
     *
     * @param {string}  pattern
     * @param {boolean} caseSensitive
     * @returns {RegExp|null}
     */
    _buildRegex(pattern, caseSensitive) {
        try {
            return new RegExp(pattern, caseSensitive ? '' : 'i');
        } catch {
            return null;
        }
    }
}
