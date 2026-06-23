/**
 * @file styles.js
 * @description Default stylesheet for smarttable-lib.
 *   Exports a CSS string constant (STYLES) for bundler / GM_addStyle() use,
 *   and auto-injects a <style id="st-styles"> element when loaded as a plain
 *   script via Tampermonkey @require (idempotent — second load is a no-op).
 *
 *   All selectors use the "st-" namespace prefix so they never clash with
 *   the host page. No !important is used except on value-group shading
 *   (.st-shade-a / .st-shade-b) which must override nth-child zebra colours.
 *
 *   Usage in a userscript (bundled):
 *     import { STYLES } from './styles.js';
 *     GM_addStyle(STYLES);
 *
 *   Usage via @require (auto-injection, no extra code needed):
 *     // @require .../src/styles.js
 * @version 1.3.0
 */

// ---------------------------------------------------------------------------
// CHANGELOG
// ---------------------------------------------------------------------------
// 1.0.0 — initial release
//         Full stylesheet for all st- classes: wrapper, global bar, toggles,
//         trigger button, table, thead/th/sort/collapse/filter badges,
//         tbody/tr/td, sub-rows, cell-toggle, shading, dropdown.
// 1.2.0 — filter row styles (st-filter-row, st-filter-th, st-filter-input,
//          st-filter-regex-btn) and match highlight (mark.st-highlight).
// 1.3.0 — value-group shading replaces position-change flash shading
//          st-shading-changed removed; st-shade-a / st-shade-b added.
//          Applied to <tr> by the renderer when a sort is active.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// CSS string
// ---------------------------------------------------------------------------

export const STYLES = /* css */`

/* ============================================================
   Reset — scoped to .st-wrapper
   ============================================================ */

.st-wrapper,
.st-wrapper *,
.st-wrapper *::before,
.st-wrapper *::after {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
}

/* ============================================================
   Outer wrapper
   ============================================================ */

.st-wrapper {
    position: relative;          /* anchor for abs-positioned dropdown     */
    font-family: system-ui, -apple-system, "Segoe UI", Helvetica, Arial, sans-serif;
    font-size: 13px;
    line-height: 1.45;
    color: #1a1a1a;
    background: transparent;
    margin: 10px 0;
    overflow: visible;           /* dropdown must be able to escape bounds  */
}

/* ============================================================
   Trigger button — lives OUTSIDE .st-wrapper on the host page
   ============================================================ */

.st-btn-trigger {
    display: inline-block;
    padding: 5px 14px;
    margin: 6px 0;
    border: 1px solid #999;
    border-radius: 4px;
    font-family: system-ui, -apple-system, "Segoe UI", Helvetica, Arial, sans-serif;
    font-size: 13px;
    line-height: 1.4;
    cursor: pointer;
    background: #f0f0f0;
    color: #222;
    user-select: none;
}

.st-btn-trigger:hover {
    background: #e2e2e2;
    border-color: #777;
}

/* ============================================================
   Global bar
   ============================================================ */

.st-global-bar {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 2px;
    flex-wrap: wrap;
}

.st-global-input {
    flex: 1 1 180px;
    min-width: 160px;
    padding: 4px 8px;
    border: 1px solid #c8cad0;
    border-radius: 3px;
    font-size: inherit;
    font-family: inherit;
    background: #fff;
    color: inherit;
}

.st-global-input:focus {
    outline: 2px solid #3b82f6;
    outline-offset: -1px;
    border-color: #3b82f6;
}

/* Toggle buttons (Exclude / Case) */
.st-toggle {
    padding: 3px 10px;
    border: 1px solid #c8cad0;
    border-radius: 3px;
    font-size: inherit;
    font-family: inherit;
    cursor: pointer;
    background: #f5f5f7;
    color: #555;
    white-space: nowrap;
    user-select: none;
    transition: background 0.1s, color 0.1s, border-color 0.1s;
}

.st-toggle:hover {
    background: #eaeaec;
    border-color: #aaa;
}

.st-toggle[data-active="true"] {
    background: #2563eb;
    border-color: #1d4ed8;
    color: #fff;
}

/* Auto-size columns button */
.st-btn-auto-resize {
    padding: 3px 10px;
    border: 1px solid #c8cad0;
    border-radius: 3px;
    font-size: inherit;
    font-family: inherit;
    cursor: pointer;
    background: #f5f5f7;
    color: #555;
    white-space: nowrap;
    user-select: none;
}

.st-btn-auto-resize:hover {
    background: #eaeaec;
    border-color: #aaa;
}

/* ============================================================
   Table
   ============================================================ */

.st-table {
    width: 100%;
    border-collapse: collapse;
    border-spacing: 0;
    font-size: inherit;
    font-family: inherit;
    color: inherit;
    /* table-layout set to "fixed" by ResizeEngine after first resize */
}

/* ============================================================
   Header
   ============================================================ */

.st-thead {
    background: #eef0f4;
    /* position:sticky and top:0 are set inline by the renderer
       when stickyHeader:true (default). z-index keeps it above rows. */
    z-index: 10;
}

.st-th {
    padding: 6px 8px;
    border: 1px solid #c8cad0;
    text-align: left;
    vertical-align: middle;
    white-space: nowrap;
    font-weight: 600;
    font-size: 12px;
    position: relative;
    user-select: none;
    /* right-border acts as the drag-resize handle zone */
    cursor: default;
}

/* Sort active — column is in the sort stack */
.st-th--sort-active {
    background: #dde8f8;
}

/* Filter active — column has an active filter */
.st-th--filter-active {
    background: #fef3c7;
}

/* Both at once */
.st-th--sort-active.st-th--filter-active {
    background: #fde9a2;
}

/* ---- Column label ---- */
.st-th-label {
    margin-right: 2px;
}

/* ---- Sort priority badge (number circle) ---- */
.st-th-sort-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 15px;
    height: 15px;
    padding: 0 3px;
    border-radius: 8px;
    background: #2563eb;
    color: #fff;
    font-size: 9px;
    font-weight: 700;
    margin-right: 1px;
    vertical-align: middle;
    line-height: 1;
}

/* ---- Sort direction arrow ---- */
.st-th-sort-dir {
    font-size: 9px;
    color: #2563eb;
    margin-right: 4px;
    vertical-align: middle;
}

/* ---- Column collapse badge (in header) ---- */
.st-th-collapse {
    display: inline-block;
    padding: 1px 5px;
    margin-left: 3px;
    border: 1px solid #b8bbc4;
    border-radius: 3px;
    background: #fff;
    font-size: 10px;
    line-height: 1.5;
    cursor: pointer;
    vertical-align: middle;
    color: #555;
    user-select: none;
}

.st-th-collapse:hover {
    background: #e2e4e8;
    border-color: #999;
}

/* ---- Per-column filter button ---- */
.st-th-filter-btn {
    display: inline-block;
    padding: 1px 4px;
    margin-left: 3px;
    border: 1px solid transparent;
    border-radius: 3px;
    background: transparent;
    font-size: 13px;
    line-height: 1;
    cursor: pointer;
    vertical-align: middle;
    color: #999;
    user-select: none;
}

.st-th-filter-btn:hover {
    background: #dce0e8;
    border-color: #b8bbc4;
    color: #444;
}

.st-th--filter-active .st-th-filter-btn {
    color: #b45309;
}

/* ============================================================
   Body rows
   ============================================================ */

.st-tr:nth-child(even) .st-td {
    background: #f7f8fa;
}

.st-tr:hover .st-td {
    background: #eef3ff;
}

.st-td {
    padding: 4px 8px;
    border: 1px solid #e0e2e6;
    vertical-align: top;
    background: #fff;
}

/* Inner wrapper — column of sub-rows */
.st-td-inner {
    display: flex;
    flex-direction: column;
    gap: 2px;
}

/* One sub-row line */
.st-subrow {
    word-break: break-word;
    min-height: 1.2em;
}

/* Hidden sub-row (when cell is collapsed beyond peek count) */
.st-subrow--hidden {
    display: none;
}

/* Per-cell expand/collapse toggle */
.st-cell-toggle {
    display: inline-block;
    padding: 0 5px;
    margin-bottom: 3px;
    border: 1px solid #c8cad0;
    border-radius: 3px;
    background: #f0f0f2;
    font-size: 10px;
    line-height: 1.7;
    cursor: pointer;
    color: #555;
    user-select: none;
    align-self: flex-start;
}

.st-cell-toggle:hover {
    background: #dce0e8;
    border-color: #aaa;
}

/* Value-group shading — applied to <tr> when a sort is active.
   Consecutive rows sharing the same primary-sort value get the same shade;
   the group alternates on every value boundary.
   !important is required to override the nth-child zebra rule below. */
.st-tr.st-shade-b .st-td {
    background-color: #dbeafe !important; /* light blue — alternating group */
}
.st-tr.st-shade-a .st-td {
    background-color: #fff !important;    /* white — default group */
}

/* ============================================================
   Filter dropdown
   ============================================================ */

.st-dropdown {
    position: absolute;
    z-index: 9999;             /* above sticky thead and host page chrome */
    min-width: 220px;
    max-width: 360px;
    max-height: 380px;
    overflow-y: auto;
    background: #fff;
    border: 1px solid #c8cad0;
    border-radius: 5px;
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.14), 0 1px 4px rgba(0, 0, 0, 0.08);
    font-size: 13px;
    font-family: system-ui, -apple-system, "Segoe UI", Helvetica, Arial, sans-serif;
    color: #1a1a1a;
}

.st-dropdown-section {
    padding: 5px 0;
}

.st-dropdown-section-head {
    padding: 2px 10px 5px;
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: #999;
    user-select: none;
}

.st-dropdown-divider {
    margin: 0;
    border: none;
    border-top: 1px solid #ebebeb;
}

/* Quick-filter search box */
.st-dropdown-quick-input {
    display: block;
    width: calc(100% - 20px);
    margin: 0 10px;
    padding: 4px 8px;
    border: 1px solid #c8cad0;
    border-radius: 3px;
    font-size: inherit;
    font-family: inherit;
    background: #fff;
    color: inherit;
}

.st-dropdown-quick-input:focus {
    outline: 2px solid #3b82f6;
    outline-offset: -1px;
    border-color: #3b82f6;
}

/* Checkable item row */
.st-dropdown-item {
    display: flex;
    align-items: baseline;
    gap: 6px;
    padding: 4px 10px;
    cursor: pointer;
    user-select: none;
}

.st-dropdown-item:hover {
    background: #f0f4ff;
}

.st-dropdown-item--checked {
    background: #eff6ff;
}

.st-dropdown-item--checked:hover {
    background: #dbeafe;
}

/* Meta entries (isEmpty, brokenSrc, etc.) rendered italic */
.st-dropdown-item--meta {
    font-style: italic;
    color: #666;
}

/* ☐ / ☑ glyph */
.st-dropdown-checkbox {
    flex-shrink: 0;
    font-size: 14px;
    line-height: 1;
    color: #aaa;
}

.st-dropdown-item--checked .st-dropdown-checkbox {
    color: #2563eb;
}

/* Value label */
.st-dropdown-item-label {
    flex: 1 1 auto;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

/* Occurrence count pill */
.st-dropdown-count {
    flex-shrink: 0;
    font-size: 10px;
    color: #999;
    background: #f0f0f2;
    border-radius: 8px;
    padding: 1px 5px;
    min-width: 20px;
    text-align: center;
    line-height: 1.5;
}

/* "No matching values" message */
.st-dropdown-no-results {
    padding: 8px 10px;
    color: #bbb;
    font-style: italic;
    font-size: 12px;
}

/* ============================================================
   Filter row (second <thead> row)
   ============================================================ */

.st-filter-row .st-filter-th {
    padding: 3px 4px;
    border: 1px solid #c8cad0;
    background: #f5f7fa;
    font-weight: normal;
}

.st-filter-input {
    width: calc(100% - 28px);
    padding: 2px 5px;
    border: 1px solid #c8cad0;
    border-radius: 3px;
    font-size: 11px;
    font-family: inherit;
    background: #fff;
    color: inherit;
    min-width: 0;
    vertical-align: middle;
}

.st-filter-input:focus {
    outline: 2px solid #3b82f6;
    outline-offset: -1px;
    border-color: #3b82f6;
}

.st-filter-regex-btn {
    padding: 1px 4px;
    margin-left: 2px;
    border: 1px solid #c8cad0;
    border-radius: 3px;
    background: #f5f5f7;
    font-size: 10px;
    font-family: monospace;
    cursor: pointer;
    color: #888;
    vertical-align: middle;
    user-select: none;
}

.st-filter-regex-btn:hover {
    background: #eaeaec;
    border-color: #aaa;
}

.st-filter-regex-btn[data-active="true"] {
    background: #2563eb;
    border-color: #1d4ed8;
    color: #fff;
}

/* ============================================================
   Filter match highlight
   ============================================================ */

.st-wrapper mark.st-highlight {
    background-color: #fef08a;
    color: inherit;
    border-radius: 2px;
    padding: 0 1px;
}
`;

// ---------------------------------------------------------------------------
// Auto-inject when loaded as a plain @require script
// ---------------------------------------------------------------------------

if (typeof document !== 'undefined' && !document.getElementById('st-styles')) {
    const style = document.createElement('style');
    style.id = 'st-styles';
    style.textContent = STYLES;
    (document.head ?? document.documentElement).appendChild(style);
}
