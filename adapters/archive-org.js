/**
 * @file adapters/archive-org.js
 * @description Adapter for Internet Archive bootleg search results:
 *   https://archive.org/search?query=subject%3A%22Bruce+Springsteen%22&sort=title&and%5B%5D=year%3A%221976%22
 *
 *   The archive.org search page is a React SPA — the DOM contains no records
 *   in the initial HTML. This adapter uses the archive.org advancedsearch.php
 *   JSON API instead of DOM scraping.
 *
 *   IMPORTANT — extract() returns a Promise:
 *   Because data is fetched asynchronously, the userscript must await results
 *   before calling SmartTable.render():
 *
 *   @example
 *   ArchiveOrgAdapter.extract().then(rows => {
 *     SmartTable.render({
 *       columns:   ArchiveOrgAdapter.columnDefs,
 *       rows,
 *       container: document.querySelector(ArchiveOrgAdapter.triggerSelector),
 *     });
 *   });
 *
 *   The year is read from the current URL's "and[]" parameter. If absent the
 *   current calendar year is used as a fallback.
 *
 *   GM_xmlhttpRequest is preferred over fetch() to avoid cross-origin issues
 *   in strict Tampermonkey environments. The adapter detects whichever is
 *   available at runtime.
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
const ARCHIVE_ORG_COLUMNS = [
    { key: 'date',      label: 'Date',      type: 'date',   width: '105px' },
    { key: 'year',      label: 'Year',      type: 'number', width: '58px',
      derivedFrom: 'date', derive: v => v.slice(0, 4) },
    { key: 'month',     label: 'MM',        type: 'number', width: '46px',
      derivedFrom: 'date', derive: v => v.slice(5, 7) },
    { key: 'day',       label: 'DD',        type: 'number', width: '46px',
      derivedFrom: 'date', derive: v => v.slice(8, 10) },
    { key: 'venue',     label: 'Venue',     type: 'string' },
    { key: 'recType',   label: 'Type',      type: 'string', width: '110px' },
    { key: 'downloads', label: 'Downloads', type: 'number', width: '95px' },
    { key: 'addeddate', label: 'Added',     type: 'date',   width: '105px' },
    { key: 'url',       label: 'Link',      type: 'string', sortable: false, filterable: false,
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
 * Extracts the four-digit year from the current URL's "and[]" parameter.
 * The parameter looks like: and[]=year:"1976"
 *
 * @returns {string} Four-digit year string, e.g. "1976".
 */
function _yearFromUrl() {
    const params = new URLSearchParams(window.location.search);
    for (const val of params.getAll('and[]')) {
        const m = val.match(/"(\d{4})"/);
        if (m) return m[1];
    }
    return String(new Date().getFullYear());
}

/**
 * Builds the advancedsearch.php query URL for the given year.
 *
 * @param {string} year
 * @returns {string}
 */
function _apiUrl(year) {
    const fields = [
        'identifier', 'title', 'date', 'subject', 'downloads', 'addeddate',
    ].join(',');
    const q = encodeURIComponent(
        `subject:"Bruce Springsteen" AND year:${year} AND mediatype:audio`
    );
    return `https://archive.org/advancedsearch.php`
        + `?q=${q}`
        + `&fl[]=${fields}`
        + `&sort[]=title+asc`
        + `&rows=500&page=1&output=json`;
}

/**
 * Fetches a URL and resolves to the parsed JSON. Uses GM_xmlhttpRequest
 * when available (bypasses cross-origin restrictions), otherwise falls back
 * to the native fetch() API.
 *
 * @param {string} url
 * @returns {Promise<unknown>}
 */
function _fetchJson(url) {
    // GM_xmlhttpRequest path (Tampermonkey / Greasemonkey)
    if (typeof GM_xmlhttpRequest === 'function') {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method:   'GET',
                url,
                onload:   r => {
                    try { resolve(JSON.parse(r.responseText)); }
                    catch (e) { reject(e); }
                },
                onerror:  r => reject(new Error(`GM_xmlhttpRequest error: ${r.status}`)),
            });
        });
    }
    // Native fetch fallback
    return fetch(url).then(r => r.json());
}

/**
 * Known recording-type tags in archive.org subject metadata, in priority order.
 * The first match in the subject[] array wins.
 */
const RECORDING_TYPES = ['Soundboard', 'FM', 'Matrix', 'Video', 'Audience'];

/**
 * Strips the "Bruce Springsteen - YYYY-MM-DD, " prefix from a title string
 * to leave just the venue / location.
 *
 * @param {string} title
 * @param {string} date - ISO date string "YYYY-MM-DD"
 * @returns {string}
 */
function _venueFromTitle(title, date) {
    // Remove artist name and date prefix: "Bruce Springsteen - 1976-03-28, Venue..."
    const prefixRe = new RegExp(
        `^Bruce Springsteen(?:\\s*[&]\\s*The E Street Band)?\\s*[-–]\\s*${date},?\\s*`, 'i'
    );
    return title.replace(prefixRe, '').trim();
}

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

/**
 * Adapter for https://archive.org/search (Bruce Springsteen bootleg search).
 * extract() returns a Promise — see file-level JSDoc for usage pattern.
 *
 * @type {{
 *   triggerSelector: string,
 *   columnDefs: ColumnDef[],
 *   extract(): Promise<NormalizedRow[]>
 * }}
 */
const ArchiveOrgAdapter = {
    /**
     * Injection point. The search page is a React SPA so we target the body.
     * The trigger button will be prepended to the body before React mounts.
     */
    triggerSelector: 'body',

    /** Column definitions passed to SmartTable.render(). */
    columnDefs: ARCHIVE_ORG_COLUMNS,

    /**
     * Fetches Bruce Springsteen audio items from the archive.org JSON API for
     * the year encoded in the current page URL. Returns a Promise that resolves
     * to NormalizedRow[].
     *
     * @returns {Promise<NormalizedRow[]>}
     */
    async extract() {
        const year = _yearFromUrl();
        const url  = _apiUrl(year);

        /** @type {{ response: { docs: Array<Record<string,unknown>> } }} */
        const json = await _fetchJson(url);
        const docs = json?.response?.docs ?? [];

        return docs.map(doc => {
            const identifier = String(doc.identifier ?? '');
            const rawDate    = String(doc.date ?? '');
            const date       = rawDate.slice(0, 10); // "YYYY-MM-DD"
            const title      = String(doc.title ?? '');
            const subjects   = Array.isArray(doc.subject) ? doc.subject : [String(doc.subject ?? '')];

            const recType    = RECORDING_TYPES.find(t => subjects.includes(t)) ?? 'Unknown';
            const venue      = _venueFromTitle(title, date);
            const downloads  = String(doc.downloads ?? '');
            const addeddate  = String(doc.addeddate ?? '').slice(0, 10);

            return {
                identifier,
                date,
                venue,
                recType,
                downloads,
                addeddate,
                url:       `https://archive.org/details/${identifier}`,
                thumbnail: `https://archive.org/services/img/${identifier}`,
            };
        });
    },
};

// Expose as global for Tampermonkey @require context
if (typeof window !== 'undefined') window.ArchiveOrgAdapter = ArchiveOrgAdapter;
