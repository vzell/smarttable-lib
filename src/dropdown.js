/**
 * @file dropdown.js
 * @description Builds and manages the three-section per-column filter dropdown:
 *   A) Meta entries  — synthetic predicates for non-text cell content
 *   B) Quick filter  — live search input for section C; Enter confirms, Esc clears
 *   C) Unique values — sorted list of distinct text values with counts
 *
 *   The dropdown is a plain HTMLElement (no shadow DOM) so it inherits the
 *   host page's scrolling and z-index context. Callers are responsible for
 *   positioning it relative to the column header.
 * @version 1.4.0
 */

// ---------------------------------------------------------------------------
// CHANGELOG
// ---------------------------------------------------------------------------
// 1.0.0 — initial release
//         Dropdown class with build(), show(), hide(), destroy(),
//         getColumnFilter() defined.
// 1.1.0 — emptyColumnFilter() and _cloneFilter() include isRegex (default false)
//          so the field survives round-trips through the dropdown onChange handler.
// 1.2.0 — Defer input.focus() with setTimeout(0) so the caller can set position
//          styles before the browser scrolls to the newly focused element.
// 1.3.0 — onClose callback added to constructor (5th arg); called when the user
//          presses Escape on an already-empty quick filter to signal the host to
//          close the dropdown rather than just clearing the input.
//          Two-stage Escape: first press clears non-empty quick filter; second
//          press (empty field) calls onClose?.().
//          _highlightText(): highlights the quick-filter search query inside each
//          value item label using <mark class="st-dropdown-match"> elements.
// 1.4.0 — Keyboard UX improvements:
//          this._quickInput stores the live input reference so other methods can
//          focus it programmatically.
//          Escape in the quick-filter input now calls stopPropagation so it never
//          leaks to the root handler; input.focus() called after clearing to survive
//          any focus loss caused by _refreshValuesList rebuilding DOM nodes.
//          ArrowDown/ArrowUp on the quick-filter input navigate to the first/last
//          value item respectively.
//          Root-level keydown handler added in build(): ArrowDown/ArrowUp move
//          between value/meta items; ArrowUp from the topmost item returns focus
//          to the quick-filter input; Escape from any item (not the input, which
//          already stops propagation) returns focus to the quick-filter input.
// ---------------------------------------------------------------------------

import { META_LABELS } from './filter-engine.js';

/**
 * @typedef {import('./types.js').ColumnDef}    ColumnDef
 * @typedef {import('./types.js').ColumnFilter} ColumnFilter
 */

// ---------------------------------------------------------------------------
// CSS class constants
// ---------------------------------------------------------------------------

const C = {
    ROOT:         'st-dropdown',
    SECTION:      'st-dropdown-section',
    SECTION_HEAD: 'st-dropdown-section-head',
    QUICK_INPUT:  'st-dropdown-quick-input',
    ITEM:         'st-dropdown-item',
    ITEM_CHECKED: 'st-dropdown-item--checked',
    COUNT:        'st-dropdown-count',
    META_ITEM:    'st-dropdown-item--meta',
    NO_RESULTS:   'st-dropdown-no-results',
};

// ---------------------------------------------------------------------------
// Dropdown class
// ---------------------------------------------------------------------------

export class Dropdown {
    /**
     * @param {ColumnDef}   colDef
     * @param {object}      data
     * @param {string[]}    data.metaEntryKeys     - Active meta predicate keys for this column.
     * @param {Array<{value: string, count: number}>} data.uniqueValues
     * @param {ColumnFilter} initialFilter         - Current filter state for this column.
     * @param {function(ColumnFilter): void} onChange - Called whenever filter state changes.
     * @param {function(): void} [onClose] - Called when the user presses Escape on an
     *   already-empty quick filter to request closing the dropdown.
     */
    constructor(colDef, data, initialFilter, onChange, onClose) {
        this._def     = colDef;
        this._data    = data;
        this._filter  = this._cloneFilter(initialFilter);
        this._onChange = onChange;
        this._onClose  = onClose ?? null;

        /** @type {HTMLElement|null} */
        this._root = null;

        /** @type {HTMLInputElement|null} The quick-filter text input (set during build). */
        this._quickInput = null;

        /** @type {string} Quick filter input value */
        this._quickFilter = '';
    }

    // -------------------------------------------------------------------------
    // Public API
    // -------------------------------------------------------------------------

    /**
     * Builds the dropdown DOM and appends it to the given container.
     *
     * @param {HTMLElement} container - Parent element (usually document.body or a wrapper).
     * @returns {HTMLElement} The root dropdown element.
     */
    build(container) {
        if (this._root) {
            this.destroy();
        }

        const root = document.createElement('div');
        root.className = C.ROOT;
        root.setAttribute('role', 'dialog');
        root.setAttribute('aria-label', `Filter: ${this._def.label}`);

        // Section A — meta entries
        if (this._data.metaEntryKeys.length > 0) {
            root.appendChild(this._buildMetaSection());
            root.appendChild(this._buildDivider());
        }

        // Section B — quick filter input
        root.appendChild(this._buildQuickFilterSection());
        root.appendChild(this._buildDivider());

        // Section C — unique values list
        this._valuesSection = this._buildValuesSection();
        root.appendChild(this._valuesSection);

        container.appendChild(root);
        this._root = root;

        // Root-level keyboard navigation.
        // Escape is stopped in the quick-filter input's own handler (stopPropagation)
        // so this listener only sees Escape events from value/meta items — in which case
        // we return focus to the quick-filter input.
        // ArrowDown/Up from items is handled here; ArrowDown/Up from the input is
        // handled in _buildQuickFilterSection (also stopPropagation, so no double-run).
        root.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                const items = /** @type {HTMLElement[]} */ (
                    Array.from(root.querySelectorAll(`.${C.ITEM}`))
                );
                const idx = items.indexOf(/** @type {any} */ (document.activeElement));
                if (idx !== -1) {
                    e.preventDefault();
                    if (e.key === 'ArrowUp' && idx === 0) {
                        // Wrap: top of list → back to quick-filter input
                        this._quickInput?.focus();
                    } else {
                        const next = e.key === 'ArrowDown' ? idx + 1 : idx - 1;
                        items[Math.max(0, Math.min(items.length - 1, next))]?.focus();
                    }
                }
            } else if (e.key === 'Escape') {
                // Only reaches here from non-input elements (input calls stopPropagation)
                e.preventDefault();
                e.stopPropagation();
                this._quickInput?.focus();
            }
        });

        // Defer focus until the caller has had a chance to set position styles.
        // Without deferral the browser scrolls to show the un-positioned element
        // (which is appended at the end of the document body) before the caller
        // can place it near the badge button.
        if (this._quickInput) {
            setTimeout(() => this._quickInput?.focus(), 0);
        }

        return root;
    }

    /**
     * Removes the dropdown from the DOM.
     *
     * @returns {void}
     */
    destroy() {
        this._root?.remove();
        this._root       = null;
        this._quickInput = null;
    }

    /**
     * Returns the current ColumnFilter state.
     *
     * @returns {ColumnFilter}
     */
    getColumnFilter() {
        return this._cloneFilter(this._filter);
    }

    // -------------------------------------------------------------------------
    // Section builders
    // -------------------------------------------------------------------------

    /**
     * @returns {HTMLElement}
     */
    _buildMetaSection() {
        const section = this._makeSection('Meta');

        for (const key of this._data.metaEntryKeys) {
            const label = META_LABELS[key] ?? key;
            const checked = this._filter.metaEntries.includes(key);

            const item = this._makeCheckItem(label, checked, C.META_ITEM, () => {
                this._toggleMeta(key);
            });
            section.appendChild(item);
        }

        return section;
    }

    /**
     * @returns {HTMLElement}
     */
    _buildQuickFilterSection() {
        const section = document.createElement('div');
        section.className = C.SECTION;

        const input = document.createElement('input');
        input.type = 'text';
        input.className = C.QUICK_INPUT;
        input.placeholder = 'Search values…';
        input.setAttribute('aria-label', 'Search unique values');
        input.value = this._quickFilter;

        input.addEventListener('input', () => {
            this._quickFilter = input.value;
            this._refreshValuesList();
        });

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                this._confirmQuickFilter();
            } else if (e.key === 'Escape') {
                // stopPropagation prevents the root handler from also seeing this
                // and trying to focus an already-destroyed input after onClose().
                e.preventDefault();
                e.stopPropagation();
                if (input.value !== '') {
                    // First Escape: clear the search input, cursor to start.
                    // input.focus() after _refreshValuesList() guards against any
                    // focus loss that occurs when the values section is rebuilt.
                    input.value = '';
                    input.setSelectionRange(0, 0);
                    this._quickFilter = '';
                    this._refreshValuesList();
                    input.focus();
                } else {
                    // Second Escape (already empty): signal host to close
                    this._onClose?.();
                }
            } else if (e.key === 'ArrowDown') {
                // Navigate to the first value/meta item in the list
                e.preventDefault();
                e.stopPropagation();
                const firstItem = /** @type {HTMLElement|null} */ (
                    this._root?.querySelector(`.${C.ITEM}`)
                );
                firstItem?.focus();
            } else if (e.key === 'ArrowUp') {
                // Navigate to the last value/meta item in the list
                e.preventDefault();
                e.stopPropagation();
                const items = this._root?.querySelectorAll(`.${C.ITEM}`);
                if (items && items.length > 0) {
                    /** @type {HTMLElement} */ (items[items.length - 1]).focus();
                }
            }
        });

        // Store reference so build() and destroy() can focus/clear it
        this._quickInput = input;
        section.appendChild(input);
        return section;
    }

    /**
     * @returns {HTMLElement}
     */
    _buildValuesSection() {
        const section = this._makeSection('Values');
        this._renderValueItems(section);
        return section;
    }

    // -------------------------------------------------------------------------
    // Values list rendering (re-used on quick filter update)
    // -------------------------------------------------------------------------

    /**
     * Re-renders the items inside the values section based on the current
     * quick filter string.
     *
     * @returns {void}
     */
    _refreshValuesList() {
        if (!this._valuesSection) {
            return;
        }
        // Remove old items (keep the section heading)
        const heading = this._valuesSection.querySelector(`.${C.SECTION_HEAD}`);
        this._valuesSection.innerHTML = '';
        if (heading) {
            this._valuesSection.appendChild(heading);
        }
        this._renderValueItems(this._valuesSection);
    }

    /**
     * @param {HTMLElement} section
     * @returns {void}
     */
    _renderValueItems(section) {
        const lowerQ = this._quickFilter.toLowerCase();

        const matching = lowerQ
            ? this._data.uniqueValues.filter(({ value }) =>
                value.toLowerCase().includes(lowerQ))
            : this._data.uniqueValues;

        if (matching.length === 0) {
            const msg = document.createElement('div');
            msg.className = C.NO_RESULTS;
            msg.textContent = 'No matching values';
            section.appendChild(msg);
            return;
        }

        for (const { value, count } of matching) {
            const checked = this._filter.valueEntries.includes(value);

            const item = this._makeCheckItem(value, checked, '', () => {
                this._toggleValue(value);
            });

            // Highlight the quick-filter query inside the label text
            if (this._quickFilter) {
                const labelEl = item.querySelector('.st-dropdown-item-label');
                if (labelEl instanceof HTMLElement) {
                    labelEl.textContent = '';
                    this._highlightText(labelEl, value, this._quickFilter);
                }
            }

            const countEl = document.createElement('span');
            countEl.className = C.COUNT;
            countEl.textContent = String(count);
            item.appendChild(countEl);

            section.appendChild(item);
        }
    }

    /**
     * Renders text into a container, wrapping occurrences of query in
     * <mark class="st-dropdown-match"> elements for visual highlighting.
     * Uses textContent only — safe from XSS even with user-supplied query.
     *
     * @param {HTMLElement} container
     * @param {string}      text    - Full value string.
     * @param {string}      query   - The quick-filter search string (literal, case-insensitive).
     * @returns {void}
     */
    _highlightText(container, text, query) {
        const lower  = text.toLowerCase();
        const lowerQ = query.toLowerCase();
        let pos = 0;
        let idx;
        while ((idx = lower.indexOf(lowerQ, pos)) !== -1) {
            if (idx > pos) {
                container.appendChild(document.createTextNode(text.slice(pos, idx)));
            }
            const mark = document.createElement('mark');
            mark.className = 'st-dropdown-match';
            mark.textContent = text.slice(idx, idx + query.length);
            container.appendChild(mark);
            pos = idx + query.length;
        }
        if (pos < text.length) {
            container.appendChild(document.createTextNode(text.slice(pos)));
        }
    }

    // -------------------------------------------------------------------------
    // Filter state mutations
    // -------------------------------------------------------------------------

    /**
     * @param {string} key
     * @returns {void}
     */
    _toggleMeta(key) {
        const idx = this._filter.metaEntries.indexOf(key);
        if (idx === -1) {
            this._filter.metaEntries.push(key);
        } else {
            this._filter.metaEntries.splice(idx, 1);
        }
        this._emitChange();
    }

    /**
     * @param {string} value
     * @returns {void}
     */
    _toggleValue(value) {
        const idx = this._filter.valueEntries.indexOf(value);
        if (idx === -1) {
            this._filter.valueEntries.push(value);
        } else {
            this._filter.valueEntries.splice(idx, 1);
        }
        this._emitChange();
    }

    /**
     * Confirms the quick filter text as a value selection for all currently
     * visible (matched) items.
     *
     * @returns {void}
     */
    _confirmQuickFilter() {
        const lowerQ = this._quickFilter.toLowerCase();
        if (!lowerQ) {
            return;
        }

        const visibleValues = this._data.uniqueValues
            .filter(({ value }) => value.toLowerCase().includes(lowerQ))
            .map(({ value }) => value);

        for (const value of visibleValues) {
            if (!this._filter.valueEntries.includes(value)) {
                this._filter.valueEntries.push(value);
            }
        }

        this._emitChange();
        this._refreshValuesList();
    }

    // -------------------------------------------------------------------------
    // DOM helpers
    // -------------------------------------------------------------------------

    /**
     * @param {string} headingText
     * @returns {HTMLElement}
     */
    _makeSection(headingText) {
        const section = document.createElement('div');
        section.className = C.SECTION;

        const head = document.createElement('div');
        head.className = C.SECTION_HEAD;
        head.textContent = headingText;
        section.appendChild(head);

        return section;
    }

    /**
     * @returns {HTMLElement}
     */
    _buildDivider() {
        const hr = document.createElement('hr');
        hr.className = 'st-dropdown-divider';
        return hr;
    }

    /**
     * @param {string}   label
     * @param {boolean}  checked
     * @param {string}   extraClass
     * @param {function(): void} onClick
     * @returns {HTMLElement}
     */
    _makeCheckItem(label, checked, extraClass, onClick) {
        const item = document.createElement('div');
        item.className = [C.ITEM, extraClass, checked ? C.ITEM_CHECKED : '']
            .filter(Boolean)
            .join(' ');
        item.setAttribute('role', 'checkbox');
        item.setAttribute('aria-checked', String(checked));
        item.tabIndex = 0;

        const checkbox = document.createElement('span');
        checkbox.className = 'st-dropdown-checkbox';
        checkbox.setAttribute('aria-hidden', 'true');
        checkbox.textContent = checked ? '☑' : '☐';

        const labelEl = document.createElement('span');
        labelEl.className = 'st-dropdown-item-label';
        labelEl.textContent = label;

        item.appendChild(checkbox);
        item.appendChild(labelEl);

        const toggle = () => {
            const nowChecked = item.classList.toggle(C.ITEM_CHECKED);
            checkbox.textContent = nowChecked ? '☑' : '☐';
            item.setAttribute('aria-checked', String(nowChecked));
            onClick();
        };

        item.addEventListener('click', toggle);
        item.addEventListener('keydown', (e) => {
            if (e.key === ' ' || e.key === 'Enter') {
                e.preventDefault();
                toggle();
            }
        });

        return item;
    }

    /**
     * @returns {void}
     */
    _emitChange() {
        this._onChange(this.getColumnFilter());
    }

    /**
     * @param {ColumnFilter} f
     * @returns {ColumnFilter}
     */
    _cloneFilter(f) {
        return {
            colKey:        f.colKey,
            metaEntries:   f.metaEntries.slice(),
            valueEntries:  f.valueEntries.slice(),
            regex:         f.regex,
            isRegex:       f.isRegex ?? false,
            regexExclude:  f.regexExclude,
            regexCase:     f.regexCase,
        };
    }
}

/**
 * Factory: creates a default (empty) ColumnFilter for a given column key.
 *
 * @param {string} colKey
 * @returns {ColumnFilter}
 */
export function emptyColumnFilter(colKey) {
    return {
        colKey,
        metaEntries:  [],
        valueEntries: [],
        regex:        '',
        isRegex:      false,
        regexExclude: false,
        regexCase:    false,
    };
}
