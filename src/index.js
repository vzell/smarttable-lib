/**
 * @file index.js
 * @description Public API for smarttable-lib.
 *   Exposes SmartTable.render() as the single entry point for userscripts.
 *   All internal engines are encapsulated inside TableRenderer and not
 *   exported to keep the surface area minimal.
 * @version 1.1.0
 */

// ---------------------------------------------------------------------------
// CHANGELOG
// ---------------------------------------------------------------------------
// 1.0.0 — initial release
//         SmartTable.render() defined.
//         Re-exports ColumnDef typedef and META_LABELS for adapter authors.
// 1.1.0 — import styles.js so the bundle is self-contained (styles auto-inject
//         on load; idempotent guard prevents double-injection).
// ---------------------------------------------------------------------------

import './styles.js';
import { TableRenderer } from './table-renderer.js';

export { META_LABELS } from './filter-engine.js';

/**
 * @typedef {import('./types.js').ColumnDef}    ColumnDef
 * @typedef {import('./types.js').NormalizedRow} NormalizedRow
 * @typedef {import('./types.js').TableOptions} TableOptions
 */

/**
 * Namespace object exposed on window.SmartTable when the library is loaded
 * via a @require tag (non-module build).
 */
export const SmartTable = {
    /**
     * Creates a TableRenderer instance, injects the trigger button into the
     * given container element, and returns the renderer for lifecycle control.
     *
     * Minimal usage from a userscript:
     * @example
     * SmartTable.render({
     *   columns: MyAdapter.columnDefs,
     *   rows:    MyAdapter.extract(),
     *   container: document.querySelector(MyAdapter.triggerSelector),
     * });
     *
     * @param {object}         params
     * @param {ColumnDef[]}    params.columns   - Column definitions from the adapter.
     * @param {NormalizedRow[]} params.rows     - Extracted row data from the adapter.
     * @param {HTMLElement}    params.container - Element to inject the trigger button into.
     * @param {TableOptions}   [params.options] - Optional renderer configuration.
     * @returns {TableRenderer}
     */
    render({ columns, rows, container, options = {} }) {
        const renderer = new TableRenderer({ columns, rows, container, options });
        renderer.inject();
        return renderer;
    },
};

// Expose on window for @require (non-module) context
if (typeof window !== 'undefined') {
    window.SmartTable = SmartTable;
}
