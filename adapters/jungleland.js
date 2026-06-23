/**
 * @file adapters/jungleland.js
 * @description Adapter for the Jungleland bootleg list at
 *   https://www.jungleland.it/html/list.htm
 *
 *   Page structure: plain 1990s static HTML, no CSS classes on content.
 *   Each bootleg is an <a target="inferioredx1" href="YYYYMMDD.htm"> link
 *   whose text has the format "Title(YYYY-MM-DD)" (date always last).
 *   Multiple versions of the same show are separate hrefs: "YYYYMMDD_2.htm",
 *   "YYYYMMDD_3.htm", etc.
 *
 *   Usage in userscript:
 *   @require .../adapters/jungleland.js
 *   SmartTable.render({
 *     columns:   JunglelandAdapter.columnDefs,
 *     rows:      JunglelandAdapter.extract(),
 *     container: document.querySelector(JunglelandAdapter.triggerSelector),
 *   });
 * @version 1.0.0
 */

// ---------------------------------------------------------------------------
// CHANGELOG
// ---------------------------------------------------------------------------
// 1.0.0 — initial release
// ---------------------------------------------------------------------------

/** @typedef {import('../src/types.js').ColumnDef}    ColumnDef */
/** @typedef {import('../src/types.js').NormalizedRow} NormalizedRow */

// ---------------------------------------------------------------------------
// Column definitions
// ---------------------------------------------------------------------------

/** @type {ColumnDef[]} */
const JUNGLELAND_COLUMNS = [
    { key: 'date',    label: 'Date',    type: 'date',   width: '105px' },
    { key: 'year',    label: 'Year',    type: 'number', width: '58px',
      derivedFrom: 'date', derive: v => v.slice(0, 4) },
    { key: 'month',   label: 'MM',      type: 'number', width: '46px',
      derivedFrom: 'date', derive: v => v.slice(5, 7) },
    { key: 'day',     label: 'DD',      type: 'number', width: '46px',
      derivedFrom: 'date', derive: v => v.slice(8, 10) },
    { key: 'title',   label: 'Title',   type: 'string' },
    { key: 'version', label: 'Ver',     type: 'number', width: '46px', filterable: false },
    { key: 'href',    label: 'Link',    type: 'string', sortable: false, filterable: false },
];

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

const BASE_URL = 'https://www.jungleland.it/html/';

/** Matches the trailing (YYYY-MM-DD) date group in the link text. */
const DATE_IN_TEXT_RE = /\((\d{4}-\d{2}-\d{2})\)\s*$/;

/** Matches the optional version suffix in the href filename: "_N.htm". */
const VERSION_IN_HREF_RE = /_(\d+)\.htm$/i;

/** Matches bootleg hrefs: YYYYMMDD.htm or YYYYMMDD_N.htm. */
const BOOTLEG_HREF_RE = /^\d{8}(_\d+)?\.htm$/i;

/**
 * Adapter for https://www.jungleland.it/html/list.htm.
 *
 * @type {{ triggerSelector: string, columnDefs: ColumnDef[], extract(): NormalizedRow[] }}
 */
const JunglelandAdapter = {
    /** CSS selector for the element where the trigger button is injected. */
    triggerSelector: 'form[name="theForm"]',

    /** Column definitions passed to SmartTable.render(). */
    columnDefs: JUNGLELAND_COLUMNS,

    /**
     * Scrapes all bootleg entries from the page and returns NormalizedRow[].
     * Derived columns (year, month, day) are computed automatically by the
     * renderer — extract() does not need to populate them.
     *
     * @returns {NormalizedRow[]}
     */
    extract() {
        /** @type {NormalizedRow[]} */
        const rows = [];

        const links = document.querySelectorAll('a[target="inferioredx1"]');
        for (const a of links) {
            const rawHref = a.getAttribute('href') ?? '';
            if (!BOOTLEG_HREF_RE.test(rawHref)) continue;

            const text  = a.textContent.trim();
            const dateM = DATE_IN_TEXT_RE.exec(text);
            if (!dateM) continue;

            const date    = dateM[1];
            const title   = text.slice(0, text.lastIndexOf(`(${date})`)).trim();
            const verM    = VERSION_IN_HREF_RE.exec(rawHref);
            const version = verM ? verM[1] : '1';
            const href    = new URL(rawHref, BASE_URL).href;

            rows.push({ date, title, version, href });
        }

        return rows;
    },
};

// Expose as global for Tampermonkey @require context
if (typeof window !== 'undefined') window.JunglelandAdapter = JunglelandAdapter;
