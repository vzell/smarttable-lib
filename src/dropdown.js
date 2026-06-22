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
 * @version 1.0.0
 */

// ---------------------------------------------------------------------------
// CHANGELOG
// ---------------------------------------------------------------------------
// 1.0.0 — initial release
//         Dropdown class with build(), show(), hide(), destroy(),
//         getColumnFilter() defined.
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
     */
    constructor(colDef, data, initialFilter, onChange) {
        this._def     = colDef;
        this._data    = data;
        this._filter  = this._cloneFilter(initialFilter);
        this._onChange = onChange;

        /** @type {HTMLElement|null} */
        this._root = null;

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

        // Focus the quick filter input for keyboard-first use
        const input = root.querySelector(`.${C.QUICK_INPUT}`);
        if (input instanceof HTMLElement) {
            input.focus();
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
        this._root = null;
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
                input.value = '';
                this._quickFilter = '';
                this._refreshValuesList();
            }
        });

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

            const countEl = document.createElement('span');
            countEl.className = C.COUNT;
            countEl.textContent = String(count);
            item.appendChild(countEl);

            section.appendChild(item);
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
        regexExclude: false,
        regexCase:    false,
    };
}
