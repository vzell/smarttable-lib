/**
 * @file adapters/brucebase.js
 * @description Adapter for the Brucebase event database at
 *   http://brucebase.wikidot.com/YYYY  (e.g. /2026)
 *
 *   Page structure: Wikidot wiki. All event data lives in #page-content.
 *   Events are separated by <hr /> elements. Each event block contains:
 *     - <p> with <a name="DDMMYY"> anchor + <strong><a href="/TYPE:slug">DATE - VENUE</a></strong>
 *     - Zero or more <p> elements with setlist text
 *     - Optional <div class="list-pages-box"> with a description paragraph
 *     - Zero or more <img alt="00Name-32.png" title="Name"> resource icons
 *
 *   Event types (href prefix):
 *     /gig:        actual concert
 *     /recording:  studio / radio session
 *     /rehearsal:  rehearsal (no audience)
 *     /nogig:      cancelled or postponed show
 *
 *   Usage in userscript:
 *   @require .../adapters/brucebase.js
 *   SmartTable.render({
 *     columns:   BrucebaseAdapter.columnDefs,
 *     rows:      BrucebaseAdapter.extract(),
 *     container: document.querySelector(BrucebaseAdapter.triggerSelector),
 *   });
 * @version 1.1.0
 */

// ---------------------------------------------------------------------------
// CHANGELOG
// ---------------------------------------------------------------------------
// 1.0.0 — initial release
// 1.1.0 — url column uses ColumnDef.render to produce a clickable <a> link.
// ---------------------------------------------------------------------------

/** @typedef {import('../src/types.js').ColumnDef}    ColumnDef */
/** @typedef {import('../src/types.js').NormalizedRow} NormalizedRow */

// ---------------------------------------------------------------------------
// Column definitions
// ---------------------------------------------------------------------------

/** @type {ColumnDef[]} */
const BRUCEBASE_COLUMNS = [
    { key: 'date',       label: 'Date',      type: 'date',   width: '105px' },
    { key: 'year',       label: 'Year',      type: 'number', width: '58px',
      derivedFrom: 'date', derive: v => v.slice(0, 4) },
    { key: 'month',      label: 'MM',        type: 'number', width: '46px',
      derivedFrom: 'date', derive: v => v.slice(5, 7) },
    { key: 'day',        label: 'DD',        type: 'number', width: '46px',
      derivedFrom: 'date', derive: v => v.slice(8, 10) },
    { key: 'venue',      label: 'Venue',     type: 'string' },
    { key: 'eventType',  label: 'Type',      type: 'string', width: '100px' },
    { key: 'setlist',    label: 'Setlist',   type: 'string',
      collapsible: true, peekRows: 1 },
    { key: 'description', label: 'Notes',   type: 'string',
      collapsible: true, peekRows: 1 },
    { key: 'hasBootleg', label: 'Bootleg',   type: 'string', width: '70px' },
    { key: 'hasSetlist', label: 'Setlist?',  type: 'string', width: '70px' },
    { key: 'resources',  label: 'Resources', type: 'string', width: '160px', sortable: false },
    { key: 'url',        label: 'Link',      type: 'string', sortable: false, filterable: false,
      render: (url) => {
          const a = document.createElement('a');
          a.href = url; a.textContent = 'Open';
          a.target = '_blank'; a.rel = 'noopener noreferrer';
          return a;
      } },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Extracts the event-type prefix from a Wikidot page path.
 * "/gig:2026-01-17-..." → "gig"
 *
 * @param {string} href
 * @returns {string}
 */
function _eventType(href) {
    const m = href.match(/^\/(\w+):/);
    return m ? m[1] : 'unknown';
}

/**
 * Splits the "#page-content" element's direct children into event blocks,
 * using <hr> elements as dividers. Returns an array of arrays, where each
 * inner array is the sequence of elements belonging to one block.
 *
 * @param {HTMLElement} content
 * @returns {HTMLElement[][]}
 */
function _splitOnHr(content) {
    const blocks  = [];
    let   current = [];
    for (const child of content.children) {
        if (child.tagName === 'HR') {
            if (current.length > 0) {
                blocks.push(current);
                current = [];
            }
        } else {
            current.push(/** @type {HTMLElement} */ (child));
        }
    }
    if (current.length > 0) blocks.push(current);
    return blocks;
}

/**
 * Given a block of elements, collects the title values of all resource icon
 * images (those with alt attributes starting with "00").
 *
 * @param {HTMLElement[]} block
 * @returns {string[]}
 */
function _collectIcons(block) {
    const titles = [];
    for (const el of block) {
        // Direct <img> children of the block
        if (el.tagName === 'IMG' && el.getAttribute('alt')?.startsWith('00')) {
            const t = el.getAttribute('title');
            if (t) titles.push(t);
            continue;
        }
        // Icons nested inside a wrapper element (some Wikidot themes wrap them)
        for (const img of el.querySelectorAll('img[alt^="00"]')) {
            const t = img.getAttribute('title');
            if (t) titles.push(t);
        }
    }
    return titles;
}

/**
 * Given an event heading <p> element and the remaining block elements,
 * collects setlist paragraph text lines. Stops when a <div>, <img>, or
 * another anchor-bearing <p> is encountered.
 *
 * @param {HTMLElement}   headingP  - The <p> containing the event anchor + strong.
 * @param {HTMLElement[]} block     - All elements in the block.
 * @returns {string[]}              - One entry per setlist paragraph.
 */
function _collectSetlist(headingP, block) {
    const lines = [];
    const start = block.indexOf(headingP) + 1;
    for (let i = start; i < block.length; i++) {
        const el = block[i];
        // Stop at the description box or icon images
        if (el.tagName !== 'P') break;
        // Stop if this paragraph is itself a new event heading
        if (el.querySelector('a[name]')) break;
        const txt = el.textContent.trim();
        if (txt) lines.push(txt);
    }
    return lines;
}

/**
 * Extracts the description text from the first .list-pages-item paragraph
 * in a block.
 *
 * @param {HTMLElement[]} block
 * @returns {string}
 */
function _collectDescription(block) {
    for (const el of block) {
        if (!el.classList?.contains('list-pages-box')) continue;
        const p = el.querySelector('.list-pages-item p');
        if (p) return p.textContent.trim();
    }
    return '';
}

/** Matches "YYYY-MM-DD - VENUE TEXT" in event link text. */
const EVENT_TEXT_RE = /^(\d{4}-\d{2}-\d{2})\s*[-–]\s*(.*)/s;

/** Base URL for building absolute event links. */
const BASE_URL = 'http://brucebase.wikidot.com';

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

/**
 * Adapter for http://brucebase.wikidot.com/YYYY.
 *
 * @type {{ triggerSelector: string, columnDefs: ColumnDef[], extract(): NormalizedRow[] }}
 */
const BrucebaseAdapter = {
    /** CSS selector for the element where the trigger button is injected. */
    triggerSelector: '#page-title',

    /** Column definitions passed to SmartTable.render(). */
    columnDefs: BRUCEBASE_COLUMNS,

    /**
     * Scrapes all event entries from the current year page and returns
     * NormalizedRow[]. Derived columns (year, month, day) are computed
     * automatically by the renderer.
     *
     * @returns {NormalizedRow[]}
     */
    extract() {
        const content = /** @type {HTMLElement|null} */ (document.querySelector('#page-content'));
        if (!content) return [];

        const blocks = _splitOnHr(content);
        /** @type {NormalizedRow[]} */
        const rows   = [];

        for (const block of blocks) {
            // Find the event heading paragraph: contains both <a name> and <strong a[href]>
            const headingP = block.find(
                el => el.tagName === 'P'
                   && el.querySelector('a[name]')
                   && el.querySelector('strong a[href]')
            );
            if (!headingP) continue;

            const link = headingP.querySelector('strong a[href]');
            if (!link) continue;

            const href    = link.getAttribute('href') ?? '';
            const textM   = EVENT_TEXT_RE.exec(link.textContent.trim());
            if (!textM) continue;

            const date      = textM[1];
            const venue     = textM[2].trim();
            const eventType = _eventType(href);

            const setlistLines  = _collectSetlist(headingP, block);
            const description   = _collectDescription(block);
            const icons         = _collectIcons(block);
            const resources     = icons.join(', ');

            rows.push({
                date,
                venue,
                eventType,
                url:         BASE_URL + href,
                // string[] → renderer renders as collapsible sub-rows
                setlist:     setlistLines,
                description,
                resources,
                hasBootleg:  icons.includes('Bootleg')  ? 'Yes' : '',
                hasSetlist:  icons.includes('Setlist')  ? 'Yes' : '',
            });
        }

        return rows;
    },
};

// Expose as global for Tampermonkey @require context
if (typeof window !== 'undefined') window.BrucebaseAdapter = BrucebaseAdapter;
