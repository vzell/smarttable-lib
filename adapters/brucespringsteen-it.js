/**
 * @file adapters/brucespringsteen-it.js
 * @description Adapter for both record databases at brucespringsteen.it:
 *
 *   Unofficial bootlegs:
 *     https://www.brucespringsteen.it/DB/records.aspx?tipe=-1,...
 *   Official releases:
 *     https://www.brucespringsteen.it/DB/records.aspx?tipe=-2,...
 *
 *   Both URLs serve identical HTML. The adapter detects which mode is active
 *   by inspecting the "tipe" query parameter: tipe starting with -2 = official.
 *   columnDefs is a getter that returns the appropriate column set.
 *
 *   Page structure: server-rendered flat list. Each record is a <p><b> block:
 *     <p><b>
 *       QTY FORMAT (LABEL_OR_COUNTRY) [<span>PROMO</span>] <br>
 *       <a href="detrec.aspx?code=CODE">TITLE</a><br>
 *       Mx:MATRIX        ← unofficial
 *       Catalogue : CAT  ← official
 *     </b><br>
 *     [<i><u>NOTES</u></i>]
 *     </p>
 *
 *   Usage in userscript:
 *   @require .../adapters/brucespringsteen-it.js
 *   SmartTable.render({
 *     columns:   BrucespringsteenitAdapter.columnDefs,
 *     rows:      BrucespringsteenitAdapter.extract(),
 *     container: document.querySelector(BrucespringsteenitAdapter.triggerSelector),
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
const UNOFFICIAL_COLUMNS = [
    { key: 'title',     label: 'Title',     type: 'string' },
    { key: 'format',    label: 'Format',    type: 'string', width: '80px' },
    { key: 'qty',       label: 'Qty',       type: 'number', width: '42px' },
    { key: 'label',     label: 'Label',     type: 'string', width: '150px' },
    { key: 'catalogue', label: 'Matrix',    type: 'string', width: '130px' },
    { key: 'isPromo',   label: 'Promo',     type: 'string', width: '56px' },
    { key: 'notes',     label: 'Notes',     type: 'string' },
    { key: 'detailUrl', label: 'Link',      type: 'string', sortable: false, filterable: false },
];

/** @type {ColumnDef[]} */
const OFFICIAL_COLUMNS = [
    { key: 'title',     label: 'Title',     type: 'string' },
    { key: 'format',    label: 'Format',    type: 'string', width: '80px' },
    { key: 'qty',       label: 'Qty',       type: 'number', width: '42px' },
    { key: 'country',   label: 'Country',   type: 'string', width: '100px' },
    { key: 'catalogue', label: 'Catalogue', type: 'string', width: '150px' },
    { key: 'isPromo',   label: 'Promo',     type: 'string', width: '56px' },
    { key: 'notes',     label: 'Notes',     type: 'string' },
    { key: 'detailUrl', label: 'Link',      type: 'string', sortable: false, filterable: false },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns true when the current page is the official releases view.
 * Detected by "tipe=-2" in the query string.
 *
 * @returns {boolean}
 */
function _isOfficialPage() {
    return /[?&]tipe=-2/.test(window.location.href);
}

/**
 * Collects text content of all child nodes before the first <br> element.
 * Used to extract the "QTY FORMAT (LABEL_OR_COUNTRY)" first line of a record block.
 *
 * @param {HTMLElement} b
 * @returns {string}
 */
function _firstLineText(b) {
    let text = '';
    for (const node of b.childNodes) {
        if (node.nodeType === Node.ELEMENT_NODE && node.tagName === 'BR') break;
        text += node.textContent;
    }
    return text.trim();
}

/** Matches "QTY FORMAT (LABEL_OR_COUNTRY)" in the first line of a record block. */
const FIRST_LINE_RE = /^(\d+)\s+([^(]+?)\s*\(([^)]+)\)/;

/** Matches the matrix/catalogue number line: "Mx : VALUE" or "Catalogue : VALUE". */
const CATALOGUE_RE = /(?:Mx|Catalogue)\s*:\s*(.+)/i;

/** Detail page base URL — all href values in the listing are relative to this. */
const DETAIL_BASE_URL = 'https://www.brucespringsteen.it/DB/';

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

/**
 * Adapter for https://www.brucespringsteen.it/DB/records.aspx.
 * Handles both the unofficial (tipe=-1) and official (tipe=-2) views.
 *
 * @type {{ triggerSelector: string, readonly columnDefs: ColumnDef[], extract(): NormalizedRow[] }}
 */
const BrucespringsteenitAdapter = {
    /** CSS selector for the element where the trigger button is injected. */
    triggerSelector: 'form[name="mio"]',

    /**
     * Returns the appropriate column set for the current page mode.
     * Evaluated at render time, not at definition time.
     *
     * @returns {ColumnDef[]}
     */
    get columnDefs() {
        return _isOfficialPage() ? OFFICIAL_COLUMNS : UNOFFICIAL_COLUMNS;
    },

    /**
     * Scrapes all record entries from the page and returns NormalizedRow[].
     *
     * @returns {NormalizedRow[]}
     */
    extract() {
        const official = _isOfficialPage();
        /** @type {NormalizedRow[]} */
        const rows = [];

        for (const a of document.querySelectorAll('a[href^="detrec.aspx"]')) {
            const b = /** @type {HTMLElement|null} */ (a.closest('b'));
            if (!b) continue;

            const p = /** @type {HTMLElement|null} */ (a.closest('p'));

            // Parse "QTY FORMAT (LABEL_OR_COUNTRY)" from text before the first <br>
            const firstLine = _firstLineText(b);
            const lineM     = FIRST_LINE_RE.exec(firstLine);

            const qty    = lineM ? lineM[1] : '';
            const format = lineM ? lineM[2].trim() : '';
            const paren  = lineM ? lineM[3].trim() : '';

            // Parse matrix / catalogue number from the full text block
            const catM      = CATALOGUE_RE.exec(b.textContent);
            const catalogue = catM ? catM[1].trim() : '';

            // Promo flag: yellow highlight span exists in the block
            const isPromo = b.querySelector('span[style*="FFFF00"]') ? 'Yes' : '';

            // Optional variant notes: <i><u> outside the <b> but inside <p>
            const notesEl = p ? p.querySelector('i > u') : null;
            const notes   = notesEl ? notesEl.textContent.trim() : '';

            // Build absolute detail URL from relative href
            const rawHref   = a.getAttribute('href') ?? '';
            const detailUrl = new URL(rawHref, DETAIL_BASE_URL).href;

            /** @type {NormalizedRow} */
            const row = {
                title:     a.textContent.trim(),
                format,
                qty,
                catalogue,
                isPromo,
                notes,
                detailUrl,
            };

            if (official) {
                row.country = paren;
            } else {
                row.label = paren;
            }

            rows.push(row);
        }

        return rows;
    },
};

// Expose as global for Tampermonkey @require context
if (typeof window !== 'undefined') window.BrucespringsteenitAdapter = BrucespringsteenitAdapter;
