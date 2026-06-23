/**
 * @file styles.js
 * @description Default stylesheet for smarttable-lib.
 *   Exports a CSS string constant (STYLES) for bundler / GM_addStyle() use,
 *   and auto-injects a <style id="st-styles"> element when loaded as a plain
 *   script via Tampermonkey @require (idempotent — second load is a no-op).
 *
 *   All selectors use the "st-" namespace prefix so they never clash with
 *   the host page. !important is used only on column-tint shading rules
 *   (st-mscol-*) which must override the base row background.
 *
 *   Usage in a userscript (bundled):
 *     import { STYLES } from './styles.js';
 *     GM_addStyle(STYLES);
 *
 *   Usage via @require (auto-injection, no extra code needed):
 *     // @require .../src/styles.js
 * @version 1.8.0
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
// 1.3.0 — value-group shading: st-shade-a / st-shade-b added (TR-level).
// 1.4.0 — Complete visual overhaul for v1.2.0 feature set:
//          st-shade-a / st-shade-b removed; replaced by per-column TD tinting
//          (st-mscol-{P}a / st-mscol-{P}b) for 8 priority hues.
//          st-mscol-hdr-{0-7}: header TH tints by sort priority.
//          Three-zone header layout: st-th-inner / st-th-left / st-th-centre /
//          st-th-right. st-sort-icon / st-sort-icon-active: sort widget.
//          st-uniq-badge: {count}📊 badge replacing st-th-filter-btn (⧨/⧩).
//          st-col-highlight: light blue column-filter match highlight.
//          st-cell-toggle-row: flex row for per-cell toggle pushed right.
//          st-filter-checkbox / st-filter-mods: Cc/Rx/Ex checkboxes.
//          st-input-wrap / st-clear-btn: input wrapper + inset ✕ button.
//          Action buttons: st-btn-expand-all, st-btn-toggle-hl,
//          st-btn-clear-col-filters, st-btn-clear-all-filters.
//          Removed: st-toggle, st-th-sort-badge, st-th-sort-dir,
//          st-th-filter-btn, st-filter-regex-btn, st-shade-a, st-shade-b.
//          st-wrapper.st-no-highlight: CSS hook hides all marks without rerender.
// 1.5.0 — st-cell-toggle-row replaced by st-cell-first-row: the per-cell
//          collapse toggle is now inline with the first sub-row (flex row with
//          space-between) rather than a separate row below all content.
//          st-sort-icons: inline-flex group wrapping ⇅▲▼ with gap: 0.
// 1.6.0 — Bug fixes:
//          (1) .st-filter-th .st-input-wrap gets min-width: 0, overriding the
//              base 160px so the absolute-positioned ✕ button stays inside
//              narrow columns instead of being clipped off-screen.
//          (2) .st-th-inner changed from flex to CSS grid (1fr auto 1fr) so
//              the centre-zone collapse toggle is always horizontally centred
//              in the column header even when the left zone collapses.
//          (3) .st-cell-first-row align-items changed from flex-start to center
//              so the per-cell toggle is vertically centred in the first row.
// 1.8.0 — Active filter input colorization:
//          .st-global-input--active: gold border (box-shadow 0 0 0 2px) + dark-amber
//            text (#7a5400) when the global filter field has non-empty text.
//          .st-filter-input--active: blue border (box-shadow 0 0 0 2px) + dark-blue
//            text (#1a5a8a) when a column filter field has non-empty text.
//          Focus overrides keep the colored border/outline instead of reverting to blue.
//          box-shadow used (not border-width) to avoid layout shift.
// 1.7.0 — Four new styles added:
//          .st-row-count: the "(N of M)" stat chip before the global filter.
//          .st-tooltip: singleton rich tooltip shown on hover over the stat chip.
//          .st-dropdown-match: <mark> highlight for quick-filter matches inside
//            unique-value dropdown items (gold background, same as st-highlight).
//          Also added .st-th-inner--collapsible: CSS grid (1fr auto 1fr) modifier
//          applied only to collapsible column headers (non-collapsible keeps flex).
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

/* ---- Row-count stat (before the global filter input) ---- */
.st-row-count {
    font-size: 12px;
    color: #888;
    white-space: nowrap;
    cursor: default;
    padding: 2px 5px;
    border-radius: 3px;
    border: 1px solid transparent;
    user-select: none;
    flex-shrink: 0;
}

.st-row-count:hover {
    background: #f0f0f2;
    border-color: #d0d2d8;
    color: #444;
}

/* ---- Rich tooltip (appears on hover over the row-count stat) ---- */
.st-tooltip {
    position: fixed;
    z-index: 99999;
    max-width: 440px;
    padding: 8px 12px;
    background: #fff;
    border: 1px solid #c8cad0;
    border-radius: 5px;
    box-shadow: 0 4px 18px rgba(0, 0, 0, 0.14), 0 1px 4px rgba(0, 0, 0, 0.08);
    font-size: 13px;
    font-family: system-ui, -apple-system, "Segoe UI", Helvetica, Arial, sans-serif;
    line-height: 1.6;
    pointer-events: none;
    color: #222;
    display: none;
}

/* Wrapper for input + inset ✕ button */
.st-input-wrap {
    position: relative;
    flex: 1 1 180px;
    min-width: 160px;
    display: flex;
    align-items: center;
}

.st-global-input {
    width: 100%;
    padding: 4px 26px 4px 8px;
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

/* Global filter input: filter text is non-empty — gold border + dark-amber text */
.st-global-input--active {
    color: #7a5400;
    border-color: #e6b800;
    box-shadow: 0 0 0 2px rgba(230, 184, 0, 0.45);
    font-weight: 600;
}
.st-global-input--active:focus {
    outline-color: #e6b800;
    border-color: #e6b800;
}

/* ✕ clear button inset inside the input */
.st-clear-btn {
    position: absolute;
    right: 5px;
    top: 50%;
    transform: translateY(-50%);
    border: none;
    background: transparent;
    cursor: pointer;
    font-size: 12px;
    color: #aaa;
    line-height: 1;
    padding: 2px 3px;
    border-radius: 2px;
    user-select: none;
}

.st-clear-btn:hover {
    color: #555;
    background: rgba(0, 0, 0, 0.06);
}

/* Checkbox modifier labels (Cc / Rx / Ex) */
.st-filter-checkbox {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    cursor: pointer;
    font-size: 11px;
    user-select: none;
    white-space: nowrap;
    color: #555;
}

.st-filter-checkbox input[type="checkbox"] {
    margin: 0;
    cursor: pointer;
    accent-color: #2563eb;
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

/* Toolbar action buttons */
.st-btn-expand-all,
.st-btn-toggle-hl,
.st-btn-clear-col-filters,
.st-btn-clear-all-filters {
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

.st-btn-expand-all:hover,
.st-btn-toggle-hl:hover,
.st-btn-clear-col-filters:hover,
.st-btn-clear-all-filters:hover {
    background: #eaeaec;
    border-color: #aaa;
}

.st-btn-clear-col-filters:hover,
.st-btn-clear-all-filters:hover {
    color: #b45309;
    border-color: #d97706;
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
    padding: 5px 6px;
    border: 1px solid #c8cad0;
    text-align: left;
    vertical-align: middle;
    white-space: nowrap;
    font-weight: 600;
    font-size: 12px;
    position: relative;
    user-select: none;
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

/* ---- Three-zone flex layout (default — non-collapsible columns) ---- */
/* Left zone gets all remaining space; right zone is fixed-width.
   For collapsible columns, .st-th-inner--collapsible switches to a 3-column
   CSS grid so the centre-zone toggle is truly horizontally centred even when
   the left zone is clipped to near-zero by a very narrow column. */
.st-th-inner {
    display: flex;
    align-items: center;
    width: 100%;
    gap: 4px;
}

.st-th-left {
    display: flex;
    align-items: center;
    gap: 5px;
    flex: 1 1 auto;
    min-width: 0;
    overflow: hidden;
}

.st-th-centre {
    flex: 0 0 auto;
}

.st-th-right {
    flex: 0 0 auto;
}

/* Collapsible columns: CSS grid keeps the centre toggle truly centred */
.st-th-inner--collapsible {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
}

.st-th-inner--collapsible .st-th-left {
    /* grid child — flex sizing via 1fr column */
}

.st-th-inner--collapsible .st-th-right {
    justify-self: end;
}

/* ---- Column label ---- */
.st-th-label {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 0 1 auto;
    min-width: 0;
}

/* ---- Sort icon group (wraps ⇅ ▲ ▼ with no gap between them) ---- */
.st-sort-icons {
    display: inline-flex;
    align-items: center;
    gap: 0;
    flex-shrink: 0;
}

/* ---- Sort icon buttons (⇅ / ▲ / ▼) ---- */
.st-sort-icon {
    padding: 0 2px;
    border: none;
    background: transparent;
    cursor: pointer;
    font-weight: bold;
    font-size: 11px;
    color: #777;
    border-radius: 2px;
    line-height: 1;
    flex-shrink: 0;
    transition: color 0.1s, background 0.1s;
}

.st-sort-icon:hover {
    color: #222;
    background: rgba(0, 0, 0, 0.07);
}

/* Active sort direction button: green text + yellow background */
.st-sort-icon-active {
    color: #166534 !important;
    background: #fef08a !important;
}

/* ---- Column collapse toggle (centre zone) ---- */
.st-th-collapse {
    display: inline-block;
    padding: 1px 5px;
    border: 1px solid #b8bbc4;
    border-radius: 3px;
    background: #fff;
    font-size: 11px;
    line-height: 1.5;
    cursor: pointer;
    vertical-align: middle;
    color: #555;
    user-select: none;
    white-space: nowrap;
}

.st-th-collapse:hover {
    background: #e2e4e8;
    border-color: #999;
}

/* ---- Unique-values badge / 📊 (right zone) ---- */
.st-uniq-badge {
    padding: 1px 5px;
    border: 1px solid transparent;
    border-radius: 3px;
    background: transparent;
    font-size: 11px;
    line-height: 1.5;
    cursor: pointer;
    color: #555;
    user-select: none;
    white-space: nowrap;
    transition: background 0.1s, border-color 0.1s;
}

.st-uniq-badge:hover {
    background: #e0e4f0;
    border-color: #b8bbc4;
    color: #222;
}

.st-th--filter-active .st-uniq-badge {
    color: #b45309;
}

/* ---- Header tints by sort priority (60 % alpha) ---- */
.st-wrapper .st-mscol-hdr-0 { background-color: rgba(255, 200,  80, 0.60) !important; }
.st-wrapper .st-mscol-hdr-1 { background-color: rgba( 80, 180, 255, 0.60) !important; }
.st-wrapper .st-mscol-hdr-2 { background-color: rgba(120, 230, 120, 0.60) !important; }
.st-wrapper .st-mscol-hdr-3 { background-color: rgba(230, 120, 230, 0.60) !important; }
.st-wrapper .st-mscol-hdr-4 { background-color: rgba(255, 160, 100, 0.60) !important; }
.st-wrapper .st-mscol-hdr-5 { background-color: rgba(100, 230, 210, 0.60) !important; }
.st-wrapper .st-mscol-hdr-6 { background-color: rgba(180, 160, 255, 0.60) !important; }
.st-wrapper .st-mscol-hdr-7 { background-color: rgba(255, 220, 180, 0.60) !important; }

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

/* Per-column per-priority TD tints — alternate a/b on value-group change.
   !important overrides the nth-child zebra and hover rules above.         */
.st-wrapper .st-mscol-0a { background-color: rgba(255, 200,  80, 0.22) !important; }
.st-wrapper .st-mscol-0b { background-color: rgba(255, 200,  80, 0.44) !important; }
.st-wrapper .st-mscol-1a { background-color: rgba( 80, 180, 255, 0.22) !important; }
.st-wrapper .st-mscol-1b { background-color: rgba( 80, 180, 255, 0.44) !important; }
.st-wrapper .st-mscol-2a { background-color: rgba(120, 230, 120, 0.22) !important; }
.st-wrapper .st-mscol-2b { background-color: rgba(120, 230, 120, 0.44) !important; }
.st-wrapper .st-mscol-3a { background-color: rgba(230, 120, 230, 0.22) !important; }
.st-wrapper .st-mscol-3b { background-color: rgba(230, 120, 230, 0.44) !important; }
.st-wrapper .st-mscol-4a { background-color: rgba(255, 160, 100, 0.22) !important; }
.st-wrapper .st-mscol-4b { background-color: rgba(255, 160, 100, 0.44) !important; }
.st-wrapper .st-mscol-5a { background-color: rgba(100, 230, 210, 0.22) !important; }
.st-wrapper .st-mscol-5b { background-color: rgba(100, 230, 210, 0.44) !important; }
.st-wrapper .st-mscol-6a { background-color: rgba(180, 160, 255, 0.22) !important; }
.st-wrapper .st-mscol-6b { background-color: rgba(180, 160, 255, 0.44) !important; }
.st-wrapper .st-mscol-7a { background-color: rgba(255, 220, 180, 0.22) !important; }
.st-wrapper .st-mscol-7b { background-color: rgba(255, 220, 180, 0.44) !important; }

/* Inner wrapper — column of sub-rows + bottom-right toggle row */
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

/* Flex row: first sub-row text + inline toggle button at the right edge */
.st-cell-first-row {
    display: flex;
    align-items: center;
    gap: 4px;
    justify-content: space-between;
}

.st-cell-first-row .st-subrow {
    flex: 1 1 auto;
    min-width: 0;
}

/* Per-cell expand/collapse toggle */
.st-cell-toggle {
    display: inline-block;
    padding: 0 5px;
    border: 1px solid #c8cad0;
    border-radius: 3px;
    background: #f0f0f2;
    font-size: 10px;
    line-height: 1.7;
    cursor: pointer;
    color: #555;
    user-select: none;
}

.st-cell-toggle:hover {
    background: #dce0e8;
    border-color: #aaa;
}

/* ============================================================
   Filter dropdown
   ============================================================ */

.st-dropdown {
    position: absolute;
    z-index: 9999;
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

.st-dropdown-item--meta {
    font-style: italic;
    color: #666;
}

.st-dropdown-checkbox {
    flex-shrink: 0;
    font-size: 14px;
    line-height: 1;
    color: #aaa;
}

.st-dropdown-item--checked .st-dropdown-checkbox {
    color: #2563eb;
}

.st-dropdown-item-label {
    flex: 1 1 auto;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

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

.st-dropdown-no-results {
    padding: 8px 10px;
    color: #bbb;
    font-style: italic;
    font-size: 12px;
}

/* Highlight for the quick-filter search query inside each value-item label */
.st-dropdown-match {
    background: #FFD700;
    color: #111;
    border-radius: 2px;
    padding: 0 1px;
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

/* Within filter-th, override st-input-wrap to fill width.
   min-width: 0 is required — the base .st-input-wrap has min-width: 160px which
   would overflow narrow columns and push the absolute ✕ button out of view. */
.st-filter-th .st-input-wrap {
    flex: none;
    width: 100%;
    min-width: 0;
    margin-bottom: 2px;
}

.st-filter-input {
    width: 100%;
    padding: 2px 22px 2px 5px;
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

/* Column filter input: filter text is non-empty — blue border + dark-blue text */
.st-filter-input--active {
    color: #1a5a8a;
    border-color: #5ba8d4;
    box-shadow: 0 0 0 2px rgba(91, 168, 212, 0.45);
    font-weight: 600;
}
.st-filter-input--active:focus {
    outline-color: #5ba8d4;
    border-color: #5ba8d4;
}

/* Row of Cc / Rx / Ex checkboxes below the input */
.st-filter-mods {
    display: flex;
    gap: 5px;
    flex-wrap: wrap;
    margin-top: 2px;
}

/* ============================================================
   Filter match highlights
   ============================================================ */

/* Global filter match — yellow */
.st-wrapper mark.st-highlight {
    background-color: #FFD700;
    color: inherit;
    border-radius: 2px;
    padding: 0 1px;
}

/* Column filter match — light blue */
.st-wrapper mark.st-col-highlight {
    background-color: #add8e6;
    color: inherit;
    border-radius: 2px;
    padding: 0 1px;
}

/* "Toggle ALL highlighting" adds this class to .st-wrapper to suppress all marks */
.st-wrapper.st-no-highlight mark.st-highlight,
.st-wrapper.st-no-highlight mark.st-col-highlight {
    background: transparent;
    padding: 0;
    border-radius: 0;
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
