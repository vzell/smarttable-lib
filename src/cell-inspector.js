/**
 * @file cell-inspector.js
 * @description Inspects a raw HTMLElement (TD or TH) and returns a CellMeta
 *   object describing its text content, images, and non-text nodes.
 *   Broken-image detection is done via a one-time error event listener so
 *   there is no polling and no re-inspection needed.
 * @version 1.0.0
 */

// ---------------------------------------------------------------------------
// CHANGELOG
// ---------------------------------------------------------------------------
// 1.0.0 — initial release
//         inspectCell(), watchBrokenImages(), extractImageMeta() defined.
// ---------------------------------------------------------------------------

/** Tag names treated as non-text content (other than IMG which is handled separately). */
const NON_TEXT_TAGS = new Set(['SVG', 'CANVAS', 'VIDEO', 'AUDIO', 'OBJECT', 'EMBED', 'IFRAME']);

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

/**
 * Extracts metadata from a single HTMLImageElement.
 * The `broken` flag is set synchronously if the image has already failed to
 * load (naturalWidth === 0 && complete), or asynchronously via error listener.
 *
 * @param {HTMLImageElement} img
 * @param {function(ImageMeta): void} [onBrokenChange] - Called when broken state resolves.
 * @returns {import('./types.js').ImageMeta}
 */
function extractImageMeta(img, onBrokenChange) {
    const src = img.getAttribute('src') || null;
    const alt = img.getAttribute('alt') ?? null;
    const title = img.getAttribute('title') ?? null;

    const alreadyBroken = src === null
        || (img.complete && img.naturalWidth === 0);

    /** @type {import('./types.js').ImageMeta} */
    const meta = { src, alt, title, broken: alreadyBroken };

    if (!alreadyBroken && onBrokenChange) {
        img.addEventListener('error', () => {
            meta.broken = true;
            onBrokenChange(meta);
        }, { once: true });
    }

    return meta;
}

/**
 * Recursively collects all text node content from an element,
 * skipping elements that are image or non-text nodes.
 *
 * @param {Node} node
 * @returns {string}
 */
function collectText(node) {
    if (node.nodeType === Node.TEXT_NODE) {
        return node.textContent ?? '';
    }
    if (node.nodeType !== Node.ELEMENT_NODE) {
        return '';
    }
    const tag = /** @type {HTMLElement} */ (node).tagName.toUpperCase();
    if (tag === 'IMG' || NON_TEXT_TAGS.has(tag)) {
        return '';
    }
    return Array.from(node.childNodes)
        .map(collectText)
        .join('');
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Inspects a table cell element and returns a fully-populated CellMeta object.
 * All image broken-state detection is set up here via one-time error listeners.
 *
 * @param {HTMLElement} el - The TD or TH element to inspect.
 * @param {function(import('./types.js').ImageMeta): void} [onBrokenImage]
 *   Optional callback invoked when an image's broken state resolves
 *   asynchronously (i.e. after this function returns).
 * @returns {import('./types.js').CellMeta}
 */
export function inspectCell(el, onBrokenImage) {
    const images = Array.from(el.querySelectorAll('img'))
        .map(img => extractImageMeta(
            /** @type {HTMLImageElement} */ (img),
            onBrokenImage
        ));

    const nonTextNodes = Array.from(el.querySelectorAll('*'))
        .map(child => child.tagName.toUpperCase())
        .filter(tag => NON_TEXT_TAGS.has(tag));

    const text = collectText(el).replace(/\s+/g, ' ').trim() || null;

    const isEmpty = text === null
        && images.length === 0
        && nonTextNodes.length === 0;

    return { text, images, nonTextNodes, isEmpty, rawElement: el };
}

/**
 * Convenience wrapper: inspects all cells in a column (array of TD/TH elements)
 * and returns a CellMeta array of the same length.
 *
 * @param {HTMLElement[]} cells
 * @param {function(number, import('./types.js').ImageMeta): void} [onBrokenImage]
 *   Called with (cellIndex, imageMeta) when broken state resolves.
 * @returns {import('./types.js').CellMeta[]}
 */
export function inspectCells(cells, onBrokenImage) {
    return cells.map((el, idx) =>
        inspectCell(
            el,
            onBrokenImage ? (meta) => onBrokenImage(idx, meta) : undefined
        )
    );
}
