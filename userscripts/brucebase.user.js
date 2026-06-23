// ==UserScript==
// @name         Brucebase Smart Table
// @namespace    smarttable-lib
// @version      1.0
// @description  Renders brucebase.wikidot.com year pages as an interactive table.
//               Navigate to a year page such as http://brucebase.wikidot.com/1978
//               and click "Show table" to render. Columns include date, venue,
//               event type, setlist (collapsible), notes (collapsible), and resource
//               icons (Bootleg, Setlist flags).
// @author       vzell
// @match        *://brucebase.wikidot.com/1*
// @match        *://brucebase.wikidot.com/2*
// @require      https://raw.githubusercontent.com/vzell/smarttable-lib/main/dist/smarttable.min.js
// @require      https://raw.githubusercontent.com/vzell/smarttable-lib/main/adapters/brucebase.js
// @grant        none
// ==/UserScript==

// Guard: only run on year pages (path matches /YYYY — four consecutive digits).
// The @match above is intentionally broad (covers any path starting with 1 or 2)
// so we filter here to avoid injecting on unrelated Wikidot pages.
if (!/^\/\d{4}$/.test(window.location.pathname)) {
    // Not a year page — do nothing
} else {
    const container = document.querySelector(BrucebaseAdapter.triggerSelector);
    if (container) {
        SmartTable.render({
            columns:   BrucebaseAdapter.columnDefs,
            rows:      BrucebaseAdapter.extract(),
            container,
        });
    }
}
