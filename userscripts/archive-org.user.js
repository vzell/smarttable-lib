// ==UserScript==
// @name         Archive.org Bootleg Smart Table
// @namespace    smarttable-lib
// @version      1.0
// @description  Renders Bruce Springsteen bootleg search results on archive.org as an
//               interactive table. Data is fetched from the advancedsearch.php JSON API
//               because the search page is a React SPA with no server-rendered rows.
//               The year is read from the "and[]" URL parameter; falls back to current year.
// @author       vzell
// @match        https://archive.org/search*
// @require      https://raw.githubusercontent.com/vzell/smarttable-lib/main/dist/smarttable.min.js
// @require      https://raw.githubusercontent.com/vzell/smarttable-lib/main/adapters/archive-org.js
// @grant        GM_xmlhttpRequest
// @connect      archive.org
// ==/UserScript==

// Insert a container div at the top of <body> before React mounts its root.
// The trigger button and the table wrapper both land here, above the SPA content.
const container = document.createElement('div');
container.id = 'st-archive-container';
document.body.insertBefore(container, document.body.firstChild);

ArchiveOrgAdapter.extract()
    .then(rows => {
        SmartTable.render({
            columns:   ArchiveOrgAdapter.columnDefs,
            rows,
            container,
        });
    })
    .catch(err => console.error('[SmartTable] archive-org extract failed:', err));
